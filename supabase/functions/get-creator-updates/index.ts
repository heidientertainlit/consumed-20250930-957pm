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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch user's followed creators
    const { data: followedCreators, error: followError } = await supabase
      .from('followed_creators')
      .select('*')
      .eq('user_id', user.id);

    if (followError) {
      console.error('Error fetching followed creators:', followError);
      return new Response(JSON.stringify({ error: 'Failed to fetch followed creators' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!followedCreators || followedCreators.length === 0) {
      return new Response(JSON.stringify({ updates: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updates: any[] = [];

    // Process each followed creator
    for (const creator of followedCreators) {
      try {
        if (creator.external_source === 'tmdb') {
          // Fetch latest movies/TV shows from TMDB person
          const tmdbKey = Deno.env.get('TMDB_API_KEY');
          if (tmdbKey) {
            const creditsResponse = await fetch(
              `https://api.themoviedb.org/3/person/${creator.external_id}/combined_credits?api_key=${tmdbKey}`
            );

            if (creditsResponse.ok) {
              const creditsData = await creditsResponse.json();
              
              // Get the correct work based on creator role
              let recentWorks: any[] = [];
              
              if (creator.creator_role === 'Director') {
                // For directors, use crew and filter for directing jobs
                recentWorks = (creditsData.crew || []).filter((work: any) => 
                  work.job === 'Director'
                );
              } else if (creator.creator_role === 'Writer') {
                // For writers, use crew and filter for writing jobs
                recentWorks = (creditsData.crew || []).filter((work: any) => 
                  work.department === 'Writing' || work.job === 'Screenplay' || work.job === 'Writer'
                );
              } else if (creator.creator_role === 'Producer') {
                // For producers, use crew and filter for producing jobs
                recentWorks = (creditsData.crew || []).filter((work: any) => 
                  work.job === 'Producer' || work.job === 'Executive Producer'
                );
              } else {
                // For actors or other roles, use cast
                recentWorks = creditsData.cast || [];
              }
              
              // Get works from the last 2 years
              const twoYearsAgo = new Date();
              twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
              
              const recentReleases = recentWorks
                .filter((work: any) => {
                  const releaseDate = work.release_date || work.first_air_date;
                  if (!releaseDate) return false;
                  return new Date(releaseDate) >= twoYearsAgo;
                })
                .sort((a: any, b: any) => {
                  const dateA = a.release_date || a.first_air_date || '';
                  const dateB = b.release_date || b.first_air_date || '';
                  return dateB.localeCompare(dateA);
                })
                .slice(0, 3); // Top 3 recent works

              recentReleases.forEach((work: any) => {
                updates.push({
                  creator_name: creator.creator_name,
                  creator_role: creator.creator_role,
                  creator_image: creator.creator_image,
                  title: work.title || work.name,
                  type: work.media_type,
                  release_date: work.release_date || work.first_air_date,
                  image: work.poster_path 
                    ? `https://image.tmdb.org/t/p/w500${work.poster_path}` 
                    : null,
                  external_id: work.id.toString(),
                  external_source: 'tmdb',
                  overview: work.overview
                });
              });
            }
          }
        } else if (creator.external_source === 'spotify') {
          // Fetch latest albums from Spotify artist
          const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
          const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
          
          if (clientId && clientSecret) {
            // Get access token
            const authResponse = await fetch('https://accounts.spotify.com/api/token', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: 'grant_type=client_credentials'
            });
            
            if (authResponse.ok) {
              const authData = await authResponse.json();
              const accessToken = authData.access_token;
              
              // Fetch artist's albums
              const albumsResponse = await fetch(
                `https://api.spotify.com/v1/artists/${creator.external_id}/albums?include_groups=album,single&market=US&limit=10`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`
                  }
                }
              );
              
              if (albumsResponse.ok) {
                const albumsData = await albumsResponse.json();
                
                // Get albums from the last 2 years
                const twoYearsAgo = new Date();
                twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                
                const recentAlbums = (albumsData.items || [])
                  .filter((album: any) => {
                    if (!album.release_date) return false;
                    return new Date(album.release_date) >= twoYearsAgo;
                  })
                  .sort((a: any, b: any) => b.release_date.localeCompare(a.release_date))
                  .slice(0, 3); // Top 3 recent albums

                recentAlbums.forEach((album: any) => {
                  updates.push({
                    creator_name: creator.creator_name,
                    creator_role: creator.creator_role,
                    creator_image: creator.creator_image,
                    title: album.name,
                    type: album.album_type,
                    release_date: album.release_date,
                    image: album.images?.[0]?.url || null,
                    external_id: album.id,
                    external_source: 'spotify',
                    overview: `${album.total_tracks} tracks`
                  });
                });
              }
            }
          }
        } else if (creator.external_source === 'googlebooks') {
          // Fetch latest books from Google Books author
          const googleBooksKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
          const authorQuery = `inauthor:"${encodeURIComponent(creator.creator_name)}"`;
          const booksUrl = googleBooksKey 
            ? `https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&orderBy=newest&maxResults=5&key=${googleBooksKey}`
            : `https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&orderBy=newest&maxResults=5`;
          
          const booksResponse = await fetch(booksUrl);
          
          if (booksResponse.ok) {
            const booksData = await booksResponse.json();
            
            // Get books from the last 2 years
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            
            const recentBooks = (booksData.items || [])
              .filter((book: any) => {
                const publishedDate = book.volumeInfo?.publishedDate;
                if (!publishedDate) return false;
                return new Date(publishedDate) >= twoYearsAgo;
              })
              .slice(0, 3); // Top 3 recent books

            recentBooks.forEach((book: any) => {
              const volumeInfo = book.volumeInfo || {};
              updates.push({
                creator_name: creator.creator_name,
                creator_role: creator.creator_role,
                creator_image: creator.creator_image,
                title: volumeInfo.title,
                type: 'book',
                release_date: volumeInfo.publishedDate,
                image: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
                external_id: book.id,
                external_source: 'googlebooks',
                overview: volumeInfo.description?.substring(0, 200) || ''
              });
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching updates for creator ${creator.creator_name}:`, error);
        // Continue processing other creators even if one fails
      }
    }

    // Sort all updates by release date (most recent first)
    updates.sort((a, b) => {
      const dateA = a.release_date || '';
      const dateB = b.release_date || '';
      return dateB.localeCompare(dateA);
    });

    // Fetch news articles for followed creators
    const newsArticles: any[] = [];
    const newsApiKey = Deno.env.get('NEWS_API_KEY');
    
    if (newsApiKey && followedCreators.length > 0) {
      // Limit to first 5 creators to avoid hitting API limits
      const creatorsForNews = followedCreators.slice(0, 5);
      
      for (const creator of creatorsForNews) {
        try {
          // Search for news about this creator
          const query = encodeURIComponent(creator.creator_name);
          const newsUrl = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&language=en&pageSize=2&apiKey=${newsApiKey}`;
          
          const newsResponse = await fetch(newsUrl);
          
          if (newsResponse.ok) {
            const newsData = await newsResponse.json();
            
            if (newsData.articles && newsData.articles.length > 0) {
              // Get articles from the last 30 days
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              
              const recentArticles = newsData.articles
                .filter((article: any) => {
                  if (!article.publishedAt) return false;
                  return new Date(article.publishedAt) >= thirtyDaysAgo;
                })
                .slice(0, 2); // Max 2 articles per creator
              
              recentArticles.forEach((article: any) => {
                newsArticles.push({
                  creator_name: creator.creator_name,
                  title: article.title,
                  description: article.description,
                  url: article.url,
                  urlToImage: article.urlToImage,
                  publishedAt: article.publishedAt,
                  source: article.source
                });
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching news for creator ${creator.creator_name}:`, error);
          // Continue processing other creators even if one fails
        }
      }
    }

    // Sort news by published date (most recent first)
    newsArticles.sort((a, b) => {
      const dateA = a.publishedAt || '';
      const dateB = b.publishedAt || '';
      return dateB.localeCompare(dateA);
    });

    return new Response(JSON.stringify({ updates, news: newsArticles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get-creator-updates:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
