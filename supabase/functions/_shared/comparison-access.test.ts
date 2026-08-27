import assert from "node:assert/strict";
import test from "node:test";
import { canAccessDnaComparison, type ComparisonAccess } from "./comparison-access.ts";

const eligible: ComparisonAccess = {
  targetExists: true,
  targetHasProfile: true,
  targetEligible: true,
  targetIsPersona: false,
  blocked: false,
  isFriend: false,
  targetIsPrivate: false,
  targetIsDiscoverable: true,
  hasDiscoveryRelationship: false,
};

test("rejects an arbitrary public profile ID without a discovery relationship", () => {
  assert.equal(canAccessDnaComparison(eligible), false);
});

test("rejects non-discoverable targets even when a comparison row exists", () => {
  assert.equal(canAccessDnaComparison({ ...eligible, targetIsDiscoverable: false, hasDiscoveryRelationship: true }), false);
});

test("allows a server-derived non-friend discovery match", () => {
  assert.equal(canAccessDnaComparison({ ...eligible, hasDiscoveryRelationship: true }), true);
});

test("allows accepted friends regardless of discovery visibility", () => {
  assert.equal(canAccessDnaComparison({
    ...eligible,
    isFriend: true,
    targetIsPrivate: true,
    targetIsDiscoverable: false,
  }), true);
});

test("blocks both friend and discovery comparisons when either user blocked the other", () => {
  assert.equal(canAccessDnaComparison({ ...eligible, isFriend: true, blocked: true }), false);
  assert.equal(canAccessDnaComparison({ ...eligible, hasDiscoveryRelationship: true, blocked: true }), false);
});