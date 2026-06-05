import { useState } from 'react';
import { useEffect } from 'react';
import { Plus, Star, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { QuickAddModal } from './quick-add-modal';

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
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addItem, setAddItem] = useState<TrendingItem | null>(null);
  const [ratingItem, setRatingItem] = useState<TrendingItem | null>(null);
  const [hoverStar, setHoverStar] = useState(0);

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
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Trending Now</p>
        </div>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {items.slice(0, 25).map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex-shrink-0 w-[88px]"
            >
              {/* Poster — fixed size, never shifts */}
              <div
                className="relative w-[88px] h-[128px] rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform cursor-pointer"
                onClick={() => onItemClick?.(item)}
              >
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />

                {/* Bottom-right action buttons */}
                <div
                  className="absolute bottom-1.5 right-1.5 flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                    onClick={() => setRatingItem(item)}
                    aria-label="Rate"
                  >
                    <Star size={11} className="text-white" />
                  </button>
                  <button
                    className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                    onClick={() => setAddItem(item)}
                    aria-label="Add to list"
                  >
                    <Plus size={11} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Source pill — below poster */}
              <div className="mt-1.5 mb-1">
                <span
                  className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[item.source_key] || 'bg-gray-600'}`}
                >
                  {item.source_label}
                </span>
              </div>

              {/* Title — 2-line clamp, never affects poster height */}
              <p className="text-[10px] text-gray-700 leading-tight line-clamp-2 font-medium px-0.5">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Inline star-rating tray */}
      {ratingItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => { setRatingItem(null); setHoverStar(0); }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full max-w-lg px-5 pt-4 pb-8 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-8 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <img src={ratingItem.image_url} alt={ratingItem.title} className="w-10 h-14 rounded-lg object-cover" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">{ratingItem.title}</p>
                <span className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[ratingItem.source_key] || 'bg-gray-600'}`}>
                  {ratingItem.source_label}
                </span>
              </div>
            </div>
            <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mb-2 text-center">Your Turn</p>
            <div className="flex justify-center gap-1 mb-2" onMouseLeave={() => setHoverStar(0)}>
              {[1,2,3,4,5].map(star => (
                <div key={star} className="relative" style={{ width: 36, height: 36 }}>
                  <Star size={36} className="absolute inset-0 text-violet-200" />
                  <div className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ width: hoverStar >= star ? '100%' : hoverStar >= star - 0.5 ? '50%' : '0%' }}>
                    <Star size={36} className="fill-yellow-400 text-yellow-400" />
                  </div>
                  <button className="absolute inset-y-0 left-0 z-10" style={{ width: '50%' }}
                    onMouseEnter={() => setHoverStar(star - 0.5)}
                    onClick={() => { setHoverStar(star - 0.5); }}
                    aria-label={`${star - 0.5} stars`} />
                  <button className="absolute inset-y-0 right-0 z-10" style={{ width: '50%' }}
                    onMouseEnter={() => setHoverStar(star)}
                    onClick={() => { setHoverStar(star); }}
                    aria-label={`${star} stars`} />
                </div>
              ))}
            </div>
            {hoverStar > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => { setAddItem(ratingItem); setRatingItem(null); setHoverStar(0); }}
                  className="mt-1 px-6 py-2 bg-violet-600 text-white text-sm font-semibold rounded-full active:scale-95 transition-transform"
                >
                  Rate {hoverStar}/5 & Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to list modal */}
      {addItem && (
        <QuickAddModal
          isOpen={!!addItem}
          onClose={() => setAddItem(null)}
          preSelectedMedia={{
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
