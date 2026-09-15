import assert from "node:assert/strict";
import test from "node:test";
import { withTermsConsentRequestDeadline } from "./terms-consent-request";

test("terms consent requests resolve normally before their deadline", async () => {
  const result = await withTermsConsentRequestDeadline(Promise.resolve("accepted"), 50);
  assert.equal(result, "accepted");
});

test("a stalled terms consent request rejects with an explicit fail-closed error", async () => {
  const stalledRequest = new Promise<never>(() => {});

  await assert.rejects(
    withTermsConsentRequestDeadline(stalledRequest, 5),
    /couldn't verify your Terms of Service agreement/i,
  );
});