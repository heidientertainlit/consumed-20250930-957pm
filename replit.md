# entertainlit - Entertainment Consumption Tracking MVP

## Overview

entertainlit is a simplified entertainment consumption tracking MVP called that allows users to track and share their entertainment consumption with five main pages: Track (for logging consumption), Leaderboard (for consumption-based rankings), Feed (for activity streams), Friends & Creators (for discovering and following people), and Play (for trivia, predictions, and "Blends" - finding common media for groups). The app is designed as a mobile-first application featuring a sophisticated dark gradient theme with bottom navigation, comprehensive social features including Inner Circle for Super Fan identification, and an Entertainment DNA onboarding survey.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack architecture with a clear separation between frontend and backend concerns:

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
The application uses three main entities:
- **Users**: Store user profiles, points balance, and total winnings in points
- **Pools**: Prediction pools with categories, options, total points, and resolution states
- **Predictions**: User predictions linked to pools with points spent and points won

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