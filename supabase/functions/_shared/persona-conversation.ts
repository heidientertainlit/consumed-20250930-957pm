/** Separate conversation contract; never changes standalone generation policy. */
import { deriveSocialVoice, type Persona } from "./persona-generation.ts";
import { authorStyleInstructions, resolveAuthorStyle } from "./persona-author-style.ts";

export type ConversationMessage = {
  client_id: string; participant_id: string; parent_client_id: string | null;
  body: string; offset_seconds: number; public_id?: string;
  delivered_at?: string; error?: string;
};
export const PERSONA_GENDERS = ["unset", "woman", "man", "nonbinary", "other"] as const;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateRoster(ids: unknown, opening: unknown): string[] {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 12 ||
      ids.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(ids).size !== ids.length || !ids.includes(opening)) {
    throw new Error("Choose 2–12 distinct existing personas and an opening author from that roster");
  }
  return ids;
}
export function boundedInteger(value: unknown, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`${label} must be ${min}–${max}`);
  return Number(value);
}
export function text(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`${label} must be ${min}–${max} characters`);
  return value.trim();
}
export function validateConversation(value: unknown, ids: string[], opening: string, expectedCount?: number): ConversationMessage[] {
  validateRoster(ids, opening);
  if (!Array.isArray(value) || value.length < 3 || value.length > 20 ||
      (expectedCount !== undefined && value.length !== expectedCount)) throw new Error("Conversation must have the requested 3–20 messages");
  const seen = new Map<string, number>();
  let previous = -1;
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid message");
    const id = raw.client_id;
    if (typeof id !== "string" || !/^[a-z0-9_-]{1,64}$/.test(id) || seen.has(id)) throw new Error("Message IDs must be unique");
    if (!ids.includes(raw.participant_id)) throw new Error("Only selected personas may speak");
    const offset = boundedInteger(raw.offset_seconds, 0, 604800, "Message offset");
    if (index === 0) {
      if (raw.parent_client_id != null || offset !== 0 || raw.participant_id !== opening) throw new Error("Opening author/root/offset changed");
    } else {
      if (!seen.has(raw.parent_client_id) || offset < previous + 60) throw new Error("Replies must follow an earlier parent with at least 60 seconds between arrivals");
    }
    seen.set(id, offset); previous = offset;
    // Strip public mappings: edits/model output cannot forge delivery state.
    return { client_id: id, participant_id: raw.participant_id, parent_client_id: index === 0 ? null : raw.parent_client_id,
      body: text(raw.body, 1, 1200, "Message"), offset_seconds: offset };
  });
}
export function conversationPrompt(options: {
  topic: string; angle: string; context: string; subject: unknown; provenance: unknown;
  personas: Persona[]; opening: string; count: number; durationSeconds: number; maxWords: number;
}) {
  return [
    { role: "system", content: `Write a connected entertainment discussion, not independent reviews. Return valid JSON only.
Use only the supplied subject and evidence. Never switch to persona favorites. No invented episodes, lyrics, quotes, releases, eliminations, news, personal biography or current-event facts. Admin-supplied context is explicitly supplied, not independently verified. When evidence is absent, discuss subjective preferences generally. No numerical ratings. Do not claim real-user interactions or fabricate popularity. Natural short responses, disagreement and returning speakers are welcome. No mandatory equal participation or personality caricatures.` },
    { role: "user", content: JSON.stringify({
      topic: options.topic, angle: options.angle, explicitlySuppliedContext: options.context,
      verifiedSubject: options.subject, sourceProvenance: options.provenance,
      roster: options.personas.map(p => ({ id: p.id, name: p.display_name,
        identity: p.persona_config, voice: deriveSocialVoice(p.persona_config),
        authorStyle: authorStyleInstructions(resolveAuthorStyle(p)) })),
      instructions: `Return {"messages":[{"client_id":"m0","participant_id":"UUID","parent_client_id":null,"body":"...","offset_seconds":0}]}.
Exactly ${options.count} messages. First author ${options.opening}, first offset 0. All other messages reference an earlier client_id (root for top-level comments). Include both top-level and nested replies. Speakers may return. All participants are allowed, not required to speak once. Respond meaningfully to prior messages. Each body at most ${options.maxWords} words. Offsets strictly increase by at least 60 seconds, final offset ${options.durationSeconds}.`,
    }) },
  ];
}
