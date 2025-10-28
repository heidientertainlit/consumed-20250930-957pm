# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP designed for tracking entertainment consumption. It enables users to log media, participate in social features like leaderboards and activity feeds, discover friends, and engage in trivia and prediction games. The project aims to create an immersive platform for managing and sharing entertainment experiences, characterized by a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
-   **Mobile-first design**: Optimized for mobile devices.
-   **Dark gradient theme**: Sophisticated dark theme throughout the application.
-   **Bottom navigation**: Primary navigation uses a persistent bottom bar (Feed, Track, Play, Leaderboard).
-   **Component Library**: shadcn/ui, built with Radix UI primitives and styled with Tailwind CSS.
-   **Button Theme**: All buttons default to purple (`bg-purple-600`) with white text; outline buttons use a purple border with a white background. No black buttons are used.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for server state management, and Vite for building.
-   **Backend**: Node.js with Express.js REST API, TypeScript, ES modules.
-   **Database**: PostgreSQL with Drizzle ORM, hosted on Neon Database.
-   **API Integration**: Unified API search using Spotify, TMDB, YouTube, and Open Library for media data.
-   **Authentication & Signup**: Supabase Auth for login/signup/password reset, with user creation handled automatically by a Supabase database trigger or edge function. Signup is simplified, directing users directly to the `/feed` after completion.
-   **User Management**: Users are automatically created in a custom `users` table upon first authentication.
-   **Notification System**: A unified real-time notification system with a `notifications` database table, managed by a centralized `send-notification` edge function. Supports various notification types (comment, like, friend request, etc.) and features a `NotificationBell` component with real-time updates and navigation logic.
-   **Sharing System**: Unified sharing functionality (`/src/lib/share.ts`) for various content types, configurable for deep linking or text blurbs.
-   **Leaderboard System**: All leaderboard categories are handled by a single `get-leaderboards` edge function, which uses `SERVICE_ROLE_KEY` to ensure accurate point counting by bypassing RLS.
-   **Unified Voting System**: All voting (polls, predictions, trivia) is consolidated into a single system using the `prediction_pools` table (for game types) and `user_predictions` table (for responses). This system supports sponsors for all game types.
-   **User Points System**: The `calculate-user-points` edge function aggregates points from all user activities.
-   **Trivia Scoring**: Points are awarded only for correct answers, with specific logic for different trivia formats.
-   **Smart Recommendations Caching System**: Provides instant loading of personalized recommendations (<1 second) via a `user_recommendations` cache table. Background AI generation (GPT-4o) analyzes diverse user data, and `rebuild-recommendations` edge function enriches these with real poster images from TMDB/Google Books. The system ensures recommendations are never empty during regeneration and features auto-polling for updates.
-   **Creator Follow System**: Manages following creators using a `followed_creators` table. Includes multi-source creator search, follow/unfollow functionality via edge functions, and a `get-creator-updates` edge function to fetch recent and popular content from followed creators, integrated into the main feed.
-   **Spoiler Protection System**: Posts can be marked as containing spoilers via a checkbox in the share dialog. Spoiler posts show a blurred preview with a reveal overlay in the feed, protecting users from unwanted spoilers until they choose to view the content.

### Feature Specifications
-   **Media Tracking**: Simplified list-based system for tracking entertainment items with privacy controls.
-   **Personal System Lists**: Users receive personal copies of 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites), auto-created with privacy control.
-   **Custom Lists**: User-created lists with dedicated edge functions for creation and management.
-   **Collaborative Lists**: Restricted to custom lists, managed by `list_collaborators` table and `add-list-collaborator`, `remove-list-collaborator`, `get-list-collaborators` edge functions, with notification integration.
-   **Social Features**: Leaderboards, activity feeds, friend discovery, and "Inner Circle" for Super Fan identification.
-   **Play Section**: Category-based navigation for Trivia, Polls, and Predictions, with inline play cards in the Feed.
-   **Profile Management**: Editable display name and username with validation. Supports viewing other users' profiles by passing `user_id` query parameters to edge functions.
-   **Creator Recognition**: "Favorite Creators" are computed based on user media consumption.
-   **Media Item Pages**: Displays dynamic platform availability (e.g., Netflix, Spotify) via "Watch On", "Listen On", or "Read On" links.
-   **Polls/Surveys System**: Database-backed polling system supporting branded and sponsored polls with real-time voting, duplicate vote prevention, and points rewards.
-   **Spoiler Tags**: Users can mark posts as containing spoilers when sharing updates, with content hidden behind a reveal button in the feed to protect other users from spoilers.

### System Design Choices
-   **Database Schema**: Synced development and production schemas with strict naming conventions (e.g., `user_name`). Critical tables like `lists` and `list_items` are designed to ensure data integrity and avoid non-existent columns in production.
-   **Row Level Security (RLS)**: Strict RLS policies are implemented for data privacy (`auth.uid() = user_id OR visibility = 'public'`).
-   **Edge Functions**: Adhere to the database schema, handle auto-creation logic for new users, and explicitly select existing columns for list operations. Profile viewing edge functions accept a `user_id` query parameter for displaying other users' data.
-   **Privacy Toggle System**: UI toggle updates `is_private` via an `update-list-visibility` edge function.

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