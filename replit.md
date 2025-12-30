# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP designed for tracking entertainment consumption. It allows users to log various media, engage with social features like leaderboards and activity feeds, discover friends, and participate in trivia and prediction games. The platform aims to offer an immersive experience for managing and sharing entertainment, characterized by a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process. The project envisions significant market potential by becoming the go-to platform for entertainment tracking and social engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

### Design Preferences
- **Track Page Design**: User loves the Track page design with blue gradient "Track Media" and purple gradient "Import History" buttons, stats cards showing Items Logged and Points Earned. This page is kept as a backpage (accessible via direct URL `/track`) but removed from bottom navigation. Features can be integrated into other areas of the app.
- **Hot Takes Feature**: Replaced "Conversations" with "Hot Takes" - a gamified opinion-sharing feature where users post bold entertainment takes, vote on the spiciest opinions, and compete for "Hottest Take" recognition. Uses upvoting system and special 🔥 branding.
- **Navigation**: Bottom navigation includes 4 items: Activity, Play, Collections, and Me. Play page combines game tiles (Predictions, Polls, Trivia, Leaderboard) with embedded leaderboard content below. Collections page at `/collections` has 3 tabs: Lists, Ranks, and History (media history moved from profile). Leaderboard exists as backpage at `/leaderboard`. Discover and Track pages also exist as backpages (accessible at `/discover`, `/track`). Creator profile at `/creator-profile` shows Follow/Inner Circle buttons and external links.
- **Profile Page Organization**: Profile includes sticky section navigation pills (Stats, DNA, Friends, Collections, History) for easy jumping between sections. Features: Your Stats (media consumption stats), My Entertainment DNA (profile/survey/recommendations), Friends (friend management - only visible on own profile), Collections (Lists + Ranks), and History (media history with imports). Section pills highlight active section and enable tab-based navigation.
- **Collections System**: Collections tab contains sub-navigation for Lists (existing media tracking lists) and Ranks (ranked lists like "Top 10 90s Movies"). Ranks feature supports drag-and-drop ordering, position-based ranking, and collaboration.
- **Search Page**: AI-powered search at `/search` with unified results showing Conversations (posts/predictions/polls/reviews), AI Recommendations, and Media Results. Uses custom AI icon in navigation.

## System Architecture

### UI/UX Decisions
- **Mobile-first design** with a **dark gradient theme**.
- **Bottom Navigation**: Activity, Play, Collections, Me.
- **Top Navigation**: Search (🔍), Notifications, Profile.
- **Profile Section Navigation**: Sticky pills for Stats, DNA, Friends, Collections, History.
- **Component Library**: shadcn/ui (Radix UI, Tailwind CSS).
- **Button Theme**: Default purple (`bg-purple-600`) with white text; outline buttons have purple border and white background. No black buttons.
- **Composer**: Simplified inline composer with quick action buttons and dynamic forms for posts, ratings, predictions, and polls.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Wouter, TanStack Query, Vite.
- **Backend**: Supabase Edge Functions (Deno runtime) for all server-side logic.
- **Database**: Supabase PostgreSQL.
- **Authentication**: Supabase Auth.
- **Unified API Search**: Integration with Spotify, TMDB, YouTube, Open Library via Edge Functions.
- **Netflix Import Fix**: Netflix imports now use TMDB API to detect movies vs TV shows (previously all marked as TV). Uses rate limiting (3 req/800ms) and caching for efficiency. Includes validation to reject junk data (timestamps, device IDs, email addresses, profile names) from incorrectly formatted imports.
- **Notification System**: Real-time unified system.
- **Leaderboard System**: Engagement-focused with 5 categories (Fan Leaders, Conversation Starters, Top Predictors, Trivia Champs, Most Helpful) using 'Your Circle' (friends) and Global tabs.
- **Unified Voting System**: Supports polls, predictions, and trivia.
- **User Points System**: Comprehensive points system with standardized values:
  - **Media Logging**: Books (15), TV (10), Movies (8), Games (5), Podcasts (3), Music (1), Reviews (+10)
  - **Games**: Predictions (+20 correct/-20 wrong), Trivia (10 per correct), Polls (2 participation)
  - **Social**: Friends (5 each), Referrals (25 when invited user does first activity)
  - **Engagement**: Posts (10), Likes given (2), Comments (5), Predictions voted (5), Ranks (10), plus bonus for likes/comments received
- **Smart Recommendations**: GPT-4o powered with caching for instant loading.
- **Creator Follow System**: Enables users to follow creators and receive updates.
- **Spoiler Protection**: Blurs spoiler content until revealed.
- **Session Tracking & Analytics**: Monitors user engagement and churn. Includes behavioral analytics tracking page views, scroll depth, session duration, and user events. Data powers the "Behavior" tab in admin dashboard.
- **Consumed vs User-Generated Content**: Differentiates platform-curated content with a "🏆 Consumed" badge from user-generated content.
- **Prediction Resolution**: Supports timed and open-ended predictions with a scoring system and creator/crowd-resolve mechanisms.
- **AI Builder** (`/library-ai`): Allows customization of list organization and tracking preferences via a visual builder and AI chat.
- **DNA Levels System**: Two-tier Entertainment DNA system (survey required for both levels):
  - **Level 0: No DNA** - User has not completed the DNA survey
  - **Level 1: DNA Summary** (Survey + 10 items): Full DNA profile with label, tagline, preferences, and shareable card
  - **Level 2: DNA Friend Compare** (Survey + 30 items): Unlocks friend DNA comparisons with match percentages and "Watch Together" suggestions
  - **Friend DNA Comparison** (Level 2): AI-generated match percentages, shared genres/titles, and personalized recommendations, cached 24 hours
  - **Unified DNA Insights Card**: Blends survey preferences with actual tracking behavior:
    - Shows "You said you love" (survey media types) vs "What you actually track" (real counts)
    - Green badges for matches, amber badges with 👀 for surprises (tracked but not in survey)
    - Generates insights like "You didn't mention Movies in your survey, but you've logged 50!"
    - Uses userStats from backend for reliable tracking data
  - **Signal Extraction**: Analyzes logged media for genre, creator, decade, and mood patterns

### Feature Specifications
- **Friend Profile Viewing**: Friends can view each other's Stats, DNA, and Collections tabs. When viewing a friend's Collections and clicking on a list, the URL includes `?user=<friend-id>` so the list-detail page shows the friend's items correctly.
- **Media Tracking**: Simplified list-based system with privacy controls.
- **AI-Powered Search**: Unified search at `/search` for conversations, AI recommendations, and media results.
- **Personal System Lists**: 5 default lists (Currently, Queue, Finished, Did Not Finish, Favorites) with privacy control.
- **Custom & Collaborative Lists**: User-created and shared lists.
- **Ranked Lists (Ranks)**: Ordered media rankings with drag-and-drop functionality and configurable visibility.
- **Progress Tracking**: Tracks media consumption by percent, page, episode, or track.
- **Social Features**: Leaderboards, activity feeds, friend discovery, and an "Inner Circle."
- **Play Section**: Category-based navigation for Trivia, Polls, Predictions.
- **Profile Management**: Editable display names, permanent usernames, and detailed user profiles.
- **@ Mention System**: Tagging friends with real-time autocomplete and notifications.
- **Creator Recognition**: Identifies "Favorite Creators" based on media consumption.
- **Media Item Pages**: Provides dynamic links to platforms for media consumption.
- **Polls/Surveys System**: Real-time voting, duplicate vote prevention, and points rewards.
- **Discover Page**: AI-powered recommendations and trending content carousels.
- **Analytics Dashboard**: Admin dashboard at `/admin` for comprehensive engagement metrics, partnership insights, and behavioral analytics. Includes tabs for Overview, Retention, Engagement, Activation, Partnership Insights, and Behavior (page time, feature usage, session stats).

### System Design Choices
- **Database Schema**: Strict naming conventions, synced dev/prod schemas.
- **Row Level Security (RLS)**: Strict RLS for data privacy.
- **Edge Functions**: Adhere to schema, handle user auto-creation, accept `user_id` for profile viewing.
- **Privacy Toggle System**: Controls list visibility.

## SQL Templates

### Adding a Trivia Challenge
Required fields for `prediction_pools` table when `type='trivia'`:

```sql
INSERT INTO prediction_pools (
  id,
  title,
  description,
  type,
  category,
  icon,
  points_reward,
  status,
  origin_type,
  options
) VALUES (
  'consumed-trivia-[slug]',           -- id: must start with 'consumed-trivia-' for platform content
  '[Challenge Title]',                 -- title: display name
  '[Description text]',                -- description: subtitle/description
  'trivia',                            -- type: always 'trivia' for trivia challenges
  '[Category]',                        -- category: Movies, TV, Music, Books, Podcasts, Sports, Pop Culture
  '[emoji]',                           -- icon: emoji like 🎬 📺 🎵 📚 🎙️ 🏆
  [points],                            -- points_reward: integer (e.g., 100)
  'open',                              -- status: 'open' for active
  'consumed',                          -- origin_type: 'consumed' for platform content
  '[
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Correct Option"
    }
  ]'::jsonb                            -- options: JSONB array of question objects
);
```

**Category Icons:**
- Movies: 🎬
- TV: 📺
- Music: 🎵
- Books: 📚
- Podcasts: 🎙️
- Sports: 🏆
- Pop Culture: 🌟

### Adding a Poll
Required fields for `prediction_pools` table when `type='vote'`:

```sql
INSERT INTO prediction_pools (
  id,
  title,
  description,
  type,
  category,
  icon,
  points_reward,
  status,
  origin_type,
  options
) VALUES (
  'consumed-poll-[slug]',              -- id: must start with 'consumed-poll-' for platform content
  '[Poll Question]',                   -- title: the question being asked
  '[Optional description]',            -- description: subtitle (can be empty string '')
  'vote',                              -- type: always 'vote' for polls
  '[Category]',                        -- category: Movies, TV, Music, Books, Podcasts, Sports, Pop Culture
  '[emoji]',                           -- icon: emoji like 🎬 📺 🎵 📚 🎙️ 🏆
  2,                                   -- points_reward: 2 for polls (per points system)
  'open',                              -- status: 'open' for active
  'consumed',                          -- origin_type: 'consumed' for platform content
  '["Option 1", "Option 2", "Option 3"]'::jsonb  -- options: JSONB array of answer choices
);
```

**Points Reference:**
- Trivia: 10 per correct answer (or custom)
- Polls: 2 points participation
- Predictions: +20 correct / -20 wrong

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