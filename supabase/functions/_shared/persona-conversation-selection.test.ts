import { test } from "node:test";
import assert from "node:assert/strict";
import { exactConversationResult, personaInterestEvidence, scopeConversationSubject, validateAutomaticParticipants } from "./persona-conversation-selection.ts";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const subject = { title: "Dancing with the Stars", type: "tv", externalSource: "tmdb", externalId: "1508" };
test("selection binds exact provider, type and ID rather than first title match", () => {
  const chosen = { title: subject.title, type: "tv", external_source: "tmdb", external_id: "1508" };
  assert.equal(exactConversationResult(chosen, [{ ...chosen, external_id: "999" }, chosen]), chosen);
  assert.throws(() => exactConversationResult(chosen, [{ ...chosen, type: "book" }]));
  assert.throws(() => exactConversationResult(chosen, [{ ...chosen, external_source: "openai" }]));
});
test("season and episode come only from the selected show's provider response", async () => {
  const paths: string[] = [];
  const get = async (path: string) => {
    paths.push(path);
    return path.includes("/season/") ? { season_number: 35, name: "Season 35", overview: "Verified season", episodes: [{ episode_number: 3, name: "Episode three", overview: "Verified episode" }] }
      : { seasons: [{ season_number: 35 }] };
  };
  const result = await scopeConversationSubject(subject, 35, 3, get);
  assert.equal(result.season.number, 35);
  assert.equal(result.episode.number, 3);
  assert.deepEqual(paths, ["/tv/1508", "/tv/1508/season/35"]);
  await assert.rejects(() => scopeConversationSubject(subject, 36, null, get), /not in this show's catalog/);
  await assert.rejects(() => scopeConversationSubject(subject, 35, 9, get), /not in this season/);
  await assert.rejects(() => scopeConversationSubject(subject, null, 3, get), /Season/);
  await assert.rejects(() => scopeConversationSubject({ ...subject, type: "movie" }, 35, null, get));
  assert.equal(await scopeConversationSubject(subject, undefined, undefined, get), subject);
});
test("automatic roster validates saved-interest evidence, membership and opener", () => {
  const roster = [
    { id: a, persona_config: { interests: ["dance competitions"], tone: "enthusiastic" } },
    { id: b, persona_config: { favorite_media: ["Dancing with the Stars"] } },
  ];
  const selection = { openingAuthorId: b, participants: [
    { id: a, interest: "dance competitions", reason: "Saved interest in dance competitions fits this show." },
    { id: b, interest: "Dancing with the Stars", reason: "The exact selected show is a saved favorite." },
  ] };
  const result = validateAutomaticParticipants(selection, roster, 3);
  assert.equal(result.opening, b);
  assert.equal(result.reasons.length, 2);
  assert.deepEqual(personaInterestEvidence({ persona_config: { tone: "enthusiastic", media_types: ["tv"] } }), []);
  assert.throws(() => validateAutomaticParticipants({ ...selection, participants: [] }, roster, 3), /Not enough suitable/);
  assert.throws(() => validateAutomaticParticipants({ ...selection, openingAuthorId: "33333333-3333-4333-8333-333333333333" }, roster, 3));
  assert.throws(() => validateAutomaticParticipants({ ...selection, participants: selection.participants.map(p => ({ ...p, interest: "invented interest" })) }, roster, 3), /unsupported interest/);
  assert.throws(() => validateAutomaticParticipants(selection, roster.slice(0, 1), 3));
});
