export type ProviderName = "posthog" | "customer_io" | "onesignal";

export type PostHogMapping =
  | { kind: "mapped"; personUuid: string }
  | { kind: "ambiguous" | "invalid" };

export type PostHogDeletionStatus =
  | { kind: "completed" }
  | { kind: "pending" }
  | { kind: "blocked" };

export function parseCustomerIoDeleteResponse(
  status: number,
  payload: unknown,
): boolean {
  if (status !== 200 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  return Object.keys(payload as Record<string, unknown>).length === 0;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function httpsBase(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("provider host must use HTTPS");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export function buildPostHogPersonsLookupUrl(
  host: string,
  projectId: string,
  consumedUserId: string,
): string {
  if (!projectId || !isUuid(consumedUserId)) throw new Error("invalid PostHog lookup");
  return `${httpsBase(host)}/api/projects/${encoded(projectId)}/persons/?distinct_id=${encoded(consumedUserId)}`;
}

export function buildPostHogDeleteUrl(
  host: string,
  projectId: string,
  personUuid: string,
): string {
  if (!projectId || !isUuid(personUuid)) throw new Error("invalid PostHog target");
  return `${httpsBase(host)}/api/projects/${encoded(projectId)}/persons/${encoded(personUuid)}?delete_events=true&delete_recordings=true`;
}

export function buildPostHogStatusUrl(
  host: string,
  projectId: string,
  personUuid: string,
  status: "pending" | "completed",
): string {
  if (!projectId || !isUuid(personUuid)) throw new Error("invalid PostHog status target");
  return `${httpsBase(host)}/api/projects/${encoded(projectId)}/persons/deletion_status/?person_uuid=${encoded(personUuid)}&status=${status}`;
}

export function buildOneSignalUserUrl(
  appId: string,
  externalId: string,
): string {
  if (!appId || !isUuid(externalId)) throw new Error("invalid OneSignal target");
  return `https://api.onesignal.com/apps/${encoded(appId)}/users/by/external_id/${encoded(externalId)}`;
}

export function customerIoHost(region: string): string | null {
  if (region === "us") return "https://track.customer.io";
  if (region === "eu") return "https://track-eu.customer.io";
  return null;
}

export function buildCustomerIoDeleteUrl(region: string, customerId: string): string {
  const host = customerIoHost(region);
  if (!host || !isUuid(customerId)) throw new Error("invalid Customer.io target");
  return `${host}/api/v1/customers/${encoded(customerId)}`;
}

export function isRetryableProviderStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export type ProviderHttpOutcome = "accepted" | "retryable_failure" | "permanent_failure";

export function classifyProviderHttpStatus(status: number): ProviderHttpOutcome {
  if (isRetryableProviderStatus(status)) return "retryable_failure";
  if (status >= 200 && status < 300) return "accepted";
  return "permanent_failure";
}

export function retryDelayMs(
  retryAfter: string | null | undefined,
  attempt: number,
): number {
  const fallbackAttempt = Math.max(0, Math.min(8, Number.isFinite(attempt) ? attempt : 0));
  const fallback = Math.min(60 * 60 * 1000, 1000 * (2 ** fallbackAttempt));
  if (!retryAfter) return fallback;

  const seconds = Number(retryAfter.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(60 * 60 * 1000, Math.max(1000, seconds * 1000));
  }

  const timestamp = Date.parse(retryAfter);
  if (!Number.isNaN(timestamp)) {
    return Math.min(60 * 60 * 1000, Math.max(1000, timestamp - Date.now()));
  }
  return fallback;
}

function responseResults(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as Record<string, unknown>).results)
  ) {
    return (payload as { results: unknown[] }).results;
  }
  return null;
}

export function parsePostHogPersonMapping(
  payload: unknown,
  expectedConsumedUserId: string,
): PostHogMapping {
  if (!isUuid(expectedConsumedUserId)) return { kind: "invalid" };
  const persons = responseResults(payload);
  if (!persons || persons.length !== 1) return { kind: "ambiguous" };

  const person = persons[0];
  if (!person || typeof person !== "object") return { kind: "invalid" };
  const record = person as Record<string, unknown>;
  if (!isUuid(record.id)) return { kind: "invalid" };

  const distinctIds = Array.isArray(record.distinct_ids)
    ? record.distinct_ids
    : typeof record.distinct_id === "string"
      ? [record.distinct_id]
      : null;
  if (
    !distinctIds ||
    distinctIds.length !== 1 ||
    distinctIds[0] !== expectedConsumedUserId
  ) {
    return { kind: "ambiguous" };
  }
  return { kind: "mapped", personUuid: record.id };
}

export function parsePostHogDeletionStatus(
  payload: unknown,
  expectedPersonUuid: string,
): PostHogDeletionStatus {
  if (!isUuid(expectedPersonUuid)) return { kind: "blocked" };
  const records = responseResults(payload);
  if (!records || records.length !== 1) return { kind: "blocked" };
  const record = records[0];
  if (!record || typeof record !== "object") return { kind: "blocked" };
  const value = record as Record<string, unknown>;
  if (value.person_uuid !== expectedPersonUuid) {
    return { kind: "blocked" };
  }
  if (
    value.status === "completed" &&
    typeof value.delete_verified_at === "string" &&
    !Number.isNaN(Date.parse(value.delete_verified_at))
  ) {
    return { kind: "completed" };
  }
  if (value.status === "pending") return { kind: "pending" };
  return { kind: "blocked" };
}

export function shouldProcessTarget(
  mode: "disabled" | "disposable" | "real",
  targetUserId: string,
  disposableAllowlist: ReadonlySet<string>,
): boolean {
  if (!isUuid(targetUserId)) return false;
  if (mode === "disposable") return disposableAllowlist.has(targetUserId);
  return mode === "real";
}

export type DestructiveControlSnapshot = {
  killSwitch: boolean;
  circuitOpen: boolean;
  requestsThisHour: number;
  accountsThisHour: ReadonlySet<string>;
  maxRequestsPerHour: number;
  maxAccountsPerHour: number;
};

export function reserveDestructiveAttempt(
  snapshot: DestructiveControlSnapshot,
  targetUserId: string,
): { reserved: boolean; reason: string; next: DestructiveControlSnapshot } {
  if (snapshot.killSwitch) {
    return { reserved: false, reason: "kill_switch", next: snapshot };
  }
  if (snapshot.circuitOpen) {
    return { reserved: false, reason: "circuit_open", next: snapshot };
  }
  if (snapshot.requestsThisHour >= snapshot.maxRequestsPerHour) {
    return {
      reserved: false,
      reason: "request_limit",
      next: { ...snapshot, circuitOpen: true },
    };
  }
  const isNewAccount = !snapshot.accountsThisHour.has(targetUserId);
  if (isNewAccount && snapshot.accountsThisHour.size >= snapshot.maxAccountsPerHour) {
    return {
      reserved: false,
      reason: "account_limit",
      next: { ...snapshot, circuitOpen: true },
    };
  }
  const accounts = new Set(snapshot.accountsThisHour);
  accounts.add(targetUserId);
  return {
    reserved: true,
    reason: "reserved",
    next: {
      ...snapshot,
      requestsThisHour: snapshot.requestsThisHour + 1,
      accountsThisHour: accounts,
    },
  };
}

export function validateNoTargetRequest(
  requestUrl: string,
  body: string,
): boolean {
  const url = new URL(requestUrl);
  return url.search === "" && body.trim() === "";
}

/**
 * Keep the final control check adjacent to the destructive send. The injected
 * functions make the ordering testable without importing the Deno worker or
 * issuing a provider request.
 */
export async function dispatchWithLeaseGuard<T>(
  guard: () => Promise<boolean>,
  dispatch: () => Promise<T>,
): Promise<{ dispatched: boolean; result?: T }> {
  if (!await guard()) return { dispatched: false };
  return { dispatched: true, result: await dispatch() };
}