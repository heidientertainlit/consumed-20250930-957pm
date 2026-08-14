// Shared prompt builder for score-media-match.
// Used by BOTH the edge function and scripts/match-calibration-check.mjs —
// change scoring rules here so the calibration check always tests the real prompt.
export function buildPrompt({ dnaProfile, highRatings, lowRatings, dnaSignals, title, creator, media_type, genres, description }) {
  return `You are an entertainment taste-matching engine. Score how well a title matches a specific user's taste, from 0-100.

USER TASTE PROFILE:
${dnaProfile ? `DNA: ${dnaProfile.label || ''} — ${dnaProfile.tagline || ''}
${dnaProfile.profile_text || ''}
Favorite genres: ${JSON.stringify(dnaProfile.favorite_genres) || 'unknown'}
Favorite media types: ${JSON.stringify(dnaProfile.favorite_media_types) || 'unknown'}` : 'No DNA profile yet.'}

Loved (rated 4-5 stars): ${(highRatings || []).map((r) => `${r.media_title} (${r.media_type}, ${r.rating}★)`).join('; ') || 'none'}
Disliked (rated 1-2 stars): ${(lowRatings || []).map((r) => `${r.media_title} (${r.media_type}, ${r.rating}★)`).join('; ') || 'none'}
Behavioral signals (strongest first): ${(dnaSignals || []).map((s) => `${s.signal_type}:${s.signal_value}`).join(', ') || 'none'}

TITLE TO SCORE:
"${title}"${creator ? ` by ${creator}` : ''} (${media_type || 'unknown type'})
${Array.isArray(genres) && genres.length ? `Genres: ${genres.join(', ')}` : ''}
${description ? `About: ${String(description).slice(0, 500)}` : ''}

Rules:
- If you recognize this title, use everything you know about it (genre, tone, plot, era, audience) — do not pretend you only know the title string.
- The score answers ONE question: how likely is it this user would LOVE this title? It is not a similarity average.
- Compare what the title IS against what the user demonstrably loves and dislikes. Strong genre/tone kinship with multiple loved titles = 85-100, even if they haven't rated this exact title.
- Be honest and calibrated across the FULL range: no real overlap = 0-4, weak/generic overlap = 5-15, some overlap = 16-39, mixed fit = 40-69, good fit = 70-84, strong fit (kinship with several loved titles) = 85-100.
- Do not hedge a clear fit downward. A beloved-genre classic that sits squarely among their favorites deserves 90+. Reserve 40-69 for genuinely mixed evidence (some pull, some clash).
- Pick a precise integer (like 8, 37, 63, 88, 94) — never default to round band edges like 40 or 70.

Calibration anchors (a user who loves Emma, Sense and Sensibility, The Gilded Age, Crazy Rich Asians):
- "Ever After" (beloved romantic period drama) → 92
- "Downton Abbey" (period ensemble drama) → 94
- A generic NHL commentary YouTube video → 7
- A gritty crime thriller (no romance/period kinship, no dislikes either) → 45
- "The Martian" (smart, witty, character-driven — wrong genre but shares qualities they love, no clash with dislikes) → 55
- Sharing only a broad category (e.g. both are "video" or vaguely "sports") is weak/generic overlap — score it 5-15, never higher.
- Generic appeal or popularity counts for nothing; the match must be to THIS user's evidence.
- Absence of evidence is NOT a dislike. Only their actual disliked titles count against a genre. A well-crafted title outside their usual genres that still shares qualities they love (smart writing, character focus, wit, emotional payoff) is mixed evidence = 40-69, not a low score. Reserve 0-15 for titles sharing NOTHING they love or clashing with actual dislikes.
- If you don't recognize the title AND it comes with no genre/description data, or the user profile has no relevant evidence either way, score it 0-4.
- The reason must be ONE short sentence (max 20 words) naming specific evidence, e.g. "You loved Little Fires Everywhere and rate character-driven drama highly."

Respond with ONLY valid JSON: {"score": <0-100>, "reason": "<one sentence>"}`;
}
