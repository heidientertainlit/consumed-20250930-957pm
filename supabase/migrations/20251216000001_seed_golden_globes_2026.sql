-- Seed Golden Globes 2026 (83rd Annual) Nominations
-- Source: https://goldenglobes.com/nominations/2026

-- Insert the event
INSERT INTO awards_events (id, slug, name, year, ceremony_date, deadline, status, description, points_per_correct)
VALUES (
  'gg-2026',
  'golden-globes-2026',
  'Golden Globes',
  2026,
  '2026-01-11 20:00:00+00',
  '2026-01-11 19:00:00+00',
  'open',
  'The 83rd Annual Golden Globe Awards streaming live Sunday, January 11, 2026.',
  20
) ON CONFLICT (slug) DO UPDATE SET
  ceremony_date = EXCLUDED.ceremony_date,
  deadline = EXCLUDED.deadline,
  status = EXCLUDED.status;

-- ===========================================
-- FILM CATEGORIES
-- ===========================================

-- 1. Best Motion Picture - Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-picture-drama', 'gg-2026', 'Best Motion Picture – Drama', 'Picture (Drama)', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-pd-1', 'cat-gg26-picture-drama', 'Frankenstein', NULL, NULL, 1),
('nom-gg26-pd-2', 'cat-gg26-picture-drama', 'Hamnet', NULL, NULL, 2),
('nom-gg26-pd-3', 'cat-gg26-picture-drama', 'It Was Just an Accident', NULL, NULL, 3),
('nom-gg26-pd-4', 'cat-gg26-picture-drama', 'Sentimental Value', NULL, NULL, 4),
('nom-gg26-pd-5', 'cat-gg26-picture-drama', 'Sinners', NULL, NULL, 5),
('nom-gg26-pd-6', 'cat-gg26-picture-drama', 'The Secret Agent', NULL, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 2. Best Motion Picture - Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-picture-comedy', 'gg-2026', 'Best Motion Picture – Musical or Comedy', 'Picture (Comedy)', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-pc-1', 'cat-gg26-picture-comedy', 'Blue Moon', NULL, NULL, 1),
('nom-gg26-pc-2', 'cat-gg26-picture-comedy', 'Bugonia', NULL, NULL, 2),
('nom-gg26-pc-3', 'cat-gg26-picture-comedy', 'Marty Supreme', NULL, NULL, 3),
('nom-gg26-pc-4', 'cat-gg26-picture-comedy', 'No Other Choice', NULL, NULL, 4),
('nom-gg26-pc-5', 'cat-gg26-picture-comedy', 'Nouvelle Vague', NULL, NULL, 5),
('nom-gg26-pc-6', 'cat-gg26-picture-comedy', 'One Battle After Another', NULL, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 3. Best Motion Picture - Animated
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-animated', 'gg-2026', 'Best Motion Picture – Animated', 'Animated', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-anim-1', 'cat-gg26-animated', 'Arco', NULL, NULL, 1),
('nom-gg26-anim-2', 'cat-gg26-animated', 'Demon Slayer: Kimetsu no Yaiba – Infinity Castle', NULL, NULL, 2),
('nom-gg26-anim-3', 'cat-gg26-animated', 'Elio', NULL, NULL, 3),
('nom-gg26-anim-4', 'cat-gg26-animated', 'KPop Demon Hunters', NULL, NULL, 4),
('nom-gg26-anim-5', 'cat-gg26-animated', 'Little Amélie or the Character of Rain', NULL, NULL, 5),
('nom-gg26-anim-6', 'cat-gg26-animated', 'Zootopia 2', NULL, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 4. Best Motion Picture – Non-English Language
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-foreign', 'gg-2026', 'Best Motion Picture – Non-English Language', 'Foreign Film', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, subtitle, poster_url, display_order) VALUES
('nom-gg26-for-1', 'cat-gg26-foreign', 'It Was Just an Accident', NULL, 'France', NULL, 1),
('nom-gg26-for-2', 'cat-gg26-foreign', 'No Other Choice', NULL, 'South Korea', NULL, 2),
('nom-gg26-for-3', 'cat-gg26-foreign', 'Sentimental Value', NULL, 'Norway', NULL, 3),
('nom-gg26-for-4', 'cat-gg26-foreign', 'Sirāt', NULL, 'Spain', NULL, 4),
('nom-gg26-for-5', 'cat-gg26-foreign', 'The Secret Agent', NULL, 'Brazil', NULL, 5),
('nom-gg26-for-6', 'cat-gg26-foreign', 'The Voice of Hind Rajab', NULL, 'Tunisia', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 5. Best Female Actor in a Motion Picture – Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actress-drama', 'gg-2026', 'Best Performance by a Female Actor in a Motion Picture – Drama', 'Actress (Drama)', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-ad-1', 'cat-gg26-actress-drama', 'Eva Victor', 'Sorry, Baby', NULL, 1),
('nom-gg26-ad-2', 'cat-gg26-actress-drama', 'Jennifer Lawrence', 'Die My Love', NULL, 2),
('nom-gg26-ad-3', 'cat-gg26-actress-drama', 'Jessie Buckley', 'Hamnet', NULL, 3),
('nom-gg26-ad-4', 'cat-gg26-actress-drama', 'Julia Roberts', 'After the Hunt', NULL, 4),
('nom-gg26-ad-5', 'cat-gg26-actress-drama', 'Renate Reinsve', 'Sentimental Value', NULL, 5),
('nom-gg26-ad-6', 'cat-gg26-actress-drama', 'Tessa Thompson', 'Hedda', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 6. Best Male Actor in a Motion Picture – Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actor-drama', 'gg-2026', 'Best Performance by a Male Actor in a Motion Picture – Drama', 'Actor (Drama)', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-acd-1', 'cat-gg26-actor-drama', 'Dwayne Johnson', 'The Smashing Machine', NULL, 1),
('nom-gg26-acd-2', 'cat-gg26-actor-drama', 'Jeremy Allen White', 'Springsteen: Deliver Me from Nowhere', NULL, 2),
('nom-gg26-acd-3', 'cat-gg26-actor-drama', 'Joel Edgerton', 'Train Dreams', NULL, 3),
('nom-gg26-acd-4', 'cat-gg26-actor-drama', 'Michael B. Jordan', 'Sinners', NULL, 4),
('nom-gg26-acd-5', 'cat-gg26-actor-drama', 'Oscar Isaac', 'Frankenstein', NULL, 5),
('nom-gg26-acd-6', 'cat-gg26-actor-drama', 'Wagner Moura', 'The Secret Agent', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 7. Best Female Actor in a Motion Picture – Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actress-comedy', 'gg-2026', 'Best Performance by a Female Actor in a Motion Picture – Musical or Comedy', 'Actress (Comedy)', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-ac-1', 'cat-gg26-actress-comedy', 'Amanda Seyfried', 'The Testament of Ann Lee', NULL, 1),
('nom-gg26-ac-2', 'cat-gg26-actress-comedy', 'Chase Infiniti', 'One Battle After Another', NULL, 2),
('nom-gg26-ac-3', 'cat-gg26-actress-comedy', 'Cynthia Erivo', 'Wicked: For Good', NULL, 3),
('nom-gg26-ac-4', 'cat-gg26-actress-comedy', 'Emma Stone', 'Bugonia', NULL, 4),
('nom-gg26-ac-5', 'cat-gg26-actress-comedy', 'Kate Hudson', 'Song Sung Blue', NULL, 5),
('nom-gg26-ac-6', 'cat-gg26-actress-comedy', 'Rose Byrne', 'If I Had Legs I''d Kick You', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 8. Best Male Actor in a Motion Picture – Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actor-comedy', 'gg-2026', 'Best Performance by a Male Actor in a Motion Picture – Musical or Comedy', 'Actor (Comedy)', 8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-acc-1', 'cat-gg26-actor-comedy', 'Ethan Hawke', 'Blue Moon', NULL, 1),
('nom-gg26-acc-2', 'cat-gg26-actor-comedy', 'George Clooney', 'Jay Kelly', NULL, 2),
('nom-gg26-acc-3', 'cat-gg26-actor-comedy', 'Jesse Plemons', 'Bugonia', NULL, 3),
('nom-gg26-acc-4', 'cat-gg26-actor-comedy', 'Lee Byung-Hun', 'No Other Choice', NULL, 4),
('nom-gg26-acc-5', 'cat-gg26-actor-comedy', 'Leonardo DiCaprio', 'One Battle After Another', NULL, 5),
('nom-gg26-acc-6', 'cat-gg26-actor-comedy', 'Timothée Chalamet', 'Marty Supreme', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 9. Best Female Actor in a Supporting Role
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-supporting-actress', 'gg-2026', 'Best Performance by a Female Actor in a Supporting Role in a Motion Picture', 'Supporting Actress', 9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-sa-1', 'cat-gg26-supporting-actress', 'Amy Madigan', 'Weapons', NULL, 1),
('nom-gg26-sa-2', 'cat-gg26-supporting-actress', 'Ariana Grande', 'Wicked: For Good', NULL, 2),
('nom-gg26-sa-3', 'cat-gg26-supporting-actress', 'Elle Fanning', 'Sentimental Value', NULL, 3),
('nom-gg26-sa-4', 'cat-gg26-supporting-actress', 'Emily Blunt', 'The Smashing Machine', NULL, 4),
('nom-gg26-sa-5', 'cat-gg26-supporting-actress', 'Inga Ibsdotter Lilleaas', 'Sentimental Value', NULL, 5),
('nom-gg26-sa-6', 'cat-gg26-supporting-actress', 'Teyana Taylor', 'One Battle After Another', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 10. Best Male Actor in a Supporting Role
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-supporting-actor', 'gg-2026', 'Best Performance by a Male Actor in a Supporting Role in a Motion Picture', 'Supporting Actor', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-sac-1', 'cat-gg26-supporting-actor', 'Adam Sandler', 'Jay Kelly', NULL, 1),
('nom-gg26-sac-2', 'cat-gg26-supporting-actor', 'Benicio del Toro', 'One Battle After Another', NULL, 2),
('nom-gg26-sac-3', 'cat-gg26-supporting-actor', 'Jacob Elordi', 'Frankenstein', NULL, 3),
('nom-gg26-sac-4', 'cat-gg26-supporting-actor', 'Paul Mescal', 'Hamnet', NULL, 4),
('nom-gg26-sac-5', 'cat-gg26-supporting-actor', 'Sean Penn', 'One Battle After Another', NULL, 5),
('nom-gg26-sac-6', 'cat-gg26-supporting-actor', 'Stellan Skarsgård', 'Sentimental Value', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 11. Best Director – Motion Picture
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-director', 'gg-2026', 'Best Director – Motion Picture', 'Director', 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-dir-1', 'cat-gg26-director', 'Chloé Zhao', 'Hamnet', NULL, 1),
('nom-gg26-dir-2', 'cat-gg26-director', 'Guillermo del Toro', 'Frankenstein', NULL, 2),
('nom-gg26-dir-3', 'cat-gg26-director', 'Jafar Panahi', 'It Was Just an Accident', NULL, 3),
('nom-gg26-dir-4', 'cat-gg26-director', 'Joachim Trier', 'Sentimental Value', NULL, 4),
('nom-gg26-dir-5', 'cat-gg26-director', 'Paul Thomas Anderson', 'One Battle After Another', NULL, 5),
('nom-gg26-dir-6', 'cat-gg26-director', 'Ryan Coogler', 'Sinners', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 12. Best Screenplay – Motion Picture
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-screenplay', 'gg-2026', 'Best Screenplay – Motion Picture', 'Screenplay', 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-sp-1', 'cat-gg26-screenplay', 'Chloé Zhao & Maggie O''Farrell', 'Hamnet', NULL, 1),
('nom-gg26-sp-2', 'cat-gg26-screenplay', 'Jafar Panahi', 'It Was Just an Accident', NULL, 2),
('nom-gg26-sp-3', 'cat-gg26-screenplay', 'Joachim Trier & Eskil Vogt', 'Sentimental Value', NULL, 3),
('nom-gg26-sp-4', 'cat-gg26-screenplay', 'Paul Thomas Anderson', 'One Battle After Another', NULL, 4),
('nom-gg26-sp-5', 'cat-gg26-screenplay', 'Ronald Bronstein & Josh Safdie', 'Marty Supreme', NULL, 5),
('nom-gg26-sp-6', 'cat-gg26-screenplay', 'Ryan Coogler', 'Sinners', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 13. Best Original Score – Motion Picture
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-score', 'gg-2026', 'Best Original Score – Motion Picture', 'Score', 13)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-sc-1', 'cat-gg26-score', 'Alexandre Desplat', 'Frankenstein', NULL, 1),
('nom-gg26-sc-2', 'cat-gg26-score', 'Hans Zimmer', 'F1', NULL, 2),
('nom-gg26-sc-3', 'cat-gg26-score', 'Jonny Greenwood', 'One Battle After Another', NULL, 3),
('nom-gg26-sc-4', 'cat-gg26-score', 'Kangding Ray', 'Sirāt', NULL, 4),
('nom-gg26-sc-5', 'cat-gg26-score', 'Ludwig Göransson', 'Sinners', NULL, 5),
('nom-gg26-sc-6', 'cat-gg26-score', 'Max Richter', 'Hamnet', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 14. Best Original Song – Motion Picture
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-song', 'gg-2026', 'Best Original Song – Motion Picture', 'Song', 14)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, subtitle, poster_url, display_order) VALUES
('nom-gg26-song-1', 'cat-gg26-song', 'Dream As One', 'Avatar: Fire and Ash', 'Miley Cyrus, Andrew Wyatt, Mark Ronson, Simon Franglen', NULL, 1),
('nom-gg26-song-2', 'cat-gg26-song', 'Golden', 'KPop Demon Hunters', 'Joong Gyu Kwak, Yu Han Lee, et al.', NULL, 2),
('nom-gg26-song-3', 'cat-gg26-song', 'I Lied to You', 'Sinners', 'Raphael Saadiq, Ludwig Göransson', NULL, 3),
('nom-gg26-song-4', 'cat-gg26-song', 'No Place Like Home', 'Wicked: For Good', 'Stephen Schwartz', NULL, 4),
('nom-gg26-song-5', 'cat-gg26-song', 'The Girl in the Bubble', 'Wicked: For Good', 'Stephen Schwartz', NULL, 5),
('nom-gg26-song-6', 'cat-gg26-song', 'Train Dreams', 'Train Dreams', 'Nick Cave, Bryce Dessner', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 15. Cinematic and Box Office Achievement
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-boxoffice', 'gg-2026', 'Cinematic and Box Office Achievement', 'Box Office', 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-bo-1', 'cat-gg26-boxoffice', 'Avatar: Fire and Ash', NULL, NULL, 1),
('nom-gg26-bo-2', 'cat-gg26-boxoffice', 'F1', NULL, NULL, 2),
('nom-gg26-bo-3', 'cat-gg26-boxoffice', 'KPop Demon Hunters', NULL, NULL, 3),
('nom-gg26-bo-4', 'cat-gg26-boxoffice', 'Mission: Impossible – The Final Reckoning', NULL, NULL, 4),
('nom-gg26-bo-5', 'cat-gg26-boxoffice', 'Sinners', NULL, NULL, 5),
('nom-gg26-bo-6', 'cat-gg26-boxoffice', 'Weapons', NULL, NULL, 6),
('nom-gg26-bo-7', 'cat-gg26-boxoffice', 'Wicked: For Good', NULL, NULL, 7),
('nom-gg26-bo-8', 'cat-gg26-boxoffice', 'Zootopia 2', NULL, NULL, 8)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- TELEVISION CATEGORIES
-- ===========================================

-- 16. Best Television Series – Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-tv-drama', 'gg-2026', 'Best Television Series – Drama', 'TV Drama', 16)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-tvd-1', 'cat-gg26-tv-drama', 'The Diplomat', NULL, NULL, 1),
('nom-gg26-tvd-2', 'cat-gg26-tv-drama', 'Pluribus', NULL, NULL, 2),
('nom-gg26-tvd-3', 'cat-gg26-tv-drama', 'Severance', NULL, NULL, 3),
('nom-gg26-tvd-4', 'cat-gg26-tv-drama', 'Slow Horses', NULL, NULL, 4),
('nom-gg26-tvd-5', 'cat-gg26-tv-drama', 'The Pitt', NULL, NULL, 5),
('nom-gg26-tvd-6', 'cat-gg26-tv-drama', 'The White Lotus', NULL, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 17. Best Television Series – Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-tv-comedy', 'gg-2026', 'Best Television Series – Musical or Comedy', 'TV Comedy', 17)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-tvc-1', 'cat-gg26-tv-comedy', 'Abbott Elementary', NULL, NULL, 1),
('nom-gg26-tvc-2', 'cat-gg26-tv-comedy', 'The Bear', NULL, NULL, 2),
('nom-gg26-tvc-3', 'cat-gg26-tv-comedy', 'Hacks', NULL, NULL, 3),
('nom-gg26-tvc-4', 'cat-gg26-tv-comedy', 'Nobody Wants This', NULL, NULL, 4),
('nom-gg26-tvc-5', 'cat-gg26-tv-comedy', 'Only Murders in the Building', NULL, NULL, 5),
('nom-gg26-tvc-6', 'cat-gg26-tv-comedy', 'The Studio', NULL, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 18. Best Television Limited Series, Anthology Series, or Motion Picture Made for Television
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-tv-limited', 'gg-2026', 'Best Television Limited Series, Anthology Series, or Motion Picture Made for Television', 'Limited Series', 18)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-tvl-1', 'cat-gg26-tv-limited', 'Adolescence', NULL, NULL, 1),
('nom-gg26-tvl-2', 'cat-gg26-tv-limited', 'All Her Fault', NULL, NULL, 2),
('nom-gg26-tvl-3', 'cat-gg26-tv-limited', 'Black Mirror', NULL, NULL, 3),
('nom-gg26-tvl-4', 'cat-gg26-tv-limited', 'Dying for Sex', NULL, NULL, 4),
('nom-gg26-tvl-5', 'cat-gg26-tv-limited', 'The Beast in Me', NULL, NULL, 5),
('nom-gg26-tvl-6', 'cat-gg26-tv-limited', 'The Girlfriend', NULL, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- 19. Best Female Actor in a Television Series – Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-tv-actress-drama', 'gg-2026', 'Best Performance by a Female Actor in a Television Series – Drama', 'TV Actress (Drama)', 19)
ON CONFLICT (id) DO NOTHING;

INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-gg26-tvad-1', 'cat-gg26-tv-actress-drama', 'Bella Ramsey', 'The Last of Us', NULL, 1),
('nom-gg26-tvad-2', 'cat-gg26-tv-actress-drama', 'Britt Lower', 'Severance', NULL, 2),
('nom-gg26-tvad-3', 'cat-gg26-tv-actress-drama', 'Helen Mirren', 'MobLand', NULL, 3),
('nom-gg26-tvad-4', 'cat-gg26-tv-actress-drama', 'Kathy Bates', 'Matlock', NULL, 4)
ON CONFLICT (id) DO NOTHING;
