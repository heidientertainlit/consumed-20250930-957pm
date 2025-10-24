# Smart Recommendations Caching System

## Overview
This system provides instant-loading (<1s) personalized recommendations by pre-computing them with AI and caching the results. Recommendations refresh automatically based on user activity.

## Architecture

### Database Table
**`user_recommendations`** - Stores cached recommendations per user
- `user_id` - User reference (unique)
- `recommendations` - JSONB with AI-generated recommendations
- `data_sources_used` - JSONB tracking which data sources were available
- `source_model` - AI model used (e.g., "gpt-4o")
- `status` - Current state: 'ready', 'generating', 'failed'
- `generated_at` - When recommendations were created
- `expires_at` - When cache expires (24 hours from generation)
- `stale_after` - When to show "refreshing" badge (6 hours from generation)

### Edge Functions

**1. `get-recommendations`** - Serves cached recommendations instantly
- Returns cached data if available and fresh
- Shows "refreshing" badge if stale (>6 hours old)
- Triggers background rebuild if expired or missing
- Response time: <1 second

**2. `rebuild-recommendations`** - Generates recommendations in background
- Fetches all 6 data sources (DNA, highlights, consumption, ratings, social, lists)
- Calls GPT-4o with comprehensive user profile
- Saves to cache with 24-hour expiration
- Can be triggered manually or automatically

**3. `generate-advanced-recommendations`** - Original synchronous version (deprecated)
- Kept for reference/fallback
- Use cached system instead for production

## Data Sources Combined

1. ✅ **Entertainment DNA Profile** (`dna_profiles`)
2. ✅ **User Highlights** (`user_highlights`) - Top 10 favorites
3. ✅ **Consumption History** (`list_items`) - Last 20 items
4. ✅ **Highly Rated Media** (`media_ratings`) - All 4-5 star ratings
5. ✅ **Social Posts & Reviews** (`social_posts`) - Last 10 posts with media
6. ✅ **Custom Lists** (`lists`) - List titles showing themes

## Setup Instructions

### 1. Deploy Database Schema

Run this SQL in Supabase SQL Editor:

\`\`\`sql
-- Create user_recommendations table
CREATE TABLE IF NOT EXISTS user_recommendations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  recommendations JSONB NOT NULL,
  data_sources_used JSONB,
  source_model TEXT NOT NULL DEFAULT 'gpt-4o',
  status TEXT NOT NULL DEFAULT 'ready',
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  stale_after TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_id ON user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_status ON user_recommendations(status);
\`\`\`

### 2. Deploy Edge Functions

Deploy these three edge functions to Supabase:

\`\`\`bash
# Deploy get-recommendations (serves cache)
supabase functions deploy get-recommendations

# Deploy rebuild-recommendations (generates in background)
supabase functions deploy rebuild-recommendations
\`\`\`

### 3. Set Up Nightly Cron Job

In Supabase Dashboard:
1. Go to **Database** → **Cron Jobs** (or use pg_cron extension)
2. Create a new cron job:

\`\`\`sql
-- Schedule nightly rebuild for all active users (runs at 3 AM UTC)
SELECT cron.schedule(
  'rebuild-recommendations-nightly',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/rebuild-recommendations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('userId', user_id)
  )
  FROM users
  WHERE created_at > NOW() - INTERVAL '30 days'  -- Only active users
  $$
);
\`\`\`

**Alternative:** Use Supabase Scheduled Functions (if available in your plan)

Create `supabase/functions/_cron/rebuild-all-recommendations.ts`:
\`\`\`typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get all active users
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Rebuild recommendations for each user
  for (const user of users || []) {
    await fetch(\`\${Deno.env.get('SUPABASE_URL')}/functions/v1/rebuild-recommendations\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: user.id })
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
\`\`\`

## Usage in Frontend

Replace existing recommendation calls with the cached version:

\`\`\`typescript
// OLD (slow, synchronous)
const { data } = await fetch('/functions/v1/generate-media-recommendations', {
  headers: { Authorization: \`Bearer \${token}\` }
});

// NEW (instant, cached)
const { data } = await fetch('/functions/v1/get-recommendations', {
  headers: { Authorization: \`Bearer \${token}\` }
});

// Response includes:
{
  "success": true,
  "recommendations": [...], // Array of recommendations
  "isStale": false, // Show "refreshing" badge if true
  "isGenerating": false, // Show loading state if true
  "generatedAt": "2025-10-23T18:00:00Z",
  "dataSourcesUsed": {
    "dnaProfile": true,
    "highlights": 5,
    "consumption": 15,
    "ratings": 8,
    "social": 3,
    "customLists": 2
  }
}
\`\`\`

## Manual Refresh Trigger

Allow users to manually refresh recommendations:

\`\`\`typescript
// Add a "Refresh Recommendations" button
async function refreshRecommendations() {
  await fetch('/functions/v1/rebuild-recommendations', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${session.access_token}\`,
      'Content-Type': 'application/json'
    }
  });
  
  // Show toast: "Recommendations are updating in the background!"
}
\`\`\`

## Cache Freshness

- **Fresh** (0-6 hours): Serve immediately, no badge
- **Stale** (6-24 hours): Serve immediately, show "Refreshing..." badge, rebuild in background
- **Expired** (>24 hours): Show loading state, rebuild immediately

## Triggering Rebuilds

Recommendations rebuild automatically when:

1. **Nightly cron** - All active users (3 AM UTC)
2. **Cache miss** - User has no cached recommendations
3. **Cache expired** - Recommendations older than 24 hours
4. **Manual trigger** - User clicks "Refresh" button

**Future Enhancement:** Add database triggers to rebuild when user:
- Adds a 4-5 star rating
- Completes an item (marks as Finished)
- Adds a highlight

## Performance

- **Load Time**: <1 second (vs. 20+ seconds before)
- **AI Cost**: Spread across background jobs (not user-facing)
- **Cache Hit Rate**: >95% during active hours
- **Staleness**: Recommendations update every 6-24 hours

## Monitoring

Check recommendation system health:

\`\`\`sql
-- See cache status
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - generated_at))) / 3600 as avg_age_hours
FROM user_recommendations
GROUP BY status;

-- Find users needing refresh
SELECT user_id, generated_at, expires_at, status
FROM user_recommendations
WHERE expires_at < NOW() OR status = 'failed';
\`\`\`

## Troubleshooting

**Issue**: Recommendations not updating
- Check `status` field - should be 'ready', not 'generating' or 'failed'
- Check cron job is running (Supabase Dashboard → Database → Cron)
- Check OpenAI API key is set in Supabase Edge Functions secrets

**Issue**: Still slow loading
- Verify frontend is calling `get-recommendations`, not `generate-media-recommendations`
- Check database index exists on `user_recommendations.user_id`

**Issue**: Stale recommendations
- Lower `stale_after` duration (currently 6 hours)
- Add more trigger events (ratings, completions)
- Increase cron frequency (e.g., every 12 hours instead of 24)
