import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { Bookmark, MessageSquarePlus, Flame } from "lucide-react";
import FeedComposerBar from "@/components/feed-composer-bar";

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
  const [composerOpen, setComposerOpen] = useState(false);

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


  const tiles: { value: string; label: string; flame?: boolean }[] = [
    { value: String(streak), label: "Day streak", flame: true },
  ];
  if (globalRank) tiles.push({ value: `#${globalRank}`, label: "Leaderboard" });
  tiles.push({ value: tracked.toLocaleString(), label: "Tracked" });

  const secondaries = (dna?.secondary_archetypes || []).slice(0, 2).map(toArchetypeName);

  if (loading) {
    return <div className="rounded-3xl animate-pulse" style={{ height: 210, background: "rgba(255,255,255,0.05)" }} />;
  }

  return (
    <>
      <div className="pt-4">
        {/* Headline */}
        {dna?.label ? (
          <>
            <h1 className="pl-1 text-[26px] font-extrabold leading-[1.08] text-white">{dna.label}</h1>
            {secondaries.length > 0 && (
              <div className="pl-1 mt-1.5 space-y-0.5">
                {secondaries.map((s, i) => (
                  <p
                    key={s}
                    className="text-[18px] font-bold leading-tight"
                    style={{ color: i === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.32)" }}
                  >
                    + {s}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="pl-1 text-[26px] font-extrabold leading-[1.08] text-white">
              {displayName ? `Welcome back, ${displayName}.` : "Welcome back."}
            </h1>
            <p className="pl-1 text-[13px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
              Track what you watch, read &amp; play to build your DNA.
            </p>
          </>
        )}

        {/* Stats — subtle inline row */}
        <div
          className="pl-1 flex items-center flex-wrap gap-x-2 gap-y-1 mt-3.5 text-[12.5px]"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {tiles.map((t, i) => (
            <span key={t.label} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="mr-1" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>}
              {t.flame && <Flame size={13} color="#fb923c" fill="#fb923c" />}
              <span className="font-bold text-white">{t.value}</span>
              <span>{t.label.toLowerCase()}</span>
            </span>
          ))}
        </div>

        <div className="mt-4">
          <HeroCTAButtons />
        </div>
      </div>
    </>
  );
}

// CTA buttons for the hero (kept as a separate component so it owns its own composer state).
export function HeroCTAButtons() {
  const [, setLocation] = useLocation();
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setLocation("/add")}
          className="flex items-center justify-center gap-2 py-2 rounded-full font-semibold text-[13px] text-white active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, #6d28d9 0%, #9333ea 45%, #d946ef 100%)" }}
        >
          <Bookmark size={15} fill="#ffffff" />
          Track it
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

      {composerOpen && <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />}
    </>
  );
}
