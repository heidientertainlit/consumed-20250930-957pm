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
import { Plus, ChevronLeft, ChevronDown, Loader2, ArrowBigUp, ArrowBigDown, Globe, Lock, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RanksCarousel } from "@/components/ranks-carousel";

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
  const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});

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

  // Fetch public community ranks directly from Supabase
  const { data: publicRanksData, isLoading: isLoadingPublic } = useQuery({
    queryKey: ['public-ranks-play'],
    queryFn: async () => {
      const { data: ranksData, error } = await supabase
        .from('ranks')
        .select('id, title, description, user_id, visibility, created_at')
        .eq('visibility', 'public')
        .neq('origin_type', 'consumed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !ranksData || ranksData.length === 0) return [];

      const rankIds = ranksData.map(r => r.id);
      const userIds = [...new Set(ranksData.map(r => r.user_id).filter(Boolean))];

      const [{ data: allItems }, { data: usersData }] = await Promise.all([
        supabase
          .from('rank_items')
          .select('id, rank_id, position, title, media_type, creator, image_url, up_vote_count, down_vote_count')
          .in('rank_id', rankIds)
          .order('position', { ascending: true }),
        supabase
          .from('users')
          .select('id, user_name, display_name')
          .in('id', userIds),
      ]);

      const itemsByRank: Record<string, any[]> = {};
      (allItems || []).forEach((item: any) => {
        if (!itemsByRank[item.rank_id]) itemsByRank[item.rank_id] = [];
        itemsByRank[item.rank_id].push(item);
      });
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

      return ranksData
        .filter(rank => (itemsByRank[rank.id] || []).length > 0)
        .map(rank => {
          const author = usersMap.get(rank.user_id) as any;
          return {
            postId: rank.id,
            rank: {
              id: rank.id,
              title: rank.title,
              description: rank.description,
              user_id: rank.user_id,
              visibility: rank.visibility,
              items: itemsByRank[rank.id] || [],
            },
            author: {
              id: rank.user_id,
              user_name: author?.user_name || 'Unknown',
              display_name: author?.display_name,
            },
            isConsumed: false,
            createdAt: rank.created_at,
            likesCount: 0,
            commentsCount: 0,
          };
        });
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

  const communityRanks = publicRanksData || [];
  const myRanks = userRanksData || [];

  const applyFilters = (items: any[]) => {
    let result = items;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item: any) => {
        const title = item.rank?.title?.toLowerCase() || '';
        return title.includes(query);
      });
    }
    if (selectedCategory) {
      result = result.filter((item: any) => {
        const title = item.rank?.title?.toLowerCase() || '';
        const categoryLower = selectedCategory.toLowerCase();
        if (title.includes(categoryLower)) return true;
        const items = item.rank?.items || [];
        return items.some((i: any) =>
          i.media_type?.toLowerCase() === categoryLower ||
          i.media_type?.toLowerCase().includes(categoryLower)
        );
      });
    }
    return result;
  };

  const filteredCommunityRanks = useMemo(() => applyFilters(
    communityRanks.filter((item: any) => item.rank?.id && item.rank?.items?.length > 0)
  ), [communityRanks, searchQuery, selectedCategory]);

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />

      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-8 relative">
          <button
            onClick={() => window.history.back()}
            className="absolute left-4 top-6 flex items-center text-gray-400 hover:text-white transition-colors"
            data-testid="back-button"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center gap-4 pt-1">
            <h1 className="text-2xl font-semibold text-white tracking-tight" data-testid="ranks-title">Ranks</h1>
            <button
              onClick={() => setIsCreateRankOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-green-400 hover:from-blue-600 hover:to-green-500 text-white rounded-full px-5 py-2 text-sm font-semibold shadow-lg"
            >
              <Plus size={14} />
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

        {/* Consumed Ranks Section — Debate the Rank carousel */}
        <div className="mb-6">
          <RanksCarousel expanded={true} offset={0} />
        </div>

        {/* Community Ranks Section */}
        {isLoadingPublic ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>

            {/* Community Ranks Section */}
            {filteredCommunityRanks.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Community Ranks</p>
                      <p className="text-[10px] text-gray-500">Ranked by users</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{filteredCommunityRanks.length} lists</span>
                </div>
                <div className="space-y-4">
                  {filteredCommunityRanks.map((item: any) => (
                    <div
                      key={item.postId || item.rank?.id}
                      className="relative cursor-pointer"
                      onClick={() => {
                        if (item.rank?.id) {
                          setLocation(`/rank/${item.rank.id}?user=${item.author?.id}`);
                        }
                      }}
                    >
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full uppercase tracking-wide">
                              RANK
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                              <Users size={10} />
                              Community
                            </span>
                          </div>
                          {item.author && (
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
                          <div className="mb-3">
                            <h3 className="font-semibold text-gray-900">{item.rank?.title || 'Untitled Rank'}</h3>
                          </div>
                          <div className="space-y-2">
                            {(item.rank?.items || []).slice(0, expandedRanks[item.postId] ? undefined : 3).map((rankItem: any, idx: number) => (
                              <div key={rankItem.id || idx} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded bg-orange-100 text-orange-700">
                                  {rankItem.position || idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{rankItem.title}</p>
                                  {rankItem.creator && rankItem.creator.toLowerCase() !== 'unknown' && (
                                    <p className="text-xs text-gray-500 truncate">{rankItem.creator}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-auto">
                                  {rankItem.id && (
                                    <>
                                      <button
                                        onClick={(e) => handleVote(e, rankItem.id, 'up', item.rank?.user_id)}
                                        disabled={voteMutation.isPending}
                                        className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${localVotes[rankItem.id] === 'up' ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}
                                      >
                                        <ArrowBigUp size={14} />
                                        <span className="text-[10px] font-medium">
                                          {(rankItem.up_vote_count || 0) + (localVotes[rankItem.id] === 'up' ? 1 : 0)}
                                        </span>
                                      </button>
                                      <button
                                        onClick={(e) => handleVote(e, rankItem.id, 'down', item.rank?.user_id)}
                                        disabled={voteMutation.isPending}
                                        className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${localVotes[rankItem.id] === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRanks(prev => ({ ...prev, [item.postId]: !prev[item.postId] }));
                                }}
                                className="w-full text-xs text-purple-600 text-center py-1 hover:text-purple-800 transition-colors"
                              >
                                {expandedRanks[item.postId]
                                  ? 'Show less'
                                  : `+${item.rank.items.length - 3} more items`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
