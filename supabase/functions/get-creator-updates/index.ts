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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    for (const creator of followedCreators) {
      try {
        if (creator.external_source === 'tmdb') {
          const tmdbKey = Deno.env.get('TMDB_API_KEY');
          if (tmdbKey) {
            const creditsResponse = await fetch(
              `https://api.themoviedb.org/3/person/${creator.external_id}/combined_credits?api_key=${tmdbKey}`
            );

            if (creditsResponse.ok) {
              const creditsData = await creditsResponse.json();
              
              const twoYearsAgo = new Date();
              twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
              const today = new Date();
              
              // Function to get role-filtered works
              const getRoleFilteredWorks = () => {
                if (creator.creator_role === 'Director') {
                  return (creditsData.crew || []).filter((work: any) => 
                    work.job === 'Director'
                  );
                } else if (creator.creator_role === 'Writer') {
                  return (creditsData.crew || []).filter((work: any) => 
                    work.department === 'Writing' || work.job === 'Screenplay' || work.job === 'Writer'
                  );
                } else if (creator.creator_role === 'Producer') {
                  return (creditsData.crew || []).filter((work: any) => 
                    work.job === 'Producer' || work.job === 'Executive Producer'
                  );
                } else {
                  return creditsData.cast || [];
                }
              };
              
              const allRoleWorks = getRoleFilteredWorks();
              
              let worksToShow: any[] = [];
              
              // Try to find recent releases (past 2 years, already released)
              const recentReleases = allRoleWorks
                .filter((work: any) => {
                  const releaseDate = work.release_date || work.first_air_date;
                  if (!releaseDate) return false;
                  const workDate = new Date(releaseDate);
                  return workDate >= twoYearsAgo && workDate <= today;
                })
                .sort((a: any, b: any) => {
                  const dateA = a.release_date || a.first_air_date || '';
                  const dateB = b.release_date || b.first_air_date || '';
                  return dateB.localeCompare(dateA);
                })
                .slice(0, 3);

              if (recentReleases.length > 0) {
                worksToShow = recentReleases;
              } else {
                // No recent releases - show most popular classic works (still role-filtered)
                worksToShow = allRoleWorks
                  .filter((work: any) => {
                    const releaseDate = work.release_date || work.first_air_date;
                    if (!releaseDate) return false;
                    const workDate = new Date(releaseDate);
                    return workDate <= today;
                  })
                  .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
                  .slice(0, 3);
              }

              worksToShow.forEach((work: any) => {
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
                  overview: work.overview,
                  is_classic: recentReleases.length === 0
                });
              });
            }
          }
        } else if (creator.external_source === 'spotify') {
          const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
          const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
          
          if (clientId && clientSecret) {
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
              
              const albumsResponse = await fetch(
                `https://api.spotify.com/v1/artists/${creator.external_id}/albums?include_groups=album,single&market=US&limit=50`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`
                  }
                }
              );
              
              if (albumsResponse.ok) {
                const albumsData = await albumsResponse.json();
                const twoYearsAgo = new Date();
                twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                const today = new Date();
                
                let albumsToShow: any[] = [];
                
                const recentAlbums = (albumsData.items || [])
                  .filter((album: any) => {
                    if (!album.release_date) return false;
                    const albumDate = new Date(album.release_date);
                    return albumDate >= twoYearsAgo && albumDate <= today;
                  })
                  .sort((a: any, b: any) => b.release_date.localeCompare(a.release_date))
                  .slice(0, 3);

                if (recentAlbums.length > 0) {
                  albumsToShow = recentAlbums;
                } else {
                  albumsToShow = (albumsData.items || [])
                    .filter((album: any) => {
                      if (!album.release_date) return false;
                      const albumDate = new Date(album.release_date);
                      return albumDate <= today && album.album_type === 'album';
                    })
                    .sort((a: any, b: any) => b.release_date.localeCompare(a.release_date))
                    .slice(0, 3);
                }

                albumsToShow.forEach((album: any) => {
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
                    overview: `${album.total_tracks} tracks`,
                    is_classic: recentAlbums.length === 0
                  });
                });
              }
            }
          }
        } else if (creator.external_source === 'googlebooks') {
          const googleBooksKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
          const authorQuery = `inauthor:"${encodeURIComponent(creator.creator_name)}"`;
          const booksUrl = googleBooksKey 
            ? `https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&orderBy=newest&maxResults=20&key=${googleBooksKey}`
            : `https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&orderBy=newest&maxResults=20`;
          
          const booksResponse = await fetch(booksUrl);
          
          if (booksResponse.ok) {
            const booksData = await booksResponse.json();
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            const today = new Date();
            
            let booksToShow: any[] = [];
            
            const recentBooks = (booksData.items || [])
              .filter((book: any) => {
                const publishedDate = book.volumeInfo?.publishedDate;
                if (!publishedDate) return false;
                const bookDate = new Date(publishedDate);
                return bookDate >= twoYearsAgo && bookDate <= today;
              })
              .slice(0, 3);

            if (recentBooks.length > 0) {
              booksToShow = recentBooks;
            } else {
              booksToShow = (booksData.items || [])
                .filter((book: any) => {
                  const publishedDate = book.volumeInfo?.publishedDate;
                  if (!publishedDate) return false;
                  const bookDate = new Date(publishedDate);
                  return bookDate <= today;
                })
                .slice(0, 3);
            }

            booksToShow.forEach((book: any) => {
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
                overview: volumeInfo.description?.substring(0, 200) || '',
                is_classic: recentBooks.length === 0
              });
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching updates for creator ${creator.creator_name}:`, error);
      }
    }

    updates.sort((a, b) => {
      const dateA = a.release_date || '';
      const dateB = b.release_date || '';
      return dateB.localeCompare(dateA);
    });

    return new Response(JSON.stringify({ updates }), {
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
