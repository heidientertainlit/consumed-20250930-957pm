-- Consumed Trivia Batch 1: 7 Complete Games (100 points each, 10 pts per correct answer)
-- Run this in Supabase SQL Editor

-- GAME 1: SHREK (ALL MOVIES)
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-shrek-1',
  'Shrek Trivia',
  'Test your knowledge of all Shrek movies!',
  'trivia',
  100,
  'open',
  'Movies',
  '🧅',
  '[
    {"question": "What song does Shrek famously use to open the first movie?", "options": ["All Star", "I''m a Believer", "Accidentally in Love", "Livin'' La Vida Loca"], "correct": "All Star"},
    {"question": "What color is Shrek''s iconic vest?", "options": ["Black", "Brown", "Beige", "Green"], "correct": "Beige"},
    {"question": "What creature does Donkey fall in love with?", "options": ["Fairy", "Dragon", "Mermaid", "Wolf"], "correct": "Dragon"},
    {"question": "What kingdom is Fiona from?", "options": ["Far, Far Away", "Duloc", "Enchanted Meadows", "Dreamland"], "correct": "Far, Far Away"},
    {"question": "What is Prince Charming''s main motivation in Shrek 2?", "options": ["Power", "Love for Fiona", "Revenge", "Fame"], "correct": "Love for Fiona"},
    {"question": "What object does the Fairy Godmother rely on?", "options": ["Magic hat", "Potion book", "Wand", "Crystal ball"], "correct": "Wand"},
    {"question": "What animal does Puss in Boots pretend to be to lower Shrek''s guard?", "options": ["A stray kitten", "A house cat", "A lost pet", "A feral cat"], "correct": "A stray kitten"},
    {"question": "In Shrek the Third, who becomes king?", "options": ["Shrek", "Artie", "Donkey", "Prince Charming"], "correct": "Artie"},
    {"question": "What day are Shrek and Fiona''s children born?", "options": ["Christmas Eve", "Halloween", "New Year''s Day", "Shrek''s Birthday"], "correct": "Halloween"},
    {"question": "What is the name of Shrek and Fiona''s ogre triplets?", "options": ["Fergus, Farkle, Felicia", "Finn, Farley, Fiona Jr.", "Fred, Ford, Faith", "Fenton, Fiddle, Flora"], "correct": "Fergus, Farkle, Felicia"}
  ]'::jsonb,
  'consumed',
  now()
);

-- GAME 2: FRIENDS (OVERALL)
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-friends-1',
  'Friends Trivia',
  'How well do you know the gang from Central Perk?',
  'trivia',
  100,
  'open',
  'TV',
  '☕',
  '[
    {"question": "What is the name of Ross and Monica''s childhood dog?", "options": ["Chi-Chi", "Buddy", "Clunkers", "Scruffy"], "correct": "Chi-Chi"},
    {"question": "What instrument does Phoebe play?", "options": ["Guitar", "Keyboard", "Violin", "Harmonica"], "correct": "Guitar"},
    {"question": "What is Chandler''s job (technically)?", "options": ["IT procurement", "Statistical analysis and data reconfiguration", "Transponster", "Account management"], "correct": "Statistical analysis and data reconfiguration"},
    {"question": "What is the name of Joey''s stuffed penguin?", "options": ["Waddles", "Hugsy", "Penguin Joe", "Slider"], "correct": "Hugsy"},
    {"question": "What does Ross scream when he and Rachel move the couch?", "options": ["Shift!", "Pivot!", "Lift!", "Move!"], "correct": "Pivot!"},
    {"question": "What is Janice''s signature catchphrase?", "options": ["No way!", "Oh. My. Gawd.", "Seriously?", "Get out!"], "correct": "Oh. My. Gawd."},
    {"question": "What is the coffee shop the group frequents?", "options": ["Java House", "Central Café", "Central Perk", "Coffee Spot"], "correct": "Central Perk"},
    {"question": "What fruit is Ross allergic to?", "options": ["Kiwi", "Strawberries", "Mango", "Pineapple"], "correct": "Kiwi"},
    {"question": "Who was Monica''s first kiss?", "options": ["Chandler", "Ross", "Richard", "Joey"], "correct": "Ross"},
    {"question": "What surname do both Joey and Chandler temporarily adopt?", "options": ["Bing", "Tribbiani", "Buffay", "Muriel"], "correct": "Bing"}
  ]'::jsonb,
  'consumed',
  now()
);

-- GAME 3: HARRY POTTER (OVERALL SERIES)
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-harrypotter-1',
  'Harry Potter Trivia',
  'Test your wizarding knowledge!',
  'trivia',
  100,
  'open',
  'Movies',
  '⚡',
  '[
    {"question": "What type of creature is Buckbeak?", "options": ["Hippogriff", "Thestral", "Centaur", "Basilisk"], "correct": "Hippogriff"},
    {"question": "What form does Harry''s Patronus take?", "options": ["Fox", "Stag", "Wolf", "Otter"], "correct": "Stag"},
    {"question": "What is Voldemort''s real name?", "options": ["Tobias Riddle", "Tom Marvolo Riddle", "Thomas M. Riddle", "Theodore Riddle"], "correct": "Tom Marvolo Riddle"},
    {"question": "Who kills Dumbledore?", "options": ["Voldemort", "Bellatrix", "Snape", "Draco"], "correct": "Snape"},
    {"question": "How many Horcruxes were created?", "options": ["5", "6", "7", "8"], "correct": "7"},
    {"question": "What spell cleans wounds?", "options": ["Lumos", "Diffindo", "Episkey", "Stupefy"], "correct": "Episkey"},
    {"question": "Who was the Half-Blood Prince?", "options": ["Harry", "Voldemort", "Dumbledore", "Snape"], "correct": "Snape"},
    {"question": "What platform does the Hogwarts Express leave from?", "options": ["9", "10¾", "9¾", "10"], "correct": "9¾"},
    {"question": "Hermione''s parents have what profession?", "options": ["Doctors", "Dentists", "Teachers", "Scientists"], "correct": "Dentists"},
    {"question": "Which of these is NOT a Hogwarts house?", "options": ["Ravenclaw", "Hufflepuff", "Beauxbatons", "Slytherin"], "correct": "Beauxbatons"}
  ]'::jsonb,
  'consumed',
  now()
);

-- GAME 4: BRANDON SANDERSON (OVERALL)
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-sanderson-1',
  'Brandon Sanderson Trivia',
  'How well do you know the Cosmere?',
  'trivia',
  100,
  'open',
  'Books',
  '📚',
  '[
    {"question": "What fictional universe connects many of Sanderson''s works?", "options": ["Megaverse", "Cosmere", "Omniverse", "Etherrealm"], "correct": "Cosmere"},
    {"question": "What is the magic system in Mistborn primarily based on?", "options": ["Runes", "Allomancy", "Lightweaving", "Glyphs"], "correct": "Allomancy"},
    {"question": "Who is the main character of The Way of Kings?", "options": ["Vin", "Kaladin", "Raoden", "Siri"], "correct": "Kaladin"},
    {"question": "Warbreaker features which pair of princesses?", "options": ["Vivenna & Siri", "Vivenna & Serene", "Siri & Vin", "Siri & Navani"], "correct": "Vivenna & Siri"},
    {"question": "What is Hoid known for appearing as?", "options": ["A scholar", "A worldhopper", "A villain", "A ghost"], "correct": "A worldhopper"},
    {"question": "What color is Stormlight typically depicted as?", "options": ["Gold", "White-blue", "Red", "Green"], "correct": "White-blue"},
    {"question": "Who is the survivor of Hathsin?", "options": ["Kelsier", "Elend", "Sazed", "Marsh"], "correct": "Kelsier"},
    {"question": "What planet is the Stormlight Archive set on?", "options": ["Scadrial", "Roshar", "Nalthis", "Sel"], "correct": "Roshar"},
    {"question": "Spren are associated with which series?", "options": ["Mistborn", "Stormlight", "Elantris", "Skyward"], "correct": "Stormlight"},
    {"question": "What''s Sanderson famous for creating?", "options": ["Soft magic", "Hard magic systems", "No-magic worlds", "Portal fantasy only"], "correct": "Hard magic systems"}
  ]'::jsonb,
  'consumed',
  now()
);

-- GAME 5: NAPOLEON DYNAMITE
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-napoleon-1',
  'Napoleon Dynamite Trivia',
  'Gosh! How well do you know this cult classic?',
  'trivia',
  100,
  'open',
  'Movies',
  '🦙',
  '[
    {"question": "What does Napoleon famously feed Tina the llama?", "options": ["Carrots", "Ham", "Chips", "Casserole"], "correct": "Casserole"},
    {"question": "What dance song does Napoleon perform to?", "options": ["Billie Jean", "Canned Heat", "Footloose", "Shake It Off"], "correct": "Canned Heat"},
    {"question": "What drink does Napoleon buy at the convenience store?", "options": ["Orange soda", "Gatorade", "Milk", "Big Gulp"], "correct": "Milk"},
    {"question": "What does Kip spend hours doing online?", "options": ["Coding", "Chatting with LaFawnduh", "Gaming", "Selling products"], "correct": "Chatting with LaFawnduh"},
    {"question": "What animal does Uncle Rico try to sell?", "options": ["Ponies", "Llamas", "Alpacas", "Cows"], "correct": "Alpacas"},
    {"question": "What food item does Napoleon store in his cargo pants?", "options": ["Tater tots", "Burrito", "Pizza slice", "Granola bar"], "correct": "Tater tots"},
    {"question": "What office does Pedro run for?", "options": ["Treasurer", "Class President", "Secretary", "Homecoming King"], "correct": "Class President"},
    {"question": "What does Napoleon draw for Pedro''s campaign?", "options": ["A liger", "A unicorn", "A horse", "A wolf"], "correct": "A liger"},
    {"question": "What is a liger?", "options": ["A mythical lion-tiger hybrid", "A real animal", "A wolf-lion", "A tiger-leopard"], "correct": "A mythical lion-tiger hybrid"},
    {"question": "What gift does Deb try to sell door-to-door?", "options": ["Bracelets", "Glamour shots", "Cheese bread", "Homemade crafts"], "correct": "Glamour shots"}
  ]'::jsonb,
  'consumed',
  now()
);

-- GAME 6: MEAN GIRLS
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-meangirls-1',
  'Mean Girls Trivia',
  'That''s so fetch! Test your Plastics knowledge.',
  'trivia',
  100,
  'open',
  'Movies',
  '💅',
  '[
    {"question": "What day do the Plastics wear pink?", "options": ["Tuesdays", "Fridays", "Mondays", "Wednesdays"], "correct": "Wednesdays"},
    {"question": "What is the Burn Book?", "options": ["A diary", "A scrapbook", "A gossip book", "A yearbook"], "correct": "A gossip book"},
    {"question": "What sport does Cady join?", "options": ["Soccer", "Lacrosse", "Mathletes", "Track"], "correct": "Mathletes"},
    {"question": "Regina George''s mom says she''s what?", "options": ["A cool mom", "A strict mom", "A tired mom", "A dance mom"], "correct": "A cool mom"},
    {"question": "What candy cane quote does Gretchen obsess over?", "options": ["You go, girl", "4 for you, Glen Coco!", "That is so fetch", "Boo, you wh—"], "correct": "4 for you, Glen Coco!"},
    {"question": "What does Damien call Cady?", "options": ["Africa", "New girl", "Mathlete", "Pink girl"], "correct": "Africa"},
    {"question": "What is Regina''s sister doing in the living room?", "options": ["Tap dancing", "Hip-hop dancing", "Twerking", "Breakdancing"], "correct": "Hip-hop dancing"},
    {"question": "What happens when Gretchen tries to make fetch happen?", "options": ["Everyone laughs", "Regina shuts it down", "It becomes a trend", "It appears in the Burn Book"], "correct": "Regina shuts it down"},
    {"question": "What color dress does Cady wear at the Halloween party?", "options": ["Pink", "Black", "White", "Red"], "correct": "White"},
    {"question": "What does Regina eat to gain weight?", "options": ["Protein bars", "Kalteen bars", "Toaster strudels", "Gummies"], "correct": "Kalteen bars"}
  ]'::jsonb,
  'consumed',
  now()
);

-- GAME 7: BARBIE (2023)
INSERT INTO prediction_pools (id, title, description, type, points_reward, status, category, icon, options, origin_type, created_at)
VALUES (
  'consumed-trivia-barbie-1',
  'Barbie (2023) Trivia',
  'Hi Barbie! How well do you know Barbie Land?',
  'trivia',
  100,
  'open',
  'Movies',
  '💖',
  '[
    {"question": "Who directed Barbie (2023)?", "options": ["Greta Gerwig", "Patty Jenkins", "Sofia Coppola", "Nora Ephron"], "correct": "Greta Gerwig"},
    {"question": "Who plays Ken?", "options": ["Chris Evans", "Ryan Gosling", "Zac Efron", "Channing Tatum"], "correct": "Ryan Gosling"},
    {"question": "What song triggers the Kens'' big dance battle?", "options": ["I''m Just Ken", "Dance the Night", "What Was I Made For?", "Pink"], "correct": "I''m Just Ken"},
    {"question": "Where does Barbie travel to?", "options": ["Dreamworld", "The Real World", "Malibu 2.0", "The Dollhouse"], "correct": "The Real World"},
    {"question": "What causes Barbie''s existential crisis?", "options": ["Her hair falls out", "Her feet go flat", "Her clothes fade", "She loses her Dreamhouse"], "correct": "Her feet go flat"},
    {"question": "Barbie''s perfect day starts with what?", "options": ["Beach", "Breakfast", "Compliments", "Dancing"], "correct": "Dancing"},
    {"question": "What company does Mattel try to put Barbie back into?", "options": ["A toy box", "An accessory set", "A new line", "A pink box"], "correct": "A pink box"},
    {"question": "What is Weird Barbie known for doing?", "options": ["Breakdancing", "Gymnast moves", "Being played with too hard", "Dressing strangely"], "correct": "Being played with too hard"},
    {"question": "What power do the Kens try to take over?", "options": ["Barbie Land government", "Dreamhouses", "The beach", "The humans"], "correct": "Barbie Land government"},
    {"question": "What final decision does Barbie make?", "options": ["Stay perfect", "Become human", "Become President", "Stay with Ken"], "correct": "Become human"}
  ]'::jsonb,
  'consumed',
  now()
);
