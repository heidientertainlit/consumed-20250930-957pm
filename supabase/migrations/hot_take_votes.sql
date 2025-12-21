-- Add fire_votes and ice_votes columns to social_posts table
ALTER TABLE social_posts 
ADD COLUMN IF NOT EXISTS fire_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ice_votes INTEGER DEFAULT 0;

-- Create hot_take_votes table for tracking user votes
CREATE TABLE IF NOT EXISTS hot_take_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('fire', 'ice')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hot_take_votes_post_id ON hot_take_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_hot_take_votes_user_id ON hot_take_votes(user_id);

-- Enable RLS
ALTER TABLE hot_take_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for hot_take_votes
CREATE POLICY "Users can view all votes" ON hot_take_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert votes" ON hot_take_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON hot_take_votes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON hot_take_votes
  FOR UPDATE USING (auth.uid() = user_id);
