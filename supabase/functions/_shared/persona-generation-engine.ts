import {
  buildWritingPrompt, chooseMedia, chooseMode, chooseRating, deriveSocialVoice, encodeGenerationNotes,
  hasAllCaps, mediaKey, POST_MODES, renderRatingPlaceholders, validateGeneratedContent, writingShapeIssues, wordCount,
  type Persona, type ModeWeights, type MediaCandidate, type RecentPost, type BatchEntry, type GenerationMeta,
} from "./persona-generation.ts";
import type { Chat } from "./persona-media-candidates.ts";

export async function generatePersonaBatch(options: {
  personas: Persona[]; postsPerPersona: number; weights: ModeWeights; recent: RecentPost[];
  candidates: Map<string, MediaCandidate[]>; chat: Chat; random?: () => number; deadline?: number;
}) {
  const { personas, postsPerPersona, weights, recent, candidates, chat, random = Math.random } = options;
  const state: BatchEntry[] = [];
  const drafts: any[] = [];
  const errors: string[] = [];
  // Shuffle a round-robin roster. Avoid alphabetical/persona-grouped blocks looking like a fixed style rotation.
  const roster = [...personas];
  for (let i = roster.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [roster[i], roster[j]] = [roster[j], roster[i]]; }
  for (let round = 0; round < postsPerPersona; round++) {
    for (const persona of roster) {
      if (options.deadline && Date.now() > options.deadline) {
        errors.push("Generation time budget reached; remaining posts were not created. Completed drafts are returned explicitly.");
        return { drafts, errors, state };
      }
      try {
        const voice = deriveSocialVoice(persona.persona_config);
        const media = chooseMedia(candidates.get(persona.id) || [], persona.id, recent, state, random);
        const mode = chooseMode(weights, voice, state, random);
        const rating = chooseRating(mode, voice, random);
        let content = "", issues: string[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          const raw = await chat(buildWritingPrompt(persona, media, mode, voice, rating, state, recent, issues.join("; ")));
          try {
            const value = JSON.parse(raw);
            content = renderRatingPlaceholders(value.content, rating);
          } catch {
            issues = ["Writer output was incomplete JSON or had invalid content/score placeholders. Return only a complete JSON object with one short content string; no planning, explanation or extra fields."];
            continue; // Use the existing bounded repair, preserving media, mode and rating.
          }
          issues = validateGeneratedContent(content, rating, media);
          issues.push(...writingShapeIssues(content, mode));
          if (typeof content === "string" && voice.emojiFrequency === "none" && /\p{Extended_Pictographic}/u.test(content)) issues.push("persona's emoji setting is none");
          if (!issues.length) break;
        }
        if (issues.length) throw new Error(issues.join("; "));
        const words = wordCount(content);
        const spec = POST_MODES.find(m => m.id === mode)!;
        const meta: GenerationMeta = {
          version: 1, mode, modeLabel: spec.label, mediaSource: media.source,
          recentlyUsed: recent.some(p => mediaKey(p) === mediaKey(media)) || state.some(p => p.mediaKey === mediaKey(media)),
          voice, rating, words, externalId: media.externalId, externalSource: media.externalSource,
          warnings: words > spec.words[1] * 1.5 ? ["Longer than this mode's usual shape"] : [],
        };
        drafts.push({
          persona_user_id: persona.id, persona_user_name: persona.user_name, persona_display_name: persona.display_name,
          post_type: "review", content, rating, media_title: media.title, media_type: media.type,
          media_creator: media.creator || null, ai_notes: encodeGenerationNotes(meta), status: "draft",
        });
        state.push({ personaId: persona.id, mediaKey: mediaKey(media), mode, words, caps: hasAllCaps(content), content });
      } catch (error) { errors.push(`${persona.display_name}: ${error instanceof Error ? error.message : "Generation failed"}`); }
    }
  }
  return { drafts, errors, state };
}