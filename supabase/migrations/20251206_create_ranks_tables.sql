-- Create ranks table for ranked lists like "Top 10 90s Movies"
CREATE TABLE IF NOT EXISTS ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'public', -- 'public', 'private', 'friends'
  is_collaborative BOOLEAN DEFAULT false,
  max_items INTEGER DEFAULT 10, -- Default to Top 10
  category TEXT, -- 'movies', 'tv', 'books', 'music', 'mixed'
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create rank_items table for media items within a rank
CREATE TABLE IF NOT EXISTS rank_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_id UUID NOT NULL REFERENCES ranks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, -- 1-based position for ordering
  title TEXT NOT NULL,
  media_type TEXT, -- 'movie', 'tv', 'book', 'music', 'podcast', 'game'
  creator TEXT, -- Director, author, artist
  image_url TEXT,
  external_id TEXT,
  external_source TEXT, -- 'tmdb', 'spotify', 'openlibrary', 'youtube'
  notes TEXT, -- Personal notes about why it's ranked here
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for efficient rank ordering queries
CREATE INDEX IF NOT EXISTS idx_rank_items_rank_position ON rank_items(rank_id, position);

-- Create index for user's ranks
CREATE INDEX IF NOT EXISTS idx_ranks_user_id ON ranks(user_id);

-- Enable Row Level Security
ALTER TABLE ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ranks table
CREATE POLICY "Users can view public ranks or own ranks" ON ranks
  FOR SELECT USING (
    visibility = 'public' OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert own ranks" ON ranks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ranks" ON ranks
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own ranks" ON ranks
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for rank_items table
CREATE POLICY "Users can view rank items" ON rank_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ranks 
      WHERE ranks.id = rank_items.rank_id 
      AND (ranks.visibility = 'public' OR ranks.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert rank items" ON rank_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update rank items" ON rank_items
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete rank items" ON rank_items
  FOR DELETE USING (user_id = auth.uid());

-- Service role bypass policies for edge functions
CREATE POLICY "Service role can manage ranks" ON ranks
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage rank items" ON rank_items
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
