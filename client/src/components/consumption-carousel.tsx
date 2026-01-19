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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reactions, setReactions] = useState<Record<string, 'agree' | 'disagree'>>({});

  const scrollToNext = () => {
    if (scrollRef.current && currentIndex < items.length - 1) {
      const cardWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, items.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.clientWidth;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), items.length - 1));
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
          className="flex-shrink-0 w-full snap-center"
        >
          <div className="flex items-start gap-3 mb-3">
            {item.mediaImage ? (
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                <img src={item.mediaImage} alt={item.mediaTitle} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                {getMediaIcon(item.mediaType)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${item.username}`}>
                <p className="text-xs text-purple-600 font-medium hover:underline cursor-pointer">
                  {item.displayName || item.username}
                </p>
              </Link>
              <p className="text-gray-900 text-sm font-semibold line-clamp-2 mt-0.5">
                added {item.mediaTitle}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <Users className="w-3 h-3 inline mr-1" />
                {item.communityPercent || getStablePercent(item.id, 50, 80)}% have this on their list
              </p>
            </div>
          </div>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Great pick
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Overrated
              </button>
            </div>
          ) : (
            <div className="py-3 px-4 rounded-full bg-gradient-to-r from-slate-800 via-purple-900 to-indigo-900 text-white text-sm text-center font-medium">
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
          className="flex-shrink-0 w-full snap-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              {getTypeIcon(item.type)}
            </div>
            <Link href={`/profile/${item.username}`}>
              <p className="text-xs text-blue-600 font-medium hover:underline cursor-pointer">
                {item.displayName || item.username}
              </p>
            </Link>
            <span className="text-xs text-gray-500">voted</span>
          </div>
          
          <p className="text-gray-900 text-base font-semibold mb-1 line-clamp-2">
            "{item.userAnswer}"
          </p>
          
          <p className="text-xs text-gray-500 mb-2">
            on: {item.questionTitle}
          </p>
          
          <p className="text-xs text-gray-500 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            {item.communityPercent || getStablePercent(item.id, 40, 70)}% agree
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Side with them
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Disagree
              </button>
            </div>
          ) : (
            <div className="py-3 px-4 rounded-full bg-gradient-to-r from-slate-800 via-blue-900 to-cyan-900 text-white text-sm text-center font-medium">
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
          className="flex-shrink-0 w-full snap-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              {getTypeIcon(item.type)}
            </div>
            <Link href={`/profile/${item.username}`}>
              <p className="text-xs text-purple-600 font-medium hover:underline cursor-pointer">
                {item.displayName || item.username}
              </p>
            </Link>
            <span className={`text-xs ${item.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
              {item.isCorrect ? 'got this right' : 'missed this one'}
            </span>
          </div>
          
          <p className="text-gray-900 text-base font-semibold mb-3 line-clamp-2">
            "{item.questionTitle}"
          </p>
          
          <p className="text-xs text-gray-500 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            Only {item.communityPercent || getStablePercent(item.id, 20, 60)}% got it right
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                I knew it
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Play this
              </button>
            </div>
          ) : (
            <div className="py-3 px-4 rounded-full bg-gradient-to-r from-slate-800 via-purple-900 to-indigo-900 text-white text-sm text-center font-medium">
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
          className="flex-shrink-0 w-full snap-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
              {getTypeIcon(item.type)}
            </div>
            <Link href={`/profile/${item.username}`}>
              <p className="text-xs text-purple-600 font-medium hover:underline cursor-pointer">
                {item.displayName || item.username}
              </p>
            </Link>
            <span className="text-xs text-gray-500">says</span>
          </div>
          
          <p className="text-gray-900 text-base font-semibold mb-3 line-clamp-2">
            "{item.userAnswer}"
          </p>
          
          <p className="text-xs text-gray-500 mb-3">
            <Users className="w-3 h-3 inline mr-1" />
            {item.communityPercent || getStablePercent(item.id, 50, 80)}% are like them
          </p>
          
          {!hasReacted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleReaction(item.id, 'agree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Same
              </button>
              <button
                onClick={() => handleReaction(item.id, 'disagree')}
                className="flex-1 py-3 px-4 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Not me
              </button>
            </div>
          ) : (
            <div className="py-3 px-4 rounded-full bg-gradient-to-r from-slate-800 via-purple-900 to-indigo-900 text-white text-sm text-center font-medium">
              {hasReacted === 'agree' ? "You're the same!" : "You're different"}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-[10px] text-gray-500">See what friends are doing</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button
              onClick={scrollToPrev}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {currentIndex < items.length - 1 && (
            <button
              onClick={scrollToNext}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-400 ml-1">{currentIndex + 1}/{items.length}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
      >
        {items.map((item, index) => renderCard(item, index))}
      </div>
    </div>
  );
}
