import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Plus, ChevronLeft, ChevronDown, Loader2, Award, ArrowBigUp, ArrowBigDown, Globe, Lock, Users } from "lucide-react";

const SUPABASE_URL = 'https://mahpgcogwpawvviapqza.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function PlayRanks() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateRankOpen, setIsCreateRankOpen] = useState(false);
  const [newRankName, setNewRankName] = useState("");
  const [newRankVisibility, setNewRankVisibility] = useState("public");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'topic' | null>(null);
  const [localVotes, setLocalVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  const voteMutation = useMutation({
    mutationFn: async ({ rankItemId, direction }: { rankItemId: string; direction: 'up' | 'down' }) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/vote-rank-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ rankItemId, direction }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to vote');
      }
      return response.json();
    },
    onError: (error: Error) => {
      toast({ title: 'Vote failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleVote = (e: React.MouseEvent, rankItemId: string, direction: 'up' | 'down', ownerId?: string) => {
    e.stopPropagation();
    if (!session?.access_token) {
      toast({ title: 'Sign in to vote', variant: 'destructive' });
      return;
    }
    if (ownerId && ownerId === user?.id) {
      toast({ title: "Can't vote on your own rank", variant: 'destructive' });
      return;
    }
    const current = localVotes[rankItemId];
    const newVote = current === direction ? null : direction;
    setLocalVotes(prev => ({ ...prev, [rankItemId]: newVote }));
    voteMutation.mutate({ rankItemId, direction });
  };

  const categoryFilters = [
    { id: 'Movies', label: 'Movies' },
    { id: 'TV', label: 'TV Shows' },
    { id: 'Music', label: 'Music' },
    { id: 'Books', label: 'Books' },
    { id: 'Sports', label: 'Sports' },
    { id: 'Games', label: 'Games' },
    { id: 'Podcasts', label: 'Podcasts' },
  ];

  // Fetch Consumed-curated ranks from backend
  const { data: consumedRanksData, isLoading: isLoadingConsumed } = useQuery({
    queryKey: ['consumed-ranks'],
    queryFn: async () => {
      try {
        const response = await fetch(
          'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-consumed-ranks',
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
            },
          }
        );
        
        if (!response.ok) {
          console.log('get-consumed-ranks not available, using fallback');
          return null;
        }
        
        const data = await response.json();
        console.log('Consumed ranks fetched:', data.ranks?.length || 0);
        
        if (data.needsSeeding) {
          console.log('Seeding Consumed ranks...');
          await fetch(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-consumed-ranks?action=seed',
            { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY } }
          );
          const refetchResponse = await fetch(
            'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-consumed-ranks',
            { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY } }
          );
          if (refetchResponse.ok) {
            const refetchData = await refetchResponse.json();
            return refetchData.ranks || null;
          }
        }
        
        return data.ranks || null;
      } catch (error) {
        console.log('Error fetching consumed ranks:', error);
        return null;
      }
    },
    staleTime: 60000,
  });

  // Fetch public community ranks via edge function
  const { data: publicRanksData, isLoading: isLoadingPublic } = useQuery({
    queryKey: ['public-ranks', selectedCategory, searchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCategory) params.set('topic', selectedCategory);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        params.set('limit', '30');
        
        const response = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-public-ranks?${params.toString()}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) {
          console.log('get-public-ranks not available');
          return [];
        }
        
        const data = await response.json();
        console.log('Public ranks fetched:', data.ranks?.length || 0);
        return data.ranks || [];
      } catch (error) {
        console.log('Error fetching public ranks:', error);
        return [];
      }
    },
    staleTime: 30000,
  });

  // Fetch current user's ranks to show as examples
  const { data: userRanksData } = useQuery({
    queryKey: ['my-ranks-for-discovery'],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      try {
        const response = await fetch(
          'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks',
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) return [];
        
        const data = await response.json();
        console.log('User ranks fetched:', data.ranks?.length || 0);
        
        // Transform user ranks to match the display format - only show public ones
        return (data.ranks || [])
          .filter((rank: any) => rank.visibility === 'public' && rank.items?.length > 0)
          .map((rank: any) => ({
            postId: rank.id,
            rank: {
              id: rank.id,
              title: rank.title,
              user_id: rank.user_id,
              visibility: rank.visibility,
              items: rank.items?.slice(0, 5) || [],
            },
            author: {
              id: rank.user_id,
              user_name: user?.user_metadata?.user_name || 'You',
              display_name: user?.user_metadata?.display_name,
            },
            isConsumed: false,
            createdAt: rank.created_at,
            likesCount: 0,
            commentsCount: 0,
          }));
      } catch (error) {
        console.log('Error fetching user ranks:', error);
        return [];
      }
    },
    enabled: !!session?.access_token,
    staleTime: 30000,
  });

  // Fallback Consumed ranks if backend not available
  const fallbackConsumedRanks = [
    {
      postId: 'consumed-best-90s-movies',
      rank: {
        id: 'consumed-best-90s-movies',
        title: 'Best 90s Movies',
        user_id: 'consumed',
        visibility: 'public',
        items: [
          { id: '1', position: 1, title: 'Pulp Fiction', media_type: 'movie', creator: 'Quentin Tarantino' },
          { id: '2', position: 2, title: 'The Shawshank Redemption', media_type: 'movie', creator: 'Frank Darabont' },
          { id: '3', position: 3, title: 'Fight Club', media_type: 'movie', creator: 'David Fincher' },
        ],
      },
      author: { id: 'consumed', user_name: 'Consumed', display_name: 'Consumed' },
      isConsumed: true,
      createdAt: new Date().toISOString(),
      likesCount: 42,
      commentsCount: 8,
    },
    {
      postId: 'consumed-top-sci-fi-shows',
      rank: {
        id: 'consumed-top-sci-fi-shows',
        title: 'Top Sci-Fi TV Shows',
        user_id: 'consumed',
        visibility: 'public',
        items: [
          { id: '1', position: 1, title: 'Breaking Bad', media_type: 'tv', creator: 'Vince Gilligan' },
          { id: '2', position: 2, title: 'Black Mirror', media_type: 'tv', creator: 'Charlie Brooker' },
          { id: '3', position: 3, title: 'Stranger Things', media_type: 'tv', creator: 'The Duffer Brothers' },
        ],
      },
      author: { id: 'consumed', user_name: 'Consumed', display_name: 'Consumed' },
      isConsumed: true,
      createdAt: new Date().toISOString(),
      likesCount: 35,
      commentsCount: 12,
    },
    {
      postId: 'consumed-goat-albums',
      rank: {
        id: 'consumed-goat-albums',
        title: 'GOAT Albums of All Time',
        user_id: 'consumed',
        visibility: 'public',
        items: [
          { id: '1', position: 1, title: 'Thriller', media_type: 'music', creator: 'Michael Jackson' },
          { id: '2', position: 2, title: 'Abbey Road', media_type: 'music', creator: 'The Beatles' },
          { id: '3', position: 3, title: 'To Pimp a Butterfly', media_type: 'music', creator: 'Kendrick Lamar' },
        ],
      },
      author: { id: 'consumed', user_name: 'Consumed', display_name: 'Consumed' },
      isConsumed: true,
      createdAt: new Date().toISOString(),
      likesCount: 28,
      commentsCount: 5,
    },
  ];

  // Use backend Consumed ranks if available, otherwise fallback
  const consumedRanks = consumedRanksData || fallbackConsumedRanks;

  // Combine Consumed showcase ranks with community public ranks and user ranks
  const communityRanks = (publicRanksData || []).map((item: any) => ({
    ...item,
    postId: item.rank?.id,
    isConsumed: false,
  }));
  const myRanks = userRanksData || [];
  
  // Consumed showcases first, then user's ranks, then community ranks
  const allRanks = [...consumedRanks, ...myRanks, ...communityRanks];

  // Filter ranks
  const filteredRanks = useMemo(() => {
    // Start with ranks that have valid IDs and at least one item (or are Consumed showcase)
    let result = allRanks.filter((item: any) => {
      if (item.isConsumed) return true; // Always show Consumed showcase ranks
      return item.rank?.id && (item.rank?.items?.length > 0 || item.rank?.title);
    });

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item: any) => {
        const title = item.rank?.title?.toLowerCase() || '';
        return title.includes(query);
      });
    }

    // Category filter - match rank title or items' media types
    if (selectedCategory) {
      result = result.filter((item: any) => {
        const title = item.rank?.title?.toLowerCase() || '';
        const categoryLower = selectedCategory.toLowerCase();
        
        // Check if title mentions the category
        if (title.includes(categoryLower)) return true;
        
        // Check items' media types
        const items = item.rank?.items || [];
        return items.some((i: any) => 
          i.media_type?.toLowerCase() === categoryLower ||
          i.media_type?.toLowerCase().includes(categoryLower)
        );
      });
    }

    return result;
  }, [allRanks, searchQuery, selectedCategory]);

  const createRankMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !newRankName.trim()) throw new Error('Missing title or session');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-rank',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: newRankName.trim(),
            visibility: newRankVisibility,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to create rank');
      return response.json();
    },
    onSuccess: (data) => {
      const rankId = data?.data?.id;
      setNewRankName("");
      setNewRankVisibility("public");
      setIsCreateRankOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-ranks-for-discovery'] });
      queryClient.invalidateQueries({ queryKey: ['public-ranks'] });
      if (rankId) {
        setLocation(`/rank/${rankId}`);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create rank", variant: "destructive" });
    },
  });

  const isLoading = isLoadingPublic || isLoadingConsumed;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />

      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="flex items-center text-gray-400 hover:text-white transition-colors"
                data-testid="back-button"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-2xl font-semibold text-white" data-testid="ranks-title">Ranks</h1>
            </div>
            <button
              onClick={() => setIsCreateRankOpen(true)}
              className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
            >
              <Plus size={13} />
              Create Rank
            </button>
          </div>

        </div>
      </div>

      {/* Create Rank Dialog */}
      <Dialog open={isCreateRankOpen} onOpenChange={setIsCreateRankOpen}>
        <DialogContent className="rounded-2xl !bg-white w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Create Rank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Title</label>
              <Input
                className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                placeholder="e.g. Best Movies of 2024"
                value={newRankName}
                onChange={(e) => setNewRankName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newRankName.trim()) createRankMutation.mutate();
                }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Visibility</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewRankVisibility('public')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    newRankVisibility === 'public'
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Globe size={15} />
                  Public
                </button>
                <button
                  onClick={() => setNewRankVisibility('private')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    newRankVisibility === 'private'
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Lock size={15} />
                  Private
                </button>
              </div>
            </div>
            <Button
              className="w-full text-white rounded-xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
              onClick={() => createRankMutation.mutate()}
              disabled={!newRankName.trim() || createRankMutation.isPending}
            >
              {createRankMutation.isPending ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Creating...</>
              ) : (
                'Create & Add Items'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Ranks List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-xl p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
                <div className="space-y-2">
                  <div className="h-10 bg-gray-100 rounded" />
                  <div className="h-10 bg-gray-100 rounded" />
                  <div className="h-10 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRanks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <Trophy className="mx-auto mb-3 text-gray-300" size={48} />
            <p className="text-gray-600 mb-2">No ranks found</p>
            <p className="text-sm text-gray-500 mb-4">Be the first to create a ranked list!</p>
            <Button 
              onClick={() => setIsCreateRankOpen(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus size={16} className="mr-2" />
              Create Rank
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Community Rankings</p>
                  <p className="text-[10px] text-gray-500">Tap to explore</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{filteredRanks.length} lists</span>
            </div>
          <div className="space-y-4">
            {filteredRanks.map((item: any) => (
              <div 
                key={item.postId} 
                className="relative cursor-pointer"
                onClick={() => {
                  if (!item.isConsumed && item.rank?.id) {
                    setLocation(`/rank/${item.rank.id}?user=${item.author?.id}`);
                  }
                }}
              >
                {/* Rank showcase card */}
                <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                  item.isConsumed ? 'border-purple-200' : 'border-gray-200'
                }`}>
                  <div className="p-4">
                    {/* Pill badges */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full uppercase tracking-wide">
                        RANK
                      </span>
                      {item.isConsumed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-600 text-white text-[10px] font-semibold rounded-full uppercase tracking-wide">
                          <Award size={9} />
                          Consumed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                          <Users size={10} />
                          Community
                        </span>
                      )}
                    </div>
                    {/* Author info for community ranks */}
                    {!item.isConsumed && item.author && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {(item.author.user_name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">@{item.author.user_name}</span>
                          <span className="text-xs text-gray-500 ml-2">shared a ranked list</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className={item.isConsumed ? "text-purple-500" : "text-orange-500"} size={18} />
                      <h3 className="font-semibold text-gray-900">{item.rank?.title || 'Untitled Rank'}</h3>
                    </div>
                    
                    <div className="space-y-2">
                      {(item.rank?.items || []).slice(0, 3).map((rankItem: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                          <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded ${
                            item.isConsumed 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {rankItem.position || idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{rankItem.title}</p>
                            {rankItem.creator && rankItem.creator.toLowerCase() !== 'unknown' && (
                              <p className="text-xs text-gray-500 truncate">{rankItem.creator}</p>
                            )}
                          </div>
                          
                          {/* Up/down vote buttons — only for real DB items */}
                          <div className="flex items-center gap-1 ml-auto">
                            {rankItem.id && rankItem.id.length >= 10 && (
                              <>
                                <button
                                  onClick={(e) => handleVote(e, rankItem.id, 'up', item.rank?.user_id)}
                                  disabled={voteMutation.isPending}
                                  className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                                    localVotes[rankItem.id] === 'up'
                                      ? 'text-green-500'
                                      : 'text-gray-400 hover:text-green-500'
                                  }`}
                                >
                                  <ArrowBigUp size={14} />
                                  <span className="text-[10px] font-medium">
                                    {(rankItem.up_vote_count || 0) + (localVotes[rankItem.id] === 'up' ? 1 : 0)}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => handleVote(e, rankItem.id, 'down', item.rank?.user_id)}
                                  disabled={voteMutation.isPending}
                                  className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                                    localVotes[rankItem.id] === 'down'
                                      ? 'text-red-500'
                                      : 'text-gray-400 hover:text-red-500'
                                  }`}
                                >
                                  <ArrowBigDown size={14} />
                                  <span className="text-[10px] font-medium">
                                    {(rankItem.down_vote_count || 0) + (localVotes[rankItem.id] === 'down' ? 1 : 0)}
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {(item.rank?.items?.length || 0) > 3 && (
                        <p className="text-xs text-purple-600 text-center py-1">
                          +{item.rank.items.length - 3} more items
                        </p>
                      )}
                    </div>
                    
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
