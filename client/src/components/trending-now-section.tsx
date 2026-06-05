import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

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
}

const SOURCE_COLORS: Record<string, string> = {
  'consumed':        'bg-purple-600',
  'netflix':         'bg-red-600',
  'disney-plus':     'bg-blue-600',
  'max':             'bg-sky-600',
  'trending-tv':     'bg-indigo-500',
  'trending-movies': 'bg-indigo-500',
  'nyt':             'bg-gray-700',
  'open-library':    'bg-emerald-600',
  'apple-music':     'bg-pink-600',
  'apple-podcasts':  'bg-orange-500',
};

export function TrendingNowSection({ onItemClick }: { onItemClick?: (item: TrendingItem) => void }) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    fetch(`${supabaseUrl}/functions/v1/get-trending-content`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json())
      .then(data => {
        setItems((data.items || []).filter((i: TrendingItem) => i.image_url));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Trending Now</p>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="w-[88px] h-[128px] bg-gray-100 rounded-xl flex-shrink-0 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Trending Now</p>
      </div>
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {items.slice(0, 25).map((item, idx) => (
          <button
            key={item.id || idx}
            onClick={() => onItemClick?.(item)}
            className="flex-shrink-0 w-[88px] active:scale-95 transition-transform text-left"
          >
            <div className="relative w-[88px] h-[128px] rounded-xl overflow-hidden bg-gray-100">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <span
                  className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[item.source_key] || 'bg-gray-600'}`}
                >
                  {item.source_label}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-700 mt-1.5 leading-tight line-clamp-2 font-medium px-0.5">
              {item.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
