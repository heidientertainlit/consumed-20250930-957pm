-- ========================================
-- SESSION TRACKING & CHURN ANALYTICS
-- Comprehensive session management and user retention metrics
-- ========================================

-- 1. Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
      WHEN last_heartbeat IS NOT NULL THEN EXTRACT(EPOCH FROM (last_heartbeat - started_at))::INTEGER
      ELSE 0
    END
  ) STORED,
  client_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

-- RLS Policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. Create materialized view for user last activity
CREATE MATERIALIZED VIEW IF NOT EXISTS user_last_activity AS
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

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_last_activity_user_id ON user_last_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_last_activity_date ON user_last_activity(last_activity_at DESC);

-- 3. Function to refresh user_last_activity (call nightly)
CREATE OR REPLACE FUNCTION refresh_user_last_activity()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_last_activity;
END;
$$ LANGUAGE plpgsql;

-- 4. Churn Metrics Function
CREATE OR REPLACE FUNCTION get_churn_metrics(period_days INTEGER DEFAULT 30)
RETURNS TABLE (
  churn_period TEXT,
  total_users BIGINT,
  active_users BIGINT,
  at_risk_users BIGINT,
  churned_users BIGINT,
  churn_rate NUMERIC,
  at_risk_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ula.last_activity_at >= NOW() - (period_days || ' days')::INTERVAL) as active,
      COUNT(*) FILTER (WHERE ula.last_activity_at < NOW() - (period_days || ' days')::INTERVAL 
                        AND ula.last_activity_at >= NOW() - ((period_days * 2) || ' days')::INTERVAL) as at_risk,
      COUNT(*) FILTER (WHERE ula.last_activity_at < NOW() - ((period_days * 2) || ' days')::INTERVAL) as churned
    FROM user_last_activity ula
  )
  SELECT 
    period_days || ' days'::TEXT as churn_period,
    total as total_users,
    active as active_users,
    at_risk as at_risk_users,
    churned as churned_users,
    CASE WHEN total > 0 THEN ROUND((churned::NUMERIC / total::NUMERIC) * 100, 2) ELSE 0 END as churn_rate,
    CASE WHEN total > 0 THEN ROUND((at_risk::NUMERIC / total::NUMERIC) * 100, 2) ELSE 0 END as at_risk_rate
  FROM user_stats;
END;
$$ LANGUAGE plpgsql;

-- 5. Session Engagement Function (Time Spent)
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
  WITH session_stats AS (
    SELECT 
      user_id,
      COUNT(*) as session_count,
      AVG(duration_seconds) as avg_duration,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) as median_duration,
      SUM(duration_seconds) as total_duration
    FROM user_sessions
    WHERE started_at >= NOW() - period_text::INTERVAL
      AND duration_seconds > 0
      AND duration_seconds < 14400  -- Cap at 4 hours to filter heartbeat anomalies
    GROUP BY user_id
  )
  SELECT 
    period_text::TEXT as time_period,
    SUM(session_count) as total_sessions,
    COUNT(*) as total_users,
    ROUND(AVG(avg_duration) / 60, 2) as avg_session_duration_minutes,
    ROUND(AVG(median_duration) / 60, 2) as median_session_duration_minutes,
    ROUND(SUM(total_duration) / 3600, 2) as total_time_spent_hours,
    ROUND(AVG(session_count), 2) as avg_sessions_per_user,
    ROUND(AVG(total_duration) / 60, 2) as avg_daily_time_per_user_minutes
  FROM session_stats;
END;
$$ LANGUAGE plpgsql;

-- 6. Fix Trending Content to be dynamic based on user count
CREATE OR REPLACE FUNCTION get_trending_content()
RETURNS TABLE (
  media_type TEXT,
  title TEXT,
  creator TEXT,
  external_id TEXT,
  external_source TEXT,
  adds_count BIGINT,
  posts_count BIGINT,
  total_engagement BIGINT
) AS $$
DECLARE
  min_user_threshold INTEGER;
  total_user_count INTEGER;
BEGIN
  -- Dynamic threshold: require fewer users for small datasets
  SELECT COUNT(DISTINCT user_id) INTO total_user_count FROM list_items;
  
  min_user_threshold := CASE 
    WHEN total_user_count < 10 THEN 1
    WHEN total_user_count < 50 THEN 2
    ELSE 3
  END;

  RETURN QUERY
  WITH 
  recent_adds AS (
    SELECT 
      list_items.media_type,
      list_items.title,
      list_items.creator,
      list_items.external_id,
      list_items.external_source,
      COUNT(DISTINCT list_items.user_id) as add_count
    FROM list_items
    WHERE list_items.created_at >= NOW() - INTERVAL '7 days'
      AND list_items.title IS NOT NULL
      AND list_items.title != ''
      AND LENGTH(list_items.title) >= 2
      AND list_items.title !~ '^[0-9:\.]+$'
      AND list_items.title NOT LIKE '%@%'
      AND list_items.title NOT ILIKE '%gmail%'
      AND list_items.title NOT ILIKE '%yahoo%'
      AND list_items.title NOT ILIKE '%hotmail%'
      AND list_items.title != 'undefined'
      AND list_items.title != 'null'
      AND list_items.external_id IS NOT NULL
    GROUP BY list_items.media_type, list_items.title, list_items.creator, list_items.external_id, list_items.external_source
    HAVING COUNT(DISTINCT list_items.user_id) >= min_user_threshold
  ),
  post_engagement AS (
    SELECT 
      social_posts.media_external_id as external_id,
      social_posts.media_external_source as external_source,
      COUNT(*) as post_count
    FROM social_posts
    WHERE social_posts.created_at >= NOW() - INTERVAL '7 days'
      AND social_posts.media_external_id IS NOT NULL
    GROUP BY social_posts.media_external_id, social_posts.media_external_source
  )
  SELECT 
    ra.media_type::TEXT,
    ra.title::TEXT,
    ra.creator::TEXT,
    ra.external_id::TEXT,
    ra.external_source::TEXT,
    ra.add_count as adds_count,
    COALESCE(pe.post_count, 0) as posts_count,
    ra.add_count + COALESCE(pe.post_count, 0) as total_engagement
  FROM recent_adds ra
  LEFT JOIN post_engagement pe 
    ON ra.external_id = pe.external_id 
    AND ra.external_source = pe.external_source
  ORDER BY total_engagement DESC, ra.add_count DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
