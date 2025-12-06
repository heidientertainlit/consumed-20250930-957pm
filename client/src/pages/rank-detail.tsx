import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Trophy, Plus, Search, GripVertical, Trash2, Globe, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

interface RankItem {
  id: string;
  position: number;
  title: string;
  media_type?: string;
  creator?: string;
  image_url?: string;
  external_id?: string;
  external_source?: string;
}

interface Rank {
  id: string;
  title: string;
  visibility: string;
  max_items: number;
  items: RankItem[];
}

interface MediaResult {
  id: string;
  title: string;
  media_type: string;
  creator?: string;
  image_url?: string;
  external_id: string;
  external_source: string;
}

export default function RankDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [rank, setRank] = useState<Rank | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (session?.access_token && id) {
      fetchRank();
    }
  }, [session?.access_token, id]);

  const fetchRank = async () => {
    if (!session?.access_token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${session.user?.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const foundRank = data.ranks?.find((r: Rank) => r.id === id);
        if (foundRank) {
          setRank(foundRank);
        } else {
          toast({
            title: "Rank not found",
            variant: "destructive"
          });
          setLocation('/me');
        }
      }
    } catch (error) {
      console.error('Error fetching rank:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !session?.access_token) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const results: MediaResult[] = [];
        
        if (data.movies) {
          data.movies.forEach((m: any) => results.push({
            id: `movie-${m.id}`,
            title: m.title,
            media_type: 'movie',
            creator: m.release_date?.split('-')[0],
            image_url: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : undefined,
            external_id: String(m.id),
            external_source: 'tmdb'
          }));
        }
        if (data.tv) {
          data.tv.forEach((t: any) => results.push({
            id: `tv-${t.id}`,
            title: t.name,
            media_type: 'tv',
            creator: t.first_air_date?.split('-')[0],
            image_url: t.poster_path ? `https://image.tmdb.org/t/p/w200${t.poster_path}` : undefined,
            external_id: String(t.id),
            external_source: 'tmdb'
          }));
        }
        if (data.books) {
          data.books.forEach((b: any) => results.push({
            id: `book-${b.key}`,
            title: b.title,
            media_type: 'book',
            creator: b.author_name?.[0],
            image_url: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : undefined,
            external_id: b.key,
            external_source: 'openlibrary'
          }));
        }
        if (data.music) {
          data.music.forEach((m: any) => results.push({
            id: `music-${m.id}`,
            title: m.name,
            media_type: 'music',
            creator: m.artists?.[0]?.name,
            image_url: m.album?.images?.[0]?.url,
            external_id: m.id,
            external_source: 'spotify'
          }));
        }

        setSearchResults(results.slice(0, 20));
      }
    } catch (error) {
      console.error('Error searching media:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddItem = async (media: MediaResult) => {
    if (!session?.access_token || !rank) return;

    setIsAddingItem(true);
    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-rank-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rank_id: rank.id,
          title: media.title,
          media_type: media.media_type,
          creator: media.creator,
          image_url: media.image_url,
          external_id: media.external_id,
          external_source: media.external_source
        }),
      });

      if (response.ok) {
        toast({
          title: "Added!",
          description: `"${media.title}" added to your rank`,
        });
        setShowAddDialog(false);
        setSearchQuery('');
        setSearchResults([]);
        fetchRank();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add item');
      }
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast({
        title: "Failed to add",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleDeleteRank = async () => {
    if (!session?.access_token || !rank) return;
    
    if (!confirm('Are you sure you want to delete this rank?')) return;

    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/delete-rank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rank_id: rank.id }),
      });

      if (response.ok) {
        toast({
          title: "Rank deleted",
        });
        setLocation('/me');
      }
    } catch (error) {
      console.error('Error deleting rank:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    );
  }

  if (!rank) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Rank not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/me')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{rank.title}</h1>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                {rank.visibility === 'public' ? (
                  <>
                    <Globe size={12} />
                    <span>Public</span>
                  </>
                ) : (
                  <>
                    <Lock size={12} />
                    <span>Private</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleDeleteRank}
            className="p-2 hover:bg-red-50 rounded-full transition-colors"
            data-testid="button-delete-rank"
          >
            <Trash2 size={18} className="text-red-500" />
          </button>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {rank.items && rank.items.length > 0 ? (
          <div className="space-y-2 mb-4">
            {rank.items.map((item, index) => (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
                data-testid={`rank-item-${item.id}`}
              >
                <div className="flex items-center gap-2 text-gray-400">
                  <GripVertical size={16} />
                  <span className="font-bold text-lg text-purple-600 w-6 text-center">
                    {index + 1}
                  </span>
                </div>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                    <Trophy size={20} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                  {item.creator && (
                    <p className="text-sm text-gray-500 truncate">{item.creator}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200 mb-4">
            <Trophy className="text-gray-300 mx-auto mb-3" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No items yet</h3>
            <p className="text-gray-500 mb-4">Start adding items to your rank</p>
          </div>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              data-testid="button-add-item"
            >
              <Plus size={18} className="mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Add to Rank</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mb-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, TV, books, music..."
                className="flex-1 bg-white border-gray-300 text-gray-900"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                data-testid="input-media-search"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-search"
              >
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleAddItem(result)}
                  disabled={isAddingItem}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                  data-testid={`search-result-${result.id}`}
                >
                  {result.image_url ? (
                    <img
                      src={result.image_url}
                      alt={result.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <Trophy size={20} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{result.title}</h4>
                    <p className="text-sm text-gray-500 truncate">
                      {result.creator && `${result.creator} • `}
                      <span className="capitalize">{result.media_type}</span>
                    </p>
                  </div>
                </button>
              ))}
              {searchResults.length === 0 && searchQuery && !isSearching && (
                <p className="text-center text-gray-500 py-8">No results found</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
