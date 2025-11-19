-- SQL to insert all 40 games from Excel into Supabase prediction_pools table
-- Run this directly in your Supabase SQL editor

-- First, clean up any existing game data
DELETE FROM prediction_pools WHERE id LIKE 'game-%';

-- Insert Vote Games
INSERT INTO prediction_pools (id, title, description, type, category, points_reward, deadline, status, icon, options, inline, participants, created_at) VALUES
('game-1', 'The Summer I Turned Pretty', 'Who will Belly choose in Season 3?', 'vote', 'tv-show', 10, '2025-10-29 23:59:59+00', 'open', '📺', '["Conrad", "Jeremiah"]', true, 1247, NOW()),
('game-2', 'Barbie vs Oppenheimer', 'Which movie did you think should''ve won the Oscar for Best Picture?', 'vote', 'movie', 10, '2025-10-29 23:59:59+00', 'open', '🎬', '["Barbie", "Oppenheimer"]', true, 2156, NOW()),
('game-3', 'Taylor Swift', 'Which album more iconic?', 'vote', 'music', 10, '2025-10-29 23:59:59+00', 'open', '🎵', '["1989", "Folklore"]', true, 3421, NOW()),
('game-4', 'Drake vs Kendrick', 'Who is the better lyricist?', 'vote', 'music', 10, '2025-10-29 23:59:59+00', 'open', '🎵', '["Drake", "Kendrick"]', true, 2890, NOW()),
('game-5', 'Game of Thrones', 'Who the better character?', 'vote', 'tv-show', 10, '2025-10-29 23:59:59+00', 'open', '📺', '["Jon Snow", "Daenerys"]', true, 1834, NOW()),
('game-6', 'Euphoria', 'Who is Rue''s best friend?', 'vote', 'tv-show', 10, '2025-10-29 23:59:59+00', 'open', '📺', '["Jules", "Lexi"]', true, 1592, NOW()),
('game-7', 'Beyoncé', 'Which was bigger?', 'vote', 'music', 10, '2025-10-29 23:59:59+00', 'open', '🎵', '["Renaissance", "Lemonade"]', true, 2734, NOW()),
('game-8', 'Grammys', 'Album of the Year battle?', 'vote', 'awards', 10, '2025-10-29 23:59:59+00', 'open', '🏆', '["Taylor Swift", "Beyoncé"]', true, 3156, NOW()),
('game-9', 'Billie Eilish', 'Which song is bigger?', 'vote', 'music', 10, '2025-10-29 23:59:59+00', 'open', '🎵', '["Bad Guy", "Ocean Eyes"]', true, 1987, NOW()),
('game-10', 'The Mandalorian', 'Who is more beloved?', 'vote', 'tv-show', 10, '2025-10-29 23:59:59+00', 'open', '📺', '["Grogu", "Mando"]', true, 2341, NOW());

-- Insert Trivia Games
INSERT INTO prediction_pools (id, title, description, type, category, points_reward, deadline, status, icon, options, inline, participants, created_at) VALUES
('game-11', 'Friends', 'What was the name of Ross''s pet monkey?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["Marcel", "Marshal"]', true, 1456, NOW()),
('game-12', 'Harry Potter', 'What house was Cedric Diggory in?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Ravenclaw", "Hufflepuff"]', true, 2134, NOW()),
('game-13', 'The Office', 'Who was Jim''s best friend before Pam?', 'trivia', 'tv-show', 15, '2025-10-29 23:59:59+00', 'open', '📺', '["Pam", "Dwight"]', true, 1789, NOW()),
('game-14', 'The Hunger Games', 'Who won the 75th Hunger Games?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Katniss", "Peeta"]', true, 1623, NOW()),
('game-15', 'Avengers: Endgame', 'Who sacrificed themselves for the Soul Stone?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["Natasha", "Clint"]', true, 2567, NOW()),
('game-16', 'Percy Jackson', 'Who is Percy''s father?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Poseidon", "Zeus"]', true, 1345, NOW()),
('game-17', 'Titanic', 'Who painted Rose?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["Jack", "Cal"]', true, 1876, NOW()),
('game-18', 'Twilight', 'Team Edward or Team Jacob?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Edward", "Jacob"]', true, 2098, NOW()),
('game-19', 'Jurassic Park', 'Who dino the founder?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["John Hammond", "Alan Grant"]', true, 1432, NOW()),
('game-20', 'Lord of the Rings', 'Who destroys the One Ring?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Frodo", "Sam"]', true, 1967, NOW()),
('game-21', 'Star Wars', 'Who is Luke''s father?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["Darth Vader", "Obi-Wan"]', true, 2234, NOW()),
('game-22', 'To Kill a Mockingbird', 'Who is the narrator?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Scout", "Jem"]', true, 1543, NOW()),
('game-23', 'The Last of Us', 'Who the bad lead?', 'trivia', 'tv-show', 15, '2025-10-29 23:59:59+00', 'open', '📺', '["Joel", "Ellie"]', true, 1876, NOW()),
('game-25', 'Olivia Rodrigo', 'Better debut?', 'trivia', 'music', 15, '2025-10-29 23:59:59+00', 'open', '🎵', '["Sour", "folklore"]', true, 1987, NOW()),
('game-26', 'The Great Gatsby', 'Who narrates the story?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Nick", "Gatsby"]', true, 1432, NOW()),
('game-27', 'Breaking Bad', 'Who was the smarter character?', 'trivia', 'tv-show', 15, '2025-10-29 23:59:59+00', 'open', '📺', '["Walter", "Jesse"]', true, 2156, NOW()),
('game-28', 'Divergent', 'What faction did Tris choose?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Erudite", "Dauntless"]', true, 1234, NOW()),
('game-29', 'The Dark Knight', 'Who played the Joker?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["Heath Ledger", "Jared Leto"]', true, 2567, NOW()),
('game-30', 'Matilda', 'Who was Matilda''s teacher?', 'trivia', 'book', 15, '2025-10-29 23:59:59+00', 'open', '📚', '["Miss Honey", "Miss Trunchbull"]', true, 1345, NOW()),
('game-31', 'The Lion King', 'Who killed Mufasa?', 'trivia', 'movie', 15, '2025-10-29 23:59:59+00', 'open', '🎬', '["Scar", "Hyenas"]', true, 1876, NOW());

-- Insert Prediction Games
INSERT INTO prediction_pools (id, title, description, type, category, points_reward, deadline, status, icon, options, inline, participants, created_at) VALUES
('game-32', 'NFL Season 3', 'Who will win Chiefs vs Texans?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["Chiefs", "Texans"]', true, 2134, NOW()),
('game-33', 'NBA Finals 2026', 'Who will take the championship?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["Celtics", "Lakers"]', true, 3456, NOW()),
('game-34', 'NFL Super Bowl 2025', 'Who will win?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["49ers", "Chiefs"]', true, 4567, NOW()),
('game-35', 'UEFA Champions League', 'Who will win?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["Real Madrid", "Man City"]', true, 2890, NOW()),
('game-36', 'World Series 2025', 'Which league wins?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["AL", "NL"]', true, 1876, NOW()),
('game-37', 'NBA MVP 2025', 'Who will win?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["Giannis", "Jokic"]', true, 2345, NOW()),
('game-38', 'UFC', 'Who wins the fight (UFC Fight Night)?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["Garcia", "Onaona"]', true, 1234, NOW()),
('game-39', 'NHL Stanley Cup 2025', 'Who should''ve won the 2025 Stanley Cup Final?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["Florida Panthers", "Edmonton Oilers"]', true, 1567, NOW()),
('game-40', 'Olympics 2028', 'Who wins more medals?', 'predict', 'sports', 20, '2025-10-29 23:59:59+00', 'open', '🏅', '["USA", "China"]', true, 2890, NOW());