# Design Guidelines: Consumed - Entertainment Tracking App

## Design Approach
**Reference-Based**: Drawing inspiration from Letterboxd, TV Time, and Spotify's content-rich interfaces. Focus on immersive visual content cards with sophisticated dark gradients that enhance entertainment media presentation.

## Core Design Principles
- **Mobile-First**: Prioritize thumb-reachable zones, bottom navigation, and single-column scrolling
- **Visual Hierarchy**: Large media cards with gradient overlays to showcase content
- **Dark Sophistication**: Deep gradient backgrounds transitioning from near-black to dark purple hues
- **Content-Forward**: Media thumbnails and posters drive the visual experience

## Typography System
**Fonts**: Google Fonts - Inter (UI elements), Poppins (headings)

**Scale**:
- Hero/Display: 2.5rem (40px), bold, Poppins
- Page Titles: 1.75rem (28px), semibold, Poppins
- Section Headers: 1.25rem (20px), semibold, Inter
- Card Titles: 1rem (16px), medium, Inter
- Body: 0.875rem (14px), regular, Inter
- Small/Meta: 0.75rem (12px), regular, Inter

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Card padding: p-4
- Section spacing: py-8 or py-12
- Element gaps: gap-4 or gap-6
- Bottom nav height: h-16

**Container Strategy**:
- Main content: px-4 (consistent mobile padding)
- Max-width: none (full viewport width for mobile)
- Card grids: 2-column on mobile landscape, single-column portrait

## Component Library

### Navigation
**Bottom Nav Bar**: Fixed position, glass-morphism effect with backdrop blur, height h-16, contains 5 icons (Home, Search, Add, Library, Profile). Active state: purple-600 with glow effect. Safe area padding for mobile devices.

### Hero Section
**Spotlight Carousel**: Full-width cards with vertical gradient overlays (black to transparent). Each card: aspect ratio 16:9, contains featured media poster, title overlay at bottom, "Track Now" button with backdrop-blur-md and semi-transparent purple background, auto-rotating every 5 seconds.

### Content Cards
**Media Card (Standard)**: Rounded-lg corners, poster image with 2:3 aspect ratio, gradient overlay on hover, title below poster, rating stars and year metadata, quick-add button in top-right corner.

**Activity Card**: Horizontal layout with small square thumbnail (left), content details (center), timestamp (right), subtle border bottom separator.

**Stats Card**: Glass-morphism background, large number display, descriptive label, icon accent in purple-600.

### Forms & Inputs
**Search Bar**: Full-width, rounded-full, dark background with purple-600 border on focus, search icon left, clear button right, height h-12.

**Filter Chips**: Rounded-full, small padding (px-4 py-2), outline style when inactive, filled purple-600 when active, horizontally scrollable container.

**Rating Input**: Interactive star system, 5 stars, purple-600 filled color, touch-friendly spacing (minimum 44px tap target).

### Lists & Grids
**Scrollable Media Grid**: 2-column grid (grid-cols-2), gap-4, infinite scroll loading pattern, skeleton loaders for loading states.

**Timeline Feed**: Single column, alternating activity cards, pull-to-refresh interaction, "Load More" button at bottom.

### Modals & Overlays
**Detail Modal**: Slide-up animation from bottom, full-height on mobile, rounded top corners, handle bar for swipe-to-dismiss, backdrop blur on background content.

**Action Sheet**: Bottom-anchored, rounded top corners, list of actions with icons, cancel button at bottom separated by gap.

### Buttons
**Primary (Purple)**: bg-purple-600, text-white, rounded-lg, px-6 py-3, medium font weight, full-width on mobile.

**Secondary**: border-purple-600, text-purple-600, same sizing as primary.

**Icon Buttons**: Square (44x44px minimum), purple-600 icon color, subtle background on active.

**Buttons on Images**: backdrop-blur-md, bg-purple-600/80 (80% opacity), text-white, rounded-lg.

## Spacing & Rhythm
**Vertical Spacing**:
- Section headers to content: mb-6
- Between card rows: gap-8
- Content sections: py-12
- Bottom nav clearance: pb-20 (accounts for fixed nav)

**Horizontal Spacing**:
- Screen edges: px-4
- Card internal: p-4
- Between inline elements: gap-4

## Gradient Backgrounds
**Primary Background**: Linear gradient from slate-950 (top) to purple-950/50 (bottom), fixed attachment.

**Card Overlays**: Linear gradient from transparent (top) to black/80 (bottom) for media cards.

**Glass Effects**: backdrop-blur-xl with bg-white/5 for floating elements.

## Images

### Hero Carousel Images
**Placement**: Top of home screen, immediately below status bar
**Specifications**: 16:9 aspect ratio, featuring popular entertainment media posters (movies/TV shows)
**Treatment**: Vertical gradient overlay from transparent (top 40%) to rgba(0,0,0,0.9) at bottom
**Text Positioning**: Title and metadata in bottom third with backdrop-blurred purple button

### Media Card Thumbnails
**Placement**: Throughout all list/grid views
**Specifications**: 2:3 portrait posters for movies/shows, square 1:1 for albums/games
**Treatment**: Subtle shadow (shadow-xl), rounded corners (rounded-lg)
**Count**: 10-20 visible per scrollable view

### Profile Headers
**Placement**: Top of profile sections
**Specifications**: 3:1 wide banner, user's favorite media collage
**Treatment**: Gradient overlay, profile picture overlapping bottom edge

## Animations
**Scroll Behavior**: Smooth scrolling with momentum, pull-to-refresh indicator with subtle bounce.

**Card Interactions**: Scale transform (scale-105) on active press, 200ms transition.

**Navigation**: Bottom nav icons animate with scale and color transition on tap.

**Modal Entries**: Slide-up animation (300ms ease-out) for bottom sheets, fade-in (200ms) for overlays.

## Screen Templates

**Home**: Hero carousel, "Continue Watching" horizontal scroll, "Recently Added" grid, "Trending Now" section, activity feed.

**Search**: Search bar (sticky), filter chips (horizontal scroll), results grid, recent searches list.

**Add/Track**: Media type selector (Movies/TV/Games/Books), search integration, quick-add from trending, manual entry form.

**Library**: Tab navigation (All/Movies/TV/Games/Books), view toggle (grid/list), sort dropdown, filterable content grid.

**Profile**: Header banner, stats cards (3-column grid), activity timeline, preferences/settings list.