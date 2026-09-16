import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("iOS declares the native Browser pod required for in-app OAuth", () => {
  const podfile = read("../../../ios/App/Podfile");
  const packageJson = JSON.parse(read("../../../package.json"));
  assert.ok(packageJson.dependencies["@capacitor/browser"]);
  assert.match(podfile, /pod 'CapacitorBrowser', :path => '\.\.\/\.\.\/node_modules\/@capacitor\/browser'/);
});

test("email/password stays direct while only OAuth opens the native browser", () => {
  const auth = read("./auth.tsx");
  const oauthStart = auth.indexOf("const signInWithOAuth = async");
  assert.ok(oauthStart > 0);
  const beforeOAuth = auth.slice(0, oauthStart);
  const oauth = auth.slice(oauthStart);
  assert.match(beforeOAuth, /supabase\.auth\.signInWithPassword\(/);
  assert.match(beforeOAuth, /supabase\.auth\.signUp\(/);
  assert.doesNotMatch(beforeOAuth, /Browser\.open\(/);
  assert.match(oauth, /skipBrowserRedirect: true/);
  assert.match(oauth, /if \(nativePlatform\)/);
  assert.match(oauth, /await Browser\.open\(\{ url: authorizationUrl \}\)/);
  assert.match(oauth, /NATIVE_OAUTH_CALLBACK_URL/);
  assert.match(auth, /const redirectOrigin = nativePlatform \? appUrl : window\.location\.origin/);
  assert.match(auth, /type OAuthProvider = ['"]google['"] \| ['"]apple['"]|type OAuthProvider = ['"]apple['"] \| ['"]google['"]/);
});