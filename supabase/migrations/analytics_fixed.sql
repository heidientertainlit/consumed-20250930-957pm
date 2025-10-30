-- ========================================
-- CONSUMED ANALYTICS FUNCTIONS (FIXED)
-- Using correct table/column names from schema
-- ========================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_active_users(TEXT);
DROP FUNCTION IF EXISTS get_stickiness_ratio();
DROP FUNCTION IF EXISTS get_retention_rates();
DROP FUNCTION IF EXISTS get_engaged_users();
DROP FUNCTION IF EXISTS get_activation_funnel();
DROP FUNCTION IF EXISTS get_engagement_depth();
DROP FUNCTION IF EXISTS get_social_graph_metrics();
DROP FUNCTION IF EXISTS get_dashboard_summary();

-- ========================================
-- 1. DAILY/WEEKLY/MONTHLY ACTIVE USERS
-- ========================================

CREATE OR REPLACE FUNCTION get_active_users(
  period TEXT DEFAULT 'day'
)
RETURNS TABLE (
  period_date DATE,
  active_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_actions AS (
    SELECT user_id, created_at::DATE as action_date FROM list_items
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_posts
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_post_comments
    UNION ALL
    SELECT user_id, created_at::DATE FROM user_predictions
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_post_likes
  )
  SELECT 
    CASE 
      WHEN period = 'day' THEN action_date
      WHEN period = 'week' THEN DATE_TRUNC('week', action_date)::DATE
      WHEN period = 'month' THEN DATE_TRUNC('month', action_date)::DATE
    END as period_date,
    COUNT(DISTINCT user_id) as active_users
  FROM user_actions
  WHERE action_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY period_date
  ORDER BY period_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. STICKINESS RATIO (DAU/MAU)
-- ========================================

CREATE OR REPLACE FUNCTION get_stickiness_ratio()
RETURNS TABLE (
  ratio NUMERIC,
  dau BIGINT,
  mau BIGINT
) AS $$
DECLARE
  daily_active BIGINT;
  monthly_active BIGINT;
BEGIN
  -- Get DAU
  WITH user_actions AS (
    SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '1 day'
  )
  SELECT COUNT(DISTINCT user_id) INTO daily_active FROM user_actions;

  -- Get MAU
  WITH user_actions AS (
    SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT COUNT(DISTINCT user_id) INTO monthly_active FROM user_actions;

  RETURN QUERY
  SELECT 
    CASE 
      WHEN monthly_active > 0 THEN ROUND((daily_active::NUMERIC / monthly_active::NUMERIC) * 100, 2)
      ELSE 0
    END as ratio,
    daily_active as dau,
    monthly_active as mau;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. RETENTION RATES (Day 1, 7, 30)
-- ========================================

CREATE OR REPLACE FUNCTION get_retention_rates()
RETURNS TABLE (
  cohort_date DATE,
  total_users BIGINT,
  day_1_retained BIGINT,
  day_1_rate NUMERIC,
  day_7_retained BIGINT,
  day_7_rate NUMERIC,
  day_30_retained BIGINT,
  day_30_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH cohorts AS (
    SELECT 
      created_at::DATE as signup_date,
      id as user_id
    FROM users
    WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
  ),
  user_actions AS (
    SELECT user_id, created_at::DATE as action_date FROM list_items
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_posts
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_post_comments
    UNION ALL
    SELECT user_id, created_at::DATE FROM user_predictions
  )
  SELECT 
    c.signup_date as cohort_date,
    COUNT(DISTINCT c.user_id) as total_users,
    COUNT(DISTINCT CASE WHEN ua.action_date = c.signup_date + 1 THEN c.user_id END) as day_1_retained,
    ROUND((COUNT(DISTINCT CASE WHEN ua.action_date = c.signup_date + 1 THEN c.user_id END)::NUMERIC / NULLIF(COUNT(DISTINCT c.user_id), 0)) * 100, 2) as day_1_rate,
    COUNT(DISTINCT CASE WHEN ua.action_date = c.signup_date + 7 THEN c.user_id END) as day_7_retained,
    ROUND((COUNT(DISTINCT CASE WHEN ua.action_date = c.signup_date + 7 THEN c.user_id END)::NUMERIC / NULLIF(COUNT(DISTINCT c.user_id), 0)) * 100, 2) as day_7_rate,
    COUNT(DISTINCT CASE WHEN ua.action_date = c.signup_date + 30 THEN c.user_id END) as day_30_retained,
    ROUND((COUNT(DISTINCT CASE WHEN ua.action_date = c.signup_date + 30 THEN c.user_id END)::NUMERIC / NULLIF(COUNT(DISTINCT c.user_id), 0)) * 100, 2) as day_30_rate
  FROM cohorts c
  LEFT JOIN user_actions ua ON c.user_id = ua.user_id
  GROUP BY c.signup_date
  ORDER BY c.signup_date DESC
  LIMIT 30;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. ACTIVE ENGAGED USERS (OMTM)
-- ========================================

CREATE OR REPLACE FUNCTION get_engaged_users()
RETURNS TABLE (
  week_start DATE,
  total_weekly_users BIGINT,
  engaged_users BIGINT,
  engagement_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_weekly_actions AS (
    SELECT 
      DATE_TRUNC('week', all_actions.created_at)::DATE as action_week,
      all_actions.user_id,
      COUNT(*) as action_count
    FROM (
      SELECT user_id, created_at FROM list_items
      UNION ALL
      SELECT user_id, created_at FROM social_posts
      UNION ALL
      SELECT user_id, created_at FROM social_post_comments
      UNION ALL
      SELECT user_id, created_at FROM user_predictions
      UNION ALL
      SELECT user_id, created_at FROM social_post_likes
    ) all_actions
    WHERE all_actions.created_at >= CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY action_week, all_actions.user_id
  )
  SELECT 
    uwa.action_week as week_start,
    COUNT(DISTINCT uwa.user_id) as total_weekly_users,
    COUNT(DISTINCT CASE WHEN uwa.action_count >= 2 THEN uwa.user_id END) as engaged_users,
    ROUND((COUNT(DISTINCT CASE WHEN uwa.action_count >= 2 THEN uwa.user_id END)::NUMERIC / NULLIF(COUNT(DISTINCT uwa.user_id), 0)) * 100, 2) as engagement_rate
  FROM user_weekly_actions uwa
  GROUP BY uwa.action_week
  ORDER BY uwa.action_week DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. ACTIVATION FUNNEL
-- ========================================

CREATE OR REPLACE FUNCTION get_activation_funnel()
RETURNS TABLE (
  step TEXT,
  users_completed BIGINT,
  completion_rate NUMERIC
) AS $$
DECLARE
  total_signups BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_signups FROM users;

  RETURN QUERY
  SELECT 'Signed Up' as step, total_signups, 100.00 as completion_rate
  UNION ALL
  SELECT 
    'Tracked Media',
    COUNT(DISTINCT user_id),
    ROUND((COUNT(DISTINCT user_id)::NUMERIC / NULLIF(total_signups, 0)) * 100, 2)
  FROM list_items
  UNION ALL
  SELECT 
    'Played Game',
    COUNT(DISTINCT user_id),
    ROUND((COUNT(DISTINCT user_id)::NUMERIC / NULLIF(total_signups, 0)) * 100, 2)
  FROM user_predictions
  UNION ALL
  SELECT 
    'Connected with Friend',
    COUNT(DISTINCT user_id),
    ROUND((COUNT(DISTINCT user_id)::NUMERIC / NULLIF(total_signups, 0)) * 100, 2)
  FROM friendships
  WHERE status = 'accepted'
  UNION ALL
  SELECT 
    'Posted to Feed',
    COUNT(DISTINCT user_id),
    ROUND((COUNT(DISTINCT user_id)::NUMERIC / NULLIF(total_signups, 0)) * 100, 2)
  FROM social_posts;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. ENGAGEMENT DEPTH
-- ========================================

CREATE OR REPLACE FUNCTION get_engagement_depth()
RETURNS TABLE (
  metric TEXT,
  value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_action_counts AS (
    SELECT 
      user_id,
      COUNT(*) as total_actions
    FROM (
      SELECT user_id, created_at FROM list_items
      UNION ALL
      SELECT user_id, created_at FROM social_posts
      UNION ALL
      SELECT user_id, created_at FROM social_post_comments
      UNION ALL
      SELECT user_id, created_at FROM user_predictions
      UNION ALL
      SELECT user_id, created_at FROM social_post_likes
    ) all_actions
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY user_id
  )
  SELECT 'Avg Actions per User (7d)' as metric, ROUND(AVG(total_actions), 2) as value FROM user_action_counts
  UNION ALL
  SELECT 
    'Avg Items Tracked per User',
    ROUND(AVG(item_count), 2)
  FROM (
    SELECT user_id, COUNT(*) as item_count
    FROM list_items
    GROUP BY user_id
  ) user_items
  UNION ALL
  SELECT 
    'Avg Posts per User',
    ROUND(AVG(post_count), 2)
  FROM (
    SELECT user_id, COUNT(*) as post_count
    FROM social_posts
    GROUP BY user_id
  ) user_posts;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. SOCIAL GRAPH DENSITY
-- ========================================

CREATE OR REPLACE FUNCTION get_social_graph_metrics()
RETURNS TABLE (
  metric TEXT,
  value NUMERIC
) AS $$
DECLARE
  total_users BIGINT;
  users_with_friends BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  
  SELECT COUNT(DISTINCT user_id) INTO users_with_friends 
  FROM friendships 
  WHERE status = 'accepted';

  RETURN QUERY
  SELECT 
    '% Users with Friends' as metric,
    ROUND((users_with_friends::NUMERIC / NULLIF(total_users, 0)) * 100, 2) as value
  UNION ALL
  SELECT 
    'Avg Friends per User',
    ROUND(AVG(friend_count), 2)
  FROM (
    SELECT user_id, COUNT(*) as friend_count
    FROM friendships
    WHERE status = 'accepted'
    GROUP BY user_id
  ) user_friends
  UNION ALL
  SELECT 
    'Total Friendships',
    COUNT(*)::NUMERIC / 2
  FROM friendships
  WHERE status = 'accepted';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. DASHBOARD SUMMARY
-- ========================================

CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS TABLE (
  total_users BIGINT,
  dau BIGINT,
  wau BIGINT,
  mau BIGINT,
  stickiness_ratio NUMERIC,
  engagement_rate NUMERIC,
  total_media_tracked BIGINT,
  total_posts BIGINT,
  total_games_played BIGINT,
  avg_actions_per_user NUMERIC
) AS $$
DECLARE
  daily_active BIGINT;
  weekly_active BIGINT;
  monthly_active BIGINT;
  stickiness NUMERIC;
  engaged_pct NUMERIC;
  avg_actions NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;

  -- DAU
  WITH user_actions AS (
    SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '1 day'
    UNION
    SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '1 day'
  )
  SELECT COUNT(DISTINCT user_id) INTO daily_active FROM user_actions;

  -- WAU
  WITH user_actions AS (
    SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '7 days'
  )
  SELECT COUNT(DISTINCT user_id) INTO weekly_active FROM user_actions;

  -- MAU
  WITH user_actions AS (
    SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION
    SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT COUNT(DISTINCT user_id) INTO monthly_active FROM user_actions;

  stickiness := CASE 
    WHEN monthly_active > 0 THEN ROUND((daily_active::NUMERIC / monthly_active::NUMERIC) * 100, 2)
    ELSE 0
  END;

  -- Engagement rate
  WITH user_weekly_actions AS (
    SELECT user_id, COUNT(*) as action_count
    FROM (
      SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '7 days'
    ) all_actions
    GROUP BY user_id
  )
  SELECT 
    ROUND((COUNT(CASE WHEN action_count >= 2 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2)
  INTO engaged_pct
  FROM user_weekly_actions;

  -- Avg actions
  WITH user_action_counts AS (
    SELECT user_id, COUNT(*) as total_actions
    FROM (
      SELECT user_id FROM list_items WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM social_posts WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM social_post_comments WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM user_predictions WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT user_id FROM social_post_likes WHERE created_at >= NOW() - INTERVAL '7 days'
    ) all_actions
    GROUP BY user_id
  )
  SELECT ROUND(AVG(total_actions), 2) INTO avg_actions FROM user_action_counts;

  RETURN QUERY
  SELECT 
    total_users,
    daily_active as dau,
    weekly_active as wau,
    monthly_active as mau,
    stickiness as stickiness_ratio,
    COALESCE(engaged_pct, 0) as engagement_rate,
    (SELECT COUNT(*) FROM list_items) as total_media_tracked,
    (SELECT COUNT(*) FROM social_posts) as total_posts,
    (SELECT COUNT(*) FROM user_predictions) as total_games_played,
    COALESCE(avg_actions, 0) as avg_actions_per_user;
END;
$$ LANGUAGE plpgsql;
