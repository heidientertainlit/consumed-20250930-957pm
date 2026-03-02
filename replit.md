# Consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform transforming entertainment consumption into an interactive, game-like experience. It enables users to "play" with entertainment through ranking, voting, predicting, and testing knowledge, fostering engagement and social comparison. The platform aims to shift users from passive consumption to active participation, making them feel part of the entertainment they love, with personalization driven by background tracking.

## User Preferences
Preferred communication style: Simple, everyday language.
- When user asks "give me the code to push to git", provide `git push origin main` command. User deploys from their own git repo.

### CRITICAL Rules
- **NEVER PUBLISH / DEPLOY the app.** User handles deployment themselves. Do not suggest or trigger publishing under any circumstances.
- **NEVER add, seed, or modify data in Supabase without explicit user approval first.** Always double-check with the user before inserting, updating, or seeding any content (trivia, polls, predictions, etc.) to the production database.
- All content data comes from user's spreadsheets - do not create fake/placeholder content.

## System Architecture

### UI/UX Decisions
- Mobile-first design with a dark gradient theme.
- Bottom Navigation: Activity, Me, Library, Leaders (+ floating center Plus button → /add). DNA removed from nav; replaced with "Me" (profile link).
- Top Navigation: Search (🔍), Notifications, Profile.
- Profile Section Navigation: Sticky pills for Friends, DNA, Media History (own profile); Overview, DNA (friend profiles). DNA tab on own profile has "My DNA" and "Compare" sub-tabs.
- Component Library: shadcn/ui (Radix UI, Tailwind CSS).
- Button Theme: Default purple (`bg-purple-600`) with white text; outline buttons have purple border and white background. No black buttons.
- Composer: Simplified inline with quick action buttons and dynamic forms.
- **Game Components Distinction**:
  - **The Daily Call** (`DailyChallengeCard`): Purple card at top of feed. Single featured daily game that expands when tapped. Uses command language ("PLAY NOW"), has urgency signal ("LIVE" badge). Whole card is tap target.
  - **Quick Trivia** (`TriviaCarousel`): Dark purple carousel below. Contains 62+ trivia questions users can swipe through.
  - These are SEPARATE components and must remain distinct.
- **Track Page Design**: User loves the Track page design with blue gradient "Track Media" and purple gradient "Import History" buttons, stats cards showing Items Logged and Points Earned. This page is kept as a backpage (accessible via direct URL `/track`) but removed from bottom navigation. Features can be integrated into other areas of the app.
- **Hot Takes Feature**: Replaced "Conversations" with "Hot Takes" - a gamified opinion-sharing feature using an upvoting system and special 🔥 branding.
- **Add Nav Icon - Previous Design (library stack)**: Custom SVG icon code: `<svg width="24" height="22" viewBox="0 0 24 22" fill="none"><line x1="2" y1="7" x2="22" y2="2" stroke="white" strokeWidth="2.5" strokeLinecap="round" /><line x1="1" y1="13" x2="23" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" /><line x1="1" y1="19" x2="23" y2="19" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>` with `<Plus size={14} strokeWidth={2.5} />` above it.
- **Navigation**: Bottom navigation includes 4 items: Activity, DNA, Library, and Leaders. The floating Plus button in the center ALWAYS links to `/add`. Play page combines game tiles (Predictions, Polls, Trivia, Leaderboard) with embedded leaderboard content. Collections page at `/collections` has 3 tabs: Lists, Ranks, and History. Leaderboard, Discover, and Track pages exist as backpages. Creator profile at `/creator-profile` shows Follow/Inner Circle buttons and external links.
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
- DNA Moments: Quick binary questions in the feed that build Entertainment DNA. Data stored in `dna_moments` and `dna_moment_responses` tables. Edge functions: `get-dna-moment`, `answer-dna-moment`.
- **Daily Call System**: Featured daily game driving engagement.
  - **Content**: `prediction_pools` table where `featured_date` = today's date.
  - **Responses**: `user_predictions` table.
  - **Streak Tracking**: `login_streaks` table.
  - **Edge Function**: `daily-challenge` with actions: `getToday`, `checkResponse`, `submit`.
  - **Client sends `localDate`**: Format `new Date().toLocaleDateString('en-CA')` for timezone.
  - **DO NOT use or create `daily_runs` table**.
- **Pools System**: Group prediction/trivia competitions.
  - Tables: `pools`, `pool_members`, `pool_prompts`, `pool_answers`.
  - Edge functions: `create-pool`, `join-pool`, `add-pool-prompt`, `submit-pool-answer`, `resolve-pool-prompt`, `get-pool-details`, `get-pool-leaderboard`, `get-user-pools`.
  - Routes: `/pools`, `/pool/:id`, `/pool/join/:code`.

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

### System Design Choices
- Database Schema: Strict naming conventions, synced dev/prod.
- Row Level Security (RLS): Strict RLS for data privacy.
- Edge Functions: Adhere to schema, handle user auto-creation, accept `user_id`.
- Privacy Toggle System: Controls list visibility.
- **Media Data Requirements**: `image_url` (full HTTPS URL), `external_id`, `external_source`, `title` are REQUIRED for all media. Edge functions must capture `image_url` and convert relative TMDB paths.
- **Media Search Display Requirements**: `media-search` edge function MUST return `poster_url`, `image`, `creator`, `title`, `type`, `year`, `external_id`, `external_source`.
- **Social Feed Architecture**:
    - Feed fetch limit: `limit = 50;` in `fetchSocialFeed` function (`client/src/pages/feed.tsx`). Never lower this.
    - Infinite scroll: Implemented via `IntersectionObserver` on `loadMoreRef` div. No hard cap on total posts.
    - UGC post rendering pipeline: Filters `socialPosts` into `ugcSlots`, deduplicates/groups into `standaloneUGCPosts`, assigns to `slotAssignments`. `renderPostBatchByIndex(N)` renders items interleaved with other cards.
    - Two rendering paths in `feed.tsx`: `renderPostBatchByIndex` (top of feed, interleaved) and `feedData.map()` (bottom of feed, social posts section). These must remain separated.
    - `_rawPost` pattern: `ugcSlots` attaches the full original `SocialPost` as `_rawPost` for `renderFeedItem`.
    - `feedData.map()` MUST skip `cast_approved` and `prediction`/`predict` when `selectedFilter !== 'predictions'`.
    - Feed refresh: Use `setTimeout(() => queryClient.refetchQueries({ queryKey: ['social-feed'] }), 800)` after posting.
    - Dedup exemption: `predict`, `prediction`, `poll`, and `cast_approved` are EXEMPT from dedup in `standaloneUGCPosts`. They use key `exempt-${postId}` so they never compete with thoughts/reviews about the same media. Removing this exemption silently erases thoughts when a prediction exists for the same media.
    - `rate-review` type: social-feed returns `type: 'rate-review'` for review posts. ugcSlots filter and map must check for this explicitly alongside `'review'`. Do not remove this check.

## External Dependencies

-   **Database & Backend**: Supabase (PostgreSQL + Edge Functions)
-   **External APIs**:
    -   Spotify
    -   TMDB
    -   YouTube
    -   Open Library
    -   OpenAI (GPT-4o)
-   **Frontend Libraries**:
    -   `@supabase/supabase-js`
    -   `@tanstack/react-query`
    -   `@radix-ui/*`
    -   `wouter`
    -   `tailwindcss`