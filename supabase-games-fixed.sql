-- Fixed SQL: Better ID names + NO DEADLINES
-- Run this in your Supabase SQL editor to replace the games

-- Clean up existing games
DELETE FROM prediction_pools WHERE id LIKE 'game-%' OR type IN ('vote', 'trivia', 'predict');

-- Insert Vote Games with better IDs and NO deadlines
INSERT INTO prediction_pools (id, title, description, type, category, points_reward, status, icon, options, inline, participants, created_at) VALUES
('vote-summer-turned-pretty', 'The Summer I Turned Pretty', 'Who will Belly choose in Season 3?', 'vote', 'tv-show', 10, 'open', '📺', '["Conrad", "Jeremiah"]', true, 1247, NOW()),
('vote-barbie-oppenheimer', 'Barbie vs Oppenheimer', 'Which movie did you think should''ve won the Oscar for Best Picture?', 'vote', 'movie', 10, 'open', '🎬', '["Barbie", "Oppenheimer"]', true, 2156, NOW()),
('vote-taylor-swift-albums', 'Taylor Swift', 'Which album more iconic?', 'vote', 'music', 10, 'open', '🎵', '["1989", "Folklore"]', true, 3421, NOW()),
('vote-drake-vs-kendrick', 'Drake vs Kendrick', 'Who is the better lyricist?', 'vote', 'music', 10, 'open', '🎵', '["Drake", "Kendrick"]', true, 2890, NOW()),
('vote-game-of-thrones', 'Game of Thrones', 'Who the better character?', 'vote', 'tv-show', 10, 'open', '📺', '["Jon Snow", "Daenerys"]', true, 1834, NOW()),
('vote-euphoria-rue-friend', 'Euphoria', 'Who is Rue''s best friend?', 'vote', 'tv-show', 10, 'open', '📺', '["Jules", "Lexi"]', true, 1592, NOW()),
('vote-beyonce-albums', 'Beyoncé', 'Which was bigger?', 'vote', 'music', 10, 'open', '🎵', '["Renaissance", "Lemonade"]', true, 2734, NOW()),
('vote-grammys-album-year', 'Grammys', 'Album of the Year battle?', 'vote', 'awards', 10, 'open', '🏆', '["Taylor Swift", "Beyoncé"]', true, 3156, NOW()),
('vote-billie-eilish-songs', 'Billie Eilish', 'Which song is bigger?', 'vote', 'music', 10, 'open', '🎵', '["Bad Guy", "Ocean Eyes"]', true, 1987, NOW()),
('vote-mandalorian-beloved', 'The Mandalorian', 'Who is more beloved?', 'vote', 'tv-show', 10, 'open', '📺', '["Grogu", "Mando"]', true, 2341, NOW());

-- Insert Trivia Games with better IDs and NO deadlines
INSERT INTO prediction_pools (id, title, description, type, category, points_reward, status, icon, options, inline, participants, created_at) VALUES
('trivia-friends-monkey', 'Friends', 'What was the name of Ross''s pet monkey?', 'trivia', 'movie', 15, 'open', '🎬', '["Marcel", "Marshal"]', true, 1456, NOW()),
('trivia-harry-potter-cedric', 'Harry Potter', 'What house was Cedric Diggory in?', 'trivia', 'book', 15, 'open', '📚', '["Ravenclaw", "Hufflepuff"]', true, 2134, NOW()),
('trivia-office-jim-friend', 'The Office', 'Who was Jim''s best friend before Pam?', 'trivia', 'tv-show', 15, 'open', '📺', '["Pam", "Dwight"]', true, 1789, NOW()),
('trivia-hunger-games-75th', 'The Hunger Games', 'Who won the 75th Hunger Games?', 'trivia', 'book', 15, 'open', '📚', '["Katniss", "Peeta"]', true, 1623, NOW()),
('trivia-avengers-soul-stone', 'Avengers: Endgame', 'Who sacrificed themselves for the Soul Stone?', 'trivia', 'movie', 15, 'open', '🎬', '["Natasha", "Clint"]', true, 2567, NOW()),
('trivia-percy-jackson-father', 'Percy Jackson', 'Who is Percy''s father?', 'trivia', 'book', 15, 'open', '📚', '["Poseidon", "Zeus"]', true, 1345, NOW()),
('trivia-titanic-rose-painter', 'Titanic', 'Who painted Rose?', 'trivia', 'movie', 15, 'open', '🎬', '["Jack", "Cal"]', true, 1876, NOW()),
('trivia-twilight-team', 'Twilight', 'Team Edward or Team Jacob?', 'trivia', 'book', 15, 'open', '📚', '["Edward", "Jacob"]', true, 2098, NOW()),
('trivia-jurassic-park-founder', 'Jurassic Park', 'Who dino the founder?', 'trivia', 'movie', 15, 'open', '🎬', '["John Hammond", "Alan Grant"]', true, 1432, NOW()),
('trivia-lotr-ring-destroyer', 'Lord of the Rings', 'Who destroys the One Ring?', 'trivia', 'book', 15, 'open', '📚', '["Frodo", "Sam"]', true, 1967, NOW()),
('trivia-star-wars-father', 'Star Wars', 'Who is Luke''s father?', 'trivia', 'movie', 15, 'open', '🎬', '["Darth Vader", "Obi-Wan"]', true, 2234, NOW()),
('trivia-mockingbird-narrator', 'To Kill a Mockingbird', 'Who is the narrator?', 'trivia', 'book', 15, 'open', '📚', '["Scout", "Jem"]', true, 1543, NOW()),
('trivia-last-of-us-lead', 'The Last of Us', 'Who the bad lead?', 'trivia', 'tv-show', 15, 'open', '📺', '["Joel", "Ellie"]', true, 1876, NOW()),
('trivia-mean-girls-quote', 'Mean Girls', 'Who said "You can''t sit with us"?', 'trivia', 'movie', 15, 'open', '🎬', '["Gretchen", "Karen"]', true, 1654, NOW()),
('trivia-olivia-rodrigo-debut', 'Olivia Rodrigo', 'Better debut?', 'trivia', 'music', 15, 'open', '🎵', '["Sour", "folklore"]', true, 1987, NOW()),
('trivia-gatsby-narrator', 'The Great Gatsby', 'Who narrates the story?', 'trivia', 'book', 15, 'open', '📚', '["Nick", "Gatsby"]', true, 1432, NOW()),
('trivia-breaking-bad-smarter', 'Breaking Bad', 'Who was the smarter character?', 'trivia', 'tv-show', 15, 'open', '📺', '["Walter", "Jesse"]', true, 2156, NOW()),
('trivia-divergent-faction', 'Divergent', 'What faction did Tris choose?', 'trivia', 'book', 15, 'open', '📚', '["Erudite", "Dauntless"]', true, 1234, NOW()),
('trivia-dark-knight-joker', 'The Dark Knight', 'Who played the Joker?', 'trivia', 'movie', 15, 'open', '🎬', '["Heath Ledger", "Jared Leto"]', true, 2567, NOW()),
('trivia-matilda-teacher', 'Matilda', 'Who was Matilda''s teacher?', 'trivia', 'book', 15, 'open', '📚', '["Miss Honey", "Miss Trunchbull"]', true, 1345, NOW()),
('trivia-lion-king-mufasa', 'The Lion King', 'Who killed Mufasa?', 'trivia', 'movie', 15, 'open', '🎬', '["Scar", "Hyenas"]', true, 1876, NOW());

-- Insert Prediction Games with better IDs and NO deadlines
INSERT INTO prediction_pools (id, title, description, type, category, points_reward, status, icon, options, inline, participants, created_at) VALUES
('predict-nfl-chiefs-texans', 'NFL Season 3', 'Who will win Chiefs vs Texans?', 'predict', 'sports', 20, 'open', '⚽', '["Chiefs", "Texans"]', true, 2134, NOW()),
('predict-nba-finals-2026', 'NBA Finals 2026', 'Who will take the championship?', 'predict', 'sports', 20, 'open', '⚽', '["Celtics", "Lakers"]', true, 3456, NOW()),
('predict-super-bowl-2025', 'NFL Super Bowl 2025', 'Who will win?', 'predict', 'sports', 20, 'open', '⚽', '["49ers", "Chiefs"]', true, 4567, NOW()),
('predict-uefa-champions', 'UEFA Champions League', 'Who will win?', 'predict', 'sports', 20, 'open', '⚽', '["Real Madrid", "Man City"]', true, 2890, NOW()),
('predict-world-series-2025', 'World Series 2025', 'Which league wins?', 'predict', 'sports', 20, 'open', '⚽', '["AL", "NL"]', true, 1876, NOW()),
('predict-nba-mvp-2025', 'NBA MVP 2025', 'Who will win?', 'predict', 'sports', 20, 'open', '⚽', '["Giannis", "Jokic"]', true, 2345, NOW()),
('predict-ufc-fight-night', 'UFC', 'Who wins the fight (UFC Fight Night)?', 'predict', 'sports', 20, 'open', '⚽', '["Garcia", "Onaona"]', true, 1234, NOW()),
('predict-nhl-stanley-cup', 'NHL Stanley Cup 2025', 'Who should''ve won the 2025 Stanley Cup Final?', 'predict', 'sports', 20, 'open', '⚽', '["Florida Panthers", "Edmonton Oilers"]', true, 1567, NOW()),
('predict-olympics-2028', 'Olympics 2028', 'Who wins more medals?', 'predict', 'sports', 20, 'open', '⚽', '["USA", "China"]', true, 2890, NOW());