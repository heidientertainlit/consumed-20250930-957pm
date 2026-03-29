import { TrendingUp, Film, Tv, BookOpen, Music, Headphones, Flame } from 'lucide-react';

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

interface TrendingCarouselProps {
  items: TrendingItem[];
  onItemClick?: (item: TrendingItem) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  'consumed':        'bg-purple-100 text-purple-700',
  'netflix':         'bg-red-100 text-red-700',
  'disney-plus':     'bg-blue-100 text-blue-700',
  'max':             'bg-sky-100 text-sky-700',
  'trending-tv':     'bg-indigo-100 text-indigo-700',
  'trending-movies': 'bg-indigo-100 text-indigo-700',
  'nyt':             'bg-gray-100 text-gray-700',
  'open-library':    'bg-emerald-100 text-emerald-700',
  'apple-music':     'bg-pink-100 text-pink-700',
  'apple-podcasts':  'bg-orange-100 text-orange-700',
};

const MEDIA_ICONS: Record<string, React.ReactNode> = {
  tv:      <Tv size={10} />,
  movie:   <Film size={10} />,
  book:    <BookOpen size={10} />,
  music:   <Music size={10} />,
  podcast: <Headphones size={10} />,
};

export default function TrendingCarousel({ items, onItemClick }: TrendingCarouselProps) {
  if (!items.length) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Flame size={13} className="text-orange-500" />
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Trending</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {items.slice(0, 20).map((item, idx) => {
          const colorClass = SOURCE_COLORS[item.source_key] || 'bg-gray-100 text-gray-600';
          const icon = MEDIA_ICONS[item.media_type] || <TrendingUp size={10} />;

          return (
            <button
              key={item.id || idx}
              onClick={() => onItemClick?.(item)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow hover:border-purple-200 transition-all flex-shrink-0 group"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-5 h-5 rounded-sm object-cover flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-5 h-5 rounded-sm bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400">
                  {icon}
                </div>
              )}
              <span className="text-gray-700 text-xs font-medium truncate max-w-[90px] group-hover:text-purple-700 transition-colors">
                {item.title}
              </span>
              <span className={`flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${colorClass}`}>
                {item.source_label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
