import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ROLE_BY_TYPE: Record<string, string> = {
  movie: 'Director',
  tv: 'Creator',
  book: 'Author',
  music: 'Musician',
  podcast: 'Host',
};

// Popular fallback creators so new users still get a useful batch
const POPULAR: { name: string; role: string }[] = [
  { name: 'Christopher Nolan', role: 'Director' },
  { name: 'Taylor Swift', role: 'Musician' },
  { name: 'Stephen King', role: 'Author' },
  { name: 'Greta Gerwig', role: 'Director' },
  { name: 'Sarah J. Maas', role: 'Author' },
  { name: 'Quentin Tarantino', role: 'Director' },
  { name: 'Beyonc\u00e9', role: 'Musician' },
  { name: 'Colleen Hoover', role: 'Author' },
  { name: 'Denis Villeneuve', role: 'Director' },
  { name: 'Kendrick Lamar', role: 'Musician' },
];

const slug = (name: string) =>
  'name:' + name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const [{ data: items }, { data: followed }] = await Promise.all([
      admin
        .from('list_items')
        .select('creator, media_type, external_source, media_subtype')
        .eq('user_id', user.id)
        .not('creator', 'is', null)
        .neq('creator', '')
        .order('created_at', { ascending: false })
        .limit(400),
      admin
        .from('followed_creators')
        .select('creator_name, external_id')
        .eq('user_id', user.id),
    ]);

    const followedNames = new Set((followed || []).map((f: any) => f.creator_name.toLowerCase().trim()));
    const followedIds = new Set((followed || []).map((f: any) => f.external_id));

    // Count tracked media per creator (skip YouTube channels — the channel IS the creator, followed at add time)
    const counts = new Map<string, { name: string; role: string; source: string; count: number }>();
    for (const item of items || []) {
      const name = (item.creator || '').trim();
      if (!name || name.length > 60) continue;
      if (item.external_source === 'youtube') continue;
      const key = name.toLowerCase();
      if (followedNames.has(key)) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, {
          name,
          role: ROLE_BY_TYPE[(item.media_type || '').toLowerCase()] || 'Creator',
          source: item.external_source || 'tmdb',
          count: 1,
        });
      }
    }

    const personal = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((c) => ({
        name: c.name,
        role: c.role,
        externalId: slug(c.name),
        externalSource: c.source,
        trackedCount: c.count,
      }));

    // Top up with popular fallbacks the user hasn't followed or been offered
    const offered = new Set(personal.map((p) => p.name.toLowerCase()));
    const fallback = POPULAR
      .filter((p) => !followedNames.has(p.name.toLowerCase()) && !offered.has(p.name.toLowerCase()) && !followedIds.has(slug(p.name)))
      .slice(0, Math.max(0, 8 - personal.length))
      .map((p) => ({
        name: p.name,
        role: p.role,
        externalId: slug(p.name),
        externalSource: 'tmdb',
        trackedCount: 0,
      }));

    // Enrich with TMDB person profile photos (covers directors, musicians, many authors/hosts)
    const tmdbKey = Deno.env.get('TMDB_API_KEY');
    let enriched = [...personal, ...fallback];
    if (tmdbKey) {
      enriched = await Promise.all(enriched.map(async (c) => {
        try {
          const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(c.name)}`);
          if (res.ok) {
            const json = await res.json();
            const hit = (json.results || []).find((p: any) => p.profile_path && p.name.toLowerCase() === c.name.toLowerCase()) || (json.results || [])[0];
            if (hit?.profile_path) return { ...c, image: `https://image.tmdb.org/t/p/w185${hit.profile_path}` };
          }
        } catch (_) { /* keep initials fallback */ }
        return { ...c, image: null };
      }));
    }

    return new Response(JSON.stringify({ creators: enriched }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in suggest-creators:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
