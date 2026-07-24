import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Tv, BookOpen, Film, Music, Gamepad2, ChevronRight, Mic2, Fingerprint, Ghost, Rocket, Heart, Laugh, Drama, Trophy, BadgeCheck, Zap, Mountain, Castle, Coffee } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

const MEDIA_TYPES = [
  { id: 'tv',      label: 'TV Show',  Icon: Tv },
  { id: 'movie',   label: 'Movie',    Icon: Film },
  { id: 'book',    label: 'Book',     Icon: BookOpen },
  { id: 'music',   label: 'Music',    Icon: Music },
  { id: 'game',    label: 'Game',     Icon: Gamepad2 },
  { id: 'podcast', label: 'Podcast',  Icon: Mic2 },
];

function RequestRoomSheet({ onClose, userId }: { onClose: () => void; userId?: string }) {
  const [selectedType, setSelectedType] = useState('');
  const [title, setTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    await supabase.from('room_requests').insert({
      user_id: userId ?? null,
      media_type: selectedType || null,
      title: title.trim(),
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 w-full" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Close */}
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Request sent!</h2>
            <p className="text-sm text-gray-500">We'll let you know when your room is ready.</p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 rounded-2xl text-sm font-semibold text-white"
              style={{ background: '#7c3aed' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Request a Room</h2>
            <p className="text-sm text-gray-500 mb-5">What media item would you like a room for?</p>

            {/* Media type chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {MEDIA_TYPES.map(({ id, label, Icon }) => {
                const active = selectedType === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedType(id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                    style={active
                      ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }
                      : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Title input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={
                  selectedType === 'tv'      ? 'e.g. The Bear, Severance…' :
                  selectedType === 'movie'   ? 'e.g. Dune, Inception…' :
                  selectedType === 'book'    ? 'e.g. Fourth Wing, Atomic Habits…' :
                  selectedType === 'music'   ? 'e.g. Beyoncé, Taylor Swift…' :
                  selectedType === 'game'    ? 'e.g. Elden Ring, Stardew Valley…' :
                  selectedType === 'podcast' ? 'e.g. Serial, SmartLess…' :
                  'Start typing a title…'
                }
                className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 outline-none border border-gray-200 focus:border-purple-400"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!title.trim() || submitting}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-opacity"
              style={{ background: '#7c3aed', opacity: title.trim() && !submitting ? 1 : 0.4 }}
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function PoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showRequest, setShowRequest] = useState(false);

  // Recent title conversations — surfaces that every media page has its own room-like conversation
  const { data: titleConvos = [] } = useQuery({
    queryKey: ['rooms-title-conversations'],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('media_title, media_type, image_url, media_external_id, media_external_source, content, rating, created_at')
        .not('media_external_id', 'is', null)
        .not('media_external_source', 'is', null)
        .not('media_title', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error || !posts) return [];
      const seen = new Set<string>();
      const result: any[] = [];
      for (const p of posts) {
        const key = `${p.media_external_source}:${p.media_external_id}`;
        if (seen.has(key)) continue;
        // prefer titles with a written take so the strip shows real conversation
        if (!(p.content && p.content.trim()) && !p.rating) continue;
        seen.add(key);
        result.push(p);
        if (result.length >= 3) break;
      }
      return result;
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000,
  });

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

  // Only genre rooms (e.g. True Crime) are shown for now — media/platform rooms are hidden.
  const myRooms: any[] = (data?.myRooms || data?.pools || []).filter((r: any) => r.room_category === 'genre');
  const publicRooms: any[] = (data?.publicRooms || []).filter((r: any) => r.room_category === 'genre');
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
        <div className="flex flex-col items-center pt-8 pb-5 px-4">
          <div className="w-full flex items-center justify-between max-w-sm">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Rooms</h1>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 px-4 pt-4 space-y-5 min-h-screen">
        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-white border border-gray-200"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

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

        {/* Title conversations — every media page is its own conversation */}
        {titleConvos.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Title Conversations</p>
            <p className="text-xs text-gray-400 mb-2">Every title has its own conversation — jump in from any media page.</p>
            <div className="space-y-2">
              {titleConvos.map((c: any) => (
                <button
                  key={`${c.media_external_source}:${c.media_external_id}`}
                  onClick={() => setLocation(`/media/${(c.media_type || 'movie').toLowerCase()}/${c.media_external_source}/${c.media_external_id}`)}
                  className="w-full flex items-center gap-3 bg-white rounded-2xl p-3 border border-gray-200 text-left hover:border-purple-300 transition-colors"
                  data-testid={`title-convo-${c.media_external_id}`}
                >
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.media_title} className="w-10 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Tv size={16} className="text-purple-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.media_title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.content && c.content.trim() ? `"${c.content.trim()}"` : 'Recently rated'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
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

        {/* Request a room */}
        <div className="pt-4 pb-2 text-center">
          <button onClick={() => setShowRequest(true)} className="text-xs text-gray-400">
            Don't see your show?{' '}
            <span className="text-purple-500 font-medium">Request a room</span>
          </button>
        </div>
      </div>

      {showRequest && <RequestRoomSheet onClose={() => setShowRequest(false)} userId={session?.user?.id} />}
    </div>
  );
}

function RoomCard({ pool, onPress }: { pool: any; onPress: () => void }) {
  const accent = pool.accent_color || '#7c3aed';
  const isPlatform = pool.room_category === 'platform';
  const roomImage = pool.media_image || pool.partner_logo_url;
  const initials = (pool.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const genreKey = `${pool.series_tag || ''} ${pool.name || ''}`.toLowerCase();
  const GENRE_THEMES: { match: RegExp; color: string; Icon: any }[] = [
    { match: /true.?crime/, color: '#7c3aed', Icon: Fingerprint },
    { match: /myster|whodunit|detective/, color: '#8b5cf6', Icon: Search },
    { match: /rom.?com|roman/, color: '#ec4899', Icon: Heart },
    { match: /action|thriller/, color: '#f97316', Icon: Zap },
    { match: /fantasy/, color: '#14b8a6', Icon: Mountain },
    { match: /period|historical/, color: '#3b82f6', Icon: Castle },
    { match: /heartwarming|feel.?good|cozy|comfort|hallmark/, color: '#f59e0b', Icon: Coffee },
    { match: /reality|competition/, color: '#f43f5e', Icon: Trophy },
    { match: /horror|scary|supernatural|slasher/, color: '#6d28d9', Icon: Ghost },
    { match: /sci.?fi|science.?fiction|space/, color: '#6366f1', Icon: Rocket },
    { match: /comed|funny/, color: '#eab308', Icon: Laugh },
    { match: /drama/, color: '#3b82f6', Icon: Drama },
    { match: /sport/, color: '#0ea5e9', Icon: Trophy },
    { match: /music/, color: '#a855f7', Icon: Music },
    { match: /book|read|literat/, color: '#0d9488', Icon: BookOpen },
    { match: /game|gaming/, color: '#8b5cf6', Icon: Gamepad2 },
    { match: /podcast/, color: '#7c3aed', Icon: Mic2 },
    { match: /movie|film|cinema/, color: '#7c3aed', Icon: Film },
    { match: /\btv\b|show|series|stream/, color: '#7c3aed', Icon: Tv },
  ];
  const theme = GENRE_THEMES.find((g) => g.match.test(genreKey));
  const GenreIcon = theme?.Icon || null;
  const tileColor = theme?.color || accent;

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
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${tileColor}1f`, border: `1px solid ${tileColor}33` }}>
              {GenreIcon ? <GenreIcon size={24} strokeWidth={1.9} style={{ color: tileColor }} /> : <span className="font-bold text-sm" style={{ color: tileColor }}>{initials}</span>}
            </div>
          )}
        </div>

        <button onClick={onPress} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1 mb-0.5">
            <h3 className="text-gray-900 font-semibold text-base truncate min-w-0">{pool.name}</h3>
            {pool.is_official && <BadgeCheck size={15} className="text-blue-500 shrink-0" aria-label="Consumed Official" />}
          </div>
          {mediaLabel && (
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0"
                style={{ background: accent + '14', color: accent }}>
                <mediaLabel.Icon size={9} />
                {mediaLabel.label}
              </span>
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
