-- First, add the options column if it doesn't exist
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS options JSONB;

-- Create test polls with options as JSONB (matching prediction_pools pattern)

-- Poll 1: consumed Poll - Favorite Streaming Service
INSERT INTO polls (question, type, status, points_reward, options, expires_at)
VALUES (
  'Which streaming service has the best original content?',
  'consumed',
  'active',
  5,
  '[
    {"id": 1, "label": "Netflix", "description": "Stranger Things, The Crown, Squid Game"},
    {"id": 2, "label": "HBO Max", "description": "House of the Dragon, The Last of Us"},
    {"id": 3, "label": "Disney+", "description": "The Mandalorian, Loki, WandaVision"},
    {"id": 4, "label": "Apple TV+", "description": "Ted Lasso, Severance, The Morning Show"}
  ]'::jsonb,
  NOW() + INTERVAL '7 days'
);

-- Poll 2: entertainlit Poll - Book vs Movie
INSERT INTO polls (question, type, status, points_reward, options, expires_at)
VALUES (
  'Dune Part Two: Better than the book or worse?',
  'entertainlit',
  'active',
  5,
  '[
    {"id": 1, "label": "Better than the book", "description": "The visuals elevated the story"},
    {"id": 2, "label": "Book was better", "description": "The novel has more depth"},
    {"id": 3, "label": "Both are equally great", "description": "Different but both amazing"}
  ]'::jsonb,
  NOW() + INTERVAL '7 days'
);

-- Poll 3: consumed Poll - Binge vs Weekly
INSERT INTO polls (question, type, status, points_reward, options, expires_at)
VALUES (
  'How do you prefer to watch new shows?',
  'consumed',
  'active',
  5,
  '[
    {"id": 1, "label": "Binge all at once", "description": "Can''t wait, need it all now"},
    {"id": 2, "label": "Weekly episodes", "description": "Builds anticipation and discussion"},
    {"id": 3, "label": "Wait until season ends", "description": "No spoilers, marathon later"}
  ]'::jsonb,
  NOW() + INTERVAL '7 days'
);

-- Poll 4: Sponsored Poll (example)
INSERT INTO polls (question, type, sponsor_name, sponsor_logo_url, sponsor_cta_url, status, points_reward, options, expires_at)
VALUES (
  'Which music genre defines 2024?',
  'sponsored',
  'Spotify',
  'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png',
  'https://spotify.com',
  'active',
  10,
  '[
    {"id": 1, "label": "Pop", "description": "Taylor Swift, Sabrina Carpenter"},
    {"id": 2, "label": "Hip-Hop", "description": "Drake, Kendrick, Travis Scott"},
    {"id": 3, "label": "Indie/Alternative", "description": "The 1975, Boygenius"},
    {"id": 4, "label": "Country", "description": "Morgan Wallen, Luke Combs"}
  ]'::jsonb,
  NOW() + INTERVAL '7 days'
);

-- Verify polls were created
SELECT 
  id, 
  question, 
  type,
  jsonb_array_length(options) as option_count,
  options
FROM polls 
WHERE status = 'active'
ORDER BY created_at DESC;
