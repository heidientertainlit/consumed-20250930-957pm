import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const tmdbCache: Record<string, 'movie' | 'tv'> = {};

function cleanTitle(title: string): string {
  return title
    .replace(/:\s*(Season|Series|Part|Volume)\s*\d+.*/i, '')
    .replace(/:\s*(Limited Series|Miniseries).*/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

async function detectMediaType(title: string, tmdbKey: string, retries = 2): Promise<'movie' | 'tv'> {
  const cleanedTitle = cleanTitle(title);
  
  if (tmdbCache[cleanedTitle]) {
    return tmdbCache[cleanedTitle];
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(cleanedTitle)}&page=1&include_adult=false`
    );
    
    if (response.status === 429 && retries > 0) {
      console.log('TMDB rate limited, waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return detectMediaType(title, tmdbKey, retries - 1);
    }
    
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const match = data.results.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
        if (match) {
          const mediaType = match.media_type as 'movie' | 'tv';
          tmdbCache[cleanedTitle] = mediaType;
          return mediaType;
        }
      }
    }
  } catch (error) {
    console.error('TMDB lookup error:', title, error);
  }
  
  tmdbCache[cleanedTitle] = 'tv';
  return 'tv';
}

serve(async (req) => {
  console.log('🔄 backfill-netflix-types: Starting...');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const tmdbKey = Deno.env.get('TMDB_API_KEY');
    if (!tmdbKey) {
      return new Response(JSON.stringify({ error: 'TMDB_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get items that need fixing: media_type='tv' with no external_source
    const { data: itemsToFix, error } = await supabase
      .from('list_items')
      .select('id, title, media_type')
      .eq('media_type', 'tv')
      .is('external_source', null)
      .order('id', { ascending: true })
      .limit(50);
    
    if (error) {
      console.error('Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!itemsToFix || itemsToFix.length === 0) {
      console.log('🔄 No items need fixing - backfill complete!');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Backfill complete - no items need fixing',
        processed: 0,
        moviesFound: 0,
        remaining: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔄 Processing ${itemsToFix.length} items...`);

    let moviesFound = 0;
    const batchSize = 3;

    for (let i = 0; i < itemsToFix.length; i += batchSize) {
      const batch = itemsToFix.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (item) => {
          const detectedType = await detectMediaType(item.title, tmdbKey);
          return { id: item.id, title: item.title, detectedType };
        })
      );

      for (const result of results) {
        const newType = result.detectedType;
        if (newType === 'movie') moviesFound++;
        
        await supabase
          .from('list_items')
          .update({ 
            media_type: newType,
            external_source: 'tmdb_verified'
          })
          .eq('id', result.id);
      }

      if (i + batchSize < itemsToFix.length) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    // Check remaining items
    const { count: remaining } = await supabase
      .from('list_items')
      .select('*', { count: 'exact', head: true })
      .eq('media_type', 'tv')
      .is('external_source', null);

    console.log(`🔄 Processed ${itemsToFix.length} items, found ${moviesFound} movies, ${remaining || 0} remaining`);

    return new Response(JSON.stringify({
      success: true,
      processed: itemsToFix.length,
      moviesFound,
      remaining: remaining || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
