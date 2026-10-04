import type { Persona, MediaCandidate } from "./persona-generation.ts";
import type { IntentAssignment, IntentContext } from "./persona-post-intents.ts";
import { consumptionContradictions } from "./persona-post-intents.ts";
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
Generate the smallest concrete thought that satisfies the assigned intent. The premise is an internal semantic note about what this person wants to say, not prose that should sound good. It need not be polished, clever, engaging, complete post copy or written in the persona's voice. Do not turn it into entertainment criticism.
Pick a particular subjective response, preference, uncertainty or association fitting this person, state and intent. An ordinary, small thought is enough: likes the different sound and thinks it works for the artist; keeps coming back to this; wants to know whether the case has changed since the podcast; finds this comforting to revisit; is curious what this person will do to the group dynamic; isn't sure this is working for them yet. These illustrate semantic size, not phrases to copy.
Fictional subjective feelings and expectations are allowed. Media facts, named people, scenes, quotes, comparisons, progress counts and personal biography require supplied evidence; do not retrieve extra facts from your knowledge of the title. Do not invent relationships or events in this person's life.
The assigned consumption state is authoritative for the premise itself. Not-started/starting cannot claim completion; in-progress cannot claim finishing; finished means the experience is complete, not that its finale or ending is still ahead. Dropped means they stopped; revisiting means they have experienced it before. Wanting another work or a future rewatch is compatible with finished.
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

/** A premise/state precondition, not a prose/style check or another generation pass. */
export function premiseStateContradictions(premise: string, assignment: IntentAssignment): string[] {
  const issues = consumptionContradictions(premise, assignment);
  if (assignment.consumption.state === "finished" && (
    /\b(?:finale|ending|last episode|last chapter)\s+(?:is|comes?|will be)\s+(?:next|still ahead|yet to come|coming up)\b/i.test(premise)
    || /\b(?:haven['’]t|have not|hasn['’]t|has not|not)\s+finished(?:\s+(?:it|this|yet)\b|[.!?]|$)/i.test(premise)
    || /\bstill (?:have|has)\b[^.!?]*\b(?:episodes|chapters|pages)\s+(?:left|to go)\b/i.test(premise)
  )) issues.push("Premise implies unfinished consumption despite assigned finished state");
  return issues;
}

/** One call, no scoring, prose validator or premise-repair loop. */
export async function generatePremise(chat: Chat, persona: Persona, media: MediaCandidate, assignment: IntentAssignment): Promise<string> {
  const result = JSON.parse(await chat(buildPremisePrompt(persona, media, assignment)));
  if (typeof result.premise !== "string" || !result.premise.trim()) throw new Error("Premise generation returned no meaning; no draft created");
  const issues = premiseStateContradictions(result.premise, assignment);
  if (issues.length) throw new Error(`Premise/state mismatch: ${issues.join("; ")}; no draft created`);
  return result.premise.trim();
}