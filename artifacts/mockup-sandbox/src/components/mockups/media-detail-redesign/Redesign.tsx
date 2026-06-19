import { useState } from "react";
import {
  ChevronLeft,
  Share2,
  Star,
  Flame,
  Lightbulb,
  TrendingUp,
  Users,
  Plus,
  Play,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Sparkles,
  Clapperboard,
  ChevronRight,
  BarChart3,
  Brain,
  PenLine,
} from "lucide-react";

type Take = {
  user: string;
  initials: string;
  color: string;
  time: string;
  text: string;
  agree: number; // percentage
  votes: number;
  comments: number;
  hot?: boolean;
};

type Theory = {
  user: string;
  initials: string;
  color: string;
  text: string;
  plausible: number; // percentage
  votes: number;
};

const takes: Take[] = [
  {
    user: "marcusplays",
    initials: "MP",
    color: "bg-orange-500",
    time: "2h",
    text: "The severance procedure is the most realistic depiction of work-life balance we'll ever get. The innies are all of us on a Monday.",
    agree: 82,
    votes: 214,
    comments: 41,
    hot: true,
  },
  {
    user: "deepdivedana",
    initials: "DD",
    color: "bg-violet-500",
    time: "5h",
    text: "Season 2 lost the tight pacing of S1. Beautiful to look at but they're stretching the mystery thin at this point.",
    agree: 47,
    votes: 198,
    comments: 63,
  },
  {
    user: "tvtheorist",
    initials: "TT",
    color: "bg-emerald-500",
    time: "1d",
    text: "Ben Stiller directing horror-adjacent corporate dread is the crossover nobody asked for but everybody needed.",
    agree: 91,
    votes: 156,
    comments: 22,
  },
];

const theories: Theory[] = [
  {
    user: "lumon_decoded",
    initials: "LD",
    color: "bg-blue-500",
    text: "The goats are being raised as vessels — Lumon plans to sever animal consciousness next. The numbers Mark refines map to emotional 'tempers' for the goat project.",
    plausible: 64,
    votes: 412,
  },
  {
    user: "innieoutie",
    initials: "IO",
    color: "bg-rose-500",
    text: "Gemma isn't on one severed floor — every door on the testing floor is a different version of her, each enduring a separate cycle of suffering.",
    plausible: 78,
    votes: 389,
  },
];

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-3 ring-1 ring-white/10">
      <div className="text-violet-300">{icon}</div>
      <div className="text-base font-bold leading-none text-white">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-white/50">
        {label}
      </div>
    </div>
  );
}

function AgreeBar({ agree }: { agree: number }) {
  const disagree = 100 - agree;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <ThumbsUp className="h-3.5 w-3.5" />
        {agree}%
      </div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-rose-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
          style={{ width: `${agree}%` }}
        />
      </div>
      <div className="flex items-center gap-1 text-xs font-semibold text-rose-500">
        {disagree}%
        <ThumbsDown className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

export function Redesign() {
  const [tab, setTab] = useState<"review" | "predict">("review");
  const [rating, setRating] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">
      <div className="mx-auto max-w-md">
        {/* ===================== DARK HERO ===================== */}
        <div className="relative overflow-hidden rounded-b-3xl bg-gradient-to-b from-[#1a1030] via-[#150b26] to-[#0c0717] px-5 pb-6 pt-4 text-white">
          {/* glow accents */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 top-24 h-48 w-48 rounded-full bg-fuchsia-600/20 blur-3xl" />

          {/* top bar */}
          <div className="relative flex items-center justify-between">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur ring-1 ring-white/15">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur ring-1 ring-white/15">
              <Share2 className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* poster + meta */}
          <div className="relative mt-4 flex gap-4">
            <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 shadow-lg shadow-black/40 ring-1 ring-white/10">
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center">
                <Clapperboard className="h-7 w-7 text-white/80" />
                <span className="text-[11px] font-semibold leading-tight text-white/90">
                  SEVERANCE
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
                Severance
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/60">
                <span>2025</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>TV Series</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>S2 · 10 eps</span>
              </div>

              {/* rating chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-violet-500/20 px-2 py-1 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/30">
                  <Star className="h-3 w-3 fill-violet-300 text-violet-300" />
                  8.9 Consumed
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10">
                  TMDB 8.4
                </span>
              </div>

              {/* primary CTAs */}
              <div className="mt-3 flex gap-2">
                <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 active:scale-[0.98]">
                  <Plus className="h-4 w-4" />
                  Track
                </button>
                <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/15 active:scale-[0.98]">
                  <Star className="h-4 w-4" />
                  Rate
                </button>
              </div>
            </div>
          </div>

          {/* description */}
          <p className="relative mt-4 text-sm leading-relaxed text-white/70">
            A team of office workers whose memories have been surgically divided
            between work and personal lives unravel the truth behind their
            employer.{" "}
            <span className="font-semibold text-violet-300">More</span>
          </p>

          {/* watch on */}
          <div className="relative mt-4 flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              Watch on
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/10">
              <Play className="h-3 w-3 fill-white" />
              Apple TV+
            </span>
          </div>

          {/* ===== STAT ROW ===== */}
          <div className="relative mt-5 grid grid-cols-4 gap-2">
            <StatTile
              icon={<Flame className="h-4 w-4" />}
              value="38"
              label="Hot Takes"
            />
            <StatTile
              icon={<Lightbulb className="h-4 w-4" />}
              value="12"
              label="Theories"
            />
            <StatTile
              icon={<TrendingUp className="h-4 w-4" />}
              value="287"
              label="Predictions"
            />
            <StatTile
              icon={<Users className="h-4 w-4" />}
              value="1.2K"
              label="Fans Here"
            />
          </div>
        </div>

        {/* ===================== WHITE BODY ===================== */}
        <div className="space-y-6 px-4 pb-24 pt-6">
          {/* composer */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 inline-flex rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setTab("review")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === "review"
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                <PenLine className="h-3.5 w-3.5" />
                Rate / Review
              </button>
              <button
                onClick={() => setTab("predict")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === "predict"
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Predict
              </button>
            </div>

            {tab === "review" ? (
              <>
                <div className="mb-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setRating(s)}>
                      <Star
                        className={`h-7 w-7 transition ${
                          s <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Drop your hot take…"
                  className="h-20 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none placeholder:text-gray-400 focus:border-violet-400 focus:bg-white"
                />
              </>
            ) : (
              <textarea
                placeholder="What's your prediction for the finale?"
                className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none placeholder:text-gray-400 focus:border-violet-400 focus:bg-white"
              />
            )}
            <button className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99]">
              Post
            </button>
          </section>

          {/* TRENDING TAKES */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Flame className="h-5 w-5 text-orange-500" />
                Trending Takes
              </h2>
              <button className="flex items-center text-sm font-semibold text-violet-600">
                See more
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {takes.map((t) => (
                <div
                  key={t.user}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${t.color} text-xs font-bold text-white`}
                    >
                      {t.initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">
                        @{t.user}
                      </span>
                      <span className="text-xs text-gray-400">{t.time} ago</span>
                    </div>
                    {t.hot && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-600">
                        <Flame className="h-3 w-3" />
                        Hot
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-gray-700">
                    {t.text}
                  </p>
                  <AgreeBar agree={t.agree} />
                  <div className="mt-3 flex items-center gap-4 text-xs font-medium text-gray-400">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5" />
                      {t.votes} votes
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t.comments}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TOP THEORIES */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Brain className="h-5 w-5 text-blue-500" />
                Top Theories
              </h2>
              <button className="flex items-center text-sm font-semibold text-violet-600">
                See more
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {theories.map((th) => (
                <div
                  key={th.user}
                  className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${th.color} text-xs font-bold text-white`}
                    >
                      {th.initials}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      @{th.user}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                      <Lightbulb className="h-3 w-3" />
                      Theory
                    </span>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-gray-700">
                    {th.text}
                  </p>
                  <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 ring-1 ring-blue-100">
                    <span className="text-xs font-medium text-gray-500">
                      Plausible?
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${th.plausible}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-blue-600">
                        {th.plausible}%
                      </span>
                      <span className="text-xs text-gray-400">
                        · {th.votes}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SIMILAR */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
              <Sparkles className="h-5 w-5 text-violet-500" />
              More Like This
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[
                { t: "Devs", c: "from-cyan-500 to-blue-700" },
                { t: "Dark", c: "from-zinc-600 to-zinc-900" },
                { t: "Westworld", c: "from-amber-500 to-rose-700" },
                { t: "Mr. Robot", c: "from-red-600 to-rose-900" },
              ].map((m) => (
                <div key={m.t} className="w-24 flex-shrink-0">
                  <div
                    className={`flex h-32 w-24 items-center justify-center rounded-xl bg-gradient-to-br ${m.c} p-2 text-center shadow-sm`}
                  >
                    <span className="text-xs font-bold text-white">{m.t}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-gray-600">
                    {m.t}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
