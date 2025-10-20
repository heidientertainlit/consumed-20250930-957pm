-- Migration: Add Comment Likes Support (Phase 1)
-- Safe, additive-only changes - does not modify existing tables/data

-- Step 1: Add likes_count and parent_comment_id to social_post_comments
ALTER TABLE social_post_comments 
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES social_post_comments(id) ON DELETE CASCADE;

-- Step 2: Create social_comment_likes table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS social_comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES social_post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate likes from same user
  UNIQUE(comment_id, user_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON social_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON social_comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON social_post_comments(parent_comment_id);

-- Step 4: Row Level Security (RLS) Policies

-- Enable RLS on social_comment_likes
ALTER TABLE social_comment_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all comment likes
CREATE POLICY "Comment likes are viewable by everyone"
  ON social_comment_likes FOR SELECT
  USING (true);

-- Policy: Users can only insert their own likes
CREATE POLICY "Users can insert their own comment likes"
  ON social_comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own likes
CREATE POLICY "Users can delete their own comment likes"
  ON social_comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Step 5: Verification queries (comment these out after testing)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'social_post_comments';
-- SELECT * FROM social_comment_likes LIMIT 1;
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'social_comment_likes';
