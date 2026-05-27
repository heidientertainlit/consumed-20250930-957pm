---
name: Identity page architecture
description: /identity is the new DNA/profile overhaul page built as a parallel route, leaving /me untouched.
---

**Route:** `/identity` — ProtectedRoute, imports `IdentityPage` from `@/pages/identity.tsx`

**Structure:**
- Dark purple gradient hero (profile, archetype, tagline, rep pills, streak, points progress)
- Three tabs: My DNA | Friends | All Media
- My DNA: Current Era → What's Shaping → Evolution Timeline → Reputation → Taste Signals → Refine Your DNA
- Friends: Compare DNA → Circle's Vibe → Shared Universes → Find Your People
- All Media: media-type filter pills + status filters + recently added carousel + lists grid

**Data sources (all from Supabase client, not edge functions):**
- `users` table: user_name, avatar
- `dna_profiles`: label, tagline, core_archetype, flavor_notes, favorite_genres, current_era, evolution_note
- `user_points`: trivia_points, all_time, movies_watched, tv_shows_watched, books_read
- `login_streaks`: current_streak
- `user_dna_signals`: signal_type, signal_value, strength, source_count (for shaping + taste signals)
- `user_reputation_titles`: title_key, tier, score, progress_pct (empty for most users currently)
- `dna_snapshots`: snapshot_month, core_archetype, current_era, evolution_note (empty until monthly job runs)
- `list_items`: title, media_type, image_url, created_at (lazy-loaded on All Media tab)
- `lists`: title, media_type, is_pinned, is_default (lazy-loaded on All Media tab)
- `friendships` + `users`: lazy-loaded on Friends tab

**Key helpers in the file:**
- `ARCHETYPE_CONFIG` — era title, description, icon, color per archetype key
- `REPUTATION_LABELS` — label, icon, description per title_key
- `getDnaInfluenceLabel(mediaType, signals)` — maps media type + signal strength to DNA influence tag

**Why separate page:** User wants to validate design before replacing /me. Swap when ready by updating nav links.
