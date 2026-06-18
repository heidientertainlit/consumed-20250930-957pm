# Consumed — Behavioral Signal (DNA Signals) Architecture

> Moved out of `replit.md` to keep it lean. This is the CANONICAL reference for the behavioral signal system. **DO NOT re-invent it.**
>
> **RULE**: Never guess about schema or data. Query the hosted Supabase project first via the Management API (see `replit.md` → "Database — CRITICAL").

---

## ⚠️ Behavioral Signal Architecture — CANONICAL (DO NOT re-invent)

- **`user_dna_signals` table** is the single source of truth for aggregated per-user behavioral signals. Schema: `id, user_id, signal_type, signal_value, strength (0–1), source_count, sources (jsonb), last_signal_at, updated_at`.
- **`signal_type` values in use:** `media_type` (tv/movie/book/music/podcast/game), `genre` (TMDB genre names), `creator` (creator names), `show` (specific show/franchise engagement), `engagement` (aggregate participation rows).
- **`signal_type = 'engagement'` rows** are aggregate participation counters — NOT taste signals. `signal_value` is one of: `trivia_attempts`, `trivia_correct`, `poll_votes`, `ratings_given`, `items_tracked`, `dna_moments`. `source_count` is the raw event count. These are the export layer for partner/participation insights.
- **`sources` JSONB column** tracks breakdown per signal: `{ tracked: N, rated: N, rated_high: N, trivia_attempts: N, trivia_correct: N, polls: N, moments: N }`. This shows WHAT drove each signal. Example: a user's `media_type: tv` signal with `sources: { tracked: 12, rated_high: 8, trivia_correct: 15 }` means they tracked 12 TV shows, rated 8 highly, and correctly answered 15 TV trivia questions.
- **`extract-dna-signals` edge function** (`supabase/functions/extract-dna-signals/index.ts`) rebuilds ALL signals for a user from scratch (delete + insert). Sources and weights:
    - `list_items` (tracked media): weight 1.0
    - `media_ratings` ≥ 4★: weight 1.5 — strongest taste signal
    - `user_predictions` trivia correct: weight 1.4
    - `user_predictions` trivia attempt: weight 1.0
    - `user_predictions` poll vote: weight 0.9
    - `dna_moment_responses`: weight 0.8
    - Also runs TMDB genre API lookup for first 20 tracked movies/TV items
- **Call `extract-dna-signals` whenever:** a user rates media, answers trivia, votes on a poll, or you want DNA signals to be fresh. Call it with `POST { user_id }` + service-role key from another edge function, or with a user JWT from the client.
- **`rebuild-recommendations` edge function** reads `user_dna_signals` (behavioral signals + engagement profile) alongside DNA profile, ratings, consumption history, followed creators, and social posts. It feeds all of this into GPT-4o to produce 8–10 personalized recommendations cached in `user_recommendations`.
- **`user_interest_signals` does NOT exist as a DB table** — it was referenced in old code but never created. All signal queries must use `user_dna_signals`.
- **Export / partner insight queries** — to understand cross-user behavior and participation, query `user_dna_signals` directly:
    ```sql
    -- Who engages with TV content most (by trivia + tracking + ratings)?
    SELECT user_id, signal_value, strength, sources
    FROM user_dna_signals
    WHERE signal_type = 'media_type' AND signal_value = 'tv'
    ORDER BY strength DESC;

    -- Participation summary across all users
    SELECT signal_value, AVG(source_count) as avg, MAX(source_count) as top
    FROM user_dna_signals WHERE signal_type = 'engagement'
    GROUP BY signal_value ORDER BY signal_value;
    ```
- **To extend the signal system:** add new sources in `extract-dna-signals/index.ts`. Follow the existing pattern — fetch data, loop through events, call `touch(type, value)`, add weight to `weightedCount`, increment the correct `sources` sub-key. Re-deploy the function. No schema changes needed.
