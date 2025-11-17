# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP for tracking entertainment consumption, enabling users to log media, engage in social features like leaderboards and activity feeds, discover friends, and participate in trivia and prediction games. The platform aims to provide an immersive experience for managing and sharing entertainment, featuring a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process.

## User Preferences
Preferred communication style: Simple, everyday language.

### Design Preferences
- **Track Page Design**: User loves the Track page design with blue gradient "Track Media" and purple gradient "Import History" buttons, stats cards showing Items Logged and Points Earned. This page is kept as a backpage (accessible via direct URL `/track`) but removed from bottom navigation. Features can be integrated into other areas of the app.
- **Hot Takes Feature**: Replaced "Conversations" with "Hot Takes" - a gamified opinion-sharing feature where users post bold entertainment takes, vote on the spiciest opinions, and compete for "Hottest Take" recognition. Uses upvoting system and special 🔥 branding.
- **Navigation**: Bottom navigation includes 4 items: Feed, Leaderboard, Library, and Me. Friends functionality moved to profile page. Discover, Track, and Play pages exist as backpages (accessible at `/discover`, `/track`, and `/play`) but are not shown in navigation.
- **Profile Page Organization**: Profile includes sticky section navigation pills (Stats, DNA, Friends) for easy jumping between sections. Features: Your Stats (media consumption stats), My Entertainment DNA (profile/survey/recommendations), and Friends (friend management - only visible on own profile). Lists and Media History functionality moved to Library page. Section pills highlight active section and enable smooth scrolling navigation.
- **Library Page Structure**: Library consolidates media management with 3 responsive tabs: Discover (trending content carousels), Lists (expandable lists with inline progress tracking - pages for books, episodes for TV, tracks for music, percentage for others), and Media History (chronological feed with search bar and Year/Month/Type filters, plus Overview stats showing media type counts).

## System Architecture

### UI/UX Decisions
- **Mobile-first design** with a **dark gradient theme**.
- **Bottom Navigation**: Feed, Leaderboard, Library, Me. Friends moved to profile. Discover, Track, Play are backpages.
- **Top Navigation**: Search (🔍), Notifications, Profile. Discover via ✨ icon.
- **Profile Section Navigation**: Sticky pills (Stats, DNA, Friends) for quick navigation. Lists and Media History moved to Library page.
- **Library Page Tabs**: 3 tabs (Discover, Lists, Media History) for consolidated media management. Lists tab shows expandable lists with visual progress bars and inline update controls. Media History tab includes search functionality and Year/Month/Type filters with Overview stats.
- **Component Library**: shadcn/ui (Radix UI, Tailwind CSS).
- **Button Theme**: Default purple (`bg-purple-600`) with white text; outline buttons have purple border and white background. No black buttons.
- **Dual Search System**:
    - **Direct Search** (🔍): For friends and media, using `media-search` and `search-users` edge functions.
    - **Discover Page** (✨): AI-powered conversational recommendations via `conversational-search` edge function.
- **Feed Content Filters**: Filter pills for content types (🎯 Prediction, 🗳️ Poll, 🔥 Hot Take, ⭐ Rate/Review).
- **Inline Composer**: Simplified composer with clean text box and two buttons (➕ Add Media, ✨ More options). More options expands to show: 🎯 Prediction, 📦 Poll, ⭐ Rate/Review, 💬 Ask for Recs. Quick prompts include "I just finished..." Placeholder: "Share the entertainment you are consuming… or start a conversation."

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, Vite.
- **Backend**: Supabase Edge Functions (Deno runtime) for all server-side logic.
- **Database**: Supabase PostgreSQL for all data storage.
- **API Integration**: Unified API search (Spotify, TMDB, YouTube, Open Library) via Supabase Edge Functions.
- **Authentication**: Supabase Auth for login/signup/password reset, with automatic user creation in a custom `users` table.
- **Notification System**: Real-time unified system (`notifications` table, `send-notification` edge function).
- **Sharing System**: Unified functionality (`/src/lib/share.ts`) for content sharing.
- **Leaderboard System**: Engagement-focused leaderboard with 5 categories:
  - **🌟 Fan Leaders**: Overall combined score (posts + replies + predictions + polls + reactions)
  - **🔥 Conversation Starters**: Posts people engaged with most
  - **🎯 Top Predictors**: Most accurate predictions
  - **🧩 Trivia Champs**: Correct answers and streaks
  - **❤️ Most Helpful**: Recommendations people saved
  - Headline: "Who's Leading the Entertainment Conversation This Week?"
  - Tracks conversation activity, social interaction, and play activity
  - Does NOT track hours watched, books read, or consumption quantity
  - Uses `get-leaderboards` edge function with Your Circle (friends) and Global tabs
  - Old leaderboard preserved at `leaderboard-old.tsx` for reference
- **Unified Voting System**: Uses `prediction_pools` and `user_predictions` tables for polls, predictions, and trivia, supporting sponsors.
- **User Points System**: `calculate-user-points` edge function aggregates points.
- **Smart Recommendations Caching**: `user_recommendations` cache table for instant loading, background GPT-4o generation, and `rebuild-recommendations` edge function.
- **Creator Follow System**: `followed_creators` table, edge functions for follow/unfollow, and `get-creator-updates` for feed integration.
- **Spoiler Protection**: Posts can be marked as spoilers, showing a blurred preview with a reveal overlay.
- **Session Tracking & Analytics**: `user_sessions` table for engagement monitoring, churn analysis, and time-spent metrics via `get_churn_metrics` and `get_session_engagement` functions.
- **Consumed vs User-Generated Content**: Predictions, polls, and trivia can be created either by the consumed team (platform-curated) or by users. Content origin is distinguished via `origin_type` ('consumed' or 'user') and `origin_user_id` fields:
  - **Consumed Content**: Platform-curated predictions/polls/trivia added via SQL by consumed team, displayed with "🏆 Featured" badge and purple gradient border (from-purple-50 to-blue-50, border-purple-300), icon with purple-to-blue gradient background.
  - **User-Generated Content**: Created by users through inline composer, displayed with "@username asked:" format, simple white card with standard gray border, standard purple icon background.
  - Both types use the same `prediction_pools` table and edge functions but are visually distinguished in the feed for different user experiences.
- **Prediction Resolution System**: Predictions support optional end dates and scoring system:
  - **Scoring**: +20 points for correct predictions, -5 points for incorrect predictions (via `resolve-prediction` edge function)
  - **Timed Predictions**: Optional `deadline` field - when end date passes, prediction resurfaces in feed for resolution
  - **Open-Ended Predictions**: No deadline - active until manual resolution or "It happened!" notification
  - **Creator Resolution**: Prediction creator resolves by selecting winning option within 48 hours of deadline
  - **Crowd-Resolve Fallback**: If creator doesn't resolve, crowd voting determines outcome (planned feature)
  - **Stats Tracking**: `user_prediction_stats` table tracks total predictions, wins, current/best streaks, win percentage
  - **Profile Display**: Compact stats in profile header (win streak, predictions count, mostly into, global rank)

### Feature Specifications
- **Media Tracking**: Simplified list-based system with privacy controls.
- **Library Page**: Consolidated media management with 3 tabs:
  - **Discover Tab**: Trending content carousels
  - **Lists Tab**: All user lists with expandable views showing items and visual progress bars. Smart progress modes (pages for books, episodes for TV, tracks for music, percentage for others) with inline update controls.
  - **Media History Tab**: Chronological feed with search bar, Year/Month/Type filters, and Overview stats showing media type counts.
- **Personal System Lists**: 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites) auto-created with privacy control.
- **Custom Lists**: User-created lists with dedicated edge functions.
- **Collaborative Lists**: Managed by `list_collaborators` table and associated edge functions.
- **Progress Tracking**: Uses `update-item-progress` edge function with modes: percent (0-100%), page (books), episode (TV shows), track (music).
- **Social Features**: Engagement-focused leaderboards (conversation activity, social interaction, play activity), activity feeds, friend discovery, "Inner Circle".
- **Play Section**: Category-based navigation for Trivia, Polls, Predictions.
- **Profile Management**: Editable display name; usernames are permanent. Supports viewing other users' profiles. Profile focuses on Stats, DNA (Entertainment DNA profile), and Friends (friend management on own profile only).
- **@ Mention System**: Tagging friends in posts/comments, real-time autocomplete, mention notifications, and precise navigation.
- **Creator Recognition**: "Favorite Creators" based on media consumption.
- **Media Item Pages**: Dynamic platform availability links ("Watch On", "Listen On", "Read On").
- **Polls/Surveys System**: Uses unified voting system with sponsors, real-time voting, duplicate vote prevention, and points rewards.
- **Discover Page**: AI-powered recommendations and trending content carousels.
- **Analytics Dashboard**: Admin dashboard at `/admin` with comprehensive engagement metrics (DAU/WAU/MAU, retention, churn, time spent) using SQL analytics functions and `get-analytics` edge function.
- **Partnership Insights**: Analytics for partnerships (Netflix, Goodreads) including cross-platform affinity, trending content, and DNA personality clusters via `get-analytics?type=partnerships`.
- **AI Builder** (`/library-ai`): Two-tab customization interface for personalizing the app:
  - **List Organization**: System-wide configuration for how ALL lists work (default layout: grid/list/compact, global features: progress tracker, notes, collaborators, privacy, covers, tags)
  - **Tracking Preferences**: Granular controls for media types, tracking options, and list display preferences
  - **AI Chat Integration**: `builder-chat` edge function with Claude 4.1 Sonnet for natural language customization (fallback mock responses when API key unavailable)
  - **Visual Builder**: White background, dark text, purple gradients for CTAs, matching Threads aesthetic

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