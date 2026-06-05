import { useState } from 'react';
import { useEffect } from 'react';
import { Plus, Star } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { QuickAddModal } from './quick-add-modal';
import { supabase } from '@/lib/supabase';

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
  // Inline rating state: which item is being rated + hover value
  const [ratingItemId, setRatingItemId] = useState<string | null>(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [savedRatings, setSavedRatings] = useState<Record<string, number>>({});

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

  async function handleRate(item: TrendingItem, rating: number) {
    setSavedRatings(prev => ({ ...prev, [item.id]: rating }));
    setRatingItemId(null);
    setHoverStar(0);

    if (!session?.user?.id) return;
    await supabase.from('media_ratings').upsert({
      user_id: session.user.id,
      media_title: item.title,
      media_type: item.media_type || 'movie',
      rating,
      image_url: item.image_url,
      external_id: item.external_id || item.id,
      external_source: item.external_source || 'tmdb',
    }, { onConflict: 'user_id,external_id,external_source' });
  }

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
          {items.slice(0, 25).map((item, idx) => {
            const isRating = ratingItemId === item.id;
            const saved = savedRatings[item.id];
            return (
              <div
                key={item.id || idx}
                className="flex-shrink-0 w-[88px]"
              >
                {/* Poster */}
                <div
                  className="relative w-[88px] h-[128px] rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform cursor-pointer"
                  onClick={() => { if (!isRating) onItemClick?.(item); }}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                    }}
                  />

                  {/* Inline star strip — replaces bottom buttons when active */}
                  {isRating ? (
                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 py-2 px-1"
                      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          className="p-0.5 active:scale-110 transition-transform"
                          onClick={() => handleRate(item, star)}
                          onMouseEnter={() => setHoverStar(star)}
                          onMouseLeave={() => setHoverStar(0)}
                          aria-label={`${star} stars`}
                        >
                          <Star
                            size={16}
                            className={star <= (hoverStar || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-white/50'}
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Normal action buttons */
                    <div
                      className="absolute bottom-1.5 right-1.5 flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                        onClick={() => { setRatingItemId(item.id); setHoverStar(0); }}
                        aria-label="Rate"
                      >
                        {saved ? (
                          <Star size={11} className="text-yellow-400 fill-yellow-400" />
                        ) : (
                          <Star size={11} className="text-white" />
                        )}
                      </button>
                      <button
                        className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                        onClick={() => setAddItem(item)}
                        aria-label="Add to list"
                      >
                        <Plus size={11} className="text-white" />
                      </button>
                    </div>
                  )}
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
            );
          })}
        </div>
      </div>

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
