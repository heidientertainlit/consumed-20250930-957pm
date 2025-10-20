-- Add parent_comment_id column for nested comment threads
-- Run this in your Supabase SQL Editor

ALTER TABLE social_post_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES social_post_comments(id) ON DELETE CASCADE;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_social_post_comments_parent 
ON social_post_comments(parent_comment_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'social_post_comments' 
ORDER BY ordinal_position;
