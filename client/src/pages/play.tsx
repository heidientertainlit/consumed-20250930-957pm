import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { supabase } from "@/lib/supabase";
import { Target, HelpCircle, Vote, BarChart2, UserPlus, Trophy, ChevronRight, ArrowRight } from "lucide-react";

const gameModes = [
  {
    id: "trivia",
    label: "Trivia",
    description: "Test your knowledge",
    icon: HelpCircle,
    color: "bg-blue-50 border-blue-100",
    iconColor: "text-blue-500",
    href: "/play/trivia",
  },
  {
    id: "polls",
    label: "Polls",
    description: "Vote and see what others think",
    icon: Vote,
    color: "bg-violet-50 border-violet-100",
    iconColor: "text-violet-500",
    href: "/play/polls",
  },
  {
    id: "ranks",
    label: "Debate the Rank",
    description: "Challenge each other's rankings",
    icon: BarChart2,
    color: "bg-amber-50 border-amber-100",
    iconColor: "text-amber-500",
    href: "/play/ranks",
  },
  {
    id: "cast",
    label: "Cast a Friend",
    description: "Who would play who?",
    icon: UserPlus,
    color: "bg-teal-50 border-teal-100",
    iconColor: "text-teal-500",
    href: "/play/cast",
  },
  {
    id: "predictions",
    label: "Predictions",
    description: "Predict what happens next",
    icon: Target,
    color: "bg-rose-50 border-rose-100",
    iconColor: "text-rose-500",
    href: "/play/predictions",
  },
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
      <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-4 animate-pulse h-[88px]" />
    );
  }

  const myIndex = entries.findIndex(e => e.user_id === currentUserId);
  if (myIndex === -1 || entries.length === 0) return null;

  const me = entries[myIndex];
  const above = myIndex > 0 ? entries[myIndex - 1] : null;
  const below = myIndex < entries.length - 1 ? entries[myIndex + 1] : null;

  const Row = ({ entry, isMe }: { entry: RankEntry; isMe?: boolean }) => (
    <div className={`flex items-center gap-3 py-1.5 px-3 rounded-xl ${isMe ? 'bg-purple-600/20 border border-purple-500/30' : ''}`}>
      <span className={`text-xs font-bold w-7 text-right shrink-0 ${isMe ? 'text-purple-300' : 'text-white/40'}`}>
        #{entry.rank}
      </span>
      <span className={`flex-1 text-sm font-medium truncate ${isMe ? 'text-white' : 'text-white/60'}`}>
        {isMe ? 'You' : (entry.display_name || entry.username)}
      </span>
      <span className={`text-xs font-semibold shrink-0 ${isMe ? 'text-purple-300' : 'text-white/40'}`}>
        {entry.score.toLocaleString()} pts
      </span>
    </div>
  );

  return (
    <button
      onClick={() => onNavigate('/leaderboard')}
      className="w-full mt-5 rounded-2xl bg-white/5 border border-white/10 p-3 text-left active:scale-95 transition-transform"
    >
      <div className="space-y-0.5">
        {above && <Row entry={above} />}
        <Row entry={me} isMe />
        {below && <Row entry={below} />}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2.5 pr-1">
        <span className="text-[11px] text-white/30">Full leaderboard</span>
        <ArrowRight size={11} className="text-white/30" />
      </div>
    </button>
  );
}

export default function PlayPage({ initialTab }: { initialTab?: string }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0f' }}>
      <Navigation />

      {/* Dark hero — heading + rank widget */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] px-4 pt-6 pb-6">
        <h1
          className="text-2xl font-bold text-white text-center"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          Play
        </h1>
        <RankWidget onNavigate={setLocation} />
      </div>

      {/* Light section — game modes */}
      <div className="bg-gray-50 px-4 pt-5 pb-28 space-y-5">
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
