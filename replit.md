# Consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform designed to transform entertainment consumption into an interactive, game-like experience. It encourages active engagement through ranking, voting, predicting, and knowledge testing, moving users from passive consumption to active participation. The platform aims to foster engagement, social comparison, and personalization, envisioning significant market potential by creating a dynamic and engaging space for entertainment enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.
- When user asks "give me the code to push to git", provide `git push origin main` command. User deploys from their own git repo.

### Edge Function Deployment
- **Deploy command** (from Replit — must use `--use-api` flag to avoid Docker DNS issues):
  ```
  npx supabase functions deploy <function-name> --project-ref mahpgcogwpawvviapqza --use-api
  ```
- Use a temporary console workflow to run this command — workflows have access to `SUPABASE_ACCESS_TOKEN` (the bash tool does not).
- The `SUPABASE_ACCESS_TOKEN` is a **personal access token** from supabase.com → Account → Access Tokens (not a project API key).

### CRITICAL Rules
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
- **Canonical source for user stats, leaderboard, and trivia data — ALWAYS use the edge functions, never invent queries to helper tables:**
  - **Trivia rank / percentile / leaderboard** → `GET /functions/v1/get-leaderboards?category=trivia&scope=global` (auth: `Bearer session.access_token`). Response: `{ categories: { trivia: [{ user_id, rank, score, ... }] } }`. Find the current user by `user_id`. Do NOT query `trivia_user_points` directly — it is a sparse cache table that is mostly empty and will return null for most users. The leaderboard function computes trivia rank from `user_predictions` + `prediction_pools` (type=trivia) as its fallback, which is the real source of truth.
  - **User stats (posts, predictions, streak, consumption)** → `GET /functions/v1/get-user-stats?user_id={id}` (auth: Bearer token). Returns `{ stats: { moviesWatched, tvShowsWatched, booksRead, gamesPlayed, ... } }`.
  - **Daily streak** → direct Supabase query: `login_streaks` table, column `current_streak`, filtered by `user_id`.
  - **DNA profile / archetype / genres** → direct Supabase query: `dna_profiles` table, columns `label`, `tagline`, `favorite_genres` (JSON array), `flavor_notes`.
  - **Social feed** → `GET /functions/v1/social-feed` (edge function, not a direct DB query).
- **Room trivia/poll media type requirement**: When building or inserting trivia/polls for any room, always ensure `media_external_source`, `category`, and/or `show_tag` are set on the `prediction_pools` record so the `MediaTypePill` component (in pool-detail.tsx) can display the correct media type (TV / Movie / Music / Book). Do not insert records where all three fields are blank — the pill will fall back to "TV" as a default, which may be incorrect.
- **⚠️ QuickActionSheet is shared — changes affect BOTH the global nav "+" button AND the room "Write something..." button.** The `useEffect` at the top of `quick-action-sheet.tsx` controls which flow opens based on props (`roomId`, `preselectedMedia`). Room discussion MUST open `intent: "capture"` / `action: "track"` (Add Media flow). NEVER change this to `intent: "say"` / `action: "post"` for room mode — that breaks the room discussion and shows the wrong composer. Any edit to this file must be tested in both contexts.

### Feed UI Redesign Plan (COSMETIC ONLY — no functional changes)
All changes are styling/layout only. No voting logic, point systems, interaction handlers, or data pipelines may change.
**Next steps (in order):**
1. **Individual post cards** (reviews, ratings, thoughts) — tighten to compact card shell with type pill in top-right, subtle bottom bar with likes/comments.
2. **Trivia/poll cards** — same card shell, keep all answer options + voting logic untouched, only tighten wrapper styling.

## System Architecture

### UI/UX Decisions
- Mobile-first design with a dark gradient theme using shadcn/ui (Radix UI, Tailwind CSS).
- Persistent bottom navigation: Activity, Play, Library, Leaders, with a floating center Plus button for content addition.
- Top navigation: Search, Notifications, Profile.
- Profile section navigation: Sticky pills for Friends, DNA, Media History (own profile); Overview, DNA (friend profiles). DNA tab includes "My DNA" and "Compare" sub-tabs.
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