import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCanonicalMedia } from '../_shared/canonical-media.ts';
import { IMPORT_POINT_WEIGHTS, importPointsForInserted, reconcileImportOutcomes } from '../_shared/import-ledger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface MediaItem {
  title: string;
  mediaType: string;
  creator?: string;
  imageUrl?: string;
  notes?: string;
  listType: string;
  rating?: number;
  year?: string;          // for TMDB matching (Letterboxd)
  searchTitle?: string;   // bare title without "(Year)" for lookups
  externalId?: string;
  externalSource?: string;
  sourceRowIndex?: number;
}

// These IDs are returned only from rows inserted by this invocation. They are
// deliberately retained so deferred canonicalization can never touch a user's
// historical library or ratings.
interface InsertedListRow {
  id: string;
  title: string;
  media_type: string;
  creator?: string | null;
  external_id?: string | null;
  external_source?: string | null;
  import_source_row_index?: number | null;
}

interface InsertedRatingRow {
  id: string;
  media_title: string;
  media_type: string;
  media_external_id: string;
  media_external_source: string;
  import_source_row_index?: number | null;
}

// Cache for TMDB lookups to avoid duplicate API calls
const mediaTypeCache: Record<string, 'movie' | 'tv'> = {};

// Clean up title for TMDB search
function cleanTitle(title: string): string {
  return title
    .replace(/:\s*(Season|Series|Part|Volume)\s*\d+.*/i, '')
    .replace(/:\s*(Limited Series|Miniseries).*/i, '')
    .replace(/\s*\(.*\)\s*$/, '') // Remove year in parentheses
    .trim();
}

// TMDB API lookup to detect if a title is a movie or TV show
// With retry logic for rate limiting (429 responses)
async function detectMediaType(title: string, retries = 2): Promise<'movie' | 'tv'> {
  const cleanedTitle = cleanTitle(title);
  
  // Check cache first
  if (mediaTypeCache[cleanedTitle]) {
    return mediaTypeCache[cleanedTitle];
  }
  
  const tmdbKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbKey) {
    console.log('No TMDB_API_KEY, defaulting to tv');
    return 'tv';
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(cleanedTitle)}&page=1&include_adult=false`
    );
    
    // Handle rate limiting with retry
    if (response.status === 429 && retries > 0) {
      console.log('TMDB rate limited, waiting 2s before retry...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return detectMediaType(title, retries - 1);
    }
    
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        // Get first result that's either movie or TV
        const match = data.results.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
        if (match) {
          const mediaType = match.media_type as 'movie' | 'tv';
          mediaTypeCache[cleanedTitle] = mediaType;
          return mediaType;
        }
      }
    }
  } catch (error) {
    console.error('TMDB lookup error for:', title, error);
  }
  
  // Default to TV if we can't determine (Netflix has more TV content)
  mediaTypeCache[cleanedTitle] = 'tv';
  return 'tv';
}

// ── Catalog enrichment: attach poster + real catalog IDs to imported items ──
// Movies → TMDB; books → Google Books. Lookup failures leave the item as-is
// (it still imports, just without a poster). Never throws.
function normTitle(t: string): string {
  return (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanBookIdentifier(value: string | undefined): string {
  const cleaned = String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : '';
}

async function enrichMovie(item: MediaItem): Promise<void> {
  const tmdbKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbKey) return;
  try {
    const bare = item.searchTitle || cleanTitle(item.title);
    const query = encodeURIComponent(bare);
    const yearParam = item.year ? `&year=${encodeURIComponent(item.year)}` : '';
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${query}${yearParam}&page=1&include_adult=false`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    // Only accept a confident match: title must line up, and if we know the
    // year it must be within a year (re-releases sometimes differ by one).
    const match = (data.results || []).find((r: any) => {
      if (normTitle(r.title) !== normTitle(bare) && normTitle(r.original_title) !== normTitle(bare)) return false;
      if (item.year && r.release_date) {
        const ry = parseInt(r.release_date.slice(0, 4));
        if (!isNaN(ry) && Math.abs(ry - parseInt(item.year)) > 1) return false;
      }
      return true;
    });
    if (!match) return;
    item.externalId = String(match.id);
    item.externalSource = 'tmdb';
    if (match.poster_path) item.imageUrl = `https://image.tmdb.org/t/p/w500${match.poster_path}`;
  } catch (e) {
    console.error('TMDB enrich failed for', item.title, e);
  }
}

async function enrichBook(item: MediaItem): Promise<void> {
  try {
    const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
    const parts = [`intitle:${item.title.replace(/\s*\(.*\)\s*$/, '')}`];
    if (item.creator) parts.push(`inauthor:${item.creator}`);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(parts.join(' '))}&maxResults=5${key ? `&key=${key}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = res.ok ? await res.json() : null;
    const bare = item.title.replace(/\s*\(.*\)\s*$/, '');
    // Only accept volumes whose title actually matches (Goodreads titles often
    // carry series suffixes, so allow prefix containment either way).
    const vols = (data?.items || []).filter((v: any) => {
      const vt = normTitle(v.volumeInfo?.title || '');
      const bt = normTitle(bare);
      return vt && bt && (vt === bt || vt.startsWith(bt) || bt.startsWith(vt));
    });
    // Prefer an edition that actually has a cover (coverless editions return a gray placeholder).
    const withCover = vols.find((v: any) => v.volumeInfo?.imageLinks?.thumbnail) || vols[0];
    if (withCover) {
      item.externalId = withCover.id;
      item.externalSource = 'googlebooks';
      const thumb = withCover.volumeInfo?.imageLinks?.thumbnail;
      if (thumb) item.imageUrl = thumb.replace('http://', 'https://');
      return;
    }

    // Google Books regularly exhausts its project quota. Fall back to an exact
    // Open Library title/author match rather than dropping imported ratings.
    const olRes = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(bare)}&limit=8&fields=key,title,author_name,cover_i`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'ConsumedApp-Import/1.0' },
      },
    );
    if (!olRes.ok) return;
    const olData = await olRes.json();
    const wantedAuthor = normTitle(item.creator || '');
    const matches = (olData.docs || []).filter((doc: any) => {
      if (normTitle(doc?.title || '') !== normTitle(bare)) return false;
      if (!wantedAuthor) return true;
      return (doc.author_name || []).some((author: string) => {
        const candidate = normTitle(author);
        return candidate === wantedAuthor || candidate.includes(wantedAuthor) || wantedAuthor.includes(candidate);
      });
    });
    const match = matches[0];
    const workId = String(match?.key || '').match(/^\/works\/(OL\d+W)$/i)?.[1];
    if (!workId) return;
    item.externalId = workId;
    item.externalSource = 'openlibrary';
    if (match.cover_i) item.imageUrl = `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`;
  } catch (e) {
    console.error('Book catalog enrich failed for', item.title, e);
  }
}

// Validate if a string looks like a real media title (not junk data)
function isValidTitle(title: string): boolean {
  if (!title || title.length < 2) return false;
  if (title.length > 200) return false;
  
  // Reject timestamps (00:43:51 format)
  if (/^\d{2}:\d{2}:\d{2}$/.test(title)) return false;
  
  // Reject dates (2022-03-27 or 2022-03-27 15:37 format)
  if (/^\d{4}-\d{2}-\d{2}/.test(title)) return false;
  
  // Reject email addresses
  if (/^[^@]+@[^@]+\.[^@]+$/.test(title) || title.includes('GMAIL.COM') || title.includes('@')) return false;
  
  // Reject device IDs (AMZ_*, SAMSUNG_*, etc.)
  if (/^(AMZ_|SAMSUNG_|LG_|ROKU_|APPLE_)/i.test(title)) return false;
  
  // Reject common Netflix profile names that aren't titles
  if (/^(Kids|Kimberly|WeWorkKimiHouse)$/i.test(title)) return false;
  
  // Reject if it's just "true" or "false" (boolean values)
  if (/^(true|false)$/i.test(title)) return false;
  
  // Reject very short nonsense (single words under 3 chars that aren't real titles)
  if (title.length <= 3 && !/^(Up|Us|It|Her|Him|Elf|Ip Man)$/i.test(title)) return false;
  
  // Reject countdown/system strings
  if (/^countdown_/i.test(title)) return false;
  
  // Reject if mostly numbers or special characters
  const letterCount = (title.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < title.length * 0.3) return false;
  
  return true;
}

// Parse Netflix CSV format with TMDB lookup for media type detection
async function parseNetflix(csvText: string): Promise<MediaItem[]> {
  const lines = csvText.split('\n').filter(line => line.trim());
  const items: MediaItem[] = [];
  
  // Skip header row, parse data
  const allTitles: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',').map(f => f.trim().replace(/^"|"$/g, ''));
    if (fields.length >= 1 && fields[0]) {
      allTitles.push(fields[0]);
    }
  }
  
  // Filter out junk data
  const titles = allTitles.filter(isValidTitle);
  const rejectedCount = allTitles.length - titles.length;
  
  if (rejectedCount > 0) {
    console.log(`Netflix: Rejected ${rejectedCount} invalid entries (timestamps, device IDs, etc.)`);
  }
  
  if (titles.length === 0) {
    console.log('Netflix: No valid titles found. Please upload ViewingActivity.csv from Netflix data export.');
    return [];
  }
  
  console.log(`Netflix: Found ${titles.length} valid titles, detecting media types via TMDB...`);
  
  // TMDB rate limit: 40 requests per 10 seconds (4/sec average)
  // Process 3 at a time with 800ms delay = ~3.75 req/sec (safe margin)
  const batchSize = 3;
  let movieCount = 0;
  let tvCount = 0;
  
  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const mediaTypes = await Promise.all(batch.map(title => detectMediaType(title)));
    
    for (let j = 0; j < batch.length; j++) {
      const mediaType = mediaTypes[j];
      if (mediaType === 'movie') movieCount++;
      else tvCount++;
      
      items.push({
        title: batch[j],
        mediaType,
        listType: 'finished',
        sourceRowIndex: i + j + 1,
      });
    }
    
    // Delay between batches to stay under TMDB rate limit
    if (i + batchSize < titles.length) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Log progress for large imports
    if ((i + batchSize) % 50 === 0) {
      console.log(`Netflix: Processed ${i + batchSize}/${titles.length} titles...`);
    }
  }
  
  console.log(`Netflix: Detected ${movieCount} movies and ${tvCount} TV shows`);
  return items;
}

// Parse Goodreads CSV format
function parseGoodreads(csvText: string): MediaItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const items: MediaItem[] = [];
  
  // Find header indices - Goodreads CSV has columns like: Title, Author, My Rating, Date Read, etc.
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const titleIdx = header.indexOf('title');
  const authorIdx = header.indexOf('author');
  const ratingIdx = header.findIndex(h => h.includes('my rating') || h === 'rating');
  const dateReadIdx = header.findIndex(h => h.includes('date read'));
  const shelfIdx = header.findIndex(h => h.includes('exclusive shelf') || h === 'shelf');
  const bookIdIdx = header.findIndex(h => h === 'book id' || h === 'bookid');
  const isbnIdx = header.indexOf('isbn');
  const isbn13Idx = header.indexOf('isbn13');
  
  console.log('Goodreads headers found:', { titleIdx, authorIdx, ratingIdx, dateReadIdx, shelfIdx });
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with quotes properly (Goodreads has commas in titles)
    const fields = parseCSVLine(lines[i]);
    if (fields[titleIdx]) {
      const rating = ratingIdx >= 0 ? parseInt(fields[ratingIdx]) || 0 : 0;
      const shelf = shelfIdx >= 0 ? fields[shelfIdx]?.toLowerCase() : 'read';
      const isbn13 = isbn13Idx >= 0 ? cleanBookIdentifier(fields[isbn13Idx]) : '';
      const isbn10 = isbnIdx >= 0 ? cleanBookIdentifier(fields[isbnIdx]) : '';
      const goodreadsId = bookIdIdx >= 0 ? String(fields[bookIdIdx] || '').trim() : '';
      const catalogId = isbn13 || isbn10;
      
      // Map Goodreads shelves to our list types
      let listType = 'finished';
      if (shelf === 'to-read' || shelf === 'want-to-read') {
        listType = 'want-to';
      } else if (shelf === 'currently-reading') {
        listType = 'currently';
      }
      
      items.push({
        title: fields[titleIdx],
        mediaType: 'book',
        creator: fields[authorIdx] || '',
        rating: rating,
        listType: listType,
        externalId: catalogId || goodreadsId || undefined,
        externalSource: catalogId ? 'openlibrary' : goodreadsId ? 'goodreads' : undefined,
        sourceRowIndex: i,
      });
    }
  }
  
  console.log(`Goodreads: Parsed ${items.length} books, ${items.filter(i => i.rating && i.rating > 0).length} with ratings`);
  return items;
}

// Helper to parse CSV line with proper quote handling
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim().replace(/^"|"$/g, ''));
  
  return fields;
}

// Parse Letterboxd CSV format.
// Handles the full export: watched.csv (Date,Name,Year,...), ratings.csv
// (...,Rating), diary.csv, and list files (Position,Name,Year,...).
function parseLetterboxd(csvText: string): MediaItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const items: MediaItem[] = [];

  // Find the header row: any line containing both a Name and a Year column.
  let headerIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = parseCSVLine(lines[i]).map(h => h.toLowerCase());
    if (cols.includes('name') && cols.includes('year')) {
      headerIdx = i;
      header = cols;
      break;
    }
  }

  if (headerIdx === -1) {
    console.log('Letterboxd: Could not find a header row with Name and Year columns');
    return items;
  }

  const nameIdx = header.indexOf('name');
  const yearIdx = header.indexOf('year');
  const ratingIdx = header.indexOf('rating');
  const uriIdx = header.findIndex((value) => value === 'letterboxd uri' || value === 'uri');

  console.log(`Letterboxd: header at line ${headerIdx}, name=${nameIdx}, year=${yearIdx}, rating=${ratingIdx}`);

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const name = fields[nameIdx];
    if (!name || name === 'Name') continue;
    const year = fields[yearIdx] || '';
    const title = year ? `${name} (${year})` : name;
    const letterboxdUri = uriIdx >= 0 ? String(fields[uriIdx] || '') : '';
    const letterboxdId = letterboxdUri.match(/letterboxd\.com\/film\/([^/?#]+)/i)?.[1];

    // Letterboxd ratings are 0.5–5 stars; round half-stars to our 1–5 scale.
    let rating = 0;
    if (ratingIdx >= 0 && fields[ratingIdx]) {
      const raw = parseFloat(fields[ratingIdx]);
      if (!isNaN(raw) && raw > 0) rating = Math.min(5, Math.max(1, Math.round(raw)));
    }

    items.push({
      title,
      searchTitle: name,
      year,
      mediaType: 'movie',
      listType: 'finished',
      rating,
      externalId: letterboxdId || undefined,
      externalSource: letterboxdId ? 'letterboxd' : undefined,
      sourceRowIndex: i,
    });
  }

  console.log(`Letterboxd: Parsed ${items.length} movies, ${items.filter(i => (i.rating || 0) > 0).length} with ratings`);
  return items;
}

// Detect format and parse (async to support Netflix TMDB lookups)
async function parseImportFile(content: string, filename: string): Promise<MediaItem[]> {
  const lower = filename.toLowerCase();
  
  if (lower.includes('netflix')) {
    return await parseNetflix(content);
  } else if (lower.includes('goodreads')) {
    return parseGoodreads(content);
  } else if (lower.includes('letterboxd')) {
    return parseLetterboxd(content);
  }
  
  // Try to auto-detect based on headers
  const firstLine = content.split('\n')[0].toLowerCase();
  if (firstLine.includes('title') && firstLine.includes('author')) {
    return parseGoodreads(content);
  } else if (firstLine.includes('name') && firstLine.includes('year')) {
    return parseLetterboxd(content);
  } else {
    // Default to Netflix parsing with TMDB detection
    return await parseNetflix(content);
  }
}

const IMPORT_POINTS = IMPORT_POINT_WEIGHTS;

function importSource(filename: string, content?: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('goodreads')) return 'goodreads';
  if (lower.includes('letterboxd')) return 'letterboxd';
  const firstLine = (content || '').split('\n')[0]?.toLowerCase() || '';
  if (firstLine.includes('title') && firstLine.includes('author')) return 'goodreads';
  if (firstLine.includes('name') && firstLine.includes('year')) return 'letterboxd';
  if (firstLine.includes('title') && (firstLine.includes('date') || firstLine.includes('profile'))) return 'netflix';
  return 'unknown';
}

function safeImportFilename(filename: string): string {
  const basename = String(filename || 'upload').split(/[\\/]/).pop() || 'upload';
  return basename.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160) || 'upload';
}

serve(async (req) => {
  let importBatchId: string | null = null;
  let ledgerAdmin: ReturnType<typeof createClient> | null = null;
  let hasDurableRowLedger = false;
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user (SAME AS track-media)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accountAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Import: Auth user:', user.id);

    // Look up app user by email, CREATE if doesn't exist (SAME AS track-media)
    let { data: appUser, error: appUserError } = await accountAdmin
      .from('users')
      .select('id, email, user_name')
      .eq('id', user.id)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('Import: User not found, creating profile for:', user.id);
      const { data: newUser, error: createError } = await accountAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Import: Failed to create user:', createError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
      console.log('Import: Created new user:', appUser);
    } else if (appUserError) {
      console.error('Import: User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — far larger than any real export
    if (file.size > MAX_FILE_BYTES) {
      return new Response(JSON.stringify({ error: 'File too large (limit 20MB). Export files are normally well under this.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const okName = /\.(csv|zip)$/i.test(file.name || '');
    if (!okName) {
      return new Response(JSON.stringify({ error: 'Unsupported file type. Upload the CSV or ZIP export from Goodreads or Letterboxd.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only the Edge Function service role writes the ledger. The bytes stay in
    // memory solely long enough to hash and parse them.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) throw new Error('Import ledger is unavailable');
    ledgerAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let detectedSource = importSource(file.name, file.name.toLowerCase().endsWith('.zip') ? undefined : new TextDecoder('utf-8').decode(bytes));
    const safeFilename = safeImportFilename(file.name);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const { data: receipt, error: receiptError } = await ledgerAdmin
      .from('media_import_batches')
      .insert({
        user_id: appUser.id, original_filename: safeFilename, content_type: file.type || null,
        file_size_bytes: file.size, sha256, source: detectedSource,
        parser_version: '1', points_formula_version: 'current-v1', points_formula: IMPORT_POINTS,
      })
      .select('id').single();
    if (receiptError || !receipt) throw new Error(`Could not create import receipt: ${receiptError?.message || 'unknown error'}`);
    importBatchId = receipt.id;

    console.log('Import: Processing file:', file.name, file.type);

    // Read file content
    let mediaItems: MediaItem[] = [];
    let sourceRows = 0;
    
    // Handle ZIP files
    if (file.name.endsWith('.zip')) {
      try {
        // Import JSZip for proper ZIP extraction
        const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
        const zip = await JSZip.loadAsync(bytes);
        
        // Find and extract CSV files from ZIP
        const csvFiles: Array<{ filename: string; content: string }> = [];
        for (const [filename, fileData] of Object.entries(zip.files)) {
          if (filename.endsWith('.csv') && !fileData.dir) {
            const content = await fileData.async('text');
            csvFiles.push({ filename, content });
          }
        }
        
        if (csvFiles.length === 0) {
          throw new Error('No CSV files found in ZIP archive');
        }
        
        // Parse all CSV files found in ZIP
        const archiveSources = new Set<string>();
        for (const csvFile of csvFiles) {
          sourceRows += csvFile.content.split('\n').slice(1).filter((line) => line.trim()).length;
          const memberSource = importSource(csvFile.filename, csvFile.content);
          if (memberSource !== 'unknown') archiveSources.add(memberSource);
          const items = await parseImportFile(csvFile.content, csvFile.filename);
          mediaItems.push(...items);
        }
        detectedSource = archiveSources.size === 1 ? [...archiveSources][0] : archiveSources.size > 1 ? 'mixed' : detectedSource;
        await ledgerAdmin!.from('media_import_batches').update({ source: detectedSource }).eq('id', importBatchId);
      } catch (zipError) {
        console.error('ZIP extraction error:', zipError);
        throw new Error('Failed to extract CSV from ZIP file: ' + zipError.message);
      }
    } else {
      // Handle CSV files
      const decoder = new TextDecoder('utf-8');
      const csvContent = decoder.decode(bytes);
      sourceRows = csvContent.split('\n').slice(1).filter((line) => line.trim()).length;
      mediaItems = await parseImportFile(csvContent, file.name);
    }

    console.log('Import: Parsed items:', mediaItems.length);
    mediaItems.forEach((item, index) => { item.sourceRowIndex = index; });
    const parsedMediaItems = [...mediaItems];
    // Netflix intentionally rejects malformed viewing-activity entries. Keep
    // that evidence on the receipt rather than allowing it to disappear.
    sourceRows = Math.max(sourceRows, mediaItems.length);
    const rejectedCount = Math.max(0, sourceRows - mediaItems.length);
    const parsedTypeCounts = parsedMediaItems.reduce((counts, item) => {
      counts[item.mediaType] = (counts[item.mediaType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    await ledgerAdmin!.from('media_import_batches').update({
      heartbeat_at: new Date().toISOString(), source_rows: sourceRows, parsed_rows: mediaItems.length,
      rejected_count: rejectedCount, media_type_counts: parsedTypeCounts,
    }).eq('id', importBatchId);
    const parsedRatingItems = mediaItems.filter((item) => Number(item.rating || 0) > 0);

    const MAX_ITEMS = 20000;
    if (mediaItems.length > MAX_ITEMS) {
      await ledgerAdmin!.from('media_import_batches').update({
        status: 'failed', error_summary: [`File has too many rows (limit ${MAX_ITEMS}).`], completed_at: new Date().toISOString(),
      }).eq('id', importBatchId);
      return new Response(JSON.stringify({ error: `File has too many rows (limit ${MAX_ITEMS}).` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (mediaItems.length === 0) {
      await ledgerAdmin!.from('media_import_batches').update({
        status: 'failed', error_summary: ['No valid items found in file.'], completed_at: new Date().toISOString(),
      }).eq('id', importBatchId);
      return new Response(JSON.stringify({ 
        error: 'No valid items found in file. Please ensure the file contains properly formatted media data.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up system lists once (SAME PATTERN AS track-media)
    const { data: systemLists } = await supabase
      .from('lists')
      .select('id, title')
      .is('user_id', null);

    const listMapping: Record<string, string> = {};
    if (systemLists) {
      for (const list of systemLists) {
        const key = list.title.toLowerCase().replace(/\s+/g, '');
        listMapping[key] = list.id;
      }
    }

    // ── Dedupe protection: skip anything this user already has (same title + type) ──
    // Re-importing the same export (or a fresh one months later) only adds new items.
    const existingKeys = new Set<string>();
    const existingItemIds = new Map<string, string>();
    {
      const pageSize = 1000;
      for (let page = 0; ; page++) {
        const { data: existingItems, error: existErr } = await supabase
          .from('list_items')
          .select('id, title, media_type')
          .eq('user_id', appUser.id)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (existErr) {
          console.error('Import: existing items fetch error:', existErr.message);
          await ledgerAdmin!.from('media_import_batches').update({
            status: 'failed', error_summary: [existErr.message],
            heartbeat_at: new Date().toISOString(), completed_at: new Date().toISOString(),
          }).eq('id', importBatchId);
          return new Response(JSON.stringify({ error: 'Could not check your library for duplicates. Please try again.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        for (const it of existingItems || []) {
          const key = `${(it.title || '').toLowerCase().trim()}::${(it.media_type || '').toLowerCase()}`;
          existingKeys.add(key);
          existingItemIds.set(key, String(it.id));
        }
        if (!existingItems || existingItems.length < pageSize) break;
      }
    }
    const beforeDedupe = mediaItems.length;
    const uniqueRows = new Set(mediaItems.map((item) =>
      `${(item.title || '').toLowerCase().trim()}::${(item.mediaType || '').toLowerCase()}`
    )).size;
    // Also dedupe within the file itself. A Letterboxd ZIP lists the same movie
    // in watched.csv (no rating) and ratings.csv (rated) — keep the rated copy.
    const keptByKey = new Map<string, MediaItem>();
    const rowOutcomes = new Map<number, {
      outcome: 'inserted' | 'skipped_existing' | 'skipped_duplicate' | 'failed';
      error?: string;
      listItemId?: string;
      ratingId?: string;
      ratingOutcome?: 'none' | 'pending' | 'inserted' | 'preserved' | 'duplicate' | 'unresolved';
    }>();
    for (const item of mediaItems) {
      const key = `${(item.title || '').toLowerCase().trim()}::${(item.mediaType || '').toLowerCase()}`;
      if (existingKeys.has(key)) {
        rowOutcomes.set(item.sourceRowIndex ?? 0, { outcome: 'skipped_existing', listItemId: existingItemIds.get(key) });
        continue;
      }
      const prev = keptByKey.get(key);
      if (!prev) {
        keptByKey.set(key, item);
      } else if ((item.rating || 0) > 0 && (prev.rating || 0) === 0) {
        rowOutcomes.set(prev.sourceRowIndex ?? 0, { outcome: 'skipped_duplicate' });
        keptByKey.set(key, item);
      } else {
        rowOutcomes.set(item.sourceRowIndex ?? 0, { outcome: 'skipped_duplicate' });
      }
    }
    mediaItems = [...keptByKey.values()];
    const skippedCount = beforeDedupe - mediaItems.length;
    console.log('Import: Deduped', skippedCount, 'of', beforeDedupe);

    // Persist every accepted source row before any media mutation. If execution
    // stops later, pending rows plus stamped media provenance make the batch
    // reconstructable rather than leaving an unexplained partial import.
    const preliminaryLedgerRows = parsedMediaItems.map((item) => {
      const outcome = rowOutcomes.get(item.sourceRowIndex ?? 0);
      return {
        batch_id: importBatchId,
        source_row_index: item.sourceRowIndex ?? 0,
        title: item.title,
        media_type: item.mediaType,
        outcome: outcome?.outcome || 'pending',
        error_message: outcome?.error || null,
        list_item_id: outcome?.listItemId || null,
        rating_outcome: Number(item.rating || 0) > 0 ? 'pending' : 'none',
      };
    });
    const { error: preliminaryLedgerError } = await ledgerAdmin!
      .from('media_import_rows')
      .upsert(preliminaryLedgerRows, { onConflict: 'batch_id,source_row_index' });
    if (preliminaryLedgerError) throw new Error(`Could not initialize import row receipts: ${preliminaryLedgerError.message}`);
    hasDurableRowLedger = true;

    // Insert items in batches (max 100 at a time)
    const batchSize = 100;
    // Rows created by THIS import, collected so background enrichment can
    // update ONLY these rows (by id) and never touch pre-existing data.
    const insertedRows: InsertedListRow[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize);
      
      const insertData = batch.map(item => {
        const listKey = item.listType.toLowerCase().replace(/\s+/g, '');
        const listId = listMapping[listKey] || null;
        
        return {
          list_id: listId,
          user_id: appUser.id,
          title: item.title,
          type: item.mediaType,
          media_type: item.mediaType,
          creator: item.creator || '',
          image_url: item.imageUrl || null,
          notes: item.notes || null,
          external_id: item.externalId || null,
          // Matched items carry their real catalog source; unmatched keep the
          // legacy 'tmdb_verified' marker so auto-fix doesn't recheck them.
          external_source: item.externalSource || 'tmdb_verified',
          import_batch_id: importBatchId,
          import_source_row_index: item.sourceRowIndex ?? 0,
        };
      });

      const { data, error } = await supabase
        .from('list_items')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Import: Batch insert error:', error);
        errorCount += batch.length;
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        for (const item of batch) rowOutcomes.set(item.sourceRowIndex ?? 0, { outcome: 'failed', error: error.message });
      } else {
        successCount += data?.length || 0;
        for (const row of data || []) insertedRows.push(row as InsertedListRow);
        const rowsBySourceIndex = new Map((data || []).map((row: any) => [Number(row.import_source_row_index), row]));
        for (const item of batch) {
          const row = rowsBySourceIndex.get(item.sourceRowIndex ?? 0);
          rowOutcomes.set(item.sourceRowIndex ?? 0, row
            ? { outcome: 'inserted', listItemId: String(row.id) }
            : { outcome: 'failed', error: 'Insert returned no row' });
        }
      }
      const durableBatchOutcomes = batch.map((item) => {
        const outcome = rowOutcomes.get(item.sourceRowIndex ?? 0)!;
        return {
          batch_id: importBatchId,
          source_row_index: item.sourceRowIndex ?? 0,
          title: item.title,
          media_type: item.mediaType,
          outcome: outcome.outcome,
          error_message: outcome.error || null,
          list_item_id: outcome.listItemId || null,
          rating_outcome: Number(item.rating || 0) > 0 ? 'pending' : 'none',
        };
      });
      const { error: durableBatchError } = await ledgerAdmin!
        .from('media_import_rows')
        .upsert(durableBatchOutcomes, { onConflict: 'batch_id,source_row_index' });
      if (durableBatchError) throw new Error(`Could not persist import row outcomes: ${durableBatchError.message}`);
    }

    console.log('Import: Complete. Success:', successCount, 'Errors:', errorCount);

    // Imported stars are first-class user ratings, not list metadata. Reconcile
    // them even when every list item was skipped as an existing duplicate.
    const existingRatingKeys = new Set<string>();
    const existingRatingIds = new Map<string, string>();
    {
      const pageSize = 1000;
      for (let page = 0; ; page++) {
        const { data: existingRatings, error: ratingsReadError } = await supabase
          .from('media_ratings')
          .select('id, media_title, media_type')
          .eq('user_id', appUser.id)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (ratingsReadError) throw ratingsReadError;
        for (const row of existingRatings || []) {
          const key = `${normTitle(row.media_title)}::${String(row.media_type || '').toLowerCase()}`;
          existingRatingKeys.add(key);
          existingRatingIds.set(key, String(row.id));
        }
        if (!existingRatings || existingRatings.length < pageSize) break;
      }
    }
    const importedRatingRows: Record<string, unknown>[] = [];
    const queuedRatingKeys = new Set<string>();
    let preservedRatingCount = 0;
    let failedRatingCount = 0;
    for (const item of parsedRatingItems) {
      if (!item.externalId || !item.externalSource) {
        failedRatingCount += 1;
        const ledger = rowOutcomes.get(item.sourceRowIndex ?? 0);
        if (ledger) ledger.ratingOutcome = 'unresolved';
        continue;
      }
      const titleKey = `${normTitle(item.title)}::${item.mediaType.toLowerCase()}`;
      if (existingRatingKeys.has(titleKey)) {
        preservedRatingCount += 1;
        const ledger = rowOutcomes.get(item.sourceRowIndex ?? 0);
        if (ledger) {
          ledger.ratingId = existingRatingIds.get(titleKey);
          ledger.ratingOutcome = 'preserved';
        }
        continue;
      }
      if (queuedRatingKeys.has(titleKey)) {
        const ledger = rowOutcomes.get(item.sourceRowIndex ?? 0);
        if (ledger) ledger.ratingOutcome = 'duplicate';
        continue;
      }
      queuedRatingKeys.add(titleKey);
      importedRatingRows.push({
        user_id: appUser.id,
        media_external_id: item.externalId,
        media_external_source: item.externalSource,
        media_title: item.title,
        media_type: item.mediaType,
        rating: item.rating,
        import_batch_id: importBatchId,
        import_source_row_index: item.sourceRowIndex ?? 0,
      });
    }
    let importedRatingCount = 0;
    const insertedRatingRows: InsertedRatingRow[] = [];
    for (let i = 0; i < importedRatingRows.length; i += batchSize) {
      const { data: insertedRatings, error: ratingInsertError } = await supabase
        .from('media_ratings')
        .upsert(importedRatingRows.slice(i, i + batchSize), {
          onConflict: 'user_id,media_external_id,media_external_source',
          ignoreDuplicates: true,
        })
        .select('id, media_title, media_type, media_external_id, media_external_source, import_source_row_index');
      if (ratingInsertError) throw ratingInsertError;
      importedRatingCount += insertedRatings?.length || 0;
      for (const row of insertedRatings || []) insertedRatingRows.push(row as InsertedRatingRow);
      for (const row of insertedRatings || []) {
        const ledger = rowOutcomes.get(Number(row.import_source_row_index ?? -1));
        if (ledger) {
          ledger.ratingId = String(row.id);
          ledger.ratingOutcome = 'inserted';
        }
      }
    }
    preservedRatingCount += Math.max(0, importedRatingRows.length - importedRatingCount);

    // ── Background poster/catalog enrichment ──
    // Runs AFTER the response is sent, so the import itself is never delayed
    // or timed out by lookups. Updates are scoped to the row ids created by
    // this import only — pre-existing rows are never touched.
    const itemByKey = new Map<string, MediaItem>();
    for (const it of mediaItems) itemByKey.set(`${it.title.toLowerCase()}|${it.mediaType}`, it);

    const enrichInBackground = async () => {
      const ENRICH_CAP = 600;
      const ENRICH_BUDGET_MS = 300000; // generous: we're in the background now
      const start = Date.now();
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      // Canonical resolution can involve provider verification. Keep it off the
      // request path and bound it just as tightly as catalog enrichment.
      const admin = serviceRoleKey
        ? createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey)
        : null;
      const CANONICAL_BATCH = 3;

      const resolveListCanonical = async (row: InsertedListRow, identity = {
        externalId: row.external_id,
        externalSource: row.external_source,
        title: row.title,
        mediaType: row.media_type,
        creator: row.creator || undefined,
      }) => {
        if (!admin || !identity.externalId || !identity.externalSource) return null;
        try {
          const resolution = await resolveCanonicalMedia(admin, {
            externalId: identity.externalId,
            externalSource: identity.externalSource,
            title: identity.title,
            mediaType: identity.mediaType,
            creator: identity.creator,
          });
          return resolution.canonicalMediaId;
        } catch (error) {
          // Identity is additive enrichment; an outage must not make imports
          // fail or prevent the legacy provider fields from being saved.
          console.error('Import: canonical list resolution failed for', row.id, error);
          return null;
        }
      };

      const resolveRatingCanonical = async (row: InsertedRatingRow) => {
        if (!admin) return null;
        try {
          const resolution = await resolveCanonicalMedia(admin, {
            externalId: row.media_external_id,
            externalSource: row.media_external_source,
            title: row.media_title,
            mediaType: row.media_type,
          });
          return resolution.canonicalMediaId;
        } catch (error) {
          console.error('Import: canonical rating resolution failed for', row.id, error);
          return null;
        }
      };

      const targets = insertedRows
        .filter((r) => r.media_type === 'movie' || r.media_type === 'book')
        .slice(0, ENRICH_CAP);
      console.log('Import: Background enrichment starting for', targets.length, 'rows');
      let updated = 0;
      const ENRICH_BATCH = 3;
      for (let i = 0; i < targets.length; i += ENRICH_BATCH) {
        if (Date.now() - start > ENRICH_BUDGET_MS) {
          console.log('Import: Background enrichment budget reached at', i);
          break;
        }
        const batch = targets.slice(i, i + ENRICH_BATCH);
        await Promise.all(batch.map(async (row) => {
          const item = itemByKey.get(`${row.title.toLowerCase()}|${row.media_type}`);
          if (!item) return;
          try {
            if (item.mediaType === 'movie') await enrichMovie(item);
            else await enrichBook(item);
          } catch (_e) { return; }
          if (!item.externalId && !item.imageUrl) return;
          const patch: Record<string, unknown> = {};
          if (item.imageUrl) patch.image_url = item.imageUrl;
          if (item.externalId) {
            patch.external_id = item.externalId;
            patch.external_source = item.externalSource;
            // Enrichment can replace a legacy Goodreads/Open Library provider
            // id with a verified catalog id. Resolve that exact new identity
            // before patching the row, rather than retaining a stale canonical
            // id from its original provider.
            if (item.externalId !== row.external_id || item.externalSource !== row.external_source) {
              const canonicalMediaId = await resolveListCanonical(row, {
                externalId: item.externalId,
                externalSource: item.externalSource,
                title: item.title,
                mediaType: item.mediaType,
                creator: item.creator || undefined,
              });
              // Do not leave an old-provider canonical id attached when the
              // provider identity changed but its new resolution is unavailable.
              // Null is the same safe state the legacy importer produced.
              patch.canonical_media_id = canonicalMediaId;
            }
          }
          const { error: upErr } = await supabase
            .from('list_items')
            .update(patch)
            .eq('id', row.id)
            .eq('user_id', appUser.id);
          if (!upErr) updated++;
        }));
        if (i + ENRICH_BATCH < targets.length) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      if (!admin) {
        console.error('Import: SUPABASE_SERVICE_ROLE_KEY missing; skipping deferred canonical resolution');
      } else {
        // Resolve after catalog enrichment so a newly verified provider id is
        // the identity used for the canonical link. All writes remain scoped
        // to ids returned by this import.
        const canonicalLists = insertedRows
          .filter((row) => row.external_id && row.external_source)
          .slice(0, ENRICH_CAP);
        for (let i = 0; i < canonicalLists.length; i += CANONICAL_BATCH) {
          if (Date.now() - start > ENRICH_BUDGET_MS) break;
          await Promise.all(canonicalLists.slice(i, i + CANONICAL_BATCH).map(async (row) => {
            const canonicalMediaId = await resolveListCanonical(row);
            if (!canonicalMediaId) return;
            const { error } = await supabase.from('list_items')
              .update({ canonical_media_id: canonicalMediaId })
              .eq('id', row.id)
              .eq('user_id', appUser.id)
              .eq('external_id', row.external_id!)
              .eq('external_source', row.external_source!);
            if (error) console.error('Import: canonical list patch failed for', row.id, error);
          }));
        }

        const canonicalRatings = insertedRatingRows.slice(0, ENRICH_CAP);
        for (let i = 0; i < canonicalRatings.length; i += CANONICAL_BATCH) {
          if (Date.now() - start > ENRICH_BUDGET_MS) break;
          await Promise.all(canonicalRatings.slice(i, i + CANONICAL_BATCH).map(async (row) => {
            let canonicalMediaId: string | null = null;
            if (row.media_external_source === 'letterboxd') {
              const item = parsedRatingItems.find((candidate) =>
                candidate.sourceRowIndex === Number(row.import_source_row_index));
              if (item) {
                await enrichMovie(item);
                if (item.externalId && item.externalSource === 'tmdb') {
                  canonicalMediaId = await resolveListCanonical({
                    id: String(row.id),
                    title: item.title,
                    media_type: item.mediaType,
                    creator: item.creator || null,
                    external_id: item.externalId,
                    external_source: item.externalSource,
                    import_source_row_index: item.sourceRowIndex,
                  });
                }
              }
            } else {
              canonicalMediaId = await resolveRatingCanonical(row);
            }
            if (!canonicalMediaId) return;
            const { error } = await supabase.from('media_ratings')
              .update({ canonical_media_id: canonicalMediaId })
              .eq('id', row.id)
              .eq('user_id', appUser.id)
              .eq('media_external_id', row.media_external_id)
              .eq('media_external_source', row.media_external_source);
            if (error) console.error('Import: canonical rating patch failed for', row.id, error);
          }));
        }
      }
      console.log('Import: Background enrichment done.', updated, 'rows updated in', Date.now() - start, 'ms');
    };

    const ledgerRows = parsedMediaItems.map((item) => {
      const outcome = rowOutcomes.get(item.sourceRowIndex ?? 0) || { outcome: 'failed' as const, error: 'Item was not reconciled' };
      return { batch_id: importBatchId, source_row_index: item.sourceRowIndex ?? 0, title: item.title,
        media_type: item.mediaType, outcome: outcome.outcome, error_message: outcome.error || null,
        list_item_id: outcome.listItemId || null, media_rating_id: outcome.ratingId || null,
        rating_outcome: outcome.ratingOutcome || (Number(item.rating || 0) > 0 ? 'unresolved' : 'none') };
    });
    const outcomeCounts = reconcileImportOutcomes(ledgerRows.map((row) => row.outcome));
    const insertedTypes = ledgerRows.filter((row) => row.outcome === 'inserted').map((row) => row.media_type || '');
    const pointsAwarded = importPointsForInserted(insertedTypes);
    const pointsByMediaType = insertedTypes.reduce((points, mediaType) => {
      points[mediaType] = (points[mediaType] || 0) + (IMPORT_POINTS[mediaType] || 0);
      return points;
    }, {} as Record<string, number>);
    const { error: rowLedgerError } = await ledgerAdmin!.from('media_import_rows').upsert(ledgerRows, { onConflict: 'batch_id,source_row_index' });
    if (rowLedgerError) throw new Error(`Could not reconcile import receipt: ${rowLedgerError.message}`);
    const { error: finishLedgerError } = await ledgerAdmin!.from('media_import_batches').update({
      inserted_count: outcomeCounts.inserted || 0,
      skipped_existing_count: outcomeCounts.skipped_existing || 0, skipped_duplicate_count: outcomeCounts.skipped_duplicate || 0,
      failed_count: outcomeCounts.failed || 0,
      ratings_imported_count: importedRatingCount, ratings_preserved_count: preservedRatingCount,
      ratings_failed_count: failedRatingCount,
      unique_rows: uniqueRows, imported_points: pointsAwarded,
      points_by_media_type: pointsByMediaType, heartbeat_at: new Date().toISOString(),
      status: ((outcomeCounts.failed || 0) + rejectedCount + failedRatingCount) > 0 ? 'completed_with_errors' : 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', importBatchId);
    if (finishLedgerError) throw new Error(`Could not finalize import receipt: ${finishLedgerError.message}`);

    try {
      // @ts-ignore EdgeRuntime is provided by the Supabase edge environment
      EdgeRuntime.waitUntil(enrichInBackground());
    } catch (_e) {
      // Fallback (e.g. local dev): fire and forget
      enrichInBackground().catch((e) => console.error('Import: background enrichment failed:', e));
    }

    const completedWithErrors = ((outcomeCounts.failed || 0) + rejectedCount + failedRatingCount) > 0;
    return new Response(JSON.stringify({
      success: true,
      imported: successCount,
      skipped: skippedCount,
      failed: (outcomeCounts.failed || 0) + rejectedCount,
      total: beforeDedupe,
      ratingsImported: importedRatingCount,
      ratingsPreserved: preservedRatingCount,
      ratingsFailed: failedRatingCount,
      batch: { id: importBatchId, status: completedWithErrors ? 'completed_with_errors' : 'completed' },
      receipt: {
        id: importBatchId, userId: appUser.id, source: detectedSource,
        status: completedWithErrors ? 'completed_with_errors' : 'completed',
        originalFilename: safeFilename, sourceRows, parsedRows: parsedMediaItems.length,
        uniqueRows, insertedCount: outcomeCounts.inserted, skippedExistingCount: outcomeCounts.skipped_existing,
        skippedDuplicateCount: outcomeCounts.skipped_duplicate, failedCount: outcomeCounts.failed, rejectedCount,
        ratingsImportedCount: importedRatingCount, ratingsPreservedCount: preservedRatingCount,
        ratingsFailedCount: failedRatingCount,
        mediaTypeCounts: parsedTypeCounts, pointsByMediaType, importedPoints: pointsAwarded,
        parserVersion: '1', pointsFormulaVersion: 'current-v1', isLegacy: false,
      },
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import media error:', error);
    if (importBatchId && ledgerAdmin) {
      await ledgerAdmin.from('media_import_batches').update({
        status: hasDurableRowLedger ? 'interrupted' : 'failed', error_summary: [error.message || 'Import failed'],
        heartbeat_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      }).eq('id', importBatchId);
    }
    return new Response(JSON.stringify({ 
      error: error.message || 'Import failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
