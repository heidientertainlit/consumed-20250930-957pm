/**
 * JSON to SQL Converter for prediction_pools table
 * 
 * Usage: 
 * 1. Place your JSON file (games.json) in the same directory
 * 2. Run: node scripts/json-to-sql.js
 * 3. Copy the output SQL and paste into Supabase SQL Editor
 * 
 * Template Format (save as games.json):
 * [
 *   {
 *     "id": "poll-movies-example",           // Unique ID (required)
 *     "type": "Poll",                        // "Poll" or "Trivia" (required)
 *     "category": "Movies",                  // Movies, TV, Music, Books, Podcasts (required)
 *     "title": "Which movie is best?",       // Question text (required)
 *     "description": null,                   // Optional description
 *     "options": ["Option A", "Option B"],   // Answer choices (required)
 *     "correct_answer": null,                // For Trivia: "A", "B", "C", "D" (letter maps to option index)
 *     "points_reward": 10,                   // Points for participation (required)
 *     "status": "open",                      // "open", "locked", "completed"
 *     "origin_type": "consumed",             // "consumed" or "user"
 *     "rotation_type": "evergreen",          // "evergreen", "trending", "seasonal"
 *     "difficulty": "easy",                  // "easy", "medium", "chaotic"
 *     "social_prompt": "Tag a friend!",      // Prompt after answering
 *     "publish_at": "2026-01-10T09:00:00-07:00", // When to show (null = immediately)
 *     "icon": "gamepad",                     // Icon name
 *     "media_external_id": null,             // Optional media link
 *     "media_external_source": "manual",     // "manual", "tmdb", "spotify", etc.
 *     "deadline": null,                      // Optional deadline
 *     "tags": null                           // Optional tags array
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');

// Read the JSON file
const inputFile = process.argv[2] || path.join(__dirname, 'games.json');

if (!fs.existsSync(inputFile)) {
  console.log(`
=== JSON to SQL Converter for prediction_pools ===

File not found: ${inputFile}

To use this script:
1. Save your JSON data to: scripts/games.json
2. Run: node scripts/json-to-sql.js
   Or specify a different file: node scripts/json-to-sql.js path/to/your-file.json

Your JSON format looks correct! Just a few adjustments needed:
- Change NaN to null in your JSON
- The script will handle type conversion (Poll→vote, Trivia→trivia)
- The script will convert letter answers (A/B/C/D) to actual option text
`);
  process.exit(1);
}

let data;
try {
  const raw = fs.readFileSync(inputFile, 'utf8');
  // Handle NaN values by replacing them with null
  const cleaned = raw.replace(/:\s*NaN/g, ': null');
  data = JSON.parse(cleaned);
} catch (err) {
  console.error('Error parsing JSON:', err.message);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('JSON must be an array of items');
  process.exit(1);
}

// Convert letter answer (A/B/C/D) to actual option text
function convertCorrectAnswer(letterOrNull, options) {
  if (!letterOrNull || !options || !Array.isArray(options)) return null;
  const letter = String(letterOrNull).toUpperCase().trim();
  const index = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
  if (index >= 0 && index < options.length) {
    return options[index];
  }
  return letterOrNull; // Return original if not a letter
}

// Escape single quotes for SQL
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Format array for JSONB
function formatJSONB(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return 'NULL';
  return `'${JSON.stringify(arr).replace(/'/g, "''")}'::jsonb`;
}

// Format text array
function formatTextArray(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return 'NULL';
  const escaped = arr.map(s => `"${String(s).replace(/"/g, '\\"')}"`).join(',');
  return `ARRAY[${arr.map(s => escapeSQL(s)).join(',')}]::text[]`;
}

// Format timestamp
function formatTimestamp(val) {
  if (!val) return 'NULL';
  return escapeSQL(val);
}

// Map type: Poll→vote, Trivia→trivia, Predict→predict
function mapType(type) {
  const t = String(type).toLowerCase();
  if (t === 'poll') return 'vote';
  if (t === 'trivia') return 'trivia';
  if (t === 'predict' || t === 'prediction') return 'predict';
  return t;
}

// Generate SQL
let sql = `-- Generated SQL for prediction_pools
-- Run this in Supabase SQL Editor
-- Generated: ${new Date().toISOString()}
-- Items: ${data.length}

`;

for (const item of data) {
  const type = mapType(item.type);
  const correctAnswer = type === 'trivia' 
    ? convertCorrectAnswer(item.correct_answer, item.options) 
    : null;
  
  sql += `INSERT INTO prediction_pools (
  id, title, description, type, points_reward, deadline, status, category, icon, options,
  correct_answer, origin_type, rotation_type, difficulty, social_prompt, publish_at,
  media_external_id, media_external_source, tags, created_at
) VALUES (
  ${escapeSQL(item.id)},
  ${escapeSQL(item.title)},
  ${escapeSQL(item.description)},
  ${escapeSQL(type)},
  ${item.points_reward || 10},
  ${formatTimestamp(item.deadline)},
  ${escapeSQL(item.status || 'open')},
  ${escapeSQL(item.category)},
  ${escapeSQL(item.icon || 'gamepad')},
  ${formatJSONB(item.options)},
  ${escapeSQL(correctAnswer)},
  ${escapeSQL(item.origin_type || 'consumed')},
  ${escapeSQL(item.rotation_type)},
  ${escapeSQL(item.difficulty)},
  ${escapeSQL(item.social_prompt)},
  ${formatTimestamp(item.publish_at)},
  ${escapeSQL(item.media_external_id)},
  ${escapeSQL(item.media_external_source)},
  ${formatTextArray(item.tags)},
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  publish_at = EXCLUDED.publish_at,
  status = EXCLUDED.status;

`;
}

// Output
const outputFile = inputFile.replace('.json', '.sql');
fs.writeFileSync(outputFile, sql);
console.log(`
✅ Generated SQL file: ${outputFile}
   Items converted: ${data.length}

Next steps:
1. Open Supabase Dashboard → SQL Editor
2. Paste the contents of ${outputFile}
3. Click "Run"

The SQL uses ON CONFLICT to safely update existing items if IDs match.
`);
