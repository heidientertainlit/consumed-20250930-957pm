import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSemanticVersions,
  getUpdateRequirement,
  parseSemanticVersion,
} from "./app-version";

const config = {
  latest_version: "1.2.0",
  minimum_supported_version: "1.1.0",
  app_store_url: "https://apps.apple.com/us/app/consumed-track-play/id6759014223",
};

test("compares semantic versions numerically instead of as strings", () => {
  assert.equal(compareSemanticVersions("1.10.0", "1.9.0"), 1);
  assert.equal(compareSemanticVersions("1.0.8", "1.0.8"), 0);
  assert.equal(compareSemanticVersions("1.0.7", "1.0.8"), -1);
  assert.equal(compareSemanticVersions("1.0.8-beta.1", "1.0.8"), -1);
  assert.equal(compareSemanticVersions("v1.0.8+25", "1.0.8"), 0);
});

test("returns soft and required update states at the correct boundaries", () => {
  assert.equal(getUpdateRequirement("1.2.0", config), "none");
  assert.equal(getUpdateRequirement("1.1.0", config), "soft");
  assert.equal(getUpdateRequirement("1.0.9", config), "required");
});

test("fails open when a version is malformed", () => {
  assert.equal(parseSemanticVersion("1.2"), null);
  assert.equal(
    getUpdateRequirement("not-a-version", config),
    "none",
  );
  assert.equal(
    getUpdateRequirement("1.0.0", { ...config, minimum_supported_version: "bad" }),
    "none",
  );
});