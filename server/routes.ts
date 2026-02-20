import type { Express } from "express";
import { createServer, type Server } from "http";
import { createClient } from "@supabase/supabase-js";
// All user data is handled by Supabase Edge Functions
// These routes only proxy external APIs (TMDB, NYT, Spotify) that need server-side API keys

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/api/image-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL parameter required" });
      }
      const allowedDomains = ['image.tmdb.org', 'books.google.com', 'i.scdn.co', 'covers.openlibrary.org', 'mosaic.scdn.co', 'm.media-amazon.com', 'is1-ssl.mzstatic.com'];
      const parsed = new URL(url);
      if (!allowedDomains.some(d => parsed.hostname.includes(d))) {
        return res.status(403).json({ error: "Domain not allowed" });
      }
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch image" });
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Image proxy error" });
    }
  });

  // Get NY Times bestsellers with Google Books covers
  app.get("/api/nyt/bestsellers", async (req, res) => {
    try {
      const NYT_API_KEY = process.env.NYT_API_KEY;
      const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
      
      if (!NYT_API_KEY) {
        return res.status(500).json({ message: "NYT API key not configured" });
      }

      // Fetch NYT bestseller list (combined print & e-book fiction)
      const nytResponse = await fetch(
        `https://api.nytimes.com/svc/books/v3/lists/current/combined-print-and-e-book-fiction.json?api-key=${NYT_API_KEY}`
      );
      
      if (!nytResponse.ok) {
        const errorText = await nytResponse.text();
        console.error('NYT API error:', nytResponse.status, errorText);
        throw new Error(`Failed to fetch from NY Times: ${nytResponse.status}`);
      }

      const nytData = await nytResponse.json();
      const books = nytData.results?.books || [];

      // Format book data with cover images
      const formattedBooks = books.slice(0, 10).map((book: any) => {
          let imageUrl = '';
          
          // Get cover from Open Library (free, no quota limits)
          // Note: Some books may return tiny placeholder images - frontend will handle fallback
          const isbn = book.primary_isbn13 || book.primary_isbn10;
          if (isbn) {
            imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
          }

          return {
            id: isbn || book.rank.toString(),
            title: book.title,
            author: book.author,
            imageUrl,
            rating: undefined, // NYT doesn't provide ratings
            year: undefined,
            mediaType: 'book',
            rank: book.rank,
            weeksOnList: book.weeks_on_list,
            description: book.description,
          };
        });

      res.json(formattedBooks);
    } catch (error) {
      console.error('NYT bestsellers error:', error);
      res.status(500).json({ message: "Failed to fetch bestsellers" });
    }
  });

  // Get trending movies from TMDB with platform info
  app.get("/api/tmdb/trending/movies", async (req, res) => {
    try {
      const TMDB_API_KEY = process.env.TMDB_API_KEY;
      if (!TMDB_API_KEY) {
        return res.status(500).json({ message: "TMDB API key not configured" });
      }

      // Fetch trending movies
      const trendingResponse = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`
      );
      
      if (!trendingResponse.ok) {
        throw new Error('Failed to fetch from TMDB');
      }

      const trendingData = await trendingResponse.json();
      
      // Map provider IDs to platform names
      const providerMap: Record<number, string> = {
        8: 'netflix',
        337: 'disney',
        15: 'hulu',
        9: 'prime',
        384: 'max',
        387: 'peacock',
        350: 'apple',
        531: 'paramount',
      };

      // Fetch platform info for each movie and format the response
      const formattedMovies = await Promise.all(
        trendingData.results.slice(0, 10).map(async (movie: any) => {
          // Fetch watch providers for this movie
          let platform = undefined;
          try {
            const providersResponse = await fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`
            );
            if (providersResponse.ok) {
              const providersData = await providersResponse.json();
              const usProviders = providersData.results?.US;
              
              // Check flatrate (subscription) providers first
              if (usProviders?.flatrate && usProviders.flatrate.length > 0) {
                const providerId = usProviders.flatrate[0].provider_id;
                platform = providerMap[providerId];
              }
            }
          } catch (error) {
            console.error(`Failed to fetch providers for movie ${movie.id}:`, error);
          }

          return {
            id: movie.id.toString(),
            title: movie.title,
            imageUrl: movie.poster_path 
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : '',
            rating: movie.vote_average ? Math.round(movie.vote_average * 10) / 10 : undefined,
            year: movie.release_date ? new Date(movie.release_date).getFullYear().toString() : undefined,
            mediaType: 'movie',
            platform,
          };
        })
      );

      res.json(formattedMovies);
    } catch (error) {
      console.error('TMDB trending movies error:', error);
      res.status(500).json({ message: "Failed to fetch trending movies" });
    }
  });

  // Get trending TV shows from TMDB with platform info
  app.get("/api/tmdb/trending/tv", async (req, res) => {
    try {
      const TMDB_API_KEY = process.env.TMDB_API_KEY;
      if (!TMDB_API_KEY) {
        return res.status(500).json({ message: "TMDB API key not configured" });
      }

      // Fetch trending TV shows
      const trendingResponse = await fetch(
        `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`
      );
      
      if (!trendingResponse.ok) {
        throw new Error('Failed to fetch from TMDB');
      }

      const trendingData = await trendingResponse.json();
      
      // Map provider IDs to platform names
      const providerMap: Record<number, string> = {
        8: 'netflix',
        337: 'disney',
        15: 'hulu',
        9: 'prime',
        384: 'max',
        387: 'peacock',
        350: 'apple',
        531: 'paramount',
      };

      // Fetch platform info for each show and format the response
      const formattedShows = await Promise.all(
        trendingData.results.slice(0, 10).map(async (show: any) => {
          // Fetch watch providers for this show
          let platform = undefined;
          try {
            const providersResponse = await fetch(
              `https://api.themoviedb.org/3/tv/${show.id}/watch/providers?api_key=${TMDB_API_KEY}`
            );
            if (providersResponse.ok) {
              const providersData = await providersResponse.json();
              const usProviders = providersData.results?.US;
              
              // Check flatrate (subscription) providers first
              if (usProviders?.flatrate && usProviders.flatrate.length > 0) {
                const providerId = usProviders.flatrate[0].provider_id;
                platform = providerMap[providerId];
              }
            }
          } catch (error) {
            console.error(`Failed to fetch providers for show ${show.id}:`, error);
          }

          return {
            id: show.id.toString(),
            title: show.name,
            imageUrl: show.poster_path 
              ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
              : '',
            rating: show.vote_average ? Math.round(show.vote_average * 10) / 10 : undefined,
            year: show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : undefined,
            mediaType: 'tv',
            platform,
          };
        })
      );

      res.json(formattedShows);
    } catch (error) {
      console.error('TMDB trending error:', error);
      res.status(500).json({ message: "Failed to fetch trending TV shows" });
    }
  });

  // Get trending podcasts from Spotify
  app.get("/api/spotify/trending/podcasts", async (req, res) => {
    try {
      const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
      const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
      
      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({ message: "Spotify API not configured" });
      }

      // Get Spotify access token
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
        },
        body: 'grant_type=client_credentials'
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Spotify access token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Search for popular podcasts (using category-based search)
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=genre:podcast&type=show&market=US&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Failed to fetch podcasts from Spotify');
      }

      const searchData = await searchResponse.json();
      const shows = searchData.shows?.items || [];

      const formattedPodcasts = shows.map((show: any) => ({
        id: show.id,
        title: show.name,
        imageUrl: show.images && show.images.length > 0 ? show.images[0].url : '',
        rating: undefined,
        year: undefined,
        mediaType: 'podcast',
        platform: 'spotify',
        author: show.publisher,
      }));

      res.json(formattedPodcasts);
    } catch (error) {
      console.error('Spotify trending podcasts error:', error);
      res.status(500).json({ message: "Failed to fetch trending podcasts" });
    }
  });

  // Get recommended items for user (personalized based on their consumption)
  app.get("/api/recommended", async (req, res) => {
    try {
      // For now, return a mix of trending content
      // TODO: Implement actual personalization based on user's lists and preferences
      const TMDB_API_KEY = process.env.TMDB_API_KEY;
      
      if (!TMDB_API_KEY) {
        return res.json([]);
      }

      // Get a mix of popular movies and TV shows
      const moviesResponse = await fetch(
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=1`
      );
      const tvResponse = await fetch(
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&page=1`
      );

      const movies = moviesResponse.ok ? await moviesResponse.json() : { results: [] };
      const tv = tvResponse.ok ? await tvResponse.json() : { results: [] };

      // Mix and match
      const recommended = [
        ...movies.results.slice(0, 3).map((item: any) => ({
          id: `movie-${item.id}`,
          title: item.title,
          imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
          rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
          year: item.release_date ? new Date(item.release_date).getFullYear().toString() : undefined,
          mediaType: 'movie',
        })),
        ...tv.results.slice(0, 3).map((item: any) => ({
          id: `tv-${item.id}`,
          title: item.name,
          imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
          rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
          year: item.first_air_date ? new Date(item.first_air_date).getFullYear().toString() : undefined,
          mediaType: 'tv',
        })),
      ];

      // Shuffle for variety
      res.json(recommended.sort(() => Math.random() - 0.5).slice(0, 10));
    } catch (error) {
      console.error('Recommended error:', error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // All user data, lists, consumption logs, recommendations etc. are handled by Supabase Edge Functions
  // The routes above are only for proxying external APIs (TMDB, NYT, Spotify) that need server-side API keys

  // Delete pool endpoint (handles cascade deletion)
  app.post("/api/pools/delete", async (req, res) => {
    try {
      const { pool_id } = req.body;
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }
      
      if (!pool_id) {
        return res.status(400).json({ error: 'Pool ID is required' });
      }
      
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      
      const userSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '', {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: userError } = await userSupabase.auth.getUser();
      if (userError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: appUser } = await serviceSupabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (!appUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { data: pool } = await serviceSupabase
        .from('pools')
        .select('id, host_id')
        .eq('id', pool_id)
        .single();
      
      if (!pool) {
        return res.status(404).json({ error: 'Pool not found' });
      }
      
      if (pool.host_id !== appUser.id) {
        return res.status(403).json({ error: 'Only the host can delete this pool' });
      }
      
      const { data: prompts } = await serviceSupabase
        .from('pool_prompts')
        .select('id')
        .eq('pool_id', pool_id);
      
      const promptIds = prompts?.map((p: { id: string }) => p.id) || [];
      
      if (promptIds.length > 0) {
        await serviceSupabase
          .from('pool_answers')
          .delete()
          .in('prompt_id', promptIds);
      }
      
      await serviceSupabase
        .from('pool_prompts')
        .delete()
        .eq('pool_id', pool_id);
      
      await serviceSupabase
        .from('pool_members')
        .delete()
        .eq('pool_id', pool_id);
      
      const { error: deleteError } = await serviceSupabase
        .from('pools')
        .delete()
        .eq('id', pool_id);
      
      if (deleteError) {
        throw deleteError;
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete pool error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete pool' });
    }
  });

  app.post("/api/smart-search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query required" });
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI not configured" });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a media identification assistant. The user will describe a movie, TV show, book, song, album, podcast, or game — sometimes vaguely, sometimes with just a keyword and category (like "help movie"). Your job is to figure out the exact title(s) they most likely want. Prioritize titles that are currently popular, trending, in theaters, or recently released. For short queries like "help movie", think of the most popular/well-known titles matching that keyword in that category (e.g. "The Help", "Send Help"). Return a JSON array of objects with "title" and "type" (movie, tv, book, music, podcast, game). Return at most 3 results, ordered by cultural relevance (newest/trending first). Only return the JSON array, nothing else.`
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        return res.status(502).json({ error: "AI service error" });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      
      let suggestions: any[] = [];
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        suggestions = JSON.parse(cleaned);
      } catch {
        suggestions = [];
      }

      const TMDB_API_KEY = process.env.TMDB_API_KEY;
      if (TMDB_API_KEY && suggestions.length > 0) {
        const tmdbResults: any[] = [];
        await Promise.allSettled(
          suggestions.slice(0, 3).map(async (s: any) => {
            try {
              const isMovie = s.type === 'movie';
              const isTv = s.type === 'tv';
              const endpoint = isTv ? 'search/tv' : isMovie ? 'search/movie' : 'search/multi';
              const resolvedType = isTv ? 'tv' : isMovie ? 'movie' : undefined;
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 2500);
              const tmdbRes = await fetch(
                `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(s.title)}&page=1&include_adult=false`,
                { signal: controller.signal }
              );
              clearTimeout(timeout);
              if (tmdbRes.ok) {
                const tmdbData = await tmdbRes.json();
                const topResult = tmdbData.results?.[0];
                if (topResult) {
                  tmdbResults.push({
                    title: topResult.title || topResult.name,
                    type: resolvedType || topResult.media_type || s.type || 'movie',
                    external_id: topResult.id?.toString(),
                    external_source: 'tmdb',
                    poster_url: topResult.poster_path ? `https://image.tmdb.org/t/p/w300${topResult.poster_path}` : '',
                    year: (topResult.release_date || topResult.first_air_date || '').substring(0, 4) || null,
                    description: topResult.overview || '',
                    popularity: topResult.popularity || 0,
                    ai_suggested: true,
                  });
                }
              }
            } catch (err) {
              console.error('TMDB lookup error for:', s.title, err);
            }
          })
        );
        res.json({ suggestions, tmdbResults });
      } else {
        res.json({ suggestions });
      }
    } catch (error) {
      console.error("Smart search error:", error);
      res.status(500).json({ error: "Smart search failed" });
    }
  });

  app.get("/api/list-by-id/:id", async (req, res) => {
    try {
      const listId = req.params.id;
      if (!listId || !supabaseServiceKey) {
        return res.status(400).json({ error: "Missing list ID or service key" });
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: listRow, error: listError } = await adminClient
        .from('lists')
        .select('id, title, is_private, user_id')
        .eq('id', listId)
        .single();

      if (listError || !listRow) {
        return res.status(404).json({ error: "List not found" });
      }

      const { data: items, error: itemsError } = await adminClient
        .from('list_items')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: true });

      res.json({
        list: {
          ...listRow,
          isCustom: true,
          items: items || [],
        }
      });
    } catch (error) {
      console.error("List by ID error:", error);
      res.status(500).json({ error: "Failed to fetch list" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
