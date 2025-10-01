-- Supabase Lists Schema with RLS for Sharing
-- Run this in your Supabase SQL Editor

-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL, -- Supabase auth.uid() as text
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  is_default BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT true,
  share_id TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'base64url'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create list_items table  
CREATE TABLE IF NOT EXISTS list_items (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Supabase auth.uid() as text
  title TEXT NOT NULL,
  creator TEXT,
  media_type TEXT NOT NULL, -- movie, tv, book, music, game, sports
  category TEXT, -- horror, comedy, drama, etc.
  external_id TEXT,
  external_source TEXT, -- tmdb, spotify, espn, thesportsdb, etc.
  image_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Sports-specific fields
  game_date TIMESTAMP WITH TIME ZONE,
  home_team TEXT,
  away_team TEXT,
  home_score INTEGER,
  away_score INTEGER,
  sport_league TEXT,
  venue TEXT,
  game_status TEXT
);

-- Create predefined list types (9 total)
INSERT INTO lists (user_id, title, description, is_default, visibility) VALUES
  ('system', 'Currently', 'Media you are currently consuming', true, 'private'),
  ('system', 'Queue', 'Media you want to consume later', true, 'private'),
  ('system', 'Finished', 'Media you have completed', true, 'private'),
  ('system', 'Did Not Finish', 'Media you started but didn''t complete', true, 'private'),
  ('system', 'Favorites', 'Your all-time favorite media', true, 'private')
ON CONFLICT DO NOTHING;

-- Enable RLS on both tables
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Option 1: Public Discovery with Private Default

-- Lists: Users can view their own lists OR public lists from others
CREATE POLICY "view_lists" ON lists
  FOR SELECT USING (
    auth.uid()::text = user_id OR 
    visibility = 'public' OR
    user_id = 'system'
  );

-- Lists: Users can only modify their own lists (not system lists)
CREATE POLICY "modify_own_lists" ON lists
  FOR INSERT, UPDATE, DELETE USING (
    auth.uid()::text = user_id AND user_id != 'system'
  );

-- List Items: Users can view items from their own lists OR public lists
CREATE POLICY "view_list_items" ON list_items
  FOR SELECT USING (
    auth.uid()::text = user_id OR 
    list_id IN (
      SELECT id FROM lists 
      WHERE visibility = 'public' OR user_id = 'system'
    )
  );

-- List Items: Users can only modify items in their own lists
CREATE POLICY "modify_own_list_items" ON list_items
  FOR INSERT, UPDATE, DELETE USING (
    auth.uid()::text = user_id
  );

-- Social feed tables
CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT,
  media_title TEXT,
  media_type TEXT,
  media_creator TEXT,
  media_image_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on social tables
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for social posts (public read, authenticated write)
CREATE POLICY "view_social_posts" ON social_posts FOR SELECT USING (true);
CREATE POLICY "create_own_social_posts" ON social_posts FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "update_own_social_posts" ON social_posts FOR UPDATE USING (auth.uid()::text = user_id);

-- RLS policies for likes
CREATE POLICY "view_social_likes" ON social_post_likes FOR SELECT USING (true);
CREATE POLICY "manage_own_social_likes" ON social_post_likes FOR ALL USING (auth.uid()::text = user_id);

-- RLS policies for comments
CREATE POLICY "view_social_comments" ON social_post_comments FOR SELECT USING (true);
CREATE POLICY "create_social_comments" ON social_post_comments FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "update_own_social_comments" ON social_post_comments FOR UPDATE USING (auth.uid()::text = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_visibility ON lists(visibility);
CREATE INDEX IF NOT EXISTS idx_lists_share_id ON lists(share_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_user_id ON list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_social_post_likes_post_id ON social_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_id ON social_post_comments(post_id);

-- Update trigger for lists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();