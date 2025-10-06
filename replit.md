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
-   **Media Tracking**: Simplified list-based system allowing users to track various entertainment items across "Currently", "Queue", "Finished", and "Did Not Finish" lists.
-   **Social Features**: Leaderboards, activity feeds, friend discovery, and "Inner Circle" for Super Fan identification.
-   **Play Section**: Category-based navigation with dedicated pages for Trivia (/play/trivia), Polls (/play/polls), and Predictions (/play/predictions). Main Play page shows category cards only - no "All Games" listing. Inline Play cards appear every 3rd post in the Feed for quick participation.
-   **Profile Management**: Editable display name and username with validation and real-time uniqueness checking.
-   **Creator Recognition**: "Favorite Creators" are computed from actual user media consumption, calculating "fan points" and dominant roles.
-   **Media Item Pages**: Deferred to post-launch. Individual media pages (e.g., `/media/tv/:tmdb_id`) would provide deep linking and better shareability but are not critical for MVP launch.
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
    -   `users` table: `id`, `email`, `user_name` (CRITICAL: always use `user_name`, never `username`), `display_name`, `password`, `avatar`, `bio`, `is_admin`, `created_at`, `first_name`, `last_name`, `computed_favorite_media_types`, `computed_favorite_genres`.
    -   `list_items` table: `id`, `list_id`, `user_id`, `title`, `type`, `creator`, `image_url`, `notes` (NOT `review`), `created_at` (NOT `added_at`), `media_type`, `media_id`.
    -   `lists` table: System lists have `user_id = NULL`. Standard lists include Queue, Finished, Did Not Finish.
    -   `polls` table: `id` (serial), `question`, `type` (consumed/entertainlit/sponsored), `sponsor_name`, `sponsor_logo_url`, `sponsor_cta_url`, `status` (draft/active/archived), `points_reward`, `expires_at`, `created_by`, `created_at`, `updated_at`.
    -   `poll_options` table: `id` (serial), `poll_id`, `label`, `description`, `order_index`, `image_url`, `metadata`, `created_at`.
    -   `poll_responses` table: `id` (UUID), `poll_id`, `option_id`, `user_id`, `created_at`.
-   **Row Level Security (RLS)**: Strict RLS policies are implemented for `lists` and `list_items` to ensure data privacy and integrity.
    -   Lists SELECT: `auth.uid() = user_id OR visibility = 'public' OR user_id IS NULL`
    -   Lists MODIFY: `auth.uid() = user_id`
    -   List Items SELECT: `auth.uid() = user_id OR list_id in public/system lists`
    -   List Items MODIFY: `auth.uid() = user_id`
-   **Edge Functions**: All edge functions adhere to the database schema, including the use of `user_name` and auto-creation logic for new users.

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