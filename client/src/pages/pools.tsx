import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, Tv, BookOpen, Film, Music, Plus, Globe, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

export default function PoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', series_tag: '', is_public: true });

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

  const myRooms: any[] = data?.myRooms || data?.pools || [];
  const publicRooms: any[] = data?.publicRooms || [];
  const myRoomIds = new Set(myRooms.map((r: any) => r.id));
  const discoverRooms = publicRooms.filter((r: any) => !myRoomIds.has(r.id));

  const filterRooms = (rooms: any[]) => searchQuery.trim()
    ? rooms.filter((r: any) =>
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.series_tag?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rooms;

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ title: 'Room name is required', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pool`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          series_tag: form.series_tag.trim() || null,
          is_public: form.is_public,
        }),
      });
      const result = await res.json();
      if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setShowCreate(false);
      setForm({ name: '', description: '', series_tag: '', is_public: true });
      toast({ title: `Room created!` });
      if (result.pool?.id) setLocation(`/room/${result.pool.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#0a0a0f' }}>
      <Navigation />
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)' }}>
        <div className="flex flex-col items-center pt-8 pb-5 px-4 gap-4">
          <div className="w-full flex items-center justify-between max-w-sm">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Rooms</h1>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              <Plus size={13} />
              Create
            </button>
          </div>
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-white placeholder:text-white/35 outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 px-4 pt-4 space-y-5 min-h-screen">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {/* My Rooms */}
        {!isLoading && myRooms.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">My Rooms</p>
            <div className="space-y-3">
              {filterRooms(myRooms).map((pool: any) => <RoomCard key={pool.id} pool={pool} onPress={() => setLocation(`/room/${pool.id}`)} />)}
            </div>
          </div>
        )}

        {/* Discover */}
        {!isLoading && discoverRooms.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Discover</p>
            <div className="space-y-3">
              {filterRooms(discoverRooms).map((pool: any) => <RoomCard key={pool.id} pool={pool} onPress={() => setLocation(`/room/${pool.id}`)} />)}
            </div>
          </div>
        )}

        {!isLoading && myRooms.length === 0 && discoverRooms.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">
              {searchQuery ? `No rooms matching "${searchQuery}"` : 'No rooms yet — create one above!'}
            </p>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl p-6 pb-10"
            style={{ background: '#fff' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create a Room</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Room name *</label>
                <input
                  type="text"
                  placeholder="e.g. Friends Fan Room"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Show / Series</label>
                <input
                  type="text"
                  placeholder="e.g. Friends  (links polls & trivia for this show)"
                  value={form.series_tag}
                  onChange={e => setForm(f => ({ ...f, series_tag: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-purple-400"
                />
                <p className="text-[11px] text-gray-400 mt-1">Polls and trivia tagged with this show auto-appear in the Play tab.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
                <input
                  type="text"
                  placeholder="What's this room about?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Visibility</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, is_public: true }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-all ${form.is_public ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    <Globe size={14} /> Public
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, is_public: false }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-all ${!form.is_public ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    <Lock size={14} /> Private
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
              className="w-full mt-5 py-3 rounded-2xl text-white text-sm font-bold disabled:opacity-50 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomCard({ pool, onPress }: { pool: any; onPress: () => void }) {
  const accent = pool.accent_color || '#7c3aed';
  const isPlatform = pool.room_category === 'platform';
  const roomImage = pool.media_image || pool.partner_logo_url;
  const initials = (pool.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const mt = (pool.media_type || '').toLowerCase();
  const mediaConfig: Record<string, { label: string; Icon: any }> = {
    book:  { label: 'Book',  Icon: BookOpen },
    movie: { label: 'Movie', Icon: Film },
    music: { label: 'Music', Icon: Music },
    tv:    { label: 'TV',    Icon: Tv },
  };
  const mediaLabel = isPlatform
    ? { label: 'Platform', Icon: Tv }
    : (mt ? (mediaConfig[mt] || { label: mt, Icon: Tv }) : null);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0">
          {isPlatform ? (
            <div className="w-12 h-16 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}44)`, border: `1.5px solid ${accent}55` }}>
              <Tv size={22} style={{ color: accent }} strokeWidth={1.6} />
            </div>
          ) : roomImage ? (
            <div className="w-12 h-16 rounded-xl overflow-hidden shadow-sm">
              <img src={roomImage} alt={pool.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-16 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}>
              {initials}
            </div>
          )}
        </div>

        <button onClick={onPress} className="flex-1 min-w-0 text-left">
          <h3 className="text-gray-900 font-semibold text-base truncate mb-0.5">{pool.name}</h3>
          {(mediaLabel || pool.series_tag) && (
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {mediaLabel && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0"
                  style={{ background: accent + '14', color: accent }}>
                  <mediaLabel.Icon size={9} />
                  {mediaLabel.label}
                </span>
              )}
              {pool.series_tag && (
                <span className="text-[11px] text-gray-400 truncate">{pool.series_tag}</span>
              )}
            </div>
          )}
          {pool.description && (
            <p className="text-gray-500 text-xs mb-1 line-clamp-1">{pool.description}</p>
          )}
          <p className="text-gray-400 text-xs">
            {pool.member_count ?? 0} {(pool.member_count ?? 0) === 1 ? 'member' : 'members'}
          </p>
        </button>
      </div>
    </div>
  );
}
