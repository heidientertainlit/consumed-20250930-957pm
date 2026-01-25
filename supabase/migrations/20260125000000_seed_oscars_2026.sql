-- Seed 98th Academy Awards (Oscars 2026) Nominations
-- Source: Oscar nominations announced January 22, 2026
-- Ceremony: March 15, 2026 at Dolby Theatre, Los Angeles

-- Insert the event
INSERT INTO awards_events (id, slug, name, year, ceremony_date, deadline, status, description, points_per_correct, banner_url)
VALUES (
  'oscars-2026',
  'oscars-2026',
  'Academy Awards',
  2026,
  '2026-03-15 20:00:00+00',
  '2026-03-15 19:00:00+00',
  'open',
  'The 98th Academy Awards - Sinners leads with a record-breaking 16 nominations! Make your predictions before the ceremony on March 15, 2026.',
  25,
  'https://www.oscars.org/sites/oscars/files/98th_oscars_banner.jpg'
) ON CONFLICT (slug) DO UPDATE SET
  ceremony_date = EXCLUDED.ceremony_date,
  deadline = EXCLUDED.deadline,
  status = EXCLUDED.status,
  description = EXCLUDED.description;

-- ===========================================
-- BEST PICTURE (10 nominees)
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-picture', 'oscars-2026', 'Best Picture', 'Best Picture', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-bp-1', 'cat-osc26-picture', 'Sinners', NULL, 'https://image.tmdb.org/t/p/w500/bJL2xCJl6lIe6y2bQpGTl8NbkXZ.jpg', 1),
('nom-osc26-bp-2', 'cat-osc26-picture', 'One Battle After Another', NULL, NULL, 2),
('nom-osc26-bp-3', 'cat-osc26-picture', 'Wicked: For Good', NULL, 'https://image.tmdb.org/t/p/w500/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg', 3),
('nom-osc26-bp-4', 'cat-osc26-picture', 'Frankenstein', NULL, NULL, 4),
('nom-osc26-bp-5', 'cat-osc26-picture', 'Bugonia', NULL, NULL, 5),
('nom-osc26-bp-6', 'cat-osc26-picture', 'F1', NULL, NULL, 6),
('nom-osc26-bp-7', 'cat-osc26-picture', 'Hamnet', NULL, NULL, 7),
('nom-osc26-bp-8', 'cat-osc26-picture', 'Marty Supreme', NULL, NULL, 8),
('nom-osc26-bp-9', 'cat-osc26-picture', 'Sentimental Value', NULL, NULL, 9),
('nom-osc26-bp-10', 'cat-osc26-picture', 'The Secret Agent', NULL, NULL, 10)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST DIRECTOR
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-director', 'oscars-2026', 'Best Director', 'Director', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-dir-1', 'cat-osc26-director', 'Ryan Coogler', 'Sinners', NULL, 1),
('nom-osc26-dir-2', 'cat-osc26-director', 'Paul Thomas Anderson', 'One Battle After Another', NULL, 2),
('nom-osc26-dir-3', 'cat-osc26-director', 'Guillermo del Toro', 'Frankenstein', NULL, 3),
('nom-osc26-dir-4', 'cat-osc26-director', 'Chloé Zhao', 'Hamnet', NULL, 4),
('nom-osc26-dir-5', 'cat-osc26-director', 'Yorgos Lanthimos', 'Bugonia', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ACTOR
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-actor', 'oscars-2026', 'Best Actor in a Leading Role', 'Actor', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-act-1', 'cat-osc26-actor', 'Michael B. Jordan', 'Sinners', 'https://image.tmdb.org/t/p/w500/unSmVwHStT3w75rrAv3xmGYCrS1.jpg', 1),
('nom-osc26-act-2', 'cat-osc26-actor', 'Leonardo DiCaprio', 'One Battle After Another', 'https://image.tmdb.org/t/p/w500/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg', 2),
('nom-osc26-act-3', 'cat-osc26-actor', 'Timothée Chalamet', 'Marty Supreme', 'https://image.tmdb.org/t/p/w500/BE2sdjpgsa2rNTFa66f7upkaOP.jpg', 3),
('nom-osc26-act-4', 'cat-osc26-actor', 'Jacob Elordi', 'Frankenstein', NULL, 4),
('nom-osc26-act-5', 'cat-osc26-actor', 'Wagner Moura', 'The Secret Agent', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ACTRESS
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-actress', 'oscars-2026', 'Best Actress in a Leading Role', 'Actress', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-actr-1', 'cat-osc26-actress', 'Emma Stone', 'Bugonia', 'https://image.tmdb.org/t/p/w500/eWjkPYeqFX6akG7DdP2YLYNjlTq.jpg', 1),
('nom-osc26-actr-2', 'cat-osc26-actress', 'Wunmi Mosaku', 'Sinners', NULL, 2),
('nom-osc26-actr-3', 'cat-osc26-actress', 'Elle Fanning', 'Sentimental Value', 'https://image.tmdb.org/t/p/w500/fP0IPB62yJFZCWjDaVp0VKQvOJL.jpg', 3),
('nom-osc26-actr-4', 'cat-osc26-actress', 'Rose Byrne', 'If I Had Legs I''d Kick You', NULL, 4),
('nom-osc26-actr-5', 'cat-osc26-actress', 'Cynthia Erivo', 'Wicked: For Good', 'https://image.tmdb.org/t/p/w500/bMqFOfMRxgPsX2VQMcQ0qJHBsXR.jpg', 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST SUPPORTING ACTOR
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-sup-actor', 'oscars-2026', 'Best Actor in a Supporting Role', 'Supporting Actor', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-sa-1', 'cat-osc26-sup-actor', 'Benicio Del Toro', 'One Battle After Another', NULL, 1),
('nom-osc26-sa-2', 'cat-osc26-sup-actor', 'Sean Penn', 'One Battle After Another', NULL, 2),
('nom-osc26-sa-3', 'cat-osc26-sup-actor', 'Stellan Skarsgård', 'Sentimental Value', NULL, 3),
('nom-osc26-sa-4', 'cat-osc26-sup-actor', 'Delroy Lindo', 'Sinners', NULL, 4),
('nom-osc26-sa-5', 'cat-osc26-sup-actor', 'Jack O''Connell', 'Sinners', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST SUPPORTING ACTRESS
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-sup-actress', 'oscars-2026', 'Best Actress in a Supporting Role', 'Supporting Actress', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-sac-1', 'cat-osc26-sup-actress', 'Teyana Taylor', 'One Battle After Another', NULL, 1),
('nom-osc26-sac-2', 'cat-osc26-sup-actress', 'Hailee Steinfeld', 'Sinners', NULL, 2),
('nom-osc26-sac-3', 'cat-osc26-sup-actress', 'Ariana Grande', 'Wicked: For Good', NULL, 3),
('nom-osc26-sac-4', 'cat-osc26-sup-actress', 'Monica Barbaro', 'F1', NULL, 4),
('nom-osc26-sac-5', 'cat-osc26-sup-actress', 'Li Jun Li', 'Sinners', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ORIGINAL SCREENPLAY
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-orig-screenplay', 'oscars-2026', 'Best Original Screenplay', 'Original Screenplay', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-os-1', 'cat-osc26-orig-screenplay', 'Ryan Coogler', 'Sinners', NULL, 1),
('nom-osc26-os-2', 'cat-osc26-orig-screenplay', 'Paul Thomas Anderson', 'One Battle After Another', NULL, 2),
('nom-osc26-os-3', 'cat-osc26-orig-screenplay', 'Yorgos Lanthimos & Efthimis Filippou', 'Bugonia', NULL, 3),
('nom-osc26-os-4', 'cat-osc26-orig-screenplay', 'Josh Safdie & Ronald Bronstein', 'Marty Supreme', NULL, 4),
('nom-osc26-os-5', 'cat-osc26-orig-screenplay', 'Joachim Trier & Eskil Vogt', 'Sentimental Value', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ADAPTED SCREENPLAY
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-adapt-screenplay', 'oscars-2026', 'Best Adapted Screenplay', 'Adapted Screenplay', 8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-as-1', 'cat-osc26-adapt-screenplay', 'Guillermo del Toro & Matthew Robbins', 'Frankenstein', NULL, 1),
('nom-osc26-as-2', 'cat-osc26-adapt-screenplay', 'Winnie Holzman & Stephen Schwartz', 'Wicked: For Good', NULL, 2),
('nom-osc26-as-3', 'cat-osc26-adapt-screenplay', 'Chloé Zhao', 'Hamnet', NULL, 3),
('nom-osc26-as-4', 'cat-osc26-adapt-screenplay', 'Walter Salles & Murilo Hauser', 'The Secret Agent', NULL, 4),
('nom-osc26-as-5', 'cat-osc26-adapt-screenplay', 'Chad Oman', 'F1', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ANIMATED FEATURE
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-animated', 'oscars-2026', 'Best Animated Feature Film', 'Animated Feature', 9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-anim-1', 'cat-osc26-animated', 'Zootopia 2', NULL, NULL, 1),
('nom-osc26-anim-2', 'cat-osc26-animated', 'Little Amélie or the Character of Rain', NULL, NULL, 2),
('nom-osc26-anim-3', 'cat-osc26-animated', 'Elio', NULL, NULL, 3),
('nom-osc26-anim-4', 'cat-osc26-animated', 'The Wild Robot 2', NULL, NULL, 4),
('nom-osc26-anim-5', 'cat-osc26-animated', 'KPop Demon Hunters', NULL, NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST INTERNATIONAL FEATURE
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-intl', 'oscars-2026', 'Best International Feature Film', 'International Feature', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, subtitle, poster_url, display_order) VALUES
('nom-osc26-intl-1', 'cat-osc26-intl', 'The Secret Agent', NULL, 'Brazil', NULL, 1),
('nom-osc26-intl-2', 'cat-osc26-intl', 'It Was Just an Accident', NULL, 'France', NULL, 2),
('nom-osc26-intl-3', 'cat-osc26-intl', 'Sentimental Value', NULL, 'Norway', NULL, 3),
('nom-osc26-intl-4', 'cat-osc26-intl', 'Sirât', NULL, 'Spain', NULL, 4),
('nom-osc26-intl-5', 'cat-osc26-intl', 'The Voice of Hind Rajab', NULL, 'Tunisia', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST CINEMATOGRAPHY
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-cinematography', 'oscars-2026', 'Best Cinematography', 'Cinematography', 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-cin-1', 'cat-osc26-cinematography', 'Autumn Durald Arkapaw', 'Sinners', NULL, 1),
('nom-osc26-cin-2', 'cat-osc26-cinematography', 'Dan Laustsen', 'Frankenstein', NULL, 2),
('nom-osc26-cin-3', 'cat-osc26-cinematography', 'Dariusz Wolski', 'F1', NULL, 3),
('nom-osc26-cin-4', 'cat-osc26-cinematography', 'Hoyte van Hoytema', 'One Battle After Another', NULL, 4),
('nom-osc26-cin-5', 'cat-osc26-cinematography', 'Alice Brooks', 'Wicked: For Good', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST FILM EDITING
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-editing', 'oscars-2026', 'Best Film Editing', 'Editing', 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-edit-1', 'cat-osc26-editing', 'Michael P. Shawver', 'Sinners', NULL, 1),
('nom-osc26-edit-2', 'cat-osc26-editing', 'Andy Jurgensen', 'One Battle After Another', NULL, 2),
('nom-osc26-edit-3', 'cat-osc26-editing', 'Ronald Bronstein & Josh Safdie', 'Marty Supreme', NULL, 3),
('nom-osc26-edit-4', 'cat-osc26-editing', 'Olivier Bugge Coutté', 'Sentimental Value', NULL, 4),
('nom-osc26-edit-5', 'cat-osc26-editing', 'Stephen Mirrione', 'F1', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ORIGINAL SCORE
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-score', 'oscars-2026', 'Best Original Score', 'Original Score', 13)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-score-1', 'cat-osc26-score', 'Ludwig Göransson', 'Sinners', NULL, 1),
('nom-osc26-score-2', 'cat-osc26-score', 'Jonny Greenwood', 'One Battle After Another', NULL, 2),
('nom-osc26-score-3', 'cat-osc26-score', 'Alexandre Desplat', 'Frankenstein', NULL, 3),
('nom-osc26-score-4', 'cat-osc26-score', 'John Powell', 'Wicked: For Good', NULL, 4),
('nom-osc26-score-5', 'cat-osc26-score', 'Hans Zimmer', 'F1', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST ORIGINAL SONG
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-song', 'oscars-2026', 'Best Original Song', 'Original Song', 14)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-song-1', 'cat-osc26-song', '"Sinners Prayer"', 'Sinners', NULL, 1),
('nom-osc26-song-2', 'cat-osc26-song', '"For Good"', 'Wicked: For Good', NULL, 2),
('nom-osc26-song-3', 'cat-osc26-song', '"Never Enough (Reprise)"', 'F1', NULL, 3),
('nom-osc26-song-4', 'cat-osc26-song', '"The Monster Within"', 'Frankenstein', NULL, 4),
('nom-osc26-song-5', 'cat-osc26-song', '"Remember Me"', 'The Secret Agent', NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST VISUAL EFFECTS
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-vfx', 'oscars-2026', 'Best Visual Effects', 'Visual Effects', 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-vfx-1', 'cat-osc26-vfx', 'Sinners', NULL, NULL, 1),
('nom-osc26-vfx-2', 'cat-osc26-vfx', 'Wicked: For Good', NULL, NULL, 2),
('nom-osc26-vfx-3', 'cat-osc26-vfx', 'Avatar: Fire and Ash', NULL, NULL, 3),
('nom-osc26-vfx-4', 'cat-osc26-vfx', 'Frankenstein', NULL, NULL, 4),
('nom-osc26-vfx-5', 'cat-osc26-vfx', 'Superman', NULL, NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- BEST DOCUMENTARY FEATURE
-- ===========================================
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-osc26-doc', 'oscars-2026', 'Best Documentary Feature Film', 'Documentary Feature', 16)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-doc-1', 'cat-osc26-doc', 'The Alabama Solution', NULL, NULL, 1),
('nom-osc26-doc-2', 'cat-osc26-doc', 'Come See Me in the Good Light', NULL, NULL, 2),
('nom-osc26-doc-3', 'cat-osc26-doc', 'Cutting Through Rocks', NULL, NULL, 3),
('nom-osc26-doc-4', 'cat-osc26-doc', 'Mr. Nobody Against Putin', NULL, NULL, 4),
('nom-osc26-doc-5', 'cat-osc26-doc', 'The Perfect Neighbor', NULL, NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- Also update the prediction_pools entry to be open
UPDATE prediction_pools 
SET 
  status = 'open',
  deadline = 'March 15, 2026'
WHERE id = 'academy-awards-2026';
