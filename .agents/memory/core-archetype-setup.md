---
name: core_archetype setup
description: How core_archetype works, who has it set, and how to regenerate it.
---

**Column:** `dna_profiles.core_archetype` (text, nullable) — machine key like 'social_watcher'
**Also:** `dna_profiles.confidence_score` (numeric, nullable)

**Heidi's account (88bfb2a0-e8ce-4081-b731-2a49567ff093):** manually set to 'social_watcher' (confidence 0.72) via Management API SQL so she can see the alignment features working.

**Proper regeneration:** call `generate-dna-profile-v2` edge function with POST `{ user_id }` + a live user JWT (Bearer session.access_token). Cannot be called from bash — needs a real user session. Scores all 18 archetypes from dna_taxonomy.ts and picks best fit.

**18 archetype keys (from dna-taxonomy.ts):**
social_watcher, emotional_binger, binge_machine, completionist, taste_curator, genre_specialist,
nostalgia_dweller, prediction_oracle, lore_hunter, contrarian_voice, prestige_chaser,
comfort_rewatcher, trivia_titan, cinephile, bookworm, soundtrack_driven, discovery_engine, chaos_viewer

**Where core_archetype is consumed:**
- `useDnaArchetype` hook (client/src/hooks/use-dna-archetype.ts) — reads dna_profiles.core_archetype
- `identity-feedback.ts` getGameAlignment / getMediaAlignment / getIdentityFeedback
- `trivia-carousel.tsx` — italic alignment line under "One question trivia"
- `media-detail.tsx` — alignment line below metadata chips
- `user-profile.tsx` — archetype chip + alignment line in DNA tab
- `identity.tsx` — full archetype config drives Current Era section

**Why:** Phase 5-6 DNA identity system shows personalized copy only when this column is non-null. All users start null — the column only populates when generate-dna-profile-v2 runs.
