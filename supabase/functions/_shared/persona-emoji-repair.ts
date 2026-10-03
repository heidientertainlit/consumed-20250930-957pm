import type { SocialVoice } from "./persona-generation.ts";

export type EmojiRepair = {
  original: string;
  repaired: string;
  removed: string[];
  reason: "emojiFrequency_none";
};
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function isEmoji(grapheme: string): boolean {
  // Ordinary text copyright/trademark symbols are not emoji; explicit VS16 is.
  if (/^[©®™]$/u.test(grapheme)) return false;
  return /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[0-9#*]\uFE0F?\u20E3/u.test(grapheme);
}

/** One local repair. Every non-emoji character, including whitespace, stays unchanged. */
export function repairDisallowedEmoji(content: string, frequency: SocialVoice["emojiFrequency"]): EmojiRepair | null {
  if (frequency !== "none") return null;
  const removed: string[] = [];
  let repaired = "";
  for (const { segment } of segmenter.segment(content)) {
    if (isEmoji(segment)) removed.push(segment);
    else repaired += segment;
  }
  if (!removed.length) return null;
  // Deterministic recheck; never ask the general writer to change the surrounding prose.
  if ([...segmenter.segment(repaired)].some(({ segment }) => isEmoji(segment))) {
    throw new Error("Emoji-only repair did not pass the existing none setting");
  }
  return { original: content, repaired, removed, reason: "emojiFrequency_none" };
}