# consumed - Entertainment Consumption Tracking MVP

## Overview

consumed is a mobile-first entertainment consumption tracking MVP. It enables users to log their media consumption, engage in social features like leaderboards and activity feeds, discover friends and creators, and participate in trivia and prediction games. Key features include a sophisticated dark gradient theme, bottom navigation, social features with "Inner Circle" for Super Fan identification, and an "Entertainment DNA" onboarding survey. The project aims to provide a streamlined, engaging platform for users to manage and share their entertainment journey.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application employs a modern full-stack architecture with a clear separation of concerns.

### UI/UX Decisions
-   **Mobile-first design**: Optimized for mobile devices.
-   **Dark gradient theme**: Sophisticated dark theme throughout the application.
-   **Bottom navigation**: Primary navigation is via a persistent bottom bar (Feed, Track, Play, Leaderboard).
-   **Profile access**: Profile icon located in the top header.
-   **Component Library**: shadcn/ui components built with Radix UI primitives.
-   **Styling**: Tailwind CSS.
-   **Button Theme (October 15, 2025)**: All buttons default to purple (`bg-purple-600`) with white text to ensure visibility. Outline buttons use purple border with white background. No black buttons are used in the application.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for server state management, and Vite for building.
-   **Backend**: Node.js with Express.js REST API, TypeScript, ES modules.
-   **Database**: PostgreSQL with Drizzle ORM, hosted on Neon Database (serverless).
-   **API Integration**: Unified API search using Spotify (OAuth2 client credentials), TMDB, YouTube, and Open Library for media data.
-   **Authentication**: Supabase Auth for user management, including password reset functionality.
-   **User Management**: Users are auto-created in a custom `users` table upon first authentication, bridging `auth.users` and application user data.
-   **Sharing System**: Unified sharing (`/src/lib/share.ts`) for lists, media, predictions, posts, and Entertainment DNA, controlled by the `VITE_FEATURE_SHARES` environment variable for deep linking versus text blurbs.
-   **Leaderboard System**: All leaderboard categories (media-based, game-based, fan points) are handled by a single `get-leaderboards` edge function for consistency and performance.
-   **Trivia Scoring**: Points are awarded only for correct answers. Long-form trivia divides total points evenly per question (10 pts/question for 100pt game). Quick trivia awards full points for correct answer, zero for incorrect.

### Feature Specifications
-   **Media Tracking**: Simplified list-based system allowing users to track various entertainment items across personal system lists with full privacy control.
-   **Personal System Lists (UPDATED ARCHITECTURE - October 2025)**:
    -   Each user gets personal copies of 5 default lists: Currently, Queue, Finished, Did Not Finish, Favorites
    -   System lists are user-specific (user_id = user's ID) with `is_default = true` flag
    -   Full privacy control: users can toggle any list between public/private
    -   Auto-created on user signup OR auto-migrated on first access
    -   Idempotent creation with unique constraint on (user_id, title) - prevents race condition duplicates
    -   Individual backfill migration: missing system lists are added automatically
    -   Robust error handling: critical failures return HTTP 500, duplicate keys (23505) are safely ignored
-   **Custom Lists**: User-created lists for organizing media with:
    -   Nested dropdown UI in ConsumptionTracker ("Custom Lists >" submenu)
    -   Simple creation dialog (title input only, public by default)
    -   Alphabetical ordering
    -   Separate edge functions (`create-custom-list`, `add-to-custom-list`) for safety
    -   Fallback protection: system lists work even if custom lists fail
    -   `isCustom` flag for reliable endpoint routing (no UUID regex fragility)
    -   Consistent `listTitle` responses from both endpoints for success messages
    -   Custom lists have `is_default = false/null`
-   **Social Features**: Leaderboards, activity feeds, friend discovery, and "Inner Circle" for Super Fan identification.
-   **Play Section**: Category-based navigation with dedicated pages for Trivia (/play/trivia), Polls (/play/polls), and Predictions (/play/predictions). Main Play page shows category cards only - no "All Games" listing. Inline Play cards appear every 3rd post in the Feed for quick participation.
-   **Profile Management**: Editable display name and username with validation and real-time uniqueness checking.
-   **Creator Recognition**: "Favorite Creators" are computed from actual user media consumption, calculating "fan points" and dominant roles.
-   **Media Item Pages (CRITICAL - WORKING)**: 
    -   **URL Structure**: `/media/{mediaType}/{source}/{externalId}` (e.g., `/media/tv/tmdb/250307`)
    -   **IMPORTANT**: TMDB has both movie AND TV with same IDs - media type MUST be included in URL
    -   **Feed Navigation**: Posts are clickable when they have both `media_external_id` AND `media_external_source`
    -   **API Integration**: `get-media-details` edge function accepts `media_type` parameter to differentiate between movie/TV
    -   **Example**: Movie ID 250307 = "Arcade Fire", TV ID 250307 = "The Pitt" - without media_type, wrong content loads
    -   **Service Worker**: Disabled during development to prevent aggressive caching of API responses
    -   **Platform Links ("Find On")**: Media detail pages display dynamic platform availability based on content type:
        -   **TMDB (Movies/TV)**: Shows streaming services (Netflix, Hulu, Disney+, etc.) from TMDB's watch providers API with "Watch On" label
        -   **Spotify (Music/Podcasts)**: Direct Spotify link; podcasts also show Apple Podcasts and Google Podcasts with "Listen On" label
        -   **YouTube**: Direct YouTube link with "Find On" label
        -   **Books**: Links to Amazon, Goodreads, and Open Library with "Read On" label
        -   Platform logos and external links are displayed for each available platform
-   **Polls/Surveys System**: Database-backed polling system supporting branded (consumed/entertainlit) and sponsored polls with:
    -   Real-time vote counting and percentage calculations
    -   Duplicate vote prevention per user
    -   Points rewards for participation
    -   Sponsor branding and call-to-action support
    -   Poll lifecycle management (draft/active/archived statuses)
    -   Vote integrity validation (ensures options belong to their polls)
    -   **Security Note**: Admin endpoints (poll creation/archiving) require authentication implementation (currently documented with TODO comments)

### System Design Choices
-   **Database Schema (Critical Naming Conventions)**:
    -   **CRITICAL WARNING**: The Replit development database schema is DIFFERENT from the production Supabase database. ALWAYS use the production schema column names when writing edge functions.
    -   **social_posts table (PRODUCTION SCHEMA - USE THIS)**:
        -   Columns: `id` (uuid), `user_id` (uuid), `content` (text), `post_type` (text), `rating` (integer), `progress` (integer), `created_at` (timestamp), `updated_at` (timestamp), `likes_count` (integer), `comments_count` (integer), `media_title` (text), `media_type` (text), `media_creator` (text), `image_url` (text), `media_external_id` (text), `media_external_source` (text), `media_description` (text), `visibility` (text)
        -   **DO NOT use**: `thoughts` or `media_image` - these columns DO NOT exist in production
        -   **ALWAYS use**: `content` and `image_url` - these are the correct production column names
    -   `users` table: `id`, `email`, `user_name` (CRITICAL: always use `user_name`, never `username`), `display_name`, `password`, `avatar`, `bio`, `is_admin`, `created_at`, `first_name`, `last_name`, `computed_favorite_media_types`, `computed_favorite_genres`.
    -   `list_items` table: `id`, `list_id`, `user_id`, `title`, `type`, `creator`, `image_url`, `notes` (NOT `review`), `created_at` (NOT `added_at`), `media_type`, `media_id`.
    -   `lists` table (UPDATED October 2025): 
        -   **CRITICAL**: Production Supabase does NOT have `description` column - dev database does, production doesn't
        -   **System lists**: user_id = user's ID, is_default = true (personal copies per user)
        -   **Custom lists**: user_id = user's ID, is_default = false/null
        -   **Privacy**: is_private controls visibility for ALL lists (both system and custom)
        -   **Unique constraint**: (user_id, title) prevents duplicate lists per user
        -   Standard system lists: Currently, Queue, Finished, Did Not Finish, Favorites
        -   **Edge function inserts**: Only use `user_id`, `title`, `is_default`, `is_private` - NO description field
    -   `polls` table: `id` (serial), `question`, `type` (consumed/entertainlit/sponsored), `sponsor_name`, `sponsor_logo_url`, `sponsor_cta_url`, `status` (draft/active/archived), `points_reward`, `expires_at`, `created_by`, `created_at`, `updated_at`.
    -   `poll_options` table: `id` (serial), `poll_id`, `label`, `description`, `order_index`, `image_url`, `metadata`, `created_at`.
    -   `poll_responses` table: `id` (UUID), `poll_id`, `option_id`, `user_id`, `created_at`.
-   **Row Level Security (RLS)**: Strict RLS policies are implemented for `lists` and `list_items` to ensure data privacy and integrity.
    -   Lists SELECT: `auth.uid() = user_id OR visibility = 'public'`
    -   Lists MODIFY: `auth.uid() = user_id`
    -   List Items SELECT: `auth.uid() = user_id OR list_id in public lists`
    -   List Items MODIFY: `auth.uid() = user_id`
-   **Edge Functions**: All edge functions adhere to the database schema, including the use of `user_name` and auto-creation logic for new users.
    -   **List Provisioning**: predictions, track-media, and get-user-lists-with-media all create personal system lists on user creation/migration
    -   **Idempotency**: Individual list inserts ignore duplicate key errors (23505), fail on other errors with HTTP 500
    -   **Migration Strategy**: get-user-lists-with-media backfills missing system lists individually for backward compatibility
    -   **CRITICAL - Lists Column Selection (October 15, 2025)**: ALL edge functions that insert/update lists MUST explicitly select only existing columns: `id, title, is_default, is_private`. Production Supabase does NOT have `description` or `updated_at` columns. NEVER use `.select()` without specifying columns.
        -   ✅ CORRECT: `.select('id, title, is_default, is_private')`
        -   ❌ WRONG: `.select()` (tries to fetch non-existent columns)
        -   ❌ WRONG: `.update({ is_private: x, updated_at: ... })` (updated_at doesn't exist)
        -   Affected functions: get-user-lists-with-media, predictions, track-media, update-list-visibility
-   **Privacy Toggle System (WORKING - October 15, 2025)**:
    -   Location: `client/src/pages/list-detail.tsx` and edge function `update-list-visibility`
    -   UI shows toggle only for user-owned lists (!sharedUserId && session)
    -   Toggle color: Gray (`data-[state=checked]:bg-gray-600`) not purple
    -   Edge function updates ONLY `is_private` field (no updated_at, no description)
    -   Edge function explicitly selects `id, title, is_private, is_default`
    -   Privacy mutation properly invalidates cache and shows toast notifications
    -   RLS ensures users can only modify their own lists via `eq('user_id', user.id)` check

## External Dependencies

-   **Database**: Supabase (PostgreSQL) and Neon Database (serverless PostgreSQL).
-   **APIs**:
    -   Spotify: OAuth2 client credentials flow for music data (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).
    -   TMDB: Direct API key authentication for movie/TV data (`TMDB_API_KEY`).
    -   YouTube: Direct API key authentication for video data (`YOUTUBE_API_KEY`).
    -   Open Library: No authentication required for book data.
-   **Core Libraries**:
    -   `@neondatabase/serverless`: Serverless PostgreSQL driver.
    -   `drizzle-orm`: Type-safe ORM.
    -   `@tanstack/react-query`: Server state management.
    -   `@radix-ui/*`: Accessible UI component primitives.
    -   `wouter`: Lightweight React router.
    -   `tailwindcss`: Utility-first CSS framework.
-   **Development Tools**:
    -   `vite`: Build tool and dev server.
    -   `typescript`: Type checking and compilation.
    -   `drizzle-kit`: Database migrations.