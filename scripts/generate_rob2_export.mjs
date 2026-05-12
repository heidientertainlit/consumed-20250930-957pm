import { createWriteStream } from 'fs';
import { createHash } from 'crypto';

const SUPABASE_URL = 'https://api.supabase.com/v1/projects/mahpgcogwpawvviapqza/database/query';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const query = `
SELECT
  encode(digest(up.user_id::text, 'md5'), 'hex') as anon_user_id,
  up.pool_id,
  pp.title as question,
  pp.type as pool_type,
  COALESCE(pp.category, '') as category,
  COALESCE(pp.show_tag, '') as show_tag,
  pp.options as options_json,
  up.prediction as response,
  CASE
    WHEN pp.type = 'trivia' AND up.points_earned > 0 THEN 'Correct'
    WHEN pp.type = 'trivia' THEN 'Incorrect'
    ELSE 'Voted'
  END as answer_result,
  COALESCE(dp.label, '') as dna_archetype,
  dp.favorite_genres as favorite_genres_json,
  dp.flavor_notes as flavor_notes_json,
  COALESCE(upt.tv_shows_watched, 0) as tv_shows_watched,
  COALESCE(upt.movies_watched, 0) as movies_watched,
  COALESCE(upt.books_read, 0) as books_read,
  COALESCE(upt.trivia_points, 0) as trivia_points,
  COALESCE(ls.current_streak, 0) as longest_streak
FROM user_predictions up
JOIN prediction_pools pp ON up.pool_id = pp.id
JOIN users u ON up.user_id = u.id
LEFT JOIN dna_profiles dp ON up.user_id = dp.user_id
LEFT JOIN user_points upt ON up.user_id = upt.user_id
LEFT JOIN login_streaks ls ON up.user_id = ls.user_id
WHERE u.is_persona IS NOT true
ORDER BY up.user_id, pp.type, up.pool_id
`;

const res = await fetch(SUPABASE_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query })
});

const rows = await res.json();

if (!Array.isArray(rows)) {
  console.error('Query error:', JSON.stringify(rows));
  process.exit(1);
}

console.log(`Fetched ${rows.length} rows`);

function parseJsonArray(val) {
  if (!val) return '';
  try {
    const arr = Array.isArray(val) ? val : JSON.parse(val);
    return arr.join(' | ');
  } catch { return String(val); }
}

function csvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const headers = [
  'anon_user_id',
  'pool_id',
  'question',
  'options_list',
  'response',
  'answer_result',
  'pool_type',
  'category',
  'show_tag',
  'dna_archetype',
  'favorite_genres',
  'flavor_notes',
  'tv_shows_watched',
  'movies_watched',
  'books_read',
  'trivia_points',
  'longest_streak'
];

const lines = [headers.join(',')];

for (const row of rows) {
  const optionsList = parseJsonArray(row.options_json);
  const favoriteGenres = parseJsonArray(row.favorite_genres_json);
  const flavorNotes = parseJsonArray(row.flavor_notes_json);

  const cells = [
    row.anon_user_id,
    row.pool_id,
    row.question,
    optionsList,
    row.response,
    row.answer_result,
    row.pool_type,
    row.category,
    row.show_tag,
    row.dna_archetype,
    favoriteGenres,
    flavorNotes,
    row.tv_shows_watched,
    row.movies_watched,
    row.books_read,
    row.trivia_points,
    row.longest_streak
  ].map(csvCell);

  lines.push(cells.join(','));
}

const out = lines.join('\n');
import { writeFileSync } from 'fs';
writeFileSync('/home/runner/workspace/rob_data_export-2.csv', out, 'utf8');
console.log(`Written ${lines.length - 1} data rows to rob_data_export-2.csv`);
console.log('Columns:', headers.join(', '));
