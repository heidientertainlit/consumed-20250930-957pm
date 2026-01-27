-- Correct all 2026 Academy Awards nominees based on official announcements
-- This fixes incorrect nominees and adds missing categories

-- Get the oscars-2026 event ID for reference
DO $$
DECLARE
    v_event_id UUID;
    v_cat_best_picture UUID;
    v_cat_director UUID;
    v_cat_actor UUID;
    v_cat_actress UUID;
    v_cat_supporting_actor UUID;
    v_cat_supporting_actress UUID;
    v_cat_original_screenplay UUID;
    v_cat_adapted_screenplay UUID;
    v_cat_animated UUID;
    v_cat_international UUID;
    v_cat_documentary UUID;
    v_cat_cinematography UUID;
    v_cat_editing UUID;
    v_cat_score UUID;
    v_cat_song UUID;
    v_cat_vfx UUID;
    v_cat_casting UUID;
    v_cat_costume UUID;
    v_cat_makeup UUID;
    v_cat_production UUID;
    v_cat_sound UUID;
    v_cat_doc_short UUID;
    v_cat_anim_short UUID;
    v_cat_live_short UUID;
BEGIN
    -- Get event ID
    SELECT id INTO v_event_id FROM awards_events WHERE slug = 'oscars-2026';
    
    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'oscars-2026 event not found';
    END IF;

    -- Get existing category IDs
    SELECT id INTO v_cat_best_picture FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Picture';
    SELECT id INTO v_cat_director FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Director';
    SELECT id INTO v_cat_actor FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Actor in a Leading Role';
    SELECT id INTO v_cat_actress FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Actress in a Leading Role';
    SELECT id INTO v_cat_supporting_actor FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Actor in a Supporting Role';
    SELECT id INTO v_cat_supporting_actress FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Actress in a Supporting Role';
    SELECT id INTO v_cat_original_screenplay FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Original Screenplay';
    SELECT id INTO v_cat_adapted_screenplay FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Adapted Screenplay';
    SELECT id INTO v_cat_animated FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Animated Feature Film';
    SELECT id INTO v_cat_international FROM awards_categories WHERE event_id = v_event_id AND name = 'Best International Feature Film';
    SELECT id INTO v_cat_documentary FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Documentary Feature Film';
    SELECT id INTO v_cat_cinematography FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Cinematography';
    SELECT id INTO v_cat_editing FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Film Editing';
    SELECT id INTO v_cat_score FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Original Score';
    SELECT id INTO v_cat_song FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Original Song';
    SELECT id INTO v_cat_vfx FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Visual Effects';

    -- Create missing categories
    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Casting', 17)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_casting;
    IF v_cat_casting IS NULL THEN
        SELECT id INTO v_cat_casting FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Casting';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Costume Design', 18)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_costume;
    IF v_cat_costume IS NULL THEN
        SELECT id INTO v_cat_costume FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Costume Design';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Makeup and Hairstyling', 19)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_makeup;
    IF v_cat_makeup IS NULL THEN
        SELECT id INTO v_cat_makeup FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Makeup and Hairstyling';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Production Design', 20)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_production;
    IF v_cat_production IS NULL THEN
        SELECT id INTO v_cat_production FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Production Design';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Sound', 21)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_sound;
    IF v_cat_sound IS NULL THEN
        SELECT id INTO v_cat_sound FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Sound';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Documentary Short Film', 22)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_doc_short;
    IF v_cat_doc_short IS NULL THEN
        SELECT id INTO v_cat_doc_short FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Documentary Short Film';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Animated Short Film', 23)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_anim_short;
    IF v_cat_anim_short IS NULL THEN
        SELECT id INTO v_cat_anim_short FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Animated Short Film';
    END IF;

    INSERT INTO awards_categories (event_id, name, display_order) VALUES
        (v_event_id, 'Best Live Action Short Film', 24)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cat_live_short;
    IF v_cat_live_short IS NULL THEN
        SELECT id INTO v_cat_live_short FROM awards_categories WHERE event_id = v_event_id AND name = 'Best Live Action Short Film';
    END IF;

    -- Clear existing nominees for categories we're fixing
    DELETE FROM awards_nominees WHERE category_id IN (
        v_cat_director, v_cat_actor, v_cat_actress, v_cat_supporting_actor, 
        v_cat_supporting_actress, v_cat_original_screenplay, v_cat_adapted_screenplay,
        v_cat_animated, v_cat_cinematography, v_cat_score, v_cat_song
    );

    -- BEST DIRECTOR (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_director, 'Hamnet', 'Chloé Zhao', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 1),
        (v_cat_director, 'Marty Supreme', 'Josh Safdie', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 2),
        (v_cat_director, 'One Battle After Another', 'Paul Thomas Anderson', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 3),
        (v_cat_director, 'Sentimental Value', 'Joachim Trier', 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 'movie', 4),
        (v_cat_director, 'Sinners', 'Ryan Coogler', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

    -- BEST ACTOR (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_actor, 'Marty Supreme', 'Timothée Chalamet', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 1),
        (v_cat_actor, 'One Battle After Another', 'Leonardo DiCaprio', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 2),
        (v_cat_actor, 'Blue Moon', 'Ethan Hawke', NULL, 'movie', 3),
        (v_cat_actor, 'Sinners', 'Michael B. Jordan', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 4),
        (v_cat_actor, 'The Secret Agent', 'Wagner Moura', 'https://image.tmdb.org/t/p/w500/iLE2YOmeboeTDC7GlOp1dzh1VFo.jpg', 'movie', 5);

    -- BEST ACTRESS (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_actress, 'Hamnet', 'Jessie Buckley', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 1),
        (v_cat_actress, 'If I Had Legs I''d Kick You', 'Rose Byrne', 'https://image.tmdb.org/t/p/w500/va0TQ9WprMXRqQAzY56vyqY0Yd5.jpg', 'movie', 2),
        (v_cat_actress, 'Song Sung Blue', 'Kate Hudson', NULL, 'movie', 3),
        (v_cat_actress, 'Sentimental Value', 'Renate Reinsve', 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 'movie', 4),
        (v_cat_actress, 'Bugonia', 'Emma Stone', 'https://image.tmdb.org/t/p/w500/oxgsAQDAAxA92mFGYCZllgWkH9J.jpg', 'movie', 5);

    -- BEST SUPPORTING ACTOR (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_supporting_actor, 'One Battle After Another', 'Benicio Del Toro', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 1),
        (v_cat_supporting_actor, 'Frankenstein', 'Jacob Elordi', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 2),
        (v_cat_supporting_actor, 'Sinners', 'Delroy Lindo', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 3),
        (v_cat_supporting_actor, 'One Battle After Another', 'Sean Penn', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 4),
        (v_cat_supporting_actor, 'Sentimental Value', 'Stellan Skarsgård', 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 'movie', 5);

    -- BEST SUPPORTING ACTRESS (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_supporting_actress, 'Sentimental Value', 'Elle Fanning', 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 'movie', 1),
        (v_cat_supporting_actress, 'Sentimental Value', 'Inga Ibsdotter Lilleaas', 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 'movie', 2),
        (v_cat_supporting_actress, 'Weapons', 'Amy Madigan', NULL, 'movie', 3),
        (v_cat_supporting_actress, 'Sinners', 'Wunmi Mosaku', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 4),
        (v_cat_supporting_actress, 'One Battle After Another', 'Teyana Taylor', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 5);

    -- BEST ORIGINAL SCREENPLAY (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_original_screenplay, 'Blue Moon', 'Robert Kaplow', NULL, 'movie', 1),
        (v_cat_original_screenplay, 'It Was Just an Accident', 'Jafar Panahi', NULL, 'movie', 2),
        (v_cat_original_screenplay, 'Marty Supreme', 'Ronald Bronstein & Josh Safdie', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 3),
        (v_cat_original_screenplay, 'Sentimental Value', 'Eskil Vogt & Joachim Trier', 'https://image.tmdb.org/t/p/w500/24JALfUQsIgfNqMD7vTbqEVfsqf.jpg', 'movie', 4),
        (v_cat_original_screenplay, 'Sinners', 'Ryan Coogler', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

    -- BEST ADAPTED SCREENPLAY (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_adapted_screenplay, 'Bugonia', 'Will Tracy', 'https://image.tmdb.org/t/p/w500/oxgsAQDAAxA92mFGYCZllgWkH9J.jpg', 'movie', 1),
        (v_cat_adapted_screenplay, 'Frankenstein', 'Guillermo del Toro', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 2),
        (v_cat_adapted_screenplay, 'Hamnet', 'Chloé Zhao & Maggie O''Farrell', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 3),
        (v_cat_adapted_screenplay, 'One Battle After Another', 'Paul Thomas Anderson', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 4),
        (v_cat_adapted_screenplay, 'Train Dreams', 'Clint Bentley & Greg Kwedar', 'https://image.tmdb.org/t/p/w500/wfzYOVdafdbD1d3SxNqiBtV2Yhx.jpg', 'movie', 5);

    -- BEST ANIMATED FEATURE (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_animated, 'Arco', NULL, NULL, 'movie', 1),
        (v_cat_animated, 'Elio', NULL, 'https://image.tmdb.org/t/p/w500/dFNlJ7pqe8PMqHJqNhK5RxvDskz.jpg', 'movie', 2),
        (v_cat_animated, 'KPop Demon Hunters', NULL, NULL, 'movie', 3),
        (v_cat_animated, 'Little Amélie or the Character of Rain', NULL, NULL, 'movie', 4),
        (v_cat_animated, 'Zootopia 2', NULL, 'https://image.tmdb.org/t/p/w500/rzgLwjzSX0uo8G01eMjMv4EtjnI.jpg', 'movie', 5);

    -- BEST CINEMATOGRAPHY (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_cinematography, 'Frankenstein', 'Dan Laustsen', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 1),
        (v_cat_cinematography, 'Marty Supreme', 'Darius Khondji', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 2),
        (v_cat_cinematography, 'One Battle After Another', 'Michael Bauman', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 3),
        (v_cat_cinematography, 'Sinners', 'Autumn Durald Arkapaw', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 4),
        (v_cat_cinematography, 'Train Dreams', 'Adolpho Veloso', 'https://image.tmdb.org/t/p/w500/wfzYOVdafdbD1d3SxNqiBtV2Yhx.jpg', 'movie', 5);

    -- BEST ORIGINAL SCORE (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_score, 'Bugonia', 'Jerskin Fendrix', 'https://image.tmdb.org/t/p/w500/oxgsAQDAAxA92mFGYCZllgWkH9J.jpg', 'movie', 1),
        (v_cat_score, 'Frankenstein', 'Alexandre Desplat', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 2),
        (v_cat_score, 'Hamnet', 'Max Richter', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 3),
        (v_cat_score, 'One Battle After Another', 'Jonny Greenwood', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 4),
        (v_cat_score, 'Sinners', 'Ludwig Goransson', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

    -- BEST ORIGINAL SONG (corrected)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_song, 'Diane Warren: Relentless', '"Dear Me" - Diane Warren', NULL, 'movie', 1),
        (v_cat_song, 'KPop Demon Hunters', '"Golden" - EJAE & others', NULL, 'movie', 2),
        (v_cat_song, 'Sinners', '"I Lied To You" - Raphael Saadiq & Ludwig Goransson', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 3),
        (v_cat_song, 'Viva Verdi!', '"Sweet Dreams Of Joy" - Nicholas Pike', NULL, 'movie', 4),
        (v_cat_song, 'Train Dreams', '"Train Dreams" - Nick Cave & Bryce Dessner', 'https://image.tmdb.org/t/p/w500/wfzYOVdafdbD1d3SxNqiBtV2Yhx.jpg', 'movie', 5);

    -- NEW CATEGORIES

    -- BEST CASTING (new category)
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_casting, 'Hamnet', 'Nina Gold', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 1),
        (v_cat_casting, 'Marty Supreme', 'Jennifer Venditti', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 2),
        (v_cat_casting, 'One Battle After Another', 'Cassandra Kulukundis', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 3),
        (v_cat_casting, 'The Secret Agent', 'Gabriel Domingues', 'https://image.tmdb.org/t/p/w500/iLE2YOmeboeTDC7GlOp1dzh1VFo.jpg', 'movie', 4),
        (v_cat_casting, 'Sinners', 'Francine Maisler', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

    -- BEST COSTUME DESIGN
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_costume, 'Avatar: Fire and Ash', 'Deborah L. Scott', 'https://image.tmdb.org/t/p/w500/6TxzFKUozYbQwkBU1bfJqNwNwTT.jpg', 'movie', 1),
        (v_cat_costume, 'Frankenstein', 'Kate Hawley', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 2),
        (v_cat_costume, 'Hamnet', 'Malgosia Turzanska', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 3),
        (v_cat_costume, 'Marty Supreme', 'Miyako Bellizzi', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 4),
        (v_cat_costume, 'Sinners', 'Ruth E. Carter', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

    -- BEST MAKEUP AND HAIRSTYLING
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_makeup, 'Frankenstein', 'Mike Hill, Jordan Samuel & Cliona Furey', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 1),
        (v_cat_makeup, 'Kokuho', 'Kyoko Toyokawa & others', NULL, 'movie', 2),
        (v_cat_makeup, 'Sinners', 'Ken Diaz, Mike Fontaine & Shunika Terry', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 3),
        (v_cat_makeup, 'The Smashing Machine', 'Kazu Hiro & others', NULL, 'movie', 4),
        (v_cat_makeup, 'The Ugly Stepsister', 'Thomas Foldberg & Anne Cathrine Sauerberg', NULL, 'movie', 5);

    -- BEST PRODUCTION DESIGN
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_production, 'Frankenstein', 'Tamara Deverell; Set Dec: Shane Vieau', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 1),
        (v_cat_production, 'Hamnet', 'Fiona Crombie; Set Dec: Alice Felton', 'https://image.tmdb.org/t/p/w500/61xMzN4h8iLk0hq6oUzr9Ts6GE9.jpg', 'movie', 2),
        (v_cat_production, 'Marty Supreme', 'Jack Fisk; Set Dec: Adam Willis', 'https://image.tmdb.org/t/p/w500/firAhZA0uQvRL2slp7v3AnOj0ZX.jpg', 'movie', 3),
        (v_cat_production, 'One Battle After Another', 'Florencia Martin; Set Dec: Anthony Carlino', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 4),
        (v_cat_production, 'Sinners', 'Hannah Beachler; Set Dec: Monique Champagne', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

    -- BEST SOUND
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_sound, 'F1', 'Gareth John, Al Nelson & others', 'https://image.tmdb.org/t/p/w500/yfVNpLIyDNJX0tMjGQeo9HZCJS7.jpg', 'movie', 1),
        (v_cat_sound, 'Frankenstein', 'Greg Chapman & others', 'https://image.tmdb.org/t/p/w500/g4JtvGlQO7DByTI6frUobqvSL3R.jpg', 'movie', 2),
        (v_cat_sound, 'One Battle After Another', 'José Antonio García & others', 'https://image.tmdb.org/t/p/w500/m1jFoahEbeQXtx4zArT2FKdbNIj.jpg', 'movie', 3),
        (v_cat_sound, 'Sinners', 'Chris Welcker & others', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 4),
        (v_cat_sound, 'Sirāt', 'Amanda Villavieja & others', NULL, 'movie', 5);

    -- BEST DOCUMENTARY SHORT
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_doc_short, 'All the Empty Rooms', 'Joshua Seftel & Conall Jones', NULL, 'movie', 1),
        (v_cat_doc_short, 'Armed Only with a Camera', 'Craig Renaud & Juan Arredondo', NULL, 'movie', 2),
        (v_cat_doc_short, 'Children No More', 'Hilla Medalia & Sheila Nevins', NULL, 'movie', 3),
        (v_cat_doc_short, 'The Devil Is Busy', 'Christalyn Hampton & Geeta Gandbhir', NULL, 'movie', 4),
        (v_cat_doc_short, 'Perfectly a Strangeness', 'Alison McAlpine', NULL, 'movie', 5);

    -- BEST ANIMATED SHORT
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_anim_short, 'Butterfly', 'Florence Miailhe & Ron Dyens', NULL, 'movie', 1),
        (v_cat_anim_short, 'Forevergreen', 'Nathan Engelhardt & Jeremy Spears', NULL, 'movie', 2),
        (v_cat_anim_short, 'The Girl Who Cried Pearls', 'Chris Lavis & Maciek Szczerbowski', NULL, 'movie', 3),
        (v_cat_anim_short, 'Retirement Plan', 'John Kelly & Andrew Freedman', NULL, 'movie', 4),
        (v_cat_anim_short, 'The Three Sisters', 'Konstantin Bronzit', NULL, 'movie', 5);

    -- BEST LIVE ACTION SHORT
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_live_short, 'Butcher''s Stain', 'Meyer Levinson-Blount & Oron Caspi', NULL, 'movie', 1),
        (v_cat_live_short, 'A Friend of Dorothy', 'Lee Knight & James Dean', NULL, 'movie', 2),
        (v_cat_live_short, 'Jane Austen''s Period Drama', 'Julia Aks & Steve Pinder', NULL, 'movie', 3),
        (v_cat_live_short, 'The Singers', 'Sam A. Davis & Jack Piatt', NULL, 'movie', 4),
        (v_cat_live_short, 'Two People Exchanging Saliva', 'Alexandre Singh & Natalie Musteata', NULL, 'movie', 5);

    -- Update Best Picture to use new schema (title instead of name)
    UPDATE awards_nominees 
    SET media_type = 'movie', person_name = NULL
    WHERE category_id = v_cat_best_picture;

    -- Update VFX nominees
    DELETE FROM awards_nominees WHERE category_id = v_cat_vfx;
    INSERT INTO awards_nominees (category_id, title, person_name, poster_url, media_type, display_order) VALUES
        (v_cat_vfx, 'Avatar: Fire and Ash', 'Joe Letteri & others', 'https://image.tmdb.org/t/p/w500/6TxzFKUozYbQwkBU1bfJqNwNwTT.jpg', 'movie', 1),
        (v_cat_vfx, 'F1', 'Ryan Tudhope & others', 'https://image.tmdb.org/t/p/w500/yfVNpLIyDNJX0tMjGQeo9HZCJS7.jpg', 'movie', 2),
        (v_cat_vfx, 'Jurassic World Rebirth', 'David Vickery & others', NULL, 'movie', 3),
        (v_cat_vfx, 'The Lost Bus', 'Charlie Noble & others', NULL, 'movie', 4),
        (v_cat_vfx, 'Sinners', 'Michael Ralla & others', 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg', 'movie', 5);

END $$;
