import { useState, useEffect, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { DailyHeroSection } from "@/components/daily-hero-section";
import { TriviaCarousel } from "@/components/trivia-carousel";
import { PollsCarousel } from "@/components/polls-carousel";
import { RanksCarousel } from "@/components/ranks-carousel";
import SeenItGame from "@/components/seen-it-game";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import { supabase } from "@/lib/supabase";
import { Brain, Vote, BarChart2, Eye, LayoutGrid, ArrowRight } from "lucide-react";

const gameModes = [
  {
    id: "all",
    label: "All",
    description: "Everything happening in Play.",
    icon: LayoutGrid,
    color: "bg-[#f2ebfb] border-[#dfd0f3]",
    iconColor: "text-[#63339b]",
  },
  {
    id: "trivia",
    label: "Trivia",
    description: "Think you know it? Prove it.",
    icon: Brain,
    color: "bg-[#f7f0ff] border-[#eadbff]",
    iconColor: "text-[#6929c4]",
  },
  {
    id: "polls",
    label: "Cast Your Vote",
    description: "Pick your side. See who agrees.",
    icon: Vote,
    color: "bg-[#f1efff] border-[#e0dcff]",
    iconColor: "text-[#5f35c9]",
  },
  {
    id: "ranks",
    label: "Debate the Rank",
    description: "Rank your favorites. See who agrees.",
    icon: BarChart2,
    color: "bg-[#fff2e9] border-[#fde4d4]",
    iconColor: "text-[#db6a25]",
  },
  {
    id: "seen-it",
    label: "Seen It",
    description: "Seen it? Read it? Heard it?",
    icon: Eye,
    color: "bg-[#f5efff] border-[#e5d8fb]",
    iconColor: "text-[#7c3aed]",
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

type PlayMode = "all" | "trivia" | "polls" | "ranks" | "seen-it";

const TRIVIA_CATEGORIES = ["Movies", "TV", "Books", "Music", "Podcasts", "Gaming", "Other"];
const POLL_CATEGORIES = ["Movies", "TV", "Books", "Music", "Podcasts", "Sports", "Other"];
const SEEN_IT_TYPES = ["movie", "tv", "book", "music", "podcast", "game"];

function getRequestedTriviaCategory() {
  const requested = new URLSearchParams(window.location.search).get("category")?.toLowerCase();
  const categoryMap: Record<string, string> = {
    movie: "Movies",
    movies: "Movies",
    tv: "TV",
    book: "Books",
    books: "Books",
    music: "Music",
    podcast: "Podcasts",
    podcasts: "Podcasts",
    game: "Gaming",
    games: "Gaming",
    gaming: "Gaming",
    other: "Other",
  };
  return requested ? categoryMap[requested] : undefined;
}

interface RankEntry {
  user_id: string;
  username: string;
  display_name: string;
  score: number;
  rank: number;
}

function RankWidget({
  onNavigate,
  insideHero = false,
}: {
  onNavigate: (path: string) => void;
  insideHero?: boolean;
}) {
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
      <div className={insideHero
        ? "mt-4 h-[90px] animate-pulse border-t border-white/10 bg-white/[0.025]"
        : "mt-4 h-[112px] animate-pulse rounded-2xl border border-[#e4ddd8] bg-[#f0ece7] p-3 shadow-[0_4px_12px_rgba(37,20,66,0.05)]"
      } />
    );
  }

  const myIndex = entries.findIndex(e => e.user_id === currentUserId);
  if (myIndex === -1 || entries.length === 0) return null;

  const me = entries[myIndex];
  const above = myIndex > 0 ? entries[myIndex - 1] : null;
  const below = myIndex < entries.length - 1 ? entries[myIndex + 1] : null;

  const Row = ({ entry, isMe }: { entry: RankEntry; isMe?: boolean }) => (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
      insideHero
        ? isMe
          ? 'border-white/15 bg-white/[0.07]'
          : 'border-transparent'
        : isMe
          ? 'border-[#c9a6fb] bg-[#fffcfa] shadow-[0_1px_3px_rgba(81,34,133,0.06)]'
          : 'border-transparent'
    }`}>
      <span className={`w-7 shrink-0 text-right text-xs font-bold ${
        insideHero ? (isMe ? 'text-[#c4a0ff]' : 'text-white/35') : (isMe ? 'text-[#5920a3]' : 'text-[#8c8790]')
      }`}>
        #{entry.rank}
      </span>
      <span className={`flex-1 truncate text-[13px] font-semibold ${
        insideHero ? (isMe ? 'text-white' : 'text-white/55') : (isMe ? 'text-[#23172e]' : 'text-[#5f5862]')
      }`}>
        {isMe ? 'You' : (entry.display_name || entry.username)}
      </span>
      <span className={`shrink-0 text-xs font-semibold ${
        insideHero ? (isMe ? 'text-[#c4a0ff]' : 'text-white/35') : (isMe ? 'text-[#5920a3]' : 'text-[#8c8790]')
      }`}>
        {entry.score.toLocaleString()} pts
      </span>
    </div>
  );

  return (
    <button
      onClick={() => onNavigate('/leaderboard')}
      className={insideHero
        ? "mt-4 w-full border-t border-white/10 pt-3 text-left transition-opacity active:opacity-80"
        : "mt-4 w-full rounded-2xl border border-[#e3deda] bg-[#faf7f4] p-1.5 text-left shadow-[0_5px_14px_rgba(42,24,64,0.07)] transition-transform duration-150 active:scale-[0.985]"
      }
    >
      <div className="space-y-0.5">
        {above && <Row entry={above} />}
        <Row entry={me} isMe />
        {below && <Row entry={below} />}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 pr-2 pb-0.5">
        <span className={insideHero ? "text-[11px] font-medium text-white/50" : "text-[11px] font-semibold text-[#5920a3]"}>Full leaderboard</span>
        <ArrowRight size={12} className={insideHero ? "text-white/45" : "text-[#5920a3]"} />
      </div>
    </button>
  );
}

export default function PlayPage({ initialTab }: { initialTab?: string }) {
  const [, setLocation] = useLocation();
  const initialMode = gameModes.some((mode) => mode.id === initialTab)
    ? initialTab as PlayMode
    : "all";
  const [activeMode, setActiveMode] = useState<PlayMode>(initialMode);
  const [quickAddMedia, setQuickAddMedia] = useState<{
    title: string;
    mediaType: string;
    externalId: string;
    externalSource: string;
    imageUrl: string;
  } | null>(null);
  const requestedTriviaCategory = getRequestedTriviaCategory();

  useEffect(() => {
    if (gameModes.some((mode) => mode.id === initialTab)) {
      setActiveMode(initialTab as PlayMode);
    }
  }, [initialTab]);

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % gameModes.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + gameModes.length) % gameModes.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = gameModes.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextMode = gameModes[nextIndex].id as PlayMode;
    setActiveMode(nextMode);
    document.getElementById(`play-tab-${nextMode}`)?.focus();
  };

  const renderModeFeed = () => {
    if (activeMode === "all") {
      const feedLength = Math.max(
        TRIVIA_CATEGORIES.length,
        POLL_CATEGORIES.length,
        SEEN_IT_TYPES.length,
      );
      return Array.from({ length: feedLength }, (_, index) => (
        <div key={`all-play-${index}`} className="contents">
          {TRIVIA_CATEGORIES[index] && (
            <TriviaCarousel category={TRIVIA_CATEGORIES[index]} />
          )}
          {POLL_CATEGORIES[index] && (
            <PollsCarousel category={POLL_CATEGORIES[index]} />
          )}
          {index < 3 && <RanksCarousel offset={index} />}
          {SEEN_IT_TYPES[index] && (
            <SeenItGame
              mediaTypeFilter={SEEN_IT_TYPES[index]}
              onAddToList={setQuickAddMedia}
            />
          )}
        </div>
      ));
    }
    if (activeMode === "trivia") {
      const categories = requestedTriviaCategory
        ? [requestedTriviaCategory]
        : TRIVIA_CATEGORIES;
      return categories.map((category) => (
        <TriviaCarousel key={category} category={category} />
      ));
    }
    if (activeMode === "polls") {
      return POLL_CATEGORIES.map((category) => (
        <PollsCarousel key={category} category={category} />
      ));
    }
    if (activeMode === "ranks") {
      return [0, 1, 2].map((offset) => (
        <RanksCarousel key={offset} offset={offset} />
      ));
    }
    return SEEN_IT_TYPES.map((mediaType) => (
      <SeenItGame
        key={mediaType}
        mediaTypeFilter={mediaType}
        onAddToList={setQuickAddMedia}
      />
    ));
  };

  return (
    <div className="min-h-[100dvh] bg-[#fbf8f5]">
      <Navigation roomyTopBar />

      <div className="-mt-px" style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }}>
        <div className="mx-auto max-w-[680px] px-4 pb-6 pt-4 sm:px-6 sm:pt-6">
          <section
            className="relative isolate overflow-hidden rounded-[26px] border border-white/10 px-4 py-3 text-white shadow-[0_14px_30px_rgba(10,4,24,0.24)] sm:px-6"
            style={{
              background: "linear-gradient(155deg, #3a2864 0%, #291a4a 48%, #1b102f 100%)",
            }}
          >
            <div className="relative z-10">
              <DailyHeroSection embedded />
              <RankWidget onNavigate={setLocation} insideHero />
            </div>
          </section>
        </div>
      </div>

      <main className="mx-auto max-w-[680px] px-4 pb-28 sm:px-6">
        <section className="pt-4">
          <nav
            role="tablist"
            aria-label="Play modes"
            className="flex w-full gap-2 overflow-x-auto pb-1"
          >
            {gameModes.map((mode, index) => {
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  id={`play-tab-${mode.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="play-mode-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveMode(mode.id as PlayMode)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    isActive
                      ? "border-[#513278] bg-[#513278] text-white"
                      : "border-[#d9d1dc] bg-white text-[#6f6575] hover:border-[#b9a9c2] hover:text-[#34213f]"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </nav>
        </section>

        <section
          id="play-mode-panel"
          role="tabpanel"
          aria-labelledby={`play-tab-${activeMode}`}
          tabIndex={0}
          className="space-y-4 pt-5"
        >
          {renderModeFeed()}
        </section>
      </main>

      <QuickAddListSheet
        isOpen={!!quickAddMedia}
        onClose={() => setQuickAddMedia(null)}
        media={quickAddMedia}
      />
    </div>
  );
}
