import { useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { 
  Search, 
  X, 
  ChevronLeft,
  Film,
  Tv,
  Book,
  Headphones,
  Music
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function QuickLog() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [status, setStatus] = useState<'watching' | 'finished' | 'want'>('watching');
  const [thought, setThought] = useState("");

  const mockResults = [
    { id: 1, title: "The Bear", type: "tv", year: "2022", image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=100&h=150&fit=crop" },
    { id: 2, title: "Gladiator II", type: "movie", year: "2024", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=100&h=150&fit=crop" },
    { id: 3, title: "The Penguin", type: "tv", year: "2024", image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100&h=150&fit=crop" },
    { id: 4, title: "Dune: Part Two", type: "movie", year: "2024", image: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=100&h=150&fit=crop" },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film className="w-4 h-4" />;
      case 'tv': return <Tv className="w-4 h-4" />;
      case 'book': return <Book className="w-4 h-4" />;
      case 'podcast': return <Headphones className="w-4 h-4" />;
      case 'music': return <Music className="w-4 h-4" />;
      default: return <Film className="w-4 h-4" />;
    }
  };

  const handlePost = () => {
    setLocation('/');
  };

  const filteredResults = query 
    ? mockResults.filter(m => m.title.toLowerCase().includes(query.toLowerCase()))
    : mockResults;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#12121f] to-[#1a1a2e]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => setLocation('/')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <Button 
            onClick={handlePost}
            disabled={!selectedItem}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-6 font-semibold"
          >
            Post
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Main Question */}
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 leading-tight">
          What are you watching /<br />reading / listening to?
        </h1>
        <p className="text-gray-500 text-center text-sm mb-8">Track it. Share it. Play with it.</p>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, shows, books, music..." 
            className="w-full h-14 pl-12 pr-4 bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
          />
        </div>

        {/* Selected Item */}
        {selectedItem && (
          <div className="bg-white rounded-2xl p-4 mb-6 shadow-xl">
            <div className="flex items-center gap-4">
              <img 
                src={selectedItem.image} 
                alt={selectedItem.title}
                className="w-16 h-20 rounded-xl object-cover shadow-md"
              />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{selectedItem.title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  {getTypeIcon(selectedItem.type)}
                  <span className="uppercase text-xs font-medium">{selectedItem.type}</span>
                  <span>•</span>
                  <span>{selectedItem.year}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Search Results (when no item selected) */}
        {!selectedItem && (
          <div className="space-y-2 mb-6">
            {filteredResults.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-purple-500/30 text-left"
              >
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-12 h-16 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                    {getTypeIcon(item.type)}
                    <span className="uppercase text-xs">{item.type}</span>
                    <span>•</span>
                    <span>{item.year}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Status & Thought (only when item selected) */}
        {selectedItem && (
          <>
            {/* What do you want to say? */}
            <div className="bg-white rounded-2xl p-4 mb-6 shadow-xl">
              <label className="block text-gray-900 font-semibold mb-1">
                What do you want to say?
              </label>
              <p className="text-gray-500 text-sm mb-3">(share a thought, moment, or update)</p>
              <Textarea 
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                placeholder="This show is incredible..."
                className="w-full min-h-[80px] border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Status Pills */}
            <div className="bg-white rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white text-lg">👤</span>
                </div>
                <div className="flex gap-2 flex-1">
                  <button
                    onClick={() => setStatus('watching')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      status === 'watching'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'watching' && '✓ '}Watching
                  </button>
                  <button
                    onClick={() => setStatus('finished')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      status === 'finished'
                        ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'finished' && '✓ '}Finished
                  </button>
                  <button
                    onClick={() => setStatus('want')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      status === 'want'
                        ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'want' && '✓ '}Want to
                  </button>
                </div>
              </div>
            </div>

            {/* Points hint */}
            <p className="text-center text-gray-500 text-sm mt-6">
              Post to earn <span className="text-purple-400 font-semibold">+10 XP</span> and unlock games for this title
            </p>
          </>
        )}
      </div>
    </div>
  );
}
