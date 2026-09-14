import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import {
  decodeOneSignalJwt,
  issueOneSignalJwt,
  verifyOneSignalJwt,
} from "./onesignal-identity";
import { createOneSignalIdentityJwtHandler } from "./onesignal-identity-endpoint";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const appId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const privateKeyPem = keyPair.privateKey.export({
  type: "pkcs8",
  format: "pem",
}) as string;
const publicKeyPem = keyPair.publicKey.export({
  type: "spki",
  format: "pem",
}) as string;

test("issues an ES256 OneSignal payload with a bounded lifetime", async () => {
  const issued = await issueOneSignalJwt({
    appId,
    userId: userA,
    privateKeyPem,
    nowSeconds: 1_000,
    ttlSeconds: 120,
  });

  const decoded = decodeOneSignalJwt(issued.token);
  assert.equal(decoded.header.alg, "ES256");
  assert.equal(decoded.claims.iss, appId);
  assert.equal(decoded.claims.identity.external_id, userA);
  assert.equal(decoded.claims.exp, 1_120);
  assert.equal(
    await verifyOneSignalJwt({
      token: issued.token,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userA,
      nowSeconds: 1_119,
    }),
    true,
  );
  assert.equal(
    await verifyOneSignalJwt({
      token: issued.token,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userA,
      nowSeconds: 1_120,
    }),
    false,
  );
});

test("rejects a subject mismatch and TTL over the cleanup drain limit", async () => {
  await assert.rejects(
    issueOneSignalJwt({
      appId,
      userId: userA,
      privateKeyPem,
      ttlSeconds: 181,
    }),
    /TTL must be between/,
  );

  const issued = await issueOneSignalJwt({
    appId,
    userId: userA,
    privateKeyPem,
    nowSeconds: 2_000,
  });
  assert.equal(
    await verifyOneSignalJwt({
      token: issued.token,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userB,
      nowSeconds: 2_001,
    }),
    false,
  );
});

test("an expired cached token cannot be reused for a later request", async () => {
  const issued = await issueOneSignalJwt({
    appId,
    userId: userA,
    privateKeyPem,
    nowSeconds: 4_000,
    ttlSeconds: 120,
  });
  assert.equal(
    await verifyOneSignalJwt({
      token: issued.token,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userA,
      nowSeconds: 4_119,
    }),
    true,
  );
  assert.equal(
    await verifyOneSignalJwt({
      token: issued.token,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userA,
      nowSeconds: 4_120,
    }),
    false,
  );
});

function endpointRequest(body = "", token = "session-token") {
  return new Request("https://example.test/functions/v1/onesignal-identity-jwt", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

test("endpoint derives the current UUID from verified auth and the live row", async () => {
  let loadedUserId: string | null = null;
  const handler = createOneSignalIdentityJwtHandler({
    authenticate: async () => userA,
    loadLiveUser: async (userId) => {
      loadedUserId = userId;
      return { id: userId };
    },
    issue: (userId) =>
      issueOneSignalJwt({
        appId,
        userId,
        privateKeyPem,
        nowSeconds: 3_000,
      }),
  });

  const response = await handler(endpointRequest());
  assert.equal(response.status, 200);
  assert.equal(loadedUserId, userA);
  const payload = await response.json();
  assert.equal(
    (await verifyOneSignalJwt({
      token: payload.jwt,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userA,
      nowSeconds: 3_001,
    })),
    true,
  );
});

test("endpoint rejects an invalid or deleted auth subject before lookup", async () => {
  let lookedUp = false;
  const handler = createOneSignalIdentityJwtHandler({
    authenticate: async () => null,
    loadLiveUser: async () => {
      lookedUp = true;
      return { id: userA };
    },
    issue: async () => {
      throw new Error("must not issue");
    },
  });
  assert.equal((await handler(endpointRequest())).status, 401);
  assert.equal(lookedUp, false);
});

test("endpoint denies deleted UUIDs, tombstones, and caller selectors", async () => {
  const deletedHandler = createOneSignalIdentityJwtHandler({
    authenticate: async () => userA,
    loadLiveUser: async () => null,
    issue: async () => {
      throw new Error("must not issue");
    },
  });
  assert.equal((await deletedHandler(endpointRequest())).status, 404);

  const tombstoneHandler = createOneSignalIdentityJwtHandler({
    authenticate: async () => userA,
    checkDeletedTombstone: async () => true,
    loadLiveUser: async () => ({ id: userA }),
    issue: async () => {
      throw new Error("must not issue");
    },
  });
  assert.equal((await tombstoneHandler(endpointRequest())).status, 404);
  assert.equal(
    (await tombstoneHandler(endpointRequest(userB))).status,
    400,
  );
});

test("a new UUID remains independent from a deleted UUID", async () => {
  const handler = createOneSignalIdentityJwtHandler({
    // The same email is intentionally not present in this API. Auth derives
    // only this newly-created UUID, while the old UUID remains tombstoned.
    authenticate: async () => userB,
    checkDeletedTombstone: async (userId) => userId === userA,
    loadLiveUser: async (userId) => ({ id: userId }),
    issue: (userId) =>
      issueOneSignalJwt({
        appId,
        userId,
        privateKeyPem,
        nowSeconds: 5_000,
      }),
  });

  const response = await handler(endpointRequest());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(
    await verifyOneSignalJwt({
      token: payload.jwt,
      publicKeyPem,
      expectedAppId: appId,
      expectedUserId: userB,
      nowSeconds: 5_001,
    }),
    true,
  );
});

test("endpoint fails closed when configured deletion safety cannot be checked", async () => {
  const handler = createOneSignalIdentityJwtHandler({
    authenticate: async () => userA,
    checkDeletedTombstone: async () => {
      throw new Error("RPC unavailable");
    },
    loadLiveUser: async () => ({ id: userA }),
    issue: async () => {
      throw new Error("must not issue");
    },
  });
  assert.equal((await handler(endpointRequest())).status, 503);
});