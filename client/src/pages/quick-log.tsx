import { useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { 
  Search, 
  Plus, 
  History, 
  Zap, 
  Film, 
  Tv, 
  Book, 
  Headphones, 
  Star, 
  Flame,
  Check,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function QuickLog() {
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [logged, setLogged] = useState(false);

  // Mock results for visualization
  const mockResults = [
    { id: 1, title: "Gladiator II", type: "movie", year: "2024", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=100&h=150&fit=crop" },
    { id: 2, title: "The Penguin", type: "tv", year: "2024", image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100&h=150&fit=crop" },
    { id: 3, title: "Dune: Part Two", type: "movie", year: "2024", image: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=100&h=150&fit=crop" },
  ];

  const handleLog = () => {
    setLogged(true);
    setTimeout(() => {
      setSelectedItem(null);
      setLogged(false);
      setQuery("");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-32">
      <Navigation onTrackConsumption={() => {}} />

      <div className="max-w-md mx-auto px-4 pt-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic">QUICK LOG</h1>
          <p className="text-gray-500">Track in seconds, play in minutes.</p>
        </div>

        {/* The Search "One-Tap" Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything..." 
            className="w-full h-16 pl-12 pr-4 bg-[#12121f] border-none text-xl rounded-2xl focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Results / Suggestion Grid */}
        <div className="space-y-3">
          {!query && (
            <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <History className="w-3 h-3" /> Recent & Trending
            </div>
          )}
          
          {(query ? mockResults : mockResults).map((item) => (
            <div 
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group flex items-center gap-4 p-3 bg-[#12121f]/50 hover:bg-purple-500/10 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-purple-500/20"
            >
              <img src={item.image} className="w-12 h-16 rounded-lg object-crop shadow-lg" alt={item.title} />
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-tight">{item.title}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  {item.type === 'movie' ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                  <span>{item.type.toUpperCase()}</span>
                  <span>•</span>
                  <span>{item.year}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <Plus className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>

        {/* Contextual Action Overlay */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-[#1a1a2e] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-10">
              <div className="flex gap-4 mb-6">
                <img src={selectedItem.image} className="w-20 h-28 rounded-xl object-crop shadow-xl" alt={selectedItem.title} />
                <div className="flex-1 pt-2">
                  <h2 className="text-2xl font-bold leading-none mb-2">{selectedItem.title}</h2>
                  <div className="flex gap-1 text-yellow-500 mb-4">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
                  </div>
                </div>
              </div>

              {!logged ? (
                <div className="space-y-3">
                  <Button 
                    onClick={handleLog}
                    className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-lg font-bold rounded-2xl flex items-center justify-center gap-2"
                  >
                    <Zap className="fill-current w-5 h-5" />
                    Log & Earn 10 Pts
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedItem(null)}
                    className="w-full h-12 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 animate-in zoom-in">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1 text-green-400">LOGGED!</h3>
                  <div className="flex items-center justify-center gap-2 text-yellow-500 font-bold">
                    <Zap className="fill-current w-4 h-4" /> +10 XP UNLOCKED
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-sm text-gray-400 mb-4 font-medium flex items-center justify-center gap-2 uppercase tracking-tighter">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Wait! Since you watched this...
                    </p>
                    <div className="bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20 text-left hover:bg-purple-500/20 transition-all cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-purple-400">Play Trivia</h4>
                          <p className="text-xs text-gray-500">How well do you know {selectedItem.title}?</p>
                        </div>
                        <ChevronRight className="text-purple-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
