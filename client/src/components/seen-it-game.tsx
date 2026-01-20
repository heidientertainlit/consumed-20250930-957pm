import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ChevronRight, Check, X, Users, Trophy } from "lucide-react";

interface MediaItem {
  id: string;
  title: string;
  image: string;
  year?: string;
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
  items = SAMPLE_ITEMS
}: { title?: string; items?: MediaItem[] }) {
  const [responses, setResponses] = useState<Record<string, boolean | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const seenCount = Object.values(responses).filter(v => v === true).length;
  const answeredCount = Object.values(responses).filter(v => v !== null && v !== undefined).length;

  const handleResponse = (id: string, seen: boolean) => {
    setResponses(prev => ({ ...prev, [id]: seen }));
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-yellow-400" />
          <h3 className="text-white font-semibold text-lg">Seen It</h3>
          <span className="text-purple-300 text-sm">• {title}</span>
        </div>
        <div className="flex items-center gap-2">
          {answeredCount > 0 && (
            <span className="text-purple-300 text-sm">{seenCount}/{answeredCount}</span>
          )}
          <ChevronRight className="w-4 h-4 text-purple-300" />
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const response = responses[item.id];
          const answered = response !== null && response !== undefined;
          
          return (
            <div key={item.id} className="flex-shrink-0 w-32">
              <div className="relative">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className={`w-32 h-48 rounded-lg object-cover transition-all ${
                    answered ? 'opacity-60' : ''
                  }`}
                />
                {answered && (
                  <div className={`absolute inset-0 flex items-center justify-center rounded-lg ${
                    response ? 'bg-green-500/30' : 'bg-red-500/30'
                  }`}>
                    {response ? (
                      <Check className="w-10 h-10 text-green-400" />
                    ) : (
                      <X className="w-10 h-10 text-red-400" />
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-white text-sm font-medium mt-2 truncate">{item.title}</p>
              
              {!answered ? (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => handleResponse(item.id, false)}
                    className="flex-1 py-1.5 rounded-lg border border-purple-400 text-purple-300 text-xs font-medium hover:bg-purple-700/50 active:scale-95 transition-all"
                  >
                    Nope
                  </button>
                  <button
                    onClick={() => handleResponse(item.id, true)}
                    className="flex-1 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 active:scale-95 transition-all"
                  >
                    Seen It
                  </button>
                </div>
              ) : (
                <div className={`mt-2 py-1.5 rounded-lg text-center text-xs font-medium ${
                  response ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {response ? '✓ Seen' : '✗ Nope'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {answeredCount === items.length && (
        <div className="mt-3 pt-3 border-t border-purple-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm font-medium">
              {Math.round((seenCount / items.length) * 100)}% seen
            </span>
          </div>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8">
            <Users className="w-3 h-3 mr-1" />
            Challenge Friend
          </Button>
        </div>
      )}
    </Card>
  );
}
