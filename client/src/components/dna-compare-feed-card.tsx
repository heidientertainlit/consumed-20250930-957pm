import { useState, useEffect, useRef as useReactRef, type CSSProperties } from "react";
import html2canvas from "html2canvas";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Dna, ArrowRight, Users, X, ChevronLeft, Loader2, Share2, CheckCircle2, Heart, Zap, Download, HelpCircle } from "lucide-react";
import { formatFeedName } from "@/lib/feed-name";
import { DnaComparisonDeveloping, isDnaComparisonReady } from "@/components/dna-comparison-developing";
import { getDnaComparisonUpdateDetail } from "@/lib/dna-comparison-readiness";
import consumedPurpleLogo from "../../../attached_assets/consumed_logo_purple_bgTransparent_1788203998710.png";

/* ── types ─────────────────────────────────────────── */
interface OverlapUser {
  displayName: string;
  initials: string;
  color: string;
  pct?: number;
  avatarUrl?: string | null;
}

interface CompareUser {
  displayName: string;
  initials: string;
  color: string;
  pct: number;
  tagline: string;
  label?: string;
  userId?: string;
  avatarUrl?: string | null;
}

interface Friend {
  id: string;
  user_name: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  comparisonStatus?: "ready" | "developing";
}

interface ComparisonResult {
  match_score: number;
  comparison_status?: "ready" | "developing";
  comparison_readiness?: { status?: "ready" | "developing" };
  shared_genres: string[];
  shared_creators?: string[];
  shared_titles?: Array<{
    title: string;
    media_type?: string;
    external_id?: string;
    external_source?: string;
  } | string>;
  differences: { user_unique: string[]; friend_unique: string[] };
  insights: {
    compatibilityLine?: string;
    comparison_readiness?: { status?: "ready" | "developing" };
  };
  friend_name: string;
  friend_dna_label?: string;
  your_dna_label?: string;
  individual_stats?: {
    user?: { total_tracked?: number; average_rating?: number | null; top_media_type?: string | null };
    friend?: { total_tracked?: number; average_rating?: number | null; top_media_type?: string | null };
  };
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

function formatFriendName(friend: Friend): string {
  const fullName = [friend.first_name, friend.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || friend.display_name?.trim() || friend.user_name;
}

function FriendAvatar({ friend, size = 40 }: { friend: Friend; size?: number }) {
  const label = formatFriendName(friend);
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

function ProfileAvatar({
  avatarUrl,
  label,
  fallback,
  color,
  size,
  className = "",
  style,
}: {
  avatarUrl?: string | null;
  label: string;
  fallback: string;
  color: string;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center font-black text-white ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.26), ...style }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={label} crossOrigin="anonymous" className="w-full h-full object-cover" />
        : fallback}
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
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"loading-friends" | "pick" | "comparing" | "result" | "no-friends" | "error">("loading-friends");
  const resultCardRef = useReactRef<HTMLDivElement>(null);
  const [sharingText, setSharingText] = useState(false);
  const [sharingPhoto, setSharingPhoto] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
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
          `${SUPABASE_URL}/rest/v1/users?id=in.(${friendIds.join(",")})&select=id,user_name,display_name,first_name,last_name,avatar`,
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
          const readinessRes = await fetch(
            `${SUPABASE_URL}/functions/v1/compare-dna-friend`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                action: "readiness-list",
                friend_ids: eligible.map((friend) => friend.id),
              }),
            }
          );
          if (!readinessRes.ok) throw new Error("Couldn't load comparison readiness");
          const readinessData = await readinessRes.json();
          const readinessByFriend = new Map(
            (readinessData.friends || []).map((item: any) => [item.friend_id, item.status])
          );
          setFriends(eligible.map((friend) => ({
            ...friend,
            comparisonStatus: readinessByFriend.get(friend.id) === "ready" ? "ready" : "developing",
          })));
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
      const updateDetail = getDnaComparisonUpdateDetail(friend.id, data);
      if (updateDetail) {
        window.dispatchEvent(new CustomEvent("dna-comparison-updated", {
          detail: updateDetail,
        }));
      }
    } catch (e: any) {
      setErrMsg(e.message || "Something went wrong");
      setStep("error");
    }
  }

  const friendLabel = formatFriendName;

  const comparisonText = () => {
    if (!selected || !result || !isDnaComparisonReady(result)) return "";
    return `${friendLabel(selected)} and I are ${result.match_score}% aligned. Compare your Entertainment DNA with me on Consumed.`;
  };

  async function handleShareText() {
    if (!selected || !result || !isDnaComparisonReady(result) || sharingText) return;
    setSharingText(true);
    setShareNotice("");
    const url = `${(import.meta.env.VITE_APP_URL as string) || window.location.origin}/edna/${userId}?compare=1&v=2`;
    const text = comparisonText();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Compare your Entertainment DNA with me",
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareNotice("Comparison text and link copied.");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setShareNotice("Couldn’t open sharing. Try again.");
      }
    } finally {
      setSharingText(false);
    }
  }

  async function handleSharePhoto() {
    if (!selected || !result || !isDnaComparisonReady(result) || !resultCardRef.current || sharingPhoto) return;
    setSharingPhoto(true);
    setShareNotice("");
    try {
      const canvas = await html2canvas(resultCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create comparison image");

      const file = new File([blob], "entertainment-dna-match.png", { type: "image/png" });
      const shareData = {
        title: "Our Entertainment DNA Match",
        text: comparisonText(),
        files: [file],
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        const imageUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(imageUrl), 5000);
        setShareNotice("Comparison photo saved.");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Could not share DNA comparison photo:", error);
        setShareNotice("Couldn’t create the photo. Try again.");
      }
    } finally {
      setSharingPhoto(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/45"
      style={{ zIndex: 10000 }}
      onClick={onClose}
    >
      <div
        className="flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(25,15,35,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[#eeeaf1] px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step === "result" && (
                <button
                  onClick={() => { setStep("pick"); setResult(null); setSelected(null); }}
                  className="rounded-full p-1.5 text-[#665d6d] transition-colors hover:bg-[#f5f2f7] hover:text-[#30203f]"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <span className="text-[18px] font-bold text-[#30203f]">
                {step === "result" ? `You vs ${friendLabel(selected!)}` : "Compare DNA"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-[#f5f2f7] p-2 text-[#665d6d] transition-colors hover:text-[#30203f]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">

          {/* Loading friends */}
          {step === "loading-friends" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-purple-400" size={28} />
              <p className="text-[13px] text-[#918a98]">Loading your friends…</p>
            </div>
          )}

          {/* Comparing */}
          {step === "comparing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-purple-400" size={28} />
              <p className="text-[13px] text-[#918a98]">
                Comparing your DNA with {selected ? friendLabel(selected) : ""}…
              </p>
            </div>
          )}

          {/* No friends with DNA */}
          {step === "no-friends" && (
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <Users size={32} className="text-white/20" />
              <p className="text-[15px] font-semibold text-[#30203f]">No friends with DNA yet</p>
              <p className="max-w-[260px] text-[12px] text-[#918a98]">
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
            <div className="flex flex-col pt-3">
              {[...friends]
                .sort((a, b) => Number(b.comparisonStatus === "ready") - Number(a.comparisonStatus === "ready"))
                .map((f) => {
                const ready = f.comparisonStatus === "ready";
                const content = (
                  <>
                    <FriendAvatar friend={f} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-[15px] font-semibold text-[#30203f]">
                          {friendLabel(f)}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${
                          ready
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-[#f3f0f5] text-[#918a98]"
                        }`}>
                          {ready ? "Compare" : "Needs more DNA to compare"}
                        </span>
                      </div>
                      <span className="text-[12px] text-[#918a98]">@{f.user_name}</span>
                    </div>
                    {ready && <ArrowRight size={17} className="shrink-0 text-[#b1aab5]" />}
                  </>
                );

                return ready ? (
                  <button
                    key={f.id}
                    onClick={() => handlePick(f)}
                    className="flex items-center gap-3 border-b border-[#eeeaf1] py-4 text-left transition-colors hover:bg-[#faf8fb]"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={f.id}
                    aria-disabled="true"
                    className="flex items-center gap-3 border-b border-[#eeeaf1] py-4 text-left"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}

          {/* Result */}
          {step === "result" && result && selected && (
            <div className="flex flex-col gap-8 pt-6">
              {!isDnaComparisonReady(result) ? (
                <DnaComparisonDeveloping friendName={friendLabel(selected)} />
              ) : (
                <>
              <div
                ref={resultCardRef}
                className="flex flex-col gap-8 bg-white py-2"
              >
                {/* Score + avatars */}
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={consumedPurpleLogo}
                    alt="Consumed"
                    className="mb-2 h-6 w-auto object-contain"
                  />
                  <p className="font-serif text-[25px] font-normal tracking-[-.025em] text-[#30203f]">
                    You + {friendLabel(selected)}
                  </p>
                  <div className="rounded-full border border-violet-100 bg-gradient-to-r from-violet-50 via-purple-100 to-violet-50 px-4 py-2 text-[13px] font-semibold text-violet-700 shadow-sm">
                    <span className="mr-1.5 text-violet-500">✣</span>
                    Comparing your Entertainment DNA
                  </div>
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
                    <p className="font-serif text-[42px] font-normal leading-none tracking-[-.04em] text-violet-600">
                      {result.match_score}%
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[.18em] text-[#918a98]">
                      Entertainment DNA match
                    </p>
                  </div>
                </div>

                {/* Individual DNA stats */}
                {result.individual_stats && (
                  <div className="grid grid-cols-2 divide-x divide-[#e9e3ee] border-y border-[#e9e3ee] py-5">
                    {([
                      {
                        label: "You",
                        stats: result.individual_stats.user,
                        archetype: result.your_dna_label,
                      },
                      {
                        label: friendLabel(selected),
                        stats: result.individual_stats.friend,
                        archetype: result.friend_dna_label,
                      },
                    ] as const).map((person) => {
                      const mediaType = person.stats?.top_media_type;
                      const mediaTypeLabel = mediaType === "tv"
                        ? "TV"
                        : mediaType
                          ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
                          : null;
                      return (
                        <div key={person.label} className="px-4 text-center first:pl-0 last:pr-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#918a98]">
                            {person.label}
                          </p>
                          <p className="mt-2 font-serif text-[24px] leading-none text-[#30203f]">
                            {person.stats?.total_tracked ?? 0}
                          </p>
                          <p className="mt-1 text-[11px] text-[#665d6d]">total tracked</p>
                          {person.stats?.average_rating != null && (
                            <p className="mt-2 text-[11px] font-semibold text-violet-600">
                              {person.stats.average_rating.toFixed(1)} ★ average rating
                            </p>
                          )}
                          {mediaTypeLabel && (
                            <p className="mt-1 text-[11px] text-[#665d6d]">
                              Top type: {mediaTypeLabel}
                            </p>
                          )}
                          {person.archetype && (
                            <p className="mt-1 text-[10px] leading-tight text-[#918a98]">
                              {person.archetype}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Shared media titles */}
                {result.shared_titles?.length ? (
                  <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-[#918a98]">You both liked</p>
                  <div className="grid grid-cols-2 gap-5">
                    {result.shared_titles.slice(0, 2).map((item) => {
                      const title = typeof item === "string" ? item : item.title;
                      const mediaType = typeof item === "string" ? null : item.media_type;
                      const externalId = typeof item === "string" ? null : item.external_id;
                      const externalSource = typeof item === "string" ? null : item.external_source;
                      const mediaTypeLabel = mediaType === "tv"
                        ? "TV"
                        : mediaType
                          ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
                          : null;
                      const className = "block w-full min-w-0 py-3 text-left";
                      const content = (
                        <>
                          <span className="block font-serif text-[18px] leading-snug text-violet-700">
                            {title}
                          </span>
                          {mediaTypeLabel && (
                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[.14em] text-[#918a98]">
                              {mediaTypeLabel}
                            </span>
                          )}
                        </>
                      );

                      if (externalId && externalSource && mediaType) {
                        return (
                          <button
                            key={`${mediaType}:${externalSource}:${externalId}`}
                            type="button"
                            className={`${className} hover:text-violet-900`}
                            onClick={() => {
                              onClose();
                              setLocation(`/media/${mediaType.toLowerCase()}/${externalSource}/${externalId}`);
                            }}
                          >
                            {content}
                          </button>
                        );
                      }

                      return (
                        <span key={`${mediaType || "media"}:${title}`} className={`${className} text-[#5c5263]`}>
                          {content}
                        </span>
                      );
                    })}
                  </div>
                  </div>
                ) : null}

              </div>

                </>
              )}
            </div>
          )}
        </div>
        {step === "result" && result && selected && isDnaComparisonReady(result) && (
          <div className="z-10 shrink-0 border-t border-[#eeeaf1] bg-white px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {shareNotice && (
              <p className="mb-2 text-center text-[12px] text-violet-600">{shareNotice}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleShareText}
                disabled={sharingText || sharingPhoto}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d9d2de] bg-white px-3 text-[13px] font-semibold text-[#30203f] disabled:opacity-50"
              >
                {sharingText ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                Share by Text
              </button>
              <button
                onClick={handleSharePhoto}
                disabled={sharingText || sharingPhoto}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-500 px-3 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {sharingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Share Photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Main card ──────────────────────────────────────── */
export default function DnaCompareFeedCard({ featured: featuredProp }: DnaCompareFeedCardProps) {
  const [, setLocation] = useLocation();
  const { session, user, loading: authLoading } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dynFeatured, setDynFeatured] = useState<CompareUser | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [noFriends, setNoFriends] = useState(false);
  const [myLabel, setMyLabel] = useState<string | null>(null);
  const [sharedTitles, setSharedTitles] = useState<string[]>([]);
  const [differTitles, setDifferTitles] = useState<{ myTitle: string; friendTitle: string } | null>(null);
  const [sharedGenresFromDna, setSharedGenresFromDna] = useState<string[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState("");

  useEffect(() => {
    // Wait for auth to finish loading; skip if not logged in
    if (authLoading) return;
    if (!user?.id) { setLoadingPersonal(false); return; }

    let cancelled = false;

    async function fetchPersonalized() {
      try {
        // Call edge function — uses service role, bypasses RLS entirely
        const { data, error } = await supabase.functions.invoke('get-dna-feed-data');
        if (cancelled) return;

        if (error) {
          setLoadingPersonal(false);
          return;
        }

        const myDna = data?.myDna;
        setMyAvatar(data?.myUser?.avatar ?? null);
        const friendDnas: any[] = data?.friendDnas ?? [];
        const friendUsers: any[] = data?.friendUsers ?? [];
        const cmp1: any[] = data?.cmp1 ?? [];
        const cmp2: any[] = data?.cmp2 ?? [];

        if (!myDna?.favorite_genres?.length) { setNoFriends(true); setLoadingPersonal(false); return; }
        if (friendDnas.length === 0) { setNoFriends(true); setLoadingPersonal(false); return; }

        const myGenres: string[] = myDna.favorite_genres;
        if (myDna.label) setMyLabel(myDna.label);

        // Build map of friendId → best real match_score from dna_comparisons
        const cmpMap = new Map<string, number>();
        const addToCmpMap = (friendId: string, score: number) => {
          if (!cmpMap.has(friendId) || score > cmpMap.get(friendId)!) {
            cmpMap.set(friendId, Math.round(score));
          }
        };
        cmp1.forEach((r: any) => addToCmpMap(r.user_id_2, r.match_score));
        cmp2.forEach((r: any) => addToCmpMap(r.user_id_1, r.match_score));

        // Only show friends with real dna_comparisons scores — no Jaccard fallback
        const myGenreSet = new Set(myGenres.map((g: string) => g.toLowerCase()));
        const scoredWithReal = friendDnas
          .filter((fd: any) => cmpMap.has(fd.user_id))
          .map((fd: any, i: number) => {
            const genres: string[] = Array.isArray(fd.favorite_genres) ? fd.favorite_genres : [];
            const pct = cmpMap.get(fd.user_id)!;
            const info = friendUsers.find((u: any) => u.id === fd.user_id);
            const displayName = formatFeedName(
              info?.display_name,
              info?.user_name,
              info?.first_name,
              info?.last_name,
            );
            const shared = genres.filter((g: string) => myGenreSet.has(g.toLowerCase()));
            return { displayName, pct, color: AVATAR_COLORS[i % AVATAR_COLORS.length], label: fd.label || null, userId: fd.user_id, sharedGenres: shared, avatarUrl: info?.avatar ?? null };
          })
          .sort((a: any, b: any) => b.pct - a.pct);

        if (scoredWithReal.length === 0) {
          setNoFriends(true);
          setLoadingPersonal(false);
          return;
        }

        const [top] = scoredWithReal;
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
          avatarUrl: top.avatarUrl,
        });

      } catch (err) {
        console.error('Failed to load DNA compare data', err);
      } finally {
        if (!cancelled) setLoadingPersonal(false);
      }
    }

    fetchPersonalized();
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  // Rating-level agree/differ comparison — runs after dynFeatured is populated
  useEffect(() => {
    const friendId = (dynFeatured ?? featuredProp)?.userId;
    if (!friendId) return;
    let cancelled = false;
    async function fetchRatingOverlap() {
      try {
        const { data: { user: liveUser } } = await supabase.auth.getUser();
        if (cancelled || !liveUser?.id) return;
        const [myRes, friendRes] = await Promise.all([
          supabase.from('media_ratings').select('media_external_id,media_title,rating').eq('user_id', liveUser.id),
          supabase.from('media_ratings').select('media_external_id,media_title,rating').eq('user_id', friendId),
        ]);
        if (cancelled) return;
        const myRatings: any[] = myRes.data ?? [];
        const friendRatings: any[] = friendRes.data ?? [];
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
    return () => { cancelled = true; };
  }, [dynFeatured?.userId, featuredProp?.userId]);

  const featured = dynFeatured ?? featuredProp ?? null;
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const cardRef = useReactRef<HTMLDivElement>(null);
  const currentUserName = session?.user?.user_metadata?.display_name
    ? formatFeedName(session.user.user_metadata.display_name, session.user.user_metadata.user_name)
    : "You";
  const isInviteEmpty = Boolean(session && user && noFriends && !featuredProp);
  const inviteUrl = user?.id
    ? `${(import.meta.env.VITE_APP_URL as string) || window.location.origin}/invite/${user.id}`
    : "";

  const handleInvite = async () => {
    if (!inviteUrl) return;
    const title = "Join me on Consumed";
    const text = "Compare your entertainment taste with mine on Consumed.";

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: inviteUrl });
      } catch (error) {
        if ((error as DOMException)?.name !== "AbortError") {
          setInviteStatus("Couldn’t open sharing. Try again.");
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
      setInviteStatus("Invite link copied.");
    } catch {
      setInviteStatus("Copy this invite link: " + inviteUrl);
    }
  };

  // Show skeleton while loading — prevents null crash on featured.pct etc.
  if (loadingPersonal && !featured) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4 animate-pulse">
        <div className="h-[44px]" />
        <div className="pt-4 pb-3 flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-gray-100" />
          <div className="h-3 w-32 bg-gray-100 rounded-full" />
          <div className="h-3 w-24 bg-gray-100 rounded-full" />
        </div>
        <div className="h-8 mx-4 mb-3 bg-gray-100 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div ref={cardRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">

        {/* Header — plain white, pill badge */}
        <div className="relative h-[44px]">
          <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100">
            <Dna size={10} className="text-violet-600" />
            <span className="text-violet-600 text-[10px] font-bold uppercase tracking-widest">Compare DNA</span>
          </div>
          {(!isInviteEmpty) && <button
            onClick={() => setShareMenuOpen(v => !v)}
            className="absolute top-2.5 right-3 flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-expanded={shareMenuOpen}
            aria-label="Open sharing options"
          >
            <span className="text-[13px] font-medium">Share</span>
            <span className="text-[13px]" aria-hidden="true">→</span>
          </button>}
          {!isInviteEmpty && shareMenuOpen && (
            <div className="absolute top-9 right-3 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden w-[170px]">
              <button
                onClick={() => {
                  setShareMenuOpen(false);
                  if (!featured) return;
                  const text = `I'm ${featured.pct}% aligned with ${formatFeedName(featured.displayName)} on Consumed! Check your Entertainment DNA 🧬`;
                  const url = (import.meta.env.VITE_APP_URL as string) || window.location.origin;
                  if (navigator.share) {
                    navigator.share({ title: 'My Entertainment DNA', text, url }).catch(() => {});
                  } else {
                    window.open(`sms:?body=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                  }
                }}
                className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-gray-800 hover:bg-gray-50 border-b border-gray-100"
              >
                Share link
              </button>
              <button
                onClick={async () => {
                  setShareMenuOpen(false);
                  if (!cardRef.current || savingImage) return;
                  setSavingImage(true);
                  try {
                    const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
                    if (blob && navigator.share) {
                      const file = new File([blob], 'dna-match.png', { type: 'image/png' });
                      const withImage = { files: [file], title: 'My Entertainment DNA' } as any;
                      try {
                        if (navigator.canShare?.(withImage)) {
                          await navigator.share(withImage);
                          return;
                        }
                      } catch (err: any) {
                        if (err?.name === 'AbortError') return;
                      }
                    }
                    // Fallback: show the image in-app so it can be long-pressed / right-click saved
                    setShareImageUrl(canvas.toDataURL('image/png'));
                  } catch (err) {
                    console.error('Failed to save image', err);
                  } finally {
                    setSavingImage(false);
                  }
                }}
                className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-gray-800 hover:bg-gray-50"
              >
                {savingImage ? 'Saving…' : 'Save as image'}
              </button>
            </div>
          )}
        </div>

        {/* Split card — you (violet) vs friend (amber), match badge centered */}
        <div className="px-3 pt-1 pb-3">
          {isInviteEmpty ? (
            <div className="px-2 pt-3 pb-2 text-center">
              <div className="flex items-center justify-center gap-3">
                <ProfileAvatar
                  size={54}
                  color="#8b5cf6"
                  avatarUrl={myAvatar}
                  label="Your profile photo"
                  fallback={currentUserName === "You" ? (user?.email?.[0] ?? "Y").toUpperCase() : initials(currentUserName)}
                  className="shadow-sm ring-2 ring-[#f7f3ef]"
                />
                <div className="w-10 border-t border-dashed border-[#d9d1d9]" />
                <div
                  className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border border-[#d9d1d9] bg-[#f4f0ef] text-[#6a5576]"
                  aria-label="A friend to invite"
                >
                  <HelpCircle size={23} strokeWidth={1.7} aria-hidden="true" />
                </div>
              </div>
              <h2 className="mt-4 font-serif text-[22px] font-medium leading-[1.12] tracking-[-.025em] text-[#281e34]">
                Taste is better with company
              </h2>
              <p className="mx-auto mt-2 max-w-[285px] text-sm leading-5 text-[#746b78]">
                Invite a friend to discover where your favorite stories, sounds, and obsessions align.
              </p>
            </div>
          ) : featured ? (
            <div className="flex flex-col items-center pt-4 pb-2">
              {/* Big match number */}
              <span className="font-serif font-normal leading-none" style={{ fontSize: 42, color: '#7c3aed' }}>{featured.pct}%</span>
              <span className="text-[13px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Match</span>

               {/* Names + archetypes above each avatar */}
               <div className="flex w-full max-w-[300px] px-2 mt-3">
                 <div className="flex flex-col items-center" style={{ width: 100 }}>
                   <span className="font-serif text-[24px] font-normal tracking-[-.035em] text-[#30203f] text-center">
                     {session?.user?.user_metadata?.display_name
                       ? formatFeedName(
                           session.user.user_metadata.display_name,
                           session.user.user_metadata.user_name,
                         )
                       : 'You'}
                   </span>
                   {myLabel && <span className="text-[10px] text-purple-500 font-medium text-center leading-tight line-clamp-2">{myLabel}</span>}
                 </div>
                 <div className="flex-1" />
                 <div className="flex flex-col items-center" style={{ width: 100 }}>
                   <span className="font-serif text-[24px] font-normal tracking-[-.035em] text-[#30203f] text-center">
                     {formatFeedName(featured.displayName)}
                   </span>
                   {featured.label && <span className="text-[10px] text-blue-500 font-medium text-center leading-tight line-clamp-2">{featured.label}</span>}
                 </div>
               </div>

              {/* Avatars joined by dashed line with DNA strand in the middle */}
               <div className="flex items-center w-full max-w-[300px] mt-2 px-2">
                <div className="flex flex-col items-center" style={{ width: 100 }}>
                  <ProfileAvatar
                    size={52}
                    color="#8b5cf6"
                    avatarUrl={myAvatar}
                    label="Your profile photo"
                    className="shadow"
                    fallback={session?.user?.user_metadata?.display_name
                      ? initials(formatFeedName(
                          session.user.user_metadata.display_name,
                          session.user.user_metadata.user_name,
                        ))
                      : (user?.email?.[0] ?? 'Y').toUpperCase()}
                  />
                </div>
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
                <Dna size={18} className="text-violet-500 shrink-0 mx-1.5" />
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
                <div className="flex flex-col items-center" style={{ width: 100 }}>
                  <ProfileAvatar size={52} color="#3b82f6" avatarUrl={featured.avatarUrl}
                    label={featured.displayName} fallback={featured.initials} className="shadow" />
                </div>
              </div>
            </div>
          ) : <p className="text-gray-500 text-[13px] font-medium py-2 text-center">No friends to compare with yet.</p>}
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
                    <span className="inline-flex items-center gap-1 mt-1 ml-2 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100">
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

        {/* Footer action */}
        <div className={`${isInviteEmpty ? "mt-2 border-t border-[#e6e0df] px-5 pt-4 pb-5" : "px-4 pb-3"}`}>
          {isInviteEmpty ? (
            <button
              onClick={handleInvite}
              className="group inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-[#5b367b] transition-colors hover:text-[#402355] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6aa5] focus-visible:ring-offset-2"
            >
              Invite a friend to compare <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={() => session ? setSheetOpen(true) : setLocation("/dna")}
              className="w-full py-2 rounded-full bg-gray-100 text-gray-700 font-semibold text-[13px] hover:bg-gray-200 transition-colors text-center"
            >
              Compare with another friend →
            </button>
          )}
          {isInviteEmpty && <p className="sr-only" aria-live="polite">{inviteStatus}</p>}
          {isInviteEmpty && inviteStatus.startsWith("Copy this") && (
            <p className="mt-3 break-all rounded-lg bg-[#f7f3ef] px-3 py-2 text-center text-[11px] leading-4 text-[#67447c]">
              {inviteStatus}
            </p>
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

      {shareImageUrl && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/80 flex flex-col items-center justify-center p-6" onClick={() => setShareImageUrl(null)}>
          <img src={shareImageUrl} alt="Your DNA match" className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="text-white/90 text-[13px] font-medium mt-4 text-center">Press and hold the image to save it to your photos</p>
          <button onClick={() => setShareImageUrl(null)} className="mt-3 px-5 py-2 rounded-full bg-white/15 text-white text-[13px] font-semibold">Close</button>
        </div>,
        document.body
      )}
    </>
  );
}

/* ── Inline post card (shared dna_compare social posts) ─────────────────── */
export function DnaComparePostCard({ item }: { item: any }) {
  const { session, user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [postShareMenuOpen, setPostShareMenuOpen] = useState(false);
  const [postSavingImage, setPostSavingImage] = useState(false);
  const [postShareImageUrl, setPostShareImageUrl] = useState<string | null>(null);
  const [postShareNotice, setPostShareNotice] = useState<string | null>(null);
  const [postIsSharing, setPostIsSharing] = useState(false);
  const postShareBlobRef = useReactRef<Blob | null>(null);
  const postCardRef = useReactRef<HTMLDivElement>(null);
  const [postSharedTitles, setPostSharedTitles] = useState<string[]>([]);
  const [resolvedFriendName, setResolvedFriendName] = useState<string | null>(null);
  const [resolvedFriendAvatar, setResolvedFriendAvatar] = useState<string | null>(null);

  let cmp: any = {};
  try { cmp = JSON.parse(item.content || '{}'); } catch {}

  const poster = item.user;
  const posterId: string = item.user_id || poster?.id || poster?.user_id || '';
  const posterName = formatFeedName(
    poster?.displayName || poster?.display_name,
    poster?.username || poster?.user_name,
  );
  const posterAvatar = poster?.avatar || poster?.avatar_url || null;
  const matchScore = cmp.match_score || 0;
  const friendName = resolvedFriendName || (cmp.friend_name ? formatFeedName(cmp.friend_name) : 'a friend');
  const sharedGenres: string[] = cmp.shared_genres || [];

  // Fetch poster's friend alignments for the right column
  useEffect(() => {
    if (!posterId || !session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY, 'Content-Type': 'application/json' };
    let cancelled = false;

    async function fetchPosterAlignments() {
      try {
        // Edge function (service role) bypasses RLS and returns the poster's real
        // dna_comparisons match scores — the AUTHORITATIVE alignment %.
        const { data, error } = await supabase.functions.invoke('get-dna-feed-data', {
          body: { target_user_id: posterId },
        });
        if (cancelled) return;
        if (error) { console.error('Failed to load DNA poster alignments', error); return; }

        const friendUsers: any[] = data?.friendUsers ?? [];

        const friendId: string | null = cmp?.friend_id || null;
        const friendInfo = friendId
          ? friendUsers.find((candidate: any) => candidate.id === friendId)
          : null;
        const exactFriendName = friendInfo
          ? formatFeedName(
              friendInfo.display_name,
              friendInfo.user_name,
              friendInfo.first_name,
              friendInfo.last_name,
            )
          : friendName;
        if (friendInfo) {
          setResolvedFriendName(exactFriendName);
          setResolvedFriendAvatar(friendInfo.avatar ?? null);
        }

        // friend_id is stored directly in the post content JSON — no name matching needed
        if (friendId && posterId) {
          try {
            const [posterRatingsRes, friendRatingsRes] = await Promise.all([
              fetch(`${SUPABASE_URL}/rest/v1/media_ratings?user_id=eq.${posterId}&rating=gte.4&select=media_title&limit=100`, { headers }),
              fetch(`${SUPABASE_URL}/rest/v1/media_ratings?user_id=eq.${friendId}&rating=gte.4&select=media_title&limit=100`, { headers }),
            ]);
            const posterRatings: any[] = await posterRatingsRes.json();
            const friendRatings: any[] = await friendRatingsRes.json();
            if (!cancelled && Array.isArray(posterRatings) && Array.isArray(friendRatings)) {
              const posterTitles = new Set(posterRatings.map((r: any) => (r.media_title || '').toLowerCase().trim()));
              const shared = friendRatings
                .filter((r: any) => posterTitles.has((r.media_title || '').toLowerCase().trim()))
                .map((r: any) => r.media_title as string)
                .slice(0, 3);
              if (shared.length > 0) setPostSharedTitles(shared);
            }
          } catch { /* silent */ }
        }
      } catch (err) { console.error('Failed to load DNA poster alignments', err); }
    }
    fetchPosterAlignments();
    return () => { cancelled = true; };
  }, [posterId, session?.access_token, friendName]);

  return (
    <>
      <div ref={postCardRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">

        {/* Header — plain white, pill badge */}
        <div className="relative h-[44px]">
          <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100">
            <Dna size={10} className="text-violet-600" />
            <span className="text-violet-600 text-[10px] font-bold uppercase tracking-widest">Compare DNA</span>
          </div>
          <button
            onClick={async () => {
              if (!postCardRef.current || postSavingImage) return;
              setPostSavingImage(true);
              try {
                const canvas = await html2canvas(postCardRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                postShareBlobRef.current = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
                setPostShareImageUrl(canvas.toDataURL('image/png'));
                setPostShareNotice(null);
                setPostShareMenuOpen(true);
              } catch (err) {
                console.error('Failed to prepare share image', err);
              } finally {
                setPostSavingImage(false);
              }
            }}
            className="absolute top-2.5 right-3 flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
            data-testid="button-share-dna-compare-post"
          >
            <span className="text-[13px] font-medium">{postSavingImage ? 'Preparing…' : 'Share'}</span>
            <span className="text-[13px]" aria-hidden="true">→</span>
          </button>
        </div>

        {/* Horizontal layout — avatars flank the ring on each side */}
        <div className="pt-4 pb-5 flex flex-col items-center">
           {/* Names row — aligned above each avatar */}
           <div className="flex w-full mb-2" style={{ width: 240 }}>
             <div className="flex flex-col items-center gap-0.5" style={{ width: 108 }}>
                <span className="font-serif text-[24px] font-normal tracking-[-.035em] text-[#30203f] text-center">{posterName}</span>
               {cmp.your_dna_label && <span className="text-[10px] text-purple-500 font-medium text-center leading-tight">{cmp.your_dna_label}</span>}
             </div>
             <div style={{ flex: 1 }} />
             <div className="flex flex-col items-center gap-0.5" style={{ width: 108 }}>
                <span className="font-serif text-[24px] font-normal tracking-[-.035em] text-[#30203f] text-center">{friendName}</span>
               {cmp.friend_dna_label && <span className="text-[10px] text-purple-500 font-medium text-center leading-tight">{cmp.friend_dna_label}</span>}
             </div>
           </div>

          {/* Trio row: avatar | ring | avatar, avatars partially behind ring */}
          <div style={{ position: 'relative', width: 240, height: 110 }}>
            {/* Left avatar — behind ring */}
            <div style={{ position: 'absolute', left: 4, top: 'calc(50% - 35px)', zIndex: 1 }}>
              <ProfileAvatar size={70} color="#8b5cf6" avatarUrl={posterAvatar} label={posterName}
                fallback={initials(posterName)} className="border-2 border-white"
                style={{ boxShadow: '0 2px 8px rgba(139,92,246,0.35)' }} />
            </div>
            {/* Ring — centered, white bg covers avatar edges */}
            {(() => {
              const r = 46;
              const circ = 2 * Math.PI * r;
              const dash = (matchScore / 100) * circ;
              return (
                <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'white', borderRadius: '50%', width: 106, height: 106, position: 'relative' }}>
                    <svg width="106" height="106" viewBox="0 0 106 106" style={{ display: 'block' }}>
                      <circle cx="53" cy="53" r={r} fill="none" stroke="#ede9fe" strokeWidth="4" />
                      <circle cx="53" cy="53" r={r} fill="none" stroke="#8b5cf6" strokeWidth="4"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 53 53)" />
                      <text x="53" y="52" textAnchor="middle" fill="#8b5cf6" fontSize="26" fontWeight="900" fontFamily="inherit" dominantBaseline="middle">{matchScore}%</text>
                      <text x="53" y="70" textAnchor="middle" fill="#9ca3af" fontSize="7" fontWeight="700" letterSpacing="1.5" fontFamily="inherit">ALIGNED</text>
                    </svg>
                  </div>
                </div>
              );
            })()}
            {/* Right avatar — behind ring */}
            <div style={{ position: 'absolute', right: 4, top: 'calc(50% - 35px)', zIndex: 1 }}>
              <ProfileAvatar size={70} color="#a855f7" avatarUrl={resolvedFriendAvatar} label={friendName}
                fallback={initials(friendName)} className="border-2 border-white"
                style={{ boxShadow: '0 2px 8px rgba(168,85,247,0.35)' }} />
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
      {postShareMenuOpen && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center" onClick={() => setPostShareMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-sm bg-gray-950 rounded-t-3xl sm:rounded-3xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-white font-semibold text-[15px]">Share DNA Comparison</p>
              <button onClick={() => setPostShareMenuOpen(false)} aria-label="Close" className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white">
                <X size={16} />
              </button>
            </div>
            {postShareNotice && <p className="text-[12px] text-violet-300 text-center mb-3">{postShareNotice}</p>}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (!postShareBlobRef.current) return;
                  const url = URL.createObjectURL(postShareBlobRef.current);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'dna-match.png';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 5000);
                  setPostShareNotice('Image saved');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white/90 font-medium text-[15px] py-3 active:scale-[0.98] transition-transform"
              >
                <Download size={17} />
                Save to Photos
              </button>
              <button
                disabled={postIsSharing}
                onClick={async () => {
                  if (postIsSharing) return;
                  setPostIsSharing(true);
                  try {
                    const text = `${posterName.split(' ')[0]} is ${matchScore}% aligned with ${friendName} on Consumed! Check your Entertainment DNA 🧬`;
                    const base = (import.meta.env.VITE_APP_URL as string) || window.location.origin;
                    const postUrl = item?.id ? `${base}/?post=${item.id}` : base;
                    if (navigator.share) {
                      await navigator.share({ title: 'Entertainment DNA Match', text, url: postUrl });
                    } else {
                      await navigator.clipboard.writeText(`${text} ${postUrl}`);
                      setPostShareNotice('Link copied to clipboard');
                    }
                  } catch (err: any) {
                    if (err?.name !== 'AbortError') setPostShareNotice('Could not share — use Save to Photos instead');
                  } finally {
                    setPostIsSharing(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/90 font-medium text-[15px] py-3 active:scale-[0.98] transition-transform"
              >
                {postIsSharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
                Share with a Friend
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
