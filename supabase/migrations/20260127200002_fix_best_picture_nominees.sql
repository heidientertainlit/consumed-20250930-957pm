-- Fix Best Picture nominees - should only be 10 films
-- First, delete all existing Best Picture nominees
DELETE FROM awards_nominees WHERE category_id = 'cat-osc26-picture';

-- Insert the correct 10 nominees with proper poster URLs
INSERT INTO awards_nominees (id, category_id, name, title, poster_url, display_order) VALUES
('nom-osc26-bp-1', 'cat-osc26-picture', 'Bugonia', NULL, 'https://image.tmdb.org/t/p/w500/oxgsAQDAAxA92mFGYCZllgWkH9J.jpg', 1),
('nom-osc26-bp-2', 'cat-osc26-picture', 'F1', NULL, 'https://image.tmdb.org/t/p/w500/yfVNpLIyDNJX0tMjGQeo9HZCJS7.jpg', 2),
('nom-osc26-bp-3', 'cat-osc26-picture', 'Frankenstein', NULL, 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 3),
('nom-osc26-bp-4', 'cat-osc26-picture', 'Hamnet', NULL, 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 4),
('nom-osc26-bp-5', 'cat-osc26-picture', 'Marty Supreme', NULL, 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 5),
('nom-osc26-bp-6', 'cat-osc26-picture', 'One Battle After Another', NULL, 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 6),
('nom-osc26-bp-7', 'cat-osc26-picture', 'Sentimental Value', NULL, 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 7),
('nom-osc26-bp-8', 'cat-osc26-picture', 'Sinners', NULL, 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 8),
('nom-osc26-bp-9', 'cat-osc26-picture', 'The Secret Agent', NULL, 'https://image.tmdb.org/t/p/w500/iLE2YOmeboeTDC7GlOp1dzh1VFo.jpg', 9),
('nom-osc26-bp-10', 'cat-osc26-picture', 'Train Dreams', NULL, 'https://image.tmdb.org/t/p/w500/wfzYOVdafdbD1d3SxNqiBtV2Yhx.jpg', 10);
