import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Plus, Users, Trophy, Clock, ChevronRight, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
      toast({ title: 'Pool created!', description: `Share code: ${data.pool.invite_code}` });
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
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Pools</h1>
          <p className="text-gray-400 mb-6">Sign in to create and join prediction pools with friends</p>
          <Link href="/login">
            <Button className="bg-purple-600 hover:bg-purple-700">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e] pb-24">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Pools</h1>
          <div className="flex gap-2">
            <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-purple-500 text-purple-400 hover:bg-purple-500/20">
                  Join
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1a1a2e] border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Join a Pool</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Enter invite code (e.g., ABC123)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="bg-[#0a0a0f] border-gray-600 text-white uppercase"
                    maxLength={6}
                  />
                  <Button
                    onClick={() => joinPoolMutation.mutate()}
                    disabled={!joinCode.trim() || joinPoolMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {joinPoolMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    Join Pool
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Plus size={16} className="mr-1" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1a1a2e] border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create a Pool</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Pool name (e.g., Bachelor Watch Party)"
                    value={newPoolName}
                    onChange={(e) => setNewPoolName(e.target.value)}
                    className="bg-[#0a0a0f] border-gray-600 text-white"
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={newPoolDescription}
                    onChange={(e) => setNewPoolDescription(e.target.value)}
                    className="bg-[#0a0a0f] border-gray-600 text-white resize-none"
                    rows={3}
                  />
                  <Button
                    onClick={() => createPoolMutation.mutate()}
                    disabled={!newPoolName.trim() || createPoolMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {createPoolMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    Create Pool
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-purple-500" size={32} />
          </div>
        ) : pools.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Users className="text-purple-400" size={32} />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No pools yet</h2>
            <p className="text-gray-400 text-sm mb-6">Create a pool to start making predictions with friends</p>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus size={16} className="mr-2" />
              Create Your First Pool
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {pools.map((pool) => (
              <Link key={pool.id} href={`/pool/${pool.id}`}>
                <div className="bg-[#1a1a2e] rounded-xl p-4 border border-gray-700/50 hover:border-purple-500/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white truncate">{pool.name}</h3>
                        {pool.is_host && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">HOST</span>
                        )}
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                          pool.status === 'open' ? 'bg-green-500/20 text-green-400' :
                          pool.status === 'locked' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {pool.status.toUpperCase()}
                        </span>
                      </div>
                      {pool.description && (
                        <p className="text-sm text-gray-400 line-clamp-1 mb-2">{pool.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {pool.member_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy size={12} />
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
                        className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                        title="Copy invite code"
                      >
                        {copiedCode === pool.invite_code ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="text-gray-400" />
                        )}
                      </button>
                      <ChevronRight size={20} className="text-gray-500" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
