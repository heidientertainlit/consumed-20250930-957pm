import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeServiceRole } from "../_shared/authorization.ts";
import {
  buildCustomerIoDeleteUrl,
  buildOneSignalUserUrl,
  buildPostHogDeleteUrl,
  buildPostHogPersonsLookupUrl,
  buildPostHogStatusUrl,
  dispatchWithLeaseGuard,
  parseCustomerIoDeleteResponse,
  customerIoHost,
  isRetryableProviderStatus,
  isUuid,
  parsePostHogDeletionStatus,
  parsePostHogPersonMapping,
  retryDelayMs,
  shouldProcessTarget,
  validateNoTargetRequest,
} from "../_shared/provider-deletion.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const MAX_BATCH = 1;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_CAP_MS = 60 * 60 * 1000;
const MAX_READBACK_MISSES = 3;

type Job = {
  job_id: string;
  deleted_user_id: string;
  provider: "posthog" | "customer_io" | "onesignal";
  provider_identifier: string | null;
  state: string;
  mapping_state: string;
  attempts: number;
  accepted_at: string | null;
  lease_token: string;
  readback_misses: number;
};

type ProviderResponse = {
  status: number;
  retryAfter: string | null;
  payload: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function disposableAllowlist(): Set<string> {
  const values = (Deno.env.get("PROVIDER_DELETION_DISPOSABLE_ALLOWLIST") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => isUuid(value));
  return new Set(values);
}

function workerMode(allowlist: ReadonlySet<string>): "disabled" | "disposable" | "real" {
  if (
    Deno.env.get("PROVIDER_DELETION_TEST_MODE") === "disposable" &&
    allowlist.size > 0
  ) {
    return "disposable";
  }
  return Deno.env.get("PROVIDER_DELETION_ENABLED") === "true" &&
      Deno.env.get("PROVIDER_DELETION_REAL_APPROVAL") === "true"
    ? "real"
    : "disabled";
}

function retryAt(attempts: number, retryAfter: string | null = null): string {
  const delay = Math.min(
    RETRY_CAP_MS,
    retryDelayMs(retryAfter, Math.max(0, attempts - 1)),
  );
  return new Date(Date.now() + delay).toISOString();
}

function boundedProviderFailure(status: number): string {
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500 && status <= 599) return "provider_5xx";
  return "provider_rejected";
}

async function providerRequest(
  url: string,
  init: RequestInit,
  parseBody: boolean,
): Promise<ProviderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let payload: unknown = null;
    if (parseBody) {
      const text = await response.text();
      if (text.trim()) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
      }
    }
    return {
      status: response.status,
      retryAfter: response.headers.get("Retry-After"),
      payload,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { status: 408, retryAfter: null, payload: null };
    }
    return { status: 599, retryAfter: null, payload: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordJob(
  admin: any,
  job: Job,
  state: string,
  options: {
    mappingState?: string;
    status?: number | null;
    failureClass?: string | null;
    retryAfter?: string | null;
    attempts?: number;
    accepted?: boolean;
    readbackMiss?: boolean;
  } = {},
): Promise<void> {
  const { data, error } = await admin.rpc("provider_deletion_record_job", {
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_state: state,
    p_mapping_state: options.mappingState ?? null,
    p_last_http_status: options.status ?? null,
    p_failure_class: options.failureClass ?? null,
    p_next_attempt_at: state === "retryable_failure" || state === "accepted_pending"
      ? retryAt(options.attempts ?? 1, options.retryAfter)
      : null,
    p_accepted: options.accepted ?? false,
    p_readback_miss: options.readbackMiss ?? false,
  });
  if (error || data !== true) throw new Error("job update lost lease");
}

async function reserveAttempt(
  admin: any,
  job: Job,
  realMode: boolean,
): Promise<boolean> {
  const { data, error } = await admin.rpc("provider_deletion_reserve_attempt", {
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_real_mode: realMode,
  });
  if (error) throw new Error("control ledger unavailable");
  const result = Array.isArray(data) ? data[0] : data;
  return result?.reserved === true;
}

async function beforeDispatch(
  admin: any,
  job: Job,
  realMode: boolean,
): Promise<boolean> {
  const { data, error } = await admin.rpc("provider_deletion_before_dispatch", {
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_real_mode: realMode,
  });
  if (error) throw new Error("dispatch guard unavailable");
  return data === true;
}

async function processPostHogMapping(admin: any, job: Job): Promise<string | null> {
  const projectId = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";
  const apiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY") ?? "";
  const host = Deno.env.get("POSTHOG_API_HOST") ?? "https://us.posthog.com";
  if (!projectId || !apiKey) {
    await recordJob(admin, job, "blocked", {
      mappingState: "unavailable",
      failureClass: "provider_not_configured",
      attempts: job.attempts,
    });
    return null;
  }

  const lookupUrl = buildPostHogPersonsLookupUrl(host, projectId, job.deleted_user_id);
  const result = await providerRequest(lookupUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  }, true);

  if (isRetryableProviderStatus(result.status)) {
    await recordJob(admin, job, "retryable_failure", {
      status: result.status,
      failureClass: boundedProviderFailure(result.status),
      retryAfter: result.retryAfter,
      attempts: job.attempts,
    });
    return null;
  }
  if (result.status < 200 || result.status >= 300) {
    await recordJob(admin, job, "blocked", {
      mappingState: result.status === 401 || result.status === 403
        ? "unavailable"
        : "ambiguous",
      status: result.status,
      failureClass: "mapping_lookup_rejected",
      attempts: job.attempts,
    });
    return null;
  }

  const mapping = parsePostHogPersonMapping(result.payload, job.deleted_user_id);
  if (mapping.kind !== "mapped") {
    await recordJob(admin, job, "blocked", {
      mappingState: mapping.kind === "ambiguous" ? "ambiguous" : "unavailable",
      failureClass: mapping.kind === "ambiguous"
        ? "mapping_ambiguous"
        : "mapping_invalid",
      attempts: job.attempts,
    });
    return null;
  }

  const { data: saved, error } = await admin.rpc("provider_deletion_set_posthog_mapping", {
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_person_uuid: mapping.personUuid,
  });
  if (error || saved !== true) {
    await recordJob(admin, job, "blocked", {
      mappingState: "ambiguous",
      failureClass: "mapping_conflict",
      attempts: job.attempts,
    });
    return null;
  }
  return mapping.personUuid;
}

async function processPostHogAccepted(
  admin: any,
  job: Job,
  personUuid: string,
): Promise<void> {
  const projectId = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";
  const apiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY") ?? "";
  const host = Deno.env.get("POSTHOG_API_HOST") ?? "https://us.posthog.com";
  const pendingResult = await providerRequest(
    buildPostHogStatusUrl(host, projectId, personUuid, "pending"),
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    true,
  );

  if (isRetryableProviderStatus(pendingResult.status)) {
    await recordJob(admin, job, "retryable_failure", {
      status: pendingResult.status,
      failureClass: boundedProviderFailure(pendingResult.status),
      retryAfter: pendingResult.retryAfter,
      attempts: job.attempts,
      accepted: true,
    });
    return;
  }
  if (pendingResult.status < 200 || pendingResult.status >= 300) {
    await recordJob(admin, job, "blocked", {
      status: pendingResult.status,
      failureClass: "deletion_status_unavailable",
      attempts: job.attempts,
      accepted: true,
    });
    return;
  }

  const pendingStatus = parsePostHogDeletionStatus(
    pendingResult.payload,
    personUuid,
  );
  if (pendingStatus.kind === "pending") {
    await recordJob(admin, job, "accepted_pending", {
      status: pendingResult.status,
      failureClass: "historical_deletion_pending",
      retryAfter: "60",
      attempts: job.attempts,
      accepted: true,
    });
    return;
  }

  const completedResult = await providerRequest(
    buildPostHogStatusUrl(host, projectId, personUuid, "completed"),
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    true,
  );

  if (isRetryableProviderStatus(completedResult.status)) {
    await recordJob(admin, job, "retryable_failure", {
      status: completedResult.status,
      failureClass: boundedProviderFailure(completedResult.status),
      retryAfter: completedResult.retryAfter,
      attempts: job.attempts,
      accepted: true,
    });
    return;
  }
  if (completedResult.status < 200 || completedResult.status >= 300) {
    await recordJob(admin, job, "blocked", {
      status: completedResult.status,
      failureClass: "deletion_status_unavailable",
      attempts: job.attempts,
      accepted: true,
    });
    return;
  }

  const status = parsePostHogDeletionStatus(completedResult.payload, personUuid);
  if (status.kind === "completed") {
    await recordJob(admin, job, "completed", {
      status: completedResult.status,
      failureClass: null,
      attempts: job.attempts,
      accepted: true,
    });
  } else if (status.kind === "pending") {
    await recordJob(admin, job, "accepted_pending", {
      status: completedResult.status,
      failureClass: "historical_deletion_pending",
      retryAfter: "60",
      attempts: job.attempts,
      accepted: true,
    });
  } else {
    await recordJob(admin, job, "blocked", {
      status: completedResult.status,
      failureClass: "deletion_status_ambiguous",
      attempts: job.attempts,
      accepted: true,
    });
  }
}

async function processPostHog(
  admin: any,
  job: Job,
  realMode: boolean,
): Promise<void> {
  let personUuid = job.provider_identifier;
  if (!personUuid) {
    personUuid = await processPostHogMapping(admin, job);
    if (!personUuid) return;
  }

  if (job.accepted_at) {
    await processPostHogAccepted(admin, job, personUuid);
    return;
  }

  const projectId = Deno.env.get("POSTHOG_PROJECT_ID") ?? "";
  const apiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY") ?? "";
  const host = Deno.env.get("POSTHOG_API_HOST") ?? "https://us.posthog.com";
  if (!(await reserveAttempt(admin, job, realMode))) {
    await recordJob(admin, job, "retryable_failure", {
      failureClass: "control_blocked",
      attempts: job.attempts,
    });
    return;
  }
  const dispatchResult = await dispatchWithLeaseGuard(
    () => beforeDispatch(admin, job, realMode),
    () => providerRequest(
      buildPostHogDeleteUrl(host, projectId, personUuid),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      false,
    ),
  );
  if (!dispatchResult.dispatched) {
    await recordJob(admin, job, "retryable_failure", {
      failureClass: "control_blocked",
      attempts: job.attempts,
    });
    return;
  }
  const result = dispatchResult.result!;
  if (isRetryableProviderStatus(result.status)) {
    await recordJob(admin, job, "retryable_failure", {
      status: result.status,
      failureClass: boundedProviderFailure(result.status),
      retryAfter: result.retryAfter,
      attempts: job.attempts,
    });
  } else if (result.status === 200 || result.status === 202) {
    await recordJob(admin, job, "accepted_pending", {
      status: result.status,
      failureClass: "historical_deletion_pending",
      retryAfter: "60",
      attempts: job.attempts,
      accepted: true,
    });
  } else if (result.status >= 200 && result.status < 300) {
    await recordJob(admin, job, "blocked", {
      status: result.status,
      failureClass: "unexpected_acceptance_status",
      attempts: job.attempts,
    });
  } else {
    await recordJob(admin, job, "permanent_failure", {
      status: result.status,
      failureClass: boundedProviderFailure(result.status),
      attempts: job.attempts,
    });
  }
}

async function processOneSignal(
  admin: any,
  job: Job,
  realMode: boolean,
): Promise<void> {
  const appId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
  // The destructive worker only accepts server-side keys.  Prefer a future
  // explicitly named delete key, then reuse the existing runtime server key
  // names; never read a client/mobile key.
  const apiKey =
    Deno.env.get("ONESIGNAL_APP_API_KEY") ??
    Deno.env.get("ONESIGNAL_REST_API_KEY") ??
    Deno.env.get("ONESIGNAL_API_KEY") ??
    "";
  if (!appId || !apiKey || !job.provider_identifier || !isUuid(job.provider_identifier)) {
    await recordJob(admin, job, "blocked", {
      failureClass: "provider_not_configured",
      attempts: job.attempts,
    });
    return;
  }

  const userUrl = buildOneSignalUserUrl(appId, job.provider_identifier);
  if (job.accepted_at) {
    const result = await providerRequest(userUrl, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
    }, true);
    if (result.status === 404) {
      const readbackMisses = job.readback_misses + 1;
      await recordJob(
        admin,
        job,
        readbackMisses >= MAX_READBACK_MISSES
          ? "observed_absent"
          : "accepted_pending",
        {
          status: result.status,
          failureClass: readbackMisses >= MAX_READBACK_MISSES
            ? "observed_absent"
            : "readback_not_yet_conclusive",
          retryAfter: readbackMisses >= MAX_READBACK_MISSES ? null : "60",
          attempts: job.attempts,
          accepted: true,
          readbackMiss: true,
        },
      );
    } else if (isRetryableProviderStatus(result.status)) {
      await recordJob(admin, job, "retryable_failure", {
        status: result.status,
        failureClass: boundedProviderFailure(result.status),
        retryAfter: result.retryAfter,
        attempts: job.attempts,
        accepted: true,
      });
    } else if (result.status >= 200 && result.status < 300) {
      await recordJob(admin, job, "accepted_pending", {
        status: result.status,
        failureClass: "provider_retention_unverified",
        retryAfter: "60",
        attempts: job.attempts,
        accepted: true,
      });
    } else {
      await recordJob(admin, job, "blocked", {
        status: result.status,
        failureClass: "readback_ambiguous",
        attempts: job.attempts,
        accepted: true,
      });
    }
    return;
  }

  if (!(await reserveAttempt(admin, job, realMode))) {
    await recordJob(admin, job, "retryable_failure", {
      failureClass: "control_blocked",
      attempts: job.attempts,
    });
    return;
  }
  const dispatchResult = await dispatchWithLeaseGuard(
    () => beforeDispatch(admin, job, realMode),
    () => providerRequest(userUrl, {
      method: "DELETE",
      headers: { Authorization: `Key ${apiKey}` },
    }, false),
  );
  if (!dispatchResult.dispatched) {
    await recordJob(admin, job, "retryable_failure", {
      failureClass: "control_blocked",
      attempts: job.attempts,
    });
    return;
  }
  const result = dispatchResult.result!;
  if (result.status === 408 || result.status === 599) {
    // A timeout is ambiguous.  Read back the same exact external ID before
    // retrying; even a 404 here is not treated as accepted deletion because
    // no 202 was observed for this attempt.
    await providerRequest(userUrl, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
    }, true);
    await recordJob(admin, job, "retryable_failure", {
      status: 408,
      failureClass: "timeout_ambiguous",
      attempts: job.attempts,
    });
    return;
  }
  if (isRetryableProviderStatus(result.status)) {
    await recordJob(admin, job, "retryable_failure", {
      status: result.status,
      failureClass: boundedProviderFailure(result.status),
      retryAfter: result.retryAfter,
      attempts: job.attempts,
    });
  } else if (result.status === 202) {
    await recordJob(admin, job, "accepted_pending", {
      status: result.status,
      failureClass: "provider_retention_unverified",
      retryAfter: "60",
      attempts: job.attempts,
      accepted: true,
    });
  } else if (result.status >= 200 && result.status < 300) {
    await recordJob(admin, job, "blocked", {
      status: result.status,
      failureClass: "unexpected_acceptance_status",
      attempts: job.attempts,
    });
  } else {
    await recordJob(admin, job, "permanent_failure", {
      status: result.status,
      failureClass: boundedProviderFailure(result.status),
      attempts: job.attempts,
    });
  }
}

async function processCustomerIo(
  admin: any,
  job: Job,
  realMode: boolean,
): Promise<void> {
  const siteId = Deno.env.get("CUSTOMERIO_SITE_ID") ?? "";
  const trackApiKey = Deno.env.get("CUSTOMERIO_TRACK_API_KEY") ?? "";
  const region = Deno.env.get("CUSTOMERIO_REGION") ?? "";
  if (
    !siteId ||
    !trackApiKey ||
    !customerIoHost(region) ||
    !job.provider_identifier ||
    !isUuid(job.provider_identifier)
  ) {
    await recordJob(admin, job, "blocked", {
      failureClass: "provider_not_configured",
      attempts: job.attempts,
    });
    return;
  }

  if (!(await reserveAttempt(admin, job, realMode))) {
    await recordJob(admin, job, "retryable_failure", {
      failureClass: "control_blocked",
      attempts: job.attempts,
    });
    return;
  }
  const basicAuth = btoa(`${siteId}:${trackApiKey}`);
  const dispatchResult = await dispatchWithLeaseGuard(
    () => beforeDispatch(admin, job, realMode),
    () => providerRequest(
      buildCustomerIoDeleteUrl(region, job.provider_identifier),
      {
        method: "DELETE",
        headers: { Authorization: `Basic ${basicAuth}` },
      },
      true,
    ),
  );
  if (!dispatchResult.dispatched) {
    await recordJob(admin, job, "retryable_failure", {
      failureClass: "control_blocked",
      attempts: job.attempts,
    });
    return;
  }

  const result = dispatchResult.result!;
  if (isRetryableProviderStatus(result.status)) {
    await recordJob(admin, job, "retryable_failure", {
      status: result.status,
      failureClass: boundedProviderFailure(result.status),
      retryAfter: result.retryAfter,
      attempts: job.attempts,
    });
  } else if (parseCustomerIoDeleteResponse(result.status, result.payload)) {
    await recordJob(admin, job, "completed", {
      status: result.status,
      attempts: job.attempts,
    });
  } else {
    await recordJob(admin, job, "permanent_failure", {
      status: result.status,
      failureClass: result.status === 200
        ? "unexpected_response_body"
        : boundedProviderFailure(result.status),
      attempts: job.attempts,
    });
  }
}

async function processJob(
  admin: any,
  job: Job,
  realMode: boolean,
): Promise<void> {
  if (!isUuid(job.deleted_user_id)) {
    await recordJob(admin, job, "blocked", {
      failureClass: "invalid_job_target",
      attempts: job.attempts,
    });
    return;
  }
  if (job.provider === "posthog") {
    await processPostHog(admin, job, realMode);
  } else if (job.provider === "onesignal") {
    await processOneSignal(admin, job, realMode);
  } else {
    await processCustomerIo(admin, job, realMode);
  }
}

async function claimJobs(admin: any, mode: "disposable" | "real", allowlist: Set<string>): Promise<Job[]> {
  if (mode === "real") {
    const { data, error } = await admin.rpc("provider_deletion_claim_jobs", {
      p_limit: MAX_BATCH,
    });
    if (error) throw new Error("queue unavailable");
    return Array.isArray(data) ? data as Job[] : [];
  }

  // Disposable mode never passes a client value to this query.  It first
  // reads server-configured IDs, then claims only those exact durable rows.
  const candidates: Job[] = [];
  for (const target of allowlist) {
    const { data, error } = await admin
      .from("provider_deletion_jobs")
      .select("job_id")
      .eq("deleted_user_id", target)
      .in("state", ["queued", "mapping_pending", "retryable_failure", "accepted_pending"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error("queue unavailable");
    for (const row of data ?? []) {
      const { data: claimed, error: claimError } = await admin.rpc(
        "provider_deletion_claim_job",
        { p_job_id: row.job_id },
      );
      if (claimError) throw new Error("queue unavailable");
      if (Array.isArray(claimed) && claimed[0]) candidates.push(claimed[0] as Job);
      if (candidates.length >= MAX_BATCH) return candidates;
    }
  }
  return candidates;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = authorizeServiceRole(req);
  if (!auth.authorized) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.text();
  if (!validateNoTargetRequest(req.url, body)) {
    return jsonResponse({ error: "No target is accepted" }, 400);
  }

  const allowlist = disposableAllowlist();
  const mode = workerMode(allowlist);
  if (mode === "disabled") {
    return jsonResponse({ ok: true, processed: 0, disabled: true });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Worker unavailable" }, 503);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (mode === "real") {
      const { data: realApproved, error: approvalError } = await admin.rpc(
        "provider_deletion_real_mode_approved",
      );
      if (approvalError || realApproved !== true) {
        return jsonResponse({ ok: true, processed: 0, disabled: true });
      }
    }
    const jobs = await claimJobs(admin, mode, allowlist);
    let processed = 0;
    for (const job of jobs) {
      // The real branch is explicitly opt-in.  Disposable mode cannot widen
      // beyond the exact server-only allowlist even if the queue is altered.
      if (!shouldProcessTarget(mode, job.deleted_user_id, allowlist)) {
        await recordJob(admin, job, "retryable_failure", {
          failureClass: "not_allowlisted",
          attempts: job.attempts,
        });
        continue;
      }
      try {
        await processJob(admin, job, mode === "real");
      } catch {
        await recordJob(admin, job, "retryable_failure", {
          failureClass: "worker_error",
          attempts: job.attempts,
        });
      }
      processed++;
    }
    return jsonResponse({ ok: true, processed, mode });
  } catch {
    return jsonResponse({ error: "Provider deletion worker unavailable" }, 503);
  }
});