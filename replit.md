# Consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform designed to transform entertainment consumption into an interactive, game-like experience. Its primary purpose is to allow users to "play" with entertainment through ranking, voting, predicting, and testing knowledge, fostering engagement, reaction, and social comparison. The platform aims to shift from passive consumption to active participation, making users feel a part of the entertainment they love. The core experience is "Play → React → Compare," with background tracking fueling personalization.

## User Preferences
Preferred communication style: Simple, everyday language.
- When user asks "give me the code to push to git", provide `git push origin main` command. User deploys from their own git repo.

### CRITICAL Rules
- **NEVER PUBLISH / DEPLOY the app.** User handles deployment themselves. Do not suggest or trigger publishing under any circumstances.
- **NEVER add, seed, or modify data in Supabase without explicit user approval first.** Always double-check with the user before inserting, updating, or seeding any content (trivia, polls, predictions, etc.) to the production database.
- All content data comes from user's spreadsheets - do not create fake/placeholder content.

### Design Preferences
- **CRITICAL - Game Components Distinction**:
  - **The Daily Call** (`DailyChallengeCard`) - Purple card at top of feed. Single featured daily game that expands when tapped. Uses command language ("PLAY NOW"), has urgency signal ("LIVE" badge). Whole card is tap target. Renamed from "Daily Challenge" to emphasize the prediction/opinion nature.
  - **Quick Trivia** (`TriviaCarousel`) - Dark purple carousel below. Contains 62+ trivia questions users can swipe through. Different from The Daily Call - this is a carousel of many questions, not a single featured game.
  - These are SEPARATE components and must remain distinct.
- **Track Page Design**: User loves the Track page design with blue gradient "Track Media" and purple gradient "Import History" buttons, stats cards showing Items Logged and Points Earned. This page is kept as a backpage (accessible via direct URL `/track`) but removed from bottom navigation. Features can be integrated into other areas of the app.
- **Hot Takes Feature**: Replaced "Conversations" with "Hot Takes" - a gamified opinion-sharing feature where users post bold entertainment takes, vote on the spiciest opinions, and compete for "Hottest Take" recognition. Uses upvoting system and special 🔥 branding.
- **Add Nav Icon - Previous Design (library stack)**: Diagonal line on top + two horizontal bars + plus above (SVG code preserved): `<svg width="24" height="22" viewBox="0 0 24 22" fill="none"><line x1="2" y1="7" x2="22" y2="2" stroke="white" strokeWidth="2.5" strokeLinecap="round" /><line x1="1" y1="13" x2="23" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" /><line x1="1" y1="19" x2="23" y2="19" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>` with `<Plus size={14} strokeWidth={2.5} />` above it.
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
- Netflix Import Fix: Uses TMDB API for movie/TV detection, with rate limiting and caching.
- Real-time unified Notification System.
- Engagement-focused Leaderboard System with 5 categories and 'Your Circle'/Global tabs.
- Unified Voting System for polls, predictions, and trivia.
- Comprehensive User Points System for various actions.
- Smart Recommendations: GPT-4o powered with caching.
- Creator Follow System.
- Spoiler Protection: Blurs content until revealed.
- Consumed vs User-Generated Content: Differentiates with a "🏆 Consumed" badge.
- Prediction Resolution: Supports timed/open-ended predictions with scoring.
- AI Builder (`/library-ai`): Customization of lists and tracking via visual builder and AI chat.
- DNA Levels System: Two-tier "Entertainment DNA" (survey-based) with friend comparison and unified insights.
- DNA Moments: Quick binary questions in the feed that build Entertainment DNA. Data stored in `dna_moments` and `dna_moment_responses` tables. Edge functions: `get-dna-moment`, `answer-dna-moment`.
- **Daily Call System**: Featured daily game driving engagement.
  - **Content**: `prediction_pools` table where `featured_date` = today's date.
  - **Responses**: `user_predictions` table.
  - **Streak Tracking**: `login_streaks` table.
  - **Edge Function**: `daily-challenge` with actions: `getToday`, `checkResponse`, `submit`.
  - **Client sends `localDate`**: Format `new Date().toLocaleDateString('en-CA')` for timezone.
  - **DO NOT use or create `daily_runs` table**.
- **Pools System**: Group prediction/trivia competitions.
  - Tables: `pools`, `pool_members`, `pool_prompts`, `pool_answers`.
  - Edge functions: `create-pool`, `join-pool`, `add-pool-prompt`, `submit-pool-answer`, `resolve-pool-prompt`, `get-pool-details`, `get-pool-leaderboard`, `get-user-pools`.
  - Routes: `/pools`, `/pool/:id`, `/pool/join/:code`.

### Feature Specifications
- Friend Profile Viewing: Access to Stats, DNA, Collections.
- Media Tracking: Simplified list-based system with privacy.
- AI-Powered Search: Unified search for conversations, recommendations, and media.
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

### Key Supabase Tables (Production Schema)
**CRITICAL: Always use these exact table/column names - don't invent new tables!**

- **users**: `id`, `display_name`, `user_name`, `avatar`, `points`, `email`
- **prediction_pools**: `id`, `title`, `type`, `options`, `correct_answer`, `featured_date`, `status`, `points_reward`
- **user_predictions**: `id`, `user_id`, `pool_id`, `prediction`, `points_earned`, `is_winner`, `created_at`
- **login_streaks**: `user_id`, `last_login`, `current_streak`, `longest_streak`
- **dna_profiles**: User entertainment DNA survey data
- **dna_moments**: Quick binary DNA questions
- **dna_moment_responses**: User answers to DNA moments

### System Design Choices
- Database Schema: Strict naming conventions, synced dev/prod.
- Row Level Security (RLS): Strict RLS for data privacy.
- Edge Functions: Adhere to schema, handle user auto-creation, accept `user_id`.
- Privacy Toggle System: Controls list visibility.

### CRITICAL: Media Data Requirements (DO NOT BREAK)
When adding media to lists, ranks, or social posts, the following fields are REQUIRED:
- `image_url` - Full HTTPS URL to the poster image
- `external_id` - The source's unique ID
- `external_source` - The data source
- `title` - The media title

**Why this matters**: Empty `image_url` causes the activity feed to show random stock photos.

**Edge functions that add media MUST:**
1. Capture `image_url` from the API response at insert time.
2. Convert relative TMDB paths to full URLs.
3. Never insert media without at minimum: `title`, `external_id`, `external_source`, and `image_url`.

### CRITICAL: Media Search Display Requirements (DO NOT BREAK)
The `media-search` edge function MUST return these fields for search results to display properly:
- `poster_url`
- `image` (alias of `poster_url`)
- `creator`
- `title`
- `type`
- `year`
- `external_id`
- `external_source`

**If search results show placeholder icons instead of posters**: The deployed Supabase edge function is likely outdated. Re-deploy the `media-search` function.

### Supabase Edge Function Deployment
Edge functions in `supabase/functions/` are NOT automatically deployed. Changes require manual deployment:
```bash
supabase functions deploy <function-name>
# or
supabase functions deploy
```

## External Dependencies

-   **Database & Backend**: Supabase (PostgreSQL + Edge Functions)
-   **External APIs**:
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