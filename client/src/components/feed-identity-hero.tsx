import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { Bookmark, MessageSquarePlus, Flame, ChevronDown } from "lucide-react";
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
  const [weeklyRank, setWeeklyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pillsOpen, setPillsOpen] = useState(false);

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

      // Weekly rank (best-effort — only shown if found)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=global&period=weekly&limit=200`,
          { headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } }
        );
        const data = await res.json();
        const board: any[] = data?.categories?.total_consumption || data?.categories?.overall || [];
        const mine = board.find((e: any) => e.user_id === uid);
        if (!cancelled && mine?.rank) setWeeklyRank(mine.rank);
      } catch {
        /* leave weekly rank hidden */
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const pills = (dna?.flavor_notes?.length ? dna.flavor_notes : dna?.favorite_genres || []).slice(0, 4);

  const tiles: { value: string; label: string; flame?: boolean }[] = [
    { value: tracked.toLocaleString(), label: "Tracked" },
    { value: String(streak), label: "Day streak", flame: true },
  ];
  if (weeklyRank) tiles.push({ value: `#${weeklyRank}`, label: "This week" });

  const secondaries = (dna?.secondary_archetypes || []).slice(0, 2).map(toArchetypeName);
  const smidge =
    secondaries.length === 2
      ? `${secondaries[0]} and ${secondaries[1]}`
      : secondaries[0] || "";

  if (loading) {
    return <div className="rounded-3xl animate-pulse" style={{ height: 268, background: "rgba(255,255,255,0.05)" }} />;
  }

  return (
    <>
      <div className="pt-4">
        {/* Headline */}
        {dna?.label ? (
          <h1 className="text-[26px] font-bold leading-[1.15] text-white">
            You're {dna.label}
            {smidge && (
              <span className="font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                {" "}— with a smidge of {smidge} too
              </span>
            )}
            .
          </h1>
        ) : (
          <h1 className="text-[26px] font-bold leading-[1.15] text-white">
            {displayName ? `Welcome back, ${displayName}.` : "Welcome back."}
          </h1>
        )}
        {dna?.tagline ? (
          <p className="text-[13px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>{dna.tagline}</p>
        ) : !dna?.label ? (
          <p className="text-[13px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
            Track what you watch, read &amp; play to build your DNA.
          </p>
        ) : null}

        {/* Stat tiles */}
        <div className="grid gap-2 mt-2.5" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0,1fr))` }}>
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-xl px-2.5 py-1.5"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <p className="text-[17px] font-bold text-white leading-none flex items-center gap-1">
                {t.flame && <Flame size={14} color="#fb923c" fill="#fb923c" />}
                {t.value}
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                {t.label}
              </p>
            </div>
          ))}
        </div>

        {/* Taste pills — hidden by default, expand on tap */}
        {pills.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setPillsOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold active:scale-95 transition-transform"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {pillsOpen ? "Hide your vibe" : "See your vibe"}
              <ChevronDown
                size={13}
                className="transition-transform"
                style={{ transform: pillsOpen ? "rotate(180deg)" : "none" }}
              />
            </button>
            {pillsOpen && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pills.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => setLocation("/add")}
            className="flex items-center justify-center gap-2 py-2 rounded-full font-semibold text-[13px] active:scale-95 transition-transform"
            style={{ background: "#ffffff", color: "#7c3aed" }}
          >
            <Bookmark size={15} fill="#7c3aed" />
            Save it
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
      </div>

      {composerOpen && <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />}
    </>
  );
}
