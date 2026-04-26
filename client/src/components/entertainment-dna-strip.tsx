import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import {
  Flame, Sparkles, ChevronRight, X, Lock, Zap, Dna,
  Film, Tv, BookOpen, Music, Star, Trophy,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

const CATEGORY_ICONS: Record<string, any> = {
  Movies: Film, Movie: Film,
  TV: Tv, Television: Tv,
  Books: BookOpen, Book: BookOpen,
  Music: Music,
  'Pop Culture': Star,
  Thrillers: Zap,
  'Sci-Fi': Sparkles,
  Default: Star,
};

function getCatIcon(cat: string) {
  const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS.Default;
  return <Icon size={12} className="inline mr-1 -mt-0.5" />;
}

function useStripData() {
  const { user, session } = useAuth();

  const { data: streak } = useQuery({
    queryKey: ['dna-strip-streak', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from('login_streaks')
        .select('current_streak')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.current_streak ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: dnaProfile } = useQuery({
    queryKey: ['dna-strip-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('dna_profiles')
        .select('label, tagline, flavor_notes, favorite_genres')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 120000,
  });

  const { data: triviaStats } = useQuery({
    queryKey: ['dna-strip-trivia', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, correct: 0, accuracy: 0 };
      const { data: triviaPoolIds } = await supabase
        .from('prediction_pools')
        .select('id')
        .eq('type', 'trivia');
      if (!triviaPoolIds?.length) return { total: 0, correct: 0, accuracy: 0 };
      const ids = triviaPoolIds.map((p: any) => p.id);
      const { data: preds } = await supabase
        .from('user_predictions')
        .select('is_winner')
        .eq('user_id', user.id)
        .in('pool_id', ids);
      if (!preds?.length) return { total: 0, correct: 0, accuracy: 0 };
      const correct = preds.filter((p: any) => p.is_winner).length;
      const total = preds.length;
      return { total, correct, accuracy: Math.round((correct / total) * 100) };
    },
    enabled: !!user?.id,
    staleTime: 120000,
  });

  const { data: rankData } = useQuery({
    queryKey: ['dna-strip-rank', user?.id],
    queryFn: async () => {
      if (!user?.id || !session?.access_token) return { rank: null, percentile: null, total: 0 };
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards?category=trivia&scope=global`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) return { rank: null, percentile: null, total: 0 };
        const data = await res.json();
        const entries: any[] = data?.leaderboard ?? data?.data ?? data ?? [];
        if (!entries.length) return { rank: null, percentile: null, total: 0 };
        const idx = entries.findIndex((e: any) => e.user_id === user.id || e.id === user.id);
        if (idx === -1) return { rank: null, percentile: null, total: entries.length };
        const rank = idx + 1;
        const total = entries.length;
        const percentile = Math.round(((total - rank) / total) * 100);
        return { rank, percentile, total };
      } catch {
        return { rank: null, percentile: null, total: 0 };
      }
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: 300000,
  });

  return {
    streak: streak ?? 0,
    dnaProfile: dnaProfile ?? null,
    triviaStats: triviaStats ?? { total: 0, correct: 0, accuracy: 0 },
    rankData: rankData ?? { rank: null, percentile: null, total: 0 },
  };
}

type StripState = 1 | 2 | 3 | 4 | 5;

function getStripState(streak: number, dnaProfile: any, triviaStats: { total: number }): StripState {
  if (dnaProfile?.label) return 5;
  if (triviaStats.total >= 10) return 4;
  if (triviaStats.total >= 3 || streak >= 2) return 3;
  if (triviaStats.total >= 1) return 2;
  return 1;
}

// ─── Collapsed: dark bordered card ───────────────────────────────────────────
function CollapsedStrip({ state, streak, dnaProfile, onExpand }: {
  state: StripState; streak: number; dnaProfile: any; onExpand: () => void;
}) {
  const configs: Record<StripState, { icon: any; headline: string; cta: string }> = {
    1: {
      icon: <Dna size={20} className="text-purple-400" />,
      headline: 'Your Entertainment DNA is waiting',
      cta: 'Start →',
    },
    2: {
      icon: <Sparkles size={20} className="text-violet-300" />,
      headline: 'Your Entertainment DNA is forming',
      cta: 'Keep playing →',
    },
    3: {
      icon: <Flame size={20} className="text-orange-400" />,
      headline: streak >= 2 ? `You're on a hot streak 🔥` : 'Your instincts are sharpening',
      cta: 'Prove it →',
    },
    4: {
      icon: <Trophy size={20} className="text-yellow-400" />,
      headline: 'Your entertainment edge is clear',
      cta: 'View your DNA →',
    },
    5: {
      icon: <Dna size={20} className="text-purple-300" />,
      headline: dnaProfile?.label || 'The Balanced Binger',
      cta: 'View DNA →',
    },
  };

  const c = configs[state];

  return (
    <button onClick={onExpand} className="w-full text-left mb-3">
      <div className="rounded-2xl border border-purple-700/40 bg-[#1a1033]/90 px-4 py-3.5 flex items-center gap-3 shadow-md backdrop-blur-sm">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-900/60 border border-purple-600/30 flex items-center justify-center">
          {c.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-snug truncate">{c.headline}</p>
        </div>
        <span className="text-purple-400 text-xs font-semibold whitespace-nowrap flex-shrink-0">{c.cta}</span>
      </div>
    </button>
  );
}

// ─── Expanded card ────────────────────────────────────────────────────────────
function ExpandedCard({ state, streak, dnaProfile, triviaStats, rankData, onClose, onNavigate }: {
  state: StripState; streak: number; dnaProfile: any; triviaStats: any;
  rankData: { rank: number | null; percentile: number | null; total: number };
  onClose: () => void; onNavigate: () => void;
}) {
  const topGenres: string[] = dnaProfile?.favorite_genres?.slice(0, 3) ?? [];
  const defaultGenres = ['Movies', 'TV', 'Books', 'Pop Culture'];
  const showGenres = topGenres.length > 0 ? topGenres : defaultGenres;
  const isLocked = state <= 2;

  const headline = {
    1: "Your Entertainment DNA is waiting.",
    2: "Your Entertainment DNA is forming.",
    3: triviaStats.accuracy >= 70 ? "You've got sharp instincts." : `You're on a ${streak >= 2 ? `${streak}-day hot streak 🔥` : 'roll'}.`,
    4: "You have a clear entertainment edge.",
    5: dnaProfile?.label || 'The Balanced Binger',
  }[state];

  // ── Stat: Weekly Rank ──
  const rankVal = rankData.rank != null ? `#${rankData.rank}` : '—';
  const rankSub = rankData.rank != null ? 'This week' : 'Play to unlock';

  // ── Stat: Hot Streak ──
  const streakVal = streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''}` : '0 days';
  const streakSub = streak >= 3 ? 'On fire 🔥' : streak >= 1 ? 'Keep it going' : 'Start today';

  // ── Stat: Percentile ──
  const percentileVal = rankData.percentile != null ? `${rankData.percentile}%` : '—';
  const percentileSub = rankData.percentile != null ? 'of players beaten' : 'Play to unlock';

  const ctaLabel = state <= 2
    ? "Start Today's Play →"
    : state === 5
    ? "View full Entertainment DNA →"
    : "See your full Entertainment DNA →";

  return (
    <div className="rounded-2xl border border-purple-600/50 bg-[#110e28] shadow-xl overflow-hidden mb-3">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 border border-purple-500/40 flex items-center justify-center shadow-lg">
          {state === 1 ? <Dna size={20} className="text-purple-300" />
            : state === 2 ? <Sparkles size={20} className="text-violet-300" />
            : state === 3 ? <Flame size={20} className="text-orange-300" />
            : state === 4 ? <Trophy size={20} className="text-yellow-300" />
            : <Dna size={20} className="text-purple-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base leading-snug">{headline}</h3>
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-gray-500 hover:text-gray-300 mt-0.5">
          <X size={16} />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-stretch border-t border-purple-800/40 border-b border-purple-800/40 divide-x divide-purple-800/40">
        {/* Weekly Rank */}
        <div className="flex-1 py-3 text-center">
          <p className="text-[10px] text-purple-400 uppercase tracking-wide font-medium">Weekly Rank</p>
          {isLocked && rankData.rank == null
            ? <Lock size={14} className="text-purple-600 mx-auto mt-1.5" />
            : <p className="text-white font-bold text-lg leading-tight">{rankVal}</p>
          }
          <p className="text-[10px] text-purple-400/70 leading-tight">{isLocked && rankData.rank == null ? 'Play to unlock' : rankSub}</p>
        </div>
        {/* Hot Streak */}
        <div className="flex-1 py-3 text-center">
          <p className="text-[10px] text-purple-400 uppercase tracking-wide font-medium">Hot Streak</p>
          <p className="text-white font-bold text-lg leading-tight">{streakVal}</p>
          <p className="text-[10px] text-purple-400/70 leading-tight">{streakSub}</p>
        </div>
        {/* Percentile */}
        <div className="flex-1 py-3 text-center">
          <p className="text-[10px] text-purple-400 uppercase tracking-wide font-medium">Percentile</p>
          {isLocked && rankData.percentile == null
            ? <Lock size={14} className="text-purple-600 mx-auto mt-1.5" />
            : <p className="text-white font-bold text-lg leading-tight">{percentileVal}</p>
          }
          <p className="text-[10px] text-purple-400/70 leading-tight">{isLocked && rankData.percentile == null ? 'Play to unlock' : percentileSub}</p>
        </div>
      </div>

      {/* Strongest categories */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] text-purple-400 uppercase tracking-widest font-medium mb-2">
          {isLocked ? 'Taste areas' : 'Strongest categories'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {showGenres.map((cat: string, i: number) => (
            <span
              key={i}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center ${
                isLocked
                  ? 'border-purple-800/60 text-purple-500 bg-purple-950/40'
                  : 'border-purple-600/60 text-purple-200 bg-purple-900/40'
              }`}
            >
              {getCatIcon(cat)}{cat}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 pt-3 pb-4">
        <button
          onClick={onNavigate}
          className="w-full text-center text-purple-400 hover:text-purple-200 text-sm font-semibold transition-colors flex items-center justify-center gap-1"
        >
          {ctaLabel} <ChevronRight size={14} />
        </button>
        {state === 1 && (
          <button
            onClick={onNavigate}
            className="w-full text-center text-purple-600 hover:text-purple-400 text-xs mt-1.5 transition-colors"
          >
            Take the DNA quiz →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────
export function EntertainmentDNAStrip() {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { streak, dnaProfile, triviaStats, rankData } = useStripData();

  if (!user) return null;

  const state = getStripState(streak, dnaProfile, triviaStats);

  const handleNavigate = () => {
    setExpanded(false);
    setLocation(state >= 4 ? '/dna' : '/play');
  };

  return (
    <div className="mb-1">
      {expanded ? (
        <ExpandedCard
          state={state}
          streak={streak}
          dnaProfile={dnaProfile}
          triviaStats={triviaStats}
          rankData={rankData}
          onClose={() => setExpanded(false)}
          onNavigate={handleNavigate}
        />
      ) : (
        <CollapsedStrip
          state={state}
          streak={streak}
          dnaProfile={dnaProfile}
          onExpand={() => setExpanded(true)}
        />
      )}
    </div>
  );
}
