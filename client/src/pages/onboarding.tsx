import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Sparkles, Brain, Search, Tv, Heart, Zap, Clapperboard, Wand2, Smile, Trophy } from "lucide-react";
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
  { title: "Harry Potter", type: "Movie", externalId: "671", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg" },
  { title: "Stranger Things", type: "TV", externalId: "66732", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
  { title: "The Bear", type: "TV", externalId: "136315", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg" },
  { title: "Wicked", type: "Movie", externalId: "402431", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg" },
  { title: "The Last of Us", type: "TV", externalId: "100088", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg" },
  { title: "The Eras Tour", type: "Movie", externalId: "1160164", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/jf3YO8hOqGHCupsREf5qymYq1n.jpg" },
  { title: "The Office", type: "TV", externalId: "2316", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg" },
  { title: "Atomic Habits", type: "Book", externalId: "fFCjDQAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=fFCjDQAAQBAJ&printsec=frontcover&img=1&zoom=2" },
  { title: "Serial", type: "Podcast", externalId: "917918570", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/9a/fb/87/9afb8760-0e05-2b3e-24a2-7e14cce74570/mza_14816055607064169808.jpg/600x600bb.jpg" },
  { title: "Dune: Part Two", type: "Movie", externalId: "693134", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" },
  { title: "HIT ME HARD AND SOFT", type: "Music", externalId: "1739659134", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg" },
  { title: "The Hobbit", type: "Book", externalId: "OlCHcjX0RT4C", source: "googlebooks", poster: "https://books.google.com/books/content?id=OlCHcjX0RT4C&printsec=frontcover&img=1&zoom=2" },
];

// Real rooms from the pools table — tapping a pill follows the room (room_follows)
const roomOptions = [
  { id: "eb529882-4a66-496d-97f2-bf9981692968", name: "True Crime", Icon: Search },
  { id: "c73774e0-c54c-44ed-8b14-ae0e3b076ddc", name: "Reality", Icon: Tv },
  { id: "a776d7dd-8206-4381-b847-17ff6f1e0d67", name: "Heartwarming", Icon: Heart },
  { id: "9e424f35-cd99-43ff-b695-d0ae89747b5a", name: "Action & Thriller", Icon: Zap },
  { id: "47182919-da7a-41bb-9688-50ec11561e53", name: "Rom-Com", Icon: Clapperboard },
  { id: "58841101-ce10-46d7-9241-f7d52a11f630", name: "Fantasy", Icon: Wand2 },
  { id: "b32722af-0a76-4df3-9fa2-a94a7e3046fb", name: "Comedy", Icon: Smile },
  { id: "3e0a4b3d-e211-44c7-9633-4a6a5a9206de", name: "Sports", Icon: Trophy },
];

const dnaMessages = (n: number): string => {
  if (n === 0) return "Entertainment DNA";
  if (n === 1) return "You're starting to take shape...";
  if (n === 2) return "Interesting...";
  if (n === 3) return "We're seeing a pattern.";
  if (n === 4) return "Your Entertainment DNA is coming to life.";
  return "Your Entertainment DNA is ready.";
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "debate" | "loved" | "reveal";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("debate");
  const [vote, setVote] = useState<string | null | undefined>(undefined);
  const [rooms, setRooms] = useState<string[]>([]);
  const [loved, setLoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const finish = (route: string) => {
    markOnboardingComplete();
    setLocation(route);
  };

  const toggleRoom = (id: string) =>
    setRooms((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const submitDebateStep = () => {
    setStep("loved");
    if (!user?.id) return;
    if (vote && vote !== "both") {
      // Same write path as every other poll — dedup handled by unique constraint,
      // feed automatically hides answered polls.
      supabase
        .from("user_predictions")
        .insert({ user_id: user.id, pool_id: DEBATE_POOL_ID, prediction: vote, points_earned: 10 })
        .then(({ error }) => {
          if (error && error.code !== "23505") console.error("[onboarding vote]", error);
        });
    }
    if (rooms.length > 0) {
      // Real follows — same rows as tapping Follow inside a room.
      supabase
        .from("room_follows")
        .insert(rooms.map((room_id) => ({ user_id: user.id, room_id })))
        .then(({ error }) => {
          if (error && error.code !== "23505") console.error("[onboarding room follow]", error);
        });
    }
  };

  const toggleLoved = (title: string) =>
    setLoved((l) => (l.includes(title) ? l.filter((t) => t !== title) : [...l, title]));

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
      <div className="min-h-screen w-full flex items-stretch justify-center bg-white">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          {/* Gradient hero header */}
          <div className="relative text-white px-6 pb-8 bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900">
            <button
              onClick={() => finish("/activity")}
              className="absolute top-5 right-5 z-10 text-sm text-white/60 hover:text-white transition-colors"
            >
              Skip
            </button>
            <ProgressBar current={0} />
            <h1
              className="text-center text-[26px] leading-[1.2] font-black mt-6"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Help us determine your entertainment DNA
            </h1>
            <p className="text-center text-[14px] italic text-white/70 mt-3">
              Answer these two quick questions
            </p>
          </div>

          {/* White body */}
          <div className="flex-1 flex flex-col px-6 pt-8 pb-10">
            <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600">STEP ONE</p>
            <h2
              className="text-[26px] leading-[1.15] font-black text-gray-900 mt-1.5"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Settle the debate.
            </h2>

            <div className="flex items-center justify-center gap-4 mt-5 relative">
              {[debate.left, debate.right].map((side) => {
                const chosen = vote === side.name;
                return (
                  <button
                    key={side.name}
                    onClick={() => setVote(side.name)}
                    className="w-[44%] rounded-2xl overflow-hidden relative active:scale-95 transition-all"
                    style={{
                      aspectRatio: "2/3",
                      boxShadow: chosen
                        ? "0 10px 30px rgba(124,58,237,0.4)"
                        : "0 10px 30px rgba(0,0,0,0.18)",
                      outline: chosen ? "3px solid #7c3aed" : "none",
                    }}
                  >
                    <img src={side.poster} alt={side.name} className="w-full h-full object-cover" />
                    <div
                      className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: chosen ? "#7c3aed" : "rgba(255,255,255,0.85)",
                        background: chosen ? "#7c3aed" : "rgba(0,0,0,0.25)",
                      }}
                    >
                      {chosen && <Check size={15} className="text-white" />}
                    </div>
                  </button>
                );
              })}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-purple-700 text-white border-4 border-white flex items-center justify-center text-sm font-black shadow-lg">
                VS
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 px-1">
              <button
                onClick={() => setVote("both")}
                className={`text-[13px] font-semibold transition-colors ${
                  vote === "both" ? "text-purple-700 underline underline-offset-4" : "text-purple-600 hover:text-purple-800"
                }`}
              >
                But how could I choose!?
              </button>
              <button
                onClick={() => setVote(null)}
                className={`text-[13px] font-medium transition-colors ${
                  vote === null ? "text-gray-700 underline underline-offset-4" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                Neither / Haven't seen
              </button>
            </div>

            <div className="mt-10">
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600">STEP TWO</p>
              <h2
                className="text-[26px] leading-[1.15] font-black text-gray-900 mt-1.5"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                What do you love
                <br />
                talking about?
              </h2>
              <p className="text-[13px] text-gray-400 mt-2">
                Follow the conversations for your favorite topics — pick as many as you like.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                {roomOptions.map((room) => {
                  const on = rooms.includes(room.id);
                  const Icon = room.Icon;
                  return (
                    <button
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold border transition-all active:scale-95"
                      style={{
                        borderColor: on ? "#7c3aed" : "rgb(229,231,235)",
                        background: on
                          ? "linear-gradient(135deg,#6d28d9,#9333ea 45%,#d946ef)"
                          : "white",
                        color: on ? "white" : "rgb(55,65,81)",
                        boxShadow: on ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
                      }}
                    >
                      <Icon size={15} className={on ? "text-white" : "text-purple-600"} />
                      {room.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1" />
            <button
              onClick={submitDebateStep}
              disabled={vote === undefined}
              className="w-full py-3.5 rounded-full font-bold text-[15px] text-white mt-10 transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "loved")
    return (
      <Shell>
        <ProgressBar current={1} />
        <div className="flex-1 flex flex-col px-5 pt-6 pb-8">
          <h1 className="text-center text-[26px] leading-[1.2] font-black" style={{ fontFamily: "Poppins, sans-serif" }}>
            Let's build your
            <br />
            Entertainment <span className="text-purple-400">DNA.</span>
          </h1>
          <p className="text-center text-[13px] text-white/60 mt-2">
            Tap everything you've <span className="text-purple-300 font-semibold">loved</span>.
            <br />
            Every pick counts as a 5-star rating on your profile.
          </p>

          <div className="grid grid-cols-3 gap-2.5 mt-5">
            {lovedGrid.map((item) => {
              const selected = loved.includes(item.title);
              return (
                <button
                  key={item.title}
                  onClick={() => toggleLoved(item.title)}
                  className="relative rounded-xl overflow-hidden border transition-all active:scale-95"
                  style={{
                    aspectRatio: "2/3",
                    borderColor: selected ? "#a855f7" : "rgba(255,255,255,0.1)",
                    boxShadow: selected ? "0 0 16px rgba(168,85,247,0.45)" : "none",
                  }}
                >
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  <span
                    className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: "rgba(0,0,0,0.65)", color: "#d8b4fe", backdropFilter: "blur(4px)" }}
                  >
                    {item.type}
                  </span>
                  <div
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: selected ? "#a855f7" : "rgba(255,255,255,0.6)",
                      background: selected ? "#a855f7" : "rgba(0,0,0,0.4)",
                    }}
                  >
                    {selected && <Check size={13} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3 mt-5 min-h-[44px]">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border transition-all"
              style={{
                borderColor: loved.length > 0 ? "#a855f7" : "rgba(255,255,255,0.25)",
                background: loved.length > 0 ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.05)",
                boxShadow: loved.length > 0 ? "0 0 14px rgba(168,85,247,0.4)" : "none",
              }}
            >
              <span className="text-[11px] font-bold text-purple-300">
                {Math.round((loved.length / lovedGrid.length) * 100)}%
              </span>
            </div>
            <p className="text-sm text-white/70 font-medium">{dnaMessages(loved.length)}</p>
          </div>

          <button
            onClick={submitLoved}
            disabled={loved.length < 3 || saving}
            className="w-full py-3.5 rounded-full font-bold text-[15px] mt-4 transition-all active:scale-95 disabled:opacity-40"
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
            None of these — I'll do it later
          </button>
          <p className="text-center text-[12px] text-white/40 mt-2">
            Pick at least 3. You can always add more later.
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
