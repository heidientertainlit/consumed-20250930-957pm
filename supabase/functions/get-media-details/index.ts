
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

    if (!source || !externalId) {
      return new Response(JSON.stringify({ error: 'Missing source or external_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let mediaDetails = null;

    // Fetch from appropriate API based on source
    if (source === 'tmdb') {
      const tmdbKey = Deno.env.get('TMDB_API_KEY');
      
      // Use media_type if provided, otherwise try movie first then TV
      let response;
      if (mediaType === 'tv') {
        response = await fetch(
          `https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`
        );
      } else if (mediaType === 'movie') {
        response = await fetch(
          `https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`
        );
      } else {
        // Fallback: try movie first, then TV
        response = await fetch(
          `https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`
        );
        
        if (!response.ok) {
          response = await fetch(
            `https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbKey}&append_to_response=credits,videos,watch/providers`
          );
        }
      }

      if (response.ok) {
        const data = await response.json();
        const isMovie = !!data.title;
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
            url: data['watch/providers']?.results?.US?.link || '#'
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
      const response = await fetch(`https://openlibrary.org/works/${externalId}.json`);
      
      if (response.ok) {
        const data = await response.json();
        const authorResponse = await fetch(`https://openlibrary.org${data.authors?.[0]?.author?.key}.json`);
        const authorData = authorResponse.ok ? await authorResponse.json() : null;

        mediaDetails = {
          title: data.title,
          type: 'Book',
          creator: authorData?.name || 'Unknown Author',
          artwork: data.covers?.[0] ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : null,
          description: typeof data.description === 'string' ? data.description : data.description?.value || 'No description available.',
          rating: '4.2',
          releaseDate: data.first_publish_date,
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
              url: `https://openlibrary.org/works/${externalId}`
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
