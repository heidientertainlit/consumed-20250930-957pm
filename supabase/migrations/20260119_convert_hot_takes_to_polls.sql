-- Hot takes have been deprecated in favor of polls
-- This migration documents the decision and provides a template for future conversions

-- If any hot takes exist in the future, run this to convert them to polls:
-- INSERT INTO prediction_pools (id, title, description, type, status, category, icon, options, points_reward, origin_type, origin_user_id, created_at)
-- SELECT 'poll-from-hottake-' || id, LEFT(content, 100), content, 'vote', 'open', COALESCE(media_type, 'movie'), '🗳️', '["Agree", "Disagree"]'::jsonb, 10, COALESCE(origin_type, 'user'), user_id, created_at
-- FROM social_posts WHERE post_type = 'hot_take';

-- UPDATE social_posts SET post_type = 'poll', prediction_pool_id = 'poll-from-hottake-' || id WHERE post_type = 'hot_take';

-- Note: As of 2026-01-19, there are 0 hot takes in the database
-- All future opinion content will use the polls system with binary options (Agree/Disagree)
