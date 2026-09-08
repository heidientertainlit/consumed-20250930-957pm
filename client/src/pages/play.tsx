import { useState, useEffect, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { DailyHeroSection } from "@/components/daily-hero-section";
import { TriviaCarousel } from "@/components/trivia-carousel";
import { PollsCarousel } from "@/components/polls-carousel";
import { RanksCarousel } from "@/components/ranks-carousel";
import CreateRankDialog from "@/components/create-rank-dialog";
import SeenItGame from "@/components/seen-it-game";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Vote,
  BarChart2,
  Eye,
  LayoutGrid,
  ArrowRight,
  Plus,
  Globe2,
  Lock,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

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
    label: "Vote",
    description: "Pick your side. See who agrees.",
    icon: Vote,
    color: "bg-[#f1efff] border-[#e0dcff]",
    iconColor: "text-[#5f35c9]",
  },
  {
    id: "ranks",
    label: "Rank",
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

interface UserRank {
  id: string;
  title: string;
  visibility: string;
  created_at?: string | null;
  items_count?: number | null;
  items?: unknown[];
}

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

export function sortUserRanksNewestFirst(ranks: UserRank[]): UserRank[] {
  return [...ranks].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export function normalizeUserRanks(data: { ranks?: UserRank[] } | UserRank[] | undefined): UserRank[] {
  const ranks = Array.isArray(data)
    ? data
    : Array.isArray(data?.ranks)
    ? data.ranks
    : [];
  return sortUserRanksNewestFirst(ranks);
}

function MyRanks({
  session,
  onNavigate,
}: {
  session: ReturnType<typeof useAuth>["session"];
  onNavigate: (path: string) => void;
}) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const {
    data: ranks = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<{ ranks?: UserRank[] } | UserRank[], Error, UserRank[]>({
    queryKey: ["user-ranks", userId],
    queryFn: async () => {
      if (!userId || !accessToken) {
        throw new Error("Sign in to load your ranks.");
      }

      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        let message = `Couldn't load your ranks (${response.status}).`;
        try {
          const errorBody: { error?: string } = await response.json();
          if (errorBody.error) message = errorBody.error;
        } catch {
          // The status-based message remains useful if the response is not JSON.
        }
        throw new Error(message);
      }

      const data: { ranks?: UserRank[] } = await response.json();
      return { ranks: Array.isArray(data.ranks) ? data.ranks : [] };
    },
    select: normalizeUserRanks,
    enabled: !!userId && !!accessToken,
  });

  return (
    <section aria-labelledby="my-ranks-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="my-ranks-heading" className="text-base font-bold text-[#281d2d]">
            My Ranks
          </h2>
          {!isLoading && !isError && ranks.length > 0 && (
            <p className="text-xs text-[#817987]">
              {ranks.length} {ranks.length === 1 ? "rank" : "ranks"}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading your ranks"
          className="flex gap-3 overflow-hidden"
        >
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-[104px] min-w-[230px] animate-pulse rounded-2xl border border-[#e7dfda] bg-[#f0ebe7]"
            />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#efd4d1] bg-[#fff8f7] px-4 py-3"
        >
          <p className="text-sm text-[#76524f]">
            {error instanceof Error ? error.message : "Couldn't load your ranks."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#6d35a3] hover:bg-[#f2e9fa] disabled:opacity-60"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : ranks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9cec7] bg-white/60 px-4 py-4 text-center">
          <p className="text-sm font-semibold text-[#4d4051]">No ranks yet</p>
          <p className="mt-0.5 text-xs text-[#817987]">
            Create your first ranked list above.
          </p>
        </div>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-1 sm:px-1">
          {ranks.map((rank) => {
            const isPrivate = rank.visibility === "private";
            const itemCount = typeof rank.items_count === "number"
              ? rank.items_count
              : Array.isArray(rank.items)
              ? rank.items.length
              : 0;
            const VisibilityIcon = isPrivate ? Lock : Globe2;

            return (
              <button
                key={rank.id}
                type="button"
                onClick={() => onNavigate(`/rank/${rank.id}`)}
                className="group min-w-[230px] max-w-[260px] snap-start rounded-2xl border border-[#e3d9d2] bg-white px-4 py-3 text-left shadow-[0_3px_10px_rgba(42,24,64,0.05)] transition active:scale-[0.985]"
                aria-label={`Open ${rank.title}`}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <h3 className="line-clamp-2 min-h-[2.5rem] flex-1 text-sm font-bold leading-5 text-[#281d2d]">
                    {rank.title}
                  </h3>
                  <ChevronRight
                    size={16}
                    className="mt-0.5 shrink-0 text-[#9a8f9e] transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-[#756c78]">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                      isPrivate
                        ? "bg-[#f1edf4] text-[#655d69]"
                        : "bg-[#edf6ef] text-[#3f704a]"
                    }`}
                  >
                    <VisibilityIcon size={10} aria-hidden="true" />
                    {isPrivate ? "Private" : "Public"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
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
  const { session } = useAuth();
  const { toast } = useToast();
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  const initialMode = requestedMode && gameModes.some((mode) => mode.id === requestedMode)
    ? requestedMode as PlayMode
    : gameModes.some((mode) => mode.id === initialTab)
    ? initialTab as PlayMode
    : "all";
  const [activeMode, setActiveMode] = useState<PlayMode>(initialMode);
  const [createRankOpen, setCreateRankOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<{
    title: string;
    mediaType: string;
    externalId: string;
    externalSource: string;
    imageUrl: string;
  } | null>(null);
  const requestedTriviaCategory = getRequestedTriviaCategory();
  const challengedTriviaId = new URLSearchParams(window.location.search).get("challenge");

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

  const handleCreateRank = () => {
    if (!session?.access_token) {
      sessionStorage.setItem("returnUrl", `${window.location.pathname}?mode=ranks`);
      toast({
        title: "Sign in to create a ranked list",
        description: "Your ranked list will be saved to your profile.",
      });
      setLocation("/login");
      return;
    }
    setCreateRankOpen(true);
  };

  const renderModeFeed = () => {
    if (activeMode === "all") {
      const feedLength = Math.max(
        TRIVIA_CATEGORIES.length,
        POLL_CATEGORIES.length,
        SEEN_IT_TYPES.length,
      );
      return Array.from({ length: feedLength }, (_, index) => (
        <div key={`all-play-${index}`} className="flex flex-col gap-6">
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
      if (challengedTriviaId) {
        return <TriviaCarousel />;
      }
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

      <main className="mx-auto max-w-[680px] px-4 pb-28 pt-4 sm:px-6">
        <nav
          role="tablist"
          aria-label="Play modes"
          className="flex w-full overflow-x-auto"
        >
          {gameModes.map((mode, index) => {
            const Icon = mode.icon;
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
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-start gap-1.5 px-2 pb-3 pt-2 text-center text-[10px] font-medium leading-tight transition-colors sm:text-[11px] ${
                  isActive
                    ? "text-[#7139a0] after:absolute after:bottom-[-1px] after:left-1/2 after:h-0.5 after:w-8 after:-translate-x-1/2 after:rounded-full after:bg-[#7139a0]"
                    : "text-[#817987] hover:text-[#4d4051]"
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.25 : 1.8} aria-hidden="true" />
                <span className="min-h-[2.4em] max-w-[88px] whitespace-normal">{mode.label}</span>
              </button>
            );
          })}
        </nav>
        <section
          id="play-mode-panel"
          role="tabpanel"
          aria-labelledby={`play-tab-${activeMode}`}
          tabIndex={0}
          className="space-y-6 pt-5"
        >
          {activeMode === "ranks" && (
            <>
              <button
                type="button"
                onClick={handleCreateRank}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d35a3] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5d2c8d] active:bg-[#51277b]"
                data-testid="button-open-create-rank"
              >
                <Plus size={17} aria-hidden="true" />
                Create a ranked list
              </button>
              <MyRanks session={session} onNavigate={setLocation} />
            </>
          )}
          {renderModeFeed()}
        </section>
      </main>

      <QuickAddListSheet
        isOpen={!!quickAddMedia}
        onClose={() => setQuickAddMedia(null)}
        media={quickAddMedia}
      />
      <CreateRankDialog open={createRankOpen} onOpenChange={setCreateRankOpen} />
    </div>
  );
}
