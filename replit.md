# consumed - Entertainment Consumption Tracking MVP

## Overview

consumed is a simplified entertainment consumption tracking MVP that allows users to track and share their entertainment consumption with five main pages: Track (for logging consumption), Leaderboard (for consumption-based rankings), Feed (for activity streams), Friends & Creators (for discovering and following people), and Play (for trivia, predictions, and "Blends" - finding common media for groups). The app is designed as a mobile-first application featuring a sophisticated dark gradient theme with bottom navigation, comprehensive social features including Inner Circle for Super Fan identification, and an Entertainment DNA onboarding survey.

## User Preferences

Preferred communication style: Simple, everyday language.

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