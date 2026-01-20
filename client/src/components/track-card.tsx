import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Plus, Film, Tv, BookOpen, Music, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";

interface MediaResult {
  id: string;
  title: string;
  type: string;
  year?: string;
  creator?: string;
  poster_url?: string;
  image_url?: string;
  external_id: string;
  external_source: string;
}

export default function TrackCard() {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [isListSheetOpen, setIsListSheetOpen] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('media-search', {
        body: { query, types: ['movie', 'tv', 'book', 'music'] }
      });

      if (error) throw error;
      setResults((data?.results || []).slice(0, 5));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenListSheet = (item: MediaResult) => {
    setSelectedMedia({
      title: item.title,
      mediaType: item.type,
      imageUrl: item.poster_url || item.image_url,
      externalId: item.external_id,
      externalSource: item.external_source,
      creator: item.creator
    });
    setIsListSheetOpen(true);
  };

  const handleNavigateToMedia = (item: MediaResult) => {
    setLocation(`/media/${item.external_source}/${item.external_id}`);
  };

  const handleSheetClose = () => {
    setIsListSheetOpen(false);
    setSelectedMedia(null);
    setSearchQuery("");
    setResults([]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film className="w-3 h-3" />;
      case 'tv': return <Tv className="w-3 h-3" />;
      case 'book': return <BookOpen className="w-3 h-3" />;
      case 'music': return <Music className="w-3 h-3" />;
      default: return <Film className="w-3 h-3" />;
    }
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-[#1a1035] via-[#12121f] to-[#0f0a1a] border-0 p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Quick Track</h3>
            <p className="text-gray-400 text-xs">Add to your history</p>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search movies, shows, books..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-10 rounded-full"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-400" />
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((item, index) => (
              <div
                key={`${item.external_source}-${item.external_id}-${index}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <button
                  onClick={() => handleNavigateToMedia(item)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  {(item.poster_url || item.image_url) ? (
                    <img
                      src={item.poster_url || item.image_url}
                      alt={item.title}
                      className="w-10 h-14 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-purple-900/50 flex items-center justify-center text-gray-400">
                      {getTypeIcon(item.type)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                      {getTypeIcon(item.type)}
                      <span className="uppercase">{item.type}</span>
                      {item.year && <span>• {item.year}</span>}
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleOpenListSheet(item)}
                  className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length === 0 && (
          <p className="text-gray-500 text-xs text-center py-2">
            Search to quickly add what you've consumed
          </p>
        )}
      </Card>

      <QuickAddListSheet
        isOpen={isListSheetOpen}
        onClose={handleSheetClose}
        media={selectedMedia}
      />
    </>
  );
}
