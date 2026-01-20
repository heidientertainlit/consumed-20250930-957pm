import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Eye, ChevronLeft, ChevronRight, Trophy, Users, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface MediaItem {
  id: string;
  title: string;
  image: string;
  year?: string;
  type?: string;
}

interface SeenItGameProps {
  title?: string;
  subtitle?: string;
  items?: MediaItem[];
  category?: string;
}

const SAMPLE_ITEMS: MediaItem[] = [
  { id: '1', title: 'The Shawshank Redemption', image: 'https://image.tmdb.org/t/p/w300/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg', year: '1994' },
  { id: '2', title: 'The Godfather', image: 'https://image.tmdb.org/t/p/w300/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', year: '1972' },
  { id: '3', title: 'The Dark Knight', image: 'https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911r6m7haRef0WH.jpg', year: '2008' },
  { id: '4', title: 'Pulp Fiction', image: 'https://image.tmdb.org/t/p/w300/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', year: '1994' },
  { id: '5', title: 'Forrest Gump', image: 'https://image.tmdb.org/t/p/w300/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', year: '1994' },
  { id: '6', title: 'Inception', image: 'https://image.tmdb.org/t/p/w300/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg', year: '2010' },
];

export default function SeenItGame({ 
  title = "90s Classics", 
  subtitle = "Have you seen these iconic films?",
  items = SAMPLE_ITEMS,
  category = "movies"
}: SeenItGameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [showResults, setShowResults] = useState(false);

  const currentItem = items[currentIndex];
  const seenCount = Object.values(responses).filter(Boolean).length;
  const totalAnswered = Object.keys(responses).length;
  const isComplete = totalAnswered === items.length;

  const handleResponse = (seen: boolean) => {
    setResponses(prev => ({ ...prev, [currentItem.id]: seen }));
    
    if (currentIndex < items.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
    } else {
      setTimeout(() => setShowResults(true), 300);
    }
  };

  const resetGame = () => {
    setCurrentIndex(0);
    setResponses({});
    setShowResults(false);
  };

  if (showResults) {
    const percentage = Math.round((seenCount / items.length) * 100);
    return (
      <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 p-5 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-purple-600/50 flex items-center justify-center">
            <Eye className="w-4 h-4 text-purple-200" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Seen It</h3>
            <p className="text-purple-300 text-xs">{title}</p>
          </div>
        </div>

        <div className="text-center py-6">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
              <circle 
                cx="64" cy="64" r="56" 
                stroke="url(#gradient)" 
                strokeWidth="8" 
                fill="none"
                strokeDasharray={`${percentage * 3.52} 352`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white">{percentage}%</span>
              <span className="text-purple-300 text-xs">seen</span>
            </div>
          </div>

          <h4 className="text-white font-semibold text-xl mb-1">
            {percentage >= 80 ? "Expert Level!" : percentage >= 50 ? "Solid Watch History!" : "Room to Explore!"}
          </h4>
          <p className="text-purple-300 text-sm mb-4">
            You've seen {seenCount} of {items.length} {title.toLowerCase()}
          </p>

          <div className="flex gap-2 justify-center">
            <Button 
              onClick={resetGame}
              variant="outline" 
              className="border-purple-400 text-purple-200 hover:bg-purple-800"
            >
              Play Again
            </Button>
            <Button className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
              <Users className="w-4 h-4 mr-2" />
              Challenge Friend
            </Button>
          </div>
        </div>

        <div className="flex gap-1 justify-center mt-4">
          {items.map((item, i) => (
            <div 
              key={item.id}
              className={`w-2 h-2 rounded-full ${
                responses[item.id] === true ? 'bg-green-400' : 
                responses[item.id] === false ? 'bg-red-400' : 'bg-purple-600'
              }`}
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 p-5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-600/50 flex items-center justify-center">
            <Eye className="w-4 h-4 text-purple-200" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              Seen It
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </h3>
            <p className="text-purple-300 text-xs">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-purple-300 text-xs">{currentIndex + 1}/{items.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-purple-700/50 rounded-full mb-5 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex) / items.length) * 100}%` }}
        />
      </div>

      {/* Main Card - Swipeable Area */}
      <div className="relative">
        <div className="aspect-[2/3] max-h-80 mx-auto relative rounded-xl overflow-hidden shadow-2xl">
          <img 
            src={currentItem.image} 
            alt={currentItem.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h4 className="text-white font-bold text-xl mb-1">{currentItem.title}</h4>
            {currentItem.year && (
              <p className="text-purple-200 text-sm">{currentItem.year}</p>
            )}
          </div>

          {/* Swipe indicators */}
          <div className="absolute top-4 left-4 opacity-0 transition-opacity" id="seen-indicator">
            <div className="bg-green-500 text-white px-3 py-1 rounded-full font-bold text-sm rotate-[-15deg]">
              SEEN IT ✓
            </div>
          </div>
          <div className="absolute top-4 right-4 opacity-0 transition-opacity" id="nope-indicator">
            <div className="bg-red-500 text-white px-3 py-1 rounded-full font-bold text-sm rotate-[15deg]">
              NOPE ✗
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-6 mt-5">
          <button
            onClick={() => handleResponse(false)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
          >
            <X className="w-8 h-8 text-white" />
          </button>
          
          <button
            onClick={() => handleResponse(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
          >
            <Check className="w-8 h-8 text-white" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-center text-purple-300 text-xs mt-4">
          Tap ✓ if you've seen it, ✗ if you haven't
        </p>
      </div>

      {/* Seen count indicator */}
      <div className="flex items-center justify-center gap-2 mt-4 text-purple-200 text-sm">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span>{seenCount} seen so far</span>
      </div>
    </Card>
  );
}
