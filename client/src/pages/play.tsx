import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { DailyHeroSection } from "@/components/daily-hero-section";
import { supabase } from "@/lib/supabase";
import { Brain, Vote, BarChart2, ChevronRight, ArrowRight, Smile } from "lucide-react";

const gameModes = [
  {
    id: "trivia",
    label: "Trivia",
    description: "Think you know it? Prove it.",
    icon: Brain,
    color: "bg-[#f7f0ff] border-[#eadbff]",
    iconColor: "text-[#6929c4]",
    href: "/play/trivia",
  },
  {
    id: "polls",
    label: "Cast Your Vote",
    description: "Pick your side. See who agrees.",
    icon: Vote,
    color: "bg-[#f1efff] border-[#e0dcff]",
    iconColor: "text-[#5f35c9]",
    href: "/play/polls",
  },
  {
    id: "ranks",
    label: "Debate the Rank",
    description: "Rank your favorites. See who agrees.",
    icon: BarChart2,
    color: "bg-[#fff2e9] border-[#fde4d4]",
    iconColor: "text-[#db6a25]",
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
      <div className="mt-6 h-[132px] animate-pulse rounded-2xl border border-[#e4ddd8] bg-[#f0ece7] p-4 shadow-[0_4px_12px_rgba(37,20,66,0.05)]" />
    );
  }

  const myIndex = entries.findIndex(e => e.user_id === currentUserId);
  if (myIndex === -1 || entries.length === 0) return null;

  const me = entries[myIndex];
  const above = myIndex > 0 ? entries[myIndex - 1] : null;
  const below = myIndex < entries.length - 1 ? entries[myIndex + 1] : null;

  const Row = ({ entry, isMe }: { entry: RankEntry; isMe?: boolean }) => (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${isMe ? 'border-[#c9a6fb] bg-[#fffcfa] shadow-[0_1px_3px_rgba(81,34,133,0.06)]' : 'border-transparent'}`}>
      <span className={`w-8 shrink-0 text-right text-sm font-bold ${isMe ? 'text-[#5920a3]' : 'text-[#8c8790]'}`}>
        #{entry.rank}
      </span>
      <span className={`flex-1 truncate text-[15px] font-semibold ${isMe ? 'text-[#23172e]' : 'text-[#5f5862]'}`}>
        {isMe ? 'You' : (entry.display_name || entry.username)}
      </span>
      <span className={`shrink-0 text-sm font-semibold ${isMe ? 'text-[#5920a3]' : 'text-[#8c8790]'}`}>
        {entry.score.toLocaleString()} pts
      </span>
    </div>
  );

  return (
    <button
      onClick={() => onNavigate('/leaderboard')}
      className="mt-6 w-full rounded-2xl border border-[#e3deda] bg-[#faf7f4] p-2 text-left shadow-[0_5px_14px_rgba(42,24,64,0.07)] transition-transform duration-150 active:scale-[0.985]"
    >
      <div className="space-y-0.5">
        {above && <Row entry={above} />}
        <Row entry={me} isMe />
        {below && <Row entry={below} />}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 pr-2">
        <span className="text-[13px] font-semibold text-[#5920a3]">Full leaderboard</span>
        <ArrowRight size={14} className="text-[#5920a3]" />
      </div>
    </button>
  );
}

export default function PlayPage({ initialTab }: { initialTab?: string }) {
  const [, setLocation] = useLocation();
  void initialTab;

  return (
    <div className="min-h-[100dvh] bg-[#fbf8f5]">
      <Navigation roomyTopBar />

      <main className="mx-auto max-w-[720px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7">
        <section
          className="relative isolate overflow-hidden rounded-[30px] border border-[#56358e] px-5 py-4 text-white shadow-[0_18px_38px_rgba(48,21,91,0.16)] sm:px-7"
          style={{
            background: "radial-gradient(circle at 75% 46%, rgba(139,74,248,0.3), transparent 23%), linear-gradient(135deg, #28104f 0%, #170a35 54%, #100625 100%)",
          }}
        >
          <div className="pointer-events-none absolute right-[-24px] top-[76px] z-0 flex h-[160px] w-[160px] items-center justify-center rounded-full border-[3px] border-[#bc80ff] opacity-90 shadow-[0_0_28px_rgba(174,91,255,0.6)] sm:right-9 sm:h-[176px] sm:w-[176px]">
            <Smile size={104} strokeWidth={1.5} className="text-[#c181ff]" />
          </div>
          <div className="relative z-10">
            <DailyHeroSection embedded />
          </div>
        </section>
        <RankWidget onNavigate={setLocation} />

        <section className="pt-6">
          <p className="mb-3 px-0.5 text-xs font-bold uppercase tracking-[0.16em] text-[#87808f]">
            More ways to play
          </p>
          <div className="space-y-3">
            {gameModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setLocation(mode.href)}
                  className="group relative flex w-full items-center gap-4 rounded-2xl border border-[#e4dfda] bg-[#fdfaf7] p-3 text-left shadow-[0_3px_8px_rgba(44,26,61,0.05)] transition-[transform,box-shadow] duration-150 active:scale-[0.985] active:shadow-none"
                >
                  <span className={`grid h-[62px] w-[62px] shrink-0 place-items-center rounded-xl border ${mode.color}`}>
                    <Icon size={29} strokeWidth={1.8} className={mode.iconColor} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[18px] font-bold leading-tight tracking-[-0.025em] text-[#22172d]">{mode.label}</span>
                    <span className="mt-1 block text-sm leading-tight text-[#77707b]">{mode.description}</span>
                  </span>
                  <ChevronRight size={23} strokeWidth={1.5} className="mr-1 shrink-0 text-[#706a73] transition-transform duration-150 group-active:translate-x-0.5" />
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
