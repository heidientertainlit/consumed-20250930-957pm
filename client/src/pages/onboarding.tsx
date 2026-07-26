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

// All titles below were verified via the media-search edge function (real ids + posters).
const lovedRows: { label: string; items: { title: string; externalId: string; source: string; poster: string }[] }[] = [
  {
    label: "Movies",
    items: [
      { title: "Harry Potter", externalId: "671", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg" },
      { title: "Wicked", externalId: "402431", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg" },
      { title: "The Eras Tour", externalId: "1160164", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/jf3YO8hOqGHCupsREf5qymYq1n.jpg" },
      { title: "Dune: Part Two", externalId: "693134", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" },
      { title: "Barbie", externalId: "346698", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg" },
      { title: "Oppenheimer", externalId: "872585", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
      { title: "Inside Out 2", externalId: "1022789", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg" },
      { title: "Top Gun: Maverick", externalId: "361743", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/n0YuM4f5lvGAP6MAW2kBIzugXnc.jpg" },
      { title: "Everything Everywhere All at Once", externalId: "545611", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/u68AjlvlutfEIcpmbYpKcdi09ut.jpg" },
    ],
  },
  {
    label: "TV Shows",
    items: [
      { title: "Stranger Things", externalId: "66732", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
      { title: "The Bear", externalId: "136315", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg" },
      { title: "The Last of Us", externalId: "100088", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg" },
      { title: "The Office", externalId: "2316", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg" },
      { title: "Ted Lasso", externalId: "97546", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg" },
      { title: "The White Lotus", externalId: "111803", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/gbSaK9v1CbcYH1ISgbM7XObD2dW.jpg" },
      { title: "Severance", externalId: "95396", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg" },
      { title: "Friends", externalId: "1668", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg" },
      { title: "Yellowstone", externalId: "73586", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/vOYfRZ0NpUK5hG2CB2dJFnYJlGe.jpg" },
    ],
  },
  {
    label: "Books",
    items: [
      { title: "Atomic Habits", externalId: "fFCjDQAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=fFCjDQAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Hobbit", externalId: "F2xu1nZOzKoC", source: "googlebooks", poster: "https://books.google.com/books/content?id=F2xu1nZOzKoC&printsec=frontcover&img=1&zoom=2" },
      { title: "Fourth Wing", externalId: "E-OLEAAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=E-OLEAAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "It Ends with Us", externalId: "KmbkCgAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=KmbkCgAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Silent Patient", externalId: "tLdiDwAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=tLdiDwAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "A Court of Thorns and Roses", externalId: "E-kdBQAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=E-kdBQAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Midnight Library", externalId: "63fYDwAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=63fYDwAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "Onyx Storm", externalId: "Vuv4EAAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=Vuv4EAAAQBAJ&printsec=frontcover&img=1&zoom=2" },
    ],
  },
  {
    label: "Podcasts",
    items: [
      { title: "Serial", externalId: "917918570", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/9a/fb/87/9afb8760-0e05-2b3e-24a2-7e14cce74570/mza_14816055607064169808.jpg/600x600bb.jpg" },
      { title: "Crime Junkie", externalId: "1322200189", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/8c/35/04/8c350430-2fbf-98d0-0a25-00b76550ffeb/mza_13445204151221888086.jpg/600x600bb.jpg" },
      { title: "SmartLess", externalId: "1521578868", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/b1/93/5f/b1935f9f-35be-9144-e813-626bd8dabfb4/mza_4132654708551836825.jpg/600x600bb.jpg" },
      { title: "The Daily", externalId: "1200361736", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/64/66/ab6466a9-9a7d-e20e-7a3d-bc5be37d29ce/mza_15084852813176276273.jpg/600x600bb.jpg" },
      { title: "Call Her Daddy", externalId: "1418960261", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/05/10/91/05109145-8c22-5464-1f20-aaedeab769f8/mza_10276081716633787086.jpg/600x600bb.jpg" },
      { title: "New Heights with Jason & Travis Kelce", externalId: "1643745036", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/3a/7b/24/3a7b2444-814b-2ad4-1398-6406514a78a3/mza_6923137187248425375.jpeg/600x600bb.jpg" },
    ],
  },
  {
    label: "Music",
    items: [
      { title: "HIT ME HARD AND SOFT", externalId: "1739659134", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg" },
      { title: "Short n' Sweet", externalId: "1752214909", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg" },
      { title: "The Tortured Poets Department", externalId: "1736268219", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/6b/7d/61/6b7d61e4-e6f1-83bc-d645-463aa06b33c4/24UMGIM29563.rgb.jpg/600x600bb.jpg" },
      { title: "GUTS", externalId: "1694767605", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/9e/0d/17/9e0d17e0-c068-fbd9-fd85-610cc87c86aa/23UMGIM71511.rgb.jpg/600x600bb.jpg" },
      { title: "SOS", externalId: "1658650487", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/62/93/13/6293132e-20ff-67ab-3d1f-96bb6797a6ba/196589564955.jpg/600x600bb.jpg" },
      { title: "Midnights", externalId: "1649434996", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/67/b5/01/67b501d5-362e-797e-7dbd-942b9e273084/22UM1IM24801.rgb.jpg/600x600bb.jpg" },
    ],
  },
];

const allLovedItems = lovedRows.flatMap((r) => r.items);

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "debate" | "loved" | "reveal";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("debate");
  const [vote, setVote] = useState<string | null | undefined>(undefined);
  const [rooms, setRooms] = useState<string[]>([]);
  const [loved, setLoved] = useState<string[]>([]);
  const [fadingOut, setFadingOut] = useState<string[]>([]);
  const [showTenPrompt, setShowTenPrompt] = useState(false);
  const [tenPromptShown, setTenPromptShown] = useState(false);
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

  const addLoved = (title: string) => {
    if (loved.includes(title)) return;
    const newCount = loved.length + 1;
    setLoved((l) => [...l, title]);
    setFadingOut((f) => [...f, title]);
    // Show "Added" briefly, then the card leaves the row and the next title slides in.
    setTimeout(() => setFadingOut((f) => f.filter((t) => t !== title)), 800);
    if (newCount === 10 && !tenPromptShown) {
      setTenPromptShown(true);
      setTimeout(() => setShowTenPrompt(true), 900);
    }
  };

  const submitLoved = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (user?.id && loved.length > 0) {
        const picks = allLovedItems.filter((i) => loved.includes(i.title));
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
          <h1 className="text-center text-[22px] leading-[1.25] font-black" style={{ fontFamily: "Poppins, sans-serif" }}>
            Every title you add shapes
            <br />
            your Entertainment DNA
          </h1>
          <p className="text-center text-[13px] text-white/60 mt-2">
            Tap everything you've loved.
          </p>

          <div className="flex flex-col items-center mt-5">
            <div className="flex items-center gap-2">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < Math.min(loved.length, 10);
                return (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full transition-all"
                    style={{
                      background: filled ? "#a855f7" : "rgba(255,255,255,0.15)",
                      boxShadow: filled ? "0 0 8px rgba(168,85,247,0.7)" : "none",
                    }}
                  />
                );
              })}
            </div>
            <p className="text-sm font-bold text-white/80 mt-2.5">
              {Math.min(loved.length, 10)} / 10
            </p>
            <p className="text-[12px] text-white/55 mt-1">
              {loved.length < 3
                ? `Pick at least ${3 - loved.length} more to continue`
                : loved.length < 10
                  ? `${10 - loved.length} more to unlock your Entertainment DNA`
                  : "Your Entertainment DNA is unlocked"}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {lovedRows.map((row) => {
              const visible = row.items.filter(
                (item) => !loved.includes(item.title) || fadingOut.includes(item.title),
              );
              return (
                <div key={row.label}>
                  <p className="text-[12px] font-bold tracking-wide text-white/70 uppercase mb-2">
                    {row.label}
                  </p>
                  <div
                    className="flex gap-2.5 overflow-x-auto pb-1 -mx-5 px-5"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {visible.map((item) => {
                      const added = fadingOut.includes(item.title);
                      return (
                        <button
                          key={item.title}
                          onClick={() => !added && addLoved(item.title)}
                          className="relative rounded-xl overflow-hidden border transition-all active:scale-95 flex-shrink-0"
                          style={{
                            width: 104,
                            aspectRatio: "2/3",
                            borderColor: added ? "#a855f7" : "rgba(255,255,255,0.1)",
                            boxShadow: added ? "0 0 16px rgba(168,85,247,0.45)" : "none",
                            opacity: added ? 0.85 : 1,
                          }}
                        >
                          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                          {added && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                              <span
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                                style={{ background: "#a855f7" }}
                              >
                                <Check size={12} /> Added
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {visible.length === 0 && (
                      <p className="text-[12px] text-white/40 py-4">All added — nice taste.</p>
                    )}
                  </div>
                </div>
              );
            })}
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

        {showTenPrompt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowTenPrompt(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl p-6 text-center"
              style={{
                background: "linear-gradient(160deg, #2a1b4d, #1a1230)",
                border: "1px solid rgba(168,85,247,0.35)",
                boxShadow: "0 0 40px rgba(168,85,247,0.35)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)" }}
              >
                <Brain size={32} className="text-purple-300" />
              </div>
              <h3 className="text-xl font-black mt-4 text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
                That's 10!
              </h3>
              <p className="text-sm text-white/65 mt-2 leading-relaxed">
                Your Entertainment DNA is unlocked. Keep adding — every title makes it more fine-tuned.
              </p>
              <button
                onClick={() => {
                  setShowTenPrompt(false);
                  submitLoved();
                }}
                className="w-full py-3 rounded-full font-bold text-[15px] text-white mt-5 active:scale-95 transition-transform"
                style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
              >
                See my DNA now
              </button>
              <button
                onClick={() => setShowTenPrompt(false)}
                className="w-full py-3 rounded-full font-bold text-[14px] text-purple-200 mt-2.5 active:scale-95 transition-transform"
                style={{ border: "1px solid rgba(168,85,247,0.45)", background: "transparent" }}
              >
                Keep adding
              </button>
            </div>
          </div>
        )}
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
          <Sparkles size={12} /> It gets even more fine-tuned with every title you add
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
