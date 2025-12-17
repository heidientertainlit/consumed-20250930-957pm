-- Add upcoming awards events as "Coming Soon" (locked status)

INSERT INTO awards_events (id, slug, name, year, status, ceremony_date, deadline, points_per_correct)
VALUES 
  ('oscars-2026', 'oscars-2026', 'Academy Awards', 2026, 'locked', '2026-03-02', '2026-03-02', 20),
  ('sag-awards-2026', 'sag-awards-2026', 'SAG Awards', 2026, 'locked', '2026-02-22', '2026-02-22', 20),
  ('grammy-awards-2026', 'grammy-awards-2026', 'Grammy Awards', 2026, 'locked', '2026-02-08', '2026-02-08', 20)
ON CONFLICT (id) DO NOTHING;
