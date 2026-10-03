import type { Persona } from "./persona-generation.ts";

/** Thought-construction tendencies; independent of surface voice, intent and mode. */
export const AUTHOR_STYLE_OPTIONS = {
  directness: ["blunt", "straightforward", "elaborative"],
  emotional_expression: ["reserved", "open", "expressive"],
  thinking_style: ["literal", "mixed", "associative"],
  stance: ["earnest", "dry", "playful", "wry"],
  specificity: ["broad", "selective", "detail_oriented"],
  focus: ["experience", "balanced", "interpretation"],
  certainty: ["tentative", "qualified", "declarative"],
  polish: ["off_the_cuff", "considered", "composed"],
  explanation_drive: ["low", "selective", "high"],
  adjective_density: ["sparse", "moderate", "descriptive"],
  reference_style: ["rare", "occasional", "natural_when_relevant"],
} as const;
export type AuthorStyle = {
  [K in keyof typeof AUTHOR_STYLE_OPTIONS]: typeof AUTHOR_STYLE_OPTIONS[K][number];
} & { principles: string[] };

/** Intentionally curated from the approved identities. Never fitted to batch outputs. */
export const SEEDED_AUTHOR_STYLES: Readonly<Record<string, AuthorStyle>> = {
  alex_thompson: {
    directness: "blunt", emotional_expression: "reserved", thinking_style: "literal",
    stance: "earnest", specificity: "broad", focus: "experience", certainty: "declarative",
    polish: "off_the_cuff", explanation_drive: "low", adjective_density: "sparse", reference_style: "rare",
    principles: [
      "State the response without building a case for it; an ordinary preference can be the whole thought.",
      "Entertainment need not become a discussion or identity statement. Occasional dry understatement is natural, not obligatory.",
    ],
  },
  reedreads: {
    directness: "straightforward", emotional_expression: "open", thinking_style: "literal",
    stance: "earnest", specificity: "selective", focus: "experience", certainty: "tentative",
    polish: "off_the_cuff", explanation_drive: "selective", adjective_density: "sparse", reference_style: "occasional",
    principles: [
      "Work out the response while saying it; acknowledge feelings warmly without dramatizing them.",
      "Uncertainty is genuine, not a setup for a confident verdict. Popular discussion may prompt curiosity without determining the opinion.",
    ],
  },
  sarah13: {
    directness: "straightforward", emotional_expression: "reserved", thinking_style: "literal",
    stance: "dry", specificity: "detail_oriented", focus: "balanced", certainty: "declarative",
    polish: "considered", explanation_drive: "selective", adjective_density: "sparse", reference_style: "occasional",
    principles: [
      "Know the genre without giving a lecture; keep some distance between an unsettling experience and its emotional expression.",
      "Dry humor can come from willingly seeking discomfort. A plain response is equally natural; not every post needs a joke.",
    ],
  },
  lenahoff: {
    directness: "elaborative", emotional_expression: "open", thinking_style: "mixed",
    stance: "earnest", specificity: "selective", focus: "experience", certainty: "qualified",
    polish: "considered", explanation_drive: "selective", adjective_density: "moderate", reference_style: "rare",
    principles: [
      "Notice personal attachment to the experience; reflection is warm and affectionate rather than an account of the author's artistry.",
      "Let a thought gently develop or correct itself. Adjectives can name feelings; emotional openness does not require decorative language.",
    ],
  },
  emily27: {
    directness: "straightforward", emotional_expression: "expressive", thinking_style: "literal",
    stance: "playful", specificity: "selective", focus: "experience", certainty: "qualified",
    polish: "off_the_cuff", explanation_drive: "low", adjective_density: "moderate", reference_style: "occasional",
    principles: [
      "React to people and relationships before organizing an opinion; be confident about feelings without needing a settled interpretation.",
      "A thought may change direction while still emotionally inside the experience. Enthusiasm can mean attachment or frustration, not constant hype.",
    ],
  },
  kei: {
    directness: "straightforward", emotional_expression: "expressive", thinking_style: "literal",
    stance: "playful", specificity: "detail_oriented", focus: "balanced", certainty: "qualified",
    polish: "off_the_cuff", explanation_drive: "selective", adjective_density: "sparse", reference_style: "occasional",
    principles: [
      "Engage by trying to understand how things work; excitement can come from figuring something out, accepting difficulty or revising an assumption.",
      "Preferences can be firm while theories stay tentative. Gaming/anime language is natural when relevant, not a requirement for slang or metaphors.",
    ],
  },
  marcusdelacroix: {
    directness: "elaborative", emotional_expression: "reserved", thinking_style: "associative",
    stance: "earnest", specificity: "selective", focus: "interpretation", certainty: "declarative",
    polish: "composed", explanation_drive: "high", adjective_density: "moderate", reference_style: "natural_when_relevant",
    principles: [
      "Make the distinction that matters personally: what a work means, where it belongs in one's taste or why a category is inadequate.",
      "Express feeling through judgment and interpretation, not a comprehensive assessment. Rankings and cultural references are available, never a mandatory shape.",
    ],
  },
  nick: {
    directness: "straightforward", emotional_expression: "reserved", thinking_style: "literal",
    stance: "earnest", specificity: "detail_oriented", focus: "balanced", certainty: "qualified",
    polish: "considered", explanation_drive: "high", adjective_density: "sparse", reference_style: "rare",
    principles: [
      "Ask what is useful, believable or applicable; prefer concrete decisions and imperfect experience to impressive general advice.",
      "Explain a reason when it clarifies personal application. Not every post needs a takeaway, framework or endorsement.",
    ],
  },
  brooksj: {
    directness: "straightforward", emotional_expression: "open", thinking_style: "mixed",
    stance: "earnest", specificity: "selective", focus: "experience", certainty: "declarative",
    polish: "off_the_cuff", explanation_drive: "selective", adjective_density: "moderate", reference_style: "occasional",
    principles: [
      "Take music personally and commit to preferences; explain through listening and feeling rather than a claim of artistic importance.",
      "Passion lives in the preference, not automatically in superlatives or slogans. Defending a favorite need not become a performance.",
    ],
  },
  alexmoreno402: {
    directness: "straightforward", emotional_expression: "reserved", thinking_style: "associative",
    stance: "wry", specificity: "selective", focus: "interpretation", certainty: "qualified",
    polish: "composed", explanation_drive: "selective", adjective_density: "sparse", reference_style: "natural_when_relevant",
    principles: [
      "Think about cinema while remaining aware of the desire to make that interest sound important; sometimes question the argument behind one's own taste.",
      "A strong judgment can coexist with self-awareness. Precise imagery or film references are possible, but neither doubt nor a punchline is compulsory.",
    ],
  },
};

/** Saved values win field-by-field. Uncurated identities get no guessed author profile. */
export function resolveAuthorStyle(persona: Persona): AuthorStyle | null {
  const key = persona.user_name.trim().toLowerCase();
  const base = Object.hasOwn(SEEDED_AUTHOR_STYLES, key) ? SEEDED_AUTHOR_STYLES[key] : undefined;
  const override = persona.persona_config.author_style;
  if (!base && override === undefined) return null;
  if (override !== undefined && (!override || typeof override !== "object" || Array.isArray(override))) {
    throw new Error("Author style overrides must be an object");
  }
  for (const key of Object.keys(override || {})) {
    if (key !== "principles" && !Object.hasOwn(AUTHOR_STYLE_OPTIONS, key)) throw new Error(`Unknown author style field: ${key}`);
  }
  const value = { ...base, ...override };
  for (const [key, choices] of Object.entries(AUTHOR_STYLE_OPTIONS)) {
    if (!(choices as readonly unknown[]).includes(value[key as keyof AuthorStyle])) {
      throw new Error(`Invalid or missing author style: ${key}`);
    }
  }
  if (!Array.isArray(value.principles) || value.principles.length > 4
      || value.principles.some(p => typeof p !== "string" || !p.trim() || p.length > 600)) {
    throw new Error("Author style principles must be up to four short nonempty strings");
  }
  return { ...value, principles: [...value.principles] } as AuthorStyle;
}

export function authorStyleInstructions(style: AuthorStyle | null): string {
  if (!style) return "";
  return `PERSONA AUTHOR STYLE — how this person constructs thoughts:
${JSON.stringify(style)}
These are tendencies across posts, not a checklist. An ordinary post need not visibly reveal the author. Emotional openness is not outward energy; explanation drive is not a word quota. Express the assigned intent in the available mode, without forcing references, adjectives, jokes or signature habits. References never authorize unsupported facts.`;
}