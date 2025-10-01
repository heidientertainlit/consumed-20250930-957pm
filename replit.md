# consumed - Entertainment Consumption Tracking MVP

## Overview

consumed is a simplified entertainment consumption tracking MVP that allows users to track and share their entertainment consumption with five main pages: Track (for logging consumption), Leaderboard (for consumption-based rankings), Feed (for activity streams), Friends & Creators (for discovering and following people), and Play (for trivia, predictions, and "Blends" - finding common media for groups). The app is designed as a mobile-first application featuring a sophisticated dark gradient theme with bottom navigation, comprehensive social features including Inner Circle for Super Fan identification, and an Entertainment DNA onboarding survey.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 1, 2025 - EMERGENCY DATABASE ROLLBACK: Fixed Critical RLS Policy Issues**
- **CRITICAL ISSUE**: Bad database constraints and duplicate RLS policies broke media tracking functionality
- **ROOT CAUSE**: Accidentally added `unique_user_list_type` constraint on lists table preventing users from tracking media
- **SYMPTOMS**: "Failed to create user: duplicate key value violates unique constraint" errors on all media tracking attempts
- **RESOLUTION STEPS TAKEN**:
  1. Dropped bad constraint: `ALTER TABLE lists DROP CONSTRAINT unique_user_list_type`
  2. Made display_name nullable: `ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL`
  3. Removed 20+ duplicate/conflicting RLS policies from list_items and lists tables
  4. Kept only 4 clean policies: `final_lists_select`, `final_lists_modify`, `final_items_select`, `final_items_modify`
- **WORKING RLS POLICIES** (DO NOT MODIFY THESE):
  - Lists SELECT: Allow auth.uid() = user_id OR visibility = 'public' OR user_id IS NULL (for system lists)
  - Lists MODIFY: Allow auth.uid() = user_id only
  - List Items SELECT: Allow auth.uid() = user_id OR list_id in public/system lists
  - List Items MODIFY: Allow auth.uid() = user_id only
- **LESSON LEARNED**: Never add unique constraints on (user_id, title) or (user_id, media_type) - users need to track the same media/lists multiple times
- **STATUS**: ✅ All functionality restored and tested - Track, Lists, Feed, Share, Profile all working

**September 30, 2025 - Production Architecture Cleanup**
- **UNIFIED LEADERBOARD SYSTEM**: Moved ALL leaderboard categories to single edge function for consistency and Vercel deployment
  - All categories (media-based, game-based, fan points) now use `get-leaderboards` edge function
  - Removed direct frontend database queries for cleaner architecture
  - Centralized authentication and data aggregation logic
  - Better performance with server-side processing
- **UI IMPROVEMENTS**: Removed profile icon from top bar (kept in bottom navigation only)
  - Cleaner top navigation with just search and notifications
  - Profile access via bottom navigation maintains consistency
- **EDIT PROFILE**: Implemented profile editing with display name and username changes
  - Username validation: 3-20 characters, alphanumeric + underscores
  - Real-time uniqueness checking
  - Direct Supabase updates with error handling
  - Auto-refresh after successful update

**September 30, 2025 - Profile Page Improvements: Real Favorite Creators & Compact Overview**
- **FAVORITE CREATORS**: Now computed from actual user media consumption instead of mock data
  - Aggregates creators across all tracked media (deduped by media_id)
  - Calculates "fan points" based on consumption count per creator
  - Determines role (Director, Author, Artist, Podcaster, Studio) from dominant media type
  - Shows top 3 creators with empty state when no data available
  - Added data-testid attributes for testing: `text-creator-name-{index}`, `text-creator-points-{index}`
- **COMPACT OVERVIEW**: Redesigned Media History overview section for better space efficiency
  - Reduced from large card-based layout to compact pill-shaped badges
  - Only shows media types with counts > 0
  - Reduced vertical space by ~60% to improve filtered media visibility
  - Maintains responsive wrapping for mobile devices
- **IMPLEMENTATION**: Uses useMemo for performance, handles edge cases (missing creators, multiple creators per item, null values)

**September 30, 2025 - Unified Share System with Feature Flags**
- **IMPLEMENTED**: Created unified sharing system (`/src/lib/share.ts`) for all share actions across the app
- **FEATURE FLAG**: VITE_FEATURE_SHARES environment variable controls share behavior (false on Replit, true on Vercel)
- **SHARE TYPES**: Supports 5 share kinds - list, media, prediction, post, edna (Entertainment DNA)
- **URL FORMAT**: Clean, human-readable URLs like `/list/{id}`, `/prediction/{id}`, `/edna/{id}`
- **REPLIT MODE**: Shares text blurbs with formatted URLs via mobile share sheet or clipboard
- **VERCEL MODE**: Will share real deep links with preview cards when VITE_FEATURE_SHARES=true
- **UPDATED COMPONENTS**: Play page (Invite to Play), User Profile (Share List, Share DNA), List Share Modal
- **NO BREAKING CHANGES**: All existing edge functions preserved, share-update in Feed untouched as requested

**Environment Variables Required:**
- ✅ VITE_SUPABASE_URL: Supabase project URL
- ✅ VITE_SUPABASE_ANON_KEY: Supabase anon key
- ✅ VITE_APP_URL: Public app URL (Replit or Vercel)
- ✅ VITE_FEATURE_SHARES: "false" on Replit, "true" on Vercel for deep link sharing

**September 25, 2025 - CRITICAL FIX: Media Search Functionality**
- **RESOLVED**: Fixed media search discrepancy between Track Media page and Share Update dialog
- **ROOT CAUSE**: Spotify API authentication issue - function was looking for SPOTIFY_ACCESS_TOKEN but we had SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET
- **SOLUTION**: Implemented OAuth2 client credentials flow for Spotify API authentication
- **RESULT**: Both dialogs now return identical real API results from Spotify, TMDB, YouTube, and Open Library
- **PROTECTED**: Cleaned up debug code and deployed stable function - NO MOCK/FALLBACK DATA as requested

**Working API Integration:**
- ✅ Spotify: OAuth2 client credentials flow using SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET
- ✅ TMDB: Direct API key authentication using TMDB_API_KEY
- ✅ YouTube: Direct API key authentication using YOUTUBE_API_KEY  
- ✅ Open Library: No authentication required
- ✅ All APIs returning real data, no synthetic content

## System Architecture

The application follows a modern full-stack architecture with a clear separation between frontend and backend concerns:

### Supabase Database Schema (EXACT COLUMN NAMES)

**users table:**
- id: uuid
- email: text
- user_name: text (CRITICAL: Always use user_name, NOT username!)
- display_name: text
- password: text
- avatar: text
- bio: text
- is_admin: boolean
- created_at: timestamp with time zone
- first_name: text
- last_name: text
- computed_favorite_media_types: jsonb
- computed_favorite_genres: jsonb

**list_items table:**
- id: uuid
- list_id: uuid
- user_id: uuid
- title: text
- type: text
- creator: text
- image_url: text
- notes: text (NOT review!)
- created_at: timestamp without time zone (NOT added_at!)
- media_type: text
- media_id: uuid

**lists table:**
- System lists have user_id = NULL
- Standard lists: Currently, Queue, Finished, Did Not Finish

### Working Edge Function Patterns (CRITICAL REFERENCE)

**Database structure:** System default lists have user_id = NULL, list_id = NULL represents "All Media"/general tracking
**Authentication pattern:** Supabase auth users must be auto-created in custom users table on first use to bridge auth.users and application users tables
**Database schema:** users table uses user_name column (CONFIRMED via Supabase dashboard - never username!), list_items table uses notes and created_at columns (not review/added_at)
**CRITICAL NAMING CONVENTION:** Always use user_name column name, never username - this is CONFIRMED from actual database structure and required across all edge functions and database operations
**RLS Requirements:** Must have policy allowing SELECT on lists where user_id IS NULL for authenticated users
**Edge function deployment:** All edge functions require user_name column references and auto-create logic

**Successful Implementation:**
- ✅ Auto-create users on first authentication
- ✅ Use exact Supabase column names: notes, created_at, type, media_type, image_url
- ✅ Query system lists with user_id IS NULL
- ✅ Handle list_id = NULL for "All" category
- ✅ Include proper error logging and handling
- ✅ RLS policy: CREATE POLICY "Allow reading system lists" ON public.lists FOR SELECT TO authenticated USING (user_id IS NULL)

### Frontend Architecture
- **React SPA**: Built with React 18 using TypeScript for type safety
- **Routing**: Uses Wouter for lightweight client-side routing
- **UI Framework**: Implements shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with a dark theme design system
- **State Management**: TanStack Query for server state management and API caching
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Development**: Hot reload with Vite middleware integration

## Key Components

### Database Schema
The application uses a simplified list-based tracking system:
- **Users**: Store user profiles with user_name column (not username)
- **Lists**: System default lists (user_id = NULL) for Currently, Queue, Finished, Did Not Finish
- **List Items**: Media items with notes and created_at columns (not review/added_at)

### API Routes
- `GET /api/pools` - Fetch all pools with optional category filtering
- `GET /api/pools/featured` - Get featured pools for homepage
- `GET /api/pools/:id` - Get specific pool details
- `POST /api/pools` - Create new prediction pools
- `POST /api/predictions` - Submit user predictions using points
- `GET /api/users/:id/predictions` - Get user's prediction history
- `GET /api/stats` - Platform statistics
- `POST /api/points/purchase` - Purchase points for pool entry (mock endpoint)

### Frontend Pages
- **Dashboard**: Main landing page with hero section, featured pools, and category filtering
- **My Pools**: User's prediction history and active pools
- **Leaderboard**: Top performers ranking system

### UI Components
- **Pool Cards**: Display pool information with join/view actions
- **Modals**: Create pool, pool details, and payment processing
- **Navigation**: Responsive navigation with user balance display
- **Category Filters**: Filter pools by entertainment category

## Data Flow

1. **Pool Creation**: Users create pools via modal form → API validates and stores in database
2. **Pool Discovery**: Users browse pools by category → API returns filtered results
3. **Prediction Submission**: Users select predictions → Payment modal → API processes payment and stores prediction
4. **Real-time Updates**: TanStack Query automatically refetches data and updates UI

## External Dependencies

### Core Libraries
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **drizzle-orm**: Type-safe ORM with schema validation
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI component primitives
- **wouter**: Lightweight React router
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **vite**: Build tool and dev server
- **typescript**: Type checking and compilation
- **drizzle-kit**: Database migrations and schema management

## Deployment Strategy

The application is designed for deployment on platforms like Replit with:

### Development Mode
- Vite dev server with HMR for frontend
- Express server with TypeScript compilation via tsx
- Shared TypeScript configuration for type safety across frontend/backend

### Production Build
- Frontend: Vite builds optimized static assets to `dist/public`
- Backend: esbuild bundles server code with external dependencies
- Database: Drizzle migrations run via `db:push` command

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- Automatic database provisioning check in Drizzle config
- Development-specific features (Replit integration, error overlays) conditionally loaded

The architecture emphasizes type safety, developer experience, and scalability while maintaining a clear separation of concerns between the client and server codebases.