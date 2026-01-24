import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Plus, Users, Trophy, ChevronRight, Copy, Check, Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/navigation';

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
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolDescription, setNewPoolDescription] = useState('');
  const [createSharedList, setCreateSharedList] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
        <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Your Pools</h1>
              <p className="text-xs text-gray-500">Compete with friends on predictions</p>
            </div>
          </div>
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
                <DialogContent className="bg-white border-gray-200 max-w-sm rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Create a Pool</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Pool name (e.g., Bachelor Watch Party)"
                      value={newPoolName}
                      onChange={(e) => setNewPoolName(e.target.value)}
                      className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400"
                    />
                    <Textarea
                      placeholder="Description (optional)"
                      value={newPoolDescription}
                      onChange={(e) => setNewPoolDescription(e.target.value)}
                      className="bg-gray-50 border-gray-300 text-gray-900 resize-none placeholder:text-gray-400"
                      rows={3}
                    />
                    <label className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={createSharedList}
                        onChange={(e) => setCreateSharedList(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Add a shared list to this pool</p>
                        <p className="text-xs text-gray-500">Perfect for book clubs - members can add media together</p>
                      </div>
                    </label>
                    <Button
                      onClick={() => createPoolMutation.mutate()}
                      disabled={!newPoolName.trim() || createPoolMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {createPoolMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Create Pool
                    </Button>
                  </div>
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
            {pools.map((pool) => (
              <Link key={pool.id} href={`/pool/${pool.id}`}>
                <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-purple-300 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{pool.name}</h3>
                        {pool.is_host && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-medium">HOST</span>
                        )}
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          pool.status === 'open' ? 'bg-green-100 text-green-700' :
                          pool.status === 'locked' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {pool.status.toUpperCase()}
                        </span>
                      </div>
                      {pool.description && (
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{pool.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {pool.member_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy size={12} className="text-amber-500" />
                          {pool.user_points} pts
                        </span>
                        <span>{pool.resolved_count}/{pool.prompt_count} resolved</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          copyInviteCode(pool.invite_code);
                        }}
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        title="Copy invite code"
                      >
                        {copiedCode === pool.invite_code ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <Copy size={14} className="text-gray-500" />
                        )}
                      </button>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
