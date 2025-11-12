# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP for tracking entertainment consumption, enabling users to log media, engage in social features like leaderboards and activity feeds, discover friends, and participate in trivia and prediction games. The platform aims to provide an immersive experience for managing and sharing entertainment, featuring a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process.

## User Preferences
Preferred communication style: Simple, everyday language.

### Design Preferences
- **Track Page Design**: User loves the Track page design with blue gradient "Track Media" and purple gradient "Import History" buttons, stats cards showing Items Logged and Points Earned. This page is kept as a backpage (accessible via direct URL `/track`) but removed from bottom navigation. Features can be integrated into other areas of the app.
- **Hot Takes Feature**: Replaced "Conversations" with "Hot Takes" - a gamified opinion-sharing feature where users post bold entertainment takes, vote on the spiciest opinions, and compete for "Hottest Take" recognition. Uses upvoting system and special 🔥 branding.
- **Navigation**: Bottom navigation includes 4 items: Feed, Play, Library, and Me. Friends functionality moved to profile page. Discover, Track, and Leaderboard pages exist as backpages (accessible at `/discover`, `/track`, and `/leaderboard`) but are not shown in navigation.
- **Profile Page Organization**: Profile includes sticky section navigation pills (Stats, DNA, Lists, Friends) for easy jumping between sections. Features: Your Stats (media consumption stats), My Entertainment DNA (profile/survey/recommendations), My Lists (media lists), and Friends (friend management - only visible on own profile). Section pills highlight active section and enable smooth scrolling navigation.

## System Architecture

### UI/UX Decisions
- **Mobile-first design** with a **dark gradient theme**.
- **Bottom Navigation**: Feed, Play, Library, Me. Friends moved to profile. Discover, Track, Leaderboard are backpages.
- **Top Navigation**: Search (🔍), Notifications, Profile. Discover via ✨ icon.
- **Profile Section Navigation**: Sticky pills (Stats, DNA, Lists, Friends) for quick navigation.
- **Component Library**: shadcn/ui (Radix UI, Tailwind CSS).
- **Button Theme**: Default purple (`bg-purple-600`) with white text; outline buttons have purple border and white background. No black buttons.
- **Dual Search System**:
    - **Direct Search** (🔍): For friends and media, using `media-search` and `search-users` edge functions.
    - **Discover Page** (✨): AI-powered conversational recommendations via `conversational-search` edge function.
- **Feed Content Filters**: Filter pills for content types (🎯 Prediction, 🗳️ Poll, 🔥 Hot Take, ⭐ Rate/Review).
- **Inline Composer**: Always-visible composer with action chips (🎯 Prediction, 🗳️ Poll, 🔥 Hot Take, ⭐ Rate/Review, ➕ Add Media). Defaults to Hot Take mode.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, Vite.
- **Backend**: Supabase Edge Functions (Deno runtime) for all server-side logic.
- **Database**: Supabase PostgreSQL for all data storage.
- **API Integration**: Unified API search (Spotify, TMDB, YouTube, Open Library) via Supabase Edge Functions.
- **Authentication**: Supabase Auth for login/signup/password reset, with automatic user creation in a custom `users` table.
- **Notification System**: Real-time unified system (`notifications` table, `send-notification` edge function).
- **Sharing System**: Unified functionality (`/src/lib/share.ts`) for content sharing.
- **Leaderboard System**: `get-leaderboards` edge function handles all categories.
- **Unified Voting System**: Uses `prediction_pools` and `user_predictions` tables for polls, predictions, and trivia, supporting sponsors.
- **User Points System**: `calculate-user-points` edge function aggregates points.
- **Smart Recommendations Caching**: `user_recommendations` cache table for instant loading, background GPT-4o generation, and `rebuild-recommendations` edge function.
- **Creator Follow System**: `followed_creators` table, edge functions for follow/unfollow, and `get-creator-updates` for feed integration.
- **Spoiler Protection**: Posts can be marked as spoilers, showing a blurred preview with a reveal overlay.
- **Session Tracking & Analytics**: `user_sessions` table for engagement monitoring, churn analysis, and time-spent metrics via `get_churn_metrics` and `get_session_engagement` functions.

### Feature Specifications
- **Media Tracking**: Simplified list-based system with privacy controls.
- **Personal System Lists**: 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites) auto-created with privacy control.
- **Custom Lists**: User-created lists with dedicated edge functions.
- **Collaborative Lists**: Managed by `list_collaborators` table and associated edge functions.
- **Social Features**: Leaderboards, activity feeds, friend discovery, "Inner Circle".
- **Play Section**: Category-based navigation for Trivia, Polls, Predictions.
- **Profile Management**: Editable display name; usernames are permanent. Supports viewing other users' profiles.
- **@ Mention System**: Tagging friends in posts/comments, real-time autocomplete, mention notifications, and precise navigation.
- **Creator Recognition**: "Favorite Creators" based on media consumption.
- **Media Item Pages**: Dynamic platform availability links ("Watch On", "Listen On", "Read On").
- **Polls/Surveys System**: Uses unified voting system with sponsors, real-time voting, duplicate vote prevention, and points rewards.
- **Discover Page**: AI-powered recommendations and trending content carousels.
- **Analytics Dashboard**: Admin dashboard at `/admin` with comprehensive engagement metrics (DAU/WAU/MAU, retention, churn, time spent) using SQL analytics functions and `get-analytics` edge function.
- **Partnership Insights**: Analytics for partnerships (Netflix, Goodreads) including cross-platform affinity, trending content, and DNA personality clusters via `get-analytics?type=partnerships`.

### System Design Choices
- **Database Schema**: Strict naming conventions, synced dev/prod schemas.
- **Row Level Security (RLS)**: Strict RLS for data privacy.
- **Edge Functions**: Adhere to schema, handle user auto-creation, accept `user_id` for profile viewing.
- **Privacy Toggle System**: `update-list-visibility` edge function.

## External Dependencies

-   **Database & Backend**: Supabase (PostgreSQL + Edge Functions)
-   **External APIs** (called from Supabase Edge Functions):
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