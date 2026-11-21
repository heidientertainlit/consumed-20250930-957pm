import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the real client payload and server request parsing/write branches.
// Only database transport is doubled; no account writes or auth bypass.
function source(path) {
  return ts.createSourceFile(path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
function find(root, predicate) {
  if (predicate(root)) return root;
  return ts.forEachChild(root, child => find(child, predicate));
}
function execute(code, context) {
  return vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText, context);
}

const client = source("client/src/components/quick-action-sheet.tsx");
const payload = find(client, node => ts.isCallExpression(node)
  && node.expression.getText(client) === "JSON.stringify"
  && ts.isObjectLiteralExpression(node.arguments[0])
  && node.arguments[0].properties.some(prop => ts.isShorthandPropertyAssignment(prop)
    && prop.name.text === "privateMode"));
assert.ok(payload, "Locate the actual Add rating/review request");

const handler = source("supabase/functions/track-media/index.ts");
const parseRequest = find(handler, node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(decl =>
    decl.initializer?.getText(handler) === "requestBody" && decl.name.getText(handler).includes("skip_social_post")));
const parseMedia = find(handler, node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(decl =>
    decl.name.getText(handler).includes("rawMediaType") && decl.initializer?.getText(handler) === "media || {}"));
const publish = find(handler, node => ts.isIfStatement(node)
  && node.expression.getText(handler).includes("actualMediaItem &&"));
const saveRating = find(handler, node => ts.isIfStatement(node)
  && node.expression.getText(handler) === "rating && externalId && externalSource && title && mediaType");
assert.ok(parseRequest && parseMedia && publish && saveRating, "Locate production request parsing and writes");

function clientRequest(privateMode, ratingValue = 5, contentText = "My review") {
  return JSON.parse(execute(payload.getText(client), {
    selectedMedia: { title: "Fixture show", type: "tv", external_id: "123", external_source: "tmdb" },
    selectedListId: "finished", selectedSeason: null, selectedEpisode: null,
    ratingValue, contentText, trackPostType: "review", containsSpoilers: false,
    privateMode, rewatchCount: 1,
  }));
}

async function writeBranches(requestBody, existingRating = false) {
  const writes = [];
  const db = {
    from(table) {
      const builder = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: existingRating ? { id: "existing-rating" } : null, error: null }; },
        async insert(value) { writes.push({ table, value }); return { error: null }; },
        update(value) {
          writes.push({ table, value });
          return { eq: async () => ({ error: null }) };
        },
      };
      return builder;
    },
  };
  await execute(`(async () => {
    ${parseRequest.getText(handler)}
    ${parseMedia.getText(handler)}
    const mediaType = rawMediaType;
    ${publish.getText(handler)}
    ${saveRating.getText(handler)}
  })()`, {
    requestBody, actualMediaItem: { id: "tracked-item" },
    appUser: { id: "fixture-user" }, targetList: { id: "finished-list" },
    canonicalMediaId: null, finalImageUrl: "", supabase: db, supabaseAdmin: db,
    console: { log() {}, error(message) { throw Error(message); } },
  });
  return writes;
}

test("Add's opt-out sends the flag the already-deployed server understands", () => {
  assert.equal(clientRequest(true).skip_social_post, true);
  assert.equal(clientRequest(false).skip_social_post, false);
});

for (const existing of [false, true]) {
  for (const [label, flags, shouldPost] of [
    ["checked Add checkbox", clientRequest(true), false],
    ["unchecked Add checkbox", clientRequest(false), true],
    ["legacy privateMode caller", { privateMode: true }, false],
    ["legacy skip_social_post caller", { skip_social_post: true }, false],
    ["privateMode wins over explicit publish flag", { privateMode: true, skip_social_post: false }, false],
    ["skip_social_post wins over explicit public mode", { privateMode: false, skip_social_post: true }, false],
    ["default public caller", {}, true],
  ]) {
    test(`${existing ? "existing" : "new"} rating: ${label}`, async () => {
      const writes = await writeBranches({ ...clientRequest(false), ...flags }, existing);
      assert.equal(writes.filter(write => write.table === "social_posts").length, shouldPost ? 1 : 0);
      const ratings = writes.filter(write => write.table === "media_ratings");
      assert.equal(ratings.length, 1, "Opting out of the feed must still save the rating");
      assert.equal(ratings[0].value.rating, 5);
      if (shouldPost) assert.equal(writes.find(write => write.table === "social_posts").value.content, "My review");
    });
  }
}

test("a text-only private review does not create a feed post", async () => {
  const writes = await writeBranches(clientRequest(true, 0));
  assert.equal(writes.filter(write => write.table === "social_posts").length, 0);
});
