# consumed - Where Fans Come to Play

## Overview
Consumed is a mobile-first platform where entertainment becomes something you can play with. The core promise: it's not just about what you're consuming, it's how you FEEL about what you're consuming.

**New North Star (Jan 2026):** Games-first, tracking-second. Tracking happens in the background to fuel personalization, but the headline experience is Play → React → Compare.

## Product Philosophy: The Three Core Behaviors

### 1. PLAY (Primary Action)
Users actively engage with entertainment daily — ranking, voting, predicting, testing knowledge — in under a minute.
- Low effort
- Daily relevance  
- Something to DO, not manage

### 2. REACT (Secondary Action)
Users share opinions, disagree, explain themselves, respond to others — without creating content from scratch.
- Expression without pressure
- Hot takes that feel contextual, not shouty
- Conversation, not posting

### 3. SEE YOURSELF (Tertiary Action)
Users see patterns in their taste and how it compares to friends — agreements, arguments, correct predictions.
- Identity
- Social comparison
- Insight without spreadsheets

**Key Insight:** "Expression alone doesn't activate most people. Activation creates expression."

### User Flow Hierarchy
1. First action = PLAY (trivia, poll, prediction)
2. Second actions = REACT / COMPARE (see how friends answered, leaderboard movement)
3. Third actions = EXPLORE / TRACK (discover content, background tracking)

### Hero Card Strategy
Home shows ONE rotating hero card at a time:
- 🎯 Today's Trivia: "Can you get this right?" [Play Now]
- 🔥 Settle This: "Which finale stuck the landing?" [Vote]
- ⏰ Prediction Closing Soon: "Will this win Best Picture?" [Lock Your Pick]

After playing, users see: friend answers → leaderboard movement → related polls → hot takes → "want more?"

### Content Philosophy
- Consumed creates the prompts. Users create the reactions.
- People don't want to "Share a hot take" — they want to "Disagree with something specific"
- This keeps the app alive, not intimidating, not empty, not Reddit-y

### Future Ideas
- Watch-along games: Start predictions together when watching with friends/family
- Flexible timing: "You're watching Junior British Bake Off with your kid — both guess who wins, get points"

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
- DNA Moments: Quick binary questions in the feed that build Entertainment DNA while feeling like games. Shows % splits, friend answers, and earns points. Data stored in `dna_moments` and `dna_moment_responses` tables. Edge functions: `get-dna-moment`, `answer-dna-moment`.

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

### CRITICAL: Media Data Requirements (DO NOT BREAK)
When adding media to lists, ranks, or social posts, the following fields are REQUIRED:
- `image_url` - Full HTTPS URL to the poster image (from TMDB, Spotify, etc.)
- `external_id` - The source's unique ID (e.g., TMDB ID, Spotify track ID)
- `external_source` - The data source (e.g., 'tmdb', 'spotify', 'googlebooks')
- `title` - The media title

**Why this matters**: Empty `image_url` causes the activity feed to show random stock photos instead of actual posters. This has broken multiple times.

**Edge functions that add media MUST:**
1. Capture image_url from the API response at insert time
2. Convert relative TMDB paths (like `/xyz.jpg`) to full URLs (`https://image.tmdb.org/t/p/w300/xyz.jpg`)
3. Never insert media without at minimum: title, external_id, external_source, and image_url

**Safety net**: `supabase/functions/social-feed/index.ts` has a TMDB title-search fallback that repairs missing images, but this is a backup - not the primary solution. The fix should happen at data creation.

**Key edge functions handling media creation:**
- `add-to-list` - when adding items to lists
- `media-search` - when searching for media (should return full image URLs)
- `track-media` - when tracking media to lists
- `create-social-post` - when creating posts with media attachments

### CRITICAL: Media Search Display Requirements (DO NOT BREAK)
The `media-search` edge function MUST return these fields for search results to display properly:
- `poster_url` - Full HTTPS URL to the poster/cover image
- `image` - Alias of poster_url for frontend compatibility
- `creator` - Author name for books, director for movies, artist for music
- `title` - Media title
- `type` - Media type (movie, tv, book, music, podcast)
- `year` - Release year (extracted from release_date)
- `external_id` - Source API's unique ID
- `external_source` - Source name (tmdb, googlebooks, spotify)

**Frontend fields used in QuickAddModal search results:**
```javascript
const posterImage = result.poster_url || result.image_url || result.poster_path;
// Shows: result.title, result.type, result.year, result.creator
```

**If search results show placeholder icons instead of posters**: The deployed Supabase edge function is likely outdated. Re-deploy the `media-search` function.

### Supabase Edge Function Deployment
Edge functions in `supabase/functions/` are NOT automatically deployed. Changes to these files require manual deployment:
```bash
supabase functions deploy <function-name>
```
Or deploy all functions:
```bash
supabase functions deploy
```

**Common symptoms of outdated edge functions:**
- Search results showing placeholder icons instead of posters
- Missing author/creator names on books
- Wrong media types being returned
- New features not working despite code being correct

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