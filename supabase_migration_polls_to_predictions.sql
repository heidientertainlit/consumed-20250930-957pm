-- ================================================================
-- MIGRATION: Consolidate Polls into Prediction Pools
-- Run this in Supabase SQL Editor
-- ================================================================

-- Step 1: Migrate active polls to prediction_pools as type='vote'
-- CRITICAL: Must copy options JSON so vote games remain functional
INSERT INTO prediction_pools (
  id,
  title,
  description,
  type,
  points_reward,
  deadline,
  status,
  category,
  icon,
  options,
  sponsor_name,
  sponsor_logo_url,
  sponsor_cta_url,
  created_at
)
SELECT 
  'poll_' || id::text as id,
  question as title,
  NULL as description,
  'vote' as type,
  COALESCE(points_reward, 1) as points_reward,
  COALESCE(expires_at::text, (NOW() + INTERVAL '7 days')::text) as deadline,
  CASE 
    WHEN status = 'active' THEN 'open'
    WHEN status = 'archived' THEN 'completed'
    ELSE 'open'
  END as status,
  'Play' as category,
  '🗳️' as icon,
  COALESCE(options, '[]'::jsonb) as options,  -- Copy options JSON
  sponsor_name,
  sponsor_logo_url,
  sponsor_cta_url,
  created_at
FROM polls
WHERE status = 'active'
ON CONFLICT (id) DO NOTHING;

-- Step 2: Migrate poll_responses to user_predictions
-- CRITICAL: Use correct column name (option_id, not selected_option_id)
INSERT INTO user_predictions (
  id,
  user_id,
  pool_id,
  prediction,
  points_earned,
  is_correct,
  created_at
)
SELECT 
  gen_random_uuid() as id,
  pr.user_id,
  'poll_' || pr.poll_id::text as pool_id,
  pr.option_id::text as prediction,  -- FIXED: Use option_id not selected_option_id
  COALESCE(p.points_reward, 1) as points_earned,
  true as is_correct,  -- Poll votes always earn points
  pr.created_at
FROM poll_responses pr
INNER JOIN polls p ON pr.poll_id = p.id
WHERE p.status = 'active'
ON CONFLICT DO NOTHING;

-- Step 3: Verify migration counts
SELECT 
  'Polls migrated:' as metric,
  COUNT(*) as count
FROM prediction_pools
WHERE id LIKE 'poll_%'
UNION ALL
SELECT 
  'Poll votes migrated:' as metric,
  COUNT(*) as count
FROM user_predictions
WHERE pool_id LIKE 'poll_%';

-- SUCCESS! Now update your frontend to use prediction_pools
-- and delete the get-leaderboards edge function
