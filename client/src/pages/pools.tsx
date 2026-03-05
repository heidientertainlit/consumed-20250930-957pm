import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trophy, Crown, Trash2, Users, Globe, Lock } from "lucide-react";
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

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic
    ? <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded-full px-2 py-0.5"><Globe size={9} /> Public</span>
    : <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-medium bg-gray-100 rounded-full px-2 py-0.5"><Lock size={9} /> Private</span>;
}

export default function PoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolDesc, setNewPoolDesc] = useState('');
  const [isPublicNew, setIsPublicNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

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
    mutationFn: (payload: { name: string; is_public: boolean; description?: string }) =>
      callFn('create-pool', payload, session?.access_token || ''),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setShowCreate(false);
      setNewPoolName('');
      setNewPoolDesc('');
      setIsPublicNew(false);
      setLocation(`/room/${data.pool.id}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (poolId: string) => callFn('delete-pool', { pool_id: poolId }, session?.access_token || ''),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setConfirmDeleteId(null);
    }
  });

  const handleJoin = async (poolId: string) => {
    setJoiningId(poolId);
    const result = await callFn('join-pool', { pool_id: poolId }, session?.access_token || '');
    setJoiningId(null);
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['user-pools'] });
    setLocation(`/room/${poolId}`);
  };

  const myRooms: any[] = data?.myRooms || data?.pools || [];
  const publicRooms: any[] = data?.publicRooms || [];

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
            <div className="space-y-2 mb-2">
              <div className="flex gap-2">
                <Input
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  placeholder="Room name..."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setShowCreate(false); setNewPoolName(''); setNewPoolDesc(''); setIsPublicNew(false); }
                  }}
                />
                <Button
                  onClick={() => createMutation.mutate({ name: newPoolName, is_public: isPublicNew, description: newPoolDesc })}
                  disabled={!newPoolName.trim() || createMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                >
                  {createMutation.isPending ? '...' : 'Create'}
                </Button>
                <Button variant="ghost" onClick={() => { setShowCreate(false); setNewPoolName(''); setNewPoolDesc(''); setIsPublicNew(false); }} className="text-white/60 shrink-0">Cancel</Button>
              </div>
              {/* Optional description */}
              <textarea
                value={newPoolDesc}
                onChange={(e) => setNewPoolDesc(e.target.value)}
                placeholder="Description (optional)..."
                rows={2}
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              {/* Public / Private toggle */}
              <div className="flex items-center gap-3 pl-1">
                <button
                  onClick={() => setIsPublicNew(false)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${!isPublicNew ? 'border-white/40 text-white bg-white/15' : 'border-white/15 text-white/40'}`}
                >
                  <Lock size={11} /> Private
                </button>
                <button
                  onClick={() => setIsPublicNew(true)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${isPublicNew ? 'border-emerald-400/60 text-emerald-300 bg-emerald-400/10' : 'border-white/15 text-white/40'}`}
                >
                  <Globe size={11} /> Public
                </button>
                <span className="text-white/30 text-xs">
                  {isPublicNew ? 'Anyone can find and join' : 'Invite-only'}
                </span>
              </div>
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

        {/* ── My Rooms ── */}
        {!isLoading && myRooms.length > 0 && (
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">My Rooms</p>
        )}

        {!isLoading && myRooms.length === 0 && publicRooms.length === 0 && (
          <div className="text-center py-16">
            <Trophy size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No rooms yet. Create one or browse public rooms below.</p>
          </div>
        )}

        {myRooms.map((pool) => (
          <div key={pool.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-fuchsia-50 flex items-center justify-center shrink-0">
                <Users size={18} className="text-fuchsia-500" />
              </div>

              <button onClick={() => setLocation(`/room/${pool.id}`)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <h3 className="text-gray-900 font-semibold text-base truncate">{pool.name}</h3>
                  {pool.is_host && <Crown size={11} className="text-yellow-500 shrink-0" />}
                  <VisibilityBadge isPublic={pool.is_public} />
                </div>
                <p className="text-gray-400 text-xs">
                  {pool.member_count} {pool.member_count === 1 ? 'member' : 'members'} &bull; {pool.round_count} {pool.round_count === 1 ? 'round' : 'rounds'}
                </p>
              </button>

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
                    <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400">Cancel</button>
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

        {/* ── Discover Public Rooms ── */}
        {!isLoading && publicRooms.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-3">Discover</p>
            {publicRooms.map((pool) => (
              <div key={pool.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-emerald-500" />
                  </div>

                  <button onClick={() => setLocation(`/room/${pool.id}`)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="text-gray-900 font-semibold text-base truncate">{pool.name}</h3>
                      <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded-full px-2 py-0.5 shrink-0">Public</span>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {pool.member_count} {pool.member_count === 1 ? 'member' : 'members'}
                      {pool.host?.display_name ? ` · by ${pool.host.display_name}` : pool.host?.user_name ? ` · by ${pool.host.user_name}` : ''}
                    </p>
                  </button>

                  <button
                    onClick={() => handleJoin(pool.id)}
                    disabled={joiningId === pool.id}
                    className="shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
                  >
                    {joiningId === pool.id ? '...' : 'Join'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && myRooms.length === 0 && publicRooms.length === 0 && (
          <div className="text-center pt-8">
            <Globe size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No public rooms available yet.</p>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
