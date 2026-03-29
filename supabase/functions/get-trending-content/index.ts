import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendingItem {
  id: string;
  title: string;
  image_url: string;
  media_type: string;
  source_label: string;
  source_key: string;
  external_id?: string;
  external_source?: string;
  rank?: number;
  count?: number;
}

async function getAppWideTrending(supabaseAdmin: any): Promise<TrendingItem[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: items } = await supabaseAdmin
      .from('list_items')
      .select('title, image_url, media_type, external_id, external_source')
      .gte('created_at', thirtyDaysAgo)
      .not('title', 'is', null)
      .limit(500);

    if (!items?.length) return [];

    const countMap = new Map<string, { item: any; count: number }>();
    for (const item of items) {
      const key = (item.external_id && item.external_source)
        ? `${item.external_source}:${item.external_id}`
        : item.title?.toLowerCase().trim();
      if (!key) continue;
      if (!countMap.has(key)) {
        countMap.set(key, { item, count: 0 });
      }
      countMap.get(key)!.count++;
    }

    return Array.from(countMap.values())
      .filter(v => v.item.title)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map(({ item, count }, i) => ({
        id: `app-${i}`,
        title: item.title,
        image_url: item.image_url?.startsWith('/')
          ? `https://image.tmdb.org/t/p/w300${item.image_url}`
          : (item.image_url || ''),
        media_type: item.media_type || 'movie',
        source_label: 'On Consumed',
        source_key: 'consumed',
        external_id: item.external_id,
        external_source: item.external_source,
        count,
      }));
  } catch (e) {
    console.error('App-wide trending error:', e);
    return [];
  }
}

async function getFlixPatrolTrending(tmdbKey: string): Promise<TrendingItem[]> {
  try {
    const flixKey = Deno.env.get('FLIXPATROL_API_KEY');
    const today = new Date().toISOString().split('T')[0];
    const results: TrendingItem[] = [];

    if (flixKey) {
      const platforms = [
        { id: 'netflix', label: 'Netflix' },
        { id: 'disney-plus', label: 'Disney+' },
        { id: 'max', label: 'Max' },
      ];
      for (const platform of platforms) {
        try {
          const res = await fetch(
            `https://api.flixpatrol.com/v1/top10/${platform.id}/tv-shows/united-states/${today}`,
            { headers: { 'X-API-Key': flixKey } }
          );
          if (!res.ok) continue;
          const data = await res.json();
          const top = (data.top10 || []).slice(0, 3);
          for (let i = 0; i < top.length; i++) {
            const show = top[i];
            if (!show.title) continue;
            let image_url = '';
            let external_id = '';
            if (tmdbKey && show.title) {
              try {
                const sr = await fetch(
                  `https://api.themoviedb.org/3/search/tv?api_key=${tmdbKey}&query=${encodeURIComponent(show.title)}`
                );
                if (sr.ok) {
                  const sd = await sr.json();
                  const match = sd.results?.[0];
                  if (match) {
                    image_url = match.poster_path
                      ? `https://image.tmdb.org/t/p/w300${match.poster_path}`
                      : '';
                    external_id = String(match.id);
                  }
                }
              } catch (_) {}
            }
            results.push({
              id: `flix-${platform.id}-${i}`,
              title: show.title,
              image_url,
              media_type: 'tv',
              source_label: platform.label,
              source_key: platform.id,
              external_id,
              external_source: 'tmdb',
              rank: i + 1,
            });
          }
        } catch (_) {}
      }
    } else if (tmdbKey) {
      const res = await fetch(
        `https://api.themoviedb.org/3/trending/tv/week?api_key=${tmdbKey}`
      );
      if (res.ok) {
        const data = await res.json();
        (data.results || []).slice(0, 8).forEach((show: any, i: number) => {
          results.push({
            id: `tmdb-tv-${i}`,
            title: show.name,
            image_url: show.poster_path
              ? `https://image.tmdb.org/t/p/w300${show.poster_path}`
              : '',
            media_type: 'tv',
            source_label: 'Trending TV',
            source_key: 'trending-tv',
            external_id: String(show.id),
            external_source: 'tmdb',
            rank: i + 1,
          });
        });
      }
    }

    if (tmdbKey) {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`
        );
        if (res.ok) {
          const data = await res.json();
          (data.results || []).slice(0, 6).forEach((movie: any, i: number) => {
            results.push({
              id: `tmdb-movie-${i}`,
              title: movie.title,
              image_url: movie.poster_path
                ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
                : '',
              media_type: 'movie',
              source_label: 'Trending Movies',
              source_key: 'trending-movies',
              external_id: String(movie.id),
              external_source: 'tmdb_movie',
              rank: i + 1,
            });
          });
        }
      } catch (_) {}
    }

    return results;
  } catch (e) {
    console.error('FlixPatrol trending error:', e);
    return [];
  }
}

async function getNytTrending(): Promise<TrendingItem[]> {
  try {
    const nytKey = Deno.env.get('NYT_API_KEY');
    if (!nytKey) return [];
    const results: TrendingItem[] = [];
    const lists = [
      { slug: 'hardcover-fiction', label: 'NYT Fiction' },
      { slug: 'hardcover-nonfiction', label: 'NYT Nonfiction' },
    ];
    for (const list of lists) {
      try {
        const res = await fetch(
          `https://api.nytimes.com/svc/books/v3/lists/current/${list.slug}.json?api-key=${nytKey}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        (data.results?.books || []).slice(0, 4).forEach((book: any, i: number) => {
          results.push({
            id: `nyt-${list.slug}-${i}`,
            title: book.title,
            image_url: book.book_image || '',
            media_type: 'book',
            source_label: list.label,
            source_key: 'nyt',
            external_id: book.primary_isbn13 || book.primary_isbn10,
            external_source: 'open_library',
            rank: book.rank,
          });
        });
      } catch (_) {}
    }
    return results;
  } catch (e) {
    console.error('NYT trending error:', e);
    return [];
  }
}

async function getOpenLibraryTrending(): Promise<TrendingItem[]> {
  try {
    const res = await fetch('https://openlibrary.org/trending/weekly.json?limit=12', {
      headers: { 'User-Agent': 'Consumed-App/1.0 (contact@consumed.app)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const works: any[] = data.works || [];
    return works
      .filter((w: any) => w.title)
      .slice(0, 10)
      .map((w: any, i: number) => {
        const coverId = w.cover_i || w.cover_id;
        const image_url = coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
          : '';
        const key = (w.key || '').replace('/works/', '');
        return {
          id: `ol-${i}`,
          title: w.title,
          image_url,
          media_type: 'book',
          source_label: 'Open Library',
          source_key: 'open-library',
          external_id: key || String(i),
          external_source: 'openlibrary',
          rank: i + 1,
        };
      });
  } catch (e) {
    console.error('Open Library trending error:', e);
    return [];
  }
}

async function getAppleTrending(): Promise<TrendingItem[]> {
  try {
    const results: TrendingItem[] = [];

    const feeds = [
      {
        url: 'https://itunes.apple.com/us/rss/topalbums/limit=8/json',
        label: 'Apple Music',
        source_key: 'apple-music',
        media_type: 'music',
      },
      {
        url: 'https://itunes.apple.com/us/rss/toppodcasts/limit=8/json',
        label: 'Apple Podcasts',
        source_key: 'apple-podcasts',
        media_type: 'podcast',
      },
    ];

    for (const feed of feeds) {
      try {
        const res = await fetch(feed.url);
        if (!res.ok) continue;
        const data = await res.json();
        const entries = data?.feed?.entry || [];
        entries.forEach((entry: any, i: number) => {
          const title = entry['im:name']?.label || entry.title?.label;
          const image = entry['im:image']?.[2]?.label || entry['im:image']?.[0]?.label || '';
          const id = entry.id?.attributes?.['im:id'] || String(i);
          if (!title) return;
          results.push({
            id: `${feed.source_key}-${i}`,
            title,
            image_url: image,
            media_type: feed.media_type,
            source_label: feed.label,
            source_key: feed.source_key,
            external_id: id,
            external_source: feed.source_key,
            rank: i + 1,
          });
        });
      } catch (_) {}
    }

    return results;
  } catch (e) {
    console.error('Apple trending error:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const tmdbKey = Deno.env.get('TMDB_API_KEY') || '';

    const [appWide, streaming, nyt, openLib, apple] = await Promise.allSettled([
      getAppWideTrending(supabaseAdmin),
      getFlixPatrolTrending(tmdbKey),
      getNytTrending(),
      getOpenLibraryTrending(),
      getAppleTrending(),
    ]);

    // Interleave sources round-robin so the carousel shows true mixed media
    // instead of all TV shows, then all books, then all music in sequence
    const buckets: TrendingItem[][] = [
      appWide.status === 'fulfilled' ? appWide.value : [],
      streaming.status === 'fulfilled' ? streaming.value : [],
      nyt.status === 'fulfilled' ? nyt.value : [],
      openLib.status === 'fulfilled' ? openLib.value : [],
      apple.status === 'fulfilled' ? apple.value : [],
    ].filter(b => b.length > 0);

    const allItems: TrendingItem[] = [];
    const maxLen = Math.max(...buckets.map(b => b.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (i < bucket.length) allItems.push(bucket[i]);
      }
    }

    return new Response(JSON.stringify({ items: allItems }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('get-trending-content error:', error);
    return new Response(JSON.stringify({ items: [], error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
