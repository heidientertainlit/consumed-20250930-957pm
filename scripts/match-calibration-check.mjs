// Quiet-drift guardrail for score-media-match.
// Runs the REAL scoring prompt (shared prompt.mjs) against a fixed taste
// profile and titles with known-correct score ranges. Run after any change
// to the scoring rules:  node scripts/match-calibration-check.mjs
import { buildPrompt } from '../supabase/functions/score-media-match/prompt.mjs';

const profile = {
  dnaProfile: {
    label: 'The Heartfelt Historian',
    tagline: 'Character-driven period drama and warm romance',
    profile_text: 'Loves romantic period dramas, witty ensemble casts, and emotionally rich character stories.',
    favorite_genres: ['drama', 'romance', 'period drama', 'comedy'],
    favorite_media_types: ['movie', 'tv'],
  },
  highRatings: [
    { media_title: 'Emma', media_type: 'movie', rating: 5 },
    { media_title: 'Sense and Sensibility', media_type: 'movie', rating: 5 },
    { media_title: 'The Gilded Age', media_type: 'tv', rating: 5 },
    { media_title: 'Crazy Rich Asians', media_type: 'movie', rating: 5 },
    { media_title: 'Gilmore Girls', media_type: 'tv', rating: 5 },
    { media_title: 'The Queen\'s Gambit', media_type: 'tv', rating: 5 },
  ],
  lowRatings: [
    { media_title: 'Star Wars: Episode I - The Phantom Menace', media_type: 'movie', rating: 1 },
  ],
  dnaSignals: [
    { signal_type: 'genre', signal_value: 'romance', strength: 0.9 },
    { signal_type: 'genre', signal_value: 'period drama', strength: 0.9 },
    { signal_type: 'genre', signal_value: 'comedy', strength: 0.6 },
  ],
};

const cases = [
  { title: 'Ever After', media_type: 'movie', min: 85, max: 100, why: 'beloved-genre classic' },
  { title: 'Downton Abbey', media_type: 'tv', min: 85, max: 100, why: 'beloved-genre classic' },
  { title: 'Pride & Prejudice', media_type: 'movie', min: 85, max: 100, why: 'beloved-genre classic' },
  { title: 'How To Piss Off An NHL Fanbase In One Interview', media_type: 'youtube', min: 0, max: 20, why: 'no overlap with taste' },
  { title: 'Star Wars: The Clone Wars', media_type: 'tv', min: 0, max: 25, why: 'franchise they disliked' },
  { title: 'Saw X', media_type: 'movie', min: 0, max: 30, why: 'gory horror, opposite of taste' },
  { title: 'The Martian', media_type: 'movie', min: 35, max: 80, why: 'mixed: smart drama but sci-fi' },
];

const key = process.env.OPENAI_API_KEY;
if (!key) { console.error('OPENAI_API_KEY not set'); process.exit(2); }

let failures = 0;
for (const c of cases) {
  const prompt = buildPrompt({ ...profile, title: c.title, media_type: c.media_type, creator: undefined, genres: [], description: undefined });
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 150,
    }),
  });
  if (!res.ok) { console.error(`API error for ${c.title}: ${res.status}`); failures++; continue; }
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  const score = Math.round(Number(parsed.score));
  const pass = score >= c.min && score <= c.max;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${String(score).padStart(3)}  (want ${c.min}-${c.max})  ${c.title}  [${c.why}]${pass ? '' : `\n      reason: ${parsed.reason}`}`);
}
console.log(failures === 0 ? '\nAll calibration checks passed.' : `\n${failures} check(s) FAILED — scoring has drifted, fix the prompt before deploying.`);
process.exit(failures === 0 ? 0 : 1);
