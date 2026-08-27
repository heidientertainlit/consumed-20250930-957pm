import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { DailyHeroSection } from "@/components/daily-hero-section";
import { supabase } from "@/lib/supabase";
import { Target, Brain, Vote, BarChart2, UserPlus, Trophy, ChevronRight, ArrowRight, Layers, Zap } from "lucide-react";

const gameModes = [
  {
    id: "trivia",
    label: "Trivia",
    description: "Think you know it? Prove it.",
    icon: Brain,
    color: "bg-purple-50 border-purple-100",
    iconColor: "text-purple-600",
    href: "/play/trivia",
  },
  {
    id: "polls",
    label: "Cast Your Vote",
    description: "Pick your side. See who agrees.",
    icon: Vote,
    color: "bg-blue-50 border-blue-100",
    iconColor: "text-blue-500",
    href: "/play/polls",
  },
  {
    id: "ranks",
    label: "Debate the Rank",
    description: "Rank your favorites. See who agrees.",
    icon: BarChart2,
    color: "bg-amber-50 border-amber-100",
    iconColor: "text-amber-500",
    href: "/play/ranks",
  },
  // HIDDEN: Cast a Friend — temporarily hidden while redesigning
  // { id: "cast", label: "Cast a Friend", description: "Who would play who?", icon: UserPlus, color: "bg-teal-50 border-teal-100", iconColor: "text-teal-500", href: "/play/cast" },
  // HIDDEN: Predictions — temporarily hidden, will return after rework. Re-enable by uncommenting.
  // {
  //   id: "predictions",
  //   label: "Predictions",
  //   description: "Call it. Are you right?",
  //   icon: Target,
  //   color: "bg-rose-50 border-rose-100",
  //   iconColor: "text-rose-500",
  //   href: "/play/predictions",
  // },
  // HIDDEN: friend-vs-friend trivia Pools (Harry Potter / Friends) — soft-hidden, route still works. Re-enable by uncommenting.
  // {
  //   id: "pools",
  //   label: "Pools",
  //   description: "Play and compete with friends or the world.",
  //   icon: Layers,
  //   color: "bg-purple-50 border-purple-100",
  //   iconColor: "text-purple-600",
  //   href: "/play/pools",
  // },
  // HIDDEN: Binge Battle — temporarily hidden, will return after rework. Re-enable by uncommenting.
  // {
  //   id: "binge-battle",
  //   label: "Binge Battle",
  //   description: "Finish it first? Race to beat your friends.",
  //   icon: Zap,
  //   color: "bg-green-50 border-green-100",
  //   iconColor: "text-green-600",
  //   href: "/play/binge-battle",
  // },
];

interface RankEntry {
  user_id: string;
  username: string;
  display_name: string;
  score: number;
  rank: number;
}

function RankWidget({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setCurrentUserId(session.user.id);

      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=global&period=all_time&limit=200`,
          { headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
        );
        const data = await res.json();
        console.log('[RankWidget] categories:', Object.keys(data?.categories || {}));
        // Use total_consumption — that's the user_points-based leaderboard matching profile points
        const board: RankEntry[] = data?.categories?.total_consumption || data?.categories?.overall || [];
        console.log('[RankWidget] board length:', board.length, '| my id:', session.user.id);
        console.log('[RankWidget] my entry:', board.find((e: RankEntry) => e.user_id === session.user.id));
        setEntries(board);
      } catch (err) {
        console.log('[RankWidget] error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mt-5 h-[88px] animate-pulse rounded-xl border border-gray-200 bg-gray-200/80 p-4 shadow-sm" />
    );
  }

  const myIndex = entries.findIndex(e => e.user_id === currentUserId);
  if (myIndex === -1 || entries.length === 0) return null;

  const me = entries[myIndex];
  const above = myIndex > 0 ? entries[myIndex - 1] : null;
  const below = myIndex < entries.length - 1 ? entries[myIndex + 1] : null;

  const Row = ({ entry, isMe }: { entry: RankEntry; isMe?: boolean }) => (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 ${isMe ? 'border-violet-300 bg-white shadow-sm' : 'border-transparent'}`}>
      <span className={`w-7 shrink-0 text-right text-xs font-bold ${isMe ? 'text-violet-700' : 'text-gray-400'}`}>
        #{entry.rank}
      </span>
      <span className={`flex-1 truncate text-sm font-medium ${isMe ? 'text-gray-950' : 'text-gray-600'}`}>
        {isMe ? 'You' : (entry.display_name || entry.username)}
      </span>
      <span className={`shrink-0 text-xs font-semibold ${isMe ? 'text-violet-700' : 'text-gray-400'}`}>
        {entry.score.toLocaleString()} pts
      </span>
    </div>
  );

  return (
    <button
      onClick={() => onNavigate('/leaderboard')}
      className="mt-5 w-full rounded-xl border border-gray-200 bg-gray-200/80 p-2 text-left shadow-sm transition-transform active:scale-95"
    >
      <div className="space-y-0.5">
        {above && <Row entry={above} />}
        <Row entry={me} isMe />
        {below && <Row entry={below} />}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2.5 pr-1">
        <span className="text-[11px] font-semibold text-violet-700">Full leaderboard</span>
        <ArrowRight size={11} className="text-violet-700" />
      </div>
    </button>
  );
}

export default function PlayPage({ initialTab }: { initialTab?: string }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation roomyTopBar />

      {/* People-style composed hero with a quieter leaderboard panel below */}
      <div className="mx-auto max-w-4xl bg-gray-50 px-4 pb-5 pt-6">
        <section
          className="relative overflow-hidden rounded-3xl p-6 text-white"
          style={{
            background: "linear-gradient(155deg, #302452 0%, #1c1630 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 40px rgba(124,58,237,0.12)",
          }}
        >
          <div className="relative">
            <DailyHeroSection embedded />
          </div>
        </section>
        <RankWidget onNavigate={setLocation} />
      </div>

      {/* Light section — game modes */}
      <div className="mx-auto max-w-4xl space-y-5 bg-gray-50 px-4 pb-28 pt-3">
        {/* Game Modes */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Choose a Mode
          </p>
          <div className="grid grid-cols-2 gap-3">
            {gameModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setLocation(mode.href)}
                  className={`relative flex flex-col items-start p-4 rounded-2xl border ${mode.color} text-left active:scale-95 transition-transform`}
                >
                  <Icon size={26} className={`${mode.iconColor} mb-3`} />
                  <p className="text-gray-900 font-semibold text-sm leading-tight">{mode.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-tight">{mode.description}</p>
                  <ChevronRight size={14} className="absolute top-4 right-4 text-gray-300" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
