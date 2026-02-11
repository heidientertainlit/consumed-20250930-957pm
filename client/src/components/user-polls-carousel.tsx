import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import CollaborativePredictionCard from '@/components/collaborative-prediction-card';

interface UserPollData {
  id: string;
  title: string;
  mediaTitle?: string;
  mediaItems?: Array<{
    title: string;
    mediaType?: string;
    externalId?: string;
    externalSource?: string;
    imageUrl?: string;
  }>;
  creator: {
    id?: string;
    username: string;
  };
  poolId?: string;
  options?: string[];
  optionVotes?: Array<{ option: string; count: number; percentage: number }>;
  userVotes?: Array<{ user: string; vote: string; userId: string }>;
  userHasAnswered?: boolean;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  origin_type?: string;
  origin_user_id?: string;
  status?: string;
  type?: string;
}

interface UserPollsCarouselProps {
  polls: UserPollData[];
}

export function UserPollsCarousel({ polls }: UserPollsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!polls || polls.length === 0) return null;

  const scrollToNext = () => {
    if (scrollRef.current && currentIndex < polls.length - 1) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 300;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, polls.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 300;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 300;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), polls.length - 1));
    }
  };

  if (polls.length === 1) {
    return (
      <div className="mb-4">
        <CollaborativePredictionCard prediction={polls[0] as any} />
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
            <BarChart3 className="w-3 h-3 text-purple-600" />
          </div>
          <span className="text-xs font-medium text-gray-500">Community Polls</span>
        </div>
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button onClick={scrollToPrev} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {currentIndex < polls.length - 1 && (
            <button onClick={scrollToNext} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-400 ml-1">{currentIndex + 1}/{polls.length}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
      >
        {polls.map((poll) => (
          <div key={poll.id} className="flex-shrink-0 w-full snap-center">
            <CollaborativePredictionCard prediction={poll as any} />
          </div>
        ))}
      </div>
    </div>
  );
}
