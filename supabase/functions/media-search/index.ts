
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Content filter helper
function isContentAppropriate(item: any, type: string): boolean {
  if (type === 'movie' || type === 'tv') {
    if (item.adult === true) return false;
  }
  return true;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate fuzzy match score (0-1, higher is better)
function fuzzyMatchScore(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();
  
  // Exact match
  if (t === q) return 1.0;
  
  // Contains match
  if (t.includes(q) || q.includes(t)) return 0.9;
  
  // Levenshtein-based similarity
  const distance = levenshteinDistance(q, t);
  const maxLen = Math.max(q.length, t.length);
  const similarity = 1 - (distance / maxLen);
  
  return similarity;
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    let query: string | null = null;
    let type: string | null = null;
    
    let includeBookSeries = false;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      query = url.searchParams.get('query');
      type = url.searchParams.get('type');
      includeBookSeries = url.searchParams.get('include_book_series') === 'true';
    } else {
      const body = await req.json();
      query = body.query;
      type = body.type;
      includeBookSeries = body.include_book_series === true;
    }
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Detect media type hints in query BEFORE stripping them
    // NOTE: avoid generic words like "watch"/"show" that appear in titles
    const queryHasBook = /\b(book|novel|read)\b/i.test(query);
    const queryHasMovie = /\b(movie|film)\b/i.test(query);
    const queryHasMusic = /\b(song|album|music|listen)\b/i.test(query);
    // "series" alone is ambiguous (book series, film series, TV series) — never treat it as a TV-only hint
    const queryHasTv = /\b(tv show|television)\b/i.test(query);
    const queryHasPodcast = /\b(podcast|podcasts)\b/i.test(query);
    
    // Strip type keywords from query for cleaner API searches
    // e.g., "anne of green gables book" → "anne of green gables"
    const cleanedQuery = query
      .replace(/\b(book|novel|read|movie|film|song|album|music|listen|tv show|television|podcast|podcasts)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Use cleaned query for API calls, but keep original for logging
    const searchQuery = cleanedQuery.length > 2 ? cleanedQuery : query;

    // Roman numeral helper — converts trailing roman numeral (I–XX) to an integer
    const romanToInt = (s: string): number | null => {
      const lower = s.toLowerCase().trim();
      if (!/^[ivxl]+$/.test(lower) || lower.length > 5) return null;
      const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50 };
      let result = 0;
      for (let k = 0; k < lower.length; k++) {
        const cur = map[lower[k]] ?? 0;
        const nxt = map[lower[k + 1]] ?? 0;
        if (nxt > cur) result -= cur; else result += cur;
      }
      return result > 0 && result <= 20 ? result : null;
    };

    // Detect roman numeral sequel at end of cleaned query: "Star Wars IV", "Rocky III"
    const romanSeqMatch = /^(.+?)\s+([ivxl]{1,5})$/i.exec(searchQuery.trim());
    const romanSeqNum = romanSeqMatch ? romanToInt(romanSeqMatch[2]) : null;

    // Build a TMDB-normalised query: replace trailing roman numeral with Arabic so TMDB
    // returns the right installment. "Star Wars IV" → TMDB gets "Star Wars 4".
    const tmdbSearchQuery = (romanSeqNum !== null && romanSeqMatch)
      ? `${romanSeqMatch[1].trim()} ${romanSeqNum}`
      : searchQuery;

    // Pre-detect Arabic sequel number so the TMDB promise can use it for a secondary search.
    // e.g. "star wars 4" → earlySeqBase="star wars", earlySeqNum=4 → also search "star wars episode 4"
    const earlyArabicMatch = /^(.+?)\s+(\d{1,2})$/.exec(searchQuery.toLowerCase().trim());
    const earlyArabicNum = earlyArabicMatch ? parseInt(earlyArabicMatch[2], 10) : null;
    const earlySeqNum: number | null = (earlyArabicNum && earlyArabicNum <= 20) ? earlyArabicNum : romanSeqNum;
    const earlySeqBase: string | null = earlySeqNum
      ? ((earlyArabicNum && earlyArabicNum <= 20) ? earlyArabicMatch![1] : romanSeqMatch?.[1] ?? null)?.trim() ?? null
      : null;
    // "star wars episode 4" — the secondary TMDB query that returns properly titled installments
    const tmdbEpisodeQuery: string | null = (earlySeqBase && earlySeqNum) ? `${earlySeqBase} episode ${earlySeqNum}` : null;

    // Convert a number to its Roman numeral string (1–20) for title matching
    const intToRoman = (n: number): string => {
      const vals = [10,'x',9,'ix',5,'v',4,'iv',1,'i'];
      let result = '';
      for (let i = 0; i < vals.length; i += 2) {
        while (n >= (vals[i] as number)) { result += vals[i + 1]; n -= (vals[i] as number); }
      }
      return result;
    };
    // Strings that the correctly-numbered installment's title should contain
    // e.g. earlySeqNum=4 → seqTitleTokens=["4","iv"]
    const seqTitleTokens: string[] = earlySeqNum
      ? [String(earlySeqNum), intToRoman(earlySeqNum)]
      : [];
    // Returns true if a title string contains the target sequel number (Arabic or Roman, word-boundary)
    const titleContainsSeqNum = (title: string): boolean => {
      if (!seqTitleTokens.length) return false;
      const t = title.toLowerCase();
      return seqTitleTokens.some(tok => {
        const re = new RegExp(`(?<![a-z0-9])${tok}(?![a-z0-9])`);
        return re.test(t);
      });
    };

    console.log('Original query:', query, '| Cleaned query:', searchQuery, '| TMDB query:', tmdbSearchQuery, '| Episode query:', tmdbEpisodeQuery, '| Type hints:', { queryHasBook, queryHasMovie, queryHasMusic, queryHasTv, queryHasPodcast });

    // If caller didn't pass an explicit type but query has an unambiguous type hint,
    // narrow the search so we only call the relevant API and avoid category collisions.
    if (!type) {
      const hintCount = [queryHasBook, queryHasMovie, queryHasMusic, queryHasTv, queryHasPodcast].filter(Boolean).length;
      if (hintCount === 1) {
        if (queryHasTv)      type = 'tv';
        else if (queryHasMovie)   type = 'movie';
        else if (queryHasBook)    type = 'book';
        else if (queryHasMusic)   type = 'music';
        else if (queryHasPodcast) type = 'podcast';
      }
    }

    // Collect results by type first, then merge in desired order
    const bookResults: any[] = [];
    const bookSeriesResults: any[] = [];
    const movieTvResults: any[] = [];
    const podcastResults: any[] = [];
    const musicResults: any[] = [];
    const youtubeResults: any[] = [];
    const gamingResults: any[] = [];
    const sportsResults: any[] = [];
    const errors: string[] = [];

    // Create all search promises to run in parallel
    const searchPromises: Promise<void>[] = [];

    // TMDB Search (movies and TV)
    if (!type || type === 'movie' || type === 'tv') {
      searchPromises.push((async () => {
        try {
          const tmdbKey = Deno.env.get('TMDB_API_KEY');
          if (tmdbKey) {
            // TMDB supports two auth styles:
            //   v3 API key  → short alphanumeric, passed as ?api_key= query param
            //   v4 Bearer   → long JWT token, passed as Authorization: Bearer header
            // We send the key BOTH ways so either format works without any reconfiguration.
            const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(tmdbSearchQuery)}&page=1&include_adult=false`;
            const tmdbResponse = await fetchWithTimeout(
              tmdbUrl,
              { headers: { 'Authorization': `Bearer ${tmdbKey}` } },
              6000
            );
            console.log('TMDB response status:', tmdbResponse.status, 'query:', tmdbSearchQuery);
            if (tmdbResponse.ok) {
              const tmdbData = await tmdbResponse.json();
              console.log('TMDB results count:', tmdbData.results?.length ?? 0);
              tmdbData.results?.slice(0, 25).forEach((item: any) => {
                if ((item.media_type === 'movie' || item.media_type === 'tv') && isContentAppropriate(item, item.media_type)) {
                  const releaseDate = item.release_date || item.first_air_date || '';
                  const year = releaseDate ? releaseDate.substring(0, 4) : '';
                  // Use the longer of title vs original_title — TMDB sometimes returns
                  // a short localized title when the original_title has the full subtitle.
                  // e.g. title:"Star Wars" but original_title:"Star Wars: Episode IV - A New Hope"
                  const rawTitle = item.title || item.name || '';
                  const rawOriginal = item.original_title || item.original_name || '';
                  const bestTitle = rawOriginal.length > rawTitle.length ? rawOriginal : rawTitle;
                  console.log('TMDB item:', rawTitle, '| original:', rawOriginal, '| chosen:', bestTitle, '| id:', item.id);
                  movieTvResults.push({
                    title: bestTitle,
                    type: item.media_type === 'movie' ? 'movie' : 'tv',
                    media_subtype: item.media_type === 'tv' ? 'series' : null,
                    creator: '',
                    year: year || null,
                    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                    external_id: item.id?.toString(),
                    external_source: 'tmdb',
                    description: item.overview,
                    popularity: item.popularity ?? 0,
                    vote_count: item.vote_count ?? 0,
                    release_date: releaseDate || null
                  });
                }
              });
              console.log('TMDB movie/TV results added:', movieTvResults.length);

              // Title enrichment: for movie results whose title is shorter than the search
              // query (suggesting a subtitle was omitted), fetch the full movie details from
              // TMDB to get the canonical title — e.g. "Star Wars" → "Star Wars: Episode IV – A New Hope"
              const sigQueryWordCount = searchQuery.trim().split(/\s+/).filter(w => w.length > 2).length;
              const enrichCandidates = movieTvResults
                .filter((r: any) => r.external_source === 'tmdb' && r.type === 'movie')
                .filter((r: any) => {
                  const titleWordCount = (r.title || '').trim().split(/\s+/).length;
                  return sigQueryWordCount > titleWordCount; // title looks incomplete relative to query
                })
                .slice(0, 3); // only enrich top 3 to keep latency low

              if (enrichCandidates.length > 0) {
                await Promise.all(enrichCandidates.map(async (r: any) => {
                  try {
                    const detailResp = await fetchWithTimeout(
                      `https://api.themoviedb.org/3/movie/${r.external_id}?api_key=${tmdbKey}&language=en-US`,
                      { headers: { 'Authorization': `Bearer ${tmdbKey}` } },
                      3000
                    );
                    if (detailResp.ok) {
                      const detail = await detailResp.json();
                      const fullTitle = detail.title || '';
                      if (fullTitle.length > (r.title || '').length) {
                        console.log('Enriched title:', r.title, '→', fullTitle);
                        r.title = fullTitle;
                      }
                    }
                  } catch (_) { /* ignore — enrich is best-effort */ }
                }));
              }
            } else {
              const errText = await tmdbResponse.text().catch(() => '');
              console.error('TMDB non-ok response:', tmdbResponse.status, errText.substring(0, 200));
            }

            // Secondary TMDB search for sequel queries: "star wars 4" → also try "star wars episode 4"
            // This surfaces the properly-titled installment (e.g. "Star Wars: Episode IV - A New Hope")
            if (tmdbEpisodeQuery) {
              try {
                const episodeUrl = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(tmdbEpisodeQuery)}&page=1&include_adult=false`;
                const episodeResp = await fetchWithTimeout(episodeUrl, { headers: { 'Authorization': `Bearer ${tmdbKey}` } }, 5000);
                if (episodeResp.ok) {
                  const episodeData = await episodeResp.json();
                  episodeData.results?.slice(0, 10).forEach((item: any) => {
                    if (item.media_type !== 'movie' && item.media_type !== 'tv') return;
                    if (!isContentAppropriate(item, item.media_type)) return;
                    const itemId = item.id?.toString();
                    const episodeTitle = item.title || item.name || '';
                    const releaseDate = item.release_date || item.first_air_date || '';
                    // Check if this ID already exists in movieTvResults from the primary search
                    // Only award the _episode_match boost if this result's title actually
                    // contains the target number (Arabic or Roman). This prevents Episode V
                    // from stealing the boost when we searched for Episode 4.
                    const isCorrectInstallment = titleContainsSeqNum(episodeTitle);
                    const existingIdx = movieTvResults.findIndex((r: any) => r.external_id === itemId);
                    if (existingIdx !== -1) {
                      // Same TMDB ID found — upgrade to the episode-titled version if it's longer/better
                      // e.g. "Star Wars" → "Star Wars: Episode IV - A New Hope"
                      const existingTitle = movieTvResults[existingIdx].title || '';
                      if (episodeTitle.length > existingTitle.length) {
                        movieTvResults[existingIdx].title = episodeTitle;
                      }
                      if (isCorrectInstallment) {
                        movieTvResults[existingIdx]._episode_match = true;
                      }
                    } else {
                      // New result not seen in primary search — add it
                      movieTvResults.push({
                        title: episodeTitle,
                        type: item.media_type === 'movie' ? 'movie' : 'tv',
                        media_subtype: item.media_type === 'tv' ? 'series' : null,
                        creator: '',
                        year: releaseDate ? releaseDate.substring(0, 4) : null,
                        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                        external_id: itemId,
                        external_source: 'tmdb',
                        description: item.overview,
                        popularity: item.popularity ?? 0,
                        vote_count: item.vote_count ?? 0,
                        release_date: releaseDate || null,
                        _episode_match: isCorrectInstallment
                      });
                    }
                  });
                  console.log('TMDB episode-query pass done, total results:', movieTvResults.length);
                }
              } catch (epErr) {
                console.error('TMDB episode secondary search error:', epErr);
              }
            }
          } else {
            console.warn('TMDB_API_KEY not set in environment');
          }

          // OpenAI fallback — when TMDB key is missing or returns no results
          if (movieTvResults.length === 0) {
            const openaiKey = Deno.env.get('OPENAI_API_KEY');
            if (openaiKey) {
              try {
                const targetType = type === 'tv' ? 'TV show' : 'movie or TV show';
                const openaiMovieResponse = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                      role: 'system',
                      content: `You are a film and TV database. Return a JSON array of up to 8 ${targetType} results matching the query. Each object must have: title (string), type ("movie" or "tv"), year (4-digit string or null), creator (director for movies or empty string), description (one sentence synopsis). Return ONLY valid JSON array, no markdown.`
                    }, {
                      role: 'user',
                      content: `Search: "${searchQuery}"`
                    }],
                    temperature: 0,
                    max_tokens: 600
                  })
                }, 8000);

                if (openaiMovieResponse.ok) {
                  const openaiMovieData = await openaiMovieResponse.json();
                  const raw = openaiMovieData.choices?.[0]?.message?.content?.trim() || '[]';
                  try {
                    const suggestions: any[] = JSON.parse(raw);
                    suggestions.slice(0, 8).forEach((item: any) => {
                      if (!item.title) return;
                      movieTvResults.push({
                        title: item.title,
                        type: item.type === 'tv' ? 'tv' : 'movie',
                        creator: item.creator || '',
                        year: item.year || null,
                        poster_url: '',
                        external_id: `openai-${(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${item.year || 'unknown'}`,
                        external_source: 'openai',
                        description: item.description || '',
                        popularity: 5,
                        vote_count: 0,
                        release_date: item.year ? `${item.year}-01-01` : null
                      });
                    });
                    console.log('OpenAI movie/TV fallback returned:', movieTvResults.length, 'results');
                  } catch (_) { /* ignore parse errors */ }
                }
              } catch (error) {
                console.error('OpenAI movie/TV fallback error:', error);
              }
            }
          }
        } catch (error) {
          console.error('TMDB search error:', error);
          errors.push('tmdb');
        }
      })());
    }

    // Google Books Search (primary) with API key + Open Library fallback
    if (!type || type === 'book') {
      searchPromises.push((async () => {
        let foundBooks = false;
        const googleBooksApiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');

        // --- Smart query building ---
        // Detect "Title by Author" pattern → intitle:X+inauthor:Y
        // Detect pure author name (2-3 alpha words, no title stop-words) → run inauthor: search too
        let gbPrimaryQuery = searchQuery;
        let gbAuthorQuery: string | null = null;
        let isAuthorSearch = false;

        const byMatch = /^(.+?)\s+by\s+(.+)$/i.exec(searchQuery);
        if (byMatch) {
          gbPrimaryQuery = `intitle:${byMatch[1].trim()}+inauthor:${byMatch[2].trim()}`;
        } else {
          const words = searchQuery.trim().split(/\s+/);
          const stopWords = /^(the|a|an|and|of|in|to|for|on|with|at|by|from|is|was)$/i;
          const looksLikeName = words.length >= 2 && words.length <= 3 &&
            words.every(w => /^[A-Za-zÀ-ÿ'.-]+$/.test(w)) &&
            !words.some(w => stopWords.test(w));
          if (looksLikeName) {
            isAuthorSearch = true;
            gbAuthorQuery = `inauthor:"${searchQuery}"`;
          }
        }

        // Helper to extract series name from a Google Books volume
        const extractSeries = (volumeInfo: any): string | null => {
          const subtitle = volumeInfo.subtitle || '';
          if (/series|saga|chronicles|trilogy|book \d|vol\.|volume \d/i.test(subtitle)) return subtitle;
          if (volumeInfo.seriesInfo?.volumeSeries?.[0]?.seriesId) return volumeInfo.seriesInfo.volumeSeries[0].seriesId;
          return null;
        };

        // Try Google Books first
        if (googleBooksApiKey) {
          try {
            const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gbPrimaryQuery)}&maxResults=20&printType=books&key=${googleBooksApiKey}`;
            console.log('Fetching Google Books (primary)');
            const googleResponse = await fetchWithTimeout(gbUrl, {}, 5000);
            console.log('Google Books response status:', googleResponse.status);

            if (!googleResponse.ok) {
              const errorText = await googleResponse.text();
              console.error('Google Books API error:', errorText);
            }

            if (googleResponse.ok) {
              const googleData = await googleResponse.json();
              console.log('Google Books items count:', googleData.items?.length || 0);
              for (const item of googleData.items?.slice(0, 15) || []) {
                const volumeInfo = item.volumeInfo;
                if (volumeInfo && isContentAppropriate(volumeInfo, 'book')) {
                  const posterUrl = `https://books.google.com/books/content?id=${item.id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;
                  bookResults.push({
                    title: volumeInfo.title,
                    type: 'book',
                    creator: volumeInfo.authors?.[0] || 'Unknown Author',
                    poster_url: posterUrl,
                    external_id: item.id,
                    external_source: 'googlebooks',
                    description: volumeInfo.description?.substring(0, 200) || '',
                    release_date: volumeInfo.publishedDate || null,
                    ratings_count: volumeInfo.ratingsCount ?? 0,
                    page_count: volumeInfo.pageCount || 0,
                    series: extractSeries(volumeInfo),
                    subtitle: volumeInfo.subtitle || '',
                    categories: volumeInfo.categories || [],
                  });
                  foundBooks = true;
                }
              }
              console.log('Books added from Google Books (primary):', bookResults.length);
            }

            // If this looks like an author search, run a dedicated inauthor: query in parallel
            if (gbAuthorQuery) {
              try {
                const authorUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gbAuthorQuery)}&maxResults=20&printType=books&orderBy=relevance&key=${googleBooksApiKey}`;
                const authorResponse = await fetchWithTimeout(authorUrl, {}, 5000);
                if (authorResponse.ok) {
                  const authorData = await authorResponse.json();
                  const existingIds = new Set(bookResults.map((b: any) => b.external_id));
                  for (const item of authorData.items?.slice(0, 15) || []) {
                    const volumeInfo = item.volumeInfo;
                    if (volumeInfo && isContentAppropriate(volumeInfo, 'book') && !existingIds.has(item.id)) {
                      const posterUrl = `https://books.google.com/books/content?id=${item.id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;
                      bookResults.push({
                        title: volumeInfo.title,
                        type: 'book',
                        creator: volumeInfo.authors?.[0] || 'Unknown Author',
                        poster_url: posterUrl,
                        external_id: item.id,
                        external_source: 'googlebooks',
                        description: volumeInfo.description?.substring(0, 200) || '',
                        release_date: volumeInfo.publishedDate || null,
                        ratings_count: volumeInfo.ratingsCount ?? 0,
                        page_count: volumeInfo.pageCount || 0,
                        series: extractSeries(volumeInfo),
                        subtitle: volumeInfo.subtitle || '',
                        categories: volumeInfo.categories || [],
                        _author_match: true,
                      });
                      foundBooks = true;
                      existingIds.add(item.id);
                    }
                  }
                  console.log('Books added from Google Books (inauthor):', bookResults.length);
                }
              } catch (err) {
                console.error('Google Books inauthor search error:', err);
              }
            }
          } catch (error) {
            console.error('Google Books search error:', error);
          }
        } else {
          console.warn('GOOGLE_BOOKS_API_KEY not set, skipping Google Books');
        }

        // Fallback to Open Library if Google Books fails or returns no results
        if (!foundBooks) {
          try {
            let bookUrl: string;
            if (byMatch) {
              // "Title by Author" — search both fields separately for best results
              bookUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(byMatch[1].trim())}&author=${encodeURIComponent(byMatch[2].trim())}&limit=20`;
            } else if (isAuthorSearch) {
              // Pure author name search
              bookUrl = `https://openlibrary.org/search.json?author=${encodeURIComponent(searchQuery)}&limit=20&sort=editions`;
            } else {
              bookUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=20`;
            }

            console.log('Fetching Open Library (fallback):', bookUrl);
            const bookResponse = await fetchWithTimeout(bookUrl, {
              headers: { 'User-Agent': 'Consumed-App/1.0 (support@consumed.app)' }
            }, 5000);

            if (bookResponse.ok) {
              const bookData = await bookResponse.json();
              bookData.docs?.slice(0, 15).forEach((book: any) => {
                if (isContentAppropriate(book, 'book')) {
                  bookResults.push({
                    title: book.title,
                    type: 'book',
                    creator: book.author_name?.[0] || 'Unknown Author',
                    poster_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '',
                    external_id: book.key,
                    external_source: 'openlibrary',
                    description: book.first_sentence?.[0] || '',
                    release_date: book.first_publish_year ? `${book.first_publish_year}` : null,
                    edition_count: book.edition_count ?? 0,
                    series: book.series?.[0] || null,
                  });
                }
              });
              console.log('Books added from Open Library:', bookResults.length);
            }
          } catch (error) {
            console.error('Open Library fallback error:', error);
            errors.push('books');
          }
        }
      })());
    }

    // Podcast Search — iTunes Search API (free, no auth) primary, Spotify fallback
    if (!type || type === 'podcast') {
      searchPromises.push((async () => {
        try {
          // Primary: iTunes Search API (free, reliable, no credentials needed)
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=podcast&entity=podcast&limit=10&country=US`;
          const itunesResponse = await fetchWithTimeout(itunesUrl, {}, 5000);

          if (itunesResponse.ok) {
            const itunesData = await itunesResponse.json();
            (itunesData.results || []).slice(0, 8).forEach((podcast: any) => {
              if (isContentAppropriate(podcast, 'podcast')) {
                podcastResults.push({
                  title: podcast.collectionName || podcast.trackName,
                  type: 'podcast',
                  media_subtype: 'show',
                  creator: podcast.artistName || 'Unknown',
                  poster_url: podcast.artworkUrl600 || podcast.artworkUrl100 || podcast.artworkUrl60 || '',
                  external_id: String(podcast.collectionId || podcast.trackId),
                  external_source: 'itunes',
                  description: podcast.primaryGenreName || ''
                });
              }
            });
          }

          // Fallback: Spotify (if iTunes returned nothing and credentials available)
          if (podcastResults.length === 0) {
            const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
            const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');

            if (clientId && clientSecret) {
              const authResponse = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials'
              }, 4000);

              if (authResponse.ok) {
                const authData = await authResponse.json();
                const accessToken = authData.access_token;

                const spotifyResponse = await fetchWithTimeout(
                  `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=show&limit=10&market=US`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } },
                  4000
                );

                if (spotifyResponse.ok) {
                  const spotifyData = await spotifyResponse.json();
                  spotifyData.shows?.items?.slice(0, 5).forEach((podcast: any) => {
                    if (isContentAppropriate(podcast, 'podcast')) {
                      podcastResults.push({
                        title: podcast.name,
                        type: 'podcast',
                        media_subtype: 'show',
                        creator: podcast.publisher,
                        poster_url: podcast.images?.[0]?.url || '',
                        external_id: podcast.id,
                        external_source: 'spotify',
                        description: podcast.description
                      });
                    }
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('Podcast search error:', error);
          errors.push('podcast');
        }
      })());
    }

    // Music Search — iTunes primary, OpenAI fallback
    if (!type || type === 'music') {
      searchPromises.push((async () => {
        try {
          // Primary: iTunes Search API (free, comprehensive catalog, no auth)
          const itunesMusicUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=album,musicTrack&limit=15&country=US`;
          const itunesMusicResponse = await fetchWithTimeout(itunesMusicUrl, {}, 5000);

          if (itunesMusicResponse.ok) {
            const itunesMusicData = await itunesMusicResponse.json();
            const seen = new Set<string>();
            (itunesMusicData.results || []).forEach((item: any) => {
              if (!isContentAppropriate(item, 'music')) return;
              if (item.wrapperType === 'collection' || item.kind === 'album') {
                const key = `album-${item.collectionId}`;
                if (seen.has(key)) return;
                seen.add(key);
                musicResults.push({
                  title: item.collectionName,
                  type: 'music',
                  media_subtype: 'album',
                  creator: item.artistName || 'Unknown Artist',
                  poster_url: (item.artworkUrl100 || '').replace('100x100', '600x600'),
                  external_id: String(item.collectionId),
                  external_source: 'itunes',
                  description: `Album • ${item.primaryGenreName || ''} • ${item.releaseDate?.substring(0, 4) || ''}`
                });
              } else if (item.kind === 'song') {
                const key = `song-${item.trackId}`;
                if (seen.has(key)) return;
                seen.add(key);
                musicResults.push({
                  title: item.trackName,
                  type: 'music',
                  media_subtype: 'song',
                  creator: item.artistName || 'Unknown Artist',
                  poster_url: (item.artworkUrl100 || '').replace('100x100', '600x600'),
                  external_id: String(item.trackId),
                  external_source: 'itunes',
                  description: `Song • ${item.collectionName || 'Unknown Album'}`
                });
              }
            });
          }

          // Fallback: OpenAI — for obscure/niche music iTunes may miss
          if (musicResults.length === 0) {
            const openaiKey = Deno.env.get('OPENAI_API_KEY');
            if (openaiKey) {
              const openaiResponse = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openaiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [{
                    role: 'system',
                    content: 'You are a music database. Return a JSON array of up to 5 music results matching the query. Each object must have: title (album or song name), creator (artist name), year (4-digit string), subtype ("album" or "song"). Return ONLY valid JSON, no markdown.'
                  }, {
                    role: 'user',
                    content: `Music search: "${searchQuery}"`
                  }],
                  temperature: 0,
                  max_tokens: 400
                })
              }, 6000);

              if (openaiResponse.ok) {
                const openaiData = await openaiResponse.json();
                const raw = openaiData.choices?.[0]?.message?.content?.trim() || '[]';
                try {
                  const suggestions: any[] = JSON.parse(raw);
                  suggestions.slice(0, 5).forEach((item: any) => {
                    musicResults.push({
                      title: item.title || 'Unknown',
                      type: 'music',
                      media_subtype: item.subtype || 'album',
                      creator: item.creator || 'Unknown Artist',
                      poster_url: '',
                      external_id: `openai-${(item.title || '').toLowerCase().replace(/\s+/g, '-')}-${(item.creator || '').toLowerCase().replace(/\s+/g, '-')}`,
                      external_source: 'openai',
                      description: `${item.subtype === 'song' ? 'Song' : 'Album'} • ${item.year || ''}`
                    });
                  });
                } catch (_) { /* ignore parse errors */ }
              }
            }
          }
        } catch (error) {
          console.error('Music search error:', error);
          errors.push('music');
        }
      })());
    }

    // YouTube Search
    if (!type || type === 'youtube') {
      searchPromises.push((async () => {
        try {
          const youtubeKey = Deno.env.get('YOUTUBE_API_KEY');
          if (youtubeKey) {
            const youtubeResponse = await fetchWithTimeout(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=5&key=${youtubeKey}&safeSearch=strict`,
              {},
              3000
            );
            if (youtubeResponse.ok) {
              const youtubeData = await youtubeResponse.json();
              youtubeData.items?.forEach((video: any) => {
                if (isContentAppropriate(video.snippet, 'youtube')) {
                  youtubeResults.push({
                    title: video.snippet.title,
                    type: 'youtube',
                    creator: video.snippet.channelTitle,
                    poster_url: video.snippet.thumbnails?.medium?.url || '',
                    external_id: video.id.videoId,
                    external_source: 'youtube',
                    description: video.snippet.description
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('YouTube search error:', error);
          errors.push('youtube');
        }
      })());
    }

    // Gaming Search
    if (!type || type === 'game' || type === 'gaming') {
      searchPromises.push((async () => {
        try {
          const gamingResponse = await fetchWithTimeout(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/gaming-search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({ query: searchQuery })
            },
            3000
          );
          
          if (gamingResponse.ok) {
            const gamingData = await gamingResponse.json();
            gamingResults.push(...(gamingData.results || []));
          }
        } catch (error) {
          console.error('Gaming search routing error:', error);
          errors.push('gaming');
        }
      })());
    }

    // Sports Search
    if (!type || type === 'sports') {
      searchPromises.push((async () => {
        try {
          const sportsResponse = await fetchWithTimeout(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/sports-search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({ query: searchQuery })
            },
            3000
          );
          
          if (sportsResponse.ok) {
            const sportsData = await sportsResponse.json();
            sportsResults.push(...(sportsData.results || []));
          }
        } catch (error) {
          console.error('Sports search routing error:', error);
          errors.push('sports');
        }
      })());
    }

    // Book Series detection — only when caller requests it (e.g. Binge Battle)
    // Always run when includeBookSeries is true — don't let type narrowing block it
    if (includeBookSeries) {
      searchPromises.push((async () => {
        try {
          const openaiKey = Deno.env.get('OPENAI_API_KEY');
          if (!openaiKey) return;

          const seriesResponse = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [{
                role: 'system',
                content: 'You are a comprehensive book series database with knowledge of mainstream, indie, YA, cozy mystery, Christian fiction, romance, and niche series. Given a search query, determine if it matches any known book series. If yes, return a JSON object with exactly these fields: series_name (string), author (string), book_count (integer, total number of books in the series), first_book_title (string, title of the first book), description (string, one sentence). If the query does not clearly match a book series, return null. Return ONLY valid JSON or the word null, no markdown, no explanation.'
              }, {
                role: 'user',
                content: `Query: "${searchQuery}"`
              }],
              temperature: 0,
              max_tokens: 250
            })
          }, 7000);

          if (!seriesResponse.ok) return;
          const seriesData = await seriesResponse.json();
          const raw = seriesData.choices?.[0]?.message?.content?.trim() || 'null';

          let series: any = null;
          try { series = JSON.parse(raw); } catch (_) { return; }
          if (!series || !series.series_name) return;

          // Fetch cover using the first book in the series
          let coverUrl = '';
          const googleBooksApiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
          if (googleBooksApiKey && series.first_book_title) {
            try {
              const gbResp = await fetchWithTimeout(
                `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(series.first_book_title + ' ' + (series.author || ''))}&maxResults=1&key=${googleBooksApiKey}`,
                {}, 4000
              );
              if (gbResp.ok) {
                const gbData = await gbResp.json();
                const firstItem = gbData.items?.[0];
                if (firstItem) {
                  coverUrl = `https://books.google.com/books/content?id=${firstItem.id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;
                }
              }
            } catch (_) { /* ignore cover fetch failure */ }
          }

          bookSeriesResults.push({
            title: series.series_name,
            type: 'book_series',
            creator: series.author || '',
            poster_url: coverUrl,
            external_id: `series-${(series.series_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            external_source: 'openai',
            description: series.description || '',
            series_count: typeof series.book_count === 'number' ? series.book_count : 0,
            release_date: null
          });
        } catch (error) {
          console.error('Book series detection error:', error);
        }
      })());
    }

    // Wait for all searches to complete (with individual timeouts)
    await Promise.allSettled(searchPromises);

    // Deduplicate music results by title + creator (same song can appear as single and album track)
    const seenMusic = new Set<string>();
    const dedupedMusic = musicResults.filter(item => {
      const key = `${item.title?.toLowerCase()}-${item.creator?.toLowerCase()}-${item.media_subtype}`;
      if (seenMusic.has(key)) return false;
      seenMusic.add(key);
      return true;
    });
    
    // Combine all results
    const allResults = [
      ...movieTvResults,
      ...bookResults,
      ...dedupedMusic,
      ...podcastResults,
      ...youtubeResults,
      ...gamingResults,
      ...sportsResults
    ];

    // Score and sort by relevance to search query
    // Use cleaned query (without type keywords) for title matching
    const queryLower = searchQuery.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Detect "sequel search" pattern: Arabic ("harry potter 2") OR roman ("star wars iv")
    const sequelMatch = /^(.+?)\s+(\d{1,2})$/.exec(queryLower.trim());
    const arabicSeqNum = sequelMatch ? parseInt(sequelMatch[2], 10) : null;
    // romanSeqNum + romanSeqMatch already defined above from the pre-TMDB section
    const isSequelSearch = (arabicSeqNum !== null && arabicSeqNum <= 20) || romanSeqNum !== null;
    const sequelBaseStr = isSequelSearch
      ? (arabicSeqNum !== null ? sequelMatch![1] : romanSeqMatch![1]).trim()
      : queryLower;
    const sequelBaseWords = isSequelSearch ? sequelBaseStr.split(/\s+/).filter(w => w.length > 1) : [];
    
    // Helper for safe string lowercasing
    const safeLower = (val: any) => (typeof val === 'string' ? val : '').toLowerCase();
    
    // Helper to normalize titles by stripping leading articles (the, a, an)
    // This helps "night manager" match "The Night Manager" as exact match
    const normalizeTitle = (s: string) => s.replace(/^(the|a|an)\s+/i, '').trim();
    
    // queryHasBook, queryHasMovie, etc. were already detected at the top before stripping
    
    const scoredResults = allResults.map(item => {
      const title = safeLower(item.title);
      const creator = safeLower(item.creator);
      const description = safeLower(item.description);
      let score = 0;
      
      // Normalized versions for better matching
      const normalizedTitle = normalizeTitle(title);
      const normalizedQuery = normalizeTitle(queryLower);
      
      // 0. Fuzzy match score - helps with typos like "nuremburg" → "nuremberg"
      const fuzzyScore = fuzzyMatchScore(normalizedQuery, normalizedTitle);
      if (fuzzyScore >= 0.8) {
        score += Math.floor(fuzzyScore * 50);  // Up to 50 points for good fuzzy match
      } else if (fuzzyScore >= 0.6) {
        score += Math.floor(fuzzyScore * 30);  // Partial fuzzy match
      }
      
      // 1. Title vs query - strongest signal (use both normalized and raw comparisons)
      // Compound-word matching: "flea bag" ↔ "fleabag"
      const queryNoSpaces = queryLower.replace(/\s+/g, '');
      const titleNoSpaces = title.replace(/\s+/g, '');
      const normalizedQueryNoSpaces = normalizedQuery.replace(/\s+/g, '');
      const normalizedTitleNoSpaces = normalizedTitle.replace(/\s+/g, '');

      if (title === queryLower || normalizedTitle === normalizedQuery) {
        score += 100;  // Exact match (with or without "The/A/An")
      } else if (titleNoSpaces === queryNoSpaces || normalizedTitleNoSpaces === normalizedQueryNoSpaces) {
        score += 95;   // Compound-word exact match (e.g. "fleabag" = "flea bag")
      } else if (title.startsWith(queryLower) || normalizedTitle.startsWith(normalizedQuery)) {
        score += 80;   // Title starts with query
      } else if ((queryLower.startsWith(title) && title.length > 0) || 
                 (normalizedQuery.startsWith(normalizedTitle) && normalizedTitle.length > 0)) {
        score += 70;   // User still typing full title
      } else if (title.includes(queryLower) || normalizedTitle.includes(normalizedQuery)) {
        score += 60;   // Query appears in title
      } else {
        // Word overlap in title
        const titleWords = title.split(/\s+/);
        const matchingWords = queryWords.filter(qw => 
          titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
        );
        score += Math.min(40, matchingWords.length * 15);
      }
      
      // 2. Creator matching - weaker signal
      if (creator && queryLower.length > 2) {
        if (creator.includes(queryLower)) {
          score += 20;
        } else {
          const creatorWords = creator.split(/\s+/);
          const matchingCreatorWords = queryWords.filter(qw =>
            creatorWords.some(tw => tw.includes(qw) || qw.includes(tw))
          );
          score += Math.min(15, matchingCreatorWords.length * 5);
        }
      }

      // 2b. Artist/band search boost — when the query IS the artist name,
      // music results should surface strongly even if album titles differ.
      // e.g. searching "metallica" → "Master of Puppets" by Metallica scores high.
      if (item.type === 'music' && creator && queryLower.length > 2) {
        const creatorLower = creator.toLowerCase().trim();
        if (creatorLower === queryLower || creatorLower.includes(queryLower) || queryLower.includes(creatorLower)) {
          score += 75;  // Strong: user is searching for this artist by name
        }
      }
      // Book author search boost — result came from a dedicated inauthor: query
      if (item.type === 'book' && (item as any)._author_match) {
        score += 60;
      }
      // Book author name match — query words appear in creator field
      if (item.type === 'book' && creator && queryLower.length > 2) {
        const creatorLower = creator.toLowerCase().trim();
        if (creatorLower === queryLower || creatorLower.includes(queryLower) || queryLower.includes(creatorLower)) {
          score += 50;
        }
      }
      // Similar boost for podcasts searched by show host/creator name
      if (item.type === 'podcast' && creator && queryLower.length > 2) {
        const creatorLower = creator.toLowerCase().trim();
        if (creatorLower === queryLower || creatorLower.includes(queryLower)) {
          score += 40;
        }
      }
      
      // 3. Description matching
      if (description && queryLower.length > 2) {
        if (description.includes(queryLower)) score += 10;
        // Per-word description bonus: helps movies whose TMDB title is short but
        // whose synopsis contains the subtitle words the user typed.
        // e.g. "star wars new hope" → TMDB description mentions "New Hope" → movie scores higher
        const descLower = description.toLowerCase();
        const STOP_WORDS = new Set(['a','an','the','of','in','and','or','to','is','it','by','as','for','on','with','at','from','that','this','but','not','are','was','be','have','has','had','will','would','could','should','may','might','do','does','did','its','my','your','our','their','his','her','we','he','she','they','i','you']);
        const significantQueryWords = queryWords.filter(w => w.length > 2 && !STOP_WORDS.has(w));
        if (significantQueryWords.length > 0) {
          const descWordMatches = significantQueryWords.filter(w => descLower.includes(w));
          score += descWordMatches.length * 8;
        }
      }

      // 3c. Word-coverage penalty — penalise results that are missing significant query words
      // from BOTH their title AND description. This stops generic "Star Wars" books from ranking
      // above the specific film when user searches "star wars new hope".
      if (queryWords.length >= 3) {
        const STOP_WORDS2 = new Set(['a','an','the','of','in','and','or','to','is','it','by','as','for','on','with','at','from','that','this','but','not','are','was','be','have','has','had','will','would','could','should']);
        const sigWords = queryWords.filter(w => w.length > 2 && !STOP_WORDS2.has(w));
        if (sigWords.length >= 2) {
          const combined = `${title} ${creator} ${(description || '').toLowerCase().substring(0, 300)}`;
          const missingCount = sigWords.filter(w => !combined.includes(w)).length;
          if (missingCount > 0) {
            score -= missingCount * 18;  // -18 per missing significant word
          }
        }
      }

      // 3b. Sequel search scoring — "harry potter 2", "star wars iv", etc.
      // When a query ends with a number/roman, boost movie/book/tv that contain all base words.
      // Results from the secondary "episode N" TMDB search get an extra boost.
      if (isSequelSearch && sequelBaseWords.length > 0) {
        const baseMatchCount = sequelBaseWords.filter(bw => title.includes(bw)).length;
        const allBaseWordsMatch = baseMatchCount === sequelBaseWords.length;
        if (allBaseWordsMatch) {
          if (item.type === 'movie' || item.type === 'book' || item.type === 'tv') {
            score += 55;  // Strong boost: movie/book that contains all base words of "X N" query
          }
        }
        // Extra boost for results from the secondary "episode N" TMDB search — these are
        // specifically the properly-titled installments (e.g. "Star Wars: Episode IV - A New Hope")
        if ((item as any)._episode_match) {
          score += 40;
        }
        // Music and podcasts are almost never a numbered sequel — push them down
        if (item.type === 'music' || item.type === 'podcast') {
          score -= 40;
        }
      }

      // 4. Query intent - explicit type keywords in query
      if (queryHasBook && item.type === 'book') score += 40;
      if (queryHasMovie && item.type === 'movie') score += 40;
      if (queryHasMusic && item.type === 'music') score += 40;
      if (queryHasTv && item.type === 'tv') score += 40;
      if (queryHasPodcast && item.type === 'podcast') score += 60;

      // Penalise music/podcast when the query has no music-specific intent.
      // e.g. "star wars new hope" should surface the movie, not the soundtrack.
      if (!queryHasMusic && !queryHasPodcast) {
        if (item.type === 'music') score -= 30;
        if (item.type === 'podcast') score -= 20;
      }
      
      // 5. Type filter boost - if caller passed a specific type
      if (type && item.type === type) {
        score += 25;
      }
      
      // 6. Popularity/social proof for providers that have it
      const popularity = (item as any).popularity;
      if (typeof popularity === 'number' && popularity > 0) {
        score += Math.min(45, popularity / 2);
      }
      
      const voteCount = (item as any).vote_count;
      if (typeof voteCount === 'number' && voteCount > 0) {
        score += Math.min(30, voteCount / 80);
      }
      
      // For books: use logarithmic scale so popular novels beat companion books
      const ratingsCount = (item as any).ratings_count;
      if (typeof ratingsCount === 'number' && ratingsCount > 0) {
        score += Math.min(60, Math.log10(ratingsCount + 1) * 18);
      }
      
      // Book quality signals: penalize companion/activity/illustrated books
      if (item.type === 'book') {
        const bookSubtitle = ((item as any).subtitle || '').toLowerCase();
        const bookCategories: string[] = (item as any).categories || [];
        const catLower = bookCategories.join(' ').toLowerCase();
        const bookPageCount = (item as any).page_count || 0;
        
        // Penalize companion/supplementary books
        const companionKeywords = /coloring|activity|sticker|puzzle|journal|diary|notebook|workbook|illustrated companion|visual companion|trivia|quiz|recipe|cookbook|craft|how to draw|art of|making of|behind the scenes|guide to|world of|places|creatures|characters|character guide/i;
        if (companionKeywords.test(bookSubtitle) || companionKeywords.test(item.title || '')) {
          score -= 50;
        }
        
        // Penalize non-fiction/companion categories
        const companionCategories = /games|activities|crafts|hobbies|reference|humor|comics|juvenile nonfiction/i;
        if (companionCategories.test(catLower)) {
          score -= 40;
        }
        
        // Small boost for novels with substantial page count
        if (bookPageCount >= 200 && bookPageCount <= 900) {
          score += 8;
        } else if (bookPageCount > 0 && bookPageCount < 100) {
          score -= 15;
        }
      }
      
      const editionCount = (item as any).edition_count;
      if (typeof editionCount === 'number' && editionCount > 0) {
        score += Math.min(25, Math.log10(editionCount + 1) * 12);
      }
      
      // 7. CLASSIC BONUS - old content with high engagement = cultural classic
      // This is OPPOSITE of recency bias - we WANT to boost classics like Anne of Green Gables
      const releaseDate = (item as any).release_date;
      if (releaseDate) {
        const yearMatch = String(releaseDate).match(/^(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          const currentYear = new Date().getFullYear();
          const age = currentYear - year;
          
          // NEW: Recency boost for recent releases (within last 2 years)
          // Helps new movies/shows appear when users search for them
          if (age <= 0) {
            score += 20;  // Upcoming or current year release
          } else if (age === 1) {
            score += 15;  // Last year's release
          } else if (age === 2) {
            score += 10;  // 2 years old
          }
          
          // Old AND popular = classic (books from 1900s still popular today)
          if (age > 50 && (voteCount > 100 || ratingsCount > 10 || editionCount > 20)) {
            score += 25;  // Classic bonus
          } else if (age > 30 && (voteCount > 500 || ratingsCount > 50 || editionCount > 50)) {
            score += 15;  // Established classic
          }
        }
      }
      
      // 8. Book classic bonus - old books with many editions are literary classics
      if (item.type === 'book') {
        if (editionCount && editionCount > 50) {
          score += 20;  // Many editions = enduring classic
        } else if (editionCount && editionCount > 20) {
          score += 10;
        }
      }
      
      return { ...item, _score: score };
    });
    
    // Sort by score descending (best matches first)
    scoredResults.sort((a, b) => b._score - a._score);
    
    // Limit results to avoid massive responses
    const trimmed = scoredResults.slice(0, 50);
    
    // Normalize image fields on both scored results and series results
    const normalizeResult = ({ _score, poster_url, ...item }: any) => ({
      ...item,
      poster_url,
      image: poster_url,
      image_url: poster_url
    });

    // Book series results always appear first (OpenAI already validated the match)
    const seriesNormalized = bookSeriesResults.map(normalizeResult);
    const results = [...seriesNormalized, ...trimmed.map(normalizeResult)];

    // Log final results
    console.log('Final results:', results.length, 'items');

    return new Response(JSON.stringify({ 
      results,
      partial: errors.length > 0,
      failedProviders: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: error.message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
