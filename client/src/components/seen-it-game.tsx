import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Eye, Trophy, Users, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaItem {
  id: string;
  title: string;
  image: string;
  year?: string;
}

const SAMPLE_ITEMS: MediaItem[] = [
  { id: '1', title: 'The Shawshank Redemption', image: 'https://image.tmdb.org/t/p/w185/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg', year: '1994' },
  { id: '2', title: 'The Godfather', image: 'https://image.tmdb.org/t/p/w185/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', year: '1972' },
  { id: '3', title: 'The Dark Knight', image: 'https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911r6m7haRef0WH.jpg', year: '2008' },
  { id: '4', title: 'Pulp Fiction', image: 'https://image.tmdb.org/t/p/w185/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', year: '1994' },
  { id: '5', title: 'Forrest Gump', image: 'https://image.tmdb.org/t/p/w185/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', year: '1994' },
  { id: '6', title: 'Inception', image: 'https://image.tmdb.org/t/p/w185/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg', year: '2010' },
];

export default function SeenItGame({ 
  title = "90s Classics",
  items = SAMPLE_ITEMS
}: { title?: string; items?: MediaItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const currentItem = items[currentIndex];
  const seenCount = Object.values(responses).filter(Boolean).length;
  const isComplete = currentIndex >= items.length;

  const handleResponse = (seen: boolean) => {
    setSwipeDirection(seen ? 'right' : 'left');
    setResponses(prev => ({ ...prev, [currentItem.id]: seen }));
    
    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex(currentIndex + 1);
    }, 200);
  };

  if (isComplete) {
    const percentage = Math.round((seenCount / items.length) * 100);
    return (
      <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-purple-300" />
          <span className="text-white font-medium text-sm">Seen It</span>
          <span className="text-purple-400 text-xs">• {title}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-bold text-white">{percentage}%</span>
            <p className="text-purple-300 text-xs">{seenCount}/{items.length} seen</p>
          </div>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs">
            <Users className="w-3 h-3 mr-1" />
            Challenge
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-purple-300" />
          <span className="text-white font-medium text-sm">Seen It</span>
          <span className="text-purple-400 text-xs">• {title}</span>
        </div>
        <span className="text-purple-400 text-xs">{currentIndex + 1}/{items.length}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleResponse(false)}
          className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center hover:bg-red-500/40 active:scale-90 transition-all"
        >
          <X className="w-5 h-5 text-red-400" />
        </button>

        <div 
          className={`flex-1 flex items-center gap-3 bg-white/10 rounded-lg p-2 transition-all duration-200 ${
            swipeDirection === 'right' ? 'translate-x-4 opacity-50' : 
            swipeDirection === 'left' ? '-translate-x-4 opacity-50' : ''
          }`}
        >
          <img 
            src={currentItem.image} 
            alt={currentItem.title}
            className="w-12 h-16 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{currentItem.title}</p>
            <p className="text-purple-300 text-xs">{currentItem.year}</p>
          </div>
        </div>

        <button
          onClick={() => handleResponse(true)}
          className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center hover:bg-green-500/40 active:scale-90 transition-all"
        >
          <Check className="w-5 h-5 text-green-400" />
        </button>
      </div>

      <div className="flex gap-1 mt-3">
        {items.map((item, i) => (
          <div 
            key={item.id}
            className={`flex-1 h-1 rounded-full ${
              i < currentIndex ? (responses[item.id] ? 'bg-green-500' : 'bg-red-500') : 
              i === currentIndex ? 'bg-purple-400' : 'bg-purple-700'
            }`}
          />
        ))}
      </div>
    </Card>
  );
}
