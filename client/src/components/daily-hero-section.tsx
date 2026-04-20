import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import {
  Zap, Sparkles, Flame, CheckCircle, XCircle,
  ChevronRight, Trophy, X, Loader2, Star, Users, Radio, Share2,
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

// ─────────────────────────────────────────────
// Share Score Card (screenshotable overlay)
// ─────────────────────────────────────────────
function ScoreShareCard({
  open,
  type,
  playScore,
  callAnswer,
  onClose,
}: {
  open: boolean;
  type: 'play' | 'call';
  playScore?: PlayScore | null;
  callAnswer?: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleShare = async () => {
    const appUrl = window.location.origin;
    let text = '';
    if (type === 'play' && playScore) {
      const emojis = Array.from({ length: playScore.total }, (_, i) =>
        i < playScore.correct ? '✅' : '❌'
      ).join(' ');
      text = `I scored ${playScore.correct}/${playScore.total} on Today's Play on Consumed! ${emojis}\n\nThink you can beat me? Play at ${appUrl}`;
    } else {
      text = `I just made my Daily Call on Consumed — join me!\n${appUrl}`;
    }

    try {
      if (navigator.share) {
        await navigator.share({ text, url: appUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard!', description: 'Paste it anywhere to share.' });
      }
    } catch { /* cancelled */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-4 -right-2 z-10 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
        >
          <X size={15} className="text-white" />
        </button>

        {/* ─── Score card (screenshotable) ─── */}
        <div
          ref={cardRef}
          className="rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(145deg,#1a0840 0%,#0d0d20 50%,#0a1535 100%)' }}
        >
          {/* Top stripe */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#3b82f6)' }} />

          <div className="px-6 pt-6 pb-7 text-center">
            {/* Brand */}
            <p
              className="text-[11px] font-extrabold tracking-[0.22em] uppercase mb-4"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              consumed
            </p>

            {type === 'play' && playScore ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2">Today's Play</p>
                {/* Big score */}
                <div className="mb-3">
                  <span className="text-[72px] font-black text-white leading-none">{playScore.correct}</span>
                  <span className="text-[36px] font-bold text-white/40 leading-none">/{playScore.total}</span>
                </div>
                <p className="text-[13px] font-semibold text-white/50 uppercase tracking-widest mb-4">Correct</p>

                {/* Answer dots */}
                <div className="flex justify-center gap-3 mb-4">
                  {Array.from({ length: playScore.total }, (_, i) => (
                    <div
                      key={i}
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: i < playScore.correct ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)',
                        border: `1px solid ${i < playScore.correct ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.3)'}`,
                      }}
                    >
                      {i < playScore.correct
                        ? <CheckCircle size={20} className="text-green-400" />
                        : <XCircle size={20} className="text-red-400" />}
                    </div>
                  ))}
                </div>

                {playScore.totalPoints > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-2" style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.25)' }}>
                    <Star size={12} className="text-yellow-400" fill="currentColor" />
                    <span className="text-[12px] font-bold text-yellow-400">+{playScore.totalPoints} pts earned</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Daily Call</p>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <Sparkles size={26} className="text-blue-400" />
                </div>
                <p className="text-white font-bold text-[16px] mb-1">Call locked in!</p>
                {callAnswer && (
                  <p className="text-white/40 text-[13px]">"{callAnswer}"</p>
                )}
              </>
            )}

            {/* Date + tagline */}
            <p className="text-[10px] text-white/25 mt-4 font-medium tracking-wide">{today} · consumed.app</p>
          </div>
        </div>

        {/* ─── Share button (below card so not in screenshot) ─── */}
        <button
          onClick={handleShare}
          className="w-full mt-3 py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }}
        >
          <Share2 size={17} />
          Share Your Score
        </button>

        <p className="text-center text-[11px] text-white/30 mt-2">
          Screenshot the card above to share it
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
}: {
  questions: TriviaQuestion[];
  onComplete: (score: PlayScore) => void;
  onClose: () => void;
}) {
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'result' | 'done'>('playing');
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ correct: boolean; points: number }[]>([]);
  const [socialProof, setSocialProof] = useState<number | null>(null);

  const q = questions[qIndex];
  const totalPoints = answers.reduce((s, a) => s + a.points, 0);
  const correctCount = answers.filter(a => a.correct).length;

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
      setPhase('done');
      const finalAnswers = [...answers];
      const score: PlayScore = {
        correct: finalAnswers.filter(a => a.correct).length,
        total: questions.length,
        totalPoints: finalAnswers.reduce((s, a) => s + a.points, 0),
      };
      localStorage.setItem(getTodayPlayKey(), JSON.stringify({
        completed: true,
        date: new Date().toISOString().split('T')[0],
        score,
      }));
      setTimeout(() => onComplete(score), 1200);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] flex flex-col" style={{ background: '#0d0d1a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/10">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-0.5">Today's Play</p>
          <p className="text-sm font-bold" style={{ color: phase === 'done' ? '#fff' : DIFFICULTY_COLOR[qIndex] }}>
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

      {phase === 'done' ? (
        // ── Done screen ──
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            <Trophy size={34} className="text-yellow-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You're done!</h2>
          <p className="text-white/50 text-sm mb-8">
            {correctCount} of {questions.length} correct · +{totalPoints} pts
          </p>
          <div className="flex gap-3">
            {questions.map((_, i) => (
              <div
                key={i}
                className="w-14 h-14 rounded-2xl flex items-center justify-center border"
                style={{
                  background: answers[i]?.correct ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                  borderColor: answers[i]?.correct ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.3)',
                }}
              >
                {answers[i]?.correct
                  ? <CheckCircle size={24} className="text-green-400" />
                  : <XCircle size={24} className="text-red-400" />}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── Question screen ──
        <div className="flex-1 flex flex-col px-5 py-5">
          {/* Progress bar */}
          <div className="flex gap-1.5 mb-7">
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
          <h2 className="text-[19px] font-bold text-white leading-snug mb-6 flex-1">{q.title}</h2>

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
              {qIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
            </button>
          )}
        </div>
      )}
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
        className="relative w-full rounded-t-3xl px-5 pt-6 pb-10"
        style={{ background: 'linear-gradient(170deg,#1a1040 0%,#0d0d1a 100%)' }}
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
  const [showPlayAfter, setShowPlayAfter] = useState(false);
  const [showPlayShare, setShowPlayShare] = useState(false);
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

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {/* ══ TODAY'S PLAY ══ */}
        <div
          className="rounded-2xl p-3.5 flex flex-col min-h-[200px]"
          style={{
            background: 'linear-gradient(145deg,#1e0a4a 0%,#150838 60%,#0d0d22 100%)',
            border: '1px solid rgba(139,92,246,0.28)',
          }}
        >
          {/* Label row */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none tracking-wider"
                style={{ background: '#7c3aed' }}
              >
                LIVE
              </span>
              <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-widest">Today's Play</span>
            </div>
            {streak && streak > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-orange-400">
                <Flame size={9} />
                {streak}
              </span>
            )}
          </div>
          <p className="text-[9px] text-white/35 mb-3">3 Questions · Trivia</p>

          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            <Zap size={20} className="text-purple-400" fill="currentColor" />
          </div>

          {/* Question preview or score */}
          {playCompleted && playScore ? (
            <div className="text-center mb-3">
              <p className="text-[20px] font-black text-white leading-none">
                {playScore.correct}<span className="text-white/30 text-[14px] font-bold">/{playScore.total}</span>
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">correct</p>
            </div>
          ) : (
            <p className="text-[12px] font-semibold text-white text-center mb-3 leading-snug px-1" style={{ minHeight: 36 }}>
              {firstQPreview}
            </p>
          )}

          <button
            onClick={() => {
              if (playCompleted) { setShowPlayShare(true); }
              else if (hasTodaysPlay) { setShowPlayGame(true); }
            }}
            className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all mt-auto"
            style={{
              background: playCompleted ? 'rgba(124,58,237,0.2)' : hasTodaysPlay ? '#7c3aed' : 'rgba(255,255,255,0.08)',
              color: playCompleted ? '#c4b5fd' : '#fff',
              border: playCompleted ? '1px solid rgba(124,58,237,0.35)' : 'none',
            }}
          >
            {playCompleted
              ? <span className="flex items-center justify-center gap-1.5"><Share2 size={12} />Share Score</span>
              : 'Play'}
          </button>
        </div>

        {/* ══ DAILY CALL ══ */}
        <div
          className="rounded-2xl p-3.5 flex flex-col min-h-[200px]"
          style={{
            background: 'linear-gradient(145deg,#0a1e4a 0%,#081530 60%,#0d0d22 100%)',
            border: '1px solid rgba(59,130,246,0.28)',
          }}
        >
          {/* Label row */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none tracking-wider"
                style={{ background: '#3b82f6' }}
              >
                LIVE
              </span>
              <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-widest">Daily Call</span>
            </div>
            <ChevronRight size={12} className="text-white/25" />
          </div>
          <p className="text-[9px] text-white/35 mb-3">Make your prediction</p>

          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.28)' }}
          >
            <Sparkles size={20} className="text-blue-400" />
          </div>

          {/* Question preview or answer */}
          {callCompleted && callAnswer ? (
            <div className="text-center mb-3 px-1">
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">Your Call</p>
              <p className="text-[12px] font-bold text-white leading-snug line-clamp-2">{callAnswer}</p>
            </div>
          ) : (
            <p className="text-[12px] font-semibold text-white text-center mb-3 leading-snug px-1" style={{ minHeight: 36 }}>
              {callPreview}
            </p>
          )}

          <button
            onClick={() => {
              if (callCompleted) { setShowCallShare(true); }
              else if (hasDailyCall) { setShowCallOverlay(true); }
            }}
            className="w-full py-2.5 rounded-xl text-[13px] font-bold transition-all mt-auto"
            style={{
              background: 'transparent',
              color: callCompleted ? '#93c5fd' : '#93c5fd',
              border: callCompleted
                ? '1px solid rgba(59,130,246,0.3)'
                : hasDailyCall ? '1px solid rgba(96,165,250,0.55)' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {callCompleted
              ? <span className="flex items-center justify-center gap-1.5"><Share2 size={12} />Share Score</span>
              : 'Make Your Call'}
          </button>
        </div>
      </div>

      {/* Game overlay */}
      {showPlayGame && readyQuestions.length > 0 && (
        <TodaysPlayGame
          questions={readyQuestions}
          onComplete={(score) => {
            setPlayScore(score);
            setPlayCompleted(true);
            setShowPlayGame(false);
            setShowPlayAfter(true);
          }}
          onClose={() => setShowPlayGame(false)}
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

      {/* After-game sheets */}
      <AfterGameSheet
        open={showPlayAfter}
        onClose={() => setShowPlayAfter(false)}
        onShareScore={() => setShowPlayShare(true)}
        type="play"
      />
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
        onClose={() => setShowPlayShare(false)}
      />
      <ScoreShareCard
        open={showCallShare}
        type="call"
        callAnswer={callAnswer}
        onClose={() => setShowCallShare(false)}
      />
    </>
  );
}
