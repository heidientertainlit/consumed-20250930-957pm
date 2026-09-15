import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("admin block-alert UI uses only the private Edge Function and is routed from Admin", () => {
  const page = readFileSync(new URL("../pages/admin-block-alerts.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../pages/admin.tsx", import.meta.url), "utf8");

  assert.match(page, /functions\.invoke\("admin-block-alerts"/);
  assert.doesNotMatch(page, /\.from\("admin_block_alerts"\)/);
  assert.match(page, /action: "acknowledge"/);
  assert.match(page, /onError: \(error\)/);
  assert.match(page, /Acknowledgement failed/);
  assert.match(page, /The alert remains open\. Please try again\./);
  assert.match(page, /onSuccess:[\s\S]*invalidateQueries/);
  assert.match(page, /Blocker UUID/);
  assert.match(page, /Blocked UUID/);
  assert.match(page, /no profiles, emails, content, or notifications are included/);
  assert.match(app, /path="\/admin\/block-alerts"/);
  assert.match(admin, /path: "\/admin\/block-alerts"/);
});