# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first entertainment consumption tracking MVP. It allows users to log media, engage with social features like leaderboards and activity feeds, discover friends, and participate in trivia and prediction games. The project emphasizes a sophisticated dark gradient theme, bottom navigation, and an "Entertainment DNA" onboarding survey, aiming to provide an engaging platform for managing and sharing entertainment journeys.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
-   **Mobile-first design**: Optimized for mobile devices.
-   **Dark gradient theme**: Sophisticated dark theme throughout the application.
-   **Bottom navigation**: Primary navigation is via a persistent bottom bar (Feed, Track, Play, Leaderboard).
-   **Component Library**: shadcn/ui built with Radix UI primitives, styled with Tailwind CSS.
-   **Button Theme**: All buttons default to purple (`bg-purple-600`) with white text; outline buttons use purple border with white background. No black buttons are used.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for server state management, and Vite for building.
-   **Backend**: Node.js with Express.js REST API, TypeScript, ES modules.
-   **Database**: PostgreSQL with Drizzle ORM, hosted on Neon Database.
-   **API Integration**: Unified API search using Spotify, TMDB, YouTube, and Open Library for media data.
-   **Authentication & Signup (CRITICAL - October 22, 2025)**:
    -   **Supabase Auth**: User authentication via Supabase Auth for login/signup/password reset
    -   **CRITICAL - Keep signup simple**: `signUp()` in `client/src/lib/auth.tsx` ONLY calls `supabase.auth.signUp()` with metadata
    -   **DO NOT create users/lists in client code**: Violates RLS policies and causes "new row violates row-level security policy" errors
    -   **User Creation**: Handled automatically by Supabase database trigger OR edge functions on first app access
    -   **NO ONBOARDING FLOW**: Users go directly to `/feed` after signup
    -   **Auth State Listener**: MUST NOT redirect users - causes infinite reload loops
    -   **Login Redirect**: Simple redirect in `login.tsx` only
-   **User Management**: Users are auto-created in a custom `users` table upon first authentication.
-   **Sharing System**: Unified sharing (`/src/lib/share.ts`) for various content types, controlled by `VITE_FEATURE_SHARES` for deep linking vs. text blurbs.
-   **Leaderboard System**: All leaderboard categories are handled by a single `get-leaderboards` edge function.
-   **User Points System**: `calculate-user-points` edge function aggregates points from all user activities.
-   **Trivia Scoring**: Points awarded only for correct answers, with specific logic for long-form vs. quick trivia.
-   **Smart Recommendations Caching System (October 24, 2025)**: 
    -   **Instant Loading**: Recommendations load in <1 second via `user_recommendations` cache table
    -   **Background AI Generation**: GPT-4o analyzes 6 data sources (DNA profile, highlights, consumption history, 4-5 star ratings, social posts, custom lists) and generates 8-10 personalized recommendations
    -   **`get-recommendations` Edge Function**: Serves cached recommendations instantly, triggers background rebuild if stale (>6h) or expired (>24h), never shows empty state during regeneration
    -   **`rebuild-recommendations` Edge Function**: Fetches comprehensive user data, calls OpenAI GPT-4o, caches results with 24h expiration and 6h staleness threshold, preserves existing cache during generation and on errors
    -   **Security**: Regular users can only rebuild their own recommendations; service role (cron jobs) can rebuild for any user
    -   **Freshness Indicators**: UI shows "Generating..." badge for first-time users, "Refreshing..." badge when cache is stale but still serving data
    -   **Error Handling**: Failed generations preserve last good recommendations to ensure users never lose data

### Feature Specifications
-   **Media Tracking**: Simplified list-based system for tracking entertainment items with privacy control.
-   **Personal System Lists**: Each user receives personal copies of 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites) which are auto-created on signup or first access. These lists are user-specific, have full privacy control, and are designed for idempotent creation.
-   **Custom Lists**: User-created lists with nested dropdown UI, simple creation dialog, and dedicated edge functions for safety.
-   **Social Features**: Leaderboards, activity feeds, friend discovery, and "Inner Circle" for Super Fan identification.
-   **Play Section**: Category-based navigation for Trivia, Polls, and Predictions. Inline Play cards appear in the Feed.
-   **Profile Management**: Editable display name and username with validation. Viewing other users' profiles correctly displays their data (highlights, stats, DNA profile, consumption history) by passing `user_id` query parameters to edge functions.
-   **Creator Recognition**: "Favorite Creators" are computed based on user media consumption.
-   **Media Item Pages**: URL structure includes `mediaType` to differentiate content (e.g., `/media/{mediaType}/{source}/{externalId}`). Displays dynamic platform availability (Netflix, Spotify, Amazon, etc.) via "Watch On", "Listen On", or "Read On" links.
-   **Polls/Surveys System**: Database-backed polling system supporting branded and sponsored polls with direct Supabase client-side voting, real-time vote counting, duplicate vote prevention, and points rewards.

### System Design Choices
-   **Database Schema**: Development and production databases use a synced schema. Critical naming conventions include `user_name` (never `username`) in the `users` table, and specific columns for `social_posts`, `list_items`, `lists`, `polls`, and `poll_responses`. The `lists` table critically lacks `description` and `updated_at` columns in production.
-   **Row Level Security (RLS)**: Strict RLS policies are implemented for `lists` and `list_items` to ensure data privacy (`auth.uid() = user_id OR visibility = 'public'`).
-   **Edge Functions**: All edge functions adhere to the database schema, including using `user_name` and auto-creation logic for new users. List-related edge functions explicitly select only existing columns (`id, title, is_default, is_private`) when inserting/updating lists to avoid errors with non-existent columns in the production Supabase environment. **Profile viewing edge functions** (`user-highlights`, `get-user-stats`, `get-user-lists-with-media`, `calculate-user-points`) accept a `user_id` query parameter to display other users' data correctly, falling back to the authenticated user's ID when not provided.
-   **Privacy Toggle System**: UI toggle in `list-detail.tsx` updates `is_private` via `update-list-visibility` edge function, ensuring only `is_private` is modified.

## External Dependencies

-   **Database**: Supabase (PostgreSQL), Neon Database (serverless PostgreSQL).
-   **APIs**:
    -   Spotify (OAuth2 client credentials)
    -   TMDB (API key)
    -   YouTube (API key)
    -   Open Library (no authentication)
-   **Core Libraries**:
    -   `@neondatabase/serverless`
    -   `drizzle-orm`
    -   `@tanstack/react-query`
    -   `@radix-ui/*`
    -   `wouter`
    -   `tailwindcss`
-   **Development Tools**:
    -   `vite`
    -   `typescript`
    -   `drizzle-kit`
