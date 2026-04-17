import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Search, Zap, CheckCircle2, Trophy, Share2, RotateCcw, ChevronRight, MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type View = "hub" | "new" | "sent" | "active" | "finished";

type MediaItem = {
  id: string;
  title: string;
  sub: string;
  type: string;
  poster: string;
  total: number;
  unit: string;
  external_id?: string;
  external_source?: string;
};

const EXAMPLE_MEDIA: MediaItem[] = [
  {
    id: "friends-tv",
    title: "Friends",
    sub: "Full Series · NBC · 10 seasons",
    type: "TV",
    poster: "https://image.tmdb.org/t/p/w200/f496cm9enuEsZkSPzCwnTESEK5s.jpg",
    total: 236,
    unit: "episodes",
  },
  {
    id: "hp-books",
    title: "Harry Potter Series",
    sub: "J.K. Rowling · 7 books",
    type: "Book",
    poster: "https://covers.openlibrary.org/b/id/10110415-M.jpg",
    total: 7,
    unit: "books",
  },
  {
    id: "good-hang",
    title: "Good Hang with Amy Poehler",
    sub: "Amy Poehler · Comedy · iHeart",
    type: "Podcast",
    poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/f8/96/e8/f896e808-3b6c-bada-d3e6-39e51c7dbf00/mza_6234927437259781246.jpg/200x200bb.jpg",
    total: 50,
    unit: "episodes",
  },
];

const DEMO_ACTIVE_BATTLE = {
  media: EXAMPLE_MEDIA[0],
  opponent: { name: "Seth", avatar: "S", color: "#7c3aed" },
  myProgress: 6,
  friendProgress: 3,
  startedAgo: "3 days ago",
};

export default function PlayBingeBattle() {
  const [, setLocation] = useLocation();
  const { user, session } = useAuth();

  const [view, setView] = useState<View>("hub");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [search, setSearch] = useState("");
  const [myProgress, setMyProgress] = useState(6);

  const [mediaResults, setMediaResults] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const mediaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doMediaSearch = useCallback(async (query: string) => {
    if (!query.trim() || !session?.access_token) { setMediaResults([]); return; }
    setMediaLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await resp.json();
      const mapped: MediaItem[] = (data.results || []).slice(0, 6).map((r: any) => ({
        id: r.external_id || r.id || r.title,
        title: r.title,
        sub: [r.creator || r.artist, r.year, r.network || r.platform].filter(Boolean).join(" · "),
        type: r.type ? (r.type.charAt(0).toUpperCase() + r.type.slice(1)) : "Media",
        poster: r.image_url || r.poster_url || r.image || "",
        total: r.type === "book" ? 100 : r.type === "podcast" ? 20 : r.episodes || 10,
        unit: r.type === "book" ? "% read" : "episodes",
        external_id: r.external_id,
        external_source: r.external_source,
      }));
      setMediaResults(mapped);
    } catch {
      setMediaResults([]);
    } finally {
      setMediaLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!search.trim()) { setMediaResults([]); return; }
    if (mediaDebounce.current) clearTimeout(mediaDebounce.current);
    mediaDebounce.current = setTimeout(() => doMediaSearch(search), 400);
    return () => { if (mediaDebounce.current) clearTimeout(mediaDebounce.current); };
  }, [search, doMediaSearch]);

  const displayMedia = search.trim() ? mediaResults : EXAMPLE_MEDIA;

  const activeBattle = DEMO_ACTIVE_BATTLE;
  const leadAmount = activeBattle.myProgress - activeBattle.friendProgress;

  function handleSendChallenge() {
    if (!selectedMedia) return;
    setView("sent");
  }

  if (view === "hub") {
    return (
      <div className="min-h-screen bg-[#f8f8fb]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] px-4 pt-14 pb-6">
          <button
            onClick={() => setLocation("/play")}
            className="flex items-center gap-1.5 text-white/60 text-sm mb-4"
          >
            <ChevronLeft size={16} /> Play
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Zap size={16} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Binge Battle</h1>
          </div>
          <p className="text-sm text-white/50 ml-10.5">
            Pick the media, share the challenge via text, and race to finish first.
          </p>
        </div>

        <div className="px-4 pt-5 pb-28 space-y-5">
          {/* Start New Battle CTA */}
          <button
            onClick={() => setView("new")}
            className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
          >
            <Zap size={16} />
            Start a New Battle
          </button>

          {/* Active Battle */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Active Battles</p>
            <div
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              onClick={() => setView("active")}
            >
              {/* Banner image */}
              <div className="h-[80px] relative bg-gray-200 overflow-hidden">
                <img
                  src="https://image.tmdb.org/t/p/w780/kjQBrc00fB2RjHZB3PGR4w9ibpz.jpg"
                  alt={activeBattle.media.title}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent px-4 flex items-end pb-2">
                  <p className="text-white font-bold text-[13px]">{activeBattle.media.title}</p>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[9px] text-green-400 font-bold">LIVE</span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-gray-500">vs <span className="font-semibold text-gray-900">{activeBattle.opponent.name}</span> · First to finish</p>
                  <p className="text-[11px] text-gray-400">Started {activeBattle.startedAgo}</p>
                </div>

                {/* Mini progress */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {user?.user_metadata?.display_name?.[0] || "Y"}
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${(activeBattle.myProgress / activeBattle.media.total) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-purple-600 w-8 text-right">
                      {activeBattle.myProgress}/{activeBattle.media.total}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: activeBattle.opponent.color }}
                    >
                      {activeBattle.opponent.avatar}
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-300" style={{ width: `${(activeBattle.friendProgress / activeBattle.media.total) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 w-8 text-right">
                      {activeBattle.friendProgress}/{activeBattle.media.total}
                    </span>
                  </div>
                </div>

                {leadAmount > 0 && (
                  <p className="mt-3 text-[11px] text-amber-600 font-medium text-center bg-amber-50 py-1.5 rounded-lg border border-amber-100">
                    You're {leadAmount} {activeBattle.media.unit} ahead — keep going!
                  </p>
                )}

                <div className="flex items-center justify-end mt-3 text-purple-600 gap-1">
                  <span className="text-[12px] font-semibold">View battle</span>
                  <ChevronRight size={13} />
                </div>
              </div>
            </div>
          </div>

          {/* Past battles placeholder */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Past Battles</p>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center shadow-sm">
              <Trophy size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-[13px] text-gray-400">Your battle history will appear here</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "new") {
    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        {/* Header — purple gradient matching hub */}
        <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] px-4 pt-14 pb-5">
          <button
            onClick={() => setView("hub")}
            className="flex items-center gap-1.5 text-white/60 text-sm mb-4"
          >
            <ChevronLeft size={16} /> Binge Battle
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Zap size={16} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">New Battle</h1>
          </div>
          <p className="text-sm text-white/50 ml-10.5">
            Pick the media below, then we'll send the challenge via text.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10 space-y-5">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Pick the media</p>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-2 shadow-sm">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
                placeholder="Search shows, movies, books, podcasts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {!search.trim() && (
              <p className="text-[11px] text-gray-400 mb-2.5 px-0.5">
                <span className="font-semibold text-gray-500">Examples</span> — tap one to pick it, or search above
              </p>
            )}
            {mediaLoading && (
              <div className="flex items-center justify-center py-5 gap-2 text-gray-400">
                <Loader2 size={15} className="animate-spin" />
                <span className="text-[12px]">Searching...</span>
              </div>
            )}
            {search.trim() && !mediaLoading && mediaResults.length === 0 && (
              <p className="text-center text-[12px] text-gray-400 py-4">No results found — try a different search</p>
            )}
            <div className="space-y-2">
              {!mediaLoading && displayMedia.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedMedia(selectedMedia?.id === item.id ? null : item)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedMedia?.id === item.id
                      ? "bg-purple-50 border-purple-200"
                      : "bg-white border-gray-200"
                  }`}
                  style={{ borderColor: selectedMedia?.id === item.id ? undefined : "#ececf0" }}
                >
                  <div className="w-10 h-14 rounded-lg shrink-0 overflow-hidden bg-purple-100 flex items-center justify-center relative">
                    <span className="text-[11px] font-black text-purple-300">{item.type[0]}</span>
                    {item.poster && (
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      selectedMedia?.id === item.id ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                    }`}>{item.type}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selectedMedia?.id === item.id ? "bg-purple-600 border-purple-600" : "border-gray-300"
                  }`}>
                    {selectedMedia?.id === item.id && (
                      <CheckCircle2 size={12} className="text-white fill-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* CTA */}
        <div className="px-4 pb-10 pt-3 bg-[#f8f8fb] border-t border-gray-100">
          <button
            disabled={!selectedMedia}
            onClick={handleSendChallenge}
            className={`w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
              selectedMedia
                ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            <Zap size={15} />
            {selectedMedia ? "Start Battle" : "Pick media first"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "sent") {
    const media = selectedMedia!;
    const battleUrl = `${window.location.origin}/play/binge-battle${user?.id ? `?from=${user.id}` : ""}`;
    const shareText = `Can you beat me? I'm challenging you to a Binge Battle on ${media.title} — first to finish wins. Join me on Consumed`;

    function sendChallenge() {
      if (navigator.share) {
        navigator.share({ title: "Binge Battle Challenge", text: shareText, url: battleUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`${shareText} ${battleUrl}`);
      }
    }

    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
          <button onClick={() => setView("new")} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900">Send Challenge</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 pb-16">
          {/* Media summary */}
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3.5 shadow-sm w-full">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center relative shrink-0">
              <span className="text-[11px] font-black text-purple-300">{media.type[0]}</span>
              {media.poster && (
                <img src={media.poster} alt={media.title} className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{media.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{media.sub}</p>
              <p className="text-[11px] text-purple-600 font-semibold mt-0.5">First to finish wins</p>
            </div>
          </div>

          {/* Main share CTA — matches Pools pattern */}
          <div className="w-full space-y-3">
            <button
              onClick={sendChallenge}
              className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-purple-200"
            >
              <MessageCircle size={17} />
              Send Challenge via Text
            </button>
            <p className="text-center text-[11px] text-gray-400">
              Your friend gets a link to join and start competing
            </p>
          </div>

          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={() => setView("active")}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-gray-200 text-gray-600 bg-white flex items-center justify-center gap-2"
          >
            <Zap size={14} className="text-purple-500" /> Go to My Battle
          </button>
        </div>
      </div>
    );
  }

  if (view === "active") {
    const media = selectedMedia || activeBattle.media;
    const opponent = activeBattle.opponent;
    const friendProgress = selectedMedia ? 0 : activeBattle.friendProgress;
    const lead = myProgress - friendProgress;

    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setView("hub")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
          >
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">Binge Battle</h1>
            <p className="text-[11px] text-gray-400">{media.title} · First to finish</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-600 font-semibold">Live</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 space-y-4">
          {/* Media banner */}
          <div className="rounded-2xl overflow-hidden relative h-[90px] bg-gray-800">
            {media.poster && (
              <img src={media.poster} alt={media.title}
                className="absolute inset-0 w-full h-full object-cover opacity-50"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex items-end">
              <div>
                <p className="text-white font-bold text-[15px]">{media.title}</p>
                <p className="text-white/70 text-[11px]">{media.sub}</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Who's ahead</p>

          {/* You */}
          <div className="bg-white rounded-2xl p-4 border-2 border-purple-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-[14px] font-bold text-white">
                  {user?.user_metadata?.display_name?.[0] || "Y"}
                </div>
                {lead > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center">
                    <Zap size={8} className="text-white fill-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-gray-900">You</p>
                  {lead > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-bold uppercase tracking-wide">Leading</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {media.unit === "episodes" ? `Ep ${myProgress} of ${media.total}` : `${myProgress}% done`}
                  {" · "}{Math.round((myProgress / media.total) * 100)}% done
                </p>
              </div>
              <p className="text-[22px] font-black text-purple-600">{myProgress}/{media.total}</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                style={{ width: `${(myProgress / media.total) * 100}%` }}
              />
            </div>
          </div>

          {/* VS */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 font-bold">VS</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Opponent */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
                style={{ background: opponent.color }}
              >
                {opponent.avatar}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-gray-900">{opponent.name}</p>
                <p className="text-[11px] text-gray-400">
                  {media.unit === "episodes" ? `Ep ${friendProgress} of ${media.total}` : `${friendProgress}% done`}
                  {" · "}{Math.round((friendProgress / media.total) * 100)}% done
                </p>
              </div>
              <p className="text-[22px] font-black text-gray-300">{friendProgress}/{media.total}</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gray-300"
                style={{ width: `${(friendProgress / media.total) * 100}%` }}
              />
            </div>
          </div>

          {/* Taunt */}
          {lead > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[12px] text-amber-700 text-center">
                You're <span className="font-bold">{lead} {media.unit} ahead</span> of {opponent.name} — keep going!
              </p>
            </div>
          )}
          {lead < 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-[12px] text-red-600 text-center">
                {opponent.name} is <span className="font-bold">{Math.abs(lead)} {media.unit} ahead</span> — pick it up!
              </p>
            </div>
          )}
          {lead === 0 && (
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-[12px] text-gray-600 text-center font-medium">You're neck and neck — anyone's game!</p>
            </div>
          )}

          {/* Actions — in scroll area so they're visible immediately */}
          <div className="space-y-2.5 pt-1">
            <button
              onClick={() => setMyProgress(p => Math.min(p + 1, media.total))}
              className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
            >
              <ChevronLeft size={15} className="rotate-180" />
              Update My Progress
            </button>
            <button
              onClick={() => { setMyProgress(media.total); setView("finished"); }}
              className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-green-300 text-green-600 bg-green-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={15} />
              I Finished — Done!
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "finished") {
    const media = selectedMedia || activeBattle.media;
    const opponent = activeBattle.opponent;
    const friendFinalProgress = selectedMedia ? 0 : activeBattle.friendProgress;

    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setView("hub")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
          >
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">Binge Battle</h1>
            <p className="text-[11px] text-gray-400">{media.title} · Complete</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4">
          {/* Winner card */}
          <div
            className="rounded-3xl p-6 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #6d28d9, #7c3aed, #8b5cf6)" }}
          >
            <div className="absolute inset-0 opacity-20" style={{
              background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5), transparent 70%)"
            }} />
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                <Trophy size={30} className="text-amber-300" />
              </div>
              <p className="text-[11px] text-purple-200 uppercase tracking-widest font-bold mb-1">Battle won</p>
              <h2 className="text-[26px] font-black text-white mb-1">First to Finish!</h2>
              <p className="text-[13px] text-purple-200">You beat {opponent.name}</p>
            </div>
          </div>

          {/* Final standings */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Final standings</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-purple-200 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-[12px] font-black text-amber-900">1</div>
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-[13px] font-bold text-white">
                  {user?.user_metadata?.display_name?.[0] || "Y"}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-gray-900">You</p>
                  <p className="text-[11px] text-gray-400">Finished first</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black text-purple-600">{media.total}/{media.total}</p>
                  <p className="text-[10px] text-gray-400">{media.unit}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[12px] font-bold text-gray-400">2</div>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                  style={{ background: opponent.color }}
                >
                  {opponent.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-gray-500">{opponent.name}</p>
                  <p className="text-[11px] text-gray-400">Still watching · {media.unit === "episodes" ? `Ep ${friendFinalProgress}` : `${friendFinalProgress}%`}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black text-gray-300">{friendFinalProgress}/{media.total}</p>
                  <p className="text-[10px] text-gray-300">{media.unit}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Points */}
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
            <Trophy size={15} className="text-purple-600" />
            <p className="text-[13px] text-gray-600">You earned <span className="font-black text-purple-600">+50 pts</span> for winning</p>
          </div>

          {/* Taunt */}
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
            <p className="text-[12px] text-gray-400 italic">"Think you can beat me next time?" — send the challenge back</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-10 pt-3 bg-[#f8f8fb] border-t border-gray-100 space-y-2.5">
          <button
            onClick={() => { setSelectedMedia(null); setMyProgress(6); setView("new"); }}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-md shadow-purple-100"
          >
            <RotateCcw size={14} />
            Rematch {opponent.name}
          </button>
          <button
            onClick={() => {
              const text = `I just beat ${opponent.name} on ${media.title} in a Binge Battle on Consumed!`;
              if (navigator.share) {
                navigator.share({ title: "Binge Battle Result", text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text);
              }
            }}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-gray-200 text-gray-600 bg-white flex items-center justify-center gap-2"
          >
            <Share2 size={14} />
            Share Result
          </button>
        </div>
      </div>
    );
  }

  return null;
}
