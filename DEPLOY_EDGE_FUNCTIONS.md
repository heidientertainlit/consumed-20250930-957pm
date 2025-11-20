# Deploying Supabase Edge Functions

## Media Grouping Feature

The feed now includes media grouping - when multiple friends interact with the same media item, their activities are grouped together for better readability.

### Required: Deploy Updated Edge Function

The `social-feed` edge function has been updated with media grouping logic. **You must deploy this function manually** for the feature to work.

## Deployment Options

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click on the `social-feed` function (or create it if it doesn't exist)
4. Copy the contents of `supabase/functions/social-feed/index.ts`
5. Paste into the dashboard editor
6. Click **Deploy**

### Option 2: Supabase CLI

If you have Supabase CLI configured with your project:

```bash
# Navigate to your project root
cd /path/to/your/project

# Deploy the social-feed function
npx supabase functions deploy social-feed --project-ref YOUR_PROJECT_REF
```

To find your project reference:
1. Go to Supabase Dashboard → Settings → General
2. Copy the "Reference ID"

## How It Works

Once deployed, the feed will automatically:

1. **Group media posts**: When 2+ users interact with the same media (same `media_external_id` and `media_external_source`)
2. **Display inline**: Shows activities like "Emma finished it • Rachel added it to 'Watch Next' • Sarah rated it ★★★★☆"
3. **Show overflow**: Displays "+N more" when there are more than 3 activities
4. **Maintain timeline**: Grouped items appear at the timestamp of the most recent activity

## What Changed

- **Edge Function**: `supabase/functions/social-feed/index.ts`
  - Added media grouping logic
  - Fixed rating display for fractional ratings (4.5 stars)
  - Improved timestamp handling

- **Frontend**: `client/src/pages/feed.tsx`
  - Added support for `media_group` type
  - Created grouped media card component
  - Inline activity display with overflow indicator

## Testing

After deployment:
1. Have multiple users interact with the same media item
2. Check the feed - these activities should appear grouped together
3. Verify the "→ See what they said" link appears
4. Confirm "+N more" shows when there are 4+ activities

## Rollback

If you need to revert:
1. Keep the old version of `social-feed/index.ts` 
2. Redeploy using the same steps above
3. The frontend will gracefully handle both grouped and ungrouped posts
