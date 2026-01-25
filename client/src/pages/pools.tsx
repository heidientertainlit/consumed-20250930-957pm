import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Plus, Users, Trophy, ChevronRight, Copy, Check, Loader2, Tv, X, Search, ArrowLeft, Film, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/navigation';

interface SelectedFriend {
  id: string;
  user_name: string;
  display_name?: string;
}

interface SelectedMedia {
  id: string;
  title: string;
  image: string;
  type: string;
}

interface Pool {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  status: string;
  category: string | null;
  deadline: string | null;
  is_public: boolean;
  created_at: string;
  role: string;
  user_points: number;
  member_count: number;
  prompt_count: number;
  resolved_count: number;
  is_host: boolean;
  host: {
    user_name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function PoolsPage() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolDescription, setNewPoolDescription] = useState('');
  const [createSharedList, setCreateSharedList] = useState(false);
  const [poolType, setPoolType] = useState<'eliminations' | 'tournament'>('eliminations');
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Friend selection
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<SelectedFriend[]>([]);
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  
  // Media selection
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaResults, setMediaResults] = useState<any[]>([]);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);

  const { data: poolsData, isLoading } = useQuery({
    queryKey: ['user-pools'],
    queryFn: async () => {
      if (!session?.access_token) return { pools: [] };
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-pools`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch pools');
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const createPoolMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pool`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newPoolName,
            description: newPoolDescription || null,
            create_shared_list: createSharedList,
            pool_type: poolType,
            invited_friends: selectedFriends.map(f => f.id),
            media_id: selectedMedia?.id || null,
            media_title: selectedMedia?.title || null,
            media_image: selectedMedia?.image || null,
            media_type: selectedMedia?.type || null,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create pool');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setIsCreateOpen(false);
      setNewPoolName('');
      setNewPoolDescription('');
      setCreateSharedList(false);
      setPoolType('eliminations');
      setCreateStep(1);
      setSelectedFriends([]);
      setSelectedMedia(null);
      setFriendSearch('');
      setMediaSearch('');
      setMediaResults([]);
      setLocation(`/pool/${data.pool.id}`);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const joinPoolMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-pool`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invite_code: joinCode }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join pool');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setIsJoinOpen(false);
      setJoinCode('');
      toast({ title: data.already_member ? 'Already a member!' : 'Joined pool!', description: data.pool.name });
      setLocation(`/pool/${data.pool.id}`);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Friend search function - searches from accepted friends only
  const searchFriends = async (query: string) => {
    if (!query || query.length < 2 || !session?.access_token || !user?.id) {
      setFriendSearchResults([]);
      return;
    }
    
    setIsSearchingFriends(true);
    try {
      // Get user's accepted friends from friendships table
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('friend_id, users:friend_id(id, user_name, display_name)')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      
      if (error || !friendships) {
        setFriendSearchResults([]);
        return;
      }
      
      // Filter friends by search query and exclude already selected
      const queryLower = query.toLowerCase();
      const filtered = friendships
        .map((f: any) => f.users)
        .filter((u: any) => u && (
          u.user_name?.toLowerCase().includes(queryLower) ||
          u.display_name?.toLowerCase().includes(queryLower)
        ))
        .filter((u: any) => !selectedFriends.find(f => f.id === u.id))
        .slice(0, 10);
      
      setFriendSearchResults(filtered);
    } catch (e) {
      console.error('Friend search error:', e);
    } finally {
      setIsSearchingFriends(false);
    }
  };

  // Media search function
  const searchMedia = async (query: string) => {
    if (!query || query.length < 2) {
      setMediaResults([]);
      return;
    }
    setIsSearchingMedia(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, types: ['tv', 'movie'] }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setMediaResults(data.results || []);
      }
    } catch (e) {
      console.error('Media search error:', e);
    } finally {
      setIsSearchingMedia(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const pools: Pool[] = poolsData?.pools || [];

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
            <Users className="text-purple-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pools</h1>
          <p className="text-gray-500 mb-6">Sign in to create and join prediction pools with friends</p>
          <Link href="/login">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Pools</h1>
          <p className="text-gray-500 text-sm">See how you stack up</p>
        </div>

        {/* Action Buttons */}
        <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex gap-2">
            <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 rounded-full border-purple-300 text-purple-700 hover:bg-purple-50">
                  Join
                </Button>
              </DialogTrigger>
                <DialogContent className="bg-white border-gray-200 max-w-sm rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Join a Pool</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Enter invite code (e.g., ABC123)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="bg-gray-50 border-gray-300 text-gray-900 uppercase placeholder:text-gray-400"
                      maxLength={6}
                    />
                    <Button
                      onClick={() => joinPoolMutation.mutate()}
                      disabled={!joinCode.trim() || joinPoolMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {joinPoolMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Join Pool
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                  <Plus size={16} className="mr-1" />
                  Create
                </Button>
              </DialogTrigger>
                <DialogContent className="bg-white border-gray-200 max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 flex items-center gap-2">
                      {createStep === 2 && (
                        <button onClick={() => setCreateStep(1)} className="p-1 hover:bg-gray-100 rounded">
                          <ArrowLeft size={18} />
                        </button>
                      )}
                      Create a Pool
                    </DialogTitle>
                  </DialogHeader>
                  
                  {createStep === 1 ? (
                    /* Step 1: Choose Pool Type */
                    <div className="space-y-4 pt-4">
                      <p className="text-sm font-medium text-gray-700">What kind of pool?</p>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => { setPoolType('eliminations'); setCreateStep(2); }}
                          className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                            <Tv size={18} className="text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Eliminations</p>
                            <p className="text-xs text-gray-500">Weekly picks - who goes home?</p>
                          </div>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => { setPoolType('tournament'); setCreateStep(2); }}
                          className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                            <Trophy size={18} className="text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Tournament</p>
                            <p className="text-xs text-gray-500">Bracket-style matchups</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Step 2: Name, Invite Friends, Choose Media */
                    <div className="space-y-4 pt-4">
                      {/* Pool Name */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Pool name</label>
                        <Input
                          placeholder="e.g., Traitors Season 3"
                          value={newPoolName}
                          onChange={(e) => setNewPoolName(e.target.value)}
                          className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400"
                        />
                      </div>

                      {/* Invite Friends */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Invite friends (optional)</label>
                        {selectedFriends.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {selectedFriends.map(friend => (
                              <div key={friend.id} className="flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                                <span>@{friend.user_name}</span>
                                <button onClick={() => setSelectedFriends(selectedFriends.filter(f => f.id !== friend.id))} className="hover:text-purple-600">
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <Input
                            placeholder="Search friends..."
                            value={friendSearch}
                            onChange={(e) => {
                              setFriendSearch(e.target.value);
                              searchFriends(e.target.value);
                            }}
                            className="pl-9 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400"
                          />
                          {isSearchingFriends && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-600 animate-spin" size={16} />
                          )}
                        </div>
                        {friendSearchResults.length > 0 && (
                          <div className="mt-2 border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                            {friendSearchResults.map((u: any) => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setSelectedFriends([...selectedFriends, { id: u.id, user_name: u.user_name, display_name: u.display_name }]);
                                  setFriendSearch('');
                                  setFriendSearchResults([]);
                                }}
                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left text-sm"
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="bg-purple-600 text-white text-xs">
                                    {(u.display_name || u.user_name).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-gray-900">{u.display_name || u.user_name}</span>
                                <span className="text-gray-500">@{u.user_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Choose Media */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">What show/movie? (optional)</label>
                        {selectedMedia ? (
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            {selectedMedia.image ? (
                              <img src={selectedMedia.image} alt="" className="w-10 h-14 object-cover rounded" />
                            ) : (
                              <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center">
                                <Film size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{selectedMedia.title}</p>
                              <p className="text-xs text-gray-500 capitalize">{selectedMedia.type}</p>
                            </div>
                            <button onClick={() => setSelectedMedia(null)} className="p-1 text-gray-400 hover:text-gray-600">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                              <Input
                                placeholder="Search shows or movies..."
                                value={mediaSearch}
                                onChange={(e) => {
                                  setMediaSearch(e.target.value);
                                  searchMedia(e.target.value);
                                }}
                                className="pl-9 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400"
                              />
                              {isSearchingMedia && (
                                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-gray-400" size={16} />
                              )}
                            </div>
                            {mediaResults.length > 0 && (
                              <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                                {mediaResults.slice(0, 5).map((item: any) => (
                                  <button
                                    key={item.external_id || item.id}
                                    onClick={() => {
                                      setSelectedMedia({
                                        id: item.external_id || item.id,
                                        title: item.title,
                                        image: item.poster_url || item.image_url || item.poster_path,
                                        type: item.type || 'tv'
                                      });
                                      setMediaSearch('');
                                      setMediaResults([]);
                                    }}
                                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left"
                                  >
                                    {(item.poster_url || item.image_url || item.poster_path) ? (
                                      <img src={item.poster_url || item.image_url || item.poster_path} alt="" className="w-8 h-12 object-cover rounded" />
                                    ) : (
                                      <div className="w-8 h-12 bg-gray-200 rounded flex items-center justify-center">
                                        <Film size={12} className="text-gray-400" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-900 truncate">{item.title}</p>
                                      <p className="text-xs text-gray-500 capitalize">{item.type} {item.year && `• ${item.year}`}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <Button
                        onClick={() => createPoolMutation.mutate()}
                        disabled={!newPoolName.trim() || createPoolMutation.isPending}
                        className="w-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      >
                        {createPoolMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                        Create Pool
                      </Button>
                    </div>
                  )}
                </DialogContent>
            </Dialog>
          </div>
        </Card>

        {isLoading ? (
          <Card className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
          </Card>
        ) : pools.length === 0 ? (
          <Card className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
              <BookOpen className="text-purple-600" size={28} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No pools yet</h2>
            <p className="text-gray-500 text-sm mb-6">Create a pool for your book club, watch party, or prediction game</p>
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
              <Plus size={16} className="mr-2" />
              Create Your First Pool
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {pools.map((pool) => {
              // Mock data for demo
              const userRank = Math.floor(Math.random() * 5) + 1;
              const rankSuffix = userRank === 1 ? 'st' : userRank === 2 ? 'nd' : userRank === 3 ? 'rd' : 'th';
              const daysLeft = Math.floor(Math.random() * 7) + 1;
              
              return (
                <Link key={pool.id} href={`/pool/${pool.id}`}>
                  <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-purple-300 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {pool.name.split(' ')[0]}: <span className="font-normal">{pool.name.split(' ').slice(1).join(' ') || 'Season 1'}</span>
                          </h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            pool.status === 'open' ? 'bg-green-100 text-green-700 border border-green-200' :
                            pool.status === 'locked' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {pool.status === 'open' ? 'Picks open' : pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          <Users size={12} className="inline mr-1" />
                          {pool.member_count} &nbsp;You're {userRank === 1 ? 'tied for' : 'in'} {userRank}{rankSuffix} place
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pool.status === 'open' && (
                          <span className="text-green-600 text-sm font-medium">{daysLeft} days left</span>
                        )}
                        <ChevronRight size={20} className="text-gray-400" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
