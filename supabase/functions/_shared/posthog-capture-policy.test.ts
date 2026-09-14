import assert from "node:assert/strict";
import test from "node:test";
import {
  isIdentityTransitionEvent,
  parseCaptureEnvelope,
  sanitizeCaptureProperties,
} from "./posthog-capture-policy.ts";

const userId = "11111111-1111-4111-8111-111111111111";

test("capture policy accepts one event and keeps ordinary analytics properties", () => {
  const result = parseCaptureEnvelope({
    event: "media_opened",
    properties: {
      title: "A real title",
      media_type: "movie",
      metadata: { source: "tmdb", score: 4 },
    },
    timestamp: "2026-09-21T12:00:00.000Z",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.envelope.event, "media_opened");
    assert.equal(result.envelope.properties.title, "A real title");
    assert.deepEqual(result.envelope.properties.metadata, {
      source: "tmdb",
      score: 4,
    });
    assert.equal(result.envelope.timestamp, "2026-09-21T12:00:00.000Z");
  }
});

test("capture policy accepts the PostHog SDK event envelope without trusting its UUID", () => {
  const result = parseCaptureEnvelope({
    uuid: "018f2e4c-7a65-7cc8-8f21-123456789abc",
    event: "$identify",
    properties: { name: "Ada", "$set": { plan: "free" } },
    $set: { email: "client@example.test" },
    $set_once: { first_seen: "today" },
    timestamp: "2026-09-21T12:00:00.000Z",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.envelope.set?.email, "client@example.test");
    assert.deepEqual(result.envelope.set_once, { first_seen: "today" });
    assert.equal("uuid" in result.envelope, false);
  }
});

test("capture policy rejects batches, unknown envelope fields, and client identity selectors", () => {
  assert.equal(parseCaptureEnvelope([{ event: "one", properties: {} }]).ok, false);
  assert.equal(
    parseCaptureEnvelope({ event: "one", properties: {}, api_key: "public-looking" }).ok,
    false,
  );
  assert.equal(
    parseCaptureEnvelope({ event: "one", properties: {}, distinct_id: userId }).ok,
    false,
  );
  assert.equal(parseCaptureEnvelope({ event: "one", properties: {}, extra: true }).ok, false);
});

test("identity override keys are removed at every nested depth without dropping normal data", () => {
  const result = sanitizeCaptureProperties({
    distinct_id: userId,
    email: "intentional@example.test",
    "$set": {
      user_id: userId,
      plan: "free",
      nested: { "$groups": { account: "attacker" }, okay: true },
    },
    items: [{ alias: "bad", label: "kept" }],
  });

  assert.deepEqual(result, {
    email: "intentional@example.test",
    "$set": {
      plan: "free",
      nested: { okay: true },
    },
    items: [{ label: "kept" }],
  });
});

test("trusted server producers may carry exactly one UUID", () => {
  const accepted = parseCaptureEnvelope(
    { event: "user_signed_up", user_id: userId, properties: {} },
    { allowUserId: true },
  );
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.envelope.user_id, userId);

  assert.equal(
    parseCaptureEnvelope(
      { event: "user_signed_up", user_id: "not-a-uuid", properties: {} },
      { allowUserId: true },
    ).ok,
    false,
  );
});

test("trusted producer transition accepts the old distinct_id field only with the compatibility option", () => {
  const accepted = parseCaptureEnvelope(
    { event: "user_signed_up", distinct_id: userId, properties: {} },
    { allowLegacyDistinctId: true },
  );
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.envelope.legacy_distinct_id, userId);

  assert.equal(
    parseCaptureEnvelope(
      { event: "user_signed_up", distinct_id: userId, properties: {} },
    ).ok,
    false,
  );
  assert.equal(
    parseCaptureEnvelope(
      { event: "user_signed_up", distinct_id: "not-a-uuid", properties: {} },
      { allowLegacyDistinctId: true },
    ).ok,
    false,
  );
});

test("guest identity transitions are explicit reserved events", () => {
  assert.equal(isIdentityTransitionEvent("$identify"), true);
  assert.equal(isIdentityTransitionEvent("$create_alias"), true);
  assert.equal(isIdentityTransitionEvent("$merge_dangerously"), true);
  assert.equal(isIdentityTransitionEvent("media_opened"), false);
});