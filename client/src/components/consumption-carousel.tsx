import { useState, useRef } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, Star, Plus, BookOpen, Tv, Film, Music, Gamepad2 } from 'lucide-react';

interface ConsumptionItem {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  action: string;
  mediaTitle: string;
  mediaType?: string;
  mediaImage?: string;
  rating?: number;
  listName?: string;
  timestamp: string;
}

interface ConsumptionCarouselProps {
  items: ConsumptionItem[];
  title?: string;
}

const getMediaIcon = (mediaType?: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'book':
      return <BookOpen className="w-3 h-3" />;
    case 'tv':
      return <Tv className="w-3 h-3" />;
    case 'movie':
      return <Film className="w-3 h-3" />;
    case 'music':
    case 'podcast':
      return <Music className="w-3 h-3" />;
    case 'game':
      return <Gamepad2 className="w-3 h-3" />;
    default:
      return <Film className="w-3 h-3" />;
  }
};

const getActionText = (action: string, listName?: string) => {
  const normalizedAction = action?.toLowerCase() || '';
  
  if (['added', 'add-to-list', 'added_to_list'].includes(normalizedAction)) {
    return listName ? `added to ${listName}` : 'added';
  }
  if (['rated', 'rate', 'rate-review'].includes(normalizedAction)) return 'rated';
  if (['review', 'reviewed'].includes(normalizedAction)) return 'reviewed';
  if (normalizedAction === 'finished') return 'finished';
  if (normalizedAction === 'started') return 'started';
  if (normalizedAction === 'consuming') return 'is watching';
  if (normalizedAction === 'progress') return 'updated progress on';
  if (normalizedAction === 'watched') return 'watched';
  if (normalizedAction === 'read') return 'read';
  if (normalizedAction === 'listening') return 'listened to';
  if (normalizedAction === 'played') return 'played';
  
  // Fallback: clean up any hyphenated or underscored action names
  return normalizedAction.replace(/[-_]/g, ' ');
};

export default function ConsumptionCarousel({ items, title = "What friends are consuming" }: ConsumptionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <div className="flex items-center gap-1">
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
      >
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className="flex-shrink-0 w-36 bg-gray-50 rounded-xl p-3 border border-gray-100"
          >
            {item.mediaImage ? (
              <div className="w-full aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-gray-200">
                <img
                  src={item.mediaImage}
                  alt={item.mediaTitle}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full aspect-[2/3] rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mb-2">
                {getMediaIcon(item.mediaType)}
              </div>
            )}
            
            <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">
              {item.mediaTitle}
            </p>
            
            <div className="flex items-center gap-1 mb-1">
              <Link href={`/profile/${item.username}`}>
                <span className="text-[10px] text-purple-600 font-medium hover:underline cursor-pointer">
                  {item.displayName || item.username}
                </span>
              </Link>
              <span className="text-[10px] text-gray-500">
                {getActionText(item.action, item.listName)}
              </span>
            </div>
            
            {item.rating && item.rating > 0 && (
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-2.5 h-2.5 ${
                      i < item.rating! ? 'fill-purple-500 text-purple-500' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <p className="text-[10px] text-gray-400 text-center mt-2">
        {items.length} recent activities
      </p>
    </div>
  );
}
