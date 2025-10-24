import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pollsDb } from "./polls-db";
// Removed unnecessary imports - simplified for minimal backend

export async function registerRoutes(app: Express): Promise<Server> {

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

  // Get user
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });


  // Get user's consumption logs
  app.get("/api/users/:userId/consumption", async (req, res) => {
    try {
      const logs = await storage.getConsumptionLogs(req.params.userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch consumption logs" });
    }
  });

  // Removed: Create consumption log - Now handled by Supabase track-media edge function

  // Get user's consumption stats
  app.get("/api/users/:userId/consumption/stats", async (req, res) => {
    try {
      const stats = await storage.getUserConsumptionStats(req.params.userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch consumption stats" });
    }
  });

  // Removed: Get activity feed - Not used by frontend

  // Get personalized recommendations
  app.get("/api/users/:userId/recommendations", async (req, res) => {
    try {
      const logs = await storage.getConsumptionLogs(req.params.userId);
      
      // For now, return curated recommendations based on consumption history
      // TODO: Re-enable AI recommendations when OpenAI API is stable
      const recommendations = logs.length === 0 ? [
        {
          id: "rec-1",
          title: "The Bear",
          category: "tv",
          description: "A young chef from the fine dining world returns to Chicago to run his family's sandwich shop.",
          reason: "Popular comedy-drama that's perfect for getting started"
        },
        {
          id: "rec-2",
          title: "Dune",
          category: "books",
          description: "Epic science fiction novel about politics, religion, and power on a desert planet.",
          reason: "Essential sci-fi reading that's influenced countless other works"
        },
        {
          id: "rec-3",
          title: "Everything Everywhere All at Once",
          category: "movies",
          description: "A multiverse adventure about family, identity, and everything bagels.",
          reason: "Award-winning film that blends humor with profound themes"
        }
      ] : [
        {
          id: "rec-4",
          title: "House of the Dragon",
          category: "tv", 
          description: "Prequel to Game of Thrones following the Targaryen civil war.",
          reason: "Based on your viewing history, you might enjoy this epic fantasy series"
        },
        {
          id: "rec-5",
          title: "Project Hail Mary",
          category: "books",
          description: "A lone astronaut must save humanity in this sci-fi thriller.",
          reason: "Perfect follow-up to your recent reading preferences"
        },
        {
          id: "rec-6",
          title: "The Banshees of Inisherin",
          category: "movies",
          description: "Dark comedy about friendship on a remote Irish island.",
          reason: "Matches your taste for character-driven stories"
        }
      ];
      
      return res.json(recommendations);
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Removed: Get Entertainment DNA survey questions - Not used by frontend


  // Temporary route to return correct lists until Supabase edge function is deployed
  app.get("/api/user-lists-with-media", async (req, res) => {
    try {
      // Return the correct 4 standard lists structure that matches Supabase
      const listsData = {
        lists: [
          {
            id: 'all',
            title: 'All',
            description: 'All tracked media items',
            items: []
          },
          {
            id: 'currently',
            title: 'Currently',
            description: 'What you\'re consuming right now',
            items: []
          },
          {
            id: 'queue',
            title: 'Queue',
            description: 'Media you want to consume later',
            items: []
          },
          {
            id: 'finished',
            title: 'Finished',
            description: 'Media you\'ve completed',
            items: []
          },
          {
            id: 'dnf',
            title: 'Did Not Finish',
            description: 'Media you started but didn\'t complete',
            items: []
          }
        ]
      };
      res.json(listsData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user lists" });
    }
  });

  // Polls API endpoints
  
  // Get active polls
  app.get("/api/polls", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const polls = await pollsDb.getActivePolls(userId);
      res.json(polls);
    } catch (error) {
      console.error('Fetch polls error:', error);
      res.status(500).json({ message: "Failed to fetch polls" });
    }
  });

  // Submit a vote for a poll
  app.post("/api/polls/:pollId/vote", async (req, res) => {
    try {
      const { pollId } = req.params;
      const { optionId, userId } = req.body;

      if (!optionId || !userId) {
        return res.status(400).json({ message: "optionId and userId are required" });
      }

      // Verify that the option belongs to this poll
      const optionValid = await pollsDb.verifyOptionBelongsToPoll(parseInt(optionId), parseInt(pollId));
      if (!optionValid) {
        return res.status(400).json({ message: "Invalid option for this poll" });
      }

      // Check if user already voted
      const existingVote = await pollsDb.getUserPollResponse(parseInt(pollId), userId);
      if (existingVote) {
        return res.status(400).json({ message: "You have already voted in this poll" });
      }

      // Submit the vote
      await pollsDb.createPollResponse({
        pollId: parseInt(pollId),
        optionId: parseInt(optionId),
        userId
      });

      // Award points for poll participation
      const poll = await pollsDb.getPollWithResults(parseInt(pollId));
      const pointsToAward = poll.points_reward || 5;
      
      // TODO: Update user points in Supabase (for now, just return success)
      // Points will be tracked via poll_responses table
      
      res.json({ ...poll, pointsAwarded: pointsToAward });
    } catch (error) {
      console.error('Vote submission error:', error);
      res.status(500).json({ message: "Failed to submit vote" });
    }
  });

  // Create a new poll (admin only)
  app.post("/api/polls", async (req, res) => {
    try {
      // TODO: Add proper admin authentication check
      // For now, this endpoint should only be called by admin users
      // Consider using req.headers.authorization to verify admin status
      const { question, type, sponsorName, sponsorLogoUrl, sponsorCtaUrl, pointsReward, expiresAt, options } = req.body;

      if (!question || !type || !options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ message: "Invalid poll data. Question, type, and at least 2 options are required" });
      }

      const pollId = await pollsDb.createPoll({
        question,
        type,
        sponsorName: sponsorName || null,
        sponsorLogoUrl: sponsorLogoUrl || null,
        sponsorCtaUrl: sponsorCtaUrl || null,
        status: 'active',
        pointsReward: pointsReward || 5,
        expiresAt: expiresAt || null,
        createdBy: null
      }, options);

      const poll = await pollsDb.getPollWithResults(pollId);
      res.json(poll);
    } catch (error) {
      console.error('Create poll error:', error);
      res.status(500).json({ message: "Failed to create poll" });
    }
  });

  // Update poll status (admin only)
  app.patch("/api/polls/:pollId", async (req, res) => {
    try {
      // TODO: Add proper admin authentication check
      // For now, this endpoint should only be called by admin users
      // Consider using req.headers.authorization to verify admin status
      const { pollId } = req.params;
      const { status } = req.body;

      if (!status || !['draft', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'draft', 'active', or 'archived'" });
      }

      await pollsDb.updatePollStatus(parseInt(pollId), status);
      const poll = await pollsDb.getPollWithResults(parseInt(pollId));
      
      res.json(poll);
    } catch (error) {
      console.error('Update poll error:', error);
      res.status(500).json({ message: "Failed to update poll" });
    }
  });

  // Proxy to Supabase social-feed edge function
  app.get("/api/social-feed", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/social-feed`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Social feed error:', response.status, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Social feed proxy error:', error);
      res.status(500).json({ error: "Failed to fetch social feed" });
    }
  });

  // Proxy to Supabase recommendations edge function
  app.get("/api/media-recommendations", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-media-recommendations`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Recommendations error:', response.status, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Recommendations proxy error:', error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
