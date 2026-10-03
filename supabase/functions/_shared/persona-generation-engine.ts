import {
  buildWritingPrompt, chooseMedia, chooseMode, chooseRating, deriveSocialVoice, encodeGenerationNotes,
  hasAllCaps, mediaKey, POST_MODES, renderRatingPlaceholders, validateGeneratedContent, wordCount,
  type Persona, type ModeWeights, type MediaCandidate, type RecentPost, type BatchEntry, type GenerationMeta,
} from "./persona-generation.ts";
import type { Chat } from "./persona-media-candidates.ts";
import { resolveAuthorStyle } from "./persona-author-style.ts";
import { repairDisallowedEmoji, type EmojiRepair } from "./persona-emoji-repair.ts";
import { DEFAULT_INTENT_WEIGHTS, planPostIntent, compatibleIntentModes, consumptionContradictions, buildIntentValidationPrompt, validateIntentWeights, type IntentWeights, type IntentContext, type ConsumptionScenario } from "./persona-post-intents.ts";

export async function generatePersonaBatch(options: {
  personas: Persona[]; postsPerPersona: number; weights: ModeWeights; recent: RecentPost[];
  candidates: Map<string, MediaCandidate[]>; chat: Chat; random?: () => number; deadline?: number;
  intentWeights?: IntentWeights;
  intentRecent?: RecentPost[];
  loadContext?: (media: MediaCandidate) => Promise<IntentContext>;
  scenario?: (persona: Persona, media: MediaCandidate) => ConsumptionScenario | undefined;
}) {
  const { personas, postsPerPersona, weights, recent, candidates, chat, random = Math.random } = options;
  const state: BatchEntry[] = [];
  const drafts: any[] = [];
  const errors: string[] = [];
  const intentWeights = validateIntentWeights(options.intentWeights || DEFAULT_INTENT_WEIGHTS);
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
        const authorStyle = resolveAuthorStyle(persona);
        const chosen = chooseMedia(candidates.get(persona.id) || [], persona.id, recent, state, random);
        const contextWarnings: string[] = [];
        let media = { ...chosen };
        if (options.loadContext) {
          try { media.intentContext = { ...media.intentContext, ...await options.loadContext(chosen) }; }
          catch { contextWarnings.push("Extra provider context unavailable; unsupported specific intents remain ineligible."); }
        }
        const assignment = planPostIntent(persona, media, intentWeights, state, options.intentRecent || recent, random, options.scenario?.(persona, media), POST_MODES.filter(m => weights[m.id] * voice.preferredModeWeights[m.id] > 0).map(m => m.id));
        const mode = chooseMode(weights, voice, state, random, compatibleIntentModes(assignment));
        const rating = chooseRating(mode, voice, random, assignment);
        let content = "", issues: string[] = [];
        const repairWarnings: string[] = [];
        const styleWarnings: string[] = [];
        const emojiRepairs: EmojiRepair[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          const raw = await chat(buildWritingPrompt(persona, media, mode, voice, rating, state, recent, issues.join("; "), assignment));
          try {
            const value = JSON.parse(raw);
            content = renderRatingPlaceholders(value.content, rating);
          } catch {
            issues = ["Writer output was incomplete JSON or had invalid content/score placeholders. Return only a complete JSON object with one content string; no planning, explanation or extra fields."];
            repairWarnings.push("Repair requested: incomplete JSON or invalid content/score placeholders.");
            continue; // Use the existing bounded repair, preserving media, mode and rating.
          }
          const emojiRepair = repairDisallowedEmoji(content, voice.emojiFrequency);
          if (emojiRepair) {
            emojiRepairs.push(emojiRepair);
            content = emojiRepair.repaired;
            styleWarnings.push(`Style check failed: emojiFrequency=none. One emoji-only repair removed ${emojiRepair.removed.length} sequence(s); all other text unchanged (writer attempt ${attempt + 1}).`);
            if (!content.trim() && rating === null) throw new Error("Emoji-only repair leaves empty unrated content; no draft created");
          }
          issues = validateGeneratedContent(content, rating, { ...media, description: [media.description, ...(assignment.context.moments || []), assignment.consumption.details].filter(Boolean).join("\n") });
          issues.push(...consumptionContradictions(content, assignment));
          if (!issues.length && content.trim()) {
            const verdict = JSON.parse(await chat(buildIntentValidationPrompt(content, assignment, media, rating, persona)));
            if (!Array.isArray(verdict.issues) || verdict.issues.some((issue: unknown) => typeof issue !== "string")) throw new Error("Intent validation did not return a valid result; no draft created");
            issues.push(...verdict.issues);
          }
          if (!issues.length) break;
          repairWarnings.push(...issues.map(issue => `Repair requested: ${issue}`));
        }
        if (issues.length) throw new Error(issues.join("; "));
        const words = wordCount(content);
        const spec = POST_MODES.find(m => m.id === mode)!;
        const meta: GenerationMeta = {
          version: 1, mode, modeLabel: spec.label, mediaSource: media.source,
          recentlyUsed: recent.some(p => mediaKey(p) === mediaKey(media)) || state.some(p => p.mediaKey === mediaKey(media)),
          voice, rating, words, externalId: media.externalId, externalSource: media.externalSource,
          warnings: [...contextWarnings, ...repairWarnings, ...styleWarnings],
          authorStyle, styleWarnings, emojiRepairs,
          intent: assignment.intent, intentLabel: assignment.intentLabel, intentReason: assignment.reason,
          consumption: assignment.consumption, context: assignment.context,
        };
        drafts.push({
          persona_user_id: persona.id, persona_user_name: persona.user_name, persona_display_name: persona.display_name,
          post_type: "review", content, rating, media_title: media.title, media_type: media.type,
          media_creator: media.creator || null, ai_notes: encodeGenerationNotes(meta), status: "draft",
        });
        state.push({ personaId: persona.id, mediaKey: mediaKey(media), mode, intent: assignment.intent, words, caps: hasAllCaps(content), content });
      } catch (error) { errors.push(`${persona.display_name}: ${error instanceof Error ? error.message : "Generation failed"}`); }
    }
  }
  return { drafts, errors, state };
}