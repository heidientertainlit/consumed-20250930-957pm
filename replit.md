# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP designed for tracking entertainment consumption. It enables users to log media, participate in social features like leaderboards and activity feeds, discover friends, and engage in trivia and prediction games. The project aims to create an immersive platform for managing and sharing entertainment experiences, characterized by a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
-   **Mobile-first design**: Optimized for mobile devices.
-   **Dark gradient theme**: Sophisticated dark theme throughout the application.
-   **Bottom navigation**: Primary navigation uses a persistent bottom bar (Feed, Track, Play, Leaderboard, Friends).
-   **Top navigation**: Search (🔍) for direct friend/media lookup, Discover (✨) for AI recommendations, Notifications, and Profile.
-   **Component Library**: shadcn/ui, built with Radix UI primitives and styled with Tailwind CSS.
-   **Button Theme**: All buttons default to purple (`bg-purple-600`) with white text; outline buttons use a purple border with a white background. No black buttons are used.
-   **Dual Search System**: 
    -   **Direct Search** (🔍 in top nav): Quick search for friends and entertainment to add to lists or send friend requests. Uses `DirectSearchDialog` component with real-time debounced search across `media-search` and `search-users` edge functions.
    -   **Discover Page** (✨ in top nav): AI-powered recommendation engine for conversational queries. Users describe what they're looking for (e.g., "uplifting movies" or "sci-fi like Blade Runner") and receive personalized suggestions via the `conversational-search` edge function.

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
-   **Polls/Surveys System**: Uses the unified voting system (`prediction_pools` + `user_predictions` tables) to support polls, predictions, and trivia. All game types support sponsors, real-time voting, duplicate vote prevention, and points rewards. The `PlayCard` component handles rendering and submission for all game types.
-   **Spoiler Tags**: Users can mark posts as containing spoilers when sharing updates, with content hidden behind a reveal button in the feed to protect other users from spoilers.
-   **Discover Page**: Dedicated page (`/discover`) featuring AI-powered recommendation engine at the top and trending content carousels below. Includes sections for personalized recommendations, trending TV shows, movies, NY Times bestsellers, and podcasts. Users can ask conversational questions to get tailored suggestions.
-   **Analytics Dashboard**: VC-ready admin dashboard at `/admin` showing comprehensive engagement metrics including DAU/WAU/MAU, retention rates, stickiness ratio, activation funnel, and the North Star Metric (OMTM: % of users taking 2+ actions per week). Built with 8 SQL analytics functions and a dedicated `get-analytics` edge function. Features interactive charts for retention cohorts, engagement trends, social graph health, and onboarding completion rates.
-   **Partnership Insights**: Dedicated analytics tab showcasing platform data valuable for partnerships with Netflix, Goodreads, Barnes & Noble, etc. Includes 9 partnership SQL functions tracking cross-platform engagement, cross-platform affinity insights, trending content (7-day), completion rates by media type, viral content, DNA personality clusters, creator influence, and engagement timelines. The `get_platform_affinity_insights()` function now analyzes four affinity sources: (1) Creator-based (e.g., "Taylor Swift fans also watch X movies"), (2) Platform-based (e.g., "Netflix viewers also read Y books"), (3) DNA-based (e.g., "Users with 'Adventurous Explorer' DNA who love sci-fi also enjoy Z"), and (4) Recommendation-based (e.g., "Users who received recommendations for Blade Runner also watch W"). This multi-source approach provides richer insights even with limited user data, leveraging Entertainment DNA profiles and AI recommendations alongside traditional consumption patterns. Accessible via `get-analytics?type=partnerships` endpoint with comprehensive error handling.

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