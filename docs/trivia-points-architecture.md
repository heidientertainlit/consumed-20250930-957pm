# Consumed — Trivia, Points & Canonical Data Sources

> Moved out of `replit.md` to keep it lean. This is the authoritative reference for the trivia/points system and the canonical sources for user stats, leaderboard, and trivia data.
>
> **RULE**: Never guess about schema or data. Query the hosted Supabase project first via the Management API (see `replit.md` → "Database — CRITICAL").

---

## Canonical source for user stats, leaderboard, and trivia data — ALWAYS use the edge functions, never invent queries to helper tables

- **Trivia rank / percentile / leaderboard** → `GET /functions/v1/get-leaderboards?category=trivia&scope=global` (auth: `Bearer session.access_token`). Response: `{ categories: { trivia: [{ user_id, rank, score, ... }] } }`. Find the current user by `user_id`. The real source of truth is `user_predictions` JOIN `prediction_pools` WHERE type='trivia', summing `points_earned` per user. **`trivia_user_points` is an empty orphan table with zero rows and no triggers — it has never been populated and should be dropped (`DROP TABLE IF EXISTS trivia_user_points`). Never query it.**
- **User stats (posts, predictions, streak, consumption)** → `GET /functions/v1/get-user-stats?user_id={id}` (auth: Bearer token). Returns `{ stats: { moviesWatched, tvShowsWatched, booksRead, gamesPlayed, ... } }`.
- **Daily streak** → direct Supabase query: `login_streaks` table, column `current_streak`, filtered by `user_id`.
- **DNA profile / archetype / genres** → direct Supabase query: `dna_profiles` table, columns `label`, `tagline`, `favorite_genres` (JSON array), `flavor_notes`.
- **Social feed** → `GET /functions/v1/social-feed` (edge function, not a direct DB query).

---

## ⚠️ Trivia & Points System — canonical architecture (DO NOT invent a new system)

- **Questions live in `prediction_pools`** (`type = 'trivia'`, `status = 'open'`). Each pool is one question (or a multi-question pack via the `options` array of question objects). 51 pools exist as of May 2026.
- **Every answer is permanently recorded in `user_predictions`** — one row per user per pool_id, with `prediction` (what they picked) and `points_earned` (10 if correct, 0 if wrong). This is the single source of truth for: (1) deduplication — carousel filters out pools where user already has a row; (2) leaderboard — `get-leaderboards` sums `points_earned` per user for trivia pools; (3) DNA signals — category/correct-answer derivable via JOIN to `prediction_pools`.
- **`user_points.trivia_points`** is a running lifetime total, incremented by the `increment_trivia_points(uid uuid, pts integer)` DB function. This is used for profile/stats display. It is NOT used for leaderboard ranking (leaderboard reads `user_predictions` directly).
- **`increment_trivia_points`** is the ONLY correct function to call when awarding trivia points. Call it from client code and edge functions after a correct answer. Never use `increment_user_points` for trivia — that RPC updates a non-existent `total_points` column and silently fails.
- **`increment_user_points` RPC is broken** — it references `user_points.total_points` which does not exist as a column. It silently fails everywhere it is called. Do NOT use it for any new point-awarding code. Leaderboards for polls and predictions read directly from `user_predictions.points_earned` and `bets.points_awarded` respectively — no additional RPC is needed for those.
- **Dead/orphan tables — NEVER query or write to these:** `trivia_user_points` (0 rows, no triggers), `trivia_results` (0 rows), `trivia_sessions` (0 rows), `trivia_answers` (0 rows). These are remnants of an old system that was replaced. The `user_points.trivia_points` values from before April 14 2026 were seeded/manually set, not earned answer-by-answer.
- **Deduplication**: Trivia carousel (`trivia-carousel.tsx`) and polls carousel (`polls-carousel.tsx`) both query `user_predictions` for the user's existing pool_ids and filter them out before rendering. Every answer submitted creates a permanent record, so users never see a repeated question. This is fully automatic — no separate dedup table or flag needed.
- **Daily featured protection**: Both carousels filter out pools where `featured_date = today` using `.or('featured_date.is.null,featured_date.lt.YYYY-MM-DD')`. Today's featured question is exclusive to the Daily Hero section; it falls into the carousel automatically the next day for anyone who skipped it.
- **`user_points` columns** (for reference): `id, user_id, reviews_written, ratings_given, books_read, tv_shows_watched, movies_watched, predictions_right, trivia_points, login_streak, app_engagement, all_time, last_updated, joined_app`. There is NO `total_points` column. `all_time` is auto-calculated by the `trigger_update_all_time` trigger on every UPDATE.

---

## Room trivia/poll media type requirement

When building or inserting trivia/polls for any room, always ensure `media_external_source`, `category`, and/or `show_tag` are set on the `prediction_pools` record so the `MediaTypePill` component (in pool-detail.tsx) can display the correct media type (TV / Movie / Music / Book). Do not insert records where all three fields are blank — the pill will fall back to "TV" as a default, which may be incorrect.
