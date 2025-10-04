
-- User Highlights Table
-- Stores up to 3 media highlights per user for their profile

CREATE TABLE IF NOT EXISTS user_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  creator TEXT,
  media_type TEXT NOT NULL, -- 'movie', 'tv', 'book', 'music', 'podcast', 'game', 'mixed'
  image_url TEXT,
  description TEXT,
  external_id TEXT, -- ID from external API (TMDB, Spotify, etc.)
  external_source TEXT, -- 'tmdb', 'spotify', 'google_books', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_highlights_user_id ON user_highlights(user_id);

-- RLS Policies
ALTER TABLE user_highlights ENABLE ROW LEVEL SECURITY;

-- Users can read their own highlights
CREATE POLICY "Users can view their own highlights"
  ON user_highlights FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own highlights (max 3 enforced in edge function)
CREATE POLICY "Users can insert their own highlights"
  ON user_highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own highlights
CREATE POLICY "Users can delete their own highlights"
  ON user_highlights FOR DELETE
  USING (auth.uid() = user_id);

-- Anyone can view highlights for public profiles (for future profile viewing)
CREATE POLICY "Anyone can view highlights"
  ON user_highlights FOR SELECT
  USING (true);
