-- Track when users complete their full ballot (for tiebreaker)
CREATE TABLE IF NOT EXISTS awards_ballot_completions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_correct INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  UNIQUE(user_id, event_id)
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_ballot_completions_event ON awards_ballot_completions(event_id, total_correct DESC, completed_at ASC);

-- RLS - Note: Edge functions use service role to bypass RLS for writes
ALTER TABLE awards_ballot_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ballot completions are viewable by everyone" ON awards_ballot_completions FOR SELECT USING (true);

-- Atomic points increment function (uses TEXT to match users.id type)
CREATE OR REPLACE FUNCTION add_user_points(target_user_id TEXT, points_to_add INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET points = COALESCE(points, 0) + points_to_add
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
