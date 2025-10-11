-- Fix corrupted like and comment counts in social_posts table
-- Run this in Supabase SQL Editor to recalculate all counts from actual data

-- Step 1: Recalculate likes_count from social_post_likes table
UPDATE social_posts
SET likes_count = (
  SELECT COUNT(*)
  FROM social_post_likes
  WHERE social_post_likes.social_post_id = social_posts.id
);

-- Step 2: Recalculate comments_count from social_post_comments table
UPDATE social_posts
SET comments_count = (
  SELECT COUNT(*)
  FROM social_post_comments
  WHERE social_post_comments.social_post_id = social_posts.id
);

-- Step 3: Verify the counts (optional - check a few posts)
SELECT 
  id,
  content,
  likes_count,
  comments_count,
  (SELECT COUNT(*) FROM social_post_likes WHERE social_post_id = social_posts.id) as actual_likes,
  (SELECT COUNT(*) FROM social_post_comments WHERE social_post_id = social_posts.id) as actual_comments
FROM social_posts
WHERE content LIKE '%One of the best written shows%'
LIMIT 5;
