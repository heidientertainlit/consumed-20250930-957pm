import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));
const lockfile = await readFile("ios/App/Podfile.lock", "utf8");
const header = await readFile(
  "native/onesignal-identity-ios/OneSignal-5.6.1-public-interface.h",
  "utf8",
);
const implementationEvidence = await readFile(
  "native/onesignal-identity-ios/OneSignalUserManagerImpl-5.6.1-expiry.swift.txt",
  "utf8",
);

assert.equal(
  packageJson.dependencies["onesignal-cordova-plugin"],
  "5.5.7",
  "the official Cordova package must stay exactly pinned to 5.5.7",
);
assert.equal(
  packageLock.packages["node_modules/onesignal-cordova-plugin"].version,
  "5.5.7",
  "package-lock must resolve the official Cordova package to 5.5.7",
);
assert.equal(
  packageLock.packages["node_modules/onesignal-cordova-plugin"].integrity,
  "sha512-qkgvE0aniL3HYc2G5BqVZHzF0xjRshdOlSdIuBUYGv5uZrvxhwVxg4qc/iYYyVwGNtQwUbPQY7Nw7L+B7XYGBQ==",
  "package-lock must retain the published 5.5.7 integrity",
);
assert.match(
  lockfile,
  /OneSignalXCFramework \(5\.6\.1\)/,
  "Podfile.lock must pin OneSignalXCFramework 5.6.1",
);
assert.match(
  lockfile,
  /OneSignalXCFramework: c38d48069949912d19e7c64d2ff30f5c9edba1ee/,
  "Podfile.lock must use the CocoaPods 5.6.1 spec checksum",
);
assert.match(header, /\+\s*\(void\)login:[\s\S]*withToken:/);
assert.match(header, /onJwtExpiredWithExpiredHandler:/);
assert.match(implementationEvidence, /jwtExpiredHandler\(externalId\)/);
assert.match(
  implementationEvidence,
  /user\.identityModel\.jwtBearerToken = newToken/,
);
for (const unsupportedApi of [
  "addUserJwtInvalidatedListener",
  "removeUserJwtInvalidatedListener",
  "updateUserJwt",
]) {
  assert.equal(
    header.includes(unsupportedApi),
    false,
    `5.6.1 public headers must not claim ${unsupportedApi}`,
  );
}

console.log(
  "OneSignal native evidence verified: Cordova 5.5.7, iOS SDK 5.6.1, native IV blocked",
);