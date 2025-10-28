import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLIXPATROL_API_KEY = Deno.env.get('FLIXPATROL_API_KEY');
    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
    
    if (!FLIXPATROL_API_KEY) {
      throw new Error('FLIXPATROL_API_KEY not configured');
    }

    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY not configured');
    }

    // FlixPatrol company and country codes
    const NETFLIX_ID = 'cmp_IA6TdMqwf6kuyQvxo9bJ4nKX';
    // US country code - will find this dynamically
    
    // First, get the US country code by querying countries endpoint
    console.log('Fetching US country code...');
    const countriesResponse = await fetch('https://api.flixpatrol.com/v2/countries', {
      headers: {
        'Authorization': `Basic ${btoa(`${FLIXPATROL_API_KEY}:`)}`,
      },
    });

    if (!countriesResponse.ok) {
      throw new Error(`Failed to fetch countries: ${countriesResponse.status}`);
    }

    const countries = await countriesResponse.json();
    const usCountry = countries.find((c: any) => c.code === 'US');
    
    if (!usCountry) {
      throw new Error('US country code not found');
    }

    const US_ID = usCountry.id;
    console.log('US country ID:', US_ID);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Fetch Netflix US top 10 TV shows for today
    console.log('Fetching Netflix US top 10 TV shows...');
    const top10Url = new URL('https://api.flixpatrol.com/v2/top10s');
    top10Url.searchParams.append('company[eq]', NETFLIX_ID);
    top10Url.searchParams.append('country[eq]', US_ID);
    top10Url.searchParams.append('type[eq]', '3'); // 3 = TV Shows
    top10Url.searchParams.append('date[from]', today);
    top10Url.searchParams.append('date[to]', today);
    top10Url.searchParams.append('ranking[lte]', '20'); // Top 20

    const top10Response = await fetch(top10Url.toString(), {
      headers: {
        'Authorization': `Basic ${btoa(`${FLIXPATROL_API_KEY}:`)}`,
      },
    });

    if (!top10Response.ok) {
      throw new Error(`Failed to fetch top 10: ${top10Response.status} ${await top10Response.text()}`);
    }

    const top10Data = await top10Response.json();
    console.log(`Found ${top10Data.length} titles in Netflix US top 10`);

    // For each title, we need to:
    // 1. Get the full title info from FlixPatrol (to get TMDB ID)
    // 2. Fetch poster image from TMDB

    const enrichedTitles = await Promise.all(
      top10Data.map(async (item: any) => {
        try {
          // Fetch title details from FlixPatrol
          const titleResponse = await fetch(`https://api.flixpatrol.com/v2/titles/${item.movie}`, {
            headers: {
              'Authorization': `Basic ${btoa(`${FLIXPATROL_API_KEY}:`)}`,
            },
          });

          if (!titleResponse.ok) {
            console.error(`Failed to fetch title ${item.movie}`);
            return null;
          }

          const titleData = await titleResponse.json();
          
          // Extract TMDB ID from title data
          const tmdbId = titleData.tmdb?.id || titleData.imdb; // Fallback to IMDb if no TMDB
          
          if (!tmdbId) {
            console.error(`No TMDB ID found for title ${item.movie}`);
            return null;
          }

          // Fetch poster from TMDB
          const tmdbResponse = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`
          );

          let posterPath = null;
          let title = titleData.name || 'Unknown Title';
          let year = null;

          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json();
            posterPath = tmdbData.poster_path 
              ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`
              : null;
            title = tmdbData.name || title;
            year = tmdbData.first_air_date?.split('-')[0];
          }

          return {
            id: tmdbId,
            title,
            year,
            imageUrl: posterPath,
            mediaType: 'tv',
            ranking: item.ranking,
            externalId: tmdbId,
            externalSource: 'tmdb',
          };
        } catch (error) {
          console.error(`Error enriching title ${item.movie}:`, error);
          return null;
        }
      })
    );

    // Filter out nulls and sort by ranking
    const finalTitles = enrichedTitles
      .filter(t => t !== null)
      .sort((a, b) => a.ranking - b.ranking);

    console.log(`Successfully enriched ${finalTitles.length} titles`);

    return new Response(JSON.stringify(finalTitles), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-flixpatrol-top10:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
