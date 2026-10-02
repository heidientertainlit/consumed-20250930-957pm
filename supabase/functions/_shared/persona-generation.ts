/** Portable, side-effect-free planning shared by the generator, admin UI and dry-run tests. */
import { MODE_REGISTER_GUIDANCE, PERSONAL_SOCIAL_REGISTER } from "./persona-writing-instructions.ts";
import { intentWriterInstructions, intentRatingProbability, type IntentAssignment, type IntentContext, type IntentWeights, type PostIntent } from "./persona-post-intents.ts";
export const POST_MODES = [
  { id: "thoughtful", label: "Thoughtful reaction", description: "More room to express the assigned social behavior, usually two to four ordinary sentences. It need not be an evaluation, summary or polished argument.", words: [25, 85] },
  { id: "micro", label: "Micro reaction", description: "An original, tiny emotional reaction. Usually one to five words. It need not be clever.", words: [1, 8] },
  { id: "casual", label: "Casual thought", description: "A conversational observation, usually a sentence. It may be plain, unfinished or informal.", words: [5, 30] },
  { id: "rating", label: "Rating + quick thought", description: "A brief expression of the assigned social behavior alongside stars. Optional natural score wording must match the authoritative five-star rating.", words: [3, 30] },
  { id: "question", label: "Conversation starter", description: "An original question inviting other people's opinions. Do not make up facts or pretend to be awaiting a first watch if a rating is assigned.", words: [4, 30] },
  { id: "specific", label: "Specific reaction", description: "Focus the assigned social behavior on a supported aspect. Without detailed evidence, stay general; invent no episodes or characters.", words: [2, 25] },
  { id: "opinion", label: "Hot take / opinion", description: "A personal stance, perhaps disagreement or ambivalence. Not automatically negative, confrontational or performatively controversial.", words: [5, 40] },
  { id: "low_energy", label: "Low-energy reaction", description: "An ordinary, understated response. No obligation to entertain, explain or sound polished.", words: [1, 15] },
] as const;
export type PostMode = typeof POST_MODES[number]["id"];
export type ModeWeights = Record<PostMode, number>;
export const DEFAULT_MODE_WEIGHTS: ModeWeights = { thoughtful: 30, micro: 10, casual: 15, rating: 10, question: 10, specific: 8, opinion: 8, low_energy: 9 };
export const VOICE_OPTIONS = {
  length: ["terse", "short", "medium", "detailed"],
  energy: ["restrained", "casual", "enthusiastic", "expressive"],
  capitalization: ["standard", "lowercase", "expressive"],
  punctuation: ["standard", "minimal", "expressive"],
  emojiFrequency: ["none", "low", "medium", "high"],
  ratingFrequency: ["rare", "occasional", "frequent"],
  questionFrequency: ["rare", "occasional", "frequent"],
  sarcasm: ["none", "low", "medium", "high"],
} as const;
export type SocialVoice = { [K in keyof typeof VOICE_OPTIONS]: typeof VOICE_OPTIONS[K][number] } & { preferredModeWeights: ModeWeights };
export type PersonaConfig = {
  bio?: string; tone?: string; interests?: string[]; media_types?: string[];
  favorite_media?: string[]; posting_style?: string; activity_level?: string;
  style_examples?: { type: string; content: string }[]; social_voice?: Partial<SocialVoice>;
  intent_preferences?: Partial<IntentWeights>;
  generation_feedback?: string[];
};
export type Persona = { id: string; user_name: string; display_name: string; persona_config: PersonaConfig };
export type MediaCandidate = {
  title: string; type: string; creator?: string; externalId?: string; externalSource?: string;
  canonicalId?: string; description?: string; genres?: string[];
  source: "Trending" | "Persona Favorite" | "History" | "Discovery";
  fit: number;
  intentContext?: IntentContext;
};
export type RecentPost = { personaId: string; title: string; type: string; content?: string; createdAt?: string; intent?: PostIntent };
export type BatchEntry = { personaId: string; mediaKey: string; mode: PostMode; words: number; caps: boolean; content: string; intent?: PostIntent };
export type GenerationMeta = {
  version: 1; mode: PostMode; modeLabel: string; mediaSource: string; recentlyUsed: boolean;
  voice: SocialVoice; externalId?: string; externalSource?: string; words: number;
  rating: number | null; warnings: string[];
  intent?: PostIntent; intentLabel?: string; intentReason?: string;
  consumption?: IntentAssignment["consumption"]; context?: IntentContext;
};
export function validateModeWeights(value: unknown): ModeWeights {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Mode weights must be an object");
  const weights = {} as ModeWeights;
  for (const { id } of POST_MODES) {
    const n = (value as any)[id];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100) throw new Error(`Invalid weight for ${id} (0–100 required)`);
    weights[id] = n;
  }
  if (Object.values(weights).every(n => n === 0)) throw new Error("At least one mode must have a positive weight");
  return weights;
}
export function validateVoice(value: unknown): SocialVoice {
  if (!value || typeof value !== "object") throw new Error("Voice settings required");
  const voice = {} as SocialVoice;
  for (const [key, options] of Object.entries(VOICE_OPTIONS)) {
    const choice = (value as any)[key];
    if (!(options as readonly string[]).includes(choice)) throw new Error(`Invalid voice setting: ${key}`);
    (voice as any)[key] = choice;
  }
  voice.preferredModeWeights = validateModeWeights((value as any).preferredModeWeights);
  return voice;
}
/** Initial tendencies come from existing identity, never from a replacement persona prompt. */
export function deriveSocialVoice(config: PersonaConfig): SocialVoice {
  const traits = `${config.tone || ""} ${config.posting_style || ""} ${config.bio || ""}`.toLowerCase();
  const examples = (config.style_examples || []).map(e => e.content).join(" ");
  const energetic = /enthusiastic|dramatic|emotional|passionate|expressive|chaotic/.test(traits);
  const analytical = /analyt|thoughtful|encyclopedic|critic|literary|introspect|philosoph|nuanced/.test(traits);
  const laidBack = /laid.back|casual|relaxed|short updates|minimal|understated|deadpan/.test(traits);
  const prefersRatings = /ratings|rating-heavy|reviews/.test(traits);
  const preferredModeWeights: ModeWeights = {
    thoughtful: analytical ? 1.8 : 1, micro: energetic ? 1.5 : .8, casual: laidBack ? 1.8 : 1.1,
    rating: prefersRatings ? 1.8 : .8, question: /debate|curious|community|discussion/.test(traits) ? 1.5 : .8,
    specific: /episode|characters|reactions/.test(traits) ? 1.5 : 1,
    opinion: /hot takes|sarcas|sharp|opinion|snark|dark humor/.test(traits) ? 1.7 : .8,
    low_energy: laidBack ? 1.8 : .9,
  };
  const defaults: SocialVoice = {
    length: /terse|minimal/.test(traits) ? "terse" : laidBack || energetic ? "short" : analytical ? "detailed" : "medium",
    energy: energetic ? "enthusiastic" : analytical ? "restrained" : "casual",
    capitalization: energetic && /\b[A-Z]{3,}\b/.test(examples) ? "expressive" : "standard",
    punctuation: energetic ? "expressive" : laidBack ? "minimal" : "standard",
    emojiFrequency: /[\u{1F300}-\u{1FAFF}]/u.test(examples) ? "low" : "none",
    ratingFrequency: prefersRatings ? "frequent" : laidBack ? "rare" : "occasional",
    questionFrequency: /curious|debate|discussion/.test(traits) ? "frequent" : analytical ? "rare" : "occasional",
    sarcasm: /sarcas|snark|dark humor|dry humor|deadpan/.test(traits) ? "medium" : /self.aware|sharp/.test(traits) ? "low" : "none",
    preferredModeWeights,
  };
  return validateVoice({ ...defaults, ...config.social_voice, preferredModeWeights: { ...preferredModeWeights, ...config.social_voice?.preferredModeWeights } });
}
export function normalizedTitle(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}
export function mediaKey(item: { title: string; type: string }): string {
  return `${item.type.toLowerCase()}:${normalizedTitle(item.title)}`;
}
export function weightedPick<T>(items: T[], weight: (item: T) => number, random = Math.random): T {
  if (!items.length) throw new Error("No candidates to select");
  const values = items.map(item => Math.max(0, weight(item)));
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) throw new Error("No eligible weighted candidates");
  let cursor = random() * total;
  return items[values.findIndex((n, i) => (cursor -= n) < 0 || i === values.length - 1)];
}
export function mediaSelectionWeight(item: MediaCandidate, personaId: string, recent: RecentPost[], batch: BatchEntry[]): number {
  const key = mediaKey(item);
  const uses = recent.filter(p => mediaKey(p) === key);
  let score = .2 + Math.max(0, Math.min(1, item.fit)) ** 2 * 4;
  if (item.source === "Persona Favorite") score *= 1.3;
  if (item.source === "Trending") score *= .85;
  // Each collision lowers probability, but no title is absolutely forbidden.
  score *= Math.pow(.16, batch.filter(p => p.mediaKey === key).length);
  for (const post of uses) {
    const age = post.createdAt ? Date.now() - new Date(post.createdAt).getTime() : 0;
    const penalty = age < 7 * 86400000 ? .3 : .6;
    score *= post.personaId === personaId ? penalty * .5 : penalty;
  }
  return Math.max(.002, score);
}
export function chooseMedia(items: MediaCandidate[], personaId: string, recent: RecentPost[], batch: BatchEntry[], random = Math.random): MediaCandidate {
  // Merge provider aliases/title variants so multiple candidates don't multiply a work's chance.
  const unique = new Map<string, MediaCandidate>();
  for (const item of items) {
    const existing = unique.get(mediaKey(item));
    if (!existing || item.fit > existing.fit) unique.set(mediaKey(item), item);
  }
  const candidates = [...unique.values()];
  const sourceCounts = new Map<string, number>();
  for (const item of candidates) sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1);
  const sourcePrior = { "Persona Favorite": 1.25, Discovery: 1.2, History: 1, Trending: .8 };
  // Source cardinality must not turn 25 weak trends into stronger evidence than 3 genuine favorites.
  return weightedPick(candidates, item => mediaSelectionWeight(item, personaId, recent, batch) * sourcePrior[item.source] / sourceCounts.get(item.source)!, random);
}
export function chooseMode(weights: ModeWeights, voice: SocialVoice, batch: BatchEntry[], random = Math.random, compatible?: PostMode[]): PostMode {
  const last = batch.slice(-5);
  const modes = POST_MODES.map(m => m.id).filter(id => !compatible || compatible.includes(id));
  if (!modes.some(id => weights[id] * voice.preferredModeWeights[id] > 0)) throw new Error("No configured writing mode is compatible with the assigned intent/state");
  return weightedPick(modes, mode => {
    let w = weights[mode] * voice.preferredModeWeights[mode];
    if (mode === "question") w *= voice.questionFrequency === "rare" ? .4 : voice.questionFrequency === "frequent" ? 1.5 : 1;
    if (mode === "rating") w *= voice.ratingFrequency === "rare" ? .35 : voice.ratingFrequency === "frequent" ? 1.5 : 1;
    w *= Math.pow(.6, last.filter(p => p.mode === mode).length);
    if (last.length >= 3 && last.slice(-3).every(p => p.mode === mode)) w *= .25;
    const short = mode === "micro" || mode === "low_energy";
    if (short && last.filter(p => p.words <= 5).length >= 3) w *= .3;
    if (mode === "thoughtful" && last.filter(p => p.words >= 25).length >= 3) w *= .5;
    return w;
  }, random);
}
export function chooseRating(mode: PostMode, voice: SocialVoice, random = Math.random, assignment?: IntentAssignment): number | null {
  const probability = assignment ? intentRatingProbability(assignment, voice) : voice.ratingFrequency === "rare" ? .15 : voice.ratingFrequency === "frequent" ? .8 : .45;
  if (probability === 0) return null;
  if (mode !== "rating" && random() > probability) return null;
  // Keep mixed/negative opinions possible rather than making every persona ecstatic.
  return weightedPick([.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], n => [.5, 1, 1, 2, 3, 5, 9, 12, 10, 8][Math.round(n * 2) - 1], random);
}
export const AI_PHRASES = ["the way", "it's the kind of", "i can't get enough", "chef's kiss", "a wild ride", "kept me on the edge of my seat", "from start to finish", "what a journey", "an absolute masterpiece"];
export function repeatedPhrases(posts: string[]): string[] {
  const normalized = posts.map(p => p.toLowerCase().replace(/[’]/g, "'"));
  const counts = new Map<string, number>();
  for (const text of normalized) {
    const words = text.match(/[a-z']+/g) || [];
    const seen = new Set<string>();
    for (let i = 0; i + 3 <= words.length; i++) {
      const phrase = words.slice(i, i + 3).join(" ");
      if (phrase.length >= 12) seen.add(phrase);
    }
    for (const phrase of seen) counts.set(phrase, (counts.get(phrase) || 0) + 1);
  }
  return [...new Set([...AI_PHRASES.filter(p => normalized.some(t => t.includes(p))), ...[...counts].filter(([, n]) => n > 1).map(([p]) => p)])].slice(0, 16);
}
export function wordCount(content: string): number { return content.trim() ? content.trim().split(/\s+/).length : 0; }
export function hasAllCaps(content: string): boolean { return /\b[A-Z]{3,}\b/.test(content); }
/** Let the writer invent wording, but derive optional score expressions from the assigned value. */
export function renderRatingPlaceholders(content: unknown, rating: number | null): string {
  if (typeof content !== "string") throw new Error("content must be a string");
  if (/\{\{rating(?:_words)?\}\}/.test(content) && rating === null) throw new Error("No rating is assigned to this post");
  const names: Record<number, string> = { .5: "half", 1: "one", 1.5: "one and a half", 2: "two", 2.5: "two and a half", 3: "three", 3.5: "three and a half", 4: "four", 4.5: "four and a half", 5: "five" };
  return content.replace(/\{\{rating\}\}/g, String(rating)).replace(/\{\{rating_words\}\}/g, rating === null ? "" : names[rating]);
}
export function writingShapeIssues(content: string, mode: PostMode): string[] {
  const words = wordCount(content);
  const issues: string[] = [];
  if (mode === "micro" && words > 12) issues.push("micro reaction has become a review; use a genuinely tiny original reaction");
  if (mode === "low_energy" && words > 22) issues.push("low-energy response should be short and ordinary");
  if (mode === "thoughtful" && words < 15) issues.push("thoughtful reaction needs a considered opinion, not a one-liner");
  if (words === 0 && mode !== "micro" && mode !== "low_energy") issues.push("rating-only content belongs to micro or low-energy mode");
  const promotional = content.match(/\b(?:tackles|offers a fascinating|offers insightful|insightful perspective|forms the backbone|masterclass|multi-generational saga|navigates|exploring moral complexity|breathtaking exploration|meticulous attention|emotionally resonant|visually striking|expertly weaves|unique ability|timeless|thought-provoking|engrossing blend|masterful symphony)\b/gi) || [];
  // A single polished phrase is allowed. Adding "I" does not excuse a cluster of editorial copy.
  if (words > 15 && promotional.length >= 2) issues.push("promotional/academic blurb, not a person's post. WRITE THE REACTION, NOT THE REVIEW; adding a first-person introduction is not enough. Preserve the person's intelligence, but respond to their experience rather than explaining themes or selling the work");
  return issues;
}
/** Remove conflicting old scores without turning example lengths into mandatory shapes. */
export function cleanStyleExample(content: string): string {
  return content.replace(/\b\d+(?:\.\d+)?\s*\/\s*(?:10|5)\b/g, "").replace(/\b\d+(?:\.\d+)?\s*(?:stars?|out of (?:five|ten|5|10))\b/gi, "").replace(/ {2,}/g, " ").trim();
}
export function buildWritingPrompt(persona: Persona, media: MediaCandidate, mode: PostMode, voice: SocialVoice, rating: number | null, batch: BatchEntry[], recent: RecentPost[], repair?: string, assignment?: IntentAssignment) {
  const spec = POST_MODES.find(m => m.id === mode)!;
  const phrases = repeatedPhrases([...recent.slice(-30).map(p => p.content || ""), ...batch.map(p => p.content)]);
  const capsPressure = batch.slice(-6).filter(p => p.caps).length >= 2;
  const config = persona.persona_config;
  const { preferredModeWeights: _modePreferences, ...writingVoice } = voice;
  const stance = assignment && ["not_started", "starting"].includes(assignment.consumption.state) ? "Expectations or intention only; no verdict on completed consumption." : rating === null ? "No forced verdict or endorsement. Let the assigned social behavior determine the thought." : rating >= 4 ? "Liked or loved it, without forced hype." : rating >= 3 ? "Mixed/moderately positive, not an ecstatic rave." : "Disappointed or unimpressed, without obligatory snark.";
  const messages = [
    { role: "system", content: `You are ${persona.display_name}. Preserve this person's existing identity:\n${JSON.stringify({ bio: config.bio, tone: config.tone, interests: config.interests, posting_style: config.posting_style })}\nSocial voice tendencies derived from their existing descriptions and examples: ${JSON.stringify(writingVoice)}. Preferences, not rigid rules or a caricature; no requirement to express every trait in every post. Assigned intent takes precedence over mode: mode shapes expression, not the reason to post. Emoji setting "none" means no emojis; other settings are probabilities, not a requirement.\nExisting admin rejection feedback: ${JSON.stringify(config.generation_feedback || [])}\n\n${PERSONAL_SOCIAL_REGISTER}\n\nDo not invent named characters, events, episode/season numbers, endings, quotes or credits. Only use specifics explicitly supported by supplied context. Broad fictional consumption states are allowed and assigned by the planner, but do not invent specific progress counts or additional personal biography. No spoiler details. No predefined reactions/templates: use this person's own wording.` },
    { role: "user", content: `Assigned media (do not choose another): ${JSON.stringify({ title: media.title, type: media.type, creator: media.creator, reliableContext: media.description?.slice(0, 900) || "No detailed context supplied. Use a general reaction; do not invent facts." })}\nAssigned internal mode: ${spec.label}. Behavior: ${spec.description}. Approximate target ${spec.words[0]}–${spec.words[1]} words (not a fill-in template; do not pad the thought with review language).\nWriting within this mode: ${MODE_REGISTER_GUIDANCE[mode]}\nEmotional stance: ${stance}\nAuthoritative rating: ${rating === null ? "none. No rating language or numerical scores in the body." : `${rating}/5. Already visible on the card. If you optionally reference your actual score, use {{rating}} for the number or {{rating_words}} for its written form; the application substitutes the authoritative value. Say it naturally, with no obligation to mention the score. Never /10. A clearly hypothetical better rating is allowed.`}\nRating-only (empty content) is permitted occasionally if there is a rating and this is a micro or low-energy post. Never return empty content without a rating.\nRecent batch shapes: ${batch.slice(-5).map(p => `${p.mode}, ${p.words} words${p.caps ? ", all caps" : ""}`).join("; ") || "none yet"}.\n${capsPressure ? "Several recent posts use capitals; prefer ordinary capitalization for this post." : "Capitals are optional according to voice."}\nDiscourage already-used phrases: ${phrases.join("; ") || "none yet"}. Do not reuse the openings or rhetorical shape of these recent posts:\n${batch.slice(-3).map(p => p.content).join("\n")}\n${repair ? `Previous attempt failed validation: ${repair}. Correct the underlying thought/register, not just capitalization or pronouns. Do not change the assignment.` : ""}\nFinal register check: Is this something this person would type, or does it explain/sell/analyze the work for an audience? Keep the reaction, not the review. No need to be original, insightful or clever; no borrowed demonstration phrases.\nReturn ONLY JSON: {"content":"post text"}. No rating, media or post_type fields; those are already assigned.`,
    },
  ];
  if (assignment) {
    messages[1].content = `${intentWriterInstructions(assignment)}\n\n${messages[1].content}\nIntent is the primary assignment. Recent intents: ${batch.slice(-8).map(p => p.intent || "unknown").join(", ") || "none"}. Do not supply an evaluation merely because a mode permits more words. Word targets are soft guidance, never an obligation to pad or explain a tiny human thought.`;
  }
  return messages;
}
/** Numbers in hypothetical clauses are not claims about the actual rating. */
export function validateGeneratedContent(content: unknown, rating: number | null, media: MediaCandidate): string[] {
  if (typeof content !== "string") return ["content must be a string"];
  const errors: string[] = [];
  if (!content.trim() && rating === null) errors.push("empty content requires a structured rating");
  if (content.length > 1800) errors.push("post is too long");
  if (/\{\{|\}\}/.test(content)) errors.push("unresolved score placeholder");
  const stripHypotheticals = content.replace(/(?:would(?:['’]ve| have| have been)|would've been|could have been|would be|if only|would be an?)[^!?\n]*(?:[.!?]|$)/gi, "");
  const textualRatings = [...stripHypotheticals.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\/\s*5|[- ]stars?\b|out of (?:5|five))/gi)].map(m => +m[1]);
  const numberWords: Record<string, number> = { half: .5, one: 1, two: 2, three: 3, four: 4, five: 5 };
  for (const m of stripHypotheticals.matchAll(/\b(one|two|three|four|five)(\s+and\s+a\s+half)?(?:[- ]stars?\b|\s+out of five\b)/gi)) textualRatings.push(numberWords[m[1].toLowerCase()] + (m[2] ? .5 : 0));
  if (/\b\d+(?:\.\d+)?\s*\/\s*10\b|\bout of ten\b/i.test(content)) errors.push("ten-point scores are not supported");
  if (textualRatings.some(n => rating === null || n !== rating)) errors.push("text rating disagrees with authoritative five-star rating");
  // Bare leading rating claims such as "3.5 and I stand by it".
  const leading = stripHypotheticals.match(/^\s*(\d(?:\.\d+)?)\s*(?:[.,!]|and\b|—|-)/i);
  if (leading && (rating === null || +leading[1] !== rating)) errors.push("leading rating disagrees with authoritative rating");
  for (const m of stripHypotheticals.matchAll(/\b[0-5]\.[05]\b(?!\s*(?:hours?|minutes?))/g)) {
    if (rating === null || +m[0] !== rating) errors.push("decimal rating disagrees with authoritative rating");
  }
  if (/^\s*\d(?:\.\d+)?\s*$/.test(content) && (rating === null || +content.trim() !== rating)) errors.push("rating-only text disagrees with authoritative rating");
  for (const m of content.matchAll(/\b(?:episode|season)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi)) {
    if (!(media.description || "").toLowerCase().includes(m[0].toLowerCase())) errors.push("episode/season detail has no supplied evidence");
  }
  return errors;
}
export function encodeGenerationNotes(meta: GenerationMeta): string { return JSON.stringify({ generation: meta }); }
export function parseGenerationNotes(notes: string | null | undefined): GenerationMeta | null {
  try { const value = JSON.parse(notes || ""); return value?.generation?.version === 1 ? value.generation : null; } catch { return null; }
}