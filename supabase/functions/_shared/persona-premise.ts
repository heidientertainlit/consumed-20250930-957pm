import type { Persona, MediaCandidate } from "./persona-generation.ts";
import type { IntentAssignment, IntentContext } from "./persona-post-intents.ts";
import type { Chat } from "./persona-media-candidates.ts";

/** Keep names and specific facts available only when the assigned behavior needs them. */
export function premiseContext(assignment: IntentAssignment): IntentContext {
  const context = assignment.context;
  switch (assignment.intent) {
    case "character": return { people: context.people?.slice(0, 4) };
    case "moment": return { moments: context.moments };
    case "comparison": return { comparisons: context.comparisons };
    case "social": return { relationships: context.relationships };
    default: return {};
  }
}

export function buildPremisePrompt(persona: Persona, media: MediaCandidate, assignment: IntentAssignment) {
  const config = persona.persona_config;
  return [
    { role: "system", content: `Choose one concrete premise for a fictional person's entertainment post: what does this person actually want to say right now?
Return one short piece of semantic meaning, not the post itself, finished prose, a miniature review or instructions to the writer. Pick a particular subjective response, preference, uncertainty or association fitting this person, state and intent. An ordinary, small thought is enough.
Fictional subjective feelings and expectations are allowed. Media facts, named people, scenes, quotes, comparisons, progress counts and personal biography require supplied evidence; do not retrieve extra facts from your knowledge of the title. Do not invent relationships or events in this person's life.
For question or request intents, choose the actual uncertainty they want answered or what they want next. For other intents, do not add an audience-engagement question.
Return only JSON: {"premise":"one short meaning"}.` },
    { role: "user", content: JSON.stringify({
      persona: { name: persona.display_name, bio: config.bio, tone: config.tone, interests: config.interests, posting_style: config.posting_style },
      media: { title: media.title, type: media.type, creator: media.creator, genres: media.genres },
      state: assignment.consumption,
      intent: assignment.intent,
      supportedContext: premiseContext(assignment),
    }) },
  ];
}

/** One call, no scoring, prose validator or premise-repair loop. */
export async function generatePremise(chat: Chat, persona: Persona, media: MediaCandidate, assignment: IntentAssignment): Promise<string> {
  const result = JSON.parse(await chat(buildPremisePrompt(persona, media, assignment)));
  if (typeof result.premise !== "string" || !result.premise.trim()) throw new Error("Premise generation returned no meaning; no draft created");
  return result.premise.trim();
}