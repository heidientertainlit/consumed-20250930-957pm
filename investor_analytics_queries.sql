-- ============================================================================
-- INVESTOR ANALYTICS QUERIES FOR CONSUMED APP
-- ============================================================================
-- Save each query section in Supabase SQL Editor as a separate "Saved Query"
-- Run regularly to track growth, engagement, retention, and feature adoption


-- ============================================================================
-- 📊 GROWTH METRICS
-- ============================================================================

-- 1. Total Users & New User Growth
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as new_users_today,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_this_week,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_this_month,
  ROUND(COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::numeric / 7, 2) as avg_new_users_per_day
FROM users;

-- 2. Daily Active Users (DAU) Trend - Last 30 Days
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as daily_active_users
FROM (
  SELECT user_id, created_at FROM list_items
  UNION ALL
  SELECT user_id, created_at FROM social_posts
  UNION ALL
  SELECT user_id, created_at FROM game_sessions
) activity
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 3. Weekly Active Users (WAU) Trend - Last 12 Weeks
SELECT 
  DATE_TRUNC('week', created_at) as week_start,
  COUNT(DISTINCT user_id) as weekly_active_users
FROM (
  SELECT user_id, created_at FROM list_items
  UNION ALL
  SELECT user_id, created_at FROM social_posts
  UNION ALL
  SELECT user_id, created_at FROM game_sessions
) activity
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

-- 4. Monthly Active Users (MAU) - Last 6 Months
SELECT 
  DATE_TRUNC('month', created_at) as month_start,
  COUNT(DISTINCT user_id) as monthly_active_users
FROM (
  SELECT user_id, created_at FROM list_items
  UNION ALL
  SELECT user_id, created_at FROM social_posts
  UNION ALL
  SELECT user_id, created_at FROM game_sessions
) activity
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month_start DESC;

-- 5. User Retention (7-day and 30-day)
WITH user_cohorts AS (
  SELECT 
    user_id,
    DATE(created_at) as signup_date
  FROM users
)
SELECT 
  uc.signup_date,
  COUNT(DISTINCT uc.user_id) as cohort_size,
  COUNT(DISTINCT CASE 
    WHEN activity.created_at BETWEEN uc.signup_date + INTERVAL '7 days' 
    AND uc.signup_date + INTERVAL '14 days' THEN uc.user_id 
  END) as retained_7_days,
  COUNT(DISTINCT CASE 
    WHEN activity.created_at BETWEEN uc.signup_date + INTERVAL '30 days' 
    AND uc.signup_date + INTERVAL '37 days' THEN uc.user_id 
  END) as retained_30_days,
  ROUND(100.0 * COUNT(DISTINCT CASE 
    WHEN activity.created_at BETWEEN uc.signup_date + INTERVAL '7 days' 
    AND uc.signup_date + INTERVAL '14 days' THEN uc.user_id 
  END) / NULLIF(COUNT(DISTINCT uc.user_id), 0), 2) as retention_rate_7d,
  ROUND(100.0 * COUNT(DISTINCT CASE 
    WHEN activity.created_at BETWEEN uc.signup_date + INTERVAL '30 days' 
    AND uc.signup_date + INTERVAL '37 days' THEN uc.user_id 
  END) / NULLIF(COUNT(DISTINCT uc.user_id), 0), 2) as retention_rate_30d
FROM user_cohorts uc
LEFT JOIN (
  SELECT user_id, created_at FROM list_items
  UNION ALL
  SELECT user_id, created_at FROM social_posts
  UNION ALL
  SELECT user_id, created_at FROM game_sessions
) activity ON uc.user_id = activity.user_id
WHERE uc.signup_date >= NOW() - INTERVAL '90 days'
GROUP BY uc.signup_date
ORDER BY uc.signup_date DESC;


-- ============================================================================
-- 🎯 ENGAGEMENT METRICS
-- ============================================================================

-- 6. Content Tracking Activity Summary
SELECT 
  COUNT(*) as total_items_tracked,
  COUNT(DISTINCT user_id) as active_trackers,
  ROUND(AVG(items_per_user), 2) as avg_items_per_user,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as items_tracked_this_week,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as items_tracked_this_month
FROM (
  SELECT 
    user_id,
    created_at,
    COUNT(*) OVER (PARTITION BY user_id) as items_per_user
  FROM list_items
  WHERE user_id IS NOT NULL
) t;

-- 7. User Activity Distribution (Power Users vs Casual)
SELECT 
  CASE 
    WHEN total_items >= 50 THEN 'Power User (50+)'
    WHEN total_items >= 20 THEN 'Active User (20-49)'
    WHEN total_items >= 5 THEN 'Regular User (5-19)'
    ELSE 'Casual User (1-4)'
  END as user_segment,
  COUNT(*) as user_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM (
  SELECT 
    user_id,
    COUNT(*) as total_items
  FROM list_items
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) user_activity
GROUP BY 
  CASE 
    WHEN total_items >= 50 THEN 'Power User (50+)'
    WHEN total_items >= 20 THEN 'Active User (20-49)'
    WHEN total_items >= 5 THEN 'Regular User (5-19)'
    ELSE 'Casual User (1-4)'
  END
ORDER BY MIN(total_items) DESC;

-- 8. Media Type Distribution
SELECT 
  media_type,
  COUNT(*) as items_tracked,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage_of_total
FROM list_items
WHERE user_id IS NOT NULL
GROUP BY media_type
ORDER BY items_tracked DESC;

-- 9. Activity by Day of Week
SELECT 
  TO_CHAR(created_at, 'Day') as day_of_week,
  EXTRACT(DOW FROM created_at) as day_num,
  COUNT(*) as total_actions,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT DATE(created_at)) as total_days,
  ROUND(COUNT(*)::numeric / COUNT(DISTINCT DATE(created_at)), 2) as avg_actions_per_day
FROM (
  SELECT user_id, created_at FROM list_items
  UNION ALL
  SELECT user_id, created_at FROM social_posts
  UNION ALL
  SELECT user_id, created_at FROM game_sessions
) activity
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
ORDER BY day_num;


-- ============================================================================
-- 🚀 FEATURE ADOPTION
-- ============================================================================

-- 10. Entertainment DNA Profile Completion Rate
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT dp.user_id) as users_with_dna_profile,
  ROUND(100.0 * COUNT(DISTINCT dp.user_id) / NULLIF(COUNT(DISTINCT u.id), 0), 2) as dna_completion_rate,
  COUNT(DISTINCT CASE WHEN dp.created_at >= NOW() - INTERVAL '7 days' THEN dp.user_id END) as new_profiles_this_week
FROM users u
LEFT JOIN dna_profiles dp ON u.id = dp.user_id;

-- 11. Social Features Usage
SELECT 
  COUNT(DISTINCT sp.user_id) as users_posting,
  COUNT(sp.id) as total_posts,
  ROUND(AVG(posts_per_user), 2) as avg_posts_per_user,
  COUNT(DISTINCT spl.user_id) as users_liking,
  COUNT(spl.id) as total_likes,
  COUNT(DISTINCT spc.user_id) as users_commenting,
  COUNT(spc.id) as total_comments,
  ROUND(100.0 * COUNT(DISTINCT sp.user_id) / NULLIF((SELECT COUNT(*) FROM users), 0), 2) as post_adoption_rate
FROM social_posts sp
LEFT JOIN social_post_likes spl ON sp.id = spl.post_id
LEFT JOIN social_post_comments spc ON sp.id = spc.post_id
CROSS JOIN LATERAL (
  SELECT COUNT(*) as posts_per_user
  FROM social_posts
  WHERE user_id = sp.user_id
) t;

-- 12. Game Participation & Engagement
SELECT 
  COUNT(DISTINCT user_id) as total_players,
  COUNT(*) as total_game_sessions,
  ROUND(AVG(sessions_per_user), 2) as avg_sessions_per_user,
  COUNT(DISTINCT CASE WHEN game_type = 'vote' THEN user_id END) as vote_players,
  COUNT(DISTINCT CASE WHEN game_type = 'trivia' THEN user_id END) as trivia_players,
  COUNT(DISTINCT CASE WHEN game_type = 'predict' THEN user_id END) as predict_players,
  ROUND(100.0 * COUNT(DISTINCT user_id) / NULLIF((SELECT COUNT(*) FROM users), 0), 2) as game_adoption_rate
FROM game_sessions
CROSS JOIN LATERAL (
  SELECT COUNT(*) as sessions_per_user
  FROM game_sessions gs
  WHERE gs.user_id = game_sessions.user_id
) t;

-- 13. Review Writing Engagement
SELECT 
  COUNT(DISTINCT user_id) as users_writing_reviews,
  COUNT(*) as total_reviews,
  ROUND(AVG(reviews_per_user), 2) as avg_reviews_per_user,
  COUNT(CASE WHEN LENGTH(notes) > 100 THEN 1 END) as detailed_reviews,
  ROUND(100.0 * COUNT(DISTINCT user_id) / NULLIF((SELECT COUNT(*) FROM users), 0), 2) as review_adoption_rate
FROM list_items
WHERE notes IS NOT NULL AND notes != ''
CROSS JOIN LATERAL (
  SELECT COUNT(*) as reviews_per_user
  FROM list_items li
  WHERE li.user_id = list_items.user_id AND notes IS NOT NULL AND notes != ''
) t;


-- ============================================================================
-- 💰 BUSINESS INTELLIGENCE
-- ============================================================================

-- 14. User Lifetime Value Indicators
SELECT 
  u.id as user_id,
  u.user_name,
  u.created_at as signup_date,
  EXTRACT(DAY FROM NOW() - u.created_at) as days_since_signup,
  COUNT(DISTINCT li.id) as total_items_tracked,
  COUNT(DISTINCT sp.id) as total_posts,
  COUNT(DISTINCT gs.id) as total_game_sessions,
  COALESCE(up.total_points, 0) as total_points,
  -- Engagement score: weighted formula
  (COUNT(DISTINCT li.id) * 1.0 + COUNT(DISTINCT sp.id) * 2.0 + COUNT(DISTINCT gs.id) * 1.5) as engagement_score,
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - MAX(GREATEST(
      COALESCE(li.created_at, '1900-01-01'),
      COALESCE(sp.created_at, '1900-01-01'),
      COALESCE(gs.created_at, '1900-01-01')
    ))) > 30 THEN 'At Risk'
    WHEN EXTRACT(DAY FROM NOW() - MAX(GREATEST(
      COALESCE(li.created_at, '1900-01-01'),
      COALESCE(sp.created_at, '1900-01-01'),
      COALESCE(gs.created_at, '1900-01-01')
    ))) > 14 THEN 'Declining'
    ELSE 'Active'
  END as user_status
FROM users u
LEFT JOIN list_items li ON u.id = li.user_id
LEFT JOIN social_posts sp ON u.id = sp.user_id
LEFT JOIN game_sessions gs ON u.id = gs.user_id
LEFT JOIN user_points up ON u.id = up.user_id
GROUP BY u.id, u.user_name, u.created_at, up.total_points
ORDER BY engagement_score DESC;

-- 15. Most Popular Content & Creators
SELECT 
  creator,
  media_type,
  COUNT(*) as times_tracked,
  COUNT(DISTINCT user_id) as unique_trackers,
  ROUND(100.0 * COUNT(DISTINCT user_id) / NULLIF((SELECT COUNT(DISTINCT user_id) FROM list_items), 0), 2) as tracker_penetration
FROM list_items
WHERE creator IS NOT NULL AND user_id IS NOT NULL
GROUP BY creator, media_type
ORDER BY times_tracked DESC
LIMIT 50;

-- 16. User Tenure Analysis
SELECT 
  CASE 
    WHEN days_active < 7 THEN '< 1 week'
    WHEN days_active < 30 THEN '1-4 weeks'
    WHEN days_active < 90 THEN '1-3 months'
    WHEN days_active < 180 THEN '3-6 months'
    ELSE '6+ months'
  END as tenure_group,
  COUNT(*) as user_count,
  ROUND(AVG(total_items), 2) as avg_items_tracked,
  ROUND(AVG(total_points), 2) as avg_points
FROM (
  SELECT 
    u.id,
    EXTRACT(DAY FROM NOW() - u.created_at) as days_active,
    COUNT(DISTINCT li.id) as total_items,
    COALESCE(up.total_points, 0) as total_points
  FROM users u
  LEFT JOIN list_items li ON u.id = li.user_id
  LEFT JOIN user_points up ON u.id = up.user_id
  GROUP BY u.id, u.created_at, up.total_points
) t
GROUP BY tenure_group
ORDER BY MIN(days_active);

-- 17. Churn Risk Indicators
SELECT 
  COUNT(*) as at_risk_users,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM users), 0), 2) as percentage_at_risk
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM (
    SELECT user_id, created_at FROM list_items
    UNION ALL
    SELECT user_id, created_at FROM social_posts
    UNION ALL
    SELECT user_id, created_at FROM game_sessions
  ) activity
  WHERE activity.user_id = u.id
  AND activity.created_at >= NOW() - INTERVAL '14 days'
)
AND u.created_at < NOW() - INTERVAL '14 days';


-- ============================================================================
-- 📈 QUICK EXECUTIVE DASHBOARD
-- ============================================================================

-- 18. Executive Summary - All Key Metrics
SELECT 
  -- User Growth
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_this_week,
  (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_this_month,
  
  -- Engagement
  (SELECT COUNT(*) FROM list_items WHERE user_id IS NOT NULL) as total_items_tracked,
  (SELECT COUNT(*) FROM list_items WHERE created_at >= NOW() - INTERVAL '7 days') as items_tracked_this_week,
  (SELECT COUNT(DISTINCT user_id) FROM list_items WHERE created_at >= NOW() - INTERVAL '7 days') as active_users_this_week,
  
  -- Social
  (SELECT COUNT(*) FROM social_posts) as total_posts,
  (SELECT COUNT(*) FROM social_post_likes) as total_likes,
  (SELECT COUNT(*) FROM social_post_comments) as total_comments,
  
  -- Games
  (SELECT COUNT(*) FROM game_sessions) as total_game_sessions,
  (SELECT COUNT(DISTINCT user_id) FROM game_sessions) as total_game_players,
  
  -- DNA Profiles
  (SELECT COUNT(*) FROM dna_profiles) as dna_profiles_created,
  (SELECT ROUND(100.0 * COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM users), 0), 2) FROM dna_profiles) as dna_completion_rate;
