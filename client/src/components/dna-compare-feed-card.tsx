import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Dna, ArrowRight, Users, X, ChevronLeft, Loader2, Share2, CheckCircle2 } from "lucide-react";

/* ── types ─────────────────────────────────────────── */
interface OverlapUser {
  displayName: string;
  initials: string;
  color: string;
  pct: number;
}

interface CompareUser {
  displayName: string;
  initials: string;
  color: string;
  pct: number;
  tagline: string;
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
function CompareSheet({
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
        if (!myDna?.favorite_genres?.length || !Array.isArray(friendships) || friendships.length === 0) return;

        const myGenres: string[] = myDna.favorite_genres;
        const friendIds = [...new Set(
          friendships.map((f: any) => f.user_id === user!.id ? f.friend_id : f.user_id)
        )].filter((id: string) => id !== user!.id) as string[];
        if (friendIds.length === 0) return;

        // 2. Fetch friends' DNA profiles + display names in parallel
        const [friendDnaRes, friendUsersRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/dna_profiles?user_id=in.(${friendIds.join(',')})&select=user_id,favorite_genres,label`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${friendIds.join(',')})&select=id,display_name,user_name`, { headers }),
        ]);
        const friendDnas = await friendDnaRes.json();
        const friendUsers = await friendUsersRes.json();
        if (!Array.isArray(friendDnas) || friendDnas.length === 0) return;

        // 3. Score each friend by genre overlap, sort descending
        const scored = friendDnas
          .map((fd: any, i: number) => {
            const genres: string[] = Array.isArray(fd.favorite_genres) ? fd.favorite_genres : [];
            const pct = calcOverlapPct(myGenres, genres);
            const info = Array.isArray(friendUsers) ? friendUsers.find((u: any) => u.id === fd.user_id) : null;
            const displayName = info?.display_name || info?.user_name || 'Friend';
            return { displayName, pct, color: AVATAR_COLORS[i % AVATAR_COLORS.length] };
          })
          .sort((a: any, b: any) => b.pct - a.pct);

        if (scored.length === 0) return;
        const [top, ...rest] = scored;
        const firstName = top.displayName.split(' ')[0];

        setDynFeatured({
          displayName: top.displayName,
          initials: initials(top.displayName),
          color: top.color,
          pct: top.pct,
          tagline: buildTagline(top.pct, firstName),
        });
        setDynOverlaps(rest.slice(0, 3).map((r: any) => ({
          displayName: r.displayName,
          initials: initials(r.displayName),
          color: r.color,
          pct: r.pct,
        })));
      } catch {
        // silent — fall through to prop defaults
      } finally {
        setLoadingPersonal(false);
      }
    }
    fetchPersonalized();
  }, [session?.access_token, user?.id]);

  const featured = dynFeatured ?? featuredProp ?? { displayName: 'Heidi', initials: 'HP', color: '#8b5cf6', pct: 71, tagline: 'You both love genre-spanning stories and thrilling narratives.' };
  const overlaps = dynOverlaps.length > 0 ? dynOverlaps : (overlapsProp ?? [
    { displayName: 'Jeeppler', initials: 'J', color: '#a855f7', pct: 38 },
    { displayName: 'Jordan F.', initials: 'JF', color: '#ec4899', pct: 31 },
    { displayName: 'Ambiannie', initials: 'A', color: '#f59e0b', pct: 24 },
  ]);

  return (
    <>
      <div className="bg-gray-50 rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

        {/* Header row */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
          <Dna size={11} className="text-purple-500 shrink-0" />
          <span className="text-[11px] font-bold text-purple-500 uppercase tracking-widest">Compare DNA</span>
        </div>

        {/* Main content */}
        <div className="px-4 pb-4 flex flex-col gap-4">
          {/* Left + right columns */}
          <div className="flex gap-3">
            {/* Left: avatars + score + tagline */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex items-center gap-0">
                <div
                  className="rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-indigo-500"
                  style={{ width: 40, height: 40, fontSize: 13 }}
                >
                  Me
                </div>
                <svg width="44" height="38" viewBox="0 0 44 38" fill="none" className="shrink-0">
                  <defs>
                    <linearGradient id="cmp-wave-card" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,19 Q4,8 8,19 Q12,30 16,19 Q20,8 22,19 Q24,30 28,19 Q32,8 36,19 Q40,30 44,19"
                    stroke="url(#cmp-wave-card)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div
                  className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
                  style={{ width: 40, height: 40, background: featured.color, fontSize: 13 }}
                >
                  {featured.initials}
                </div>
              </div>
              <div>
                <p className="text-gray-900 font-extrabold leading-tight" style={{ fontSize: 18 }}>
                  <span style={{ color: "#a855f7" }}>{featured.pct}%</span> aligned with
                </p>
                <p className="text-gray-900 font-extrabold leading-tight" style={{ fontSize: 18 }}>
                  {featured.displayName}
                </p>
              </div>
              <p className="text-gray-400 text-[11px] leading-snug">{featured.tagline}</p>
            </div>

            {/* Right: overlap list */}
            <div className="flex flex-col gap-1 pt-1 min-w-[110px]">
              <span className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-0.5">Top overlaps</span>
              {overlaps.map((u) => (
                <div key={u.displayName} className="flex items-center gap-2">
                  <div
                    className="rounded-full shrink-0 flex items-center justify-center font-bold text-white text-[9px]"
                    style={{ width: 22, height: 22, background: u.color }}
                  >
                    {u.initials}
                  </div>
                  <span className="text-gray-700 text-[11px] truncate flex-1">{u.displayName}</span>
                  <span className="text-gray-400 text-[11px] font-semibold shrink-0">{u.pct}%</span>
                </div>
              ))}
              <button
                onClick={() => setLocation("/friends")}
                className="flex items-center gap-0.5 text-purple-500 text-[11px] font-semibold mt-1 hover:text-purple-600 transition-colors"
              >
                See all <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="border-t border-gray-100 flex flex-col divide-y divide-gray-100">
          <button
            onClick={() => setLocation("/entertainment-dna")}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>What's your entertainment DNA?</span>
            <span className="text-purple-500 text-[11px] font-bold shrink-0 ml-2">Take the quiz →</span>
          </button>
          <button
            onClick={() => session ? setSheetOpen(true) : setLocation("/dna")}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Users size={13} className="text-purple-400 shrink-0" />
              Compare your DNA with a friend
            </span>
            <ArrowRight size={13} className="text-purple-400 shrink-0 ml-2" />
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
