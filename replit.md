# Consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform designed to transform entertainment consumption into an interactive, game-like experience. It encourages active engagement through ranking, voting, predicting, and knowledge testing, moving users from passive consumption to active participation. The platform aims to foster engagement, social comparison, and personalization, envisioning significant market potential by creating a dynamic and engaging space for entertainment enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.
- **No emojis in UI design.** Never use emojis as design elements anywhere in the app — use icons (lucide-react) instead. Only exception: user expressly asks for an emoji.
- When user asks "give me the code to push to git", provide `git push origin main` command. User deploys from their own git repo.

### 📁 Reference Docs (detailed notes moved out of this file — always check here)
To keep this README scannable, the long deep-dive notes were moved into `docs/`. **Nothing was deleted — each topic now lives in its own file:**
- **`docs/data-reference.md`** — live DB row counts, full column lists, dead tables, key joins, export map.
- **`docs/trivia-points-architecture.md`** — trivia & points system, canonical sources for user stats / leaderboard / streak / DNA profile, room trivia media-type rule.
- **`docs/dna-signals-architecture.md`** — behavioral signal system (`user_dna_signals`), `extract-dna-signals` weights, export queries.
- **`docs/dna-clash-pools.md`** — DNA Clash pool rules (real ratings only).
- **`docs/feed-architecture.md`** — social feed pipeline, promoted-card-first order, shared QuickActionSheet, cosmetic feed redesign plan.
- **`docs/persona-content-generation.md`** — bot persona content generation.

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
- **⚠️ DNA Clash pools — REAL RATINGS ONLY, NO EXCEPTIONS.** Clash pools (`prediction_pools` `type='clash'`) MUST use ratings verified to exist in `media_ratings`; never invent ratings, quotes, DNA labels, or display names. **Full rules → `docs/dna-clash-pools.md`.**
- **Canonical sources for user stats, leaderboard & trivia data — ALWAYS use the documented edge functions/queries, never invent queries to helper tables.** Covers trivia rank/leaderboard, user stats, streak, DNA profile, social feed. **Full reference → `docs/trivia-points-architecture.md`.**
- **⚠️ Trivia & Points System — canonical architecture (DO NOT invent a new system).** Questions in `prediction_pools`, answers in `user_predictions`, lifetime total via `increment_trivia_points` (NEVER the broken `increment_user_points`), dedup, dead/orphan tables, room media-type rule. **Full reference → `docs/trivia-points-architecture.md`.**
- **⚠️ Feed promoted-card-first order & shared QuickActionSheet — DO NOT change without explicit user permission.** The first feed slot is intentionally the first promoted rating card; `quick-action-sheet.tsx` is shared between the nav "+" and room composers. **Full rules → `docs/feed-architecture.md`.**

### Feed UI Redesign Plan (COSMETIC ONLY)
In-progress cosmetic-only feed redesign steps (no functional changes allowed) → **`docs/feed-architecture.md`**.

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
- **Social Feed Architecture** — fetch limit, dedup-exempt types, feed mix (`feedPlaySlots` + promoted/binge cards). **Full reference → `docs/feed-architecture.md`.**
- **⚠️ Behavioral Signal Architecture — CANONICAL (DO NOT re-invent).** `user_dna_signals` is the single source of truth; `extract-dna-signals` rebuilds signals with documented weights; `user_interest_signals` does NOT exist. **Full reference → `docs/dna-signals-architecture.md`.**

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