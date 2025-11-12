# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP designed for tracking entertainment consumption. It enables users to log media, participate in social features like leaderboards and activity feeds, discover friends, and engage in trivia and prediction games. The project aims to create an immersive platform for managing and sharing entertainment experiences, characterized by a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process.

## User Preferences
Preferred communication style: Simple, everyday language.

### Design Preferences
- **Track Page Design**: User loves the Track page design with blue gradient "Track Media" and purple gradient "Import History" buttons, stats cards showing Items Logged and Points Earned. This page is kept as a backpage (accessible via direct URL `/track`) but removed from bottom navigation. Features can be integrated into other areas of the app.
- **Hot Takes Feature**: Replaced "Conversations" with "Hot Takes" - a gamified opinion-sharing feature where users post bold entertainment takes, vote on the spiciest opinions, and compete for "Hottest Take" recognition. Uses upvoting system and special 🔥 branding.
- **Simplified Navigation**: Bottom navigation reduced to 3 core items: Feed, Friends, Me. Play and Discover pages exist as backpages (accessible at `/play` and `/discover`) but removed from navigation to simplify the core experience.
- **Profile Page Organization**: Profile page simplified to two main sections: (1) "Your Library" for media consumption stats, and (2) "My Entertainment DNA" for DNA profile/survey/recommendations. Highlights and Follow Creators features removed for cleaner, more focused profile experience.

## System Architecture

### UI/UX Decisions
-   **Mobile-first design**: Optimized for mobile devices.
-   **Dark gradient theme**: Sophisticated dark theme throughout the application.
-   **Bottom navigation**: Simplified to 3 core items - Feed, Friends, Me. Play, Discover, Track, and Leaderboard exist as backpages (accessible at `/play`, `/discover`, `/track`, and `/leaderboard`) but are not shown in navigation for clarity and simplification.
-   **Top navigation**: Search (🔍) for direct friend/media lookup, Notifications, and Profile. Discover functionality integrated via ✨ icon in top nav.
-   **Component Library**: shadcn/ui, built with Radix UI primitives and styled with Tailwind CSS.
-   **Button Theme**: All buttons default to purple (`bg-purple-600`) with white text; outline buttons use a purple border with a white background. No black buttons are used.
-   **Dual Search System**: 
    -   **Direct Search** (🔍 in top nav): Quick search for friends and entertainment to add to lists or send friend requests. Uses `DirectSearchDialog` component with real-time debounced search across `media-search` and `search-users` edge functions.
    -   **Discover Page** (✨ in top nav): AI-powered recommendation engine for conversational queries. Users describe what they're looking for (e.g., "uplifting movies" or "sci-fi like Blade Runner") and receive personalized suggestions via the `conversational-search` edge function. Accessible as backpage at `/discover`.
-   **Feed Content Filters**: Feed page includes filter pills for content types (🎯 Prediction, 🗳️ Poll, 🔥 Hot Take, ⭐ Rate/Review) allowing users to quickly filter the feed by content type.
-   **Inline Composer**: Replaced modal dialog with always-visible inline composer showing action chips upfront (🎯 Prediction, 🗳️ Poll, 🔥 Hot Take, ⭐ Rate/Review, ➕ Add Media). Follows "desire paths" philosophy - users see all options immediately without clicking. Defaults to Hot Take mode for instant typing. Currently supports Hot Take posting; other modes require backend development for creation endpoints.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for server state management, and Vite for building.
-   **Backend**: Supabase Edge Functions (Deno runtime) for all server-side logic including notifications, comments, social features, analytics, recommendations, and API integrations. **NO Express.js - use Supabase Edge Functions exclusively.**
-   **Database**: Supabase PostgreSQL for ALL data storage including users, posts, lists, notifications, analytics, sessions, and all application data. **NO Neon Database - use Supabase PostgreSQL exclusively.**
-   **API Integration**: Unified API search using Spotify, TMDB, YouTube, and Open Library for media data, called from Supabase Edge Functions.
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
-   **Session Tracking & Analytics**: Automatic session tracking via `user_sessions` table that monitors user engagement through heartbeat pings every 30 seconds. Session duration is calculated using visibility change API to capture tab closes. Supports churn analysis (`get_churn_metrics`) showing users who stopped using the app at 7/30/60 day intervals, and time-spent metrics (`get_session_engagement`) showing average session duration, total time spent, and per-user daily averages. Admin dashboard displays churn rate and average time spent with detailed breakdowns. Note: Very short sessions (<30s) may not be fully captured; this is acceptable as they represent bounces or minimal engagement.

### Feature Specifications
-   **Media Tracking**: Simplified list-based system for tracking entertainment items with privacy controls.
-   **Personal System Lists**: Users receive personal copies of 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites), auto-created with privacy control.
-   **Custom Lists**: User-created lists with dedicated edge functions for creation and management.
-   **Collaborative Lists**: Restricted to custom lists, managed by `list_collaborators` table and `add-list-collaborator`, `remove-list-collaborator`, `get-list-collaborators` edge functions, with notification integration.
-   **Social Features**: Leaderboards, activity feeds, friend discovery, and "Inner Circle" for Super Fan identification.
-   **Play Section**: Category-based navigation for Trivia, Polls, and Predictions, with inline play cards in the Feed.
-   **Profile Management**: Editable display name with validation. **Usernames are permanent and cannot be changed** to prevent broken @ mentions (like Twitter/Instagram). Supports viewing other users' profiles by passing `user_id` query parameters to edge functions.
-   **@ Mention System**: Fully implemented social mention system allowing users to tag friends in posts and comments using @username syntax. Features real-time autocomplete dropdown showing friend suggestions, mention notifications with dedicated '@' icon in notification bell, and precise navigation to mentioned posts/comments. Uses unified regex pattern `/(^|[\s,;:!?(){}\[\]"'<>\-])@([\w.-]+)/g` across client rendering and edge functions. Supports deduplication to prevent duplicate notifications. Deployed via `share-update` and `social-feed-comments` edge functions.
-   **Creator Recognition**: "Favorite Creators" are computed based on user media consumption.
-   **Media Item Pages**: Displays dynamic platform availability (e.g., Netflix, Spotify) via "Watch On", "Listen On", or "Read On" links.
-   **Polls/Surveys System**: Uses the unified voting system (`prediction_pools` + `user_predictions` tables) to support polls, predictions, and trivia. All game types support sponsors, real-time voting, duplicate vote prevention, and points rewards. The `PlayCard` component handles rendering and submission for all game types.
-   **Spoiler Tags**: Users can mark posts as containing spoilers when sharing updates, with content hidden behind a reveal button in the feed to protect other users from spoilers.
-   **Discover Page**: Dedicated page (`/discover`) featuring AI-powered recommendation engine at the top and trending content carousels below. Includes sections for personalized recommendations, trending TV shows, movies, NY Times bestsellers, and podcasts. Users can ask conversational questions to get tailored suggestions.
-   **Analytics Dashboard**: VC-ready admin dashboard at `/admin` showing comprehensive engagement metrics including DAU/WAU/MAU, retention rates, stickiness ratio, activation funnel, churn rate, time spent on app, and the North Star Metric (OMTM: % of users taking 2+ actions per week). Built with 10+ SQL analytics functions and a dedicated `get-analytics` edge function. Features interactive charts for retention cohorts, engagement trends, social graph health, onboarding completion rates, churn analysis (30-day), and session engagement metrics (7-day). New endpoints: `?metric=churn&period=30` and `?metric=sessions&period=7 days`.
-   **Partnership Insights**: Dedicated analytics tab showcasing platform data valuable for partnerships with Netflix, Goodreads, Barnes & Noble, etc. Includes 9 partnership SQL functions tracking cross-platform engagement, cross-platform affinity insights, trending content (7-day), completion rates by media type, viral content, DNA personality clusters, creator influence, and engagement timelines. The `get_platform_affinity_insights()` function now analyzes four affinity sources: (1) Creator-based (e.g., "Taylor Swift fans also watch X movies"), (2) Platform-based (e.g., "Netflix viewers also read Y books"), (3) DNA-based (e.g., "Users with 'Adventurous Explorer' DNA who love sci-fi also enjoy Z"), and (4) Recommendation-based (e.g., "Users who received recommendations for Blade Runner also watch W"). This multi-source approach provides richer insights even with limited user data, leveraging Entertainment DNA profiles and AI recommendations alongside traditional consumption patterns. Accessible via `get-analytics?type=partnerships` endpoint with comprehensive error handling.

### System Design Choices
-   **Database Schema**: Synced development and production schemas with strict naming conventions (e.g., `user_name`). Critical tables like `lists` and `list_items` are designed to ensure data integrity and avoid non-existent columns in production.
-   **Row Level Security (RLS)**: Strict RLS policies are implemented for data privacy (`auth.uid() = user_id OR visibility = 'public'`).
-   **Edge Functions**: Adhere to the database schema, handle auto-creation logic for new users, and explicitly select existing columns for list operations. Profile viewing edge functions accept a `user_id` query parameter for displaying other users' data.
-   **Privacy Toggle System**: UI toggle updates `is_private` via an `update-list-visibility` edge function.

## External Dependencies

-   **Database & Backend**: Supabase (PostgreSQL + Edge Functions) - **ALL application data and server logic**
-   **External APIs** (called from Supabase Edge Functions):
    -   Spotify (OAuth2 client credentials)
    -   TMDB (API key)
    -   YouTube (API key)
    -   Open Library (no authentication)
    -   OpenAI (GPT-4o for recommendations)
-   **Frontend Libraries**:
    -   `@supabase/supabase-js`
    -   `@tanstack/react-query`
    -   `@radix-ui/*`
    -   `wouter`
    -   `tailwindcss`