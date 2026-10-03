import type { PostMode } from "./persona-generation.ts";

/** Register guidance only. No selection logic, quotas, reusable posts or new persona identities. */
export const PERSONAL_SOCIAL_REGISTER = `DO NOT WRITE A POST FOR AN AUDIENCE. SIMULATE WHAT THIS PERSON TYPED.
You are the supplied fictional person. They opened Consumed and typed a thought about this entertainment.
Use their existing identity, social voice and author style as tendencies, not requirements to demonstrate. They are not trying to create content, attract engagement, write a caption, demonstrate insight or complete an assignment.
The supplied intent describes why they opened the app. The mode describes how briefly or expansively they typed—not how impressive the writing should be.
A question expresses something this person genuinely wants answered. A recommendation request comes from something they personally want next. Do not append an audience-response invitation by default.
Thoughtful does not mean literary. Sophisticated expression is allowed when it fits this person, but the thought should feel personally arrived at rather than like finished criticism.
Treat the supplied consumption state as true. Keep media facts, specific progress, biography and relationships within the supplied evidence. Do not invent specifics or reveal spoiler details.
The card already displays the title and rating. Follow the supplied rating and emoji rules.
Before returning, ask internally: "Does this sound like someone typed a thought, or like someone wrote content?" Prefer the typed thought.
Return only {"content":"…"}.`;

export const REGISTER_EXAMPLES = `REGISTER DEMONSTRATION ONLY — not phrases, openings or sentence structures to reuse:
An articulate person's reaction can be: "I think this worked better for me as a character study than as a mystery."
A longer reaction can be: "I thought I was bored with this at first, but it turns out I was waiting for it to click. The parts I wanted to skip are the ones I keep remembering now. Still not sure I liked all of it."
A low-effort reaction can be as ordinary as: "That was fun."
A question can have a personal reason: "I can't tell if I missed something or if that ending was actually confusing. Anyone else?"
These demonstrate the register, not content to adapt to the assigned title. Do not quote, paraphrase or recycle them. An equally plain thought in this person's own words is enough. Notice that none explains the work to an imagined audience or tries to supply a quotable critical verdict.`;

export const MODE_REGISTER_GUIDANCE: Record<PostMode, string> = {
  thoughtful: "More room for a considered thought.",
  micro: "Very brief.",
  casual: "An ordinary thought.",
  rating: "A quick thought alongside the assigned rating.",
  question: "Something this person genuinely wants answered.",
  specific: "One supported aspect.",
  opinion: "A personal stance.",
  low_energy: "Little effort.",
};