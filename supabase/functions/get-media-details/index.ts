
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');
    const externalId = searchParams.get('external_id');
    const mediaType = searchParams.get('media_type'); // Get media type from params
    const seasonNumber = searchParams.get('season'); // Optional: fetch specific season episodes

    if (!source || !externalId) {
      return new Response(JSON.stringify({ error: 'Missing source or external_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let mediaDetails = null;

    console.log('Request params:', { source, externalId, mediaType, seasonNumber });

    // Fetch from appropriate API based on source
    if (source === 'tmdb') {
      const tmdbKey = Deno.env.get('TMDB_API_KEY');
      console.log('TMDB_API_KEY present:', !!tmdbKey);
      
      if (!tmdbKey) {
        console.error('TMDB_API_KEY is not set!');
        return new Response(JSON.stringify({ error: 'TMDB API key not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Use media_type if provided, otherwise try movie first then TV
      let response;
      let apiUrl;
      if (mediaType === 'tv') {
        apiUrl = `https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`;
        console.log('Fetching TV show:', externalId);
        response = await fetch(apiUrl);
      } else if (mediaType === 'movie') {
        apiUrl = `https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`;
        console.log('Fetching movie:', externalId);
        response = await fetch(apiUrl);
      } else {
        // Fallback: try movie first, then TV
        apiUrl = `https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`;
        console.log('Fallback - trying movie first:', externalId);
        response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.log('Movie not found, trying TV');
          apiUrl = `https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`;
          response = await fetch(apiUrl);
        }
      }

      console.log('TMDB response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const isMovie = !!data.title;
        
        // If it's a TV show and we want a specific season's episodes
        let episodes = null;
        if (!isMovie && seasonNumber) {
          const seasonResponse = await fetch(
            `https://api.themoviedb.org/3/tv/${externalId}/season/${seasonNumber}?api_key=${tmdbKey}`
          );
          if (seasonResponse.ok) {
            const seasonData = await seasonResponse.json();
            episodes = seasonData.episodes?.map((ep: any) => ({
              id: ep.id,
              episodeNumber: ep.episode_number,
              name: ep.name,
              overview: ep.overview,
              airDate: ep.air_date,
              stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
              runtime: ep.runtime
            })) || [];
          }
        }
        
        mediaDetails = {
          title: data.title || data.name,
          type: isMovie ? 'Movie' : 'TV Show',
          creator: data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || 
                   data.created_by?.[0]?.name || 'Unknown',
          artwork: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
          description: data.overview || 'No description available.',
          rating: data.vote_average ? (data.vote_average / 2).toFixed(1) : '0',
          releaseDate: data.release_date || data.first_air_date,
          runtime: data.runtime || data.episode_run_time?.[0],
          category: data.genres?.[0]?.name || 'Unknown',
          language: 'English',
          totalEpisodes: data.number_of_episodes || (isMovie ? 1 : 0),
          totalSeasons: data.number_of_seasons || 0,
          seasons: !isMovie ? data.seasons?.filter((s: any) => s.season_number > 0).map((s: any) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            poster: s.poster_path ? `https://image.tmdb.org/t/p/w185${s.poster_path}` : null
          })) : null,
          episodes: episodes,
          subscribers: data.popularity ? `${Math.floor(data.popularity)}K` : '0',
          averageLength: `${data.runtime || data.episode_run_time?.[0] || 45} min`,
          genres: data.genres?.map((g: any) => g.name) || [],
          cast: data.credits?.cast?.slice(0, 10).map((c: any) => ({
            name: c.name,
            character: c.character,
            profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
          })) || [],
          platforms: data['watch/providers']?.results?.US?.flatrate?.map((p: any) => ({
            name: p.provider_name,
            logo: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
            url: null
          })) || [],
          trailer: data.videos?.results?.find((v: any) => v.type === 'Trailer')?.key
        };
      }
    } else if (source === 'spotify') {
      const spotifyToken = await getSpotifyToken();
      
      // Could be track, album, or show
      let response = await fetch(`https://api.spotify.com/v1/tracks/${externalId}`, {
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });

      if (!response.ok) {
        response = await fetch(`https://api.spotify.com/v1/albums/${externalId}`, {
          headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
      }

      if (!response.ok) {
        response = await fetch(`https://api.spotify.com/v1/shows/${externalId}`, {
          headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
      }

      if (response.ok) {
        const data = await response.json();
        const isPodcast = data.type === 'show';
        
        // Build platforms array for Spotify content
        const platforms = [
          {
            name: 'Spotify',
            logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/168px-Spotify_logo_without_text.svg.png',
            url: data.external_urls?.spotify
          }
        ];
        
        // Add common podcast platforms if it's a podcast
        if (isPodcast) {
          platforms.push(
            {
              name: 'Apple Podcasts',
              logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Podcasts_%28iOS%29.svg/170px-Podcasts_%28iOS%29.svg.png',
              url: `https://podcasts.apple.com/search?term=${encodeURIComponent(data.name)}`
            },
            {
              name: 'Google Podcasts',
              logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Google_Podcasts_icon.svg/170px-Google_Podcasts_icon.svg.png',
              url: `https://podcasts.google.com/search/${encodeURIComponent(data.name)}`
            }
          );
        }
        
        mediaDetails = {
          title: data.name,
          type: isPodcast ? 'Podcast' : 'Music',
          creator: data.artists?.[0]?.name || data.publisher || 'Unknown',
          artwork: data.images?.[0]?.url || data.album?.images?.[0]?.url,
          description: data.description || 'No description available.',
          rating: '4.5',
          releaseDate: data.release_date,
          category: data.genres?.[0] || (isPodcast ? 'Podcast' : 'Music'),
          language: 'English',
          totalEpisodes: data.total_episodes || 0,
          subscribers: data.total_tracks ? `${data.total_tracks} tracks` : '0',
          averageLength: data.duration_ms ? `${Math.floor(data.duration_ms / 60000)} min` : '45 min',
          externalUrl: data.external_urls?.spotify,
          platforms
        };
      }
    } else if (source === 'youtube') {
      const youtubeKey = Deno.env.get('YOUTUBE_API_KEY');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${externalId}&part=snippet,contentDetails,statistics&key=${youtubeKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const video = data.items?.[0];
        
        if (video) {
          mediaDetails = {
            title: video.snippet.title,
            type: 'YouTube',
            creator: video.snippet.channelTitle,
            artwork: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
            description: video.snippet.description || 'No description available.',
            rating: '4.0',
            releaseDate: video.snippet.publishedAt,
            category: 'Video',
            language: 'English',
            totalEpisodes: 0,
            subscribers: video.statistics?.viewCount ? `${Math.floor(video.statistics.viewCount / 1000)}K views` : '0',
            averageLength: 'N/A',
            platforms: [
              {
                name: 'YouTube',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/159px-YouTube_full-color_icon_%282017%29.svg.png',
                url: `https://www.youtube.com/watch?v=${externalId}`
              }
            ]
          };
        }
      }
    } else if (source === 'openlibrary') {
      let response;
      let data;
      
      // Check if externalId is an ISBN (all digits and hyphens)
      const isISBN = /^[\d-]+$/.test(externalId);
      
      // Strip 'works/' prefix if already present (some IDs come as 'works/OL123')
      const cleanId = externalId.replace(/^works\//, '');
      
      if (isISBN) {
        // Lookup by ISBN first to get the work ID
        response = await fetch(`https://openlibrary.org/isbn/${externalId}.json`);
        
        if (response.ok) {
          const bookData = await response.json();
          // Get the work details using the work key
          if (bookData.works?.[0]?.key) {
            const workId = bookData.works[0].key.replace('/works/', '');
            const workResponse = await fetch(`https://openlibrary.org/works/${workId}.json`);
            if (workResponse.ok) {
              data = await workResponse.json();
              data.isbn = externalId; // Store ISBN for later use
            }
          } else {
            // Fallback: use the book edition data directly
            data = bookData;
            data.first_publish_date = bookData.publish_date;
            data.subjects = bookData.subjects || [];
          }
        }
      } else {
        // Standard work ID lookup - use cleanId to avoid double 'works/' prefix
        response = await fetch(`https://openlibrary.org/works/${cleanId}.json`);
        if (response.ok) {
          data = await response.json();
        }
      }
      
      if (data) {
        const authorResponse = await fetch(`https://openlibrary.org${data.authors?.[0]?.author?.key || data.authors?.[0]?.key}.json`);
        const authorData = authorResponse.ok ? await authorResponse.json() : null;

        // Get cover image - prefer ISBN-based lookup for better quality
        let coverUrl = null;
        if (data.isbn || isISBN) {
          coverUrl = `https://covers.openlibrary.org/b/isbn/${data.isbn || externalId}-L.jpg`;
        } else if (data.covers?.[0]) {
          coverUrl = `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`;
        }

        mediaDetails = {
          title: data.title,
          type: 'Book',
          creator: authorData?.name || data.by_statement || 'Unknown Author',
          artwork: coverUrl,
          description: typeof data.description === 'string' ? data.description : data.description?.value || 'No description available.',
          rating: '4.2',
          releaseDate: data.first_publish_date || data.publish_date,
          category: data.subjects?.[0] || 'Fiction',
          language: 'English',
          totalEpisodes: 0,
          subscribers: '0',
          averageLength: 'N/A',
          subjects: data.subjects?.slice(0, 5) || [],
          platforms: [
            {
              name: 'Amazon',
              logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/200px-Amazon_logo.svg.png',
              url: `https://www.amazon.com/s?k=${encodeURIComponent(data.title)}`
            },
            {
              name: 'Goodreads',
              logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Goodreads_logo.svg/200px-Goodreads_logo.svg.png',
              url: `https://www.goodreads.com/search?q=${encodeURIComponent(data.title)}`
            },
            {
              name: 'Open Library',
              logo: 'https://openlibrary.org/static/images/openlibrary-logo-tighter.svg',
              url: isISBN ? `https://openlibrary.org/isbn/${externalId}` : `https://openlibrary.org/works/${externalId}`
            }
          ]
        };
      }
    }

    if (!mediaDetails) {
      return new Response(JSON.stringify({ error: 'Media not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(mediaDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get media details error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function getSpotifyToken() {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}
