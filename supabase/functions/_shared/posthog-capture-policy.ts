/**
 * Common PostHog capture-envelope validation.
 *
 * This module deliberately has no Deno, Supabase, or provider imports so the
 * exact same rules can be exercised by the Edge producer tests and the
 * app-owned Node gateway.  The provider identity is added only after the
 * caller has been authenticated and the authoritative account row checked.
 */

export type CaptureEnvelope = {
  event: string;
  properties: Record<string, unknown>;
  timestamp?: string;
  user_id?: string;
  /**
   * Transitional database-webhook field. It is accepted only after the
   * trusted Vault-backed webhook secret has authenticated the producer and is
   * immediately resolved against the live public.users row.
   */
  legacy_distinct_id?: string;
  /**
   * These are PostHog SDK transport fields. They are sanitized and retained
   * only so the gateway can forward the SDK's person-property semantics; uuid
   * is deliberately not retained because it is never an identity selector.
   */
  set?: Record<string, unknown>;
  set_once?: Record<string, unknown>;
};

export type CapturePolicyOptions = {
  /**
   * Database/webhook producers may carry the UUID selected by their trusted
   * server-side trigger.  Public client callers must not carry this field.
   */
  allowUserId?: boolean;
  /**
   * Migration compatibility for the old trigger bundle. This is never
   * enabled for browser/bearer callers.
   */
  allowLegacyDistinctId?: boolean;
};

export type CapturePolicyResult =
  | { ok: true; envelope: CaptureEnvelope }
  | { ok: false; error: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * These keys are either provider identity selectors or transport credentials.
 * They are removed at every object depth, including inside $set/$set_once.
 * Ordinary event data remains intact.
 */
const RESERVED_IDENTITY_KEYS = new Set([
  "distinct_id",
  "user_id",
  "$user_id",
  "$device_id",
  "$anon_id",
  "anonymous_id",
  "alias",
  "aliases",
  "$alias",
  "$create_alias",
  "$merge_dangerously",
  "groups",
  "$groups",
  "api_key",
  "token",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isReservedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    RESERVED_IDENTITY_KEYS.has(key) ||
    RESERVED_IDENTITY_KEYS.has(lower) ||
    lower.startsWith("$group_")
  );
}

/**
 * Remove only identity/transport override keys recursively.  Arrays are kept
 * as event data, but object values inside arrays are filtered by the same
 * rule.  This prevents a nested object from smuggling a second identity while
 * preserving legitimate analytics properties.
 */
export function sanitizeCaptureProperties(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) return {};

  const output: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(value)) {
    if (isReservedKey(key)) continue;

    if (isPlainObject(property)) {
      output[key] = sanitizeCaptureValue(property);
    } else if (Array.isArray(property)) {
      output[key] = property.map((item) =>
        isPlainObject(item) ? sanitizeCaptureValue(item) : item,
      );
    } else {
      output[key] = property;
    }
  }
  return output;
}

export function containsEmailProperty(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsEmailProperty);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    key.toLowerCase() === "email" || containsEmailProperty(child),
  );
}

export function stripEmailProperties(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === "email") continue;
    if (Array.isArray(child)) {
      output[key] = child.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? stripEmailProperties(item)
          : item,
      );
    } else if (child && typeof child === "object") {
      output[key] = stripEmailProperties(child);
    } else {
      output[key] = child;
    }
  }
  return output;
}

function sanitizeCaptureValue(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeCaptureProperties(value);
  return sanitized;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const date =
    typeof value === "number"
      ? new Date(value < 10_000_000_000 ? value * 1000 : value)
      : typeof value === "string"
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/**
 * Parse exactly one capture event.  Arrays/batches, unknown envelope keys, and
 * invalid timestamps are rejected instead of being silently reinterpreted.
 */
export function parseCaptureEnvelope(
  input: unknown,
  options: CapturePolicyOptions = {},
): CapturePolicyResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: "A single capture event object is required" };
  }

  const allowedKeys = new Set([
    "event",
    "properties",
    "timestamp",
    "uuid",
    "$set",
    "$set_once",
  ]);
  if (options.allowUserId) allowedKeys.add("user_id");
  if (options.allowLegacyDistinctId) allowedKeys.add("distinct_id");

  for (const key of Object.keys(input)) {
    if (
      (key === "distinct_id" && !options.allowLegacyDistinctId) ||
      key === "alias" ||
      key === "groups"
    ) {
      return { ok: false, error: "Client identity selectors are not accepted" };
    }
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Unsupported capture envelope field: ${key}` };
    }
  }

  const event = input.event;
  if (typeof event !== "string" || !event.trim() || event.length > 200) {
    return { ok: false, error: "A valid event name is required" };
  }

  if (input.properties !== undefined && !isPlainObject(input.properties)) {
    return { ok: false, error: "properties must be an object" };
  }
  if (input.$set !== undefined && !isPlainObject(input.$set)) {
    return { ok: false, error: "$set must be an object" };
  }
  if (input.$set_once !== undefined && !isPlainObject(input.$set_once)) {
    return { ok: false, error: "$set_once must be an object" };
  }
  if (
    input.uuid !== undefined &&
    (typeof input.uuid !== "string" || !EVENT_UUID_PATTERN.test(input.uuid))
  ) {
    return { ok: false, error: "uuid must be a UUID" };
  }

  const timestamp = normalizeTimestamp(input.timestamp);
  if (input.timestamp !== undefined && !timestamp) {
    return { ok: false, error: "timestamp must be a valid date" };
  }

  if (options.allowUserId && input.user_id !== undefined && !UUID_PATTERN.test(String(input.user_id))) {
    return { ok: false, error: "user_id must be a UUID" };
  }
  if (
    options.allowLegacyDistinctId &&
    input.distinct_id !== undefined &&
    !UUID_PATTERN.test(String(input.distinct_id))
  ) {
    return { ok: false, error: "distinct_id must be a UUID" };
  }

  return {
    ok: true,
    envelope: {
      event: event.trim(),
      properties: sanitizeCaptureProperties(input.properties ?? {}),
      ...(timestamp ? { timestamp } : {}),
      ...(input.$set
        ? { set: sanitizeCaptureProperties(input.$set) }
        : {}),
      ...(input.$set_once
        ? { set_once: sanitizeCaptureProperties(input.$set_once) }
        : {}),
      ...(options.allowUserId && input.user_id
        ? { user_id: String(input.user_id) }
        : {}),
      ...(options.allowLegacyDistinctId && input.distinct_id
        ? { legacy_distinct_id: String(input.distinct_id) }
        : {}),
    },
  };
}

export function isIdentityTransitionEvent(event: string): boolean {
  return event === "$identify" || event === "$create_alias" || event === "$merge_dangerously";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}