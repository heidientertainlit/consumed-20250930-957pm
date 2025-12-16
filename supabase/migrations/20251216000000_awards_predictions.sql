-- Awards Predictions Tables
-- For tracking user predictions on awards shows like Golden Globes, Oscars, etc.

-- Awards Events (Golden Globes 2026, Oscars 2026, etc.)
CREATE TABLE IF NOT EXISTS awards_events (
  id TEXT PRIMARY KEY, -- Use slug as ID for simplicity
  slug TEXT UNIQUE NOT NULL, -- e.g., "golden-globes-2026"
  name TEXT NOT NULL, -- e.g., "Golden Globes"
  year INTEGER NOT NULL,
  ceremony_date TIMESTAMPTZ, -- When the show airs
  deadline TIMESTAMPTZ, -- When predictions lock
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'locked', 'completed'
  banner_url TEXT, -- Hero image URL
  description TEXT,
  points_per_correct INTEGER DEFAULT 20, -- Points earned per correct pick
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Awards Categories (Best Picture, Best Actor, etc.)
CREATE TABLE IF NOT EXISTS awards_categories (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES awards_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Best Motion Picture - Drama"
  short_name TEXT NOT NULL, -- e.g., "Picture (Drama)"
  display_order INTEGER NOT NULL DEFAULT 0,
  winner_nominee_id TEXT, -- Set when resolved
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Awards Nominees (individual nominees per category)
CREATE TABLE IF NOT EXISTS awards_nominees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  category_id TEXT NOT NULL REFERENCES awards_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Person or film name (e.g., "Timothée Chalamet" or "Sinners")
  title TEXT, -- The film/show title (for actor categories)
  subtitle TEXT, -- Additional info (e.g., country for foreign films)
  poster_url TEXT, -- Poster or headshot URL
  tmdb_id TEXT, -- TMDB ID for fetching additional data
  tmdb_popularity DECIMAL DEFAULT 0, -- Cached buzz score
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Picks (one pick per user per category)
CREATE TABLE IF NOT EXISTS awards_picks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES awards_categories(id) ON DELETE CASCADE,
  nominee_id TEXT NOT NULL REFERENCES awards_nominees(id) ON DELETE CASCADE,
  is_correct BOOLEAN, -- Set when event is resolved
  points_earned INTEGER, -- Points earned for this pick
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id) -- One pick per category per user
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_awards_categories_event ON awards_categories(event_id);
CREATE INDEX IF NOT EXISTS idx_awards_nominees_category ON awards_nominees(category_id);
CREATE INDEX IF NOT EXISTS idx_awards_picks_user ON awards_picks(user_id);
CREATE INDEX IF NOT EXISTS idx_awards_picks_category ON awards_picks(category_id);
CREATE INDEX IF NOT EXISTS idx_awards_picks_user_category ON awards_picks(user_id, category_id);

-- RLS Policies
ALTER TABLE awards_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards_nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards_picks ENABLE ROW LEVEL SECURITY;

-- Everyone can read events, categories, nominees
CREATE POLICY "Awards events are viewable by everyone" ON awards_events FOR SELECT USING (true);
CREATE POLICY "Awards categories are viewable by everyone" ON awards_categories FOR SELECT USING (true);
CREATE POLICY "Awards nominees are viewable by everyone" ON awards_nominees FOR SELECT USING (true);

-- Users can view all picks (for insights/public ballots)
CREATE POLICY "Awards picks are viewable by everyone" ON awards_picks FOR SELECT USING (true);

-- Users can insert/update their own picks
CREATE POLICY "Users can insert their own picks" ON awards_picks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own picks" ON awards_picks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own picks" ON awards_picks FOR DELETE USING (auth.uid() = user_id);

-- Function to get category insights (aggregated pick data)
CREATE OR REPLACE FUNCTION get_category_insights(p_category_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_picks', COUNT(*),
    'nominee_counts', (
      SELECT json_object_agg(nominee_id, cnt)
      FROM (
        SELECT nominee_id, COUNT(*) as cnt
        FROM awards_picks
        WHERE category_id = p_category_id
        GROUP BY nominee_id
      ) sub
    )
  ) INTO result
  FROM awards_picks
  WHERE category_id = p_category_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
