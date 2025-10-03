
-- Harry Potter Multi-Question Trivia Game
INSERT INTO prediction_pools (
  id, 
  title, 
  description, 
  type, 
  category, 
  points_reward, 
  status, 
  icon, 
  options, 
  inline, 
  participants, 
  created_at
) VALUES (
  'trivia-harry-potter-full',
  'Harry Potter Trivia Challenge',
  'Test your wizarding knowledge with 20 magical questions!',
  'trivia',
  'book',
  100,
  'open',
  '⚡',
  '[
    {
      "question": "What house was Cedric Diggory in?",
      "options": ["Gryffindor", "Hufflepuff", "Ravenclaw", "Slytherin"],
      "correct": "Hufflepuff"
    },
    {
      "question": "What is Hermione''s cat named?",
      "options": ["Crookshanks", "Scabbers", "Trevor", "Hedwig"],
      "correct": "Crookshanks"
    },
    {
      "question": "What position does Harry play in Quidditch?",
      "options": ["Keeper", "Beater", "Chaser", "Seeker"],
      "correct": "Seeker"
    },
    {
      "question": "What spell is used to unlock doors?",
      "options": ["Alohomora", "Expelliarmus", "Lumos", "Accio"],
      "correct": "Alohomora"
    },
    {
      "question": "Who is the Half-Blood Prince?",
      "options": ["Severus Snape", "Tom Riddle", "Sirius Black", "Lucius Malfoy"],
      "correct": "Severus Snape"
    },
    {
      "question": "What are the Deathly Hallows?",
      "options": ["Wand, Stone, Cloak", "Sword, Cup, Locket", "Ring, Diadem, Snake", "Book, Potion, Map"],
      "correct": "Wand, Stone, Cloak"
    },
    {
      "question": "What creature guards Azkaban?",
      "options": ["Dementors", "Dragons", "Giants", "Acromantulas"],
      "correct": "Dementors"
    },
    {
      "question": "What is Voldemort''s real name?",
      "options": ["Tom Riddle", "Salazar Slytherin", "Gellert Grindelwald", "Barty Crouch"],
      "correct": "Tom Riddle"
    },
    {
      "question": "What platform does the Hogwarts Express leave from?",
      "options": ["9 3/4", "7 1/2", "10 1/4", "8 3/4"],
      "correct": "9 3/4"
    },
    {
      "question": "Who kills Dumbledore?",
      "options": ["Snape", "Voldemort", "Bellatrix", "Draco"],
      "correct": "Snape"
    },
    {
      "question": "What does the spell Expecto Patronum do?",
      "options": ["Summons a Patronus", "Disarms opponent", "Creates light", "Levitates objects"],
      "correct": "Summons a Patronus"
    },
    {
      "question": "What is Hagrid''s first name?",
      "options": ["Rubeus", "Remus", "Rodolphus", "Rufus"],
      "correct": "Rubeus"
    },
    {
      "question": "How many Horcruxes did Voldemort create?",
      "options": ["7", "6", "8", "5"],
      "correct": "7"
    },
    {
      "question": "What is the name of the Weasley''s home?",
      "options": ["The Burrow", "Grimmauld Place", "Shell Cottage", "Spinner''s End"],
      "correct": "The Burrow"
    },
    {
      "question": "Who became headmaster after Dumbledore?",
      "options": ["Snape", "McGonagall", "Flitwick", "Slughorn"],
      "correct": "Snape"
    },
    {
      "question": "What does Felix Felicis do?",
      "options": ["Liquid luck", "Invisibility", "Truth serum", "Love potion"],
      "correct": "Liquid luck"
    },
    {
      "question": "What creature is Aragog?",
      "options": ["Acromantula", "Basilisk", "Dragon", "Hippogriff"],
      "correct": "Acromantula"
    },
    {
      "question": "Who gave Harry the Invisibility Cloak?",
      "options": ["Dumbledore", "Sirius", "James", "Hagrid"],
      "correct": "Dumbledore"
    },
    {
      "question": "What is the core of Harry''s wand?",
      "options": ["Phoenix feather", "Dragon heartstring", "Unicorn hair", "Thestral tail"],
      "correct": "Phoenix feather"
    },
    {
      "question": "Who destroyed the last Horcrux?",
      "options": ["Neville", "Harry", "Ron", "Hermione"],
      "correct": "Neville"
    }
  ]'::jsonb,
  false,
  0,
  NOW()
);
