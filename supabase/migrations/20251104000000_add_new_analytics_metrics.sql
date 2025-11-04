-- ========================================
-- ADDITIONAL ANALYTICS METRICS
-- Session Frequency, Points, Custom Lists
-- ========================================

-- Session Frequency (times per week user opens app)
CREATE OR REPLACE FUNCTION get_session_frequency(period_days INTEGER DEFAULT 7)
RETURNS TABLE (
  avg_sessions_per_user NUMERIC,
  median_sessions_per_user NUMERIC,
  total_unique_users BIGINT,
  total_sessions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_session_counts AS (
    SELECT 
      user_id,
      COUNT(DISTINCT session_id) as session_count
    FROM user_sessions
    WHERE started_at >= NOW() - (period_days || ' days')::INTERVAL
    GROUP BY user_id
  )
  SELECT 
    ROUND(AVG(session_count), 2) as avg_sessions_per_user,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY session_count) as median_sessions_per_user,
    COUNT(*)::BIGINT as total_unique_users,
    SUM(session_count)::BIGINT as total_sessions
  FROM user_session_counts;
END;
$$ LANGUAGE plpgsql;

-- Points Analytics
CREATE OR REPLACE FUNCTION get_points_analytics()
RETURNS TABLE (
  total_points_awarded BIGINT,
  avg_points_per_user NUMERIC,
  median_points_per_user NUMERIC,
  top_earner_points BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_points AS (
    SELECT 
      user_id,
      points
    FROM users
    WHERE points > 0
  )
  SELECT 
    COALESCE(SUM(points), 0)::BIGINT as total_points_awarded,
    COALESCE(ROUND(AVG(points), 2), 0) as avg_points_per_user,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY points), 0) as median_points_per_user,
    COALESCE(MAX(points), 0)::BIGINT as top_earner_points
  FROM user_points;
END;
$$ LANGUAGE plpgsql;

-- Custom Lists Analytics
CREATE OR REPLACE FUNCTION get_lists_analytics()
RETURNS TABLE (
  total_custom_lists BIGINT,
  avg_custom_lists_per_user NUMERIC,
  users_with_custom_lists BIGINT,
  total_collaborative_lists BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH custom_list_counts AS (
    SELECT 
      user_id,
      COUNT(*) as list_count
    FROM lists
    WHERE is_system = false
    GROUP BY user_id
  )
  SELECT 
    COALESCE(SUM(list_count), 0)::BIGINT as total_custom_lists,
    COALESCE(ROUND(AVG(list_count), 2), 0) as avg_custom_lists_per_user,
    COALESCE(COUNT(DISTINCT user_id), 0)::BIGINT as users_with_custom_lists,
    (SELECT COALESCE(COUNT(*), 0) FROM list_collaborators)::BIGINT as total_collaborative_lists
  FROM custom_list_counts;
END;
$$ LANGUAGE plpgsql;
