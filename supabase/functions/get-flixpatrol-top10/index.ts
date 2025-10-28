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

    // Platform and country IDs
    const platforms = [
      { id: 'cmp_IA6TdMqwf6kuyQvxo9bJ4nKX', name: 'Netflix' },
      { id: 'cmp_oGtsgdpOrjIu3XzTEnWPt87Y', name: 'Disney+' },
      { id: 'cmp_6UhCvnTeRkgZUtcNGslX9bJL', name: 'HBO Max' },
      { id: 'cmp_qypvowjqFhEIpCc0HlQ6VoYk', name: 'Amazon Prime' },
      { id: 'cmp_9iwHIMYOCvD6zprSPoHgTJau', name: 'Hulu' },
    ];
    
    const US_COUNTRY_ID = 'cnt_RpYbGi0mzOncND8jVoZ2HSTv';
    const today = new Date().toISOString().split('T')[0];

    console.log(`Fetching top 10s from ${platforms.length} platforms for ${today}`);

    // Fetch from all platforms in parallel
    const allResults = await Promise.all(
      platforms.map(async (platform) => {
        try {
          const top10Url = new URL('https://api.flixpatrol.com/v2/top10s');
          top10Url.searchParams.append('company[eq]', platform.id);
          top10Url.searchParams.append('country[eq]', US_COUNTRY_ID);
          top10Url.searchParams.append('type[eq]', '3'); // 3 = TV Shows
          top10Url.searchParams.append('date[from]', today);
          top10Url.searchParams.append('date[to]', today);
          top10Url.searchParams.append('ranking[lte]', '10'); // Top 10 per platform

          const response = await fetch(top10Url.toString(), {
            headers: {
              'Authorization': `Basic ${btoa(`${FLIXPATROL_API_KEY}:`)}`,
            },
          });

          if (!response.ok) {
            console.error(`Failed to fetch ${platform.name} top 10: ${response.status}`);
            return [];
          }

          const data = await response.json();
          console.log(`${platform.name}: Found ${data.length} titles`);
          
          return data.map((item: any) => ({
            ...item,
            platformName: platform.name,
          }));
        } catch (error) {
          console.error(`Error fetching ${platform.name}:`, error);
          return [];
        }
      })
    );

    // Flatten all results
    const allTop10Items = allResults.flat();
    console.log(`Total items from all platforms: ${allTop10Items.length}`);

    // Enrich with TMDB data
    const enrichedTitles = await Promise.all(
      allTop10Items.map(async (item: any) => {
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
          
          // Get TMDB ID
          const tmdbId = titleData.tmdb?.id;
          
          if (!tmdbId) {
            console.log(`No TMDB ID for ${titleData.name}, skipping`);
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
            id: `${item.platformName}-${tmdbId}`,
            title,
            year,
            imageUrl: posterPath,
            mediaType: 'tv',
            ranking: item.ranking,
            platform: item.platformName,
            externalId: tmdbId,
            externalSource: 'tmdb',
          };
        } catch (error) {
          console.error(`Error enriching title:`, error);
          return null;
        }
      })
    );

    // Filter nulls, remove duplicates, and sort
    const seenTitles = new Set();
    const finalTitles = enrichedTitles
      .filter(t => {
        if (!t || !t.externalId) return false;
        if (seenTitles.has(t.externalId)) return false;
        seenTitles.add(t.externalId);
        return true;
      })
      .sort((a, b) => a.ranking - b.ranking)
      .slice(0, 30); // Limit to 30 total shows across all platforms

    console.log(`Successfully enriched ${finalTitles.length} unique titles`);

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
