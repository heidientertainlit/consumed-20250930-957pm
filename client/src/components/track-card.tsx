import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Plus, Film, Tv, BookOpen, Music, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/posthog";

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
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<MediaResult[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

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

  const handleQuickAdd = async (item: MediaResult) => {
    if (!session) {
      toast({ title: "Sign in to track", variant: "destructive" });
      return;
    }

    setAddingId(item.id);
    try {
      const { error } = await supabase.functions.invoke('track-media', {
        body: {
          media: {
            title: item.title,
            mediaType: item.type,
            imageUrl: item.poster_url || item.image_url,
            externalId: item.external_id,
            externalSource: item.external_source
          },
          listType: 'finished',
          skip_social_post: true
        }
      });

      if (error) throw error;

      setAddedIds(prev => new Set(prev).add(item.id));
      toast({ title: `Added "${item.title}" to your history` });
      trackEvent('quick_track_media', { 
        media_type: item.type, 
        title: item.title 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/list-items'] });
    } catch (err) {
      toast({ 
        title: "Couldn't add", 
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive" 
      });
    } finally {
      setAddingId(null);
    }
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
          {results.map((item) => {
            const isAdded = addedIds.has(item.id);
            const isAdding = addingId === item.id;
            
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                {(item.poster_url || item.image_url) ? (
                  <img
                    src={item.poster_url || item.image_url}
                    alt={item.title}
                    className="w-10 h-14 rounded object-cover"
                  />
                ) : (
                  <div className="w-10 h-14 rounded bg-purple-900/50 flex items-center justify-center">
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
                
                <button
                  onClick={() => handleQuickAdd(item)}
                  disabled={isAdding || isAdded}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isAdded 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 active:scale-95'
                  }`}
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAdded ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {searchQuery.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-2">
          Search to quickly add what you've consumed
        </p>
      )}
    </Card>
  );
}
