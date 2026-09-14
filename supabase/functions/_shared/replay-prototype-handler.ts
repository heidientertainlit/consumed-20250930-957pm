import {
  REPLAY_PROTOTYPE_CONFIG_PATH,
  REPLAY_PROTOTYPE_EVENT_PATH,
  REPLAY_PROTOTYPE_FLAGS_PATH,
  REPLAY_PROTOTYPE_LEASE_PATH,
  REPLAY_PROTOTYPE_LEASE_PROPERTY,
  REPLAY_PROTOTYPE_MAX_BATCH_ITEMS,
  REPLAY_PROTOTYPE_MAX_COMPRESSED_BYTES,
  REPLAY_PROTOTYPE_MAX_DECODED_BYTES,
  REPLAY_PROTOTYPE_MAX_ENVELOPE_BYTES,
  REPLAY_PROTOTYPE_MAX_EVENT_BYTES,
  REPLAY_PROTOTYPE_PUBLIC_PLACEHOLDER,
  REPLAY_PROTOTYPE_RECORDER_ASSET_PATHS,
  REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH,
  REPLAY_PROTOTYPE_REMOTE_CONFIG_SCRIPT_PATH,
  REPLAY_PROTOTYPE_SNAPSHOT_PATH,
  type ReplayPrototypeAudience,
  type ReplayPrototypeContext,
  type ReplayPrototypeDispatchPermit,
  type ReplayPrototypeIdentity,
  type ReplayPrototypeIngestRoute,
  type ReplayPrototypeLedger,
} from "./replay-prototype-protocol.ts";

export type ReplayPrototypeIdentityStatus =
  | "live"
  | "missing"
  | "tombstoned"
  | "unavailable";

export type ReplayPrototypeGatewayDependencies = {
  /**
   * Deliberately defaults to false. A caller must opt in explicitly in a local
   * harness; there is no deployed route or environment activation here.
   */
  enabled?: boolean;
  allowedOrigins?: readonly string[];
  ledger: ReplayPrototypeLedger;
  /**
   * Authenticates only the lease/config request. Event requests authenticate
   * exclusively with their per-item opaque leases.
   */
  authenticateFirstPartyRequest?: (
    request: Request,
  ) => Promise<ReplayPrototypeIdentity | null>;
  /**
   * Exact-ID live account plus deletion-tombstone check. It is called at lease
   * issuance/config access and again immediately before each provider send.
   */
  checkLiveIdentity: (
    identity: ReplayPrototypeIdentity,
  ) => Promise<ReplayPrototypeIdentityStatus>;
  /** Server-only replacement provider token. Never returned to a caller. */
  providerToken: string;
  forward: (
    route: ReplayPrototypeIngestRoute,
    payload: { api_key: string; batch: ReadonlyArray<Record<string, unknown>> },
  ) => Promise<{ ok: boolean }>;
  publicConfiguration?: (
    identity: ReplayPrototypeIdentity,
  ) => Promise<Record<string, unknown>>;
  /** A safe first-party flag result; its shape follows the SDK /flags/ reply. */
  publicFlags?: (
    identity: ReplayPrototypeIdentity,
  ) => Promise<Record<string, unknown>>;
  /**
   * The argument is one of the two fixed asset names, not a browser supplied
   * URL/path. It must return a static local/cached asset response.
   */
  loadRecorderAsset?: (assetName: "lazy-recorder.js") => Promise<Response>;
  now?: () => number;
  randomBytes?: (size: number) => Uint8Array;
};

type ParsedItem =
  | { ok: true; event: Record<string, unknown>; lease: string; context: ReplayPrototypeContext }
  | { ok: false };

type AcceptedItem = {
  event: Record<string, unknown>;
  leaseId: string;
  identity: ReplayPrototypeIdentity;
};

const LEASE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const LEASE_SECRET_PATTERN = /^[A-Za-z0-9_-]{24,256}$/;
const IDENTITY_OVERRIDE_FIELDS = new Set([
  "distinct_id",
  "$user_id",
  "$device_id",
  "$anon_id",
  "anonymous_id",
  "user_id",
  "api_key",
  "token",
  "authorization",
]);
const CONFIG_SECRET_FIELD = /(^|[_-])(token|api[_-]?key|authorization|cookie|secret|password)([_-]|$)/i;
const CONFIG_VALUE_SECRET_MARKER =
  /(?:[?&](?:token|api[_-]?key|authorization|cookie|secret|password)=|(?:bearer|basic)\s+\S+)/i;
const MAX_CONFIGURATION_BYTES = 256 * 1024;
const MAX_CONFIGURATION_DEPTH = 20;
const MAX_CONFIGURATION_KEYS = 512;
const MAX_CONFIGURATION_ARRAY = 2_048;
const CONFIGURATION_TOP_LEVEL_KEYS = new Set([
  "analytics",
  "autocapture",
  "autocaptureExceptions",
  "captureDeadClicks",
  "captureExtraMetrics",
  "capturePerformance",
  "errorTracking",
  "heatmaps",
  "scriptConfig",
  "sessionRecording",
  "siteApps",
  "supportedCompression",
  "surveys",
  "toolbarParams",
  "webExperiments",
]);
const FLAG_TOP_LEVEL_KEYS = new Set([
  "errorsWhileComputingFlags",
  "featureFlagPayloads",
  "featureFlags",
  "flags",
  "quotaLimited",
  "requestId",
]);
const ALLOWED_RELATIVE_ENDPOINTS = new Set(["/e/", "/s/", "/flags/"]);

function now(deps: ReplayPrototypeGatewayDependencies): number {
  return (deps.now || Date.now)();
}

function json(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
  status: number,
  body: unknown,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
    "Cache-Control": "no-store",
  });
  const origin = req.headers.get("origin");
  if (origin && deps.allowedOrigins?.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function options(req: Request, deps: ReplayPrototypeGatewayDependencies): Response {
  const response = json(req, deps, 204, undefined);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization",
  );
  return new Response(null, { status: 204, headers: response.headers });
}

function pathFromRequest(req: Request): string {
  const path = new URL(req.url).pathname;
  if (path === REPLAY_PROTOTYPE_EVENT_PATH.slice(0, -1)) {
    return REPLAY_PROTOTYPE_EVENT_PATH;
  }
  if (path === REPLAY_PROTOTYPE_SNAPSHOT_PATH.slice(0, -1)) {
    return REPLAY_PROTOTYPE_SNAPSHOT_PATH;
  }
  if (path === REPLAY_PROTOTYPE_CONFIG_PATH.slice(0, -1)) {
    return REPLAY_PROTOTYPE_CONFIG_PATH;
  }
  if (path === REPLAY_PROTOTYPE_FLAGS_PATH.slice(0, -1)) {
    return REPLAY_PROTOTYPE_FLAGS_PATH;
  }
  return path;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validString(value: unknown, maximum = 256): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function isIdentityOverrideField(key: string): boolean {
  return IDENTITY_OVERRIDE_FIELDS.has(key.toLowerCase());
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBytes(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length > Math.ceil(REPLAY_PROTOTYPE_MAX_COMPRESSED_BYTES * 4 / 3) + 8 ||
    !/^[A-Za-z0-9+/_=-]+$/.test(value)
  ) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function boundedGunzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > REPLAY_PROTOTYPE_MAX_DECODED_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    return null;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function readBoundedBody(
  req: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const length = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > REPLAY_PROTOTYPE_MAX_ENVELOPE_BYTES) {
    return { ok: false };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return { ok: false };
  }
  if (bytes.length > REPLAY_PROTOTYPE_MAX_ENVELOPE_BYTES) return { ok: false };
  const encoding = (req.headers.get("content-encoding") || "identity").toLowerCase();
  if (encoding === "gzip") {
    const uncompressed = await boundedGunzip(bytes);
    if (!uncompressed) return { ok: false };
    bytes = uncompressed;
  } else if (encoding !== "identity" && encoding !== "") {
    return { ok: false };
  }
  if (bytes.length > REPLAY_PROTOTYPE_MAX_DECODED_BYTES) return { ok: false };
  const text = new TextDecoder().decode(bytes);
  const contentType = (req.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (contentType === "application/x-www-form-urlencoded") {
    const data = new URLSearchParams(text).get("data");
    if (data === null) return { ok: false };
    return decodeDataEnvelope(data);
  }
  if (
    contentType !== "application/json" &&
    contentType !== "text/plain" &&
    contentType !== ""
  ) return { ok: false };
  try {
    const value = JSON.parse(text);
    if (isObject(value) && typeof value.data === "string" &&
      value.event === undefined && value.batch === undefined) {
      return decodeDataEnvelope(value.data);
    }
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

async function decodeDataEnvelope(
  encoded: string,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  // Some SDK transports use raw JSON in `data`; accept it without treating it
  // as a URL or token-bearing provider request.
  try {
    return { ok: true, value: JSON.parse(encoded) };
  } catch {
    // Continue with the documented base64 transport shape.
  }
  let bytes = base64ToBytes(encoded);
  if (!bytes || bytes.length > REPLAY_PROTOTYPE_MAX_COMPRESSED_BYTES) {
    return { ok: false };
  }
  const gzipMagic = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (gzipMagic) {
    const uncompressed = await boundedGunzip(bytes);
    if (!uncompressed) return { ok: false };
    bytes = uncompressed;
  }
  if (bytes.length > REPLAY_PROTOTYPE_MAX_DECODED_BYTES) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false };
  }
}

function batchFromEnvelope(value: unknown): Record<string, unknown>[] | null {
  const batch = Array.isArray(value)
    ? value
    : isObject(value) && Array.isArray(value.batch)
      ? value.batch
      : isObject(value) && typeof value.event === "string"
        ? [value]
        : null;
  if (!batch || batch.length === 0 || batch.length > REPLAY_PROTOTYPE_MAX_BATCH_ITEMS) {
    return null;
  }
  return batch.every(isObject) ? batch : null;
}

function contextFromEvent(event: Record<string, unknown>): ReplayPrototypeContext | null {
  const properties = event.properties;
  if (!isObject(properties)) return null;
  const sessionId = properties.$session_id ?? event.session_id;
  const windowId = properties.$window_id ?? event.window_id;
  if (!validString(sessionId) || !validString(windowId)) return null;
  return { sessionId, windowId };
}

function parseItem(
  source: Record<string, unknown>,
  route: ReplayPrototypeIngestRoute,
): ParsedItem {
  const hasReplayPayload = isObject(source.properties) && (
    Object.prototype.hasOwnProperty.call(source.properties, "$snapshot_data") ||
    Object.prototype.hasOwnProperty.call(source.properties, "$snapshot")
  );
  if (
    !validString(source.event, 512) ||
    !isObject(source.properties) ||
    (route === "s" && (source.event !== "$snapshot" || !hasReplayPayload)) ||
    (route === "e" && (source.event === "$snapshot" || hasReplayPayload))
  ) return { ok: false };
  const lease = source.properties[REPLAY_PROTOTYPE_LEASE_PROPERTY];
  const context = contextFromEvent(source);
  if (!validString(lease, 512) || !context) return { ok: false };
  try {
    if (new TextEncoder().encode(JSON.stringify(source)).length > REPLAY_PROTOTYPE_MAX_EVENT_BYTES) {
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }
  return { ok: true, event: source, lease, context };
}

function parseOpaqueLease(value: string): { leaseId: string; secret: string } | null {
  const parts = value.split(".");
  if (
    parts.length !== 2 ||
    !LEASE_ID_PATTERN.test(parts[0]) ||
    !LEASE_SECRET_PATTERN.test(parts[1])
  ) return null;
  return { leaseId: parts[0], secret: parts[1] };
}

/**
 * This is deliberately shallow. `$snapshot_data` can contain rrweb DOM data;
 * recursive sanitization would mutate potentially masked replay content. Only
 * known outer SDK protocol fields are removed/overridden.
 */
function sanitizeNonSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeNonSnapshotValue);
  if (!isObject(value)) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isIdentityOverrideField(key)) continue;
    output[key] = sanitizeNonSnapshotValue(child);
  }
  return output;
}

function eventForProvider(
  source: Record<string, unknown>,
  identity: ReplayPrototypeIdentity,
): Record<string, unknown> {
  const event: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (isIdentityOverrideField(key)) continue;
    // `$snapshot_data` is only valid under properties, so root fields can be
    // cleaned normally without touching rrweb content.
    event[key] = sanitizeNonSnapshotValue(value);
  }
  const originalProperties = source.properties as Record<string, unknown>;
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(originalProperties)) {
    if (key === REPLAY_PROTOTYPE_LEASE_PROPERTY || isIdentityOverrideField(key)) {
      continue;
    }
    // rrweb data is intentionally opaque to this gateway. Its existing
    // masking must remain byte-for-byte equivalent to the SDK output.
    properties[key] = key === "$snapshot_data"
      ? value
      : sanitizeNonSnapshotValue(value);
  }
  properties.distinct_id = identity.subject;
  event.properties = properties;
  return event;
}

async function authenticateLive(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<ReplayPrototypeIdentity | null> {
  try {
    const identity = await deps.authenticateFirstPartyRequest?.(req);
    if (!identity || !validString(identity.subject) || !validString(identity.epoch)) return null;
    return (await deps.checkLiveIdentity(identity)) === "live" ? identity : null;
  } catch {
    return null;
  }
}

function audiencesFromInput(value: unknown): ReplayPrototypeAudience[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) return null;
  const audiences = value.filter(
    (audience): audience is ReplayPrototypeAudience => audience === "event" || audience === "replay",
  );
  return audiences.length === value.length && new Set(audiences).size === audiences.length
    ? audiences
    : null;
}

function contextsFromInput(value: unknown): ReplayPrototypeContext[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return null;
  const contexts: ReplayPrototypeContext[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isObject(item) || !validString(item.sessionId) || !validString(item.windowId)) {
      return null;
    }
    const context = { sessionId: item.sessionId, windowId: item.windowId };
    const key = `${context.sessionId}\u0000${context.windowId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    contexts.push(context);
  }
  return contexts;
}

async function issueLease(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<Response> {
  if (req.method !== "POST") return json(req, deps, 405, { error: "Method not allowed" });
  const identity = await authenticateLive(req, deps);
  if (!identity) return json(req, deps, 401, { error: "First-party session required" });
  const body = await readBoundedBody(req);
  if (!body.ok || !isObject(body.value)) return json(req, deps, 400, { error: "Invalid lease request" });
  const audiences = audiencesFromInput(body.value.audiences);
  const contexts = contextsFromInput(body.value.contexts);
  if (!audiences || !contexts || Object.keys(body.value).some((key) => key !== "audiences" && key !== "contexts")) {
    return json(req, deps, 400, { error: "Invalid lease scope" });
  }
  const random = deps.randomBytes
    ? deps.randomBytes(40)
    : crypto.getRandomValues(new Uint8Array(40));
  const leaseId = bytesToBase64Url(random.slice(0, 16));
  const secret = bytesToBase64Url(random.slice(16));
  const issuedAt = now(deps);
  const expiresAt = issuedAt + 5 * 60_000;
  const opaqueLease = `${leaseId}.${secret}`;
  try {
    await deps.ledger.createLease({
      leaseId,
      tokenDigest: await sha256(secret),
      identity,
      audiences,
      contexts,
      issuedAt,
      expiresAt,
      captureExpiresAt: expiresAt,
      uploadDeadline: expiresAt,
    });
  } catch {
    return json(req, deps, 409, { error: "Lease context unavailable" });
  }
  return json(req, deps, 200, {
    upload_lease: opaqueLease,
    expires_at: new Date(expiresAt).toISOString(),
    audiences,
  });
}

async function acceptItem(
  parsed: ParsedItem,
  audience: ReplayPrototypeAudience,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<AcceptedItem | null> {
  try {
    if (!parsed.ok) return null;
    const opaque = parseOpaqueLease(parsed.lease);
    if (!opaque) return null;
    const result = await deps.ledger.validateLease(
      opaque.leaseId,
      await sha256(opaque.secret),
      audience,
      now(deps),
    );
    if (!result.ok) return null;
    if (!result.lease.contexts.some((authorized) =>
      authorized.sessionId === parsed.context.sessionId &&
      authorized.windowId === parsed.context.windowId
    )) return null;
    // Reclaiming on every item is deliberate: durable implementations check
    // the immutable global binding even if a stale lease record was restored.
    const claim = await deps.ledger.claimContext(result.lease.identity, parsed.context);
    if (!claim.ok) return null;
    if ((await deps.checkLiveIdentity(result.lease.identity)) !== "live") return null;
    return {
      event: eventForProvider(parsed.event, result.lease.identity),
      leaseId: result.lease.leaseId,
      identity: result.lease.identity,
    };
  } catch {
    return null;
  }
}

async function ingest(
  req: Request,
  route: ReplayPrototypeIngestRoute,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<Response> {
  if (req.method !== "POST") return json(req, deps, 405, { error: "Method not allowed" });
  const decoded = await readBoundedBody(req);
  const batch = decoded.ok ? batchFromEnvelope(decoded.value) : null;
  if (!batch) return json(req, deps, 400, { error: "Invalid SDK envelope" });
  const audience: ReplayPrototypeAudience = route === "e" ? "event" : "replay";
  const accepted: AcceptedItem[] = [];
  for (const item of batch) {
    const candidate = await acceptItem(parseItem(item, route), audience, deps);
    if (candidate) accepted.push(candidate);
  }
  if (accepted.length === 0) {
    return json(req, deps, 400, { accepted: 0, rejected: batch.length });
  }

  const dispatchable: Array<{
    item: AcceptedItem;
    permit: ReplayPrototypeDispatchPermit;
  }> = [];
  for (const item of accepted) {
    try {
      const permit = await deps.ledger.beginDispatch(item.identity, item.leaseId);
      if (permit) dispatchable.push({ item, permit });
    } catch {
      // A per-identity ledger failure is fail-closed for that item only; it
      // must not make unrelated valid items in the same SDK batch disappear.
    }
  }
  if (dispatchable.length === 0) {
    return json(req, deps, 400, { accepted: 0, rejected: batch.length });
  }
  try {
    const forwarded = await deps.forward(route, {
      api_key: deps.providerToken,
      batch: dispatchable.map((entry) => entry.item.event),
    });
    if (!forwarded.ok) {
      return json(req, deps, 502, {
        accepted: 0,
        rejected: batch.length - dispatchable.length,
        retryable: true,
      });
    }
    return json(req, deps, 200, {
      accepted: dispatchable.length,
      rejected: batch.length - dispatchable.length,
    });
  } catch {
    return json(req, deps, 502, {
      accepted: 0,
      rejected: batch.length - dispatchable.length,
      retryable: true,
    });
  } finally {
    await Promise.all(dispatchable.map(async (entry) => {
      try {
        await deps.ledger.finishDispatch(entry.permit);
      } catch {
        // Durable implementations must recover permits; no response may claim
        // a stronger delete/delivery guarantee when finalization is unavailable.
      }
    }));
  }
}

function configKeyIsUnsafe(key: string, providerToken: string): boolean {
  return CONFIG_SECRET_FIELD.test(key) ||
    isIdentityOverrideField(key) ||
    /redirect/i.test(key) ||
    (!!providerToken && key.includes(providerToken));
}

function configStringIsUnsafe(value: string, providerToken: string): boolean {
  return value.length > MAX_CONFIGURATION_BYTES ||
    (!!providerToken && value.includes(providerToken)) ||
    CONFIG_VALUE_SECRET_MARKER.test(value);
}

function validateConfigValue(
  value: unknown,
  providerToken: string,
  depth: number,
): { ok: true; value: unknown } | { ok: false } {
  if (depth > MAX_CONFIGURATION_DEPTH) return { ok: false };
  if (typeof value === "string") {
    return configStringIsUnsafe(value, providerToken)
      ? { ok: false }
      : { ok: true, value };
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) return { ok: true, value };
  if (Array.isArray(value)) {
    if (value.length > MAX_CONFIGURATION_ARRAY) return { ok: false };
    const output: unknown[] = [];
    for (const child of value) {
      const validated = validateConfigValue(child, providerToken, depth + 1);
      if (!validated.ok) return { ok: false };
      output.push(validated.value);
    }
    return { ok: true, value: output };
  }
  if (!isObject(value) || Object.keys(value).length > MAX_CONFIGURATION_KEYS) {
    return { ok: false };
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (configKeyIsUnsafe(key, providerToken)) return { ok: false };
    if (key.toLowerCase().includes("endpoint")) {
      if (typeof child !== "string" || !ALLOWED_RELATIVE_ENDPOINTS.has(child)) {
        return { ok: false };
      }
      output[key] = child;
      continue;
    }
    // URL/host values are only permitted through the dedicated inert replay
    // matching-rule schema below. Elsewhere they can select a route or proxy.
    if (/(?:url|uri|host(?:name)?)/i.test(key)) return { ok: false };
    const validated = validateConfigValue(child, providerToken, depth + 1);
    if (!validated.ok) return { ok: false };
    output[key] = validated.value;
  }
  return { ok: true, value: output };
}

function validateScriptConfig(
  value: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!isObject(value)) return { ok: false };
  const keys = Object.keys(value);
  if (
    keys.some((key) => key !== "script" && key !== "cache_timestamp") ||
    value.script !== "lazy-recorder" ||
    (value.cache_timestamp !== undefined &&
      (typeof value.cache_timestamp !== "number" ||
        !Number.isFinite(value.cache_timestamp)))
  ) return { ok: false };
  return {
    ok: true,
    value: {
      script: "lazy-recorder",
      ...(value.cache_timestamp === undefined
        ? {}
        : { cache_timestamp: value.cache_timestamp }),
    },
  };
}

function validateUrlTriggers(
  value: unknown,
  providerToken: string,
): { ok: true; value: Array<{ url: string; matching: "regex" }> } | { ok: false } {
  if (!Array.isArray(value) || value.length > MAX_CONFIGURATION_ARRAY) {
    return { ok: false };
  }
  const triggers: Array<{ url: string; matching: "regex" }> = [];
  for (const trigger of value) {
    if (
      !isObject(trigger) ||
      Object.keys(trigger).length !== 2 ||
      typeof trigger.url !== "string" ||
      configStringIsUnsafe(trigger.url, providerToken) ||
      trigger.matching !== "regex"
    ) return { ok: false };
    // This string is only handed to the SDK's local trigger matcher. It is
    // never used as a gateway request URL or upstream destination.
    triggers.push({ url: trigger.url, matching: "regex" });
  }
  return { ok: true, value: triggers };
}

function validateSessionRecordingConfiguration(
  value: unknown,
  providerToken: string,
): { ok: true; value: unknown } | { ok: false } {
  if (value === false) return { ok: true, value };
  if (!isObject(value)) return { ok: false };
  const allowed = new Set([
    "consoleLogRecordingEnabled",
    "blockSelector",
    "endpoint",
    "eventTriggers",
    "linkedFlag",
    "maskAllInputs",
    "masking",
    "maskTextSelector",
    "minimumDurationMilliseconds",
    "networkPayloadCapture",
    "sampleRate",
    "scriptConfig",
    "triggerMatchType",
    "urlBlocklist",
    "urlTriggers",
  ]);
  if (
    Object.keys(value).length > MAX_CONFIGURATION_KEYS ||
    Object.keys(value).some((key) => !allowed.has(key) || configKeyIsUnsafe(key, providerToken))
  ) return { ok: false };
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "endpoint") {
      if (typeof child !== "string" || child !== "/s/") return { ok: false };
      output[key] = child;
      continue;
    }
    if (key === "urlTriggers" || key === "urlBlocklist") {
      const triggers = validateUrlTriggers(child, providerToken);
      if (!triggers.ok) return { ok: false };
      output[key] = triggers.value;
      continue;
    }
    if (key === "scriptConfig") {
      const script = validateScriptConfig(child);
      if (!script.ok) return { ok: false };
      output[key] = script.value;
      continue;
    }
    const validated = validateConfigValue(child, providerToken, 0);
    if (!validated.ok) return { ok: false };
    output[key] = validated.value;
  }
  return { ok: true, value: output };
}

function validatePublicConfiguration(
  value: unknown,
  providerToken: string,
  allowedTopLevelKeys: ReadonlySet<string>,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!isObject(value)) return { ok: false };
  const keys = Object.keys(value);
  if (
    keys.length > MAX_CONFIGURATION_KEYS ||
    keys.some((key) => !allowedTopLevelKeys.has(key) || configKeyIsUnsafe(key, providerToken))
  ) return { ok: false };
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "sessionRecording") {
      const recording = validateSessionRecordingConfiguration(child, providerToken);
      if (!recording.ok) return { ok: false };
      output[key] = recording.value;
      continue;
    }
    if (key === "scriptConfig") {
      const script = validateScriptConfig(child);
      if (!script.ok) return { ok: false };
      output[key] = script.value;
      continue;
    }
    const validated = validateConfigValue(child, providerToken, 0);
    if (!validated.ok) return { ok: false };
    output[key] = validated.value;
  }
  try {
    if (new TextEncoder().encode(JSON.stringify(output)).length > MAX_CONFIGURATION_BYTES) {
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }
  return { ok: true, value: output };
}

async function configuration(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, deps, 405, { error: "Method not allowed" });
  }
  const identity = await authenticateLive(req, deps);
  if (!identity) return json(req, deps, 401, { error: "First-party session required" });
  try {
    const config = deps.publicConfiguration
      ? await deps.publicConfiguration(identity)
      : {};
    const validated = validatePublicConfiguration(
      config,
      deps.providerToken,
      CONFIGURATION_TOP_LEVEL_KEYS,
    );
    return validated.ok
      ? json(req, deps, 200, validated.value)
      : json(req, deps, 503, { error: "Configuration rejected" });
  } catch {
    return json(req, deps, 503, { error: "Configuration unavailable" });
  }
}

async function flags(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return json(req, deps, 405, { error: "Method not allowed" });
  }
  const identity = await authenticateLive(req, deps);
  if (!identity) return json(req, deps, 401, { error: "First-party session required" });
  try {
    const loaded = deps.publicFlags ? await deps.publicFlags(identity) : {};
    const validated = validatePublicConfiguration(
      loaded,
      deps.providerToken,
      FLAG_TOP_LEVEL_KEYS,
    );
    if (!validated.ok) return json(req, deps, 503, { error: "Flags rejected" });
    // These keys are the current full SDK's expected /flags/ response fields.
    return json(req, deps, 200, {
      flags: {},
      featureFlags: {},
      featureFlagPayloads: {},
      ...validated.value,
    });
  } catch {
    return json(req, deps, 503, { error: "Flags unavailable" });
  }
}

async function remoteConfiguration(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
  asScript: boolean,
): Promise<Response> {
  if (req.method !== "GET") return json(req, deps, 405, { error: "Method not allowed" });
  const identity = await authenticateLive(req, deps);
  if (!identity) return json(req, deps, 401, { error: "First-party session required" });
  if (asScript) {
    // The SDK then requests the exact JSON fallback below. Do not reflect
    // provider configuration into executable JavaScript.
    return new Response("/* consumed replay prototype remote-config shim */", {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  try {
    const config = deps.publicConfiguration
      ? await deps.publicConfiguration(identity)
      : {};
    const validated = validatePublicConfiguration(
      config,
      deps.providerToken,
      CONFIGURATION_TOP_LEVEL_KEYS,
    );
    return validated.ok
      ? json(req, deps, 200, validated.value)
      : json(req, deps, 503, { error: "Configuration rejected" });
  } catch {
    return json(req, deps, 503, { error: "Configuration unavailable" });
  }
}

async function recorderAsset(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
  assetName: "lazy-recorder.js",
): Promise<Response> {
  if (req.method !== "GET" || !deps.loadRecorderAsset) {
    return json(req, deps, 404, { error: "Not found" });
  }
  try {
    const loaded = await deps.loadRecorderAsset(assetName);
    if (!loaded.ok || loaded.redirected || loaded.headers.has("location")) {
      return json(req, deps, 502, { error: "Recorder asset unavailable" });
    }
    const body = new Uint8Array(await loaded.arrayBuffer());
    if (body.length > REPLAY_PROTOTYPE_MAX_DECODED_BYTES) {
      return json(req, deps, 413, { error: "Recorder asset too large" });
    }
    // A fixed loader must not emit the server provider token into executable
    // code. This is a narrow guard, not permission to proxy arbitrary assets.
    if (deps.providerToken && new TextDecoder().decode(body).includes(deps.providerToken)) {
      return json(req, deps, 502, { error: "Recorder asset unavailable" });
    }
    const headers = new Headers({
      "Content-Type": loaded.headers.get("content-type") || "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(body, { status: 200, headers });
  } catch {
    return json(req, deps, 502, { error: "Recorder asset unavailable" });
  }
}

/**
 * Runtime-neutral handler for local browser harnesses and unit tests. It is
 * intentionally not registered in server/routes.ts or Supabase config.
 */
export async function handleReplayPrototypeRequest(
  req: Request,
  deps: ReplayPrototypeGatewayDependencies,
): Promise<Response> {
  if (deps.enabled !== true) {
    return json(req, deps, 404, { error: REPLAY_PROTOTYPE_PUBLIC_PLACEHOLDER });
  }
  if (req.method === "OPTIONS") return options(req, deps);
  const path = pathFromRequest(req);
  if (path === REPLAY_PROTOTYPE_LEASE_PATH) return issueLease(req, deps);
  if (path === REPLAY_PROTOTYPE_EVENT_PATH) return ingest(req, "e", deps);
  if (path === REPLAY_PROTOTYPE_SNAPSHOT_PATH) return ingest(req, "s", deps);
  if (path === REPLAY_PROTOTYPE_CONFIG_PATH) return configuration(req, deps);
  if (path === REPLAY_PROTOTYPE_FLAGS_PATH) return flags(req, deps);
  if (path === REPLAY_PROTOTYPE_REMOTE_CONFIG_PATH) {
    return remoteConfiguration(req, deps, false);
  }
  if (path === REPLAY_PROTOTYPE_REMOTE_CONFIG_SCRIPT_PATH) {
    return remoteConfiguration(req, deps, true);
  }
  const assetIndex = REPLAY_PROTOTYPE_RECORDER_ASSET_PATHS.indexOf(
    path as typeof REPLAY_PROTOTYPE_RECORDER_ASSET_PATHS[number],
  );
  if (assetIndex === 0) return recorderAsset(req, deps, "lazy-recorder.js");
  return json(req, deps, 404, { error: "Not found" });
}