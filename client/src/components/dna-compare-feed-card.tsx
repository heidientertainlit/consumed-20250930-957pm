import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Dna, ArrowRight, Users, X, ChevronLeft, ChevronDown, Loader2, Share2, CheckCircle2, Heart, Zap } from "lucide-react";

/* ── types ─────────────────────────────────────────── */
interface OverlapUser {
  displayName: string;
  initials: string;
  color: string;
  pct?: number;
}

interface CompareUser {
  displayName: string;
  initials: string;
  color: string;
  pct: number;
  tagline: string;
  label?: string;
  userId?: string;
}

interface Friend {
  id: string;
  user_name: string;
  display_name?: string;
  avatar?: string;
}

interface ComparisonResult {
  match_score: number;
  shared_genres: string[];
  differences: { user_unique: string[]; friend_unique: string[] };
  insights: { compatibilityLine?: string };
  friend_name: string;
  friend_dna_label?: string;
  your_dna_label?: string;
}

interface DnaCompareFeedCardProps {
  featured?: CompareUser;
  overlaps?: OverlapUser[];
}

const AVATAR_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

function calcOverlapPct(a: string[], b: string[]): number {
  const setA = new Set(a.map(g => g.toLowerCase()));
  const setB = new Set(b.map(g => g.toLowerCase()));
  const intersection = [...setA].filter(g => setB.has(g)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

function buildTagline(pct: number, firstName: string): string {
  if (pct >= 70) return `You and ${firstName} have seriously similar taste.`;
  if (pct >= 50) return `Your watchlists probably look a lot alike.`;
  if (pct >= 30) return `Enough in common to trade good recommendations.`;
  return `Different tastes — which means interesting suggestions either way.`;
}

/* ── helpers ────────────────────────────────────────── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function FriendAvatar({ friend, size = 40 }: { friend: Friend; size?: number }) {
  const label = friend.display_name || friend.user_name;
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-indigo-500"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {friend.avatar ? (
        <img src={friend.avatar} alt={label} className="w-full h-full rounded-full object-cover" />
      ) : (
        initials(label)
      )}
    </div>
  );
}

function Waveform() {
  return (
    <svg width="44" height="38" viewBox="0 0 44 38" fill="none" className="shrink-0">
      <defs>
        <linearGradient id="cmp-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path
        d="M0,19 Q4,8 8,19 Q12,30 16,19 Q20,8 22,19 Q24,30 28,19 Q32,8 36,19 Q40,30 44,19"
        stroke="url(#cmp-wave)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* ── CompareSheet ───────────────────────────────────── */
export function CompareSheet({
  onClose,
  session,
  userId,
}: {
  onClose: () => void;
  session: any;
  userId: string;
}) {
  const [step, setStep] = useState<"loading-friends" | "pick" | "comparing" | "result" | "no-friends" | "error">("loading-friends");
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [errMsg, setErrMsg] = useState("");

  /* fetch friends who have a dna_profiles row */
  useEffect(() => {
    async function load() {
      try {
        const headers = {
          Authorization: `Bearer ${session.access_token}`,
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        };

        // Get accepted friendships
        const fsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/friendships?or=(user_id.eq.${userId},friend_id.eq.${userId})&status=eq.accepted&select=user_id,friend_id`,
          { headers }
        );
        const friendships = await fsRes.json();
        if (!Array.isArray(friendships) || friendships.length === 0) {
          setStep("no-friends");
          return;
        }

        const friendIds = [
          ...new Set(
            friendships.map((f: any) =>
              f.user_id === userId ? f.friend_id : f.user_id
            )
          ),
        ].filter((id) => id !== userId);

        // Get friend users
        const usersRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=in.(${friendIds.join(",")})&select=id,user_name,display_name,avatar`,
          { headers }
        );
        const usersData: Friend[] = await usersRes.json();

        // Filter to only friends with a dna_profiles row
        const dnaRes = await fetch(
          `${SUPABASE_URL}/rest/v1/dna_profiles?user_id=in.(${friendIds.join(",")})&select=user_id`,
          { headers }
        );
        const dnaData = await dnaRes.json();
        const hasDna = new Set(
          Array.isArray(dnaData) ? dnaData.map((d: any) => d.user_id) : []
        );

        const eligible = usersData.filter((u) => hasDna.has(u.id));

        if (eligible.length === 0) {
          setStep("no-friends");
        } else {
          setFriends(eligible);
          setStep("pick");
        }
      } catch {
        setStep("error");
        setErrMsg("Couldn't load friends. Try again.");
      }
    }
    load();
  }, [userId, session]);

  async function handlePick(friend: Friend) {
    setSelected(friend);
    setStep("comparing");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/compare-dna-friend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ friend_id: friend.id }),
        }
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Comparison failed");
      }
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (e: any) {
      setErrMsg(e.message || "Something went wrong");
      setStep("error");
    }
  }

  const friendLabel = (f: Friend) => f.display_name || f.user_name;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.72)", zIndex: 10000 }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl flex flex-col"
        style={{
          background: "linear-gradient(160deg, #0f0a2e 0%, #1a1050 55%, #1e1460 100%)",
          maxHeight: "82vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="px-5 pt-4 pb-3 flex flex-col gap-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step === "result" && (
                <button
                  onClick={() => { setStep("pick"); setResult(null); setSelected(null); }}
                  className="p-1 rounded-full bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <span className="text-white font-bold text-[17px]">
                {step === "result" ? `You vs ${friendLabel(selected!)}` : "Compare DNA"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 pb-8">

          {/* Loading friends */}
          {step === "loading-friends" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-purple-400" size={28} />
              <p className="text-white/50 text-[13px]">Loading your friends…</p>
            </div>
          )}

          {/* Comparing */}
          {step === "comparing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-purple-400" size={28} />
              <p className="text-white/50 text-[13px]">
                Comparing your DNA with {selected ? friendLabel(selected) : ""}…
              </p>
            </div>
          )}

          {/* No friends with DNA */}
          {step === "no-friends" && (
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <Users size={32} className="text-white/20" />
              <p className="text-white/70 font-semibold text-[15px]">No friends with DNA yet</p>
              <p className="text-white/40 text-[12px] max-w-[260px]">
                Your friends need to build their Entertainment DNA before you can compare. Nudge them!
              </p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <p className="text-red-400 text-[13px]">{errMsg}</p>
              <button
                onClick={() => { setStep("loading-friends"); setErrMsg(""); }}
                className="text-purple-400 text-[12px] underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Friend picker */}
          {step === "pick" && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-white/40 text-[11px] uppercase tracking-widest mb-2">
                Pick a friend
              </p>
              {friends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handlePick(f)}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 hover:border-purple-500/50 hover:bg-white/5 transition-all text-left"
                >
                  <FriendAvatar friend={f} size={40} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-semibold text-[14px] truncate">
                      {friendLabel(f)}
                    </span>
                    <span className="text-white/40 text-[11px]">@{f.user_name}</span>
                  </div>
                  <ArrowRight size={16} className="text-white/30 ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Result */}
          {step === "result" && result && selected && (
            <div className="flex flex-col gap-5 pt-1">
              {/* Score + avatars */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-0">
                  <div
                    className="rounded-full flex items-center justify-center font-bold text-white bg-indigo-500"
                    style={{ width: 52, height: 52, fontSize: 16 }}
                  >
                    Me
                  </div>
                  <Waveform />
                  <FriendAvatar friend={selected} size={52} />
                </div>
                <div className="text-center">
                  <p className="text-white font-extrabold" style={{ fontSize: 36 }}>
                    <span style={{ color: "#c084fc" }}>{result.match_score}%</span>
                  </p>
                  <p className="text-white/60 text-[13px]">Entertainment DNA match</p>
                </div>
                {result.insights?.compatibilityLine && (
                  <p className="text-white/70 text-[12px] text-center italic px-4">
                    "{result.insights.compatibilityLine}"
                  </p>
                )}
              </div>

              {/* Labels */}
              {(result.your_dna_label || result.friend_dna_label) && (
                <div className="flex gap-2">
                  {result.your_dna_label && (
                    <div className="flex-1 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-center">
                      <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">You</p>
                      <p className="text-indigo-300 font-semibold text-[11px] leading-tight">{result.your_dna_label}</p>
                    </div>
                  )}
                  {result.friend_dna_label && (
                    <div className="flex-1 px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 text-center">
                      <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">{friendLabel(selected)}</p>
                      <p className="text-purple-300 font-semibold text-[11px] leading-tight">{result.friend_dna_label}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Shared genres */}
              {result.shared_genres?.length > 0 && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">You both love</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.shared_genres.slice(0, 6).map((g) => (
                      <span
                        key={g}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium text-purple-200"
                        style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.3)" }}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Differences */}
              {(result.differences?.user_unique?.length > 0 || result.differences?.friend_unique?.length > 0) && (
                <div className="flex gap-3">
                  {result.differences.user_unique?.length > 0 && (
                    <div className="flex-1">
                      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5">You lean toward</p>
                      {result.differences.user_unique.slice(0, 3).map((g) => (
                        <p key={g} className="text-white/70 text-[12px]">· {g}</p>
                      ))}
                    </div>
                  )}
                  {result.differences.friend_unique?.length > 0 && (
                    <div className="flex-1">
                      <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5">They lean toward</p>
                      {result.differences.friend_unique.slice(0, 3).map((g) => (
                        <p key={g} className="text-white/70 text-[12px]">· {g}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Share to feed */}
              <button
                disabled={sharing || shared}
                onClick={async () => {
                  if (shared || sharing) return;
                  setSharing(true);
                  try {
                    await fetch(`${SUPABASE_URL}/rest/v1/social_posts`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "apikey": ANON_KEY,
                        "Authorization": `Bearer ${session?.access_token}`,
                        "Prefer": "return=minimal",
                      },
                      body: JSON.stringify({
                        user_id: userId,
                        post_type: "dna_compare",
                        content: JSON.stringify({
                          match_score: result.match_score,
                          friend_name: result.friend_name || selected?.display_name || selected?.user_name || "a friend",
                          friend_id: selected?.id,
                          friend_dna_label: result.friend_dna_label || null,
                          your_dna_label: result.your_dna_label || null,
                          shared_genres: result.shared_genres || [],
                          compatibility_line: result.insights?.compatibilityLine || null,
                        }),
                      }),
                    });
                    setShared(true);
                  } catch {
                    /* silent — no toast on error to keep it lightweight */
                  } finally {
                    setSharing(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
                style={{
                  background: shared ? "rgba(34,197,94,0.15)" : "rgba(168,85,247,0.2)",
                  border: shared ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(168,85,247,0.4)",
                  color: shared ? "#86efac" : "#e9d5ff",
                }}
              >
                {sharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : shared ? (
                  <><CheckCircle2 className="w-4 h-4" /> Posted to feed</>
                ) : (
                  <><Share2 className="w-4 h-4" /> Share to feed</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Main card ──────────────────────────────────────── */
export default function DnaCompareFeedCard({ featured: featuredProp, overlaps: overlapsProp }: DnaCompareFeedCardProps) {
  const [, setLocation] = useLocation();
  const { session, user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dynFeatured, setDynFeatured] = useState<CompareUser | null>(null);
  const [dynOverlaps, setDynOverlaps] = useState<OverlapUser[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [noFriends, setNoFriends] = useState(false);
  const [myLabel, setMyLabel] = useState<string | null>(null);
  const [sharedTitles, setSharedTitles] = useState<string[]>([]);
  const [differTitles, setDifferTitles] = useState<{ myTitle: string; friendTitle: string } | null>(null);
  const [sharedGenresFromDna, setSharedGenresFromDna] = useState<string[]>([]);
  const [othersExpanded, setOthersExpanded] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !user?.id) { setLoadingPersonal(false); return; }
    const headers = { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY, "Content-Type": "application/json" };

    async function fetchPersonalized() {
      try {
        // 1. Fetch my DNA profile + friends list in parallel
        const [myDnaRes, fsRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/dna_profiles?user_id=eq.${user!.id}&select=favorite_genres,label`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/friendships?or=(user_id.eq.${user!.id},friend_id.eq.${user!.id})&status=eq.accepted&select=user_id,friend_id`, { headers }),
        ]);
        const [myDna] = await myDnaRes.json();
        const friendships = await fsRes.json();
        if (!myDna?.favorite_genres?.length || !Array.isArray(friendships) || friendships.length === 0) { setNoFriends(true); return; }

        const myGenres: string[] = myDna.favorite_genres;
        if (myDna.label) setMyLabel(myDna.label);
        const friendIds = [...new Set(
          friendships.map((f: any) => f.user_id === user!.id ? f.friend_id : f.user_id)
        )].filter((id: string) => id !== user!.id) as string[];
        if (friendIds.length === 0) { setNoFriends(true); return; }

        // 2. Fetch friends' DNA profiles + display names in parallel
        const [friendDnaRes, friendUsersRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/dna_profiles?user_id=in.(${friendIds.join(',')})&select=user_id,favorite_genres,label`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${friendIds.join(',')})&select=id,display_name,user_name`, { headers }),
        ]);
        const friendDnas = await friendDnaRes.json();
        const friendUsers = await friendUsersRes.json();
        if (!Array.isArray(friendDnas) || friendDnas.length === 0) return;

        // 3. Score each friend by genre overlap, sort descending
        const myGenreSet = new Set(myGenres.map((g: string) => g.toLowerCase()));
        const scored = friendDnas
          .map((fd: any, i: number) => {
            const genres: string[] = Array.isArray(fd.favorite_genres) ? fd.favorite_genres : [];
            const pct = calcOverlapPct(myGenres, genres);
            const info = Array.isArray(friendUsers) ? friendUsers.find((u: any) => u.id === fd.user_id) : null;
            const displayName = info?.display_name || info?.user_name || 'Friend';
            const shared = genres.filter((g: string) => myGenreSet.has(g.toLowerCase()));
            return { displayName, pct, color: AVATAR_COLORS[i % AVATAR_COLORS.length], label: fd.label || null, userId: fd.user_id, sharedGenres: shared };
          })
          .sort((a: any, b: any) => b.pct - a.pct);

        if (scored.length === 0) return;
        const [top, ...rest] = scored;
        const firstName = top.displayName.split(' ')[0];

        setSharedGenresFromDna(top.sharedGenres.slice(0, 3));
        setDynFeatured({
          displayName: top.displayName,
          initials: initials(top.displayName),
          color: top.color,
          pct: top.pct,
          tagline: buildTagline(top.pct, firstName),
          label: top.label,
          userId: top.userId,
        });
        // Build overlaps: DNA-scored friends (with %) first, then any remaining friends without profiles
        const scoredIds = new Set(scored.map((s: any) => s.userId));
        const dnaOverlaps = rest.slice(0, 5).map((r: any, i: number) => ({
          displayName: r.displayName,
          initials: initials(r.displayName),
          color: r.color,
          pct: r.pct,
        }));
        const nonDnaOverlaps = Array.isArray(friendUsers)
          ? friendUsers
              .filter((u: any) => u.id !== top.userId && !scoredIds.has(u.id))
              .slice(0, Math.max(0, 5 - dnaOverlaps.length))
              .map((u: any, i: number) => ({
                displayName: u.display_name || u.user_name || 'Friend',
                initials: initials(u.display_name || u.user_name || 'Friend'),
                color: AVATAR_COLORS[(scored.length + i) % AVATAR_COLORS.length],
              }))
          : [];
        setDynOverlaps([...dnaOverlaps, ...nonDnaOverlaps]);
      } catch {
        // silent — fall through to prop defaults
      } finally {
        setLoadingPersonal(false);
      }
    }
    fetchPersonalized();
  }, [session?.access_token, user?.id]);

  // Rating-level agree/differ comparison
  useEffect(() => {
    const friendId = (dynFeatured ?? featuredProp)?.userId;
    if (!user?.id || !friendId || !session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY };
    async function fetchRatingOverlap() {
      try {
        const [myRes, friendRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/media_ratings?user_id=eq.${user!.id}&select=media_external_id,media_title,rating`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/media_ratings?user_id=eq.${friendId}&select=media_external_id,media_title,rating`, { headers }),
        ]);
        const myRatings: any[] = await myRes.json();
        const friendRatings: any[] = await friendRes.json();
        if (!Array.isArray(myRatings) || !Array.isArray(friendRatings)) return;
        const friendMap = new Map(friendRatings.map(r => [r.media_external_id, r]));
        // Agree: both ≥4★, sorted by combined score
        const agreed = myRatings
          .filter(r => r.rating >= 4 && friendMap.has(r.media_external_id) && friendMap.get(r.media_external_id).rating >= 4 && r.media_title)
          .sort((a, b) => (b.rating + friendMap.get(b.media_external_id).rating) - (a.rating + friendMap.get(a.media_external_id).rating))
          .slice(0, 3)
          .map(r => r.media_title as string);
        setSharedTitles(agreed);
        // Differ: one ≥4★, other ≤2★
        const myDiverge = myRatings
          .filter(r => r.rating >= 4 && friendMap.has(r.media_external_id) && friendMap.get(r.media_external_id).rating <= 2 && r.media_title)
          .sort((a, b) => b.rating - a.rating)[0];
        const myExtIds = new Map(myRatings.map(r => [r.media_external_id, r]));
        const friendDiverge = friendRatings
          .filter(r => r.rating >= 4 && myExtIds.has(r.media_external_id) && (myExtIds.get(r.media_external_id)?.rating ?? 5) <= 2 && r.media_title)
          .sort((a: any, b: any) => b.rating - a.rating)[0];
        if (myDiverge || friendDiverge) {
          setDifferTitles({ myTitle: myDiverge?.media_title || '', friendTitle: friendDiverge?.media_title || '' });
        }
      } catch { /* silent */ }
    }
    fetchRatingOverlap();
  }, [dynFeatured?.userId, featuredProp?.userId, user?.id, session?.access_token]);

  const featured = dynFeatured ?? featuredProp ?? { displayName: 'Heidi Peters Tagliaferri', initials: 'HP', color: '#8b5cf6', pct: 71, tagline: 'You both love genre-spanning stories and thrilling narratives.' };
  const overlaps = dynOverlaps.length > 0 ? dynOverlaps : (overlapsProp ?? [
    { displayName: 'Jeeppler', initials: 'J', color: '#a855f7', pct: 38 },
    { displayName: 'Jordan F.', initials: 'JF', color: '#ec4899', pct: 31 },
    { displayName: 'Ambiannie', initials: 'A', color: '#f59e0b', pct: 24 },
  ]);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

        {/* Hero gradient banner — blue/green */}
        <div className="relative h-[52px] overflow-hidden" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 40%, #0d9488 100%)' }}>
          <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.28)' }}>
            <Dna size={10} className="text-white" />
            <span className="text-white text-[10px] font-bold uppercase tracking-widest">Compare DNA</span>
          </div>
          <button
            onClick={() => {
              const text = `I'm ${featured.pct}% aligned with ${featured.displayName} on Consumed! Check your Entertainment DNA 🧬`;
              const url = (import.meta.env.VITE_APP_URL as string) || window.location.origin;
              if (navigator.share) {
                navigator.share({ title: 'My Entertainment DNA', text, url }).catch(() => {});
              } else {
                window.open(`sms:?body=${encodeURIComponent(text + ' ' + url)}`, '_blank');
              }
            }}
            className="absolute top-2.5 right-3 flex items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <Share2 size={13} />
            <span className="text-[11px] font-medium">Share</span>
          </button>
        </div>

        {/* Triangle layout — compact, centered */}
        <div className="pt-3 pb-2 flex flex-col items-center">
          {noFriends && !featuredProp ? (
            <p className="text-gray-500 text-[13px] font-medium py-2 text-center">No friends to compare with yet.</p>
          ) : (
            <div className="flex flex-col items-center" style={{ width: 210 }}>
              {/* Arc ring — top of triangle, large */}
              {(() => {
                const pct = featured.pct;
                const r = 46;
                const circ = 2 * Math.PI * r;
                const dash = (pct / 100) * circ;
                return (
                  <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                    <svg className="absolute inset-0" width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r={r} fill="none" stroke="#ede9fe" strokeWidth="4" />
                      <circle cx="50" cy="50" r={r} fill="none" stroke="#8b5cf6" strokeWidth="4"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                    </svg>
                    <div className="flex flex-col items-center z-10">
                      <span className="font-black leading-none" style={{ fontSize: 24, color: '#8b5cf6' }}>{pct}%</span>
                      <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">aligned</span>
                    </div>
                  </div>
                );
              })()}

              {/* Two circles — bottom of triangle, close together */}
              <div className="flex justify-between w-full items-start">
                <div className="flex flex-col items-center gap-0.5" style={{ width: 90 }}>
                  <div className="rounded-full flex items-center justify-center font-black text-white text-[13px] shadow"
                    style={{ width: 44, height: 44, background: '#8b5cf6' }}>
                    {session?.user?.user_metadata?.display_name
                      ? initials(session.user.user_metadata.display_name)
                      : (user?.email?.[0] ?? 'Y').toUpperCase()}
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center">
                    {(session?.user?.user_metadata?.display_name ?? 'You').split(' ')[0]}
                  </span>
                  {myLabel && <span className="text-[8px] text-purple-500 font-medium text-center leading-tight line-clamp-2">{myLabel}</span>}
                </div>

                <div className="flex flex-col items-center gap-0.5" style={{ width: 90 }}>
                  <div className="rounded-full flex items-center justify-center font-black text-white text-[13px] shadow"
                    style={{ width: 44, height: 44, background: featured.color }}>
                    {featured.initials}
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center">
                    {featured.displayName.split(' ')[0]}
                  </span>
                  {featured.label && <span className="text-[8px] text-purple-500 font-medium text-center leading-tight line-clamp-2">{featured.label}</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agree / Differ rows */}
        {!noFriends && (sharedGenresFromDna.length > 0 || sharedTitles.length > 0 || differTitles) && (
          <div className="mx-4 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-2">
            {/* Agree most on — genres from DNA + rated title callout */}
            {(sharedGenresFromDna.length > 0 || sharedTitles.length > 0) && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Heart size={11} className="text-purple-500" fill="#8b5cf6" />
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Agree most on</span>
                  <span className="text-[11px] font-semibold text-gray-800 leading-snug">
                    {sharedGenresFromDna.length > 0 ? sharedGenresFromDna.join(' · ') : sharedTitles.join(' · ')}
                  </span>
                  {/* Concrete title evidence — only shown when we also have genres */}
                  {sharedGenresFromDna.length > 0 && sharedTitles.length > 0 && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100">
                      <span className="text-amber-400 text-[9px]">★</span>
                      <span className="text-[9px] text-purple-700 font-semibold">Both loved: {sharedTitles[0]}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Differ most on */}
            {differTitles && (differTitles.myTitle || differTitles.friendTitle) && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={11} className="text-amber-400" fill="#fbbf24" />
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Differ most on</span>
                  <span className="text-[11px] font-semibold text-gray-800 leading-snug">
                    {differTitles.myTitle && differTitles.friendTitle
                      ? `You love ${differTitles.myTitle} · They love ${differTitles.friendTitle}`
                      : differTitles.myTitle
                        ? `You love ${differTitles.myTitle}`
                        : `They love ${differTitles.friendTitle}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Others aligned — collapsible avatar strip */}
        {overlaps.length > 0 && (
          <div className="mx-4 mb-2 pt-2 border-t border-gray-100">
            <button
              className="flex items-center gap-2 w-full"
              onClick={() => setOthersExpanded(e => !e)}
            >
              {/* Stacked avatar circles */}
              <div className="flex items-center" style={{ marginRight: 2 }}>
                {overlaps.slice(0, 4).map((u, i) => (
                  <div
                    key={u.displayName}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-black border-2 border-white shadow-sm"
                    style={{ fontSize: 8, background: u.color, marginLeft: i === 0 ? 0 : -6, zIndex: 10 - i }}
                  >
                    {u.initials}
                  </div>
                ))}
                {overlaps.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold border-2 border-white" style={{ fontSize: 8, marginLeft: -6 }}>
                    +{overlaps.length - 4}
                  </div>
                )}
              </div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex-1 text-left">Others aligned</span>
              <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${othersExpanded ? 'rotate-180' : ''}`} />
            </button>
            {othersExpanded && (
              <div className="mt-2 flex flex-col gap-1.5 pl-1">
                {overlaps.map((u) => (
                  <div key={u.displayName} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
                      style={{ fontSize: 8, background: u.color }}
                    >
                      {u.initials}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 flex-1">{u.displayName.split(' ')[0]}</span>
                    {u.pct != null && u.pct > 0 && (
                      <span className="text-purple-500 text-[10px] font-bold">{u.pct}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Button */}
        <div className="px-4 pb-3">
          {noFriends && !featuredProp ? (
            <button
              onClick={() => setLocation("/friends")}
              className="w-full py-2 rounded-full bg-gray-100 text-gray-700 font-semibold text-[13px] hover:bg-gray-200 transition-colors text-center"
            >
              Add or invite friends →
            </button>
          ) : (
            <button
              onClick={() => session ? setSheetOpen(true) : setLocation("/dna")}
              className="w-full py-2 rounded-full bg-gray-100 text-gray-700 font-semibold text-[13px] hover:bg-gray-200 transition-colors text-center"
            >
              Compare with a friend →
            </button>
          )}
        </div>

      </div>

      {sheetOpen && session && user && (
        <CompareSheet
          onClose={() => setSheetOpen(false)}
          session={session}
          userId={user.id}
        />
      )}
    </>
  );
}

/* ── Inline post card (shared dna_compare social posts) ─────────────────── */
export function DnaComparePostCard({ item }: { item: any }) {
  const { session, user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [posterOverlaps, setPosterOverlaps] = useState<OverlapUser[]>([]);
  const [postOthersExpanded, setPostOthersExpanded] = useState(false);
  const [postSharedTitles, setPostSharedTitles] = useState<string[]>([]);

  let cmp: any = {};
  try { cmp = JSON.parse(item.content || '{}'); } catch {}

  const poster = item.user;
  const posterId: string = item.user_id || poster?.id || poster?.user_id || '';
  const posterName = (poster?.displayName || poster?.display_name || poster?.username || poster?.user_name || 'Someone') as string;
  const matchScore = cmp.match_score || 0;
  const friendName = (cmp.friend_name || 'a friend') as string;
  const sharedGenres: string[] = cmp.shared_genres || [];

  // Fetch poster's friend alignments for the right column
  useEffect(() => {
    if (!posterId || !session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY, 'Content-Type': 'application/json' };

    async function fetchPosterAlignments() {
      try {
        const [myDnaRes, fsRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/dna_profiles?user_id=eq.${posterId}&select=favorite_genres`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/friendships?or=(user_id.eq.${posterId},friend_id.eq.${posterId})&status=eq.accepted&select=user_id,friend_id`, { headers }),
        ]);
        const [posterDna] = await myDnaRes.json();
        const friendships = await fsRes.json();
        if (!posterDna?.favorite_genres?.length || !Array.isArray(friendships) || friendships.length === 0) return;

        const posterGenres: string[] = posterDna.favorite_genres;
        const friendIds = [...new Set(
          friendships.map((f: any) => f.user_id === posterId ? f.friend_id : f.user_id)
        )].filter((id: string) => id !== posterId) as string[];
        if (friendIds.length === 0) return;

        const [friendDnaRes, friendUsersRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/dna_profiles?user_id=in.(${friendIds.join(',')})&select=user_id,favorite_genres`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${friendIds.join(',')})&select=id,display_name,user_name`, { headers }),
        ]);
        const friendDnas = await friendDnaRes.json();
        const friendUsers = await friendUsersRes.json();
        if (!Array.isArray(friendDnas) || friendDnas.length === 0) return;

        const scored = friendDnas
          .map((fd: any, i: number) => {
            const genres: string[] = Array.isArray(fd.favorite_genres) ? fd.favorite_genres : [];
            const pct = calcOverlapPct(posterGenres, genres);
            const info = Array.isArray(friendUsers) ? friendUsers.find((u: any) => u.id === fd.user_id) : null;
            const displayName = info?.display_name || info?.user_name || 'Friend';
            return { displayName, pct, color: AVATAR_COLORS[i % AVATAR_COLORS.length], userId: fd.user_id };
          })
          .filter((u: any) => u.displayName !== friendName)
          .sort((a: any, b: any) => b.pct - a.pct);

        const scoredIds = new Set(scored.map((s: any) => s.userId));
        const dnaOverlaps = scored.slice(0, 5).map((r: any) => ({
          displayName: r.displayName, initials: initials(r.displayName), color: r.color, pct: r.pct,
        }));
        const nonDnaOverlaps = Array.isArray(friendUsers)
          ? friendUsers
              .filter((u: any) => !scoredIds.has(u.id) && (u.display_name || u.user_name) !== friendName)
              .slice(0, Math.max(0, 5 - dnaOverlaps.length))
              .map((u: any, i: number) => ({
                displayName: u.display_name || u.user_name || 'Friend',
                initials: initials(u.display_name || u.user_name || 'Friend'),
                color: AVATAR_COLORS[(scored.length + i) % AVATAR_COLORS.length],
              }))
          : [];

        setPosterOverlaps([...dnaOverlaps, ...nonDnaOverlaps]);

        // friend_id is stored directly in the post content JSON — no name matching needed
        const friendId: string | null = cmp?.friend_id || null;
        if (friendId && posterId) {
          try {
            const [posterRatingsRes, friendRatingsRes] = await Promise.all([
              fetch(`${SUPABASE_URL}/rest/v1/media_ratings?user_id=eq.${posterId}&rating=gte.4&select=media_title&limit=100`, { headers }),
              fetch(`${SUPABASE_URL}/rest/v1/media_ratings?user_id=eq.${friendId}&rating=gte.4&select=media_title&limit=100`, { headers }),
            ]);
            const posterRatings: any[] = await posterRatingsRes.json();
            const friendRatings: any[] = await friendRatingsRes.json();
            if (Array.isArray(posterRatings) && Array.isArray(friendRatings)) {
              const posterTitles = new Set(posterRatings.map((r: any) => (r.media_title || '').toLowerCase().trim()));
              const shared = friendRatings
                .filter((r: any) => posterTitles.has((r.media_title || '').toLowerCase().trim()))
                .map((r: any) => r.media_title as string)
                .slice(0, 3);
              if (shared.length > 0) setPostSharedTitles(shared);
            }
          } catch { /* silent */ }
        }
      } catch { /* silent */ }
    }
    fetchPosterAlignments();
  }, [posterId, session?.access_token, friendName]);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

        {/* Hero gradient banner — blue/green */}
        <div className="relative h-[52px] overflow-hidden" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 40%, #0d9488 100%)' }}>
          <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.28)' }}>
            <Dna size={10} className="text-white" />
            <span className="text-white text-[10px] font-bold uppercase tracking-widest">Compare DNA</span>
          </div>
          <button
            onClick={() => {
              const text = `${posterName.split(' ')[0]} is ${matchScore}% aligned with ${friendName} on Consumed! Check your Entertainment DNA 🧬`;
              const url = (import.meta.env.VITE_APP_URL as string) || window.location.origin;
              if (navigator.share) {
                navigator.share({ title: 'Entertainment DNA Match', text, url }).catch(() => {});
              } else {
                window.open(`sms:?body=${encodeURIComponent(text + ' ' + url)}`, '_blank');
              }
            }}
            className="absolute top-2.5 right-3 flex items-center gap-1 text-white/70 hover:text-white transition-colors"
          >
            <Share2 size={13} />
            <span className="text-[11px] font-medium">Share</span>
          </button>
        </div>

        {/* Triangle layout — compact, centered */}
        <div className="pt-3 pb-2 flex flex-col items-center">
          <div className="flex flex-col items-center" style={{ width: 220 }}>
            {/* Arc ring — sits in front (z-index 2) */}
            {(() => {
              const r = 46;
              const circ = 2 * Math.PI * r;
              const dash = (matchScore / 100) * circ;
              return (
                <div className="relative flex items-center justify-center" style={{ width: 100, height: 100, zIndex: 2 }}>
                  <svg className="absolute inset-0" width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#ede9fe" strokeWidth="4" />
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#8b5cf6" strokeWidth="4"
                      strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col items-center z-10">
                    <span className="font-black leading-none" style={{ fontSize: 24, color: '#8b5cf6' }}>{matchScore}%</span>
                    <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">aligned</span>
                  </div>
                </div>
              );
            })()}

            {/* Two avatar circles — pulled up behind the ring */}
            <div className="flex justify-between w-full items-start" style={{ marginTop: -22, zIndex: 1, position: 'relative' }}>
              <div className="flex flex-col items-center gap-1" style={{ width: 100 }}>
                <div className="rounded-full flex items-center justify-center font-black text-white shadow-md border-2 border-white"
                  style={{ width: 58, height: 58, background: '#8b5cf6', fontSize: 16 }}>
                  {initials(posterName)}
                </div>
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center">
                  {posterName.split(' ')[0]}
                </span>
                {cmp.your_dna_label && <span className="text-[8px] text-purple-500 font-medium text-center leading-tight line-clamp-2">{cmp.your_dna_label}</span>}
              </div>

              <div className="flex flex-col items-center gap-1" style={{ width: 100 }}>
                <div className="rounded-full flex items-center justify-center font-black text-white shadow-md border-2 border-white"
                  style={{ width: 58, height: 58, background: '#a855f7', fontSize: 16 }}>
                  {initials(friendName)}
                </div>
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center">
                  {friendName.split(' ')[0]}
                </span>
                {cmp.friend_dna_label && <span className="text-[8px] text-purple-500 font-medium text-center leading-tight line-clamp-2">{cmp.friend_dna_label}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Agree most on — genres from post content */}
        {Array.isArray(cmp.shared_genres) && cmp.shared_genres.length > 0 && (
          <div className="mx-4 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                <Heart size={11} className="text-purple-500" fill="#8b5cf6" />
              </div>
              <div>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Agree most on</span>
                <span className="text-[11px] font-semibold text-gray-800 leading-snug">
                  {(cmp.shared_genres as string[]).slice(0, 3).join(' · ')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Both loved — shared 4★+ titles, same style as Agree most on */}
        {postSharedTitles.length > 0 && (
          <div className="mx-4 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-amber-400 text-[11px] leading-none">★</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Both loved</span>
                <span className="text-[11px] font-semibold text-gray-800 leading-snug">
                  {postSharedTitles.join(' · ')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Others aligned — collapsible avatar strip */}
        {posterOverlaps.length > 0 && (
          <div className="mx-4 mb-2 pt-2 border-t border-gray-100">
            <button
              className="flex items-center gap-2 w-full"
              onClick={() => setPostOthersExpanded(e => !e)}
            >
              <div className="flex items-center">
                {posterOverlaps.slice(0, 4).map((u, i) => (
                  <div
                    key={u.displayName}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-black border-2 border-white shadow-sm"
                    style={{ fontSize: 8, background: u.color, marginLeft: i === 0 ? 0 : -6, zIndex: 10 - i }}
                  >
                    {u.initials}
                  </div>
                ))}
                {posterOverlaps.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold border-2 border-white" style={{ fontSize: 8, marginLeft: -6 }}>
                    +{posterOverlaps.length - 4}
                  </div>
                )}
              </div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex-1 text-left">Others aligned</span>
              <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${postOthersExpanded ? 'rotate-180' : ''}`} />
            </button>
            {postOthersExpanded && (
              <div className="mt-2 flex flex-col gap-1.5 pl-1">
                {posterOverlaps.map((u) => (
                  <div key={u.displayName} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
                      style={{ fontSize: 8, background: u.color }}
                    >
                      {u.initials}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 flex-1">{u.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Button */}
        <div className="px-4 pb-3">
          <button
            onClick={() => session ? setSheetOpen(true) : undefined}
            className="w-full py-2 rounded-full bg-gray-100 text-gray-700 font-semibold text-[13px] hover:bg-gray-200 transition-colors text-center"
          >
            Compare with a friend →
          </button>
        </div>

      </div>

      {sheetOpen && session && user && (
        <CompareSheet
          onClose={() => setSheetOpen(false)}
          session={session}
          userId={user.id}
        />
      )}
    </>
  );
}
