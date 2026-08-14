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

// Popular creators across all media types — blended into every batch for discovery
const POPULAR: { name: string; role: string }[] = [
  // Directors
  { name: 'Christopher Nolan', role: 'Director' }, { name: 'Greta Gerwig', role: 'Director' },
  { name: 'Denis Villeneuve', role: 'Director' }, { name: 'Quentin Tarantino', role: 'Director' },
  { name: 'Steven Spielberg', role: 'Director' }, { name: 'Martin Scorsese', role: 'Director' },
  { name: 'Jordan Peele', role: 'Director' }, { name: 'Nancy Meyers', role: 'Director' },
  { name: 'Wes Anderson', role: 'Director' }, { name: 'Ava DuVernay', role: 'Director' },
  { name: 'Rian Johnson', role: 'Director' }, { name: 'Sofia Coppola', role: 'Director' },
  { name: 'Ryan Coogler', role: 'Director' }, { name: 'Bong Joon-ho', role: 'Director' },
  { name: 'Emerald Fennell', role: 'Director' }, { name: 'Baz Luhrmann', role: 'Director' },
  { name: 'Ron Howard', role: 'Director' }, { name: 'Kathryn Bigelow', role: 'Director' },
  // TV creators / showrunners
  { name: 'Shonda Rhimes', role: 'Creator' }, { name: 'Julian Fellowes', role: 'Creator' },
  { name: 'Mike White', role: 'Creator' }, { name: 'Taylor Sheridan', role: 'Creator' },
  { name: 'Amy Sherman-Palladino', role: 'Creator' }, { name: 'Vince Gilligan', role: 'Creator' },
  { name: 'Mindy Kaling', role: 'Creator' }, { name: 'Ryan Murphy', role: 'Creator' },
  { name: 'Jesse Armstrong', role: 'Creator' }, { name: 'Phoebe Waller-Bridge', role: 'Creator' },
  { name: 'Tina Fey', role: 'Creator' }, { name: 'Issa Rae', role: 'Creator' },
  { name: 'Greg Daniels', role: 'Creator' }, { name: 'Craig Mazin', role: 'Creator' },
  { name: 'Quinta Brunson', role: 'Creator' }, { name: 'Dan Levy', role: 'Creator' },
  // Authors
  { name: 'Emily Henry', role: 'Author' }, { name: 'Kristin Hannah', role: 'Author' },
  { name: 'Colleen Hoover', role: 'Author' }, { name: 'Sarah J. Maas', role: 'Author' },
  { name: 'Stephen King', role: 'Author' }, { name: 'Taylor Jenkins Reid', role: 'Author' },
  { name: 'Rebecca Yarros', role: 'Author' }, { name: 'Freida McFadden', role: 'Author' },
  { name: 'Abby Jimenez', role: 'Author' }, { name: 'Ann Patchett', role: 'Author' },
  { name: 'Fredrik Backman', role: 'Author' }, { name: 'Ali Hazelwood', role: 'Author' },
  { name: 'Celeste Ng', role: 'Author' }, { name: 'Delia Owens', role: 'Author' },
  { name: 'Matt Haig', role: 'Author' }, { name: 'Gillian Flynn', role: 'Author' },
  { name: 'Brandon Sanderson', role: 'Author' }, { name: 'Kate Quinn', role: 'Author' },
  { name: 'Bonnie Garmus', role: 'Author' }, { name: 'Andy Weir', role: 'Author' },
  { name: 'Liane Moriarty', role: 'Author' }, { name: 'Jodi Picoult', role: 'Author' },
  // Musicians
  { name: 'Taylor Swift', role: 'Musician' }, { name: 'Beyonc\u00e9', role: 'Musician' },
  { name: 'Kendrick Lamar', role: 'Musician' }, { name: 'Adele', role: 'Musician' },
  { name: 'Billie Eilish', role: 'Musician' }, { name: 'Ed Sheeran', role: 'Musician' },
  { name: 'Olivia Rodrigo', role: 'Musician' }, { name: 'Bruno Mars', role: 'Musician' },
  { name: 'Sabrina Carpenter', role: 'Musician' }, { name: 'The Weeknd', role: 'Musician' },
  { name: 'Dua Lipa', role: 'Musician' }, { name: 'Morgan Wallen', role: 'Musician' },
  { name: 'SZA', role: 'Musician' }, { name: 'Harry Styles', role: 'Musician' },
  { name: 'Lana Del Rey', role: 'Musician' }, { name: 'Chappell Roan', role: 'Musician' },
  { name: 'Zach Bryan', role: 'Musician' }, { name: 'Hozier', role: 'Musician' },
  { name: 'Noah Kahan', role: 'Musician' }, { name: 'Gracie Abrams', role: 'Musician' },
  // Podcast hosts
  { name: 'Joe Rogan', role: 'Host' }, { name: 'Alex Cooper', role: 'Host' },
  { name: 'Dax Shepard', role: 'Host' }, { name: 'Mel Robbins', role: 'Host' },
  { name: 'Jay Shetty', role: 'Host' }, { name: 'Amy Poehler', role: 'Host' },
  { name: 'Ashley Flowers', role: 'Host' }, { name: 'Conan O\u2019Brien', role: 'Host' },
  { name: 'Bren\u00e9 Brown', role: 'Host' }, { name: 'Ira Glass', role: 'Host' },
  { name: 'Michelle Obama', role: 'Host' }, { name: 'Malcolm Gladwell', role: 'Host' },
  { name: 'Jason Bateman', role: 'Host' }, { name: 'Andrew Huberman', role: 'Host' },
  { name: 'Sarah Koenig', role: 'Host' }, { name: 'Bobby Bones', role: 'Host' },
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
      // Junk guard: ranked-list leftovers ("#1)", "2."), non-names ("Unknown", "TV Show"), anything without letters
      if (/^#/.test(name) || /^[\d.\-)\s]+$/.test(name) || !/\p{L}/u.test(name)) continue;
      if (/^(unknown|tv show|movie|book|music|podcast|n\/a|none|various|misc)\.?$/i.test(name)) continue;
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
      .slice(0, 4)
      .map((c) => ({
        name: c.name,
        role: c.role,
        externalId: slug(c.name),
        externalSource: c.source,
        trackedCount: c.count,
      }));

    // Blend in popular creators across ALL media types for discovery.
    // Shuffled each request, and spread across roles so one media type can't dominate.
    const offered = new Set(personal.map((p) => p.name.toLowerCase()));
    const shuffled = [...POPULAR].sort(() => Math.random() - 0.5);
    const pickedRoles = new Map<string, number>();
    const diverse: typeof POPULAR = [];
    for (const p of shuffled) {
      if ((pickedRoles.get(p.role) || 0) >= 2) continue;
      diverse.push(p);
      pickedRoles.set(p.role, (pickedRoles.get(p.role) || 0) + 1);
    }
    const fallback = diverse
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
