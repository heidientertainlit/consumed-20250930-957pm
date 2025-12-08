import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const mediaTypeCache: Record<string, 'movie' | 'tv'> = {};

function cleanTitle(title: string): string {
  return title
    .replace(/:\s*(Season|Series|Part|Volume)\s*\d+.*/i, '')
    .replace(/:\s*(Limited Series|Miniseries).*/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

async function detectMediaType(title: string, retries = 2): Promise<'movie' | 'tv'> {
  const cleanedTitle = cleanTitle(title);
  
  if (mediaTypeCache[cleanedTitle]) {
    return mediaTypeCache[cleanedTitle];
  }
  
  const tmdbKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbKey) {
    return 'tv';
  }
  
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(cleanedTitle)}&page=1&include_adult=false`
    );
    
    if (response.status === 429 && retries > 0) {
      console.log('TMDB rate limited, waiting 2s before retry...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return detectMediaType(title, retries - 1);
    }
    
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const match = data.results.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
        if (match) {
          const mediaType = match.media_type as 'movie' | 'tv';
          mediaTypeCache[cleanedTitle] = mediaType;
          return mediaType;
        }
      }
    }
  } catch (error) {
    console.error('TMDB lookup error for:', title, error);
  }
  
  mediaTypeCache[cleanedTitle] = 'tv';
  return 'tv';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Require service role key in Authorization header for admin access
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Only allow calls with the service role key (admin-only function)
    if (!authHeader || !authHeader.includes(serviceKey.substring(0, 50))) {
      // Allow if called with anon key but verify it's from authenticated admin
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
        { global: { headers: { Authorization: authHeader || '' } } }
      );
      
      const { data: { user } } = await supabaseAuth.auth.getUser();
      // For now, only allow specific admin emails
      const adminEmails = ['heidi.t.91@gmail.com'];
      if (!user || !adminEmails.includes(user.email || '')) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      serviceKey
    );

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get('dry_run') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`Backfill starting: dryRun=${dryRun}, limit=${limit}, offset=${offset}`);

    const { data: tvItems, error: fetchError } = await supabase
      .from('list_items')
      .select('id, title, media_type')
      .eq('media_type', 'tv')
      .range(offset, offset + limit - 1);

    if (fetchError) {
      throw new Error('Failed to fetch items: ' + fetchError.message);
    }

    console.log(`Found ${tvItems?.length || 0} TV items to check`);

    const updates: { id: string; title: string; oldType: string; newType: string }[] = [];
    let processed = 0;
    let moviesFound = 0;

    const batchSize = 3;
    for (let i = 0; i < (tvItems?.length || 0); i += batchSize) {
      const batch = tvItems!.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (item) => {
          const detectedType = await detectMediaType(item.title);
          return { item, detectedType };
        })
      );
      
      for (const { item, detectedType } of results) {
        processed++;
        
        if (detectedType === 'movie') {
          moviesFound++;
          updates.push({
            id: item.id,
            title: item.title,
            oldType: item.media_type,
            newType: 'movie'
          });
          
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('list_items')
              .update({ media_type: 'movie', type: 'movie' })
              .eq('id', item.id);
            
            if (updateError) {
              console.error(`Failed to update ${item.id}:`, updateError);
            }
          }
        }
      }
      
      if (i + batchSize < (tvItems?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      if (processed % 20 === 0) {
        console.log(`Progress: ${processed}/${tvItems?.length}, movies found: ${moviesFound}`);
      }
    }

    console.log(`Backfill complete: processed=${processed}, moviesFound=${moviesFound}`);

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      processed,
      moviesFound,
      updates: updates.slice(0, 50),
      hasMore: (tvItems?.length || 0) === limit
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
