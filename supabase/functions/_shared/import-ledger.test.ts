import test from "node:test";
import assert from "node:assert/strict";
import { importPointsForInserted, reconcileImportOutcomes } from "./import-ledger.ts";

test("import ledger reconciliation separates all outcomes", () => {
  assert.deepEqual(
    reconcileImportOutcomes(['inserted', 'inserted', 'skipped_existing', 'skipped_duplicate', 'failed']),
    { inserted: 2, skipped_existing: 1, skipped_duplicate: 1, failed: 1 },
  );
});

test("import points use current weights and ignore unknown types", () => {
  assert.equal(importPointsForInserted(['book', 'movie', 'tv', 'music', 'podcast', 'game', 'youtube', 'unknown']), 44);
});

test("empty reconciliation and points are stable", () => {
  assert.deepEqual(reconcileImportOutcomes([]), { inserted: 0, skipped_existing: 0, skipped_duplicate: 0, failed: 0 });
  assert.equal(importPointsForInserted([]), 0);
});