-- Create poll_responses table on Supabase
-- This tracks user votes for polls

CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_id ON poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_user_id ON poll_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_user ON poll_responses(poll_id, user_id);

-- Add RLS policies
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

-- Users can view all poll responses
CREATE POLICY "Anyone can view poll responses"
  ON poll_responses FOR SELECT
  USING (true);

-- Users can only insert their own responses
CREATE POLICY "Users can insert their own responses"
  ON poll_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Prevent duplicate votes per user per poll (unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS unique_poll_user_response 
  ON poll_responses(poll_id, user_id);

-- Verify table was created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'poll_responses'
ORDER BY ordinal_position;
