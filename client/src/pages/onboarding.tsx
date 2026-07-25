import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Sparkles, Brain } from "lucide-react";
import { markOnboardingComplete } from "@/components/route-guards";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const DEBATE_POOL_ID = "9d861d7f-2afc-40a8-b132-a78626739347";

const debate = {
  left: {
    name: "Barbie",
    poster: "https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
  },
  right: {
    name: "Oppenheimer",
    poster: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  },
};

const lovedGrid = [
  { title: "Stranger Things", externalId: "66732", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
  { title: "The Bear", externalId: "136315", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg" },
  { title: "Wicked", externalId: "402431", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg" },
  { title: "Harry Potter", externalId: "671", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg" },
  { title: "The Office", externalId: "2316", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg" },
  { title: "The Last of Us", externalId: "100088", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "debate" | "loved" | "reveal";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("debate");
  const [vote, setVote] = useState<string | null>(null);
  const [loved, setLoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const finish = (route: string) => {
    markOnboardingComplete();
    setLocation(route);
  };

  const submitVote = async (side: string | null) => {
    setVote(side);
    setStep("loved");
    if (!side || !user?.id) return;
    // Same write path as every other poll — dedup handled by unique constraint,
    // feed automatically hides answered polls.
    supabase
      .from("user_predictions")
      .insert({ user_id: user.id, pool_id: DEBATE_POOL_ID, prediction: side, points_earned: 10 })
      .then(({ error }) => {
        if (error && error.code !== "23505") console.error("[onboarding vote]", error);
      });
  };

  const toggleLoved = (title: string) =>
    setLoved((l) =>
      l.includes(title) ? l.filter((t) => t !== title) : l.length < 3 ? [...l, title] : l,
    );

  const submitLoved = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (user?.id && loved.length > 0) {
        const picks = lovedGrid.filter((i) => loved.includes(i.title));
        for (const p of picks) {
          const { error } = await supabase.from("media_ratings").upsert(
            {
              user_id: user.id,
              media_external_id: p.externalId,
              media_external_source: p.source,
              rating: 5,
            },
            { onConflict: "user_id,media_external_id,media_external_source" },
          );
          if (error) console.error("[onboarding rating]", error);
        }
        // Fire-and-forget DNA signal rebuild (same as feed reactions / seen-it game)
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          fetch(`${SUPABASE_URL}/functions/v1/extract-dna-signals`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
          }).catch(() => {});
        }
      }
    } finally {
      setSaving(false);
      setStep("reveal");
    }
  };

  const ProgressBar = ({ current }: { current: number }) => (
    <div className="pt-6 flex flex-col items-center">
      <div className="flex items-center gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: 56,
              background: i <= current ? "#a855f7" : "rgba(255,255,255,0.14)",
              boxShadow: i <= current ? "0 0 8px rgba(168,85,247,0.7)" : "none",
            }}
          />
        ))}
      </div>
      <p className="text-[11px] tracking-[0.2em] text-white/45 font-semibold mt-3">
        {current + 1} OF 2
      </p>
    </div>
  );

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900">
      <div className="w-full max-w-[430px] flex flex-col text-white relative bg-gradient-to-b from-slate-900/60 via-purple-950/40 to-purple-900/50">
        <button
          onClick={() => finish("/activity")}
          className="absolute top-5 right-5 z-10 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Skip
        </button>
        {children}
      </div>
    </div>
  );

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (step === "debate")
    return (
      <Shell>
        <ProgressBar current={0} />
        <div className="flex-1 flex flex-col px-6 pt-7 pb-10">
          <h1 className="text-center text-[32px] leading-[1.1] font-black" style={{ fontFamily: "Poppins, sans-serif" }}>
            Settle
            <br />
            the debate.
          </h1>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-purple-500" />
          <p className="text-center text-sm text-white/60 mt-4">What do you think?</p>

          <div className="flex items-center justify-center gap-3 mt-7 relative">
            {[debate.left, debate.right].map((side) => (
              <button
                key={side.name}
                onClick={() => submitVote(side.name)}
                className="w-[42%] rounded-2xl overflow-hidden border border-white/10 active:scale-95 transition-transform"
                style={{ aspectRatio: "2/3", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}
              >
                <img src={side.poster} alt={side.name} className="w-full h-full object-cover" />
              </button>
            ))}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center text-sm font-black">
              VS
            </div>
          </div>

          <p className="text-center text-xs text-white/50 mt-5 font-medium">Tap one to choose</p>

          <button
            onClick={() => {
              setVote("both");
              setStep("loved");
            }}
            className="mx-auto mt-6 px-6 py-2.5 rounded-full bg-white text-purple-800 text-sm font-bold shadow-lg active:scale-95 transition-transform"
          >
            But how could I choose!?
          </button>

          <div className="flex-1" />
          <button onClick={() => submitVote(null)} className="mx-auto text-sm text-white/45 font-medium">
            Neither / Haven't seen
          </button>
          <p className="text-center text-[13px] text-white/40 mt-6">
            No wrong answers. Just your take.
          </p>
        </div>
      </Shell>
    );

  if (step === "loved")
    return (
      <Shell>
        <ProgressBar current={1} />
        <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
          <h1 className="text-center text-[28px] leading-[1.15] font-black" style={{ fontFamily: "Poppins, sans-serif" }}>
            Which of these
            <br />
            have you{" "}
            <span className="text-purple-400 underline decoration-purple-500 underline-offset-4">
              loved?
            </span>
          </h1>
          <p className="text-center text-sm text-white/60 mt-3">
            Choose 3 to help build your
            <br />
            Entertainment DNA.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            {lovedGrid.map((item) => {
              const selected = loved.includes(item.title);
              return (
                <button
                  key={item.title}
                  onClick={() => toggleLoved(item.title)}
                  className="relative rounded-xl overflow-hidden border transition-all active:scale-95"
                  style={{
                    aspectRatio: "3/4",
                    borderColor: selected ? "#a855f7" : "rgba(255,255,255,0.1)",
                    boxShadow: selected ? "0 0 20px rgba(168,85,247,0.4)" : "none",
                  }}
                >
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
                  <div
                    className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: selected ? "#a855f7" : "rgba(255,255,255,0.6)",
                      background: selected ? "#a855f7" : "rgba(0,0,0,0.35)",
                    }}
                  >
                    {selected && <Check size={14} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-white/50 mt-4 font-medium">Choose 3</p>
          <div className="flex items-center justify-center gap-2.5 mt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: i < loved.length ? "#a855f7" : "rgba(255,255,255,0.2)",
                  background: i < loved.length ? "rgba(168,85,247,0.25)" : "transparent",
                }}
              >
                {i < loved.length && <Check size={14} className="text-purple-300" />}
              </div>
            ))}
          </div>

          <button
            onClick={submitLoved}
            disabled={loved.length < 3 || saving}
            className="w-full py-3.5 rounded-full font-bold text-[15px] mt-5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
          <button
            onClick={() => {
              setLoved([]);
              setStep("reveal");
            }}
            className="mx-auto text-sm text-white/45 font-medium mt-4"
          >
            None of these
          </button>
          <p className="text-center text-[12px] text-white/40 mt-2">
            You can always update this later.
          </p>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: "rgba(168,85,247,0.12)",
            border: "1px solid rgba(168,85,247,0.4)",
            boxShadow: "0 0 50px rgba(168,85,247,0.3)",
          }}
        >
          <Brain size={44} className="text-purple-300" />
        </div>
        <h2 className="text-2xl font-black mt-7 text-center" style={{ fontFamily: "Poppins, sans-serif" }}>
          Your starter DNA is ready.
        </h2>
        <p className="text-sm text-white/60 mt-2 text-center leading-relaxed">
          {vote === "both" ? "Team Both — respect. " : vote ? `Team ${vote}. ` : ""}
          {loved.length > 0 ? `Fan of ${loved.join(", ")}.` : ""}
        </p>
        <p className="text-[12px] text-white/40 mt-4 flex items-center gap-1.5">
          <Sparkles size={12} /> It gets sharper the more you play
        </p>

        <button
          onClick={() => finish("/activity")}
          className="w-full py-3.5 rounded-full font-bold text-[15px] mt-9 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
        >
          View feed
        </button>
      </div>
    </Shell>
  );
}
