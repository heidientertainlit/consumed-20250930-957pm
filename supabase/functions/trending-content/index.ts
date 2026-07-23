// trending-content: returns live trending items for the login page teaser.
// Sources: TMDB trending (movie + TV), Apple Books top chart, Apple Podcasts top chart.
// No auth required beyond the anon key — read-only, no DB access.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendingItem {
  title: string;
  image: string;
  type: 'movie' | 'tv' | 'book' | 'podcast';
  stat: string;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const tmdbKey = Deno.env.get('TMDB_API_KEY') ?? '';
  const isBearer = tmdbKey.length > 40;
  const tmdbHeaders = isBearer ? { Authorization: `Bearer ${tmdbKey}` } : {};
  const tmdbQs = isBearer ? '' : `?api_key=${tmdbKey}`;

  const results = await Promise.allSettled([
    fetchJson(`https://api.themoviedb.org/3/trending/movie/week${tmdbQs}`, tmdbHeaders),
    fetchJson(`https://api.themoviedb.org/3/trending/tv/week${tmdbQs}`, tmdbHeaders),
    fetchJson('https://rss.applemarketingtools.com/api/v2/us/books/top-paid/1/books.json'),
    fetchJson('https://rss.applemarketingtools.com/api/v2/us/podcasts/top/1/podcasts.json'),
  ]);

  const items: TrendingItem[] = [];

  if (results[0].status === 'fulfilled') {
    const m = results[0].value?.results?.[0];
    if (m?.poster_path) {
      items.push({
        title: m.title,
        image: `https://image.tmdb.org/t/p/w300${m.poster_path}`,
        type: 'movie',
        stat: '#1 trending movie',
      });
    }
  }

  if (results[1].status === 'fulfilled') {
    const t = results[1].value?.results?.[0];
    if (t?.poster_path) {
      items.push({
        title: t.name,
        image: `https://image.tmdb.org/t/p/w300${t.poster_path}`,
        type: 'tv',
        stat: '#1 trending show',
      });
    }
  }

  if (results[2].status === 'fulfilled') {
    const b = results[2].value?.feed?.results?.[0];
    if (b?.artworkUrl100) {
      items.push({
        title: b.name,
        image: b.artworkUrl100.replace('100x151bb', '300x453bb').replace('100x152bb', '300x456bb').replace('100x100bb', '300x300bb'),
        type: 'book',
        stat: '#1 bestselling book',
      });
    }
  }

  if (results[3].status === 'fulfilled') {
    const p = results[3].value?.feed?.results?.[0];
    if (p?.artworkUrl100) {
      items.push({
        title: p.name,
        image: p.artworkUrl100.replace('100x100bb', '300x300bb'),
        type: 'podcast',
        stat: '#1 podcast',
      });
    }
  }

  return new Response(JSON.stringify({ items }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
