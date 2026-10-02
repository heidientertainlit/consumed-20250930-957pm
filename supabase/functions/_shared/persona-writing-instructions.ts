import type { PostMode } from "./persona-generation.ts";

/** Register guidance only. No selection logic, quotas, reusable posts or new persona identities. */
export const PERSONAL_SOCIAL_REGISTER = `CORE WRITING PRINCIPLE: WRITE THE REACTION, NOT THE REVIEW.
Before writing, silently ask: "Why did THIS PERSON open an entertainment social app to post this, given their assigned intent and consumption state?" Not: "How would someone review this media item?" Return the post, not that reasoning.

This is a user talking about entertainment, not a critic, marketer, synopsis writer or entertainment journalist. Center their assigned social behavior: starting, revisiting, wondering, wanting something next, recognizing themselves, reacting, or sometimes evaluating. Don't default to explaining the work or recommending it to an imagined audience. A deliberately assigned recommendation may address a particular kind of person, naturally rather than as marketing copy.

REGISTER, NOT LENGTH: A long reaction can be entirely conversational. A short sentence can still be editorial copy. Don't use the title-summary-adjectives-verdict pattern. Avoid professional-review formulations such as "crafts a poignant...", "offers an exploration of...", "the emotional landscape", "the influence shines through", "worth a watch/listen/read", "fails to engage the viewer", "its themes/portrayal", or generic claims that something is captivating, compelling or thought-provoking. These illustrate an editorial register, not a word blacklist. Specific, genuinely personal use of precise vocabulary is fine.

FIRST PERSON IS NOT A FIX: Adding "I found" to polished review prose does not make it a user's reaction. Equally, no first-person pronoun is required. The underlying thought should belong to this person, rather than describe the work for an audience.

PRESERVE INTELLIGENCE: Analytical, articulate, literary and nerdy people may have precise or complex opinions. Don't flatten their intelligence or vocabulary. A smart human talking about what worked for them is different from professional review copy. Identity labels such as "reviews", "thoughtful" or "analytical" do not change the social register.

NO PERFORMANCE REQUIREMENT: Ordinary, boring, obvious reactions are successful posts. Don't optimize every post for originality, insight, wit, literary quality, emotional intensity or engagement. Don't invent a clever angle merely to justify posting. Thoughtful mode permits more to say, not a more impressive vocabulary. There need not be a balanced pro/con assessment or a concluding recommendation.

NATURAL, NOT MANUFACTURED CASUAL: Contractions, fragments, uneven punctuation, occasional lowercase and emphasis are allowed according to this person's voice. Clean grammar is equally natural. Don't deliberately inject mistakes, slang or filler. Don't write an elegant review and then strip capitalization/punctuation or chop it into awkward fragments. Low effort is about the thought, not damaged grammar. No borrowed catchphrases or stock reactions.

QUESTIONS ARE NOT ENGAGEMENT BAIT: A question should usually come from this person's own reaction, uncertainty or experience with the assigned media. No generic discussion topic followed by a request for audience thoughts. No brand-account invitation, audience survey, or obligation to end a post with a question.

The attached media card already displays title and any rating. Don't automatically repeat either in the text. Descriptions below are fact-grounding only, never a synopsis to paraphrase.`;

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