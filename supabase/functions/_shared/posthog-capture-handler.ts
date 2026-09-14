import {
  containsEmailProperty,
  isIdentityTransitionEvent,
  parseCaptureEnvelope,
  sanitizeCaptureProperties,
  stripEmailProperties,
  type CaptureEnvelope,
} from "./posthog-capture-policy.ts";

const GUEST_COOKIE = "posthog_guest";
const GUEST_TOKEN_VERSION = "v1";
const GUEST_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MAX_CAPTURE_BYTES = 128 * 1024;
const MAX_COMPRESSED_BYTES = 64 * 1024;

type LiveAccount =
  | { status: "live"; id: string; email: string | null }
  | { status: "missing" }
  | { status: "error" };

export type CaptureIdentityUser = {
  id: string;
  email?: string | null;
};

export type PostHogCaptureHandlerDependencies = {
  allowedOrigins: readonly string[];
  captureHost: string;
  captureToken: string;
  guestSecret: string;
  authenticateBearer: (
    token: string,
  ) => Promise<CaptureIdentityUser | null>;
  loadLiveAccount: (userId: string) => Promise<LiveAccount>;
  fetchProvider?: typeof fetch;
  now?: () => number;
  randomBytes?: (size: number) => Uint8Array;
};

type HandlerIdentity =
  | { kind: "authenticated"; distinctId: string; email: string | null }
  | { kind: "guest"; distinctId: string };

function responseHeaders(
  req: Request,
  deps: PostHogCaptureHandlerDependencies,
): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    Vary: "Origin",
  });
  const origin = req.headers.get("Origin");
  if (origin && deps.allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  return headers;
}

function jsonResponse(
  req: Request,
  deps: PostHogCaptureHandlerDependencies,
  status: number,
  body: unknown,
  extraHeaders?: HeadersInit,
): Response {
  const headers = responseHeaders(req, deps);
  if (extraHeaders) {
    for (const [key, value] of new Headers(extraHeaders)) headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function isCaptureRoute(route: string | undefined): boolean {
  return route === undefined || route === "" || route === "e" || route === "capture";
}

function isKnownRoute(route: string | undefined): boolean {
  return route === "guest" || isCaptureRoute(route);
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || null;
}

function cookieValue(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function issueGuestToken(
  deps: PostHogCaptureHandlerDependencies,
): Promise<{ token: string; distinctId: string }> {
  const now = Math.floor((deps.now || Date.now)() / 1000);
  const bytes = deps.randomBytes
    ? deps.randomBytes(32)
    : crypto.getRandomValues(new Uint8Array(32));
  const nonce = bytesToBase64Url(bytes);
  const payload = `${GUEST_TOKEN_VERSION}.${nonce}.${now + GUEST_MAX_AGE_SECONDS}`;
  const signature = bytesToBase64Url(await hmac(payload, deps.guestSecret));
  const token = `${payload}.${signature}`;
  return { token, distinctId: `guest:${await sha256(token)}` };
}

async function verifyGuestToken(
  token: string,
  deps: PostHogCaptureHandlerDependencies,
): Promise<string | null> {
  if (token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== GUEST_TOKEN_VERSION) return null;
  const [, nonce, expiryText, signatureText] = parts;
  const expiry = Number(expiryText);
  const now = Math.floor((deps.now || Date.now)() / 1000);
  if (
    !nonce ||
    nonce.length > 128 ||
    !Number.isSafeInteger(expiry) ||
    expiry <= now
  ) return null;
  const supplied = base64UrlToBytes(signatureText);
  if (!supplied) return null;
  const expected = await hmac(
    `${GUEST_TOKEN_VERSION}.${nonce}.${expiryText}`,
    deps.guestSecret,
  );
  if (!constantTimeEqual(supplied, expected)) return null;
  return `guest:${await sha256(token)}`;
}

async function readBoundedBody(
  req: Request,
): Promise<{ body?: unknown; error?: { status: number; message: string } }> {
  const contentType = (req.headers.get("Content-Type") || "").split(";")[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") {
    return { error: { status: 415, message: "application/json is required" } };
  }

  const contentLength = Number(req.headers.get("Content-Length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_COMPRESSED_BYTES) {
    return { error: { status: 413, message: "capture body is too large" } };
  }

  const compressed = new Uint8Array(await req.arrayBuffer());
  if (compressed.length > MAX_COMPRESSED_BYTES) {
    return { error: { status: 413, message: "capture body is too large" } };
  }
  let bytes = compressed;
  const encoding = (req.headers.get("Content-Encoding") || "").toLowerCase();
  if (encoding && encoding !== "identity") {
    if (encoding !== "gzip" || typeof DecompressionStream === "undefined") {
      return { error: { status: 415, message: "unsupported content encoding" } };
    }
    const stream = new Blob([compressed]).stream().pipeThrough(
      new DecompressionStream("gzip"),
    );
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > MAX_CAPTURE_BYTES) {
          await reader.cancel();
          return { error: { status: 413, message: "capture body is too large" } };
        }
        chunks.push(next.value);
      }
    } catch {
      return { error: { status: 400, message: "invalid gzip body" } };
    }
    bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }
  if (bytes.length > MAX_CAPTURE_BYTES) {
    return { error: { status: 413, message: "capture body is too large" } };
  }
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: { status: 400, message: "invalid JSON body" } };
  }
}

function providerProperties(
  identity: HandlerIdentity,
  event: string,
  properties: Record<string, unknown>,
  setProperties?: Record<string, unknown>,
  setOnceProperties?: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = sanitizeCaptureProperties({
    ...properties,
    ...(setProperties ? { $set: setProperties } : {}),
    ...(setOnceProperties ? { $set_once: setOnceProperties } : {}),
  });
  const hadEmail = containsEmailProperty(sanitized);
  const output = stripEmailProperties(sanitized);
  output.distinct_id = identity.distinctId;
  output.$lib = "consumed-edge-gateway";
  if (hadEmail && identity.kind === "authenticated" && identity.email) {
    output.email = identity.email;
  }
  if (identity.kind === "authenticated" && event === "$identify" && identity.email) {
    const set = output.$set && typeof output.$set === "object" &&
        !Array.isArray(output.$set)
      ? { ...(output.$set as Record<string, unknown>) }
      : {};
    set.email = identity.email;
    output.$set = set;
  }
  return output;
}

async function resolveIdentity(
  req: Request,
  deps: PostHogCaptureHandlerDependencies,
): Promise<
  | { ok: true; identity: HandlerIdentity }
  | { ok: false; status: 401 | 404 | 503; message: string }
> {
  const bearer = bearerToken(req);
  if (bearer) {
    const user = await deps.authenticateBearer(bearer);
    if (!user?.id) return { ok: false, status: 401, message: "Unauthorized" };
    const account = await deps.loadLiveAccount(user.id);
    if (account.status === "error") {
      return { ok: false, status: 503, message: "Account status unavailable" };
    }
    if (account.status === "missing") {
      return { ok: false, status: 404, message: "Account not found" };
    }
    return {
      ok: true,
      identity: {
        kind: "authenticated",
        distinctId: account.id,
        email: account.email || null,
      },
    };
  }

  const guest = req.headers.get("X-PostHog-Guest-Token") ||
    cookieValue(req, GUEST_COOKIE);
  const distinctId = guest
    ? await verifyGuestToken(guest, deps)
    : null;
  if (!distinctId) return { ok: false, status: 401, message: "Guest session required" };
  return { ok: true, identity: { kind: "guest", distinctId } };
}

function guestCookie(token: string): string {
  return [
    `${GUEST_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/functions/v1/posthog-capture",
    `Max-Age=${GUEST_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
  ].join("; ");
}

export async function handlePostHogCaptureRequest(
  req: Request,
  route: string | undefined,
  deps: PostHogCaptureHandlerDependencies,
): Promise<Response> {
  if (!isKnownRoute(route)) {
    return jsonResponse(req, deps, 404, { error: "Unsupported analytics route" });
  }
  if (req.method === "OPTIONS") {
    const headers = responseHeaders(req, deps);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "authorization, content-type, x-posthog-guest-token",
    );
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, deps, 405, { error: "Method not allowed" });
  }

  const parsedBody = await readBoundedBody(req);
  if (parsedBody.error) {
    return jsonResponse(req, deps, parsedBody.error.status, {
      error: parsedBody.error.message,
    });
  }

  if (route === "guest") {
    if (
      parsedBody.body !== undefined &&
      (!parsedBody.body ||
        typeof parsedBody.body !== "object" ||
        Array.isArray(parsedBody.body) ||
        Object.keys(parsedBody.body).length > 0)
    ) {
      return jsonResponse(req, deps, 400, {
        error: "Guest identity fields are not accepted",
      });
    }
    if (!deps.guestSecret) {
      return jsonResponse(req, deps, 503, { error: "Guest analytics is not configured" });
    }
    const issued = await issueGuestToken(deps);
    return jsonResponse(
      req,
      deps,
      200,
      { ok: true, session_token: issued.token },
      { "Set-Cookie": guestCookie(issued.token) },
    );
  }

  if (!isCaptureRoute(route)) {
    return jsonResponse(req, deps, 404, { error: "Unsupported analytics route" });
  }
  const parsed = parseCaptureEnvelope(parsedBody.body);
  if (!parsed.ok) return jsonResponse(req, deps, 400, { error: parsed.error });
  const identity = await resolveIdentity(req, deps);
  if (!identity.ok) {
    return jsonResponse(req, deps, identity.status, { error: identity.message });
  }
  if (
    isIdentityTransitionEvent(parsed.envelope.event) &&
    (identity.identity.kind === "guest" || parsed.envelope.event !== "$identify")
  ) {
    return jsonResponse(req, deps, 403, {
      error: "Identity transition is not allowed",
    });
  }
  if (!deps.captureToken) {
    return jsonResponse(req, deps, 503, { error: "PostHog capture is not configured" });
  }

  const properties = providerProperties(
    identity.identity,
    parsed.envelope.event,
    parsed.envelope.properties,
    parsed.envelope.set,
    parsed.envelope.set_once,
  );
  const set = properties.$set;
  const setOnce = properties.$set_once;
  delete properties.$set;
  delete properties.$set_once;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const provider = deps.fetchProvider || fetch;
    const upstream = await provider(`${deps.captureHost.replace(/\/+$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: deps.captureToken,
        event: parsed.envelope.event,
        properties,
        ...(set && typeof set === "object" ? { $set: set } : {}),
        ...(setOnce && typeof setOnce === "object" ? { $set_once: setOnce } : {}),
        ...(parsed.envelope.timestamp ? { timestamp: parsed.envelope.timestamp } : {}),
      }),
    });
    if (!upstream.ok) {
      await upstream.text().catch(() => undefined);
      return jsonResponse(req, deps, 502, { error: "PostHog capture failed" });
    }
    return jsonResponse(req, deps, 200, { ok: true });
  } catch {
    return jsonResponse(req, deps, 502, { error: "PostHog capture unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}
