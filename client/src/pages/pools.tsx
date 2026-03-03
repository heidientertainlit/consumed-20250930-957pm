import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Users, Trophy, Crown, Copy, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

async function callFn(name: string, body: unknown, token: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export default function PoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['user-pools'],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-user-pools`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      return res.json();
    },
    enabled: !!session?.access_token
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => callFn('create-pool', { name }, session?.access_token || ''),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setShowCreate(false);
      setNewPoolName('');
      setLocation(`/room/${data.pool.id}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (poolId: string) => callFn('delete-pool', { pool_id: poolId }, session?.access_token || ''),
    onSuccess: (data, poolId) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setConfirmDeleteId(null);
      toast({ title: 'Room deleted' });
    }
  });

  const handleCopyLink = (pool: any) => {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const link = `${appUrl}/room/join/${pool.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(pool.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Link copied!' });
  };

  const pools: any[] = data?.pools || [];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#0a0a0f' }}>
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)' }}>
        <div className="px-4 pt-4 pb-8">
          <button onClick={() => setLocation('/play')} className="text-white/70 hover:text-white transition-colors mb-3 block">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-semibold text-white mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>Rooms</h1>

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-white text-sm font-semibold mb-2"
              style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
            >
              <Plus size={15} /> New Room
            </button>
          ) : (
            <div className="flex gap-2 mb-2">
              <Input
                value={newPoolName}
                onChange={(e) => setNewPoolName(e.target.value)}
                placeholder="Room name..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && newPoolName.trim()) createMutation.mutate(newPoolName); if (e.key === 'Escape') { setShowCreate(false); setNewPoolName(''); } }}
              />
              <Button
                onClick={() => createMutation.mutate(newPoolName)}
                disabled={!newPoolName.trim() || createMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                {createMutation.isPending ? '...' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewPoolName(''); }} className="text-white/60 shrink-0">Cancel</Button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 px-4 pt-4 space-y-3 min-h-screen">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {!isLoading && pools.length === 0 && (
          <div className="text-center py-16">
            <Trophy size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No rooms yet. Create one to get started.</p>
          </div>
        )}

        {pools.map((pool) => (
          <div key={pool.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setLocation(`/room/${pool.id}`)} className="w-full text-left p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-gray-900 font-semibold text-base truncate">{pool.name}</h3>
                    {pool.is_host && <Crown size={12} className="text-yellow-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 text-gray-400 text-xs">
                    <span className="flex items-center gap-1"><Users size={12} />{pool.member_count} members</span>
                    <span>{pool.round_count} rounds</span>
                    {!pool.is_host && <span className="text-purple-500">{pool.user_points} pts</span>}
                  </div>
                </div>
              </div>
            </button>
            <div className="border-t border-gray-50 px-4 py-2 flex items-center justify-between">
              <button
                onClick={() => handleCopyLink(pool)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-xs transition-colors"
              >
                {copiedId === pool.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copiedId === pool.id ? 'Copied!' : 'Copy invite link'}
              </button>

              {pool.is_host && (
                confirmDeleteId === pool.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Delete room?</span>
                    <button
                      onClick={() => deleteMutation.mutate(pool.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 font-semibold hover:text-red-600 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pool.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <Navigation />
    </div>
  );
}
