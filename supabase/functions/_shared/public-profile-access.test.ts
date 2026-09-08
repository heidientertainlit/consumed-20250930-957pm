import assert from "node:assert/strict";
import test from "node:test";
import { canAccessPublicProfile, canAccessFullProfile, isProfileId, loadProfileAccess, resolveProfileViewer, type PublicProfileAccess } from "./public-profile-access.ts";

const publicTarget: PublicProfileAccess = {
  targetExists: true,
  targetIsPersona: false,
  targetIsDiscoverable: true,
  targetDnaIsPrivate: false,
  blocked: false,
  isSelf: false,
  isFriend: false,
};

test("allows an intentional public profile share", () => {
  assert.equal(canAccessPublicProfile(publicTarget), true);
});

test("hides non-discoverable and private profiles from strangers", () => {
  assert.equal(canAccessPublicProfile({ ...publicTarget, targetIsDiscoverable: false }), false);
  assert.equal(canAccessPublicProfile({ ...publicTarget, targetDnaIsPrivate: true }), false);
});

test("allows owners and accepted friends to view private profiles", () => {
  assert.equal(canAccessPublicProfile({
    ...publicTarget,
    targetIsDiscoverable: false,
    targetDnaIsPrivate: true,
    isSelf: true,
  }), true);
  assert.equal(canAccessPublicProfile({
    ...publicTarget,
    targetIsDiscoverable: false,
    targetDnaIsPrivate: true,
    isFriend: true,
  }), true);
});

test("blocks access regardless of friendship or public settings", () => {
  assert.equal(canAccessPublicProfile({ ...publicTarget, blocked: true }), false);
  assert.equal(canAccessPublicProfile({ ...publicTarget, blocked: true, isFriend: true }), false);
});

test("never exposes persona or missing targets", () => {
  assert.equal(canAccessPublicProfile({ ...publicTarget, targetExists: false }), false);
  assert.equal(canAccessPublicProfile({ ...publicTarget, targetIsPersona: true }), false);
});

test("public previews never authorize full DNA or consumption history", () => {
  assert.equal(canAccessFullProfile(publicTarget), false);
  assert.equal(canAccessFullProfile({ ...publicTarget, isFriend: true }), true);
  assert.equal(canAccessFullProfile({ ...publicTarget, isSelf: true }), true);
  assert.equal(canAccessFullProfile({ ...publicTarget, isFriend: true, blocked: true }), false);
});

const viewer = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

function mockAccessClient(overrides: Record<string, any> = {}) {
  const results = {
    users: { data: { id: target, people_discoverable: true, is_persona: false }, error: null },
    dna_profiles: { data: { is_private: false }, error: null },
    friendships: { data: [], error: null },
    user_blocks: { data: [], error: null },
    ...overrides,
  };
  return {
    from(table: string) {
      const builder: any = {
        select: () => builder, eq: () => builder, or: () => builder,
        maybeSingle: () => Promise.resolve(results[table]),
        limit: () => Promise.resolve(results[table]),
      };
      return builder;
    },
  };
}

for (const table of ["users", "dna_profiles", "friendships", "user_blocks"]) {
  test(`fails closed when ${table} access lookup fails`, async () => {
    await assert.rejects(loadProfileAccess(mockAccessClient({
      [table]: { data: null, error: { message: "database unavailable" } },
    }), target, viewer));
  });
}

test("loader denies either-direction block even for accepted friends", async () => {
  const access = await loadProfileAccess(mockAccessClient({
    friendships: { data: [{ id: "friendship" }], error: null },
    user_blocks: { data: [{ id: "block" }], error: null },
  }), target, viewer);
  assert.equal(canAccessPublicProfile(access), false);
});

test("loader preserves accepted friends' private profile access", async () => {
  const access = await loadProfileAccess(mockAccessClient({
    dna_profiles: { data: { is_private: true }, error: null },
    users: { data: { id: target, people_discoverable: false }, error: null },
    friendships: { data: [{ id: "friendship" }], error: null },
  }), target, viewer);
  assert.equal(canAccessFullProfile(access), true);
});

test("malformed IDs cannot reach interpolated database filters", async () => {
  assert.equal(isProfileId(`${target},id.neq.x`), false);
  await assert.rejects(loadProfileAccess(mockAccessClient(), `${target},id.neq.x`, viewer));
});

test("only missing authorization or the configured anon key counts as guest", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: new Error("invalid") }) } };
  assert.equal(await resolveProfileViewer(client, null, "anon"), null);
  assert.equal(await resolveProfileViewer(client, "Bearer anon", "anon"), null);
  await assert.rejects(resolveProfileViewer(client, "Bearer expired-user-token", "anon"));
  await assert.rejects(resolveProfileViewer(client, "garbage", "anon"));
});

test("verified session supplies the requester identity", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: viewer } }, error: null }) } };
  assert.equal(await resolveProfileViewer(client, "Bearer user-token", "anon"), viewer);
});