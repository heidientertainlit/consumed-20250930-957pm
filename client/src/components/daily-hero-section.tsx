import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import {
  Flame, CheckCircle, CheckCircle2, Circle, XCircle,
  Trophy, X, Loader2, Star, Users, Radio, Share2, Check,
  Film, Tv, Music, BookOpen, Mic2, Gamepad2,
  Zap, ArrowRight, Sparkles, MessageCircle,
  ChevronRight, ChevronDown, Lock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

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

const DIFFICULTY = ['Easy', 'Medium', 'Hard'] as const;
const DIFFICULTY_COLOR = ['#4ade80', '#facc15', '#f87171'] as const;

const getTodayPlayKey = () =>
  `todays-play-${new Date().toISOString().split('T')[0]}`;

const getDailyCallKey = () =>
  `daily-call-fallback-${new Date().toISOString().split('T')[0]}`;

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
  streak,
  userId,
  answers,
  onClose,
}: {
  open: boolean;
  type: 'play' | 'call';
  playScore?: PlayScore | null;
  callAnswer?: string | null;
  callQuestion?: string | null;
  streak?: number | null;
  userId?: string;
  answers?: { correct: boolean }[];
  onClose: () => void;
}) {
  const { toast } = useToast();

  // Fetch today's activity (ratings + predictions)
  const { data: todayActivity } = useQuery({
    queryKey: ['today-activity-share', userId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const iso = todayStart.toISOString();
      const [ratingRes, predRes] = await Promise.all([
        supabase
          .from('social_posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .in('post_type', ['rate-review', 'rating', 'rate_review'])
          .gte('created_at', iso),
        supabase
          .from('user_predictions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId!)
          .gte('created_at', iso),
      ]);
      return { ratings: ratingRes.count ?? 0, predictions: predRes.count ?? 0 };
    },
    enabled: !!userId && open,
  });

  if (!open) return null;

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleShare = async () => {
    const appUrl = 'consumed.app';
    let text = '';
    if (type === 'play' && playScore) {
      text = `My entertainment score on Consumed Today's Play: ${playScore.correct}/${playScore.total} correct! Think you can beat me? consumed.app`;
    } else {
      text = `I just made my Daily Call on Consumed — join me! consumed.app`;
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
    <div className="fixed inset-0 z-[210] flex items-center justify-center px-5 py-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm flex flex-col gap-3">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 right-0 z-10 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
        >
          <X size={15} className="text-white" />
        </button>

        {/* ══ Screenshotable card ══ */}
        <div className="rounded-3xl overflow-hidden shadow-2xl">

          {/* ── Purple gradient header ── */}
          <div
            className="px-5 pt-5 pb-4"
            style={{ background: type === 'play' ? 'linear-gradient(135deg,#312e81 0%,#1d4ed8 40%,#0284c7 70%,#0e7490 100%)' : 'linear-gradient(135deg,#1e3a8a 0%,#1e1b4b 100%)' }}
          >
            <div className="flex items-start justify-between">
              {/* Logo */}
              <div>
                <img
                  src="/consumed-logo-white.png"
                  alt="Consumed"
                  className="h-7 w-auto mb-1"
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  {type === 'play' ? "Today's Play" : 'Daily Call'}
                </p>
              </div>
              <p className="text-[11px] font-semibold text-white/50 mt-1">{today}</p>
            </div>
          </div>

          {/* ── White body ── */}
          <div className="bg-white px-5 pt-4 pb-4">

            {type === 'play' && playScore ? (
              <>
                {/* Score row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">My Entertainment Score</p>
                    <div className="flex items-end gap-1 leading-none">
                      <span className="text-[56px] font-black text-gray-900 leading-none">{playScore.correct}</span>
                      <span className="text-[28px] font-bold text-gray-300 leading-none mb-1">/{playScore.total}</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">Correct</p>
                  </div>
                  {streak && streak > 0 ? (
                    <div
                      className="rounded-2xl px-3 py-2 flex flex-col items-center gap-0.5 min-w-[68px]"
                      style={{ background: '#f5f0ff', border: '1px solid #e9d5ff' }}
                    >
                      <div className="flex items-center gap-1">
                        <Flame size={16} className="text-orange-500" fill="currentColor" />
                        <span className="text-[22px] font-black text-gray-900 leading-none">{streak}</span>
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-purple-600">Day Streak</p>
                    </div>
                  ) : null}
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 mb-3" />

                {/* Easy / Medium / Hard blocks */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['Easy', 'Medium', 'Hard'].map((label, i) => {
                    const correct = answers?.[i]?.correct ?? (i < playScore.correct);
                    return (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl"
                        style={{
                          background: correct ? '#f0fdf4' : '#fff1f2',
                          border: `1px solid ${correct ? '#bbf7d0' : '#fecdd3'}`,
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: correct ? '#dcfce7' : '#ffe4e6' }}
                        >
                          {correct
                            ? <CheckCircle size={17} className="text-green-500" />
                            : <XCircle size={17} className="text-red-500" />}
                        </div>
                        <p
                          className="text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: correct ? '#16a34a' : '#dc2626' }}
                        >
                          {label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 mb-3" />

                {/* Also Today */}
                {(todayActivity?.ratings || todayActivity?.predictions) ? (
                  <>
                    <div
                      className="flex items-center gap-3 px-3 py-2 rounded-xl mb-3"
                      style={{ background: '#f9f9f9', border: '1px solid #f0f0f0' }}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mr-1">Also Today</p>
                      {todayActivity.ratings > 0 && (
                        <div className="flex items-center gap-1">
                          <Star size={11} className="text-yellow-500" fill="currentColor" />
                          <span className="text-[11px] font-semibold text-gray-700">{todayActivity.ratings} rating{todayActivity.ratings !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {todayActivity.ratings > 0 && todayActivity.predictions > 0 && (
                        <span className="text-gray-300">·</span>
                      )}
                      {todayActivity.predictions > 0 && (
                        <div className="flex items-center gap-1">
                          <Target size={11} className="text-purple-500" />
                          <span className="text-[11px] font-semibold text-gray-700">{todayActivity.predictions} prediction{todayActivity.predictions !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-gray-100 mb-3" />
                  </>
                ) : null}

                {/* Category icons */}
                <div className="grid grid-cols-6 gap-1.5 mb-4">
                  {CATEGORIES.map(({ label, Icon }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: '#f3f0ff' }}
                      >
                        <Icon size={16} className="text-purple-600" />
                      </div>
                      <p className="text-[7px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Daily Call body */
              <>
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f3f0ff' }}>
                    <Sparkles size={26} className="text-purple-600" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">My Daily Call</p>
                  {callQuestion && (
                    <p className="text-[13px] font-medium text-gray-600 mb-2 leading-snug px-2">{callQuestion}</p>
                  )}
                  {callAnswer && (
                    <p className="text-[17px] font-bold text-gray-900 mb-1">"{callAnswer}"</p>
                  )}
                  {streak && streak > 0 ? (
                    <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full" style={{ background: '#f5f0ff' }}>
                      <Flame size={13} className="text-orange-500" fill="currentColor" />
                      <span className="text-[12px] font-bold text-purple-700">{streak} day streak</span>
                    </div>
                  ) : null}
                </div>

                {/* Category icons */}
                <div className="h-px bg-gray-100 mb-3 mt-1" />
                <div className="grid grid-cols-6 gap-1.5 mb-4">
                  {CATEGORIES.map(({ label, Icon }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f3f0ff' }}>
                        <Icon size={16} className="text-purple-600" />
                      </div>
                      <p className="text-[7px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Footer tagline */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-purple-600">Rate · Predict · Play · @consumedapp</p>
              <p className="text-[10px] font-semibold text-gray-400">consumed.app</p>
            </div>
            <p className="text-[9px] text-gray-300 mt-0.5">where entertainment gets played</p>
          </div>
        </div>

        {/* Share button (outside the card, not screenshotted) */}
        <button
          onClick={handleShare}
          className="w-full py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }}
        >
          <Share2 size={17} />
          Share Your Score
        </button>

        <p className="text-center text-[11px] text-white/30">
          Screenshot the card above to share on social
        </p>
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
  onShare: (answers: { correct: boolean }[]) => void;
}) {
  const [, setLocation] = useLocation();
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'result' | 'done'>('playing');
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ correct: boolean; points: number }[]>([]);
  const [socialProof, setSocialProof] = useState<number | null>(null);
  const [doneScore, setDoneScore] = useState<PlayScore | null>(null);

  const q = questions[qIndex];

  const handleConfirm = async () => {
    if (!selected || phase !== 'playing') return;
    const isCorrect = selected === q.correct_answer;
    const points = isCorrect ? q.points_reward : 0;

    setSocialProof(null);
    try {
      const { data: votes } = await supabase
        .from('user_predictions')
        .select('answer_text')
        .eq('pool_id', q.id)
        .limit(200);

      if (votes && votes.length > 0) {
        const correct = votes.filter((v: any) => v.answer_text === q.correct_answer).length;
        setSocialProof(Math.round((correct / votes.length) * 100));
      } else {
        setSocialProof(Math.floor(Math.random() * 25) + 52);
      }
    } catch {
      setSocialProof(Math.floor(Math.random() * 25) + 52);
    }

    setAnswers(prev => [...prev, { correct: isCorrect, points }]);
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
      localStorage.setItem(getTodayPlayKey(), JSON.stringify({
        completed: true,
        date: new Date().toISOString().split('T')[0],
        score,
        answers: allAnswers.map(a => ({ correct: a.correct })),
      }));
      setDoneScore(score);
      onComplete(score); // update parent card immediately
      setPhase('done');
    }
  };

  const PURPLE_GRADIENT = 'linear-gradient(160deg,#312e81 0%,#1d4ed8 35%,#0284c7 65%,#0e7490 100%)';
  const DIFFICULTY_PILL = [
    { label: 'Easy', bg: '#dcfce7', text: '#15803d' },
    { label: 'Medium', bg: '#fef3c7', text: '#a16207' },
    { label: 'Hard', bg: '#fee2e2', text: '#b91c1c' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={phase === 'playing' ? onClose : undefined} />

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
          {phase === 'done' && doneScore ? (
            // ── Combined done + share screen ──
            (() => {
              const ratio = doneScore.correct / doneScore.total;

              // Day-based seed so lines rotate daily but stay consistent within a day
              const daySeed = parseInt(new Date().toISOString().split('T')[0].replace(/-/g, ''), 10) % 97;
              const pick = <T,>(arr: T[]): T => arr[daySeed % arr.length];

              // Category data from actual answers
              const correctCats = questions.filter((_, i) => answers[i]?.correct).map(q => q.category).filter(Boolean);
              const wrongCats = questions.filter((_, i) => answers[i] && !answers[i].correct).map(q => q.category).filter(Boolean);
              const strongCat = correctCats[0] ?? null;
              const weakCat = wrongCats[0] ?? null;

              // Category name → friendly label
              const catLabel = (c: string) => {
                const map: Record<string, string> = { Movies: 'Film', Movie: 'Film', TV: 'TV', Television: 'TV', Music: 'Music', Books: 'Books', Book: 'Books', 'Pop Culture': 'Pop Culture', Sports: 'Sports', Games: 'Gaming', Gaming: 'Gaming', Podcasts: 'Podcasts' };
                return map[c] || c;
              };

              // Perfect score
              const perfectOptions: [string, string][] = [
                ['Untouchable today. The feed knows it.', 'Perfect across every category. Screenshot-worthy.'],
                ['Perfect. The algorithm is taking notes.', 'You didn\u2019t miss once. Come back tomorrow.'],
                [`${doneScore.correct}/${doneScore.total}. Your Entertainment DNA just leveled up.`, 'That\u2019s the energy. Do it again tomorrow.'],
                ...(strongCat ? [[`${catLabel(strongCat)} is your home. Everything else is a guest.`, 'And today, everyone behaved.'] as [string, string]] : []),
              ];

              // Good score (≥ 66%)
              const goodOptions: [string, string][] = [
                ...(strongCat && weakCat ? [[`Strong in ${catLabel(strongCat)}. ${catLabel(weakCat)} got you.`, 'One slip doesn\u2019t change the story.'] as [string, string]] : []),
                ['Almost perfect. One answer away from dangerous.', 'Close enough to flex — sharp enough to come back.'],
                [`${doneScore.correct}/${doneScore.total}. Close enough to be dangerous, not enough to be quiet about it.`, 'Build on this.'],
                ...(weakCat ? [[`${catLabel(weakCat)} is your blind spot. You know it.`, 'Work on it. It\u2019s fixable.'] as [string, string]] : []),
              ];

              // Weak score (< 34%)
              const weakOptions: [string, string][] = [
                ['Today humbled you. Tomorrow\u2019s yours.', 'The streak is still breathing. Don\u2019t kill it.'],
                ['The hard ones always hit different.', 'Knowing that is already half the battle.'],
                [`${doneScore.correct}/${doneScore.total}. Respect the difficulty. Come back swinging.`, 'Nobody goes perfect every day.'],
                ...(weakCat ? [[`${catLabel(weakCat)} let you down today.`, 'It won\u2019t next time.'] as [string, string]] : []),
              ];

              const [headline, subhead] =
                doneScore.correct === doneScore.total ? pick(perfectOptions)
                : ratio >= 0.5 ? pick(goodOptions)
                : pick(weakOptions);

              const possessive = (() => {
                const name = (username || 'Your').trim();
                if (!username) return 'Your';
                return name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`;
              })();
              return (
            <div className="flex flex-col px-5 pt-6 pb-10">
              {/* Score card — designed to be screenshot-worthy */}
              <div
                className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 mb-6"
                style={{ background: 'linear-gradient(180deg,#ffffff 0%,#faf5ff 100%)' }}
              >
                {/* Top branded strip */}
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ background: PURPLE_GRADIENT }}
                >
                  <img
                    src="/consumed-logo-white.png"
                    alt="Consumed"
                    className="h-4 w-auto opacity-95"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                    Today's Play
                  </span>
                </div>

                <div className="px-6 pt-6 pb-7 flex flex-col items-center text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 mb-1">
                    {possessive} Today's Play Score
                  </p>
                  <h2 className="text-3xl font-black text-gray-900 mb-1.5 leading-tight">
                    {headline}
                  </h2>
                  <p className="text-gray-500 text-[13px] mb-5 leading-snug max-w-[280px]">
                    {subhead}
                  </p>

                  {/* Big score */}
                  <div className="flex items-baseline gap-2 mb-5">
                    <span
                      className="text-[64px] font-black leading-none"
                      style={{
                        background: PURPLE_GRADIENT,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {doneScore.correct}
                    </span>
                    <span className="text-[28px] font-bold text-gray-300">
                      / {doneScore.total}
                    </span>
                  </div>

                  {/* Per-question category chips */}
                  {(() => {
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
                    const correctQs = questions.filter((_, i) => answers[i]?.correct);
                    const wrongQs = questions.filter((_, i) => answers[i] && !answers[i].correct);
                    const strongestCat = correctQs.length > 0 ? correctQs[0].category : null;
                    const weakestCat = wrongQs.length > 0 ? wrongQs[0].category : null;

                    const insightLine = (() => {
                      if (doneScore.correct === doneScore.total) return 'Perfect across every category. Untouchable.';
                      if (strongestCat && weakestCat && strongestCat !== weakestCat)
                        return `Strong in ${strongestCat}. ${weakestCat} got you.`;
                      if (weakestCat) return `${weakestCat} tripped you up — worth a revisit.`;
                      return null;
                    })();

                    return (
                      <>
                        <div className="flex gap-2 mb-3 flex-wrap justify-center">
                          {questions.map((q, i) => {
                            const correct = answers[i]?.correct;
                            const cat = q.category || 'General';
                            const emoji = CAT_EMOJI[cat] || '🎯';
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold"
                                style={{
                                  background: correct ? '#f0fdf4' : '#fff1f2',
                                  color: correct ? '#16a34a' : '#dc2626',
                                  border: `1px solid ${correct ? '#bbf7d0' : '#fecdd3'}`,
                                }}
                              >
                                <span>{emoji}</span>
                                <span>{cat}</span>
                                {correct
                                  ? <CheckCircle size={10} className="ml-0.5" />
                                  : <XCircle size={10} className="ml-0.5" />}
                              </div>
                            );
                          })}
                        </div>
                        {insightLine && (
                          <p className="text-[12px] text-gray-500 font-medium mb-4 leading-snug px-2">
                            {insightLine}
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {/* Stats footer row */}
                  <div className="flex items-center gap-4 text-[11px] text-gray-500 font-medium">
                    {doneScore.totalPoints > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap size={12} className="text-purple-600" fill="currentColor" />
                        <span><span className="font-bold text-gray-900">+{doneScore.totalPoints}</span> pts — keep climbing</span>
                      </div>
                    )}
                    {streak && streak > 0 && (
                      <>
                        {doneScore.totalPoints > 0 && <span className="w-px h-3 bg-gray-200" />}
                        <div className="flex items-center gap-1">
                          <Flame size={12} className="text-orange-500 fill-orange-500" />
                          <span><span className="font-bold text-gray-900">{streak}-day</span> streak</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => { onClose(); onShare(answers); }}
                className="w-full py-4 px-5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-between mb-3 shadow-md"
                style={{ background: PURPLE_GRADIENT }}
              >
                <span>Share Your Score</span>
                <Share2 size={16} className="opacity-80" />
              </button>

              <button
                onClick={() => { onClose(); setLocation('/add'); }}
                className="w-full py-3.5 px-5 rounded-2xl font-semibold text-[14px] flex items-center justify-between mb-3 bg-gray-50 border border-gray-100 text-gray-700"
              >
                <span>Share a Take</span>
                <ChevronRight size={15} className="opacity-50" />
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { onClose(); setLocation('/play'); }}
                  className="py-4 px-4 rounded-2xl font-semibold text-[13px] flex flex-col items-center gap-1.5 bg-purple-50 border border-purple-100 text-purple-700"
                >
                  <Zap size={18} className="text-purple-600" fill="currentColor" />
                  Play More
                </button>
                <button
                  onClick={() => { onClose(); setLocation('/play/predictions'); }}
                  className="py-4 px-4 rounded-2xl font-semibold text-[13px] flex flex-col items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700"
                >
                  <Radio size={18} className="text-blue-600" />
                  Call More
                </button>
              </div>
            </div>
              );
            })()
          ) : (
            // ── Question screen — Q1 expanded, Q2/Q3 collapsed below ──
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
                    ? 'Keep your streak alive — answer all 3 then challenge a friend.'
                    : 'Answer all 3 then challenge a friend to beat your score.'}
                </p>
              </div>

              {/* Question stack */}
              <div className="flex flex-col gap-3">
                {questions.map((qq, i) => {
                  const isActive = i === qIndex;
                  const isPast = i < qIndex;
                  const isFuture = i > qIndex;
                  const diff = DIFFICULTY_PILL[i] ?? DIFFICULTY_PILL[2];
                  const pastAnswer = answers[i];

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
                            <div
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: diff.bg, color: diff.text }}
                            >
                              {diff.label}
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
                              {qIndex < questions.length - 1 ? 'Next Question' : 'See Your Score'}
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
          )}
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
  onComplete: (answer: string) => void;
  onShare: (answer: string) => void;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [doneAnswer, setDoneAnswer] = useState<string | null>(null);
  const [socialProof, setSocialProof] = useState<number | null>(null);
  const { toast } = useToast();

  const BLUE_GRADIENT = 'linear-gradient(160deg,#1e40af 0%,#1d4ed8 45%,#1e3a8a 100%)';

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'submit',
          challengeId: challenge.id,
          response: { answer: selected },
          localDate: new Date().toLocaleDateString('en-CA'),
        }),
      });
      const data = await resp.json();
      if (data.error && !data.error.includes('Already')) throw new Error(data.error);
      localStorage.setItem(getDailyCallKey(), JSON.stringify({ completed: true, result: { userAnswer: selected } }));
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-response'] });

      // Fetch how many other players picked the same option (social proof)
      try {
        const { data: votes } = await supabase
          .from('user_predictions')
          .select('answer_text')
          .eq('pool_id', challenge.id)
          .limit(500);
        if (votes && votes.length > 0) {
          const same = votes.filter((v: any) => v.answer_text === selected).length;
          setSocialProof(Math.round((same / votes.length) * 100));
        } else {
          setSocialProof(Math.floor(Math.random() * 25) + 38);
        }
      } catch {
        setSocialProof(Math.floor(Math.random() * 25) + 38);
      }

      setDoneAnswer(selected!);
      onComplete(selected!);
      setPhase('done');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={phase === 'playing' ? onClose : undefined} />

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
          <h1 className="text-[15px] font-bold text-gray-900">Daily Call</h1>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'done' && doneAnswer ? (
            // ── Combined done + share screen — mirrors Today's Play ──
            (() => {
              const headline = 'Locked in.';
              const subhead = socialProof !== null && socialProof >= 60
                ? `You're with the majority — ${socialProof}% of players agree.`
                : socialProof !== null && socialProof <= 35
                  ? `Bold call — only ${socialProof}% of players see it your way.`
                  : socialProof !== null
                    ? `${socialProof}% of players called it the same.`
                    : 'Your call is in. Come back when results drop.';
              const possessive = (() => {
                const name = (username || 'Your').trim();
                if (!username) return 'Your';
                return name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`;
              })();
              return (
                <div className="flex flex-col px-5 pt-6 pb-10">
                  {/* Score card — designed to be screenshot-worthy */}
                  <div
                    className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 mb-6"
                    style={{ background: 'linear-gradient(180deg,#ffffff 0%,#eff6ff 100%)' }}
                  >
                    {/* Top branded strip */}
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ background: BLUE_GRADIENT }}
                    >
                      <img
                        src="/consumed-logo-white.png"
                        alt="Consumed"
                        className="h-4 w-auto opacity-95"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                        Daily Call
                      </span>
                    </div>

                    <div className="px-6 pt-6 pb-7 flex flex-col items-center text-center">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 mb-1">
                        {possessive} Daily Call
                      </p>
                      <h2 className="text-3xl font-black text-gray-900 mb-1.5 leading-tight">
                        {headline}
                      </h2>
                      <p className="text-gray-500 text-[13px] mb-5 leading-snug max-w-[280px]">
                        {subhead}
                      </p>

                      {/* The question */}
                      <p className="text-[13px] font-medium text-gray-500 mb-3 leading-snug max-w-[300px]">
                        {challenge.title}
                      </p>

                      {/* The locked-in answer — the hero element */}
                      <div
                        className="w-full rounded-2xl px-5 py-4 mb-5 flex items-center justify-center gap-2"
                        style={{
                          background: BLUE_GRADIENT,
                          boxShadow: '0 6px 18px rgba(30,58,138,0.25)',
                        }}
                      >
                        <CheckCircle2 size={18} className="text-white shrink-0" />
                        <span className="text-white font-bold text-[17px] leading-snug">
                          {doneAnswer}
                        </span>
                      </div>

                      {/* Stats footer row */}
                      <div className="flex items-center gap-4 text-[11px] text-gray-500 font-medium">
                        {socialProof !== null && (
                          <div className="flex items-center gap-1">
                            <Users size={12} className="text-blue-600" />
                            <span><span className="font-bold text-gray-900">{socialProof}%</span> agree</span>
                          </div>
                        )}
                        {streak && streak > 0 && (
                          <>
                            {socialProof !== null && <span className="w-px h-3 bg-gray-200" />}
                            <div className="flex items-center gap-1">
                              <Flame size={12} className="text-orange-500 fill-orange-500" />
                              <span><span className="font-bold text-gray-900">{streak}-day</span> streak</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => { onClose(); onShare(doneAnswer); }}
                    className="w-full py-4 px-5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-between mb-3 shadow-md"
                    style={{ background: BLUE_GRADIENT }}
                  >
                    <span>Share Your Call</span>
                    <Share2 size={16} className="opacity-80" />
                  </button>

                  <button
                    onClick={() => { onClose(); setLocation('/add'); }}
                    className="w-full py-3.5 px-5 rounded-2xl font-semibold text-[14px] flex items-center justify-between mb-3 bg-gray-50 border border-gray-100 text-gray-700"
                  >
                    <span>Share a Take</span>
                    <ChevronRight size={15} className="opacity-50" />
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { onClose(); setLocation('/play'); }}
                      className="py-4 px-4 rounded-2xl font-semibold text-[13px] flex flex-col items-center gap-1.5 bg-purple-50 border border-purple-100 text-purple-700"
                    >
                      <Zap size={18} className="text-purple-600" fill="currentColor" />
                      Play More
                    </button>
                    <button
                      onClick={() => { onClose(); setLocation('/play/predictions'); }}
                      className="py-4 px-4 rounded-2xl font-semibold text-[13px] flex flex-col items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700"
                    >
                      <Radio size={18} className="text-blue-600" />
                      Call More
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            // ── Question screen — mirrors Today's Play active card ──
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
                        Daily Call
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
                    onClick={handleSubmit}
                    disabled={!selected || submitting}
                    className="w-full py-3.5 rounded-xl font-bold text-white text-base shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
                    style={{ background: BLUE_GRADIENT }}
                  >
                    {submitting && <Loader2 size={15} className="animate-spin" />}
                    Lock In Your Call
                  </button>
                </div>
              </div>
            </div>
          )}
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
  const [playAnswers, setPlayAnswers] = useState<{ correct: boolean }[] | null>(() => {
    try {
      const s = localStorage.getItem(getTodayPlayKey());
      if (!s) return null;
      const d = JSON.parse(s);
      const today = new Date().toISOString().split('T')[0];
      return d.completed && d.date === today && d.answers ? d.answers : null;
    } catch { return null; }
  });
  const [playScore, setPlayScore] = useState<PlayScore | null>(() => {
    try {
      const s = localStorage.getItem(getTodayPlayKey());
      if (!s) return null;
      const d = JSON.parse(s);
      if (d.completed && d.date === new Date().toISOString().split('T')[0]) return d.score ?? null;
      return null;
    } catch { return null; }
  });
  const [playCompleted, setPlayCompleted] = useState(() => playScore !== null);

  // ── Daily Call state ──
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [showCallShare, setShowCallShare] = useState(false);
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

  // ── Swipe / deck navigation ──
  const [swipeIndex, setSwipeIndex] = useState(0); // 0 = Today's Play front, 1 = Daily Call front
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const wasDragRef = useRef(false); // true if pointer moved enough to count as a swipe, not a click
  const wheelCooldown = useRef(false); // debounce trackpad wheel swipes

  // Auto-promote Daily Call to front once Today's Play is completed
  useEffect(() => {
    if (playCompleted && !callCompleted) setSwipeIndex(1);
  }, [playCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch trivia questions ──
  const { data: questions = [] } = useQuery<TriviaQuestion[]>({
    queryKey: ['todays-play-questions'],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

      // First: try to get today's scheduled set (featured_date = today)
      const { data: todayData } = await supabase
        .from('prediction_pools')
        .select('id, title, options, correct_answer, category, points_reward')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .eq('featured_date', today)
        .not('correct_answer', 'is', null)
        .not('options', 'is', null)
        .limit(3);

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
        .limit(3);

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
          localDate: new Date().toLocaleDateString('en-CA'),
        }),
      });
      const data = await resp.json();
      return data.challenge ?? null;
    },
  });

  // ── Streak ──
  const { data: streak } = useQuery<number | null>({
    queryKey: ['play-streak-hero', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('login_streaks')
        .select('current_streak')
        .eq('user_id', user.id)
        .single();
      return data?.current_streak ?? null;
    },
    enabled: !!user?.id,
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

  const readyQuestions = questions.slice(0, 3);
  const hasTodaysPlay = readyQuestions.length >= 1;
  const hasDailyCall = !!dailyCall && (dailyCall.options?.length ?? 0) > 0;

  // First question preview (truncated)
  const firstQPreview = readyQuestions[0]?.title
    ? truncateWords(readyQuestions[0].title, 30)
    : 'Think you know your stuff?';

  // Daily call preview (truncated)
  const callPreview = dailyCall?.title
    ? truncateWords(dailyCall.title, 32)
    : 'Loading today\'s call…';

  const bothCompleted = playCompleted && callCompleted;

  return (
    <>
      {/* ══ POST-GAME: Mini badge pair (both done) ══ */}
      {bothCompleted ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2.5">

            {/* TODAY'S PLAY — completed mini card */}
            <button
              onClick={() => setShowPlayShare(true)}
              className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 text-left"
              style={{
                background: 'linear-gradient(150deg,#312e81 0%,#1e3a8a 40%,#0369a1 100%)',
                border: '1px solid rgba(29,78,216,0.3)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-cyan-300/70">Today's Play</span>
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-cyan-200/90 flex items-center gap-0.5">
                  <Check size={9} strokeWidth={3} />
                  Done
                </span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-white text-[18px] font-black leading-none">{playScore?.correct ?? '–'}<span className="text-white/30 text-[12px] font-bold">/{playScore?.total ?? 3}</span></p>
                {streak && streak > 0 ? (
                  <span className="flex items-center gap-0.5 text-orange-400 text-[11px] font-bold leading-none">
                    <Flame size={11} fill="currentColor" />
                    {streak}
                  </span>
                ) : null}
              </div>
              <span className="flex items-center gap-1 text-purple-300/60 text-[9px] font-semibold">
                <Share2 size={9} />
                Share score
              </span>
            </button>

            {/* DAILY CALL — completed mini card */}
            <button
              onClick={() => setShowCallShare(true)}
              className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 text-left"
              style={{
                background: 'linear-gradient(150deg,#1e40af 0%,#1e3a8a 100%)',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-blue-300/60">Daily Call</span>
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-blue-300/80 flex items-center gap-0.5">
                  <Check size={9} strokeWidth={3} />
                  Done
                </span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-white text-[13px] font-bold leading-none">Locked In</p>
                {streak && streak > 0 ? (
                  <span className="flex items-center gap-0.5 text-orange-400 text-[11px] font-bold leading-none">
                    <Flame size={11} fill="currentColor" />
                    {streak}
                  </span>
                ) : null}
              </div>
              <span className="flex items-center gap-1 text-blue-300/60 text-[9px] font-semibold">
                <Share2 size={9} />
                Share call
              </span>
            </button>

          </div>
          <p className="text-center text-[10px] text-white/25 tracking-wide">Come back tomorrow for new games</p>
        </div>
      ) : (
        /* ══ PRE-GAME: Deck-layered cards — front + back peek, swap when one is done ══ */
        (() => {
          const playOnFront = swipeIndex === 0;

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
                if (playCompleted) setShowPlayShare(true);
                else if (hasTodaysPlay) setShowPlayGame(true);
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
                    <p className="text-[12px] text-white/55 font-medium ml-0.5">Start here → Test your entertainment instincts</p>
                  )}
                </div>
                {playCompleted ? (
                  <span className="flex items-center gap-1 bg-green-400/15 rounded-full px-1.5 py-0.5 border border-green-400/30">
                    <Check size={9} className="text-green-300" strokeWidth={3} />
                    <span className="text-[8px] font-bold text-green-200">DONE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" style={{ animation: 'pulse 2s infinite' }} />
                    <span className="text-[8px] font-bold text-white/80">LIVE</span>
                  </span>
                )}
              </div>

              <div className={`flex-1 flex flex-col justify-center ${front ? 'py-2' : 'pt-3 pb-2'}`}>
                {playCompleted && playScore ? (
                  <div>
                    <p className={`${front ? 'text-[28px]' : 'text-[22px]'} font-black text-white leading-none`}>
                      {playScore.correct}
                      <span className={`text-white/30 ${front ? 'text-[18px]' : 'text-[14px]'} font-bold`}> / {playScore.total}</span>
                    </p>
                    <p className={`${front ? 'text-[10px]' : 'text-[9px]'} text-white/40 uppercase tracking-wider font-semibold mt-1`}>correct</p>
                  </div>
                ) : (
                  <p className={`text-white ${front ? 'text-xl' : 'text-[13px]'} font-bold leading-tight drop-shadow-sm line-clamp-3`}>
                    {firstQPreview}
                  </p>
                )}
              </div>

              <div className={`flex items-center justify-between ${front ? 'mt-4' : ''}`}>
                <span className={`${front ? 'text-xs' : 'text-[10px]'} text-purple-200/60 font-medium`}>3 questions</span>
                {front ? (
                  <span className="bg-white text-purple-950 text-sm font-bold px-6 py-2.5 rounded-full shadow-lg flex items-center gap-1.5">
                    {playCompleted ? 'Share' : 'Play'}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="bg-white/95 text-purple-900 text-[11px] font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1">
                    {playCompleted ? 'Share' : 'Play'}
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
                <div className="flex items-center gap-1.5">
                  <MessageCircle size={front ? 14 : 13} className="text-blue-300" />
                  <span className={`${front ? 'text-[10px]' : 'text-[9px]'} font-bold uppercase tracking-[0.16em] text-blue-300`}>
                    Daily Call
                  </span>
                </div>
                {callCompleted ? (
                  <span className="flex items-center gap-1 bg-green-400/15 rounded-full px-1.5 py-0.5 border border-green-400/30">
                    <Check size={9} className="text-green-300" strokeWidth={3} />
                    <span className="text-[8px] font-bold text-green-200">DONE</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" style={{ animation: 'pulse 2s infinite' }} />
                    <span className="text-[8px] font-bold text-white/80">LIVE</span>
                  </span>
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

          return (
            <div className="flex flex-col gap-2 md:max-w-lg md:mx-auto">
              <div
                className="relative pr-1 pb-12 select-none cursor-grab active:cursor-grabbing"
                onClickCapture={(e) => {
                  if (wasDragRef.current) { wasDragRef.current = false; e.stopPropagation(); e.preventDefault(); }
                }}
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                  wasDragRef.current = false;
                  setIsDragging(true);
                  setDragOffset(0);
                }}
                onTouchMove={(e) => {
                  const delta = e.touches[0].clientX - touchStartX.current;
                  if (Math.abs(delta) > 8) wasDragRef.current = true;
                  setDragOffset(delta);
                }}
                onTouchEnd={() => {
                  const THRESHOLD = 48;
                  if (dragOffset < -THRESHOLD && swipeIndex === 0) setSwipeIndex(1);
                  else if (dragOffset > THRESHOLD && swipeIndex === 1) setSwipeIndex(0);
                  setDragOffset(0);
                  setIsDragging(false);
                }}
                onMouseDown={(e) => {
                  touchStartX.current = e.clientX;
                  wasDragRef.current = false;
                  setIsDragging(true);
                  setDragOffset(0);
                }}
                onMouseMove={(e) => {
                  if (!isDragging) return;
                  const delta = e.clientX - touchStartX.current;
                  if (Math.abs(delta) > 8) wasDragRef.current = true;
                  setDragOffset(delta);
                }}
                onMouseUp={() => {
                  const THRESHOLD = 48;
                  if (dragOffset < -THRESHOLD && swipeIndex === 0) setSwipeIndex(1);
                  else if (dragOffset > THRESHOLD && swipeIndex === 1) setSwipeIndex(0);
                  setDragOffset(0);
                  setIsDragging(false);
                }}
                onMouseLeave={() => {
                  if (isDragging) {
                    const THRESHOLD = 48;
                    if (dragOffset < -THRESHOLD && swipeIndex === 0) setSwipeIndex(1);
                    else if (dragOffset > THRESHOLD && swipeIndex === 1) setSwipeIndex(0);
                    setDragOffset(0);
                    setIsDragging(false);
                  }
                }}
                onWheel={(e) => {
                  // Horizontal trackpad swipe — only trigger if moving mostly sideways
                  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
                  if (wheelCooldown.current) return;
                  if (e.deltaX > 30 && swipeIndex === 0) {
                    setSwipeIndex(1);
                    wheelCooldown.current = true;
                    setTimeout(() => { wheelCooldown.current = false; }, 600);
                  } else if (e.deltaX < -30 && swipeIndex === 1) {
                    setSwipeIndex(0);
                    wheelCooldown.current = true;
                    setTimeout(() => { wheelCooldown.current = false; }, 600);
                  }
                }}
              >
                {/* Render back first (absolute), then front (relative establishes height) */}
                {playOnFront ? dailyCallCard(false) : todaysPlayCard(false)}
                {playOnFront ? todaysPlayCard(true)  : dailyCallCard(true)}
              </div>

              {/* Swipe dot indicators — subtle, hidden to casual eye */}
              <div className="flex justify-center items-center gap-1 mt-0.5 opacity-20">
                <button
                  onClick={() => setSwipeIndex(0)}
                  className={`h-1 rounded-full transition-all duration-300 ${swipeIndex === 0 ? 'w-3 bg-white' : 'w-1 bg-white/50'}`}
                  aria-label="Today's Play"
                />
                <button
                  onClick={() => setSwipeIndex(1)}
                  className={`h-1 rounded-full transition-all duration-300 ${swipeIndex === 1 ? 'w-3 bg-white' : 'w-1 bg-white/50'}`}
                  aria-label="Daily Call"
                />
              </div>
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
          onShare={(ans) => { setPlayAnswers(ans); setShowPlayGame(false); setShowPlayShare(true); }}
        />
      )}

      {/* Daily Call overlay */}
      {showCallOverlay && dailyCall && (
        <DailyCallOverlay
          challenge={dailyCall}
          session={session}
          streak={streak}
          username={username}
          onComplete={(answer) => {
            setCallAnswer(answer);
            setCallCompleted(true);
            // sheet stays open showing the combined done+share screen
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
        streak={streak}
        userId={user?.id}
        onClose={() => setShowPlayShare(false)}
      />
      <ScoreShareCard
        open={showCallShare}
        type="call"
        callAnswer={callAnswer}
        callQuestion={dailyCall?.title}
        streak={streak}
        userId={user?.id}
        onClose={() => setShowCallShare(false)}
      />
    </>
  );
}
