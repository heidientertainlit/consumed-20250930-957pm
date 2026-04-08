# Consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform that transforms entertainment consumption into an interactive, game-like experience. It enables users to actively engage with entertainment through ranking, voting, predicting, and knowledge testing. The platform aims to foster engagement, social comparison, and personalization, moving users from passive consumption to active participation in the entertainment they love. The project envisions significant market potential by creating a dynamic and engaging space for entertainment enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.
- When user asks "give me the code to push to git", provide `git push origin main` command. User deploys from their own git repo.

### CRITICAL Rules
- **NEVER PUBLISH / DEPLOY the app.** User handles deployment themselves. Do not suggest or trigger publishing under any circumstances.
- **NEVER add, seed, or modify data in Supabase without explicit user approval first.** Always double-check with the user before inserting, updating, or seeding any content (trivia, polls, predictions, etc.) to the production database.
- All content data comes from user's spreadsheets - do not create fake/placeholder content.

### Feed UI Redesign Plan (COSMETIC ONLY — no functional changes)
All changes are styling/layout only. No voting logic, point systems, interaction handlers, or data pipelines may change.
**Next steps (in order):**
1. ~~Game Moments (SocialProofCard)~~ — DONE. White card, type pill top-right, italic question, 3px progress bar, gray-50 footer. Leaderboard cards → purple strip. Zero functional changes.
2. **Individual post cards** (reviews, ratings, thoughts) — tighten to compact card shell with type pill in top-right, subtle bottom bar with likes/comments.
3. **Trivia/poll cards** — same card shell, keep all answer options + voting logic untouched, only tighten wrapper styling.

**Design reference:** `attached_assets/consumed_branded_cards_*.html` and `consumed_feed_v2_*.html`
**Card shell spec:** white bg, `border: 0.5px solid border-tertiary`, `border-radius-lg`, compact 14px padding, type pill top-right, subtle off-white footer bar for actions.

## System Architecture

### UI/UX Decisions
- Mobile-first design with a dark gradient theme utilizing shadcn/ui (Radix UI, Tailwind CSS).
- Bottom Navigation: Activity, Play, Library, Leaders, with a floating center Plus button for adding content. "Play" links to `/play/predictions`.
- Top Navigation: Search, Notifications, Profile.
- Profile Section Navigation: Sticky pills for Friends, DNA, Media History (own profile); Overview, DNA (friend profiles). DNA tab includes "My DNA" and "Compare" sub-tabs.
- Button Theme: Default purple (`bg-purple-600`) with white text; outline buttons have purple border and white background.
- Composer: Simplified inline with quick action buttons and dynamic forms.
- **Game Components Distinction**:
  - **The Daily Call** (`DailyChallengeCard`): A distinct, purple card at the top of the feed for a single featured daily game.
  - **Quick Trivia** (`TriviaCarousel`): A dark purple carousel below the Daily Call, featuring multiple trivia questions.
- **Track Page Design**: Accessible via `/track`, featuring "Track Media" and "Import History" buttons, and stats cards.
- **Rooms**: Feature is hidden but fully implemented, accessible via `/rooms`.
- **Navigation**: Bottom navigation includes 4 items: Activity, DNA, Library, and Leaders. The floating Plus button always links to `/add`. Play page combines game tiles with embedded leaderboard content. Collections page at `/collections` has 3 tabs: Lists, Ranks, and History. Leaderboard, Discover, and Track pages exist as backpages. Creator profile at `/creator-profile` shows Follow/Inner Circle buttons and external links.
- **Profile Page Organization**: Profile includes sticky section navigation pills (Stats, DNA, Friends, Collections, History).
- **Collections System**: Collections tab contains sub-navigation for Lists and Ranks. Ranks feature supports drag-and-drop ordering, position-based ranking, and collaboration.
- **Search Page**: AI-powered search at `/search` with unified results showing Conversations, AI Recommendations, and Media Results. Uses custom AI icon in navigation.

### Technical Implementations
- Frontend: React 18, TypeScript, Wouter, TanStack Query, Vite.
- Backend: Supabase Edge Functions (Deno runtime).
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Unified API Search: Integration with Spotify, TMDB, YouTube, Open Library via Edge Functions.
- Netflix Import Fix: Uses TMDB API for movie/TV detection, with rate limiting and caching.
- Real-time unified Notification System.
- Engagement-focused Leaderboard System with 5 categories and 'Your Circle'/Global tabs.
- Unified Voting System for polls, predictions, and trivia.
- Comprehensive User Points System for various actions.
- Smart Recommendations: GPT-4o powered with caching.
- Creator Follow System.
- Spoiler Protection: Blurs content until revealed.
- Consumed vs User-Generated Content: Differentiates with a "🏆 Consumed" badge.
- Prediction Resolution: Supports timed/open-ended predictions with scoring.
- AI Builder (`/library-ai`): Customization of lists and tracking via visual builder and AI chat.
- DNA Levels System: Two-tier "Entertainment DNA" (survey-based) with friend comparison and unified insights.
- DNA Moments: Quick binary questions in the feed that build Entertainment DNA, stored in `dna_moments` and `dna_moment_responses` tables.
- Game Moment Activity Posts: Auto-creation of `social_posts` entries with `post_type: 'game_moment'` when users interact with games.
- **Daily Call System**: Featured daily game. Content from `prediction_pools` (where `featured_date` = today's date), user responses in `user_predictions`, and streak tracking in `login_streaks`. Managed by `daily-challenge` edge function.
- **Bot Persona System**: 20 AI-powered persona users (`is_persona = true` in `public.users`) that post authentic entertainment content via Claude-driven admin workflow. Content generation and scheduling managed through `persona_post_drafts` and `scheduled_persona_posts` tables and related edge functions. Admin hub at `/admin`.
- **Pools System**: Structured, round-based group competition engine. Architecture: Pool → Rounds → Prompts → Answers → Leaderboard. Host-controlled, invite-only. Tables: `pools`, `pool_members`, `pool_rounds`, `pool_prompts`, `pool_answers`. Several associated edge functions and routes.
- **Room Discussion Posts**: `social_posts` has a `room_id text` column (nullable). Room-scoped posts are inserted with `room_id` set to the pool's ID. Query key `['room-posts', roomId]`. Posts without `room_id` are general feed posts.
- **Partner Room Polls Architecture**: `prediction_pools` has `partner_tag text` column (e.g. `'reelz'`). Polls with `partner_tag` set are room-specific (shown only in that room's carousel via `get-pool-details` which filters by `partner_tag = pool.partner_name`). Polls with `partner_tag = null` go to the main activity feed. Main feed query uses `.is('partner_tag', null)` to exclude room polls.

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
- **Admin Content Creation (PLANNED — not yet built)**: Admin tool for creating trivia and polls at `/admin`. Key requirements:
  - **Generate + Add**: AI-assisted creation of new trivia/polls with fields for title, options, correct answer (trivia), points, category, show_tag.
  - **Add Existing**: Ability to browse and assign already-created `prediction_pools` records to a room or feed — NOT just generate new ones. Search/filter by title, category, partner_tag.
  - **Partner tag field**: When creating/assigning a poll, set `partner_tag` (e.g. `'reelz'`) to scope it to a room carousel, OR leave blank for main feed.
  - **Room assignment**: Assign polls to specific rooms by matching `partner_tag` to the room's `partner_name`.
  - All content comes from approved sources (user spreadsheets or manual creation) — no AI-generated content seeded without approval.

### System Design Choices
- Database Schema: Strict naming conventions and synced dev/prod environments.
- Row Level Security (RLS): Strict RLS for data privacy.
- Edge Functions: Adhere to schema, handle user auto-creation, accept `user_id`.
- Privacy Toggle System: Controls list visibility.
- **Media Data Requirements**: `image_url` (full HTTPS URL), `external_id`, `external_source`, `title` are REQUIRED for all media. Edge functions convert relative TMDB paths.
- **Media Search Display Requirements**: `media-search` edge function MUST return `poster_url`, `image`, `creator`, `title`, `type`, `year`, `external_id`, `external_source`.
- **Social Feed Architecture**:
    - Feed fetch limit: `limit = 200;` in `fetchSocialFeed`.
    - Infinite scroll via `IntersectionObserver`.
    - UGC post rendering pipeline: Filters `socialPosts` into `ugcSlots`, deduplicates/groups, and assigns to `slotAssignments` for interleaved rendering.
    - `predict`, `prediction`, `poll`, and `cast_approved` are EXEMPT from deduplication in `standaloneUGCPosts` to prevent silent erasure of thoughts/reviews.
    - `rate-review` type: `social-feed` returns `type: 'rate-review'` for review posts, which must be explicitly checked.

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