import { useState } from 'react';
import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { QuickAddListSheet } from './quick-add-list-sheet';

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
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addItem, setAddItem] = useState<TrendingItem | null>(null);

  function navigateToMedia(item: TrendingItem) {
    if (onItemClick) { onItemClick(item); return; }
    const type = item.media_type || 'movie';
    const source = item.external_source || 'tmdb';
    const id = item.external_id || item.id;
    setLocation(`/media/${type}/${source}/${id}`);
  }

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
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4">Trending Now</p>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex-shrink-0 w-[88px]">
              <div className="w-[88px] h-[128px] bg-gray-100 rounded-xl animate-pulse" />
              <div className="mt-1.5 h-3 w-16 bg-gray-100 rounded-full animate-pulse" />
              <div className="mt-1 h-3 w-12 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <>
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3 px-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Trending Now</p>
        </div>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {items.slice(0, 25).map((item, idx) => (
            <div key={item.id || idx} className="flex-shrink-0 w-[88px]">
              {/* Poster */}
              <div
                className="relative w-[88px] h-[128px] rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform cursor-pointer"
                onClick={() => navigateToMedia(item)}
              >
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />

                {/* Add button */}
                <div
                  className="absolute bottom-1.5 right-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                    onClick={() => setAddItem(item)}
                    aria-label="Add to list"
                  >
                    <Plus size={11} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Source pill */}
              <div className="mt-1.5 mb-1">
                <span className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[item.source_key] || 'bg-gray-600'}`}>
                  {item.source_label}
                </span>
              </div>

              {/* Title */}
              <p className="text-[10px] text-gray-700 leading-tight line-clamp-2 font-medium px-0.5">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Add to list sheet */}
      {addItem && (
        <QuickAddListSheet
          isOpen={!!addItem}
          onClose={() => setAddItem(null)}
          media={{
            title: addItem.title,
            mediaType: addItem.media_type || 'movie',
            imageUrl: addItem.image_url,
            externalId: addItem.external_id || addItem.id,
            externalSource: addItem.external_source || 'tmdb',
          }}
        />
      )}
    </>
  );
}
