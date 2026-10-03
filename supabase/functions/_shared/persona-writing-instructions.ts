import type { PostMode } from "./persona-generation.ts";

/** Register guidance only. No selection logic, quotas, reusable posts or new persona identities. */
export const PERSONAL_SOCIAL_REGISTER = `CORE WRITING PRINCIPLE: WRITE THE REACTION, NOT THE REVIEW.
Write the assigned social behavior in this person's author style, not a description of the work for an audience. A review or recommendation can be assigned, but other intents need not become evaluations.
Plain, intelligent, brief or considered responses are equally valid. No need to be clever, insightful, polished or strongly identifiable in every post. First-person wording is optional; adding it does not turn editorial copy into a personal response. Don't manufacture casualness.
Questions should come from actual curiosity, not audience engagement bait.
The card already displays title and rating. Supplied descriptions are fact-grounding only, not a synopsis to paraphrase.`;

export const REGISTER_EXAMPLES = `REGISTER DEMONSTRATION ONLY — not phrases, openings or sentence structures to reuse:
An articulate person's reaction can be: "I think this worked better for me as a character study than as a mystery."
A longer reaction can be: "I thought I was bored with this at first, but it turns out I was waiting for it to click. The parts I wanted to skip are the ones I keep remembering now. Still not sure I liked all of it."
A low-effort reaction can be as ordinary as: "That was fun."
A question can have a personal reason: "I can't tell if I missed something or if that ending was actually confusing. Anyone else?"
These demonstrate the register, not content to adapt to the assigned title. Do not quote, paraphrase or recycle them. An equally plain thought in this person's own words is enough. Notice that none explains the work to an imagined audience or tries to supply a quotable critical verdict.`;

export const MODE_REGISTER_GUIDANCE: Record<PostMode, string> = {
  thoughtful: "A person has more to say about the assigned intent, often two to four conversational sentences. Their thinking can be nuanced without becoming a review. Shorter thoughts are fine; no mandatory polished opening, balanced critique or conclusion.",
  micro: "An immediate reaction: one word, a few words, an emotion, a fragment, or the assigned rating. It does not need to describe the media, contain insight or be entertaining.",
  casual: "An ordinary thought someone would type without composing copy. A simple observation or reaction is enough; no need for a clever hook or explanation.",
  rating: "Express the assigned intent briefly alongside the assigned stars. Rating language is optional and must use the authoritative placeholders. Stars do not require a miniature review to justify them.",
  question: "Ask because THIS PERSON has a reason: their response, uncertainty, disagreement or desire to talk about this media. Usually tie it to their own experience. Don't invent a scene/episode to make the question specific, and don't add a generic audience-engagement sign-off.",
  specific: "React to a particular aspect ONLY when supplied facts support it. Still a user's response, not a description of that aspect for an audience. If details are missing, a general response is better than an invented fact.",
  opinion: "A personal stance in this person's normal register. It can be articulate, ambivalent or understated; not automatically provocative, combative, insightful or clever.",
  low_energy: "This person simply isn't putting much effort into the post. An uncomplicated opinion, completion update or assigned rating is sufficient. Do not generate literary descriptions and make them lowercase; no contrived fragments or disconnected score word tacked on.",
};