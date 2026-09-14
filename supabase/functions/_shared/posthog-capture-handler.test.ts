import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePostHogCaptureRequest,
  type PostHogCaptureHandlerDependencies,
} from "./posthog-capture-handler.ts";

const accountId = "11111111-1111-4111-8111-111111111111";

function deps(overrides: Partial<PostHogCaptureHandlerDependencies> = {}) {
  let providerPayload: unknown;
  const value: PostHogCaptureHandlerDependencies = {
    allowedOrigins: [
      "https://app.consumedapp.com",
      "https://www.consumedapp.com",
      "capacitor://localhost",
      "http://localhost",
    ],
    captureHost: "https://us.i.posthog.com",
    captureToken: "server-only-test-token",
    guestSecret: "test-guest-hmac-secret",
    authenticateBearer: async (token) =>
      token === "live-session" ? { id: accountId, email: "real@example.test" } : null,
    loadLiveAccount: async (id) =>
      id === accountId
        ? { status: "live", id, email: "real@example.test" }
        : { status: "missing" },
    fetchProvider: async (_url, init) => {
      providerPayload = JSON.parse(String(init?.body));
      return new Response("ok", { status: 200 });
    },
    now: () => 1_800_000_000_000,
    randomBytes: () => Uint8Array.from({ length: 32 }, (_, index) => index + 1),
    ...overrides,
  };
  return {
    value,
    providerPayload: () => providerPayload as Record<string, any>,
  };
}

test("real HTTP guest issuance and capture use opaque server identity", async () => {
  const fixture = deps();
  const issued = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/guest", {
      method: "POST",
      headers: {
        Origin: "https://app.consumedapp.com",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    "guest",
    fixture.value,
  );
  assert.equal(issued.status, 200);
  assert.equal(
    issued.headers.get("Access-Control-Allow-Origin"),
    "https://app.consumedapp.com",
  );
  assert.match(issued.headers.get("Set-Cookie") || "", /HttpOnly/);
  const session = await issued.json() as { session_token: string };
  assert.match(session.session_token, /^v1\.[^.]+\.\d+\.[^.]+$/);

  const captured = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/e", {
      method: "POST",
      headers: {
        Origin: "https://app.consumedapp.com",
        "Content-Type": "application/json",
        "X-PostHog-Guest-Token": session.session_token,
      },
      body: JSON.stringify({
        uuid: "018f2e4c-7a65-7cc8-8f21-123456789abc",
        event: "guest_event",
        properties: {
          distinct_id: accountId,
          email: "must-not-forward@example.test",
          nested: { user_id: accountId, label: "kept" },
        },
      }),
    }),
    "e",
    fixture.value,
  );
  assert.equal(captured.status, 200);
  const payload = fixture.providerPayload();
  assert.match(payload.properties.distinct_id, /^guest:/);
  assert.equal(payload.properties.email, undefined);
  assert.deepEqual(payload.properties.nested, { label: "kept" });
  assert.notEqual(payload.properties.distinct_id, accountId);
});

test("authenticated capture binds identity to active account and emits no bearer upstream", async () => {
  const fixture = deps();
  const response = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/e", {
      method: "POST",
      headers: {
        Origin: "capacitor://localhost",
        Authorization: "Bearer live-session",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "$identify",
        properties: {
          distinct_id: "22222222-2222-4222-8222-222222222222",
          "$set": { email: "spoof@example.test", name: "Ada" },
        },
      }),
    }),
    "e",
    fixture.value,
  );
  assert.equal(response.status, 200);
  const payload = fixture.providerPayload();
  assert.equal(payload.properties.distinct_id, accountId);
  assert.equal(payload.$set.email, "real@example.test");
  assert.equal(payload.$set.name, "Ada");
  assert.equal(payload.properties.Authorization, undefined);
});

test("gzip SDK body is decoded only within compressed and decompressed bounds", async (t) => {
  if (typeof CompressionStream === "undefined") {
    t.skip("CompressionStream is unavailable in this runtime");
    return;
  }
  const fixture = deps();
  const source = new Blob([
    JSON.stringify({ event: "compressed_event", properties: {} }),
  ]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = await new Response(source).arrayBuffer();
  const response = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/e", {
      method: "POST",
      headers: {
        Authorization: "Bearer live-session",
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: compressed,
    }),
    "e",
    fixture.value,
  );
  assert.equal(response.status, 200);
  assert.equal(fixture.providerPayload().event, "compressed_event");
});

test("gzip decompression bombs are rejected before provider forwarding", async (t) => {
  if (typeof CompressionStream === "undefined") {
    t.skip("CompressionStream is unavailable in this runtime");
    return;
  }
  const fixture = deps();
  const source = new Blob([
    JSON.stringify({
      event: "too_large",
      properties: { oversized: "x".repeat(140 * 1024) },
    }),
  ]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = await new Response(source).arrayBuffer();
  assert.ok(compressed.byteLength < 64 * 1024);
  const response = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/e", {
      method: "POST",
      headers: {
        Authorization: "Bearer live-session",
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: compressed,
    }),
    "e",
    fixture.value,
  );
  assert.equal(response.status, 413);
  assert.equal(fixture.providerPayload(), undefined);
});

test("batch, text/plain, arbitrary origins, and guest identity transitions are denied", async () => {
  const fixture = deps();
  const batch = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/batch", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    }),
    "batch",
    fixture.value,
  );
  assert.equal(batch.status, 404);
  assert.equal(batch.headers.get("Access-Control-Allow-Origin"), null);

  const text = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/e", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ event: "x", properties: {} }),
    }),
    "e",
    fixture.value,
  );
  assert.equal(text.status, 415);

  const issued = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
    "guest",
    fixture.value,
  );
  const { session_token: token } = await issued.json() as { session_token: string };
  const transition = await handlePostHogCaptureRequest(
    new Request("https://project.supabase.co/functions/v1/posthog-capture/e", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PostHog-Guest-Token": token,
      },
      body: JSON.stringify({ event: "$identify", properties: {} }),
    }),
    "e",
    fixture.value,
  );
  assert.equal(transition.status, 403);
});
