import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import {
  Flame, CheckCircle, XCircle,
  Trophy, X, Loader2, Star, Users, Radio, Share2, Check,
  Film, Tv, Music, BookOpen, Mic2, Gamepad2,
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
  streak,
  userId,
  answers,
  onClose,
}: {
  open: boolean;
  type: 'play' | 'call';
  playScore?: PlayScore | null;
  callAnswer?: string | null;
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
            style={{ background: 'linear-gradient(135deg,#5b21b6 0%,#4c1d95 40%,#3b0764 100%)' }}
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
                          <span className="text-[11px] font-semibold text-gray-700">Rated {todayActivity.ratings}</span>
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
  onComplete,
  onClose,
  onShare,
}: {
  questions: TriviaQuestion[];
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

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={phase === 'playing' ? onClose : undefined} />

      {/* Bottom sheet — fixed height so it always sits well above nav */}
      <div
        className="relative w-full rounded-t-3xl flex flex-col"
        style={{
          background: 'linear-gradient(170deg,#1e0a4a 0%,#120730 60%,#0f0627 100%)',
          height: '88vh',
        }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-4 mb-1 shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-0.5">Today's Play</p>
            <p className="text-sm font-bold" style={{ color: phase === 'done' ? '#4ade80' : DIFFICULTY_COLOR[qIndex] }}>
              {phase === 'done'
                ? 'Complete!'
                : `${DIFFICULTY[qIndex]} · Q${qIndex + 1} of ${questions.length}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
          >
            <X size={15} className="text-white" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'done' && doneScore ? (
            // ── Combined done + share screen ──
            <div className="flex flex-col px-5 pt-6 pb-10">
              {/* Score */}
              <div className="flex flex-col items-center text-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                >
                  <Trophy size={28} className="text-yellow-300" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">You're done!</h2>
                <p className="text-white/50 text-sm mb-4">
                  {doneScore.correct} of {doneScore.total} correct
                  {doneScore.totalPoints > 0 && ` · +${doneScore.totalPoints} pts`}
                </p>
                {/* Answer indicators */}
                <div className="flex gap-2.5">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className="w-12 h-12 rounded-xl flex items-center justify-center border"
                      style={{
                        background: answers[i]?.correct ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                        borderColor: answers[i]?.correct ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.3)',
                      }}
                    >
                      {answers[i]?.correct
                        ? <CheckCircle size={20} className="text-green-400" />
                        : <XCircle size={20} className="text-red-400" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px mb-5" style={{ background: 'rgba(255,255,255,0.1)' }} />

              {/* Share score — primary */}
              <button
                onClick={() => { onClose(); onShare(answers); }}
                className="w-full py-4 px-5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-between mb-3 shadow-lg"
                style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }}
              >
                <span>Share Your Score</span>
                <Share2 size={16} className="opacity-80" />
              </button>

              {/* Share a Take */}
              <button
                onClick={() => { onClose(); setLocation('/add'); }}
                className="w-full py-3.5 px-5 rounded-2xl font-semibold text-[14px] flex items-center justify-between mb-3"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
              >
                <span>Share a Take</span>
                <ChevronRight size={15} className="opacity-50" />
              </button>

              {/* Play More / Call More */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { onClose(); setLocation('/play'); }}
                  className="py-4 px-4 rounded-2xl font-semibold text-[13px] flex flex-col items-center gap-1.5"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd' }}
                >
                  <Zap size={18} className="text-purple-400" fill="currentColor" />
                  Play More
                </button>
                <button
                  onClick={() => { onClose(); setLocation('/play/predictions'); }}
                  className="py-4 px-4 rounded-2xl font-semibold text-[13px] flex flex-col items-center gap-1.5"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}
                >
                  <Radio size={18} className="text-blue-400" />
                  Call More
                </button>
              </div>
            </div>
          ) : (
            // ── Question screen ──
            <div className="flex flex-col px-5 pt-5 pb-10">
              {/* Progress bar */}
              <div className="flex gap-1.5 mb-6">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className="h-[3px] flex-1 rounded-full transition-all"
                    style={{
                      background: i < qIndex
                        ? '#7c3aed'
                        : i === qIndex
                          ? 'rgba(255,255,255,0.8)'
                          : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>

              {/* Category + question */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">{q.category}</p>
              <h2 className="text-[19px] font-bold text-white leading-snug mb-5">{q.title}</h2>

              {/* Answer options */}
              <div className="space-y-2.5 mb-4">
                {q.options.map((option, idx) => {
                  const isSelected = selected === option;
                  const isCorrect = option === q.correct_answer;
                  const showResult = phase === 'result';
                  let bg = 'rgba(255,255,255,0.08)';
                  let border = 'rgba(255,255,255,0.14)';
                  let textColor = 'rgba(255,255,255,0.9)';

                  if (showResult) {
                    if (isCorrect) { bg = 'rgba(74,222,128,0.15)'; border = 'rgba(74,222,128,0.5)'; }
                    else if (isSelected) { bg = 'rgba(248,113,113,0.15)'; border = 'rgba(248,113,113,0.4)'; textColor = 'rgba(255,255,255,0.5)'; }
                    else { bg = 'rgba(255,255,255,0.04)'; border = 'rgba(255,255,255,0.08)'; textColor = 'rgba(255,255,255,0.3)'; }
                  } else if (isSelected) {
                    bg = '#7c3aed'; border = '#a78bfa'; textColor = '#fff';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => { if (phase === 'playing') setSelected(option); }}
                      disabled={phase === 'result'}
                      className="w-full py-4 px-5 rounded-2xl text-left text-[15px] flex items-center justify-between transition-all"
                      style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
                    >
                      <span className="font-medium">{option}</span>
                      {showResult && isCorrect && <CheckCircle size={17} className="text-green-400 shrink-0" />}
                      {showResult && isSelected && !isCorrect && <XCircle size={17} className="text-red-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Social proof */}
              {phase === 'result' && (
                <div
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl mb-3"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Users size={13} className="text-white/40" />
                  {socialProof !== null ? (
                    <p className="text-[13px] text-white/60">
                      <span className="font-bold text-white">{socialProof}%</span> of players got this right
                    </p>
                  ) : (
                    <Loader2 size={13} className="animate-spin text-white/40" />
                  )}
                </div>
              )}

              {/* CTA */}
              {phase === 'playing' ? (
                <button
                  onClick={handleConfirm}
                  disabled={!selected}
                  className="w-full py-4 rounded-2xl font-bold text-[15px] text-white transition-opacity disabled:opacity-35"
                  style={{ background: '#7c3aed' }}
                >
                  Lock In Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl font-bold text-[15px] bg-white text-gray-900"
                >
                  {qIndex < questions.length - 1 ? 'Next Question' : 'See Your Score'}
                </button>
              )}
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
  onComplete,
  onClose,
}: {
  challenge: DailyCallData;
  session: any;
  onComplete: (answer: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

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
      setSubmitted(true);
      localStorage.setItem(getDailyCallKey(), JSON.stringify({ completed: true, result: { userAnswer: selected } }));
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-response'] });
      setTimeout(() => onComplete(selected!), 1000);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full rounded-t-3xl px-5 pt-6 pb-28"
        style={{ background: 'linear-gradient(170deg,#1e0a4a 0%,#120730 60%,#0f0627 100%)' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.18)' }} />

        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md tracking-widest"
            style={{ background: '#3b82f6' }}
          >
            LIVE
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Daily Call</span>
        </div>

        <h2 className="text-xl font-bold text-white leading-snug mb-5">{challenge.title}</h2>

        {submitted ? (
          <div className="flex items-center justify-center gap-2 py-7">
            <CheckCircle size={24} className="text-green-400" />
            <p className="text-white font-semibold">Your call is locked in!</p>
          </div>
        ) : (
          <>
            <div className="space-y-2.5 mb-5">
              {challenge.options?.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelected(option)}
                  className="w-full py-4 px-5 rounded-2xl text-[15px] text-left font-medium transition-all"
                  style={{
                    background: selected === option ? '#7c3aed' : 'rgba(255,255,255,0.09)',
                    border: `1px solid ${selected === option ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                    color: '#fff',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="w-full py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
              style={{ background: '#7c3aed' }}
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Lock In Your Call
            </button>
          </>
        )}
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
  const [showCallAfter, setShowCallAfter] = useState(false);
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

  // ── Fetch trivia questions ──
  const { data: questions = [] } = useQuery<TriviaQuestion[]>({
    queryKey: ['todays-play-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prediction_pools')
        .select('id, title, options, correct_answer, category, points_reward')
        .eq('type', 'trivia')
        .eq('status', 'open')
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
              className="rounded-2xl p-3.5 flex flex-col gap-2 text-left"
              style={{
                background: 'linear-gradient(150deg,#2e1065 0%,#1a0a36 100%)',
                border: '1px solid rgba(139,92,246,0.25)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-purple-300/60">Today's Play</span>
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.3)' }}
                >
                  <Check size={9} className="text-purple-300" strokeWidth={3} />
                </div>
              </div>
              <div>
                <p className="text-white text-[26px] font-black leading-none">{playScore?.correct ?? '–'}</p>
                <p className="text-white/30 text-[11px] font-medium">out of {playScore?.total ?? 3}</p>
              </div>
              <span className="flex items-center gap-1 text-purple-300/60 text-[10px] font-semibold">
                <Share2 size={10} />
                Share score
              </span>
            </button>

            {/* DAILY CALL — completed mini card */}
            <button
              onClick={() => setShowCallShare(true)}
              className="rounded-2xl p-3.5 flex flex-col gap-2 text-left"
              style={{
                background: 'linear-gradient(150deg,#1e3a8a 0%,#0d1a38 100%)',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-blue-300/60">Daily Call</span>
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.25)' }}
                >
                  <Check size={9} className="text-blue-300" strokeWidth={3} />
                </div>
              </div>
              <div>
                <p className="text-white text-[15px] font-bold leading-tight mt-1">Locked{'\n'}In</p>
                <p className="text-white/30 text-[11px] font-medium mt-1">Pending result</p>
              </div>
              <span className="flex items-center gap-1 text-blue-300/60 text-[10px] font-semibold">
                <Share2 size={10} />
                Share call
              </span>
            </button>

          </div>
          <p className="text-center text-[10px] text-white/25 tracking-wide">Come back tomorrow for new games</p>
        </div>
      ) : (
        /* ══ PRE-GAME: Two cards ══ */
        <div className="grid grid-cols-2 gap-2.5">

          {/* TODAY'S PLAY */}
          <div
            className="rounded-2xl p-4 flex flex-col"
            style={{
              background: 'linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)',
              minHeight: 190,
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-purple-300/80">
                Today's Play
              </span>
              <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'pulse 2s infinite' }} />
                <span className="text-[8px] font-bold text-white/70">LIVE</span>
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-start pb-2">
              {playCompleted && playScore ? (
                <div>
                  <p className="text-[22px] font-black text-white leading-none">
                    {playScore.correct}
                    <span className="text-white/30 text-[14px] font-bold"> / {playScore.total}</span>
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mt-0.5">correct</p>
                </div>
              ) : (
                <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
                  {firstQPreview}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-auto">
              <span className="text-[10px] text-purple-200/50 font-medium">3 questions</span>
              <button
                onClick={() => {
                  if (playCompleted) setShowPlayShare(true);
                  else if (hasTodaysPlay) setShowPlayGame(true);
                }}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: '#fff', color: '#4c1d95' }}
              >
                {playCompleted ? 'Share' : 'Play'}
              </button>
            </div>
          </div>

          {/* DAILY CALL */}
          <div
            className="rounded-2xl p-4 flex flex-col"
            style={{
              background: 'linear-gradient(160deg,#1e3a8a 0%,#1e1b4b 100%)',
              minHeight: 190,
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                Daily Call
              </span>
              <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'pulse 2s infinite' }} />
                <span className="text-[8px] font-bold text-white/70">LIVE</span>
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-start pb-2">
              {callCompleted && callAnswer ? (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">Your Call</p>
                  <p className="text-[13px] font-bold text-white leading-snug line-clamp-2">{callAnswer}</p>
                </div>
              ) : (
                <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
                  {callPreview}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-auto">
              <span className="text-[10px] text-blue-200/50 font-medium">1 prediction</span>
              <button
                onClick={() => {
                  if (callCompleted) setShowCallShare(true);
                  else if (hasDailyCall) setShowCallOverlay(true);
                }}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: '#fff', color: '#1e3a8a' }}
              >
                {callCompleted ? 'Share' : 'Call It'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Game overlay */}
      {showPlayGame && readyQuestions.length > 0 && (
        <TodaysPlayGame
          questions={readyQuestions}
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
          onComplete={(answer) => {
            setCallAnswer(answer);
            setCallCompleted(true);
            setShowCallOverlay(false);
            setShowCallAfter(true);
          }}
          onClose={() => setShowCallOverlay(false)}
        />
      )}

      {/* After-game sheet — Daily Call only */}
      <AfterGameSheet
        open={showCallAfter}
        onClose={() => setShowCallAfter(false)}
        onShareScore={() => setShowCallShare(true)}
        type="call"
      />

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
        streak={streak}
        userId={user?.id}
        onClose={() => setShowCallShare(false)}
      />
    </>
  );
}
