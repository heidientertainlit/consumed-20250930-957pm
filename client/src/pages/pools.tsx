import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Tv, BookOpen, Film, Music } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

export default function PoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#0a0a0f' }}>
      <Navigation />
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)' }}>
        <div className="flex flex-col items-center pt-8 pb-5 px-4 gap-4">
          <div className="w-full flex items-center justify-between max-w-sm">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Rooms</h1>
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
              {searchQuery ? `No rooms matching "${searchQuery}"` : 'No rooms yet — check back soon!'}
            </p>
          </div>
        )}
      </div>
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
