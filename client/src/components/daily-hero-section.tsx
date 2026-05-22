import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Link } from 'wouter';
import {
  Flame, CheckCircle, CheckCircle2, Circle, XCircle,
  Trophy, X, Loader2, Star, Users, Radio, Share2, Check,
  Film, Tv, Music, BookOpen, Mic2, Gamepad2,
  Zap, ArrowRight, Sparkles, MessageCircle, TrendingUp,
  ChevronRight, ChevronDown, Lock, Dna,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { APP_BASE } from '@/lib/share';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

type TriviaQuestion = {
  id: string;
  title: string;
  options: string[];
  correct_answer: string;
  category: string;
  points_reward: number;
};

type DailyCallData = {
  id: string;
  title: string;
  options: string[] | null;
  challenge_type: string;
  points_reward: number;
  status: string;
};

type PlayScore = { correct: number; total: number; totalPoints: number };


// Read user ID synchronously from Supabase's auth token so useState lazy inits are user-scoped
const getStoredUserId = (): string => {
  try {
    const raw = localStorage.getItem('sb-mahpgcogwpawvviapqza-auth-token');
    if (!raw) return 'anon';
    const parsed = JSON.parse(raw);
    return parsed?.user?.id ?? parsed?.[0]?.user?.id ?? 'anon';
  } catch { return 'anon'; }
};

const getLocalDateStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD Pacific Time

const getTodayPlayKey = (userId?: string) =>
  `todays-play-${getLocalDateStr()}-${userId ?? getStoredUserId()}`;

const getDailyCallKey = (userId?: string) =>
  `daily-call-fallback-${getLocalDateStr()}-${userId ?? getStoredUserId()}`;

// Truncate text to N words then "…"
function truncateWords(text: string, maxChars = 28): string {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + '…';
}

const CATEGORIES = [
  { label: 'FILM', Icon: Film },
  { label: 'TV', Icon: Tv },
  { label: 'MUSIC', Icon: Music },
  { label: 'BOOKS', Icon: BookOpen },
  { label: 'PODS', Icon: Mic2 },
  { label: 'GAMING', Icon: Gamepad2 },
] as const;

// ─────────────────────────────────────────────
// Share Score Card (screenshotable overlay)
// ─────────────────────────────────────────────
function ScoreShareCard({
  open,
  type,
  playScore,
  callAnswer,
  callQuestion,
  callOptions,
  callVoteBreakdown: callVoteBreakdownProp,
  callPoolId,
  streak,
  userId,
  answers,
  questions,
  username,
  dnaStats,
  rankData,
  triviaStats,
  socialProof,
  onClose,
}: {
  open: boolean;
  type: 'play' | 'call';
  playScore?: PlayScore | null;
  callAnswer?: string | null;
  callQuestion?: string | null;
  callOptions?: string[] | null;
  callVoteBreakdown?: Record<string, number> | null;
  callPoolId?: string | null;
  streak?: number | null;
  userId?: string;
  answers?: { correct: boolean; category?: string; picked?: string }[];
  questions?: { category?: string | null; title?: string | null; options?: string[] | null }[];
  username?: string | null;
  dnaStats?: { label: string | null; totalAnswered: number; topGenre: string | null; allGenres: string[] } | null;
  rankData?: { rank: number | null; total: number | null; beatenPct?: number } | null;
  triviaStats?: { accuracy: number | null; points: number | null } | null;
  socialProof?: number | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Live-fetch vote breakdown if prop is null (e.g. after a page reload)
  const [livevoteBreakdown, setLiveVoteBreakdown] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!open || type !== 'call' || !callPoolId || callVoteBreakdownProp != null) return;
    supabase
      .from('user_predictions')
      .select('prediction')
      .eq('pool_id', callPoolId)
      .limit(500)
      .then(({ data }) => {
        const votes = (data ?? []).filter((v: any) => v.prediction !== '__skip');
        if (!votes.length) return;
        const counts: Record<string, number> = {};
        for (const v of votes) { const k = v.prediction ?? ''; counts[k] = (counts[k] ?? 0) + 1; }
        const total = votes.length;
        const pcts: Record<string, number> = {};
        for (const [opt, cnt] of Object.entries(counts)) pcts[opt] = Math.round((cnt / total) * 100);
        setLiveVoteBreakdown(pcts);
      });
  }, [open, type, callPoolId, callVoteBreakdownProp]);

  const callVoteBreakdown = callVoteBreakdownProp ?? livevoteBreakdown;

  if (!open) return null;

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleShare = async () => {
    let text = '';
    if (type === 'play' && playScore) {
      text = `My entertainment score on Consumed Today's Play: ${playScore.correct}/${playScore.total} correct! Think you can beat me? ${APP_BASE}`;
    } else {
      text = `I just made my Daily Call on Consumed — join me! ${APP_BASE}`;
    }
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard!', description: 'Paste it anywhere to share.' });
      }
    } catch { /* cancelled */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex flex-col items-center px-5 pb-10" style={{ paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))' }}>

      <div className="relative w-full max-w-sm flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        {/* Close button — in normal flow so it's always below the status bar */}
        <button
          onClick={onClose}
          className="self-end w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-1"
        >
          <X size={15} className="text-white" />
        </button>

        {/* ══ Screenshotable card ══ */}
        <div className="rounded-3xl overflow-hidden shadow-2xl">

          {/* ── Purple gradient header ── */}
          <div
            className="px-5 pt-5 pb-4"
            style={{ background: 'linear-gradient(135deg,#12091F 0%,#1E0B4A 50%,#2D1B69 100%)' }}
          >
            <div className="flex items-start justify-between">
              {/* Logo */}
              <div>
                <img
                  src="/consumed-logo-white.png"
                  alt="Consumed"
                  className="h-7 w-auto mb-1 -ml-1"
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  {type === 'play' ? "Today's Play ✦" : "Daily Call ✦"}
                </p>
              </div>
              {/* Top-right: date + rank badge for call, just date for play */}
              <div className="text-right">
                <p className="text-[10px] font-semibold text-white/40 mb-1">{today}</p>
                {type === 'call' && rankData?.rank != null && (
                  <div
                    className="inline-flex flex-col items-center rounded-xl px-3 py-2"
                    style={{ background: 'rgba(124,58,237,0.22)', border: '1px solid rgba(124,58,237,0.45)' }}
                  >
                    {username && (
                      <p className="text-[7px] font-bold uppercase tracking-widest leading-none" style={{ color: 'rgba(255,255,255,0.45)' }}>{username} ranks</p>
                    )}
                    <p
                      className="font-black leading-none my-0.5"
                      style={{ fontSize: '22px', background: 'linear-gradient(135deg,#a78bfa 0%,#38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      #{rankData.rank}
                    </p>
                    <p className="text-[7px] font-bold uppercase tracking-widest leading-none" style={{ color: 'rgba(255,255,255,0.35)' }}>on Consumed</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-5 pt-5 pb-6" style={{ background: '#0D0A1F' }}>

            {type === 'play' && playScore ? (
              <>
                {/* ── Question text ── */}
                {questions?.[0]?.title && (
                  <p className="text-[23px] font-black italic leading-tight mb-4 text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {truncateWords(questions[0].title, 120)}
                  </p>
                )}

                {/* ── Big answer + Better Than box ── */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a89ee0' }}>
                      {answers?.[0]?.picked ? 'I SAID:' : 'SCORE:'}
                    </p>
                    {answers?.[0]?.picked ? (
                      <p className="text-[30px] font-black leading-tight text-white break-words" style={{ letterSpacing: '-0.02em' }}>
                        {answers[0].picked}.
                      </p>
                    ) : (
                      <p className="text-[38px] font-black leading-none text-white" style={{ letterSpacing: '-0.02em' }}>
                        {playScore.correct}/{playScore.total}
                      </p>
                    )}
                    {socialProof != null && (
                      <div
                        className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          Only {socialProof}% agreed with you
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Better than % glowing box */}
                  {(() => {
                    const topPct = rankData?.beatenPct != null
                      ? Math.round(rankData.beatenPct)
                      : rankData?.rank != null && rankData?.total != null && rankData.total > 0
                        ? Math.round((1 - rankData.rank / rankData.total) * 100)
                        : null;
                    if (topPct === null) return null;
                    return (
                      <div
                        className="rounded-2xl px-3 py-3 text-center shrink-0"
                        style={{
                          minWidth: 88,
                          background: '#1a1030',
                          border: '1px solid rgba(124,58,237,0.45)',
                          boxShadow: '0 0 22px rgba(124,58,237,0.28)',
                        }}
                      >
                        <p className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>BETTER THAN</p>
                        <p
                          className="text-[28px] font-black leading-none"
                          style={{ background: 'linear-gradient(135deg,#a78bfa 0%,#38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                        >
                          {topPct}%
                        </p>
                        <p className="text-[7px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>OF PLAYERS</p>
                        <p className="text-[11px] mt-1">👑</p>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Name header ── */}
                {username && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {username} is
                    </p>
                    <p
                      className="text-[22px] font-black leading-tight text-white"
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      {rankData?.rank != null ? `#${rankData.rank} on Consumed` : 'Playing on Consumed'}
                    </p>
                  </div>
                )}

                {/* ── 4-stat row ── */}
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  {[
                    {
                      icon: '🏆',
                      value: rankData?.rank != null ? `#${rankData.rank}` : '—',
                      label: 'RANK',
                      sub: 'THIS WEEK',
                    },
                    {
                      icon: '🔥',
                      value: `${streak ?? 0}`,
                      label: 'STREAK',
                      sub: (streak ?? 0) === 1 ? 'DAY' : 'DAYS',
                    },
                    {
                      icon: '🎯',
                      value: triviaStats?.accuracy != null ? `${Math.round(triviaStats.accuracy)}%` : `${playScore.total > 0 ? Math.round((playScore.correct / playScore.total) * 100) : 0}%`,
                      label: 'ACCURACY',
                      sub: 'THIS WEEK',
                    },
                    {
                      icon: '⭐',
                      value: triviaStats?.points != null
                        ? triviaStats.points >= 1000 ? `${(triviaStats.points / 1000).toFixed(1)}K` : String(triviaStats.points)
                        : playScore.totalPoints > 0 ? `+${playScore.totalPoints}` : '—',
                      label: 'TOTAL PTS',
                      sub: 'ALL TIME',
                    },
                  ].map(({ icon, value, label, sub }) => (
                    <div
                      key={label}
                      className="rounded-xl py-2.5 px-1 text-center"
                      style={{ background: '#1a1030', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-[11px]">{icon}</span>
                      <p className="text-[13px] font-black leading-none text-white mt-0.5">{value}</p>
                      <p className="text-[7px] font-bold uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                      <p className="text-[6px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>{sub}</p>
                    </div>
                  ))}
                </div>

                {/* ── Entertainment DNA chips ── */}
                {dnaStats && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Dna size={10} className="text-purple-400" />
                      <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Your Entertainment DNA
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const chips: { emoji: string; text: string }[] = [];
                        if (dnaStats.label) chips.push({ emoji: '🧬', text: dnaStats.label });
                        if (dnaStats.topGenre) {
                          const genreMap: Record<string, string> = {
                            Drama: 'Prestige Devotee', Thriller: 'Edge-of-Seat Viewer',
                            Comedy: 'Laughs Detector', Action: 'Action Addict',
                            Horror: 'Horror Hunter', 'Sci-Fi': 'Galaxy Brain',
                            Romance: 'Romance Radar', Crime: 'Crime Obsessive',
                            Animation: 'Cartoon Connoisseur', Documentary: 'Doc Devotee',
                            Music: 'Music Maven', Fantasy: 'World Builder',
                          };
                          chips.push({ emoji: '🎬', text: genreMap[dnaStats.topGenre] || `${dnaStats.topGenre} Fan` });
                        }
                        const acc = triviaStats?.accuracy ?? (playScore.total > 0 ? (playScore.correct / playScore.total) * 100 : null);
                        if (acc !== null) {
                          chips.push({ emoji: '🎯', text: acc >= 70 ? 'Trivia Sharp' : acc >= 50 ? 'Chaos Viewer' : 'Binge-Worthy Detector' });
                        }
                        return chips.slice(0, 3).map(c => (
                          <div
                            key={c.text}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{ background: '#1a1030', border: '1px solid rgba(124,58,237,0.35)' }}
                          >
                            <span className="text-[11px]">{c.emoji}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.text}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Spicy CTA ── */}
                <div
                  className="rounded-xl px-4 py-3.5 mb-4 text-center"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.18) 0%,rgba(56,189,248,0.08) 100%)', border: '1px solid rgba(124,58,237,0.3)' }}
                >
                  <p className="text-[15px] font-black text-white leading-tight">
                    {playScore.correct === playScore.total
                      ? `Perfect score. Think your friends can match you?`
                      : playScore.correct === 0
                        ? `Rough one. Can your squad do any better? 👀`
                        : `${playScore.correct}/${playScore.total} right — think your friends can beat you?`}
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Share and find out. 👀</p>
                </div>

                {/* ── Branding footer ── */}
                <div className="pt-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Everyone's playing. Where do you rank?
                  </p>
                  <p className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    @consumedapp · where entertainment gets played
                  </p>
                </div>
              </>
            ) : (
              /* Daily Call body — dark dramatic redesign */
              <>
                {/* Huge question — ALL CAPS */}
                {callQuestion && (
                  <p className="font-black leading-[1.0] mb-5 text-white" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '34px', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                    &ldquo;{truncateWords(callQuestion, 100)}&rdquo;
                  </p>
                )}

                {callAnswer && callAnswer !== '__skip' ? (
                  <>
                    {/* Big answer + Better Than box */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {username ? `${username} said:` : 'I said:'}
                        </p>
                        <p className="font-black leading-none text-white break-words" style={{ fontSize: '36px', letterSpacing: '-0.02em', lineHeight: 1.05, textTransform: 'uppercase' }}>
                          {callAnswer}.
                        </p>
                      </div>
                    </div>

                    {/* Social proof + rank card — always shown */}
                    {(() => {
                      const agreedPct = callVoteBreakdown && callAnswer ? (callVoteBreakdown[callAnswer] ?? null) : null;
                      const topPct = rankData?.beatenPct != null
                        ? Math.round(100 - rankData.beatenPct)
                        : rankData?.rank != null && rankData?.total != null && rankData.total > 0
                          ? Math.round((rankData.rank / rankData.total) * 100)
                          : null;
                      return (
                        <div
                          className="rounded-2xl flex items-center gap-4 px-4 py-4 mb-4"
                          style={{ background: 'rgba(237,233,254,0.1)', border: '1px solid rgba(167,139,250,0.25)' }}
                        >
                          <div className="flex-1 min-w-0">
                            {agreedPct !== null ? (
                              <>
                                <p className="text-[12px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                  Only {agreedPct}% agreed — but
                                </p>
                                {topPct !== null ? (
                                  <p className="font-black leading-tight text-white" style={{ fontSize: '20px' }}>
                                    {username || 'You'} is in the top {topPct}% 👑
                                  </p>
                                ) : (
                                  <p className="font-black leading-tight text-white" style={{ fontSize: '20px' }}>
                                    {username || 'Your'} take is locked in 🔥
                                  </p>
                                )}
                              </>
                            ) : topPct !== null ? (
                              <p className="font-black leading-tight text-white" style={{ fontSize: '20px' }}>
                                {username || 'You'} is in the top {topPct}% of players 👑
                              </p>
                            ) : (
                              <p className="font-black leading-tight text-white" style={{ fontSize: '20px' }}>
                                {username || 'Your'} take is locked in 🔥
                              </p>
                            )}
                          </div>
                          {topPct !== null && (
                            <div
                              className="rounded-xl px-4 py-3 text-center shrink-0"
                              style={{ background: '#2D1B69', minWidth: 84 }}
                            >
                              <p className="font-black leading-none text-white" style={{ fontSize: '34px' }}>{topPct}%</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>OF PLAYERS</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* "Start a fight" block */}
                    {(() => {
                      const seed = new Date().getDate() % 3;
                      let taunt: string;
                      if (callVoteBreakdown && callOptions && callOptions.length >= 2) {
                        const opponent = callOptions
                          .filter(o => o !== callAnswer)
                          .sort((a, b) => (callVoteBreakdown[b] ?? 0) - (callVoteBreakdown[a] ?? 0))[0];
                        const oppPct = opponent ? (callVoteBreakdown[opponent] ?? 0) : 0;
                        const taunts = [
                          opponent && oppPct > 0
                            ? `${oppPct}% went with "${opponent}" — are they onto something or just wrong?`
                            : `Not everyone sees it your way. Think you can change their minds?`,
                          `Most people picked something else. Think they're missing the point? Tell them.`,
                          opponent
                            ? `"${opponent}" is what the crowd went with. ${oppPct}% of takes can't all be right… can they?`
                            : `The crowd went a different way. Think you're the smart one here?`,
                        ];
                        taunt = taunts[seed];
                      } else {
                        taunt = [
                          `Not everyone will agree with you here. Ready to defend your take?`,
                          `Bold call. Think you can convince the skeptics?`,
                          `Plenty of people see this differently — think you're right?`,
                        ][seed];
                      }
                      return (
                        <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#1a1030', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a89ee0' }}>💬 Start a fight</p>
                          <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>{taunt}</p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  /* Skipped — show provocative Start a Fight block */
                  <div className="rounded-xl px-4 py-4 mb-4" style={{ background: '#1a1030', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#a89ee0' }}>💬 Start a fight</p>
                    {(() => {
                      if (callVoteBreakdown && callOptions && callOptions.length >= 2) {
                        const top = [...callOptions].sort((a, b) => (callVoteBreakdown[b] ?? 0) - (callVoteBreakdown[a] ?? 0))[0];
                        const topPct = top ? Math.round(callVoteBreakdown[top] ?? 0) : null;
                        if (top && topPct) {
                          return <p className="text-[14px] font-bold leading-snug text-white">{topPct}% went with &ldquo;{top}&rdquo; — are they right or are they all wrong?</p>;
                        }
                      }
                      return <p className="text-[14px] font-bold leading-snug text-white">The crowd has spoken. Think they got it right? Share and settle it.</p>;
                    })()}
                    <p className="text-[11px] mt-2 italic" style={{ color: 'rgba(255,255,255,0.35)' }}>You sat this one out — but your friends didn&apos;t.</p>
                  </div>
                )}

                {/* Username label above stats */}
                {username && (
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {username}&apos;s stats
                  </p>
                )}

                {/* 4-stat row */}
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  {[
                    {
                      icon: '🏆',
                      value: rankData?.rank != null ? `#${rankData.rank}` : '—',
                      label: 'RANK',
                      sub: 'THIS WEEK',
                    },
                    {
                      icon: '🔥',
                      value: `${streak ?? 0}`,
                      label: 'STREAK',
                      sub: (streak ?? 0) === 1 ? 'DAY' : 'DAYS',
                    },
                    {
                      icon: '🎯',
                      value: triviaStats?.accuracy != null ? `${Math.round(triviaStats.accuracy)}%` : '—',
                      label: 'ACCURACY',
                      sub: 'THIS WEEK',
                    },
                    {
                      icon: '⭐',
                      value: triviaStats?.points != null
                        ? triviaStats.points >= 1000 ? `${(triviaStats.points / 1000).toFixed(1)}K` : String(triviaStats.points)
                        : '—',
                      label: 'TOTAL PTS',
                      sub: 'ALL TIME',
                    },
                  ].map(({ icon, value, label, sub }) => (
                    <div
                      key={label}
                      className="rounded-xl py-2.5 px-1 text-center"
                      style={{ background: '#1a1030', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-[11px]">{icon}</span>
                      <p className="text-[13px] font-black leading-none text-white mt-0.5">{value}</p>
                      <p className="text-[7px] font-bold uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                      <p className="text-[6px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>{sub}</p>
                    </div>
                  ))}
                </div>

                {/* DNA chips */}
                {dnaStats && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Dna size={10} className="text-purple-400" />
                      <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Your Entertainment DNA
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const chips: { emoji: string; text: string }[] = [];
                        if (dnaStats.label) chips.push({ emoji: '🧬', text: dnaStats.label });
                        if (dnaStats.topGenre) {
                          const genreMap: Record<string, string> = {
                            Drama: 'Prestige Devotee', Thriller: 'Edge-of-Seat Viewer',
                            Comedy: 'Laughs Detector', Action: 'Action Addict',
                            Horror: 'Horror Hunter', 'Sci-Fi': 'Galaxy Brain',
                            Romance: 'Romance Radar', Crime: 'Crime Obsessive',
                            Animation: 'Cartoon Connoisseur', Documentary: 'Doc Devotee',
                            Music: 'Music Maven', Fantasy: 'World Builder',
                          };
                          chips.push({ emoji: '🎬', text: genreMap[dnaStats.topGenre] || `${dnaStats.topGenre} Fan` });
                        }
                        if (triviaStats?.accuracy != null) {
                          chips.push({ emoji: '🎯', text: triviaStats.accuracy >= 70 ? 'Trivia Sharp' : 'Chaos Viewer' });
                        } else {
                          chips.push({ emoji: '🎯', text: 'Chaos Viewer' });
                        }
                        return chips.slice(0, 3).map(c => (
                          <div
                            key={c.text}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{ background: '#1a1030', border: '1px solid rgba(124,58,237,0.35)' }}
                          >
                            <span className="text-[11px]">{c.emoji}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.text}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Spicy CTA — only for non-skipped answers */}
                {callAnswer && callAnswer !== '__skip' && (() => {
                  const userPct = callVoteBreakdown ? (callVoteBreakdown[callAnswer] ?? null) : null;
                  const headline = userPct !== null
                    ? `${userPct}% of players said \u201c${callAnswer}.\u201d Where do your friends sit?`
                    : `You made your call. Where does everyone else stand?`;
                  return (
                    <div
                      className="rounded-xl px-4 py-3.5 mb-4 text-center"
                      style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.18) 0%,rgba(56,189,248,0.08) 100%)', border: '1px solid rgba(124,58,237,0.3)' }}
                    >
                      <p className="text-[15px] font-black text-white leading-tight">{headline}</p>
                      <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Share and start the debate. 🔥</p>
                    </div>
                  );
                })()}

                {/* Branding footer */}
                <div className="pt-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Everyone's playing. Where do you rank?
                  </p>
                  <p className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    @consumedapp · where entertainment gets played
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Share + Nudge buttons side by side */}
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }}
          >
            <Share2 size={17} />
            Share Score
          </button>
          <button
            onClick={() => {
              const appUrl = import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com';
              const msg = encodeURIComponent(`Come play today's Daily Call on Consumed 🎮 Where entertainment gets played — ${appUrl}`);
              window.open(`sms:?body=${msg}`, '_blank');
            }}
            className="flex-1 py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <MessageCircle size={17} />
            Nudge a Friend
          </button>
        </div>

        <p className="text-center text-[11px] text-white/30">
          Screenshot the card above to share on social
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={() => { onClose(); setLocation('/play/trivia'); }}
            className="w-full py-3 rounded-2xl font-semibold text-[13px] text-white flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <Trophy size={15} className="opacity-80" />
            Play More Trivia
          </button>
          <button
            onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openAddMedia')); }}
            className="w-full py-3 rounded-2xl font-semibold text-[13px] text-white flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <MessageCircle size={15} className="opacity-80" />
            Have a Take? Rate &amp; Review
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────
// After-game bottom sheet
// ─────────────────────────────────────────────
function AfterGameSheet({
  open,
  onClose,
  onShareScore,
  type,
}: {
  open: boolean;
  onClose: () => void;
  onShareScore: () => void;
  type: 'play' | 'call';
}) {
  const [, setLocation] = useLocation();
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
          <Trophy size={26} className="text-yellow-300" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 text-center mb-1">Nice work!</h3>
        <p className="text-sm text-gray-400 text-center mb-5">What do you want to do next?</p>

        {/* Share score — highlighted */}
        <button
          onClick={() => { onClose(); onShareScore(); }}
          className="w-full py-4 px-5 rounded-2xl font-bold text-[15px] flex items-center justify-between mb-3 shadow-md"
          style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)', color: '#fff' }}
        >
          <span>Share Your Score</span>
          <Share2 size={16} className="opacity-80" />
        </button>

        <button
          onClick={() => { onClose(); setLocation('/add'); }}
          className="w-full py-4 px-5 border border-gray-200 bg-gray-50 text-gray-800 rounded-2xl font-semibold text-[14px] flex items-center justify-between mb-3"
        >
          <span>Share a Take</span>
          <div className="flex items-center gap-1 text-gray-400">
            <Star size={13} fill="currentColor" />
            <ChevronRight size={14} />
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { onClose(); setLocation('/play'); }}
            className="py-4 px-4 bg-gray-50 border border-gray-200 rounded-2xl font-semibold text-[14px] text-gray-700 flex flex-col items-center gap-1.5 active:bg-gray-100"
          >
            <Zap size={20} className="text-purple-600" fill="currentColor" />
            Play More
          </button>
          <button
            onClick={() => { onClose(); setLocation('/play/predictions'); }}
            className="py-4 px-4 bg-gray-50 border border-gray-200 rounded-2xl font-semibold text-[14px] text-gray-700 flex flex-col items-center gap-1.5 active:bg-gray-100"
          >
            <Radio size={20} className="text-blue-500" />
            Call More
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────
// Today's Play — 3-question trivia game overlay
// ─────────────────────────────────────────────
function TodaysPlayGame({
  questions,
  streak,
  username,
  onComplete,
  onClose,
  onShare,
}: {
  questions: TriviaQuestion[];
  streak?: number | null;
  username?: string | null;
  onComplete: (score: PlayScore) => void;
  onClose: () => void;
  onShare: (answers: { correct: boolean; category?: string; picked?: string }[], socialProof?: number | null) => void;
}) {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'result' | 'done'>('playing');
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ correct: boolean; points: number; category?: string; picked?: string }[]>([]);
  const [socialProof, setSocialProof] = useState<number | null>(null);
  const [doneScore, setDoneScore] = useState<PlayScore | null>(null);

  const q = questions[qIndex];

  const handleConfirm = async () => {
    if (!selected || phase !== 'playing') return;
    const isCorrect = selected === q.correct_answer;
    const points = isCorrect ? q.points_reward : 0;

    setSocialProof(null);

    // Record answer in user_predictions so the leaderboard and carousel both see it.
    // Fire-and-forget — only inserts on first answer (unique constraint on user_id+pool_id).
    if (session?.user?.id) {
      supabase
        .from('user_predictions')
        .insert({
          user_id: session.user.id,
          pool_id: q.id,
          prediction: selected,
          points_earned: points,
        })
        .then(({ error }) => {
          // Only credit points when it's a new answer (not a duplicate)
          if (!error && points > 0) {
            supabase.rpc('increment_trivia_points', {
              uid: session.user.id,
              pts: points,
            }).catch(() => {});
          }
          // Bust the carousel cache so answered pools are filtered on next load
          queryClient.invalidateQueries({ queryKey: ['trivia-carousel'] });
        })
        .catch(() => {});
    }

    try {
      const { data: votes } = await supabase
        .from('user_predictions')
        .select('prediction')
        .eq('pool_id', q.id)
        .limit(200);

      if (votes && votes.length > 0) {
        const correct = votes.filter((v: any) => v.prediction === q.correct_answer).length;
        setSocialProof(Math.round((correct / votes.length) * 100));
      } else {
        setSocialProof(Math.floor(Math.random() * 25) + 52);
      }
    } catch {
      setSocialProof(Math.floor(Math.random() * 25) + 52);
    }

    setAnswers(prev => [...prev, { correct: isCorrect, points, category: q.category || 'General', picked: selected ?? undefined }]);
    setPhase('result');
  };

  const handleNext = () => {
    if (qIndex < questions.length - 1) {
      setQIndex(i => i + 1);
      setSelected(null);
      setPhase('playing');
      setSocialProof(null);
    } else {
      // Build score from current answers + the last answer that was just added
      const allAnswers = answers; // state updated by handleConfirm before this runs
      const score: PlayScore = {
        correct: allAnswers.filter(a => a.correct).length,
        total: questions.length,
        totalPoints: allAnswers.reduce((s, a) => s + a.points, 0),
      };
      localStorage.setItem(getTodayPlayKey(session?.user?.id), JSON.stringify({
        completed: true,
        date: getLocalDateStr(),
        score,
        answers: allAnswers.map(a => ({ correct: a.correct, category: a.category, picked: a.picked })),
      }));
      setDoneScore(score);
      onComplete(score); // update parent card immediately
      setPhase('done');

      // Update streak for Today's Play completion.
      // Store pending date BEFORE the call so a failure leaves a retry marker.
      const localDate = getLocalDateStr();
      const pendingKey = `pendingStreakDate_${session?.user?.id}`;
      localStorage.setItem(pendingKey, localDate);
      console.log('[streak] update_streak called, localDate:', localDate, 'userId:', session?.user?.id);
      (async () => {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'update_streak', localDate }),
          });
          const data = await res.json();
          console.log('[streak] update_streak response:', res.status, JSON.stringify(data));
          if (res.ok && typeof data.currentStreak === 'number') {
            localStorage.removeItem(pendingKey); // success — clear retry marker
            console.log('[streak] seeding cache with currentStreak:', data.currentStreak);
            queryClient.setQueryData(['play-streak-hero', session?.user?.id], data.currentStreak);
          } else {
            console.warn('[streak] update_streak non-OK response — retry marker kept:', data);
          }
        } catch (e) {
          console.warn('[streak] update_streak failed — retry marker kept for next load:', e);
        } finally {
          queryClient.invalidateQueries({ queryKey: ['play-streak-hero'] });
        }
      })();
    }
  };

  const PURPLE_GRADIENT = 'linear-gradient(160deg,#312e81 0%,#1d4ed8 35%,#0284c7 65%,#0e7490 100%)';

  // ── Done state: full-screen scrollable overlay (separate from bottom sheet) ──
  if (phase === 'done' && doneScore) {
    return createPortal(
      (() => {
              const ratio = doneScore.correct / doneScore.total;
              const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

              // Day-based seed so lines rotate daily but stay consistent within a day
              const daySeed = parseInt(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, ''), 10) % 97;
              const pick = <T,>(arr: T[]): T => arr[daySeed % arr.length];

              const CAT_EMOJI: Record<string, string> = {
                Movies: '🎬', Movie: '🎬',
                TV: '📺', Television: '📺',
                Music: '🎵',
                Books: '📚', Book: '📚',
                'Pop Culture': '⭐',
                Sports: '🏆',
                Games: '🎮', Gaming: '🎮',
                Podcasts: '🎙️', Podcast: '🎙️',
              };

              // Category data from actual answers
              const correctCats = questions.filter((_, i) => answers[i]?.correct).map(q => q.category).filter(Boolean);
              const wrongCats = questions.filter((_, i) => answers[i] && !answers[i].correct).map(q => q.category).filter(Boolean);
              const strongCat = correctCats[0] ?? null;
              const weakCat = wrongCats[0] ?? null;

              const perfectOptions: [string, string][] = [
                ['Nailed it.', 'Added to your Entertainment DNA.'],
                ['You know your stuff.', 'Your Entertainment DNA just got stronger.'],
                ['Got it. Clean answer.', 'Added to your Entertainment DNA.'],
                ['Correct. Elite taste confirmed.', 'Your Entertainment DNA just got stronger.'],
              ];
              const goodOptions: [string, string][] = [
                ['Nailed it.', 'Keep building your Entertainment DNA.'],
                ['Got it.', 'Your Entertainment DNA just got stronger.'],
              ];
              const weakOptions: [string, string][] = [
                ['Not this time.', 'Come back tomorrow and get it.'],
                ['Missed it \u2014 one question, one shot.', 'Every play builds your Entertainment DNA.'],
                ['It happens. Tomorrow\u2019s yours.', 'Every play builds your Entertainment DNA.'],
              ];

              const [headline, subhead] =
                doneScore.correct === doneScore.total ? pick(perfectOptions)
                : ratio >= 0.5 ? pick(goodOptions)
                : pick(weakOptions);

              const insightLine = (() => {
                if (doneScore.correct === doneScore.total) return pick([
                  'Strong across everything. No weak spots today.',
                  'Balanced taste. That\u2019s rare.',
                  'Perfect across the board. Most people don\u2019t pull that off.',
                ]);
                if (strongCat && weakCat && strongCat !== weakCat)
                  return `Strong in ${strongCat}. ${weakCat} got you.`;
                if (weakCat) return `${weakCat} tripped you up \u2014 worth a revisit.`;
                return null;
              })();

              return (
            <div className="fixed inset-0 z-[190] bg-black/65 backdrop-blur-md overflow-y-auto">
              <div className="min-h-full flex flex-col items-center px-4 pt-4 pb-24">
                {/* Floating close button */}
                <div className="w-full flex justify-end mb-2">
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X size={15} className="text-white" />
                  </button>
                </div>
                {/* Card + buttons */}
                <div className="flex flex-col w-full">
              {/* Screenshotable card */}
              <div className="rounded-3xl overflow-hidden shadow-2xl w-full mb-4">
                {/* Blue gradient header */}
                <div
                  className="px-5 pt-5 pb-4"
                  style={{ background: 'linear-gradient(135deg,#1e40af 0%,#2563eb 35%,#0ea5e9 75%,#38bdf8 100%)' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <img src="/consumed-logo-white.png" alt="Consumed" className="h-7 w-auto mb-1 -ml-1" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Today's Play</p>
                    </div>
                    <p className="text-[11px] font-semibold text-white/50 mt-1">{today}</p>
                  </div>
                </div>

                {/* White body */}
                <div className="bg-white px-6 pt-7 pb-8">
                  <div className="flex flex-col items-center text-center gap-4">
                    {/* Display name */}
                    {username && (
                      <p className="text-[22px] font-bold uppercase tracking-widest text-gray-400">{username}</p>
                    )}

                    {/* Headline block */}
                    <div>
                      <h2 className="text-[15px] font-black text-gray-900 leading-snug mb-1">{headline}</h2>
                      <p className="text-[11px] font-semibold text-gray-500 leading-snug">{subhead}</p>
                    </div>

                    {/* Score — single-question: show ✓/✗ instead of X/1 */}
                    {doneScore.total === 1 ? (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
                        style={{ background: doneScore.correct === 1 ? '#dcfce7' : '#fee2e2' }}
                      >
                        {doneScore.correct === 1
                          ? <CheckCircle size={34} className="text-green-600" />
                          : <XCircle size={34} className="text-red-500" />}
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[44px] font-black leading-none text-gray-900">{doneScore.correct}</span>
                        <span className="text-[20px] font-bold text-gray-300 leading-none">/{doneScore.total}</span>
                      </div>
                    )}

                    {/* Per-question category pills */}
                    <div className="flex gap-2 flex-wrap justify-center">
                      {questions.map((q, i) => {
                        const correct = answers[i]?.correct;
                        const cat = q.category || 'General';
                        const emoji = CAT_EMOJI[cat] || '🎯';
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{
                              background: correct ? '#f0fdf4' : '#fff1f2',
                              border: `1px solid ${correct ? '#bbf7d0' : '#fecdd3'}`,
                            }}
                          >
                            <span className="text-[13px] leading-none">{emoji}</span>
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide"
                              style={{ color: correct ? '#15803d' : '#dc2626' }}
                            >
                              {cat}
                            </span>
                            {correct
                              ? <CheckCircle size={11} className="text-green-600" />
                              : <XCircle size={11} className="text-red-500" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Insight line */}
                    {insightLine && (
                      <p className="text-[11px] font-medium text-gray-500 leading-snug">{insightLine}</p>
                    )}

                    {/* Divider */}
                    <div className="w-full h-px bg-gray-100" />

                    {/* Points + streak */}
                    <div className="flex items-center gap-2.5 text-[11px] text-gray-500 font-medium">
                      {doneScore.totalPoints > 0 && (
                        <div className="flex items-center gap-1">
                          <Zap size={11} className="text-purple-600" fill="currentColor" />
                          <span><span className="font-bold text-gray-900">+{doneScore.totalPoints} pts</span></span>
                        </div>
                      )}
                      {streak && streak > 0 && (
                        <>
                          {doneScore.totalPoints > 0 && <span className="text-gray-300">·</span>}
                          <div className="flex items-center gap-1">
                            <Flame size={11} className="text-orange-500 fill-orange-500" />
                            <span className="font-semibold text-gray-700">
                              {streak === 1 ? 'streak started' : `${streak}-day streak`}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* @consumedapp footer */}
                    <div className="pt-2 border-t border-gray-100 w-full text-center">
                      <p className="text-[11px] font-bold text-purple-600">@consumedapp</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">where entertainment gets played</p>
                    </div>

                    {/* Everyone's playing */}
                    <p className="text-[11px] font-semibold text-gray-400 leading-snug">Everyone's playing. Where do you rank?</p>
                  </div>
                </div>
              </div>

              {/* Share + Nudge buttons side by side */}
              <div className="flex gap-2">
                <button
                  onClick={() => { onClose(); onShare(answers, socialProof); }}
                  className="flex-1 py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
                  style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }}
                >
                  <Share2 size={17} />
                  Share Score
                </button>
                <button
                  onClick={() => {
                    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com';
                    const msg = encodeURIComponent(`Come play today's Daily Call on Consumed 🎮 Where entertainment gets played — ${appUrl}`);
                    window.open(`sms:?body=${msg}`, '_blank');
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  <MessageCircle size={17} />
                  Nudge a Friend
                </button>
              </div>

              <p className="text-center text-[11px] text-white/40 mt-2 mb-4">
                Screenshot the card above to share on social
              </p>

              {/* Keep Playing section */}
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2 mt-2">Keep Playing</p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => { onClose(); setLocation('/play/trivia'); }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-white/90 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <Zap size={15} className="opacity-80" fill="currentColor" />
                  More Trivia
                </button>
                <button
                  onClick={() => { onClose(); setLocation('/play/predictions'); }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-white/90 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <Radio size={15} className="opacity-80" />
                  Make a Prediction
                </button>
                <button
                  onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openAddMedia')); }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-white/90 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <MessageCircle size={15} className="opacity-80" />
                  Rate &amp; Review Something
                </button>
              </div>{/* end keep playing */}
                </div>{/* end flex flex-col w-full */}
              </div>{/* end min-h-full */}
            </div>
          );
        })(),
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full rounded-t-3xl flex flex-col" style={{ height: '92vh', background: '#fafafa' }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0 bg-gray-200" />
        <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-gray-100 shrink-0">
          <div className="w-9" />
          <h1 className="text-[15px] font-bold text-gray-900">Today's Play</h1>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
            {/* Question screen — Q1 expanded, Q2/Q3 collapsed below */}
            <div className="flex flex-col px-4 pt-5 pb-32">
              {/* Streak chip + motivational header */}
              <div className="flex flex-col items-center text-center mb-5">
                {streak && streak > 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 mb-2.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    <span className="text-[12px] font-bold text-orange-700">{streak}-Day Streak</span>
                  </div>
                ) : null}
                <p className="text-gray-600 text-[13px] leading-relaxed px-4">
                  {streak && streak > 0
                    ? `${streak}-day streak on the line — one question, lock it in.`
                    : 'One question. Answer it. See where you stand.'}
                </p>
              </div>

              {/* Question stack */}
              <div className="flex flex-col gap-3">
                {questions.map((qq, i) => {
                  const isActive = i === qIndex;
                  const isPast = i < qIndex;
                  const isFuture = i > qIndex;
                  const pastAnswer = answers[i];
                  const DIFF_MAP: Record<string, { text: string; label: string }> = {
                    easy:   { text: '#16a34a', label: 'Easy' },
                    medium: { text: '#d97706', label: 'Medium' },
                    hard:   { text: '#dc2626', label: 'Hard' },
                  };
                  const diff = DIFF_MAP[(qq as any).difficulty?.toLowerCase?.() ?? ''] ?? { text: '#9ca3af', label: (qq as any).difficulty ?? '' };

                  // ── Active card (expanded) ──
                  if (isActive) {
                    return (
                      <div
                        key={i}
                        className="rounded-2xl bg-white shadow-sm border border-gray-100"
                      >
                        <div className="p-5 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[11px] font-bold shadow-sm"
                                style={{ background: '#4c1d95' }}
                              >
                                {i + 1}
                              </div>
                              <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                                {qq.category}
                              </span>
                            </div>
                          </div>

                          <h2 className="text-[19px] font-bold text-gray-900 leading-snug">
                            {qq.title}
                          </h2>

                          <div className="flex flex-col gap-2.5">
                            {qq.options.map((option, idx) => {
                              const isSelected = selected === option;
                              const isCorrect = option === qq.correct_answer;
                              const showResult = phase === 'result';

                              let bg = '#f3f4f6';
                              let borderColor = 'transparent';
                              let textColor = '#374151';
                              let icon: React.ReactNode = null;

                              if (showResult) {
                                if (isCorrect) {
                                  bg = '#dcfce7'; borderColor = '#86efac'; textColor = '#15803d';
                                  icon = <CheckCircle size={18} className="text-green-600 shrink-0" />;
                                } else if (isSelected) {
                                  bg = '#fee2e2'; borderColor = '#fca5a5'; textColor = '#b91c1c';
                                  icon = <XCircle size={18} className="text-red-500 shrink-0" />;
                                } else {
                                  bg = '#f3f4f6'; textColor = '#9ca3af';
                                  icon = <Circle size={18} className="text-gray-300 shrink-0" />;
                                }
                              } else if (isSelected) {
                                bg = '#faf5ff'; borderColor = '#4c1d95'; textColor = '#4c1d95';
                                icon = <CheckCircle2 size={18} className="text-[#4c1d95] shrink-0" />;
                              } else {
                                icon = <Circle size={18} className="text-gray-300 shrink-0" />;
                              }

                              return (
                                <button
                                  key={idx}
                                  onClick={() => { if (phase === 'playing') setSelected(option); }}
                                  disabled={phase === 'result'}
                                  className="w-full py-4 px-5 rounded-2xl text-left text-[15px] flex items-center justify-between transition-all border-2"
                                  style={{ background: bg, borderColor, color: textColor }}
                                >
                                  <span className="font-semibold">{option}</span>
                                  {icon}
                                </button>
                              );
                            })}
                          </div>

                          {/* Social proof */}
                          {phase === 'result' && (
                            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50">
                              <Users size={13} className="text-gray-400" />
                              {socialProof !== null ? (
                                <p className="text-[13px] text-gray-600">
                                  <span className="font-bold text-gray-900">{socialProof}%</span> of players got this right
                                </p>
                              ) : (
                                <Loader2 size={13} className="animate-spin text-gray-400" />
                              )}
                            </div>
                          )}

                          {/* CTA */}
                          {phase === 'playing' ? (
                            <button
                              onClick={handleConfirm}
                              disabled={!selected}
                              className="w-full py-3.5 rounded-xl font-bold text-white text-base shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                              style={{ background: PURPLE_GRADIENT }}
                            >
                              Lock In Answer
                            </button>
                          ) : (
                            <button
                              onClick={handleNext}
                              className="w-full py-3.5 rounded-xl font-bold text-white text-base shadow-md active:scale-[0.98]"
                              style={{ background: PURPLE_GRADIENT }}
                            >
                              {qIndex < questions.length - 1 ? 'Next Question' : questions.length === 1 ? 'See the Answer' : 'See Your Score'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ── Past (completed) card — collapsed with check/X ──
                  if (isPast) {
                    const wasCorrect = pastAnswer?.correct;
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex shrink-0 items-center justify-center"
                          style={{ background: wasCorrect ? '#dcfce7' : '#fee2e2' }}
                        >
                          {wasCorrect
                            ? <CheckCircle size={16} className="text-green-600" />
                            : <XCircle size={16} className="text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                              {qq.category}
                            </span>
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: diff.text }}
                            >
                              {diff.label}
                            </span>
                          </div>
                          <p className="text-[13px] font-medium text-gray-500 truncate">
                            {qq.title}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // ── Future (locked) card — collapsed ──
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex shrink-0 items-center justify-center">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                            {qq.category}
                          </span>
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: diff.text }}
                          >
                            {diff.label}
                          </span>
                        </div>
                        <p className="text-[13px] font-medium text-gray-500 truncate">
                          {qq.title}
                        </p>
                      </div>
                      <ChevronDown className="w-5 h-5 text-gray-300" />
                    </div>
                  );
                })}
              </div>
            </div>
              </div>
            </div>
          </div>,
          document.body
        );
}

// ─────────────────────────────────────────────
// Daily Call prediction overlay
// ─────────────────────────────────────────────
function DailyCallOverlay({
  challenge,
  session,
  streak,
  username,
  onComplete,
  onShare,
  onClose,
}: {
  challenge: DailyCallData;
  session: any;
  streak?: number | null;
  username?: string | null;
  onComplete: (answer: string, breakdown: Record<string, number> | null) => void;
  onShare: (answer: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const BLUE_GRADIENT = 'linear-gradient(160deg,#1e40af 0%,#1d4ed8 45%,#1e3a8a 100%)';

  const handleSubmit = async (answerOverride?: string) => {
    const answer = answerOverride ?? selected;
    if (!answer || submitting) return;
    setSubmitting(true);
    try {
      const localDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      console.log('[streak] Daily Call submit called, challengeId:', challenge.id, 'localDate:', localDate, 'answer:', answer);
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'submit',
          challengeId: challenge.id,
          response: { answer },
          localDate,
        }),
      });
      const data = await resp.json();
      console.log('[streak] Daily Call submit response:', resp.status, JSON.stringify(data));
      if (data.error && !data.error.includes('Already')) throw new Error(data.error);
      localStorage.setItem(getDailyCallKey(session?.user?.id), JSON.stringify({ completed: true, result: { userAnswer: answer }, breakdown: null }));
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-response'] });
      if (data.run?.currentRun && typeof data.run.currentRun === 'number') {
        console.log('[streak] Daily Call seeding cache with currentRun:', data.run.currentRun);
        queryClient.setQueryData(['play-streak-hero', session?.user?.id], data.run.currentRun);
      }

      // Fetch vote breakdown — exclude __skip rows so poll data stays clean
      let breakdown: Record<string, number> | null = null;
      try {
        const { data: allVotes } = await supabase
          .from('user_predictions')
          .select('prediction')
          .eq('pool_id', challenge.id)
          .limit(500);
        const votes = (allVotes ?? []).filter(v => v.prediction !== '__skip');
        if (votes.length > 0) {
          const counts: Record<string, number> = {};
          for (const v of votes) {
            const key = v.prediction ?? '';
            counts[key] = (counts[key] ?? 0) + 1;
          }
          const total = votes.length;
          const pcts: Record<string, number> = {};
          for (const [opt, cnt] of Object.entries(counts)) {
            pcts[opt] = Math.round((cnt / total) * 100);
          }
          breakdown = pcts;
        }
      } catch { /* leave null */ }

      // Persist breakdown so share card can use it after a page reload
      try {
        const stored = localStorage.getItem(getDailyCallKey(session?.user?.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.breakdown = breakdown;
          localStorage.setItem(getDailyCallKey(session?.user?.id), JSON.stringify(parsed));
        }
      } catch { /* ignore */ }

      onComplete(answer, breakdown);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet — light theme */}
      <div
        className="relative w-full rounded-t-3xl flex flex-col"
        style={{ height: '92vh', background: '#fafafa' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0 bg-gray-200" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-gray-100 shrink-0">
          <div className="w-9" />
          <h1 className="text-[15px] font-bold text-gray-900">Today's Play</h1>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Question screen */}
          <div className="flex flex-col px-4 pt-5 pb-32">
            {/* Motivational header */}
            <div className="flex flex-col items-center text-center mb-5">
              <p className="text-gray-600 text-[13px] leading-relaxed px-4">
                Make your call before the day ends — see how the rest of Consumed votes.
              </p>
            </div>

              {/* Single question card */}
              <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full text-white flex items-center justify-center shadow-sm"
                        style={{ background: '#1e3a8a' }}
                      >
                        <MessageCircle size={12} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                        Today's Play
                      </span>
                    </div>
                    <div
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: '#dbeafe', color: '#1d4ed8' }}
                    >
                      Live
                    </div>
                  </div>

                  <h2 className="text-[19px] font-bold text-gray-900 leading-snug">
                    {challenge.title}
                  </h2>

                  <div className="flex flex-col gap-2.5">
                    {challenge.options?.map((option, idx) => {
                      const isSelected = selected === option;
                      const bg = isSelected ? '#eff6ff' : '#f3f4f6';
                      const borderColor = isSelected ? '#1e3a8a' : 'transparent';
                      const textColor = isSelected ? '#1e3a8a' : '#374151';
                      const icon = isSelected
                        ? <CheckCircle2 size={18} className="text-[#1e3a8a] shrink-0" />
                        : <Circle size={18} className="text-gray-300 shrink-0" />;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelected(option)}
                          disabled={submitting}
                          className="w-full py-4 px-5 rounded-2xl text-left text-[15px] flex items-center justify-between transition-all border-2"
                          style={{ background: bg, borderColor, color: textColor }}
                        >
                          <span className="font-semibold">{option}</span>
                          {icon}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleSubmit()}
                    disabled={!selected || submitting}
                    className="w-full py-3.5 rounded-xl font-bold text-white text-base shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
                    style={{ background: BLUE_GRADIENT }}
                  >
                    {submitting && <Loader2 size={15} className="animate-spin" />}
                    Lock In Your Call
                  </button>

                  {/* Quiet skip option — plain text, not a button */}
                  <button
                    onClick={() => handleSubmit('__skip')}
                    disabled={submitting}
                    className="w-full text-center text-[12px] text-gray-400 py-1 hover:text-gray-600 transition-colors disabled:opacity-40"
                  >
                    Not my thing / Not sure
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
    document.body
  );
}

// ─────────────────────────────────────────────
// Main export — renders both cards side by side
// ─────────────────────────────────────────────
export function DailyHeroSection() {
  const { user, session } = useAuth();

  // ── Today's Play state ──
  const [showPlayGame, setShowPlayGame] = useState(false);
  const [showPlayShare, setShowPlayShare] = useState(false);
  const [playSocialProof, setPlaySocialProof] = useState<number | null>(null);
  const [playAnswers, setPlayAnswers] = useState<{ correct: boolean; category?: string; picked?: string }[] | null>(() => {
    try {
      const s = localStorage.getItem(getTodayPlayKey());
      if (!s) return null;
      const d = JSON.parse(s);
      return d.completed && d.answers ? d.answers : null;
    } catch { return null; }
  });
  const [playScore, setPlayScore] = useState<PlayScore | null>(() => {
    try {
      const s = localStorage.getItem(getTodayPlayKey());
      if (!s) return null;
      const d = JSON.parse(s);
      if (d.completed) return d.score ?? null;
      return null;
    } catch { return null; }
  });
  const [playCompleted, setPlayCompleted] = useState(() => playScore !== null);

  // ── Daily Call state ──
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [showCallShare, setShowCallShare] = useState(false);
  const [callVoteBreakdown, setCallVoteBreakdown] = useState<Record<string, number> | null>(() => {
    try {
      const s = localStorage.getItem(getDailyCallKey());
      if (!s) return null;
      return JSON.parse(s).breakdown ?? null;
    } catch { return null; }
  });
  const [callAnswer, setCallAnswer] = useState<string | null>(() => {
    try {
      const s = localStorage.getItem(getDailyCallKey());
      if (!s) return null;
      return JSON.parse(s).result?.userAnswer ?? null;
    } catch { return null; }
  });
  const [callCompleted, setCallCompleted] = useState(() => {
    try {
      const s = localStorage.getItem(getDailyCallKey());
      return s ? JSON.parse(s).completed : false;
    } catch { return false; }
  });

  // ── DNA Moment (3rd hero card) state ──
  const [dnaHeroAnswered, setDnaHeroAnswered] = useState(false);
  const [dnaHeroAnswering, setDnaHeroAnswering] = useState(false);
  const [dnaHeroResult, setDnaHeroResult] = useState<{ optionAPercent: number; optionBPercent: number; total: number } | null>(null);

  // ── Swipe / deck navigation ──
  const [swipeIndex, setSwipeIndex] = useState(0); // 0 = Today's Play, 1 = Daily Call, 2 = DNA Moment
  const [showDnaInCarousel, setShowDnaInCarousel] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const wasDragRef = useRef(false); // true if pointer moved enough to count as a swipe, not a click
  const wheelCooldown = useRef(false); // debounce trackpad wheel swipes

  // Re-sync play/call state when the logged-in user changes (so switching accounts clears stale state)
  useEffect(() => {
    if (!user?.id) return;
    const today = getLocalDateStr();
    try {
      const ps = localStorage.getItem(getTodayPlayKey(user.id));
      if (ps) {
        const d = JSON.parse(ps);
        if (d.completed && d.date === today) {
          setPlayScore(d.score ?? null);
          setPlayAnswers(d.answers ?? null);
          setPlayCompleted(true);
        } else {
          setPlayScore(null); setPlayAnswers(null); setPlayCompleted(false);
        }
      } else {
        setPlayScore(null); setPlayAnswers(null); setPlayCompleted(false);
      }
    } catch { /* ignore */ }
    try {
      const cs = localStorage.getItem(getDailyCallKey(user.id));
      if (cs) {
        const d = JSON.parse(cs);
        setCallCompleted(d.completed ?? false);
        setCallAnswer(d.result?.userAnswer ?? null);
      } else {
        setCallCompleted(false); setCallAnswer(null);
      }
    } catch { /* ignore */ }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retry any pending streak update from a previous session that failed silently.
  // If Today's Play completed but the update_streak call failed (network blip, expired token, etc.),
  // we stored `pendingStreakDate` in localStorage. On next load we retry it once.
  useEffect(() => {
    if (!user?.id || !session?.access_token) return;
    const pendingKey = `pendingStreakDate_${user.id}`;
    const pendingDate = localStorage.getItem(pendingKey);
    if (!pendingDate) return;
    const today = getLocalDateStr();
    // Only retry if the pending date is in the past (today's pending means the current session handled it)
    if (pendingDate === today) return;
    console.log('[streak] retrying pending update for date:', pendingDate);
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'update_streak', localDate: pendingDate }),
        });
        const data = await res.json();
        if (res.ok && typeof data.currentStreak === 'number') {
          localStorage.removeItem(pendingKey);
          console.log('[streak] pending retry succeeded, streak:', data.currentStreak);
          queryClient.invalidateQueries({ queryKey: ['play-streak-hero'] });
        } else {
          console.warn('[streak] pending retry failed — will try again next load:', data);
        }
      } catch (e) {
        console.warn('[streak] pending retry error:', e);
      }
    })();
  }, [user?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-promote: play done → Daily Call; both done → DNA Moment
  useEffect(() => {
    if (playCompleted && callCompleted) setSwipeIndex(2);
    else if (playCompleted && !callCompleted) setSwipeIndex(1);
  }, [playCompleted, callCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch trivia questions ──
  const { data: questions = [] } = useQuery<TriviaQuestion[]>({
    queryKey: ['todays-play-questions'],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD Pacific Time

      // First: try to get today's scheduled set (featured_date = today)
      const { data: todayData } = await supabase
        .from('prediction_pools')
        .select('id, title, options, correct_answer, category, points_reward')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .eq('featured_date', today)
        .not('correct_answer', 'is', null)
        .not('options', 'is', null)
        .limit(1);

      const todaySet = (todayData || []).filter((q: any) => Array.isArray(q.options) && q.options.length > 1);

      // If we have a scheduled set for today, use it
      if (todaySet.length >= 1) {
        return todaySet.map((q: any) => ({
          id: q.id,
          title: q.title,
          options: q.options as string[],
          correct_answer: q.correct_answer as string,
          category: q.category || 'General',
          points_reward: q.points_reward || 10,
        }));
      }

      // Fallback: most recent trivia questions with no featured_date (legacy content)
      const { data, error } = await supabase
        .from('prediction_pools')
        .select('id, title, options, correct_answer, category, points_reward')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .is('featured_date', null)
        .not('correct_answer', 'is', null)
        .not('options', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data) return [];
      return data
        .filter((q: any) => Array.isArray(q.options) && q.options.length > 1)
        .map((q: any) => ({
          id: q.id,
          title: q.title,
          options: q.options as string[],
          correct_answer: q.correct_answer as string,
          category: q.category || 'General',
          points_reward: q.points_reward || 10,
        }));
    },
  });

  // ── Fetch daily call ──
  const { data: dailyCall } = useQuery<DailyCallData | null>({
    queryKey: ['daily-call-hero'],
    queryFn: async () => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'getToday',
          localDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
        }),
      });
      const data = await resp.json();
      return data.challenge ?? null;
    },
  });

  // ── Supabase fallback: verify Today's Play completion ──
  // login_streaks.play_completed_date is set by BOTH update_streak (trivia) and submit (Daily Call).
  // It's used as a cross-device fallback when localStorage is cleared. If RLS blocks the read,
  // this returns false and localStorage is the sole source of completion state.
  const { data: supabasePlayDone } = useQuery<boolean>({
    queryKey: ['daily-play-supabase-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const today = getLocalDateStr();
      const { data } = await supabase
        .from('login_streaks')
        .select('play_completed_date')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.play_completed_date === today;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (supabasePlayDone === undefined) return;
    const today = getLocalDateStr();
    if (supabasePlayDone === true && !playCompleted) {
      // DB confirms played — only trust this if localStorage ALSO has a valid entry for today.
      // Without local evidence we refuse to override: the DB row may be stale/contaminated
      // from the now-fixed multi-client auth bug, and blindly trusting it causes false
      // "completed" on every fresh page load for affected users.
      try {
        const stored = localStorage.getItem(getTodayPlayKey(user?.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.date === today) {
            setPlayCompleted(true);
          }
        }
        // No localStorage entry for today → skip DB override
      } catch { /* ignore */ }
    } else if (supabasePlayDone === false && playCompleted) {
      // DB says NOT played but local state says yes → verify localStorage
      try {
        const stored = localStorage.getItem(getTodayPlayKey(user?.id));
        if (!stored) {
          // No localStorage entry for this user → stale/wrong state, reset
          setPlayScore(null); setPlayAnswers(null); setPlayCompleted(false);
        } else {
          const parsed = JSON.parse(stored);
          if (parsed.date !== today) {
            // Stale localStorage entry from a different day → reset
            setPlayScore(null); setPlayAnswers(null); setPlayCompleted(false);
          }
          // If localStorage has today's date → trust it (user played this session,
          // streak update may still be in-flight)
        }
      } catch {
        setPlayScore(null); setPlayAnswers(null); setPlayCompleted(false);
      }
    }
  }, [supabasePlayDone, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase fallback: verify Daily Call completion ──
  const { data: supabaseCallData } = useQuery<{ done: boolean; answer: string | null }>({
    queryKey: ['daily-call-supabase-check', user?.id, dailyCall?.id],
    queryFn: async () => {
      if (!user?.id || !dailyCall?.id) return { done: false, answer: null };
      const { data } = await supabase
        .from('user_predictions')
        .select('prediction')
        .eq('user_id', user.id)
        .eq('pool_id', dailyCall.id)
        .limit(1)
        .maybeSingle();
      return data ? { done: true, answer: data.prediction ?? null } : { done: false, answer: null };
    },
    enabled: !!user?.id && !!dailyCall?.id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (supabaseCallData === undefined) return;
    const today = getLocalDateStr();
    if (supabaseCallData.done && !callCompleted) {
      // DB confirms answered — only trust this if localStorage ALSO has today's entry.
      // Same guard as Today's Play: avoids false "completed" from contaminated DB data.
      try {
        const stored = localStorage.getItem(getDailyCallKey(user?.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.date === today) {
            setCallCompleted(true);
            if (supabaseCallData.answer) setCallAnswer(supabaseCallData.answer);
          }
        }
        // No localStorage entry for today → skip DB override
      } catch { /* ignore */ }
    } else if (!supabaseCallData.done && callCompleted) {
      // DB says NOT answered but local state says yes → verify localStorage
      try {
        const stored = localStorage.getItem(getDailyCallKey(user?.id));
        if (!stored) {
          setCallCompleted(false); setCallAnswer(null);
        } else {
          const parsed = JSON.parse(stored);
          if (parsed.date !== today) {
            setCallCompleted(false); setCallAnswer(null);
          }
          // If localStorage has today's date → trust it (in-flight submission)
        }
      } catch {
        setCallCompleted(false); setCallAnswer(null);
      }
    }
  }, [supabaseCallData, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trivia player count for hero subtle text ──
  const triviaPoolIds = questions.map((q) => q.id);
  const { data: totalPlayers } = useQuery<number>({
    queryKey: ['daily-hero-trivia-players', triviaPoolIds],
    queryFn: async () => {
      if (triviaPoolIds.length === 0) return 0;
      const { data } = await supabase
        .from('user_predictions')
        .select('user_id')
        .in('pool_id', triviaPoolIds);
      const unique = new Set((data || []).map((r: any) => r.user_id));
      return unique.size;
    },
    enabled: triviaPoolIds.length > 0,
  });

  // ── DNA Moment for hero card ──
  const { data: heroDnaMoment } = useQuery<{ id: string; questionText: string; optionA: string; optionB: string } | null>({
    queryKey: ['hero-dna-moment', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: answered } = await supabase
        .from('dna_moment_responses')
        .select('moment_id')
        .eq('user_id', user.id);
      const answeredIds = new Set((answered || []).map((r: any) => r.moment_id));
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      let skipped: string[] = [];
      try { skipped = JSON.parse(localStorage.getItem(`dna-hero-skipped-${today}`) || '[]'); } catch {}
      const excluded = new Set([...answeredIds, ...skipped]);
      const { data: moments } = await supabase
        .from('dna_moments')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      const available = (moments || []).filter((m: any) => !excluded.has(m.id));
      if (!available.length) return null;
      const m = available[0];
      return { id: m.id, questionText: m.question_text, optionA: m.option_a, optionB: m.option_b };
    },
    enabled: !!user?.id,
  });

  // ── Streak ──
  const { data: streak } = useQuery<number | null>({
    queryKey: ['play-streak-hero', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('login_streaks')
        .select('current_streak')
        .eq('user_id', user.id)
        .single();
      console.log('[streak] DB query result:', data?.current_streak, 'error:', error?.message);
      return data?.current_streak ?? null;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ── Username (for the score card) ──
  const { data: username } = useQuery<string | null>({
    queryKey: ['play-username-hero', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('users')
        .select('user_name, display_name')
        .eq('id', user.id)
        .single();
      return data?.display_name || data?.user_name || null;
    },
    enabled: !!user?.id,
  });

  // ── DNA profile + answered count (for scorecard) ──
  const { data: dnaStats } = useQuery<{ label: string | null; totalAnswered: number; topGenre: string | null; allGenres: string[] }>({
    queryKey: ['hero-dna-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { label: null, totalAnswered: 0, topGenre: null, allGenres: [] };
      const [profileRes, countRes] = await Promise.all([
        supabase.from('dna_profiles').select('label, favorite_genres').eq('user_id', user.id).maybeSingle(),
        supabase.from('dna_moment_responses').select('moment_id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      const genres: string[] = Array.isArray(profileRes.data?.favorite_genres) ? profileRes.data.favorite_genres : [];
      return {
        label: profileRes.data?.label ?? null,
        totalAnswered: countRes.count ?? 0,
        topGenre: genres[0] ?? null,
        allGenres: genres.slice(0, 3),
      };
    },
    enabled: !!user?.id,
  });

  // ── Trivia accuracy + points (for scorecard) ──
  const { data: triviaStats } = useQuery<{ accuracy: number | null; points: number | null }>({
    queryKey: ['hero-trivia-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { accuracy: null, points: null };
      const [poolRes, pointsRes] = await Promise.all([
        supabase.from('prediction_pools').select('id').eq('type', 'trivia'),
        supabase.from('user_points').select('all_time').eq('user_id', user.id).maybeSingle(),
      ]);
      const ids = (poolRes.data ?? []).map((p: any) => p.id);
      let accuracy: number | null = null;
      if (ids.length > 0) {
        const { data: preds } = await supabase
          .from('user_predictions')
          .select('points_earned')
          .eq('user_id', user.id)
          .in('pool_id', ids);
        if (preds && preds.length > 0) {
          const correct = preds.filter((p: any) => p.points_earned > 0).length;
          accuracy = Math.round((correct / preds.length) * 100);
        }
      }
      return { accuracy, points: pointsRes.data?.all_time ?? null };
    },
    enabled: !!user?.id,
    staleTime: 120000,
  });

  // ── Trivia rank (for scorecard) ──
  const { data: rankData } = useQuery<{ rank: number | null; total: number | null; beatenPct?: number }>({
    queryKey: ['hero-rank-data', user?.id],
    queryFn: async () => {
      if (!user?.id || !session?.access_token) return { rank: null, total: null };
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-leaderboards?category=trivia&scope=global`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (!res.ok) return { rank: null, total: null };
        const data = await res.json();
        const entries: any[] = data?.categories?.trivia ?? [];
        if (!entries.length) return { rank: null, total: null };
        const myEntry = entries.find((e: any) => e.user_id === user.id);
        if (!myEntry) return { rank: null, total: entries.length };
        const rank = myEntry.rank;
        const total = entries.length;
        const beatenPct = Math.round(((total - rank) / total) * 100);
        return { rank, total, beatenPct };
      } catch {
        return { rank: null, total: null };
      }
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: 300000,
  });

  const readyQuestions = questions.slice(0, 1);
  // isTriviaDay: true when today's featured content is trivia (or nothing is scheduled yet)
  const isTriviaDay = !dailyCall || dailyCall.challenge_type === 'trivia';
  const isOpinionDay = !!dailyCall && dailyCall.challenge_type !== 'trivia';
  const hasTodaysPlay = readyQuestions.length >= 1 || isOpinionDay;
  const hasDailyCall = !!dailyCall && (dailyCall.options?.length ?? 0) > 0;

  // First question preview (truncated)
  const firstQPreview = readyQuestions[0]?.title
    ? truncateWords(readyQuestions[0].title, 30)
    : 'Think you know your stuff?';

  // Daily call preview (truncated)
  const callPreview = dailyCall?.title
    ? truncateWords(dailyCall.title, 32)
    : 'Loading today\'s call…';

  // Today's Play is "done" when the relevant type is completed
  const bothCompleted = (isTriviaDay ? playCompleted : callCompleted) && !showDnaInCarousel;

  return (
    <>
      {/* ══ POST-GAME: Mini badge pair (both done) ══ */}
      {bothCompleted ? (
        <div className="flex flex-col gap-2">
          {/* TODAY'S PLAY — completed mini card */}
          <button
            onClick={() => isTriviaDay ? setShowPlayShare(true) : setShowCallShare(true)}
            className="w-full rounded-xl px-3 py-3 flex items-center justify-between gap-3 text-left"
            style={{
              background: 'linear-gradient(150deg,#312e81 0%,#1e3a8a 40%,#0369a1 100%)',
              border: '1px solid rgba(29,78,216,0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-300/70">Today's Play</span>
                <div className="flex items-end gap-1.5 mt-0.5">
                  {isTriviaDay ? (
                    <p className="text-white text-[20px] font-black leading-none">{playScore?.correct ?? '–'}<span className="text-white/30 text-[13px] font-bold">/{playScore?.total ?? 3}</span></p>
                  ) : (
                    <p className="text-white/90 text-[14px] font-bold leading-snug line-clamp-1">
                      {callAnswer === '__skip' ? 'Skipped — still counts!' : (callAnswer ?? 'Done')}
                    </p>
                  )}
                  {streak && streak > 0 ? (
                    <span className="flex items-center gap-0.5 text-orange-400 text-[11px] font-bold leading-none mb-0.5">
                      <Flame size={11} fill="currentColor" />
                      {streak}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-white text-[11px] font-semibold border border-white/10">
              <Share2 size={10} />
              Share
            </span>
          </button>
        </div>
      ) : (
        /* ══ PRE-GAME: Deck-layered cards — front + back peek, swap when one is done ══ */
        (() => {
          const frontPosClass = "relative w-full rounded-2xl p-5 flex flex-col justify-between min-h-[210px] text-left";
          const backPosClass  = "absolute top-0 left-0 right-0 rounded-2xl p-4 flex flex-col justify-between min-h-[210px] text-left";

          const clampedDrag = isDragging ? Math.max(-90, Math.min(90, dragOffset * 0.45)) : 0;
          const frontPosStyle = {
            transform: clampedDrag !== 0 ? `translateX(${clampedDrag}px)` : 'none',
            transformOrigin: 'top right' as const,
            zIndex: 10,
            boxShadow: '0 14px 36px rgba(0,0,0,0.7)',
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          };
          const backPosStyle = {
            transform: 'translate(6px, 28px) rotate(2.5deg)',
            transformOrigin: 'top left' as const,
            zIndex: 0,
            boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
          };

          const todaysPlayCard = (front: boolean) => (
            <button
              key="play"
              type="button"
              onClick={() => {
                if (isTriviaDay) {
                  if (playCompleted) setShowPlayShare(true);
                  else if (hasTodaysPlay) setShowPlayGame(true);
                } else {
                  if (callCompleted) setShowCallShare(true);
                  else if (hasDailyCall) setShowCallOverlay(true);
                }
              }}
              className={front ? frontPosClass : backPosClass}
              style={{
                background: 'linear-gradient(160deg,#312e81 0%,#1d4ed8 35%,#0284c7 65%,#0e7490 100%)',
                ...(front ? frontPosStyle : backPosStyle),
              }}
            >
              <div className={`flex items-start justify-between ${front ? 'mb-4' : ''}`}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Gamepad2 size={front ? 15 : 13} className="text-cyan-200" />
                    <span className={`${front ? 'text-[13px]' : 'text-[9px]'} font-bold uppercase tracking-[0.16em] text-cyan-100/90`}>
                      Today's Play
                    </span>
                  </div>
                  {front && (
                    <p className="text-[12px] text-white/55 font-medium ml-0.5">
                      {isOpinionDay ? 'Cast your call on today\'s question' : 'Start here → Test your entertainment instincts'}
                    </p>
                  )}
                </div>
                {(isTriviaDay ? playCompleted : callCompleted) ? (
                  <span className="flex items-center gap-1 bg-green-400/15 rounded-full px-1.5 py-0.5 border border-green-400/30">
                    <Check size={9} className="text-green-300" strokeWidth={3} />
                    <span className="text-[8px] font-bold text-green-200">DONE</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {front && streak && streak > 0 && (
                      <span className="flex items-center gap-1 bg-orange-400/20 rounded-full px-1.5 py-0.5 border border-orange-400/30">
                        <Flame size={8} className="text-orange-300" fill="currentColor" />
                        <span className="text-[8px] font-bold text-orange-200">{streak}-Day Streak</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" style={{ animation: 'pulse 2s infinite' }} />
                      <span className="text-[8px] font-bold text-white/80">LIVE</span>
                    </span>
                  </div>
                )}
              </div>

              <div className={`flex-1 flex flex-col justify-center ${front ? 'py-2' : 'pt-3 pb-2'}`}>
                {isTriviaDay && playCompleted && playScore ? (
                  <div>
                    <p className={`${front ? 'text-[28px]' : 'text-[22px]'} font-black text-white leading-none`}>
                      {playScore.correct}
                      <span className={`text-white/30 ${front ? 'text-[18px]' : 'text-[14px]'} font-bold`}> / {playScore.total}</span>
                    </p>
                    <p className={`${front ? 'text-[10px]' : 'text-[9px]'} text-white/40 uppercase tracking-wider font-semibold mt-1`}>correct</p>
                  </div>
                ) : (!isTriviaDay && callCompleted && callAnswer) ? (
                  <>
                    <p className={`${front ? 'text-[10px]' : 'text-[9px]'} text-white/40 uppercase tracking-wider font-semibold mb-1`}>Your Call</p>
                    <p className={`text-white/90 ${front ? 'text-xl font-bold' : 'text-[13px] font-semibold'} leading-snug line-clamp-3`}>{callAnswer}</p>
                  </>
                ) : (
                  <p className={`text-white ${front ? 'text-xl' : 'text-[13px]'} font-bold leading-tight drop-shadow-sm line-clamp-3`}>
                    {isOpinionDay ? callPreview : firstQPreview}
                  </p>
                )}
              </div>

              <div className={`flex items-center justify-between ${front ? 'mt-4' : ''}`}>
                <div className="flex items-center gap-1.5">
                  {front && (
                    <span className="flex items-center gap-1 bg-purple-400/20 rounded-full px-1.5 py-0.5 border border-purple-400/30">
                      <Sparkles size={8} className="text-purple-200" />
                      <span className="text-[8px] font-bold text-purple-100">+{isOpinionDay ? (dailyCall?.points_reward ?? 10) : readyQuestions.length * 10} pts</span>
                    </span>
                  )}
                  <span className={`${front ? 'text-xs' : 'text-[10px]'} text-purple-200/60 font-medium`}>
                    1 question
                  </span>
                </div>
                {front ? (
                  <span className="bg-white text-purple-950 text-sm font-bold px-6 py-2.5 rounded-full shadow-lg flex items-center gap-1.5">
                    {isTriviaDay ? (playCompleted ? 'Share' : 'Play') : (callCompleted ? 'Share' : 'Weigh In')}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="bg-white/95 text-purple-900 text-[11px] font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1">
                    {isTriviaDay ? (playCompleted ? 'Share' : 'Play') : (callCompleted ? 'Share' : 'Weigh In')}
                    <ArrowRight size={12} strokeWidth={2.5} />
                  </span>
                )}
              </div>
            </button>
          );

          const dailyCallCard = (front: boolean) => (
            <button
              key="call"
              type="button"
              onClick={() => {
                if (callCompleted) setShowCallShare(true);
                else if (hasDailyCall) setShowCallOverlay(true);
              }}
              className={front ? frontPosClass : backPosClass}
              style={{
                background: 'linear-gradient(160deg,#1e40af 0%,#1d4ed8 45%,#1e3a8a 100%)',
                ...(front ? frontPosStyle : backPosStyle),
              }}
            >
              <div className={`flex items-start justify-between ${front ? 'mb-4' : ''}`}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle size={front ? 15 : 13} className="text-blue-300" />
                    <span className={`${front ? 'text-[13px]' : 'text-[9px]'} font-bold uppercase tracking-[0.16em] text-blue-200`}>
                      Daily Call
                    </span>
                  </div>
                  {front && (
                    <p className="text-[12px] text-white/55 font-medium ml-0.5">Cast your call on today's question</p>
                  )}
                </div>
                {callCompleted ? (
                  <span className="flex items-center gap-1 bg-green-400/15 rounded-full px-1.5 py-0.5 border border-green-400/30">
                    <Check size={9} className="text-green-300" strokeWidth={3} />
                    <span className="text-[8px] font-bold text-green-200">DONE</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {front && (
                      <span className="flex items-center gap-1 bg-blue-400/20 rounded-full px-1.5 py-0.5 border border-blue-400/30">
                        <Sparkles size={8} className="text-blue-200" />
                        <span className="text-[8px] font-bold text-blue-100">+{dailyCall?.points_reward ?? 10} pts</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" style={{ animation: 'pulse 2s infinite' }} />
                      <span className="text-[8px] font-bold text-white/80">LIVE</span>
                    </span>
                  </div>
                )}
              </div>

              <div className={`flex-1 flex flex-col justify-center ${front ? 'py-2' : 'pt-3 pb-2'}`}>
                {callCompleted && callAnswer ? (
                  <>
                    <p className={`${front ? 'text-[10px]' : 'text-[9px]'} text-white/40 uppercase tracking-wider font-semibold mb-1`}>Your Call</p>
                    <p className={`text-white/90 ${front ? 'text-xl font-bold' : 'text-[13px] font-semibold'} leading-snug line-clamp-3`}>{callAnswer}</p>
                  </>
                ) : (
                  <p className={`text-white ${front ? 'text-xl font-bold' : 'text-[13px] font-semibold'} leading-snug line-clamp-3`}>
                    {callPreview}
                  </p>
                )}
              </div>

              <div className={`flex items-center justify-between ${front ? 'mt-4' : ''}`}>
                <span className={`${front ? 'text-xs' : 'text-[10px]'} text-blue-200/60 font-medium`}>1 prediction</span>
                {front ? (
                  <span className="bg-white text-blue-950 text-sm font-bold px-6 py-2.5 rounded-full shadow-lg flex items-center gap-1.5">
                    {callCompleted ? 'Share' : 'Call It'}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="bg-white/95 text-blue-900 text-[11px] font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1">
                    {callCompleted ? 'Share' : 'Call It'}
                    <ArrowRight size={12} strokeWidth={2.5} />
                  </span>
                )}
              </div>
            </button>
          );

          const handleDnaAnswer = async (answer: 'a' | 'b') => {
            if (dnaHeroAnswering || dnaHeroAnswered || !heroDnaMoment || !user?.id) return;
            setDnaHeroAnswering(true);
            try {
              await supabase.from('dna_moment_responses').insert({
                user_id: user.id,
                moment_id: heroDnaMoment.id,
                answer,
                points_earned: 5,
              });
              const { data: allResp } = await supabase
                .from('dna_moment_responses')
                .select('answer')
                .eq('moment_id', heroDnaMoment.id);
              const total = allResp?.length || 1;
              const aCount = (allResp || []).filter((r: any) => r.answer === 'a').length;
              setDnaHeroResult({
                optionAPercent: Math.round((aCount / total) * 100),
                optionBPercent: Math.round(((total - aCount) / total) * 100),
                total,
              });
              setDnaHeroAnswered(true);
              setShowDnaInCarousel(false);
            } catch { /* ignore */ } finally {
              setDnaHeroAnswering(false);
            }
          };

          const handleDnaSkip = () => {
            if (!heroDnaMoment) return;
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
            const key = `dna-hero-skipped-${today}`;
            try {
              const skipped: string[] = JSON.parse(localStorage.getItem(key) || '[]');
              skipped.push(heroDnaMoment.id);
              localStorage.setItem(key, JSON.stringify(skipped));
            } catch {}
            setSwipeIndex(0);
          };

          const dnaMomentCard = (front: boolean) => {
            const emptyCard = (
              <div
                key="dna"
                className={front ? frontPosClass : backPosClass}
                style={{
                  background: 'linear-gradient(160deg,#4c1d95 0%,#6d28d9 45%,#7c3aed 100%)',
                  ...(front ? frontPosStyle : backPosStyle),
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <Dna size={front ? 15 : 13} className="text-purple-300" />
                    <span className={`${front ? 'text-[13px]' : 'text-[9px]'} font-bold uppercase tracking-[0.16em] text-purple-200/90`}>
                      Entertainment DNA
                    </span>
                  </div>
                </div>
                {front && (
                  <div className="flex-1 flex items-center justify-center py-6">
                    <p className="text-white/40 text-sm text-center">All caught up — check back tomorrow</p>
                  </div>
                )}
              </div>
            );
            if (!heroDnaMoment) return emptyCard;

            return (
              <div
                key="dna"
                className={front ? frontPosClass : backPosClass}
                style={{
                  background: 'linear-gradient(160deg,#4c1d95 0%,#6d28d9 45%,#7c3aed 100%)',
                  ...(front ? frontPosStyle : backPosStyle),
                }}
              >
                <div className={`flex items-start justify-between ${front ? 'mb-4' : ''}`}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Dna size={front ? 15 : 13} className="text-purple-300" />
                      <span className={`${front ? 'text-[13px]' : 'text-[9px]'} font-bold uppercase tracking-[0.16em] text-purple-200/90`}>
                        Entertainment DNA
                      </span>
                    </div>
                    {front && <p className="text-[12px] text-white/55 font-medium ml-0.5">Your answers build your profile</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/10">
                      <Sparkles size={9} className="text-purple-300" />
                      <span className="text-[8px] font-bold text-white/80">+5 pts</span>
                    </span>
                    {showDnaInCarousel && front && (
                      <button
                        onClick={() => setShowDnaInCarousel(false)}
                        className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                        title="Close"
                      >
                        <X size={11} className="text-white/70" />
                      </button>
                    )}
                  </div>
                </div>

                {front ? (
                  <>
                    <div className="flex-1 flex flex-col justify-center py-2">
                      <p className="text-white text-xl font-bold leading-tight drop-shadow-sm mb-3">
                        {heroDnaMoment.questionText}
                      </p>
                      {!dnaHeroAnswered ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleDnaAnswer('a')}
                            disabled={dnaHeroAnswering}
                            className="py-2.5 px-4 rounded-xl bg-white/10 border border-white/20 text-white/90 text-sm font-medium text-left hover:bg-white/20 active:bg-white/25 transition-all"
                          >
                            {heroDnaMoment.optionA}
                          </button>
                          <button
                            onClick={() => handleDnaAnswer('b')}
                            disabled={dnaHeroAnswering}
                            className="py-2.5 px-4 rounded-xl bg-white/10 border border-white/20 text-white/90 text-sm font-medium text-left hover:bg-white/20 active:bg-white/25 transition-all"
                          >
                            {heroDnaMoment.optionB}
                          </button>
                        </div>
                      ) : dnaHeroResult && (
                        <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                          {/* Archetype scorecard */}
                          <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2 border border-white/10">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-purple-400/30 flex items-center justify-center flex-shrink-0">
                                <Dna size={11} className="text-purple-200" />
                              </div>
                              <span className="text-[11px] font-semibold text-white leading-tight">
                                {dnaStats?.topGenre
                                  ? `You're strong on ${dnaStats.topGenre}`
                                  : (dnaStats?.label ?? 'Building your DNA…')}
                              </span>
                            </div>
                            <Link href="/entertainment-dna">
                              <span className="text-[10px] text-purple-300 flex items-center gap-0.5 flex-shrink-0 ml-2">
                                View DNA <ArrowRight size={9} />
                              </span>
                            </Link>
                          </div>
                          {/* Result bars */}
                          {[
                            { label: heroDnaMoment.optionA, pct: dnaHeroResult.optionAPercent },
                            { label: heroDnaMoment.optionB, pct: dnaHeroResult.optionBPercent },
                          ].map(opt => (
                            <div key={opt.label} className="p-2.5 rounded-xl bg-white/10 border border-white/15">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-white/80 truncate pr-2">{opt.label}</span>
                                <span className="text-sm font-bold text-purple-200 flex-shrink-0">{opt.pct}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-300/70 rounded-full transition-all duration-700 ease-out"
                                  style={{ width: `${opt.pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                          {/* Stats row */}
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-purple-200/50 flex items-center gap-1">
                              <Flame size={9} className="text-purple-300" />
                              {dnaStats?.totalAnswered ?? 0} answered
                            </span>
                            <span className="text-[10px] text-purple-200/50">·</span>
                            <span className="text-[10px] text-purple-200/50">{dnaHeroResult.total} responses</span>
                            <span className="text-[10px] text-purple-200/50">·</span>
                            <span className="text-[10px] text-green-300/70 flex items-center gap-1">
                              <Sparkles size={8} /> +5 pts earned
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      {!dnaHeroAnswered ? (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={handleDnaSkip}
                            className="text-white/30 text-[11px] hover:text-white/60 transition-colors"
                          >
                            Skip
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => { setLocation('/play/trivia'); }}
                            className="w-full py-2 rounded-xl text-[11px] font-semibold text-white/80 flex items-center justify-center gap-1.5 border border-white/15"
                            style={{ background: 'rgba(255,255,255,0.10)' }}
                          >
                            <Trophy size={11} className="opacity-80" />
                            Play More Trivia
                          </button>
                          <button
                            onClick={() => { window.dispatchEvent(new CustomEvent('openAddMedia')); }}
                            className="w-full py-2 rounded-xl text-[11px] font-semibold text-white/80 flex items-center justify-center gap-1.5 border border-white/15"
                            style={{ background: 'rgba(255,255,255,0.10)' }}
                          >
                            <MessageCircle size={11} className="opacity-80" />
                            Have a Take? Rate &amp; Review
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-center pt-3 pb-2">
                    <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
                      {heroDnaMoment.questionText}
                    </p>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="flex flex-col gap-2 md:max-w-lg md:mx-auto">
              <div className="relative">
                {todaysPlayCard(true)}
              </div>
              {isTriviaDay && typeof totalPlayers === 'number' && totalPlayers > 0 && (
                <p className="text-center text-[11px] text-white/35 tracking-wide">
                  {(totalPlayers + 61).toLocaleString()} people playing today
                </p>
              )}
            </div>
          );
        })()
      )}


      {/* Game overlay */}
      {showPlayGame && readyQuestions.length > 0 && (
        <TodaysPlayGame
          questions={readyQuestions}
          streak={streak}
          username={username}
          onComplete={(score) => {
            setPlayScore(score);
            setPlayCompleted(true);
            // sheet stays open showing the combined done+share screen
          }}
          onClose={() => setShowPlayGame(false)}
          onShare={(ans, sp) => { setPlayAnswers(ans); setPlaySocialProof(sp ?? null); setShowPlayGame(false); setShowPlayShare(true); }}
        />
      )}

      {/* Daily Call overlay */}
      {showCallOverlay && dailyCall && (
        <DailyCallOverlay
          challenge={dailyCall}
          session={session}
          streak={streak}
          username={username}
          onComplete={(answer, breakdown) => {
            setCallAnswer(answer);
            setCallCompleted(true);
            setCallVoteBreakdown(breakdown);
            setShowCallOverlay(false);
            setShowCallShare(true);
          }}
          onShare={() => { setShowCallOverlay(false); setShowCallShare(true); }}
          onClose={() => setShowCallOverlay(false)}
        />
      )}

      {/* Share score cards */}
      <ScoreShareCard
        open={showPlayShare}
        type="play"
        playScore={playScore}
        answers={playAnswers ?? undefined}
        questions={questions}
        streak={streak}
        userId={user?.id}
        username={username ?? null}
        dnaStats={dnaStats ?? null}
        rankData={rankData ?? null}
        triviaStats={triviaStats ?? null}
        socialProof={playSocialProof}
        onClose={() => setShowPlayShare(false)}
      />
      <ScoreShareCard
        open={showCallShare}
        type="call"
        callAnswer={callAnswer}
        callQuestion={dailyCall?.title}
        callOptions={dailyCall?.options}
        callVoteBreakdown={callVoteBreakdown}
        callPoolId={dailyCall?.id}
        streak={streak}
        userId={user?.id}
        username={username ?? null}
        dnaStats={dnaStats ?? null}
        rankData={rankData ?? null}
        triviaStats={triviaStats ?? null}
        onClose={() => setShowCallShare(false)}
      />
    </>
  );
}
