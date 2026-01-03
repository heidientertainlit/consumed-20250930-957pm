-- Daily Challenges System
-- Run this migration in Supabase Dashboard > SQL Editor

-- Create daily_challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY,
  scheduled_date DATE NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('trivia', 'poll', 'predict', 'rank', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  options JSONB,
  correct_answer TEXT,
  points_reward INTEGER DEFAULT 10,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed')),
  category TEXT,
  icon TEXT DEFAULT '🎯',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(scheduled_date)
);

-- Create daily_challenge_responses table
CREATE TABLE IF NOT EXISTS daily_challenge_responses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  challenge_id TEXT NOT NULL REFERENCES daily_challenges(id),
  user_id UUID NOT NULL,
  response JSONB NOT NULL,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_status ON daily_challenges(status);
CREATE INDEX IF NOT EXISTS idx_dcr_challenge ON daily_challenge_responses(challenge_id);
CREATE INDEX IF NOT EXISTS idx_dcr_user ON daily_challenge_responses(user_id);

-- RLS Policies
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_responses ENABLE ROW LEVEL SECURITY;

-- Allow reading all daily challenges (public)
CREATE POLICY "Allow public read of daily challenges" ON daily_challenges
  FOR SELECT USING (true);

-- Allow users to read their own responses
CREATE POLICY "Users can view own responses" ON daily_challenge_responses
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own responses
CREATE POLICY "Users can insert own responses" ON daily_challenge_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sample data for testing (update dates as needed)
INSERT INTO daily_challenges (id, scheduled_date, challenge_type, title, description, options, correct_answer, points_reward, category, icon, status) VALUES
(
  'dc-2026-01-03',
  '2026-01-03',
  'poll',
  'What''s your entertainment resolution for 2026?',
  'Daily Challenge',
  '["Watch more movies", "Read more books", "Discover new music", "Binge less, enjoy more", "Try new genres"]'::jsonb,
  NULL,
  15,
  'Pop Culture',
  '🎯',
  'active'
),
(
  'dc-2026-01-04',
  '2026-01-04',
  'custom',
  'Tag a friend: Who would play them in a movie?',
  'Mention a friend and tell us which actor should play them!',
  NULL,
  NULL,
  20,
  'Fun',
  '🎬',
  'scheduled'
),
(
  'dc-2026-01-05',
  '2026-01-05',
  'trivia',
  'Which streaming platform launched first?',
  'Daily Trivia',
  '["Netflix", "Hulu", "Amazon Prime", "Disney+"]'::jsonb,
  'Netflix',
  15,
  'TV',
  '📺',
  'scheduled'
)
ON CONFLICT (id) DO NOTHING;
