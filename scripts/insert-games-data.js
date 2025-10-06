// Script to insert games data into predictionPools table
import { neon } from "@neondatabase/serverless";

// Create database connection
const sql = neon(process.env.DATABASE_URL || '');

// Games data extracted from Excel spreadsheet
const gamesData = [
  // Vote Games
  { activity: 'Vote', mediaType: 'TV Show', item: 'The Summer I Turned Pretty', question: 'Who will Belly choose in Season 3?', options: ['Conrad', 'Jeremiah'], correct: null },
  { activity: 'Vote', mediaType: 'Movie', item: 'Barbie vs Oppenheimer', question: 'Which movie did you think should\'ve won the Oscar for Best Picture?', options: ['Barbie', 'Oppenheimer'], correct: null },
  { activity: 'Vote', mediaType: 'Music', item: 'Taylor Swift', question: 'Which album more iconic?', options: ['1989', 'Folklore'], correct: null },
  { activity: 'Vote', mediaType: 'Music', item: 'Drake vs Kendrick', question: 'Who is the better lyricist?', options: ['Drake', 'Kendrick'], correct: null },
  { activity: 'Vote', mediaType: 'TV Show', item: 'Game of Thrones', question: 'Who the better character?', options: ['Jon Snow', 'Daenerys'], correct: null },
  { activity: 'Vote', mediaType: 'TV Show', item: 'Euphoria', question: 'Who is Rue\'s best friend?', options: ['Jules', 'Lexi'], correct: null },
  { activity: 'Vote', mediaType: 'Music', item: 'Beyoncé', question: 'Which was bigger?', options: ['Renaissance', 'Lemonade'], correct: null },
  { activity: 'Vote', mediaType: 'Awards', item: 'Grammys', question: 'Album of the Year battle?', options: ['Taylor Swift', 'Beyoncé'], correct: null },
  { activity: 'Vote', mediaType: 'Music', item: 'Billie Eilish', question: 'Which song is bigger?', options: ['Bad Guy', 'Ocean Eyes'], correct: null },
  { activity: 'Vote', mediaType: 'TV Show', item: 'The Mandalorian', question: 'Who is more beloved?', options: ['Grogu', 'Mando'], correct: null },

  // Trivia Games  
  { activity: 'Trivia', mediaType: 'Movie', item: 'Friends', question: 'What was the name of Ross\'s pet monkey?', options: ['Marcel', 'Marshal'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'Harry Potter', question: 'What house was Cedric Diggory in?', options: ['Ravenclaw', 'Hufflepuff'], correct: 'B' },
  { activity: 'Trivia', mediaType: 'TV Show', item: 'The Office', question: 'Who was Jim\'s best friend before Pam?', options: ['Pam', 'Dwight'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'The Hunger Games', question: 'Who won the 75th Hunger Games?', options: ['Katniss', 'Peeta'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Movie', item: 'Avengers: Endgame', question: 'Who sacrificed themselves for the Soul Stone?', options: ['Natasha', 'Clint'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'Percy Jackson', question: 'Who is Percy\'s father?', options: ['Poseidon', 'Zeus'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Movie', item: 'Titanic', question: 'Who painted Rose?', options: ['Jack', 'Cal'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'Twilight', question: 'Team Edward or Team Jacob?', options: ['Edward', 'Jacob'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Movie', item: 'Jurassic Park', question: 'Who dino the founder?', options: ['John Hammond', 'Alan Grant'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'Lord of the Rings', question: 'Who destroys the One Ring?', options: ['Frodo', 'Sam'], correct: 'B' },
  { activity: 'Trivia', mediaType: 'Movie', item: 'Star Wars', question: 'Who is Luke\'s father?', options: ['Darth Vader', 'Obi-Wan'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'To Kill a Mockingbird', question: 'Who is the narrator?', options: ['Scout', 'Jem'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'TV Show', item: 'The Last of Us', question: 'Who the bad lead?', options: ['Joel', 'Ellie'], correct: null },
  { activity: 'Trivia', mediaType: 'Movie', item: 'Mean Girls', question: 'Who said "You can\'t sit with us"?', options: ['Gretchen', 'Karen'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Music', item: 'Olivia Rodrigo', question: 'Better debut?', options: ['Sour', 'folklore'], correct: null },
  { activity: 'Trivia', mediaType: 'Book', item: 'The Great Gatsby', question: 'Who narrates the story?', options: ['Nick', 'Gatsby'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'TV Show', item: 'Breaking Bad', question: 'Who was the smarter character?', options: ['Walter', 'Jesse'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'Divergent', question: 'What faction did Tris choose?', options: ['Erudite', 'Dauntless'], correct: null },
  { activity: 'Trivia', mediaType: 'Movie', item: 'The Dark Knight', question: 'Who played the Joker?', options: ['Heath Ledger', 'Jared Leto'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Book', item: 'Matilda', question: 'Who was Matilda\'s teacher?', options: ['Miss Honey', 'Miss Trunchbull'], correct: 'A' },
  { activity: 'Trivia', mediaType: 'Movie', item: 'The Lion King', question: 'Who killed Mufasa?', options: ['Scar', 'Hyenas'], correct: 'A' },

  // Prediction Games
  { activity: 'Predict', mediaType: 'Sports', item: 'NFL Season 3', question: 'Who will win Chiefs vs Texans?', options: ['Chiefs', 'Texans'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'NBA Finals 2026', question: 'Who will take the championship?', options: ['Celtics', 'Lakers'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'NFL Super Bowl 2025', question: 'Who will win?', options: ['49ers', 'Chiefs'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'UEFA Champions League', question: 'Who will win?', options: ['Real Madrid', 'Man City'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'World Series 2025', question: 'Which league wins?', options: ['AL', 'NL'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'NBA MVP 2025', question: 'Who will win?', options: ['Giannis', 'Jokic'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'UFC', question: 'Who wins the fight (UFC Fight Night)?', options: ['Garcia', 'Onaona'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'NHL Stanley Cup 2025', question: 'Who should\'ve won the 2025 Stanley Cup Final?', options: ['Florida Panthers', 'Edmonton Oilers'], correct: null },
  { activity: 'Predict', mediaType: 'Sports', item: 'Olympics 2028', question: 'Who wins more medals?', options: ['USA', 'China'], correct: null }
];

async function insertGamesData() {
  console.log('🎮 Starting games data insertion...');
  
  try {
    // Clear existing mock data if any
    await sql`DELETE FROM prediction_pools WHERE id LIKE 'mock-%' OR id LIKE 'game-%'`;
    
    for (let i = 0; i < gamesData.length; i++) {
      const game = gamesData[i];
      const gameId = `game-${i + 1}`;
      
      // Map activity to type
      const type = game.activity.toLowerCase();
      
      // Create deadline (30 days from now)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);
      
      // Points based on game type
      const pointsReward = type === 'trivia' ? 15 : type === 'predict' ? 20 : 10;
      
      // Create icon based on media type
      const iconMap = {
        'TV Show': '📺',
        'Movie': '🎬', 
        'Sports': '🏅',
        'Book': '📚',
        'Music': '🎵',
        'Awards': '🏆'
      };
      
      const icon = iconMap[game.mediaType] || '🎯';
      
      await sql`
        INSERT INTO prediction_pools (
          id, title, description, type, category, 
          points_reward, deadline, status, icon, 
          options, inline, participants, created_at
        ) VALUES (
          ${gameId},
          ${game.item},
          ${game.question},
          ${type},
          ${game.mediaType.toLowerCase().replace(' ', '-')},
          ${pointsReward},
          ${deadline.toISOString()},
          'open',
          ${icon},
          ${JSON.stringify(game.options)},
          true,
          ${Math.floor(Math.random() * 2000) + 500},
          NOW()
        )
      `;
      
      console.log(`✅ Inserted: ${game.item} (${game.activity})`);
    }
    
    console.log(`🎉 Successfully inserted ${gamesData.length} games!`);
    
  } catch (error) {
    console.error('❌ Error inserting games data:', error);
  }
}

// Run the insertion
insertGamesData();