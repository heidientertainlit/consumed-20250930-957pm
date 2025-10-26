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
-   **Notification System (October 24, 2025)**:
    -   **Unified Notification Infrastructure**: Real-time notification system for all user interactions
    -   **Database Table**: `notifications` with columns: `id`, `user_id`, `type`, `triggered_by_user_id`, `message`, `read`, `created_at`, `post_id`, `comment_id`, `list_id`
    -   **Edge Function**: `send-notification` centralized function for creating all notification types, uses service role to bypass RLS
    -   **Supported Types**: `comment`, `like`, `friend_request`, `friend_accepted`, `follow`, `mention`, `inner_circle`, `collaborator_added`
    -   **Frontend Component**: `NotificationBell` component with real-time Supabase subscriptions, unread count badge, mark-as-read functionality
    -   **Real-time Updates**: Supabase Realtime subscriptions automatically update notification bell when new notifications arrive
    -   **Navigation Logic**: Notifications link to relevant pages (posts via `post_id`, lists via `list_id`, etc.)
    -   **Usage Pattern**: Edge functions call `send-notification` with service role key after completing actions (e.g., `add-list-collaborator` sends notification after adding collaborator)
    -   **Self-notification Prevention**: System automatically prevents users from receiving notifications for their own actions
    -   **How to Add New Notification Types**: (1) Add type to `NotificationRequest` interface in `send-notification/index.ts`, (2) Add icon case to `getNotificationIcon()` in `NotificationBell`, (3) Add navigation logic to `handleNotificationClick()` if needed, (4) Call `send-notification` edge function from triggering action with appropriate payload
-   **Sharing System**: Unified sharing (`/src/lib/share.ts`) for various content types, controlled by `VITE_FEATURE_SHARES` for deep linking vs. text blurbs.
-   **Leaderboard System (October 24, 2025)**: All leaderboard categories are handled by a single `get-leaderboards` edge function. **CRITICAL**: Uses `SERVICE_ROLE_KEY` to bypass RLS when counting points - ensures all user activity (public + private lists) counts toward leaderboard scores. Without this, users with private lists show incorrect/lower point totals to other users.
-   **User Points System**: `calculate-user-points` edge function aggregates points from all user activities.
-   **Trivia Scoring**: Points awarded only for correct answers, with specific logic for long-form vs. quick trivia.
-   **Smart Recommendations Caching System (October 24, 2025)**: 
    -   **Instant Loading**: Recommendations load in <1 second via `user_recommendations` cache table
    -   **Background AI Generation**: GPT-4o analyzes 6 data sources (DNA profile, highlights, consumption history, 4-5 star ratings, social posts, custom lists) and generates 8-10 personalized recommendations with poster images
    -   **Real Poster Images**: After AI generates recommendations, `rebuild-recommendations` fetches actual poster images from TMDB (movies/TV) and Google Books (books) APIs to prevent AI hallucinations
    -   **`get-recommendations` Edge Function**: Serves cached recommendations instantly, triggers background rebuild if stale (>6h) or expired (>24h), never shows empty state during regeneration
    -   **`rebuild-recommendations` Edge Function**: Fetches comprehensive user data, calls OpenAI GPT-4o to generate recommendations with titles/reasons, then enriches with real poster images from APIs, caches results with 24h expiration and 6h staleness threshold, preserves existing cache during generation and on errors
    -   **Security**: Regular users can only rebuild their own recommendations; service role (cron jobs) can rebuild for any user
    -   **Auto-Polling**: Frontend polls every 5 seconds while `isGenerating=true`, stops automatically when recommendations are ready - no manual refresh needed
    -   **Mobile-First UI**: Netflix-style poster cards (2:3 aspect ratio) with always-visible action buttons (+ and ⭐), gradient overlay, fallback design for missing images
    -   **Freshness Indicators**: UI shows "Generating..." badge for first-time users, "Rebuilding..." button state during regeneration
    -   **Error Handling**: Failed generations preserve last good recommendations to ensure users never lose data, secure fallback design prevents XSS vulnerabilities
    -   **Multi-Page Integration**: DNA recommendations appear on Track page, Profile page, and Feed page (via MediaCarousel with data transformation for consistent UI)

### Feature Specifications
-   **Media Tracking**: Simplified list-based system for tracking entertainment items with privacy control.
-   **Personal System Lists**: Each user receives personal copies of 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites) which are auto-created on signup or first access. These lists are user-specific, have full privacy control, and are designed for idempotent creation. **Database Constraint**: Unique index `lists_user_title_default_key` prevents duplicate system lists per user.
-   **Custom Lists**: User-created lists with nested dropdown UI, simple creation dialog, and dedicated edge functions for safety.
-   **Collaborative Lists (October 24, 2025)**:
    -   **Custom Lists Only**: Collaboration feature restricted to custom lists (not system lists like "Currently", "Queue")
    -   **Database Table**: `list_collaborators` with columns: `id`, `list_id`, `user_id`, `role` (defaults to 'editor'), `created_at`
    -   **RLS Policies**: INSERT (list owners only), SELECT (owners + collaborators), DELETE (owners only)
    -   **Edge Functions**: `add-list-collaborator` (adds collaborator + sends notification), `remove-list-collaborator` (removes collaborator), `get-list-collaborators` (fetches collaborator list with user data)
    -   **UI Protection**: Collaborators button hidden on system lists via `is_default` field check in `list-detail.tsx`
    -   **Notifications**: Adding a collaborator sends real-time notification via `send-notification` edge function
-   **Social Features**: Leaderboards, activity feeds, friend discovery, and "Inner Circle" for Super Fan identification.
-   **Play Section**: Category-based navigation for Trivia, Polls, and Predictions. Inline Play cards appear in the Feed.
-   **Profile Management**: Editable display name and username with validation. Viewing other users' profiles correctly displays their data (highlights, stats, DNA profile, consumption history) by passing `user_id` query parameters to edge functions.
-   **Creator Recognition**: "Favorite Creators" are computed based on user media consumption.
-   **Media Item Pages**: URL structure includes `mediaType` to differentiate content (e.g., `/media/{mediaType}/{source}/{externalId}`). Displays dynamic platform availability (Netflix, Spotify, Amazon, etc.) via "Watch On", "Listen On", or "Read On" links.
-   **Polls/Surveys System**: Database-backed polling system supporting branded and sponsored polls with direct Supabase client-side voting, real-time vote counting, duplicate vote prevention, and points rewards.
-   **Creator Follow System (October 26, 2025)**:
    -   **Database Table**: `followed_creators` with columns: `id`, `user_id`, `creator_name`, `creator_role`, `creator_image`, `external_id`, `external_source`, `created_at`
    -   **Unique Constraint**: `(user_id, external_id, external_source)` prevents duplicate follows
    -   **Creator Search**: Multi-source search across TMDB (directors/actors/writers/producers), Spotify (musicians), and Google Books (authors) via `search-creators` edge function
    -   **Content Safety**: 1M+ follower threshold for Spotify images, filters for tribute/karaoke/cover artists, deduplication by creator name
    -   **Follow/Unfollow**: `follow-creator` edge function handles authentication, duplicate detection (409 conflict), and removal with optimistic UI updates
    -   **Creator Updates**: `get-creator-updates` edge function fetches latest releases from followed creators (movies/TV from TMDB, albums from Spotify, books from Google Books) within the last 2 years
    -   **Creator News**: `get-creator-updates` edge function also fetches news articles from NewsAPI for followed creators (last 30 days, max 2 articles per creator, limited to first 5 creators)
    -   **Feed Integration**: Creator update cards appear in the main feed every 6th post, creator news cards appear every 12th post (less frequent to keep users in app)
    -   **UI Components**: Follow buttons in user profile with loading states, "Following" vs "+ Follow" states, inline creator search with debounced queries (500ms delay), CreatorUpdateCard (purple gradient) and CreatorNewsCard (blue gradient)

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
    -   NewsAPI (API key - for creator news articles)
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
