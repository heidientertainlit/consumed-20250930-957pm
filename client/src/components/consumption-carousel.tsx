import { useState, useRef, useMemo } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, Users, ThumbsUp, ThumbsDown, HelpCircle, BarChart3, Sparkles, Film, Tv, BookOpen, Music } from 'lucide-react';

const getStablePercent = (id: string, min = 40, max = 80) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return min + Math.abs(hash % (max - min + 1));
};

interface FriendActivityItem {
  id: string;
  type: 'media_added' | 'poll_answer' | 'trivia_answer' | 'dna_moment';
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  
  // For media_added
  mediaTitle?: string;
  mediaType?: string;
  mediaImage?: string;
  
  // For poll/trivia/dna
  questionTitle?: string;
  userAnswer?: string;
  communityPercent?: number;
  isCorrect?: boolean;
  poolId?: string;
  
  timestamp: string;
}

interface ConsumptionCarouselProps {
  items: FriendActivityItem[];
  title?: string;
}

const getMediaIcon = (mediaType?: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'book':
      return <BookOpen className="w-4 h-4 text-purple-400" />;
    case 'tv':
      return <Tv className="w-4 h-4 text-purple-400" />;
    case 'movie':
      return <Film className="w-4 h-4 text-purple-400" />;
    case 'music':
    case 'podcast':
      return <Music className="w-4 h-4 text-purple-400" />;
    default:
      return <Film className="w-4 h-4 text-purple-400" />;
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'poll_answer':
      return <BarChart3 className="w-3.5 h-3.5" />;
    case 'trivia_answer':
      return <HelpCircle className="w-3.5 h-3.5" />;
    case 'dna_moment':
      return <Sparkles className="w-3.5 h-3.5" />;
    default:
      return <Film className="w-3.5 h-3.5" />;
  }
};

export default function ConsumptionCarousel({ items, title = "Your Circle" }: ConsumptionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [reactions, setReactions] = useState<Record<string, 'agree' | 'disagree'>>({});

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  const handleReaction = (itemId: string, reaction: 'agree' | 'disagree') => {
    setReactions(prev => ({ ...prev, [itemId]: reaction }));
  };

  if (!items || items.length === 0) return null;

  const renderCard = (item: FriendActivityItem, index: number) => {
    const hasReacted = reactions[item.id];
    
    if (item.type === 'media_added') {
      return (
        <div
          key={item.id || index}
          className="flex-shrink-0 w-64 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700"
        >
          <div className="flex items-start gap-3 mb-3">
            {item.mediaImage ? (
              <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                <img src={item.mediaImage} alt={item.mediaTitle} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-16 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                {getMediaIcon(item.mediaType)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${item.username}`}>
                <p className="text-xs text-purple-400 font-medium hover:underline cursor-pointer">
                  {item.displayName || item.username}
                </p>
              </Link>
              <p className="text-white text-sm font-semibold line-clamp-2 mt-0.5">
                added {item.mediaTitle}
              </p>
            </div>
          </div>
          
          <p className="text-xs text-slate-400 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            {item.communityPercent || getStablePercent(item.id, 50, 80)}% have this on their list
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-2 px-3 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-600/30 transition-colors flex items-center justify-center gap-1"
              >
                <ThumbsUp className="w-3 h-3" />
                Great pick
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 text-xs font-medium hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-1"
              >
                <ThumbsDown className="w-3 h-3" />
                Overrated
              </button>
            </div>
          ) : (
            <div className="py-2 px-3 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs text-center">
              {hasReacted === 'agree' ? "You agreed!" : "You disagreed"}
            </div>
          )}
        </div>
      );
    }
    
    if (item.type === 'poll_answer') {
      return (
        <div
          key={item.id || index}
          className="flex-shrink-0 w-64 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-xl p-4 border border-blue-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center">
              {getTypeIcon(item.type)}
            </div>
            <Link href={`/profile/${item.username}`}>
              <p className="text-xs text-blue-300 font-medium hover:underline cursor-pointer">
                {item.displayName || item.username}
              </p>
            </Link>
            <span className="text-xs text-blue-400">voted</span>
          </div>
          
          <p className="text-white text-sm font-semibold mb-1 line-clamp-2">
            "{item.userAnswer}"
          </p>
          
          <p className="text-xs text-blue-300 mb-3">
            on: {item.questionTitle}
          </p>
          
          <p className="text-xs text-blue-400 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            {item.communityPercent || getStablePercent(item.id, 40, 70)}% agree
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-2 px-3 rounded-lg bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-medium hover:bg-blue-500/40 transition-colors"
              >
                Side with {item.displayName?.split(' ')[0] || item.username}
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 text-xs font-medium hover:bg-slate-600/50 transition-colors"
              >
                Disagree
              </button>
            </div>
          ) : (
            <div className="py-2 px-3 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs text-center">
              {hasReacted === 'agree' ? `You sided with ${item.displayName?.split(' ')[0] || item.username}` : "You disagreed"}
            </div>
          )}
        </div>
      );
    }
    
    if (item.type === 'trivia_answer') {
      return (
        <div
          key={item.id || index}
          className="flex-shrink-0 w-64 bg-gradient-to-br from-emerald-900 to-teal-900 rounded-xl p-4 border border-emerald-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center">
              {getTypeIcon(item.type)}
            </div>
            <Link href={`/profile/${item.username}`}>
              <p className="text-xs text-emerald-300 font-medium hover:underline cursor-pointer">
                {item.displayName || item.username}
              </p>
            </Link>
            <span className={`text-xs ${item.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {item.isCorrect ? 'got this right' : 'missed this one'}
            </span>
          </div>
          
          <p className="text-white text-sm font-semibold mb-3 line-clamp-2">
            "{item.questionTitle}"
          </p>
          
          <p className="text-xs text-emerald-400 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            Only {item.communityPercent || getStablePercent(item.id, 20, 60)}% got it right
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-medium hover:bg-emerald-500/40 transition-colors"
              >
                I knew it
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 text-xs font-medium hover:bg-slate-600/50 transition-colors"
              >
                Play this
              </button>
            </div>
          ) : (
            <div className="py-2 px-3 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs text-center">
              {hasReacted === 'agree' ? "You knew it too!" : "Challenge accepted"}
            </div>
          )}
        </div>
      );
    }
    
    if (item.type === 'dna_moment') {
      return (
        <div
          key={item.id || index}
          className="flex-shrink-0 w-64 bg-gradient-to-br from-purple-900 to-pink-900 rounded-xl p-4 border border-purple-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center">
              {getTypeIcon(item.type)}
            </div>
            <Link href={`/profile/${item.username}`}>
              <p className="text-xs text-purple-300 font-medium hover:underline cursor-pointer">
                {item.displayName || item.username}
              </p>
            </Link>
            <span className="text-xs text-purple-400">says</span>
          </div>
          
          <p className="text-white text-sm font-semibold mb-3 line-clamp-2">
            "{item.userAnswer}"
          </p>
          
          <p className="text-xs text-purple-400 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            {item.communityPercent || getStablePercent(item.id, 50, 80)}% are like them
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-2 px-3 rounded-lg bg-purple-500/30 border border-purple-400/40 text-purple-200 text-xs font-medium hover:bg-purple-500/40 transition-colors"
              >
                Same
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 text-xs font-medium hover:bg-slate-600/50 transition-colors"
              >
                Not me
              </button>
            </div>
          ) : (
            <div className="py-2 px-3 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs text-center">
              {hasReacted === 'agree' ? "You're the same!" : "You're different"}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
      >
        {items.map((item, index) => renderCard(item, index))}
      </div>
      
      <p className="text-[10px] text-slate-500 text-center mt-3">
        {items.length} friend activities
      </p>
    </div>
  );
}
