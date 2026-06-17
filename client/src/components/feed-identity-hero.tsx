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

  if (loading) {
    return <div className="rounded-3xl animate-pulse" style={{ height: 210, background: "rgba(255,255,255,0.05)" }} />;
  }

  return (
    <>
      <div className="pt-4">
        {/* Headline */}
        {dna?.label ? (
          <>
            <p className="text-[12px] tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your taste archetype
            </p>
            <h1 className="text-[30px] font-extrabold leading-[1.08] text-white">{dna.label}</h1>
            {secondaries.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
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
            <h1 className="text-[30px] font-extrabold leading-[1.08] text-white">
              {displayName ? `Welcome back, ${displayName}.` : "Welcome back."}
            </h1>
            <p className="text-[13px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
              Track what you watch, read &amp; play to build your DNA.
            </p>
          </>
        )}

        {/* Stats — subtle inline row */}
        <div
          className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-3.5 text-[12.5px]"
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
