import { boundedInteger, text, validateRoster } from "./persona-conversation.ts";

/** A selection is an exact provider identity, never the first fuzzy title hit. */
export function exactConversationResult(media: any, results: any[]) {
  const title = text(media?.title, 1, 300, "Media title");
  const type = text(media?.type, 1, 30, "Media type");
  const source = text(media?.external_source, 1, 40, "Provider");
  const id = text(String(media?.external_id ?? ""), 1, 200, "Provider ID");
  const match = results.find(r => r.type === type && r.external_source === source && String(r.external_id) === id);
  if (!match) throw new Error(`Could not verify the exact selected title (${title}); search again`);
  return match;
}

export async function scopeConversationSubject(subject: any, season: unknown, episode: unknown, get: (path: string) => Promise<any>) {
  if (season == null && episode == null) return subject;
  if (!subject || subject.type !== "tv" || subject.externalSource !== "tmdb") throw new Error("Season selection requires a verified TMDB TV show");
  const number = boundedInteger(season, 0, 10000, "Season");
  const show = await get(`/tv/${encodeURIComponent(subject.externalId)}`);
  if (!show.seasons?.some((s: any) => s.season_number === number)) throw new Error("Selected season is not in this show's catalog");
  const details = await get(`/tv/${encodeURIComponent(subject.externalId)}/season/${number}`);
  if (details.season_number !== number) throw new Error("Provider returned a different season");
  const scoped = { ...subject, season: { number, name: details.name, overview: details.overview }, episode: undefined };
  if (episode == null) return scoped;
  const epNumber = boundedInteger(episode, 1, 10000, "Episode");
  const ep = details.episodes?.find((e: any) => e.episode_number === epNumber);
  if (!ep) throw new Error("Selected episode is not in this season's catalog");
  return { ...scoped, episode: { number: epNumber, name: ep.name, overview: ep.overview } };
}

export function personaInterestEvidence(persona: any): string[] {
  const config = persona.persona_config || {};
  // Voice, gender and display names are NOT evidence of interest in a subject.
  return [...(Array.isArray(config.interests) ? config.interests : []),
    ...(Array.isArray(config.favorite_media) ? config.favorite_media : [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function validateAutomaticParticipants(result: any, roster: any[], maximum: number) {
  if (!Array.isArray(result?.participants) || result.participants.length < 2 || result.participants.length > maximum) {
    throw new Error("Not enough suitable personas were found. Add relevant interests to the persona roster or choose another topic.");
  }
  const ids = result.participants.map((p: any) => p.id);
  validateRoster(ids, result.openingAuthorId);
  const reasons = result.participants.map((p: any) => {
    const person = roster.find(candidate => candidate.id === p.id);
    if (!person || !personaInterestEvidence(person).includes(p.interest)) throw new Error("Persona selection used an unsupported interest");
    return { kind: "persona-selection", participant_id: p.id,
      interest: p.interest, reason: text(p.reason, 10, 500, "Persona selection reason") };
  });
  return { ids, opening: result.openingAuthorId, reasons };
}
