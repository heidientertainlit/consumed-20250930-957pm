-- Update Oscar 2026 nominee posters from TMDB
-- Generated from TMDB API on January 27, 2026

-- Best Picture nominees
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg' WHERE name = 'Sinners' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg' WHERE name = 'One Battle After Another' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/lDL8vPUuJs2LsPHPjAGhkbYTpNX.jpg' WHERE name = 'Wicked: For Good' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg' WHERE name = 'Frankenstein' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/oxgsAQDAAxA92mFGYCZllgWkH9J.jpg' WHERE name = 'Bugonia' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/vqBmyAj0Xm9LnS1xe1MSlMAJyHq.jpg' WHERE name = 'F1' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg' WHERE name = 'Hamnet' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg' WHERE name = 'Marty Supreme' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg' WHERE name = 'Sentimental Value' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/iLE2YOmeboeTDC7GlOp1dzh1VFo.jpg' WHERE name = 'The Secret Agent' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');

-- Update by title field for nominees with person names
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg' WHERE title = 'Sinners' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg' WHERE title = 'One Battle After Another' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/lDL8vPUuJs2LsPHPjAGhkbYTpNX.jpg' WHERE title = 'Wicked: For Good' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg' WHERE title = 'Frankenstein' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/oxgsAQDAAxA92mFGYCZllgWkH9J.jpg' WHERE title = 'Bugonia' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/vqBmyAj0Xm9LnS1xe1MSlMAJyHq.jpg' WHERE title = 'F1' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg' WHERE title = 'Hamnet' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg' WHERE title = 'Marty Supreme' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg' WHERE title = 'Sentimental Value' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/iLE2YOmeboeTDC7GlOp1dzh1VFo.jpg' WHERE title = 'The Secret Agent' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/va0TQ9WprMXRqQAzY56vyqY0Yd5.jpg' WHERE title = 'If I Had Legs I''d Kick You' AND category_id LIKE 'cat-osc26%' AND (poster_url IS NULL OR poster_url = '');

-- Animated features
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/rzgLwjzSX0uo8G01eMjMv4EtjnI.jpg' WHERE name = 'Zootopia 2' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/dFNlJ7pqe8PMqHJqNhK5RxvDskz.jpg' WHERE name = 'Elio' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/lBr71SCVfx3gPCRfPEJXuNXhh0D.jpg' WHERE name = 'The Wild Robot 2' AND (poster_url IS NULL OR poster_url = '');

-- Visual Effects nominees (by name since they're film titles)
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/6TxzFKUozYbQwkBU1bfJqNwNwTT.jpg' WHERE name = 'Avatar: Fire and Ash' AND (poster_url IS NULL OR poster_url = '');
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg' WHERE name = 'Superman' AND (poster_url IS NULL OR poster_url = '');
