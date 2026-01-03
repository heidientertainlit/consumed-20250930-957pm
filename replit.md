# consumed - Entertainment Consumption Tracking MVP

## Overview
consumed is a mobile-first MVP for tracking entertainment consumption, offering social features like leaderboards, activity feeds, friend discovery, trivia, and prediction games. It aims to be an immersive platform for managing and sharing entertainment, characterized by a dark gradient theme, intuitive navigation, and an "Entertainment DNA" onboarding process, with significant market potential to become a leading platform in its niche.

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
- Mobile-first design with a dark gradient theme.
- Bottom Navigation: Activity, Play, Collections, Me.
- Top Navigation: Search (🔍), Notifications, Profile.
- Profile Section Navigation: Sticky pills for Stats, DNA, Friends, Collections, History.
- Component Library: shadcn/ui (Radix UI, Tailwind CSS).
- Button Theme: Default purple (`bg-purple-600`) with white text; outline buttons have purple border and white background. No black buttons.
- Composer: Simplified inline with quick action buttons and dynamic forms.

### Technical Implementations
- Frontend: React 18, TypeScript, Wouter, TanStack Query, Vite.
- Backend: Supabase Edge Functions (Deno runtime).
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Unified API Search: Integration with Spotify, TMDB, YouTube, Open Library via Edge Functions.
- Netflix Import Fix: Uses TMDB API for movie/TV detection, with rate limiting and caching. Includes data validation.
- Real-time unified Notification System.
- Engagement-focused Leaderboard System with 5 categories and 'Your Circle'/Global tabs.
- Unified Voting System for polls, predictions, and trivia.
- Comprehensive User Points System for various actions (media logging, games, social, engagement).
- Smart Recommendations: GPT-4o powered with caching.
- Creator Follow System.
- Spoiler Protection: Blurs content until revealed.
- Session Tracking & Analytics: Monitors engagement for admin dashboard.
- Consumed vs User-Generated Content: Differentiates with a "🏆 Consumed" badge.
- Prediction Resolution: Supports timed/open-ended predictions with scoring.
- AI Builder (`/library-ai`): Customization of lists and tracking via visual builder and AI chat.
- DNA Levels System: Two-tier "Entertainment DNA" (survey-based) with friend comparison and unified insights.

### Feature Specifications
- Friend Profile Viewing: Friends can view Stats, DNA, Collections with appropriate URL parameters.
- Media Tracking: Simplified list-based system with privacy.
- AI-Powered Search: Unified search for conversations, AI recommendations, and media.
- Personal System Lists: 5 default lists with privacy control.
- Custom & Collaborative Lists.
- Ranked Lists (Ranks): Ordered media rankings with drag-and-drop.
- Progress Tracking: By percent, page, episode, or track.
- Social Features: Leaderboards, activity feeds, friend discovery, "Inner Circle."
- Play Section: Category-based navigation for Trivia, Polls, Predictions.
- Profile Management: Editable display names, permanent usernames.
- @ Mention System: Tagging friends with autocomplete and notifications.
- Creator Recognition: Identifies "Favorite Creators."
- Media Item Pages: Dynamic links to consumption platforms.
- Polls/Surveys System: Real-time voting, duplicate prevention, points.
- Discover Page: AI-powered recommendations and trending content.
- Analytics Dashboard: Admin dashboard (`/admin`) for engagement, retention, activation, partnership, and behavioral analytics.

### System Design Choices
- Database Schema: Strict naming conventions, synced dev/prod.
- Row Level Security (RLS): Strict RLS for data privacy.
- Edge Functions: Adhere to schema, handle user auto-creation, accept `user_id`.
- Privacy Toggle System: Controls list visibility.

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