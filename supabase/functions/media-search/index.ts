
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
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      query = url.searchParams.get('query');
      type = url.searchParams.get('type');
    } else {
      const body = await req.json();
      query = body.query;
      type = body.type;
    }
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Detect media type hints in query BEFORE stripping them
    const queryHasBook = /\b(book|novel|read)\b/i.test(query);
    const queryHasMovie = /\b(movie|film|watch)\b/i.test(query);
    const queryHasMusic = /\b(song|album|music|listen)\b/i.test(query);
    const queryHasTv = /\b(show|series|tv)\b/i.test(query);
    
    // Strip type keywords from query for cleaner API searches
    // e.g., "anne of green gables book" → "anne of green gables"
    const cleanedQuery = query
      .replace(/\b(book|novel|read|movie|film|watch|song|album|music|listen|show|series|tv)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Use cleaned query for API calls, but keep original for logging
    const searchQuery = cleanedQuery.length > 2 ? cleanedQuery : query;
    console.log('Original query:', query, '| Cleaned query:', searchQuery, '| Type hints:', { queryHasBook, queryHasMovie, queryHasMusic, queryHasTv });

    // Collect results by type first, then merge in desired order
    const bookResults: any[] = [];
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
            const tmdbResponse = await fetchWithTimeout(
              `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(searchQuery)}&page=1&include_adult=false`,
              {},
              4000
            );
            if (tmdbResponse.ok) {
              const tmdbData = await tmdbResponse.json();
              tmdbData.results?.slice(0, 15).forEach((item: any) => {
                if ((item.media_type === 'movie' || item.media_type === 'tv') && isContentAppropriate(item, item.media_type)) {
                  const releaseDate = item.release_date || item.first_air_date || '';
                  const year = releaseDate ? releaseDate.substring(0, 4) : '';
                  
                  movieTvResults.push({
                    title: item.title || item.name,
                    type: item.media_type === 'movie' ? 'movie' : 'tv',
                    media_subtype: item.media_type === 'tv' ? 'series' : null,
                    creator: '', // Director requires extra API call - leave empty
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
            }
          }
        } catch (error) {
          console.error('TMDB search error:', error);
          errors.push('tmdb');
        }
      })());
    }

    // Google Books Search (primary) + Open Library fallback
    if (!type || type === 'book') {
      searchPromises.push((async () => {
        let foundBooks = false;
        
        // Try Google Books first (more reliable)
        try {
          const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5`;
          console.log('Fetching Google Books:', googleBooksUrl);
          const googleResponse = await fetchWithTimeout(googleBooksUrl, {}, 5000);
          console.log('Google Books response status:', googleResponse.status);
          
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            console.log('Google Books items count:', googleData.items?.length || 0);
            googleData.items?.slice(0, 5).forEach((item: any) => {
              const volumeInfo = item.volumeInfo;
              if (volumeInfo && isContentAppropriate(volumeInfo, 'book')) {
                bookResults.push({
                  title: volumeInfo.title,
                  type: 'book',
                  creator: volumeInfo.authors?.[0] || 'Unknown Author',
                  poster_url: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || '',
                  external_id: item.id,
                  external_source: 'googlebooks',
                  description: volumeInfo.description?.substring(0, 200) || '',
                  release_date: volumeInfo.publishedDate || null,
                  ratings_count: volumeInfo.ratingsCount ?? 0
                });
                foundBooks = true;
              }
            });
            console.log('Books added to results:', foundBooks);
          }
        } catch (error) {
          console.error('Google Books search error:', error);
        }
        
        // Fallback to Open Library if Google Books fails
        if (!foundBooks) {
          try {
            let bookUrl;
            if (searchQuery.toLowerCase().includes(' by ')) {
              const parts = searchQuery.split(/\s+by\s+/i);
              const title = parts[0].trim();
              const author = parts[1].trim();
              bookUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`;
            } else {
              bookUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=5`;
            }
            
            const bookResponse = await fetchWithTimeout(bookUrl, {}, 2000);
            if (bookResponse.ok) {
              const bookData = await bookResponse.json();
              bookData.docs?.slice(0, 5).forEach((book: any) => {
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
                    edition_count: book.edition_count ?? 0
                  });
                }
              });
            }
          } catch (error) {
            console.error('Open Library fallback error:', error);
            errors.push('books');
          }
        }
      })());
    }

    // Spotify Search (podcasts)
    if (!type || type === 'podcast') {
      searchPromises.push((async () => {
        try {
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
            }, 3000);
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              const accessToken = authData.access_token;
              
              const spotifyResponse = await fetchWithTimeout(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=show&limit=10`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } },
                3000
              );
              
              if (spotifyResponse.ok) {
                const spotifyData = await spotifyResponse.json();
                spotifyData.shows?.items?.forEach((podcast: any) => {
                  if (isContentAppropriate(podcast, 'podcast')) {
                    podcastResults.push({
                      title: podcast.name,
                      type: 'podcast',
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
        } catch (error) {
          console.error('Podcast search error:', error);
          errors.push('podcast');
        }
      })());
    }

    // Spotify Search (music)
    if (!type || type === 'music') {
      searchPromises.push((async () => {
        try {
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
            }, 3000);
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              const accessToken = authData.access_token;
              
              const spotifyResponse = await fetchWithTimeout(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=album,track&limit=10`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } },
                3000
              );
              
              if (spotifyResponse.ok) {
                const spotifyData = await spotifyResponse.json();
                
                spotifyData.albums?.items?.slice(0, 5).forEach((album: any) => {
                  if (isContentAppropriate(album, 'music')) {
                    musicResults.push({
                      title: album.name,
                      type: 'music',
                      media_subtype: 'album',
                      creator: album.artists?.[0]?.name || 'Unknown Artist',
                      poster_url: album.images?.[0]?.url || '',
                      external_id: album.id,
                      external_source: 'spotify',
                      description: `Album • ${album.total_tracks || 0} tracks • ${album.release_date?.substring(0, 4) || 'Unknown year'}`
                    });
                  }
                });
                
                spotifyData.tracks?.items?.slice(0, 5).forEach((track: any) => {
                  if (isContentAppropriate(track, 'music')) {
                    musicResults.push({
                      title: track.name,
                      type: 'music',
                      media_subtype: 'song',
                      creator: track.artists?.[0]?.name || 'Unknown Artist',
                      poster_url: track.album?.images?.[0]?.url || '',
                      external_id: track.id,
                      external_source: 'spotify',
                      description: `Song • ${track.album?.name || 'Unknown Album'}`
                    });
                  }
                });
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
    
    // Helper for safe string lowercasing
    const safeLower = (val: any) => (typeof val === 'string' ? val : '').toLowerCase();
    
    // queryHasBook, queryHasMovie, etc. were already detected at the top before stripping
    
    const scoredResults = allResults.map(item => {
      const title = safeLower(item.title);
      const creator = safeLower(item.creator);
      const description = safeLower(item.description);
      let score = 0;
      
      // 1. Title vs query - strongest signal
      if (title === queryLower) {
        score += 100;  // Exact match
      } else if (title.startsWith(queryLower)) {
        score += 80;   // Title starts with query
      } else if (queryLower.startsWith(title) && title.length > 0) {
        score += 70;   // User still typing full title
      } else if (title.includes(queryLower)) {
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
      
      // 3. Description matching - weakest signal
      if (description && queryLower.length > 2) {
        if (description.includes(queryLower)) score += 10;
      }
      
      // 4. Query intent - explicit type keywords in query
      if (queryHasBook && item.type === 'book') score += 40;
      if (queryHasMovie && item.type === 'movie') score += 40;
      if (queryHasMusic && item.type === 'music') score += 40;
      if (queryHasTv && item.type === 'tv') score += 40;
      
      // 5. Type filter boost - if caller passed a specific type
      if (type && item.type === type) {
        score += 25;
      }
      
      // 6. Popularity/social proof for providers that have it
      const popularity = (item as any).popularity;
      if (typeof popularity === 'number' && popularity > 0) {
        score += Math.min(25, popularity / 4);
      }
      
      const voteCount = (item as any).vote_count;
      if (typeof voteCount === 'number' && voteCount > 0) {
        score += Math.min(20, voteCount / 100);
      }
      
      // For books: ratings_count or edition_count indicates cultural significance
      const ratingsCount = (item as any).ratings_count;
      if (typeof ratingsCount === 'number' && ratingsCount > 0) {
        score += Math.min(20, ratingsCount / 50);
      }
      
      const editionCount = (item as any).edition_count;
      if (typeof editionCount === 'number' && editionCount > 0) {
        score += Math.min(15, editionCount / 10);
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
      
      // 8. Book bonus for exact/near-exact title matches
      // Books are often the original source material
      if (item.type === 'book' && (title === queryLower || title.includes(queryLower))) {
        score += 10;
      }
      
      return { ...item, _score: score };
    });
    
    // Sort by score descending (best matches first)
    scoredResults.sort((a, b) => b._score - a._score);
    
    // Limit results to avoid massive responses
    const trimmed = scoredResults.slice(0, 50);
    
    // Remove internal score and normalize image field before returning
    const results = trimmed.map(({ _score, poster_url, ...item }) => ({
      ...item,
      poster_url,
      image: poster_url // Alias for frontend compatibility
    }));

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
