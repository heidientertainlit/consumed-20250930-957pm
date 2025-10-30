# Analytics Dashboard Deployment Guide

## Step 1: Deploy SQL Functions to Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/mahpgcogwpawvviapqza

2. Click **"SQL Editor"** in the left sidebar

3. Click **"New Query"**

4. Copy and paste the contents of `supabase/migrations/analytics_functions.sql` into the editor

5. Click **"Run"** to execute the SQL

This will create all the analytics functions in your database.

## Step 2: Deploy Edge Function

Run this command in your terminal:

```bash
npx supabase functions deploy get-analytics
```

## Step 3: Test the Analytics Dashboard

1. Navigate to: https://your-replit-app.dev/admin

2. You should see:
   - Total users, DAU/MAU metrics
   - Engagement rate
   - Charts for retention, activation, and engagement
   - Your North Star Metric (OMTM)

## What's Included

### Key Metrics
- **Total Users**: All registered users
- **DAU/WAU/MAU**: Daily, Weekly, Monthly Active Users
- **Stickiness Ratio**: DAU/MAU percentage (target: 20-30%)
- **Engagement Rate**: % of users taking 2+ actions per week (your OMTM)
- **Avg Actions/User**: Average user activity level

### Analytics Tabs

#### Overview
- Daily Active Users trend (last 30 days)
- Weekly Engagement Rate trend
- Social Graph Health (% users with friends, avg friends per user)
- Content Activity (media tracked, posts, games played)

#### Retention
- Day 1, 7, and 30 retention rates by cohort
- Shows how many users come back after signup

#### Engagement
- Engagement depth metrics
- Weekly active vs engaged users comparison
- Average actions per user

#### Activation
- Onboarding funnel completion rates
- Shows % of users completing key actions:
  - Signed up
  - Tracked media
  - Played game
  - Connected with friend
  - Posted to feed

### North Star Metric (OMTM)
**Active Engaged Users** = % of users taking 2+ entertainment actions per week

This is the single metric that captures your social, gamified, and media-driven engagement loop.

## Database Functions Created

1. `get_active_users(period)` - DAU/WAU/MAU tracking
2. `get_stickiness_ratio()` - DAU/MAU calculation
3. `get_retention_rates()` - Day 1, 7, 30 retention by cohort
4. `get_engaged_users()` - Weekly engagement rates (OMTM)
5. `get_activation_funnel()` - Onboarding completion rates
6. `get_engagement_depth()` - Average user activity metrics
7. `get_social_graph_metrics()` - Social network health
8. `get_dashboard_summary()` - Overall metrics snapshot

## API Endpoint

The edge function is available at:
```
https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics
```

Query parameters:
- No params = Get all metrics
- `?metric=summary` = Just the summary
- `?metric=retention` = Just retention data
- `?metric=engaged` = Just engaged users
- `?metric=activation` = Just activation funnel
- `?metric=engagement` = Just engagement depth
- `?metric=social` = Just social graph
- `?metric=active-users&period=day` = Active users (day/week/month)
- `?metric=stickiness` = Stickiness ratio

## For VC Presentations

Export data using the API endpoint and format into slides showing:
- User growth trends
- Retention improving over time (cohort analysis)
- Engagement rate above 20% benchmark
- Activation funnel conversion rates
- Social graph growing (network effects)

This dashboard gives you everything VCs want to see for early-stage consumer apps!
