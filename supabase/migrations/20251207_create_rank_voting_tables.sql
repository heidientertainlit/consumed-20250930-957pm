-- Create rank_item_votes table for community voting
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS rank_item_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_item_id UUID NOT NULL REFERENCES rank_items(id) ON DELETE CASCADE,
  voter_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Unique constraint to prevent duplicate votes
  CONSTRAINT unique_rank_item_vote UNIQUE (rank_item_id, voter_id)
);

-- Add up_vote_count and down_vote_count to rank_items if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rank_items' AND column_name = 'up_vote_count') THEN
    ALTER TABLE rank_items ADD COLUMN up_vote_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rank_items' AND column_name = 'down_vote_count') THEN
    ALTER TABLE rank_items ADD COLUMN down_vote_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add rank_id to social_posts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'social_posts' AND column_name = 'rank_id') THEN
    ALTER TABLE social_posts ADD COLUMN rank_id UUID REFERENCES ranks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rank_item_votes_rank_item_id ON rank_item_votes(rank_item_id);
CREATE INDEX IF NOT EXISTS idx_rank_item_votes_voter_id ON rank_item_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_rank_id ON social_posts(rank_id);

-- Enable RLS on rank_item_votes
ALTER TABLE rank_item_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for rank_item_votes
CREATE POLICY "Users can view all votes" ON rank_item_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own votes" ON rank_item_votes
  FOR INSERT WITH CHECK (auth.uid()::text = voter_id);

CREATE POLICY "Users can delete their own votes" ON rank_item_votes
  FOR DELETE USING (auth.uid()::text = voter_id);
