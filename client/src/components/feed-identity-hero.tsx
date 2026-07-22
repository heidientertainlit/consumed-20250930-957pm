import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { Plus, MessageSquarePlus, Flame, Dna, Trophy, Library, Forward } from "lucide-react";
import FeedComposerBar from "@/components/feed-composer-bar";
import { QuickTrackSheet } from "@/components/quick-track-sheet";

interface DnaBits {
  label: string | null;
  tagline: string | null;
  flavor_notes: string[] | null;
  favorite_genres: string[] | null;
  secondary_archetypes: string[] | null;
}

const toArchetypeName = (slug: string) =>
  slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export function FeedIdentityHero() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [dna, setDna] = useState<DnaBits | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [tracked, setTracked] = useState<number>(0);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.first_name ||
    user?.email?.split("@")[0] ||
    "";

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    let cancelled = false;

    (async () => {
      const [dnaRes, streakRes, trackedRes] = await Promise.all([
        supabase
          .from("dna_profiles")
          .select("label, tagline, flavor_notes, favorite_genres, secondary_archetypes")
          .eq("user_id", uid)
          .single(),
        supabase
          .from("login_streaks")
          .select("current_streak")
          .eq("user_id", uid)
          .single(),
        supabase
          .from("list_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid),
      ]);

      if (cancelled) return;
      if (dnaRes.data) setDna(dnaRes.data as DnaBits);
      if (streakRes.data) setStreak(streakRes.data.current_streak || 0);
      if (typeof trackedRes.count === "number") setTracked(trackedRes.count);
      setLoading(false);

      // All-time global leaderboard rank (same source as profile — best-effort)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-user-points?user_id=${uid}`,
          { headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } }
        );
        const data = await res.json();
        const rank = data?.rank?.global;
        if (!cancelled && typeof rank === "number") setGlobalRank(rank);
      } catch {
        /* leave rank hidden */
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);


  const secondaries = (dna?.secondary_archetypes || []).slice(0, 2).map(toArchetypeName);

  // Split the archetype label into a small leading "The" and the main words,
  // colouring the final word with the purple gradient (e.g. The / Emotional / Binger).
  const headline = dna?.label
    || (displayName ? `Welcome back ${displayName}` : "Welcome back");
  const headlineWords = headline.trim().split(/\s+/);
  const hasPrefix = headlineWords[0]?.toLowerCase() === "the" && headlineWords.length > 2;
  const prefix = hasPrefix ? headlineWords[0] : null;
  const mainWords = hasPrefix ? headlineWords.slice(1) : headlineWords;

  const purpleText: React.CSSProperties = {
    background: "linear-gradient(90deg, #a855f7 0%, #d946ef 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  const stats: { Icon: typeof Flame; color: string; value: string; label: string; href?: string }[] = [
    { Icon: Flame, color: "#fb923c", value: String(streak), label: "play streak", href: "/play" },
  ];
  if (globalRank) stats.push({ Icon: Trophy, color: "#fbbf24", value: `#${globalRank}`, label: "leaderboard" });
  stats.push({ Icon: Library, color: "#a78bfa", value: tracked.toLocaleString(), label: "tracked" });

  if (loading) {
    return <div className="rounded-3xl animate-pulse" style={{ height: 280, background: "rgba(255,255,255,0.05)" }} />;
  }

  return (
    <>
      <div className="pt-3">
        {/* ── Identity card ── */}
        <div
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: "linear-gradient(155deg, rgba(48,36,82,0.65) 0%, rgba(28,22,48,0.55) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 40px rgba(124,58,237,0.12)",
          }}
        >
          {/* soft glow accents */}
          <div
            className="absolute -top-16 -right-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)" }}
          />
          <div
            className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(217,70,239,0.09), transparent 70%)" }}
          />

          {/* Header row */}
          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "rgba(192,160,255,0.9)" }}
              >
                Your Entertainment DNA
              </span>
              <Dna size={13} className="text-purple-400" />
            </div>
            <button
              onClick={async () => {
                const shareUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                const archetype = dna?.label ? `The ${dna.label}` : "my Entertainment DNA";
                const text = `I'm ${archetype} on Consumed — what's your Entertainment DNA?`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: "My Entertainment DNA", text, url: shareUrl });
                  } else {
                    await navigator.clipboard.writeText(`${text} ${shareUrl}`);
                  }
                } catch {
                  /* user cancelled or share unavailable */
                }
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
              aria-label="Share your DNA"
            >
              <Forward size={13} className="text-purple-300" />
            </button>
          </div>

          {/* Headline + avatar */}
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-bold tracking-tight leading-[1.08]">
                {prefix && (
                  <span className="block text-[22px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {prefix}
                  </span>
                )}
                <span className="block text-[32px] text-white">
                  {mainWords.join(" ")}
                </span>
              </h1>
            </div>
            <IdentityFace size={108} className="mr-2" />
          </div>

          {/* Secondary archetypes — subtle "with shades of" subtitle, aligned to the headline */}
          {secondaries.length > 0 && (
            <div className="relative mt-4">
              <p className="text-[12px] italic" style={{ color: "rgba(255,255,255,0.4)" }}>with shades of</p>
              <p className="text-[14px] font-medium mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                {secondaries.join(" • ")}
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-5 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Stats row */}
          <div className="relative grid grid-cols-3">
            {stats.map((s) => {
              const inner = (
                <>
                  <div className="flex items-center gap-1.5">
                    <s.Icon size={16} color={s.color} {...(s.Icon === Flame ? { fill: s.color } : {})} />
                    <p className="text-[17px] font-bold text-white">{s.value}</p>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
                </>
              );
              return s.href ? (
                <button
                  key={s.label}
                  onClick={() => setLocation(s.href!)}
                  className="flex flex-col items-center text-center active:scale-95 transition-transform"
                >
                  {inner}
                </button>
              ) : (
                <div key={s.label} className="flex flex-col items-center text-center">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTAs below the card */}
        <div className="mt-6">
          <HeroCTAButtons />
        </div>
      </div>
    </>
  );
}

// Neon DNA face avatar used in the identity card.
export function IdentityFace({ size = 88, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.35), transparent 72%)" }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: "2px solid rgba(168,85,247,0.55)",
          boxShadow: "0 0 22px rgba(168,85,247,0.5), inset 0 0 22px rgba(168,85,247,0.22)",
          background: "radial-gradient(circle at 50% 38%, rgba(64,44,98,0.6), rgba(20,15,35,0.85))",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        style={{ filter: "drop-shadow(0 0 4px rgba(192,132,252,0.85))" }}
      >
        {/* peaceful closed eyes */}
        <path d="M28 48 q7 -8 14 0" stroke="#c084fc" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M58 48 q7 -8 14 0" stroke="#c084fc" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* smile */}
        <path d="M34 62 q16 14 32 0" stroke="#c084fc" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// CTA buttons for the hero (kept as a separate component so it owns its own composer state).
export function HeroCTAButtons() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setTrackOpen(true)}
          className="flex items-center justify-center gap-2 py-2 rounded-full font-semibold text-[13px] text-white active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, #6d28d9 0%, #9333ea 45%, #d946ef 100%)" }}
        >
          <Plus size={15} />
          Add media
        </button>
        <button
          onClick={() => setComposerOpen(true)}
          className="flex items-center justify-center gap-2 py-2 rounded-full font-semibold text-[13px] text-white active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <MessageSquarePlus size={15} />
          Share a take
        </button>
      </div>

      <QuickTrackSheet isOpen={trackOpen} onClose={() => setTrackOpen(false)} />

      {composerOpen && <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />}
    </>
  );
}
