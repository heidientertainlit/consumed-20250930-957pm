# Consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform designed to transform entertainment consumption into an interactive, game-like experience. It encourages active engagement through ranking, voting, predicting, and knowledge testing, moving users from passive consumption to active participation. The platform aims to foster engagement, social comparison, and personalization, envisioning significant market potential by creating a dynamic and engaging space for entertainment enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.
- When user asks "give me the code to push to git", provide `git push origin main` command. User deploys from their own git repo.

### Database — CRITICAL
- **The app uses the HOSTED Supabase project (`mahpgcogwpawvviapqza`) as its database — NOT the local Replit PostgreSQL.**
- The local Replit DB (accessible via `DATABASE_URL` / `executeSql` tool) is a separate, unused database. **Never run schema changes, inserts, or queries there** — they will have no effect on the live app.
- To run SQL against the real database, always use the Supabase Management API via bash:
  ```bash
  curl -s -X POST "https://api.supabase.com/v1/projects/mahpgcogwpawvviapqza/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query": "YOUR SQL HERE"}'
  ```
- `SUPABASE_ACCESS_TOKEN` is available in bash and works for this. Never use `executeSql` or `npm run db:push` for production schema work.

### Edge Function Deployment
- **Deploy command** (from Replit — must use `--use-api` flag to avoid Docker DNS issues):
  ```
  npx supabase functions deploy <function-name> --project-ref mahpgcogwpawvviapqza --use-api
  ```
- Run this directly from the **bash tool** — `SUPABASE_ACCESS_TOKEN` IS accessible in bash (contrary to old notes).
- The `SUPABASE_ACCESS_TOKEN` is a **personal access token** from supabase.com → Account → Access Tokens (not a project API key).

### CRITICAL Rules
- **NEVER guess about database schema, table contents, or what data exists. Always query first.** Before making any claim about what a table contains, which columns exist, or whether data is present — run a real SQL query via the Supabase Management API. The canonical data reference is at `docs/data-reference.md` (live row counts, full column lists, dead tables, key joins, export map). If something in that doc might be stale, query to verify before proceeding.
- **ONLY fix what the user explicitly asks for.** If you notice something else that looks wrong while working, say so in your reply and ask before touching it. Do NOT silently fix, refactor, or "improve" anything that wasn't part of the request. This applies to all code, data, edge functions, and configuration.
- **NEVER remove or fundamentally change existing functionality without explicit user approval.** This includes removing fallbacks, changing core logic, or altering behavior that was previously working. If you think something should be removed or changed significantly, explain why and ask first.
- **NEVER PUBLISH / DEPLOY the app.** User handles deployment themselves. Do not suggest or trigger publishing under any circumstances.
- **Security vulnerability notifications — always query first.** Before writing any RLS fix SQL, run these two queries in the Supabase SQL Editor to get the real schema and existing policies. NEVER guess which tables exist or what policies are already in place:
  ```sql
  -- Which tables have RLS disabled?
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false ORDER BY tablename;
  -- What policies already exist?
  SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
  ```
  Only write the fix SQL after reviewing the actual results. `supabase_rls_fix.sql` in the project root is kept as the canonical fix file.
- **NEVER add, seed, or modify data in Supabase without explicit user approval first.** Always double-check with the user before inserting, updating, or seeding any content (trivia, polls, predictions, etc.) to the production database.
- All content data comes from user's spreadsheets - do not create fake/placeholder content.
- **⚠️ DNA Clash pools — REAL RATINGS ONLY, NO EXCEPTIONS.** `prediction_pools` rows with `type='clash'` MUST use ratings that are verified to exist in `media_ratings`. Before creating or updating any clash pool: (1) query `media_ratings` to confirm both users have actually rated the media title, (2) confirm the rating values match exactly what is in `media_ratings`. NEVER manually type in a star rating. NEVER invent a quote, DNA label, or display name. DNA labels come from `dna_profiles.label`. Display names come from `users.display_name`. The `options` JSON must store `posterUrl` on the first option object (no `poster_url` column exists on `prediction_pools`). The feed card reads `o1.posterUrl || o2.posterUrl`. There is NO hardcoded fallback array in `feed.tsx` — if `clashPools` is empty the card simply doesn't render.
- **Canonical source for user stats, leaderboard, and trivia data — ALWAYS use the edge functions, never invent queries to helper tables:**
  - **Trivia rank / percentile / leaderboard** → `GET /functions/v1/get-leaderboards?category=trivia&scope=global` (auth: `Bearer session.access_token`). Response: `{ categories: { trivia: [{ user_id, rank, score, ... }] } }`. Find the current user by `user_id`. The real source of truth is `user_predictions` JOIN `prediction_pools` WHERE type='trivia', summing `points_earned` per user. **`trivia_user_points` is an empty orphan table with zero rows and no triggers — it has never been populated and should be dropped (`DROP TABLE IF EXISTS trivia_user_points`). Never query it.**
  - **User stats (posts, predictions, streak, consumption)** → `GET /functions/v1/get-user-stats?user_id={id}` (auth: Bearer token). Returns `{ stats: { moviesWatched, tvShowsWatched, booksRead, gamesPlayed, ... } }`.
  - **Daily streak** → direct Supabase query: `login_streaks` table, column `current_streak`, filtered by `user_id`.
  - **DNA profile / archetype / genres** → direct Supabase query: `dna_profiles` table, columns `label`, `tagline`, `favorite_genres` (JSON array), `flavor_notes`.
  - **Social feed** → `GET /functions/v1/social-feed` (edge function, not a direct DB query).
- **⚠️ Trivia & Points System — canonical architecture (DO NOT invent a new system):**
  - **Questions live in `prediction_pools`** (`type = 'trivia'`, `status = 'open'`). Each pool is one question (or a multi-question pack via the `options` array of question objects). 51 pools exist as of May 2026.
  - **Every answer is permanently recorded in `user_predictions`** — one row per user per pool_id, with `prediction` (what they picked) and `points_earned` (10 if correct, 0 if wrong). This is the single source of truth for: (1) deduplication — carousel filters out pools where user already has a row; (2) leaderboard — `get-leaderboards` sums `points_earned` per user for trivia pools; (3) DNA signals — category/correct-answer derivable via JOIN to `prediction_pools`.
  - **`user_points.trivia_points`** is a running lifetime total, incremented by the `increment_trivia_points(uid uuid, pts integer)` DB function. This is used for profile/stats display. It is NOT used for leaderboard ranking (leaderboard reads `user_predictions` directly).
  - **`increment_trivia_points`** is the ONLY correct function to call when awarding trivia points. Call it from client code and edge functions after a correct answer. Never use `increment_user_points` for trivia — that RPC updates a non-existent `total_points` column and silently fails.
  - **`increment_user_points` RPC is broken** — it references `user_points.total_points` which does not exist as a column. It silently fails everywhere it is called. Do NOT use it for any new point-awarding code. Leaderboards for polls and predictions read directly from `user_predictions.points_earned` and `bets.points_awarded` respectively — no additional RPC is needed for those.
  - **Dead/orphan tables — NEVER query or write to these:** `trivia_user_points` (0 rows, no triggers), `trivia_results` (0 rows), `trivia_sessions` (0 rows), `trivia_answers` (0 rows). These are remnants of an old system that was replaced. The `user_points.trivia_points` values from before April 14 2026 were seeded/manually set, not earned answer-by-answer.
  - **Deduplication**: Trivia carousel (`trivia-carousel.tsx`) and polls carousel (`polls-carousel.tsx`) both query `user_predictions` for the user's existing pool_ids and filter them out before rendering. Every answer submitted creates a permanent record, so users never see a repeated question. This is fully automatic — no separate dedup table or flag needed.
  - **Daily featured protection**: Both carousels filter out pools where `featured_date = today` using `.or('featured_date.is.null,featured_date.lt.YYYY-MM-DD')`. Today's featured question is exclusive to the Daily Hero section; it falls into the carousel automatically the next day for anyone who skipped it.
  - **`user_points` columns** (for reference): `id, user_id, reviews_written, ratings_given, books_read, tv_shows_watched, movies_watched, predictions_right, trivia_points, login_streak, app_engagement, all_time, last_updated, joined_app`. There is NO `total_points` column. `all_time` is auto-calculated by the `trigger_update_all_time` trigger on every UPDATE.
- **Room trivia/poll media type requirement**: When building or inserting trivia/polls for any room, always ensure `media_external_source`, `category`, and/or `show_tag` are set on the `prediction_pools` record so the `MediaTypePill` component (in pool-detail.tsx) can display the correct media type (TV / Movie / Music / Book). Do not insert records where all three fields are blank — the pill will fall back to "TV" as a default, which may be incorrect.
- **⚠️ Feed promoted-card-first order — DO NOT change without explicit user permission.** The first item in `mixedFeedSlots` (in `client/src/pages/feed.tsx`, the `useMemo` at ~line 3443) is intentionally the first promoted rating card (persona/high-signal post). This puts Jordan's / persona posts at the very top of the feed right after the Daily Hero section. The pattern: prepend `wrapPromoted(0)` before `feedPlaySlots.forEach`. Never remove or reorder this without asking the user first.
- **⚠️ QuickActionSheet is shared — changes affect BOTH the global nav "+" button AND the room "Write something..." button.** The `useEffect` at the top of `quick-action-sheet.tsx` controls which flow opens based on props (`roomId`, `preselectedMedia`). Room discussion MUST open `intent: "capture"` / `action: "track"` (Add Media flow). NEVER change this to `intent: "say"` / `action: "post"` for room mode — that breaks the room discussion and shows the wrong composer. Any edit to this file must be tested in both contexts.

### Feed UI Redesign Plan (COSMETIC ONLY — no functional changes)
All changes are styling/layout only. No voting logic, point systems, interaction handlers, or data pipelines may change.
**Next steps (in order):**
1. **Individual post cards** (reviews, ratings, thoughts) — tighten to compact card shell with type pill in top-right, subtle bottom bar with likes/comments.
2. **Trivia/poll cards** — same card shell, keep all answer options + voting logic untouched, only tighten wrapper styling.

## System Architecture

### UI/UX Decisions
- Mobile-first design with a dark gradient theme using shadcn/ui (Radix UI, Tailwind CSS).
- Persistent bottom navigation: Now (Activity), Play, Add (+), Rooms, Me (Profile) — five items. Library removed from nav; Library content (Lists, All My Media) lives in Profile (Me tab). Profile avatar removed from top app bar.
- Top navigation: Search, Notifications.
- Profile section navigation: Pills for Friends, DNA, Lists, All My Media (own profile); Overview, DNA (friend profiles). DNA tab includes "My DNA" and "Compare" sub-tabs.
- Default button theme: Purple background with white text; outline buttons have a purple border and white background.
- Composer: Simplified inline with quick action buttons and dynamic forms.
- **Game Components**:
    - **Daily Hero Section**: Two side-by-side cards at the top of the feed for "Today's Play" (3-question trivia) and "Daily Call" (daily prediction).
    - **The Daily Call**: Original card for blended-feed and other usages.
    - **Quick Trivia**: A dark purple carousel below the Daily Call featuring multiple trivia questions.
- **Rooms**: Feature controlled by `rooms_enabled` flag in `app_settings` Supabase table. Admin user (`HeidiIsConsumed`) always sees Rooms. Toggling the flag enables/disables Rooms for all other users without a code deploy.
- **Navigation**: Bottom navigation includes Activity, DNA, Library, and Leaders. Floating Plus button links to `/add`. Play page combines game tiles with embedded leaderboard content. Collections page at `/collections` has Lists, Ranks, and History tabs.
- **Play > Pools**: `/play/pools` is a dark-themed browse page for public pools.
- **Profile Page Organization**: Includes sticky section navigation pills (Stats, DNA, Friends, Collections, History).
- **Collections System**: Collections tab has sub-navigation for Lists and Ranks. Ranks support drag-and-drop ordering and collaboration.
- **Search Page**: AI-powered unified search at `/search` for Conversations, AI Recommendations, and Media Results.

### Technical Implementations
- Frontend: React 18, TypeScript, Wouter, TanStack Query, Vite.
- Backend: Supabase Edge Functions (Deno runtime).
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Unified API Search: Integrates Spotify, TMDB, YouTube, Open Library via Edge Functions.
- Netflix Import Fix: Uses TMDB API for media detection with rate limiting and caching.
- Real-time unified Notification System.
- Engagement-focused Leaderboard System with 5 categories.
- Unified Voting System for polls, predictions, and trivia.
- Comprehensive User Points System.
- Smart Recommendations: GPT-4o powered with caching.
- Creator Follow System.
- Spoiler Protection: Blurs content until revealed.
- Consumed vs User-Generated Content: Differentiated by a "🏆 Consumed" badge.
- Prediction Resolution: Supports timed/open-ended predictions with scoring.
- AI Builder (`/library-ai`): Customization of lists and tracking via visual builder and AI chat.
- DNA Levels System: Two-tier "Entertainment DNA" with friend comparison.
- DNA Moments: Quick binary questions in the feed that build Entertainment DNA.
- Game Moment Activity Posts: Auto-creation of social posts when users interact with games.
- **Daily Call System**: Featured daily game. Content from `prediction_pools` (featured today), user responses in `user_predictions`, and streak tracking in `login_streaks`.
- **Bot Persona System**: 20 AI-powered persona users (`is_persona = true`) that post entertainment content via Claude-driven admin workflow.
- **Challenge Pools Admin** (`/admin/pools`): Admin tool to create trivia pools for any show/franchise via AI (OpenAI gpt-4o).
- **Pools System**: Structured, round-based group competition engine with host-controlled, invite-only access.
- **Room Discussion Posts**: `social_posts` table includes a `room_id` for room-scoped posts.
- **Partner Room Polls Architecture**: `prediction_pools` includes `partner_tag` to scope polls to specific rooms.

### Feature Specifications
- Friend Profile Viewing: Access to Stats, DNA, Collections.
- Media Tracking: Simplified list-based system with privacy.
- AI-Powered Search: Unified search for conversations, recommendations, and media.
- Personal System Lists: 5 default lists with privacy control.
- Custom & Collaborative Lists.
- Ranked Lists (Ranks): Ordered media rankings with drag-and-drop.
- Progress Tracking: By percent, page, episode, or track.
- Social Features: Leaderboards, activity feeds, friend discovery, "Inner Circle."
- Play Section: Category-based navigation for Trivia, Polls, Predictions.
- Profile Management: Editable display names, permanent usernames.
- @ Mention System: Tagging friends with autocomplete and notifications.
- Creator Recognition: Identifies "Favorite Creators."
- Media Item Pages: Dynamic links to consumption platforms.
- Polls/Surveys System: Real-time voting, duplicate prevention, points.
- Discover Page: AI-powered recommendations and trending content.
- Analytics Dashboard: Admin dashboard (`/admin`) for engagement, retention, activation, partnership, and behavioral analytics.
- **Admin Content Creation (PLANNED)**: Admin tool for creating trivia and polls at `/admin`. Includes AI-assisted generation and assignment of `prediction_pools` to rooms or the main feed, with `partner_tag` functionality.
- **Debate the Rank Builder** (`/admin/ranks`): Admin tool to create platform-owned (`origin_type: 'consumed'`) ranked lists. Three-step flow: Setup (title, description, category, size) → Add Items (manual entry with year field, up/down reorder + AI generate button) → Preview & Save (three options: Save Draft, Schedule, Publish Now with datetime picker). Manage tab has Published/Scheduled/Drafts sub-tabs; cards expand to show item list. Drafts can be one-click published from Manage tab. Schema: `ranks` table has `status` ('draft'|'scheduled'|'published') and `scheduled_date` columns; `rank_items` has `year` column. Engagement tracked via `rank_item_votes` (up/down per item) and `rank_comments`.

### System Design Choices
- Database Schema: Strict naming conventions and synced dev/prod environments.
- Row Level Security (RLS): Strict RLS for data privacy.
- Edge Functions: Adhere to schema, handle user auto-creation, accept `user_id`.
- Privacy Toggle System: Controls list visibility.
- **Media Data Requirements**: `image_url`, `external_id`, `external_source`, `title` are REQUIRED for all media.
- **Media Search Display Requirements**: `media-search` edge function MUST return `poster_url`, `image`, `creator`, `title`, `type`, `year`, `external_id`, `external_source`.
- **Social Feed Architecture**:
    - Feed fetch limit: `limit = 200;`.
    - Infinite scroll via `IntersectionObserver`.
    - UGC post rendering pipeline: Filters `socialPosts` into `ugcSlots`, deduplicates/groups, and assigns to `slotAssignments` for interleaved rendering.
    - `predict`, `prediction`, `poll`, and `cast_approved` types are EXEMPT from deduplication to prevent silent erasure.
    - `rate-review` type: `social-feed` returns `type: 'rate-review'` for review posts.
    - **Feed mix**: `feedPlaySlots` (game_moments + predictions) is interleaved with up to 4 `promoted_rating` items and 2 `binge_battle_promo` cards.
- **⚠️ Behavioral Signal Architecture — CANONICAL (DO NOT re-invent):**
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

## External Dependencies

-   **Database & Backend**: Supabase (PostgreSQL + Edge Functions)
-   **External APIs**:
    -   Spotify
    -   TMDB
    -   YouTube
    -   Open Library
    -   OpenAI (GPT-4o)
    -   Anthropic (Claude-3-5-sonnet)
-   **Frontend Libraries**:
    -   `@supabase/supabase-js`
    -   `@tanstack/react-query`
    -   `@radix-ui/*`
    -   `wouter`
    -   `tailwindcss`