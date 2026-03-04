import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trophy, Crown, Trash2 } from "lucide-react";
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
              className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-sm font-semibold mb-2"
              style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
            >
              <Plus size={14} /> New Room
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
          <div key={pool.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 p-4">
              {/* Room icon — three people connected in a circle */}
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Top person */}
                  <circle cx="11" cy="3.5" r="2" stroke="#7c3aed" strokeWidth="1.4"/>
                  <circle cx="11" cy="3.5" r="0.7" fill="#7c3aed"/>
                  {/* Bottom-left person */}
                  <circle cx="4" cy="16" r="2" stroke="#7c3aed" strokeWidth="1.4"/>
                  <circle cx="4" cy="16" r="0.7" fill="#7c3aed"/>
                  {/* Bottom-right person */}
                  <circle cx="18" cy="16" r="2" stroke="#7c3aed" strokeWidth="1.4"/>
                  <circle cx="18" cy="16" r="0.7" fill="#7c3aed"/>
                  {/* Connecting arcs */}
                  <path d="M9.2 5.2 C7 7 5.2 9.5 5.2 14.2" stroke="#7c3aed" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                  <path d="M12.8 5.2 C15 7 16.8 9.5 16.8 14.2" stroke="#7c3aed" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                  <path d="M6 17.5 C8 19.2 14 19.2 16 17.5" stroke="#7c3aed" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                </svg>
              </div>

              {/* Name + stats */}
              <button onClick={() => setLocation(`/room/${pool.id}`)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h3 className="text-gray-900 font-semibold text-base truncate">{pool.name}</h3>
                  {pool.is_host && <Crown size={11} className="text-yellow-500 shrink-0" />}
                </div>
                <p className="text-gray-400 text-xs">
                  {pool.member_count} {pool.member_count === 1 ? 'member' : 'members'} &bull; {pool.round_count} {pool.round_count === 1 ? 'round' : 'rounds'}
                </p>
              </button>

              {/* Delete (host only) */}
              {pool.is_host && (
                confirmDeleteId === pool.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => deleteMutation.mutate(pool.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 font-semibold disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? '...' : 'Delete'}
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pool.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"
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
