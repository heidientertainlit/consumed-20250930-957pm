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
  media_type TEXT NOT NULL, -- movie, tv, book, music, game
  category TEXT, -- horror, comedy, drama, etc.
  external_id TEXT,
  external_source TEXT, -- tmdb, spotify, etc.
  image_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create predefined list types (9 total)
INSERT INTO lists (user_id, title, description, is_default, visibility) VALUES
  ('system', 'Currently', 'Media you are currently consuming', true, 'private'),
  ('system', 'Read', 'Books you have finished reading', true, 'private'),
  ('system', 'To Read', 'Books you want to read', true, 'private'),
  ('system', 'Watched', 'Movies and TV shows you have watched', true, 'private'),
  ('system', 'To Watch', 'Movies and TV shows you want to watch', true, 'private'),
  ('system', 'Listened', 'Music and podcasts you have listened to', true, 'private'),
  ('system', 'To Listen', 'Music and podcasts you want to listen to', true, 'private'),
  ('system', 'Played', 'Games you have completed', true, 'private'),
  ('system', 'To Play', 'Games you want to play', true, 'private')
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_visibility ON lists(visibility);
CREATE INDEX IF NOT EXISTS idx_lists_share_id ON lists(share_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_user_id ON list_items(user_id);

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