import assert from "node:assert/strict";
import test from "node:test";
import { AFFINITY_ALGORITHM_VERSION, scoreAffinitySignals } from "./affinity-score.ts";

const signal = (signal_type: string, signal_value: string, strength: number) => ({ signal_type, signal_value, strength });

test("identical signal profiles score 100", () => {
  const profile = [
    signal("genre", "drama", 0.8),
    signal("creator", "Greta Gerwig", 0.5),
    signal("media_type", "movie", 1),
  ];
  assert.equal(scoreAffinitySignals(profile, profile).match_score, 100);
});

test("disjoint profiles score zero instead of defaulting to 50", () => {
  const left = [signal("genre", "romance", 1), signal("media_type", "book", 0.8)];
  const right = [signal("genre", "horror", 1), signal("media_type", "game", 0.8)];
  assert.equal(scoreAffinitySignals(left, right).match_score, 0);
});

test("non-shared interests lower otherwise strong overlap", () => {
  const left = [signal("genre", "drama", 1), signal("genre", "comedy", 1)];
  const right = [signal("genre", "drama", 1), signal("genre", "horror", 1)];
  assert.equal(scoreAffinitySignals(left, right).match_score, 61);
});

test("dense substantive overlap can reach the top tier despite long-tail differences", () => {
  const shared = Array.from({ length: 12 }, (_, index) => signal("genre", `shared-${index}`, 1));
  const left = [...shared, ...Array.from({ length: 20 }, (_, index) => signal("show", `left-${index}`, 1))];
  const right = [...shared, ...Array.from({ length: 20 }, (_, index) => signal("show", `right-${index}`, 1))];
  assert.ok(scoreAffinitySignals(left, right).match_score >= 65);
});

test("broad media type overlap is deliberately low weight", () => {
  const left = [signal("media_type", "movie", 1), signal("genre", "romance", 1)];
  const right = [signal("media_type", "movie", 1), signal("genre", "horror", 1)];
  assert.equal(scoreAffinitySignals(left, right).match_score, 11);
});

test("engagement aggregates do not affect taste compatibility", () => {
  const left = [signal("genre", "mystery", 0.8), signal("engagement", "items_tracked", 1)];
  const right = [signal("genre", "mystery", 0.8), signal("engagement", "items_tracked", 0.1)];
  const result = scoreAffinitySignals(left, right);
  assert.equal(result.match_score, 100);
  assert.equal(result.insights.algorithm_version, AFFINITY_ALGORITHM_VERSION);
});