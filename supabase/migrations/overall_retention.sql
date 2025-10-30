-- Overall (aggregate) retention rates across all users
CREATE OR REPLACE FUNCTION get_overall_retention()
RETURNS TABLE (
  metric TEXT,
  users_count BIGINT,
  rate NUMERIC
) AS $$
DECLARE
  total_users BIGINT;
  day1_users BIGINT;
  day7_users BIGINT;
  day30_users BIGINT;
BEGIN
  -- Get total users who signed up more than 30 days ago
  SELECT COUNT(*) INTO total_users 
  FROM users 
  WHERE created_at <= NOW() - INTERVAL '30 days';

  -- Day 1 retention: users who had activity the day after signup
  WITH user_signups AS (
    SELECT id, created_at::DATE as signup_date
    FROM users
    WHERE created_at <= NOW() - INTERVAL '30 days'
  ),
  user_actions AS (
    SELECT user_id, created_at::DATE as action_date FROM list_items
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_posts
    UNION ALL
    SELECT user_id, created_at::DATE FROM user_predictions
  )
  SELECT COUNT(DISTINCT us.id) INTO day1_users
  FROM user_signups us
  INNER JOIN user_actions ua ON us.id = ua.user_id
  WHERE ua.action_date = us.signup_date + 1;

  -- Day 7 retention: users who had activity 7 days after signup
  WITH user_signups AS (
    SELECT id, created_at::DATE as signup_date
    FROM users
    WHERE created_at <= NOW() - INTERVAL '30 days'
  ),
  user_actions AS (
    SELECT user_id, created_at::DATE as action_date FROM list_items
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_posts
    UNION ALL
    SELECT user_id, created_at::DATE FROM user_predictions
  )
  SELECT COUNT(DISTINCT us.id) INTO day7_users
  FROM user_signups us
  INNER JOIN user_actions ua ON us.id = ua.user_id
  WHERE ua.action_date BETWEEN us.signup_date + 6 AND us.signup_date + 8;

  -- Day 30 retention: users who had activity around 30 days after signup
  WITH user_signups AS (
    SELECT id, created_at::DATE as signup_date
    FROM users
    WHERE created_at <= NOW() - INTERVAL '30 days'
  ),
  user_actions AS (
    SELECT user_id, created_at::DATE as action_date FROM list_items
    UNION ALL
    SELECT user_id, created_at::DATE FROM social_posts
    UNION ALL
    SELECT user_id, created_at::DATE FROM user_predictions
  )
  SELECT COUNT(DISTINCT us.id) INTO day30_users
  FROM user_signups us
  INNER JOIN user_actions ua ON us.id = ua.user_id
  WHERE ua.action_date BETWEEN us.signup_date + 28 AND us.signup_date + 32;

  RETURN QUERY
  SELECT 'Day 1 Retention' as metric, day1_users, 
    ROUND((day1_users::NUMERIC / NULLIF(total_users, 0)) * 100, 1) as rate
  UNION ALL
  SELECT 'Day 7 Retention', day7_users,
    ROUND((day7_users::NUMERIC / NULLIF(total_users, 0)) * 100, 1)
  UNION ALL
  SELECT 'Day 30 Retention', day30_users,
    ROUND((day30_users::NUMERIC / NULLIF(total_users, 0)) * 100, 1);
END;
$$ LANGUAGE plpgsql;
