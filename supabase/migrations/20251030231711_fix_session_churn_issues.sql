-- Fix critical issues with session and churn tracking

-- 1. Drop materialized view and replace with regular view (always fresh)
DROP MATERIALIZED VIEW IF EXISTS user_last_activity CASCADE;

CREATE OR REPLACE VIEW user_last_activity AS
WITH all_activity AS (
  -- Session activity
  SELECT 
    user_id,
    COALESCE(ended_at, last_heartbeat, started_at) as last_activity_at,
    'session' as activity_type
  FROM user_sessions
  
  UNION ALL
  
  -- List additions
  SELECT 
    user_id,
    created_at as last_activity_at,
    'list_add' as activity_type
  FROM list_items
  
  UNION ALL
  
  -- Social posts
  SELECT 
    user_id,
    created_at as last_activity_at,
    'post' as activity_type
  FROM social_posts
)
SELECT 
  user_id,
  MAX(last_activity_at) as last_activity_at,
  COUNT(*) as total_activities
FROM all_activity
GROUP BY user_id;

-- Remove the now-unnecessary refresh function
DROP FUNCTION IF EXISTS refresh_user_last_activity();

-- 2. Fix session engagement calculation (use SUM/SUM instead of AVG of AVG)
CREATE OR REPLACE FUNCTION get_session_engagement(period_text TEXT DEFAULT '7 days')
RETURNS TABLE (
  time_period TEXT,
  total_sessions BIGINT,
  total_users BIGINT,
  avg_session_duration_minutes NUMERIC,
  median_session_duration_minutes NUMERIC,
  total_time_spent_hours NUMERIC,
  avg_sessions_per_user NUMERIC,
  avg_daily_time_per_user_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH session_data AS (
    SELECT 
      user_id,
      COUNT(*) as session_count,
      SUM(duration_seconds) as total_duration,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) as median_duration
    FROM user_sessions
    WHERE started_at >= NOW() - period_text::INTERVAL
      AND duration_seconds > 0
      AND duration_seconds < 14400  -- Cap at 4 hours to filter heartbeat anomalies
    GROUP BY user_id
  ),
  overall_stats AS (
    SELECT
      SUM(session_count) as total_sessions,
      COUNT(*) as total_users,
      SUM(total_duration) as total_duration_seconds,
      AVG(median_duration) as avg_median_duration,
      AVG(session_count) as avg_sessions,
      AVG(total_duration) as avg_user_duration
    FROM session_data
  ),
  period_days AS (
    -- Extract days from period_text (e.g., '7 days' -> 7)
    SELECT EXTRACT(EPOCH FROM period_text::INTERVAL) / 86400 as days
  )
  SELECT 
    period_text::TEXT as time_period,
    total_sessions,
    total_users,
    -- Correct: total duration / total sessions = true average session duration
    CASE WHEN total_sessions > 0 
      THEN ROUND((total_duration_seconds::NUMERIC / total_sessions::NUMERIC) / 60, 2)
      ELSE 0
    END as avg_session_duration_minutes,
    ROUND(avg_median_duration / 60, 2) as median_session_duration_minutes,
    ROUND(total_duration_seconds / 3600, 2) as total_time_spent_hours,
    ROUND(avg_sessions, 2) as avg_sessions_per_user,
    -- Correct: avg time per user divided by number of days in period
    CASE WHEN period_days.days > 0 
      THEN ROUND((avg_user_duration / 60) / period_days.days, 2)
      ELSE 0
    END as avg_daily_time_per_user_minutes
  FROM overall_stats, period_days;
END;
$$ LANGUAGE plpgsql;

-- 3. Add helper function for session cleanup (will be called from edge function)
CREATE OR REPLACE FUNCTION end_session_by_id(p_session_id TEXT, p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET ended_at = NOW()
  WHERE session_id = p_session_id
    AND user_id = p_user_id
    AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
