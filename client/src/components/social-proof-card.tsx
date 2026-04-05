import { useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Play, Check, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export type SocialProofVariant =
  | 'wrong_answer'
  | 'prediction_made'
  | 'vote_cast'
  | 'trivia_score'
  | 'leaderboard_move'
  | 'hot_take'
  | 'streak_callout'
  | 'divided_house'
  | 'rival_alert';

export interface SocialProofCardData {
  id: string;
  variant: SocialProofVariant;
  user?: { username: string; displayName: string; avatar?: string };
  headline: string;
  detail?: string;
  userAnswer?: string;
  correctAnswer?: string;
  highlight?: string;
  highlightValue?: number;
  ctaLabel: string;
  ctaHref: string;
  timestamp?: string;
  // Inline trivia fields
  options?: string[];
  predictionPoolId?: string;
  pointsReward?: number;
}

const TYPE_PILL: Record<SocialProofVariant, { label: string } | null> = {
  trivia_score:     { label: 'Trivia' },
  wrong_answer:     { label: 'Trivia' },
  prediction_made:  { label: 'Prediction' },
  vote_cast:        { label: 'Poll' },
  hot_take:         { label: 'Poll' },
  divided_house:    { label: 'Poll' },
  leaderboard_move: null,
  rival_alert:      null,
  streak_callout:   null,
};

function timeAgo(ts?: string) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${m}m`;
}

export function SocialProofCard({ card }: { card: SocialProofCardData }) {
  const pill = TYPE_PILL[card.variant];
  const { session } = useAuth();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const hasInlineTrivia = !!(
    (card.variant === 'trivia_score' || card.variant === 'wrong_answer') &&
    card.options && card.options.length > 0 &&
    card.predictionPoolId
  );

  const [expanded, setExpanded] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const handleAnswer = async (option: string) => {
    if (selectedAnswer || isSubmitting) return;
    setSelectedAnswer(option);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          pool_id: card.predictionPoolId,
          prediction: option,
          score: option === card.correctAnswer ? 1 : 0,
        }),
      });

      if (response.ok) {
        setResult(option === card.correctAnswer ? 'correct' : 'wrong');
      }
    } catch {
      // silent fail — result stays null
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leaderboard / system cards (no user) — compact purple notification strip
  if (!card.user) {
    return (
      <Link to={card.ctaHref}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-50 border border-purple-100 mb-3 active:opacity-75 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
            <Play size={10} className="text-white ml-0.5" />
          </div>
          <p className="text-sm text-purple-900 flex-1 leading-snug">{card.headline}</p>
          <ChevronRight size={14} className="text-purple-400 shrink-0" />
        </div>
      </Link>
    );
  }

  const pts = card.pointsReward ?? 10;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden mb-3">
      {/* Header row + content */}
      <div className="px-4 pt-4 pb-3">
        {/* Avatar · name · timestamp · type pill */}
        <div className="flex items-center gap-2 mb-2.5">
          {card.user.avatar ? (
            <img
              src={card.user.avatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs text-white font-semibold flex-shrink-0">
              {(card.user.displayName || card.user.username || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">
              {card.user.displayName || card.user.username}
            </span>
            {card.timestamp && (
              <span className="text-xs text-gray-400"> · {timeAgo(card.timestamp)}</span>
            )}
          </div>
          {pill && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 shrink-0">
              {pill.label}
            </span>
          )}
        </div>

        {/* Challenge headline */}
        <p className="text-sm font-medium text-gray-900 leading-snug mb-2">
          {card.headline}
        </p>

        {/* Question/pool title in italic */}
        {card.detail && (
          <p className="text-xs text-gray-500 italic mb-2.5">
            &ldquo;{card.detail}&rdquo;
          </p>
        )}

        {/* Their answer + correct answer chips (wrong_answer variant, not expanded) */}
        {!expanded && (card.userAnswer || card.correctAnswer) && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {card.userAnswer && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">They said:</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {card.userAnswer}
                </span>
              </div>
            )}
            {card.correctAnswer && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Right answer:</span>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                  {card.correctAnswer}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Inline trivia options (expanded) */}
        {expanded && hasInlineTrivia && (
          <div className="mt-2.5 space-y-2">
            {card.options!.map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === card.correctAnswer;
              const showResult = result !== null && isSelected;
              const showCorrectHighlight = result !== null && isCorrect;

              let optionStyle = 'border border-gray-200 bg-white text-gray-900';
              if (showResult && result === 'correct') {
                optionStyle = 'border border-green-500 bg-green-50 text-green-800';
              } else if (showResult && result === 'wrong') {
                optionStyle = 'border border-red-400 bg-red-50 text-red-800';
              } else if (showCorrectHighlight && selectedAnswer && !isSelected) {
                optionStyle = 'border border-green-400 bg-green-50 text-green-700';
              } else if (isSelected && !result) {
                optionStyle = 'border border-purple-400 bg-purple-50 text-purple-900';
              }

              return (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={!!selectedAnswer || isSubmitting}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${optionStyle} ${!selectedAnswer ? 'active:bg-gray-50' : ''}`}
                >
                  <span>{option}</span>
                  {showResult && result === 'correct' && isSelected && (
                    <Check size={15} className="text-green-600 shrink-0" />
                  )}
                  {showResult && result === 'wrong' && isSelected && (
                    <X size={15} className="text-red-500 shrink-0" />
                  )}
                  {showCorrectHighlight && selectedAnswer && !isSelected && (
                    <Check size={15} className="text-green-500 shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Result message */}
            {result && (
              <p className={`text-xs font-medium mt-1 ${result === 'correct' ? 'text-green-600' : 'text-red-500'}`}>
                {result === 'correct'
                  ? `Correct! +${pts} pts`
                  : `Not quite — the answer was "${card.correctAnswer}"`}
              </p>
            )}

            {!result && (
              <p className="text-xs text-gray-400 mt-1">Tap to answer · +{pts} pts</p>
            )}
          </div>
        )}

        {/* Vote stat + CTA on same row */}
        {!expanded && (
          <div className="flex items-center justify-between mt-2.5">
            {card.highlight ? (
              <p className="text-[11px] text-gray-400">{card.highlight}</p>
            ) : (
              <span />
            )}
            {hasInlineTrivia ? (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs font-medium text-purple-600 active:opacity-70 transition-opacity"
              >
                {card.ctaLabel} ›
              </button>
            ) : (
              <Link to={card.ctaHref}>
                <span className="text-xs font-medium text-purple-600 active:opacity-70 transition-opacity">
                  {card.ctaLabel} ›
                </span>
              </Link>
            )}
          </div>
        )}

        {/* When expanded but no answer yet — show vote stat */}
        {expanded && card.highlight && !result && (
          <p className="text-[11px] text-gray-400 mt-2.5">{card.highlight}</p>
        )}
      </div>
    </div>
  );
}

export function buildGameMomentSocialProof(post: any): SocialProofCardData {
  const rawContent = post._rawPost?.content || post.content || '';
  let parsed: any = {};
  try { parsed = JSON.parse(rawContent); } catch {}

  const { answer, gameType, isCorrect } = parsed;
  // Enriched data added by the social-feed edge function
  const gm = post._rawPost?.gameMoment || post.gameMoment || null;
  const agreementPct: number | null = gm?.agreement_pct ?? null;
  const totalVotes: number = gm?.total_votes ?? 0;
  const correctAnswer: string | null = gm?.correct_answer || null;
  const poolTitle: string = gm?.pool_title || post.mediaTitle || post._rawPost?.media_title || '';
  const options: string[] = gm?.options || [];
  const predictionPoolId: string | undefined = gm?.prediction_pool_id;

  const user = post.user;
  const name = user?.displayName || user?.username || 'Someone';

  // Agreement % copy — shown when we have vote data
  const agreementText = (agreementPct !== null && totalVotes > 0)
    ? `${agreementPct}% of players agree · ${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`
    : undefined;

  // Truncate long answers so they fit in headline copy
  const shortAnswer = answer && answer.length > 30 ? answer.slice(0, 27) + '…' : answer;

  if (gameType === 'trivia') {
    if (isCorrect === false) {
      const pctRight = (agreementPct !== null && totalVotes > 0)
        ? `${100 - agreementPct}% of players got it right`
        : undefined;
      return {
        id: `sp-${post.id}`,
        variant: 'wrong_answer',
        user,
        headline: `${name} got this wrong — can you?`,
        detail: poolTitle || undefined,
        userAnswer: answer || undefined,
        correctAnswer: correctAnswer || undefined,
        highlight: pctRight,
        highlightValue: pctRight ? (100 - agreementPct!) : undefined,
        ctaLabel: 'Try it yourself',
        ctaHref: '/play/trivia',
        timestamp: post.timestamp,
        options,
        predictionPoolId,
        pointsReward: 10,
      };
    }
    return {
      id: `sp-${post.id}`,
      variant: 'trivia_score',
      user,
      headline: `${name} nailed it — think you can too?`,
      detail: poolTitle || undefined,
      highlight: agreementText,
      highlightValue: agreementPct ?? undefined,
      ctaLabel: 'Play trivia',
      ctaHref: '/play/trivia',
      timestamp: post.timestamp,
      options,
      predictionPoolId,
      pointsReward: 10,
    };
  }

  if (gameType === 'prediction') {
    return {
      id: `sp-${post.id}`,
      variant: 'prediction_made',
      user,
      headline: shortAnswer
        ? `${name} went with "${shortAnswer}" — what's your pick?`
        : `${name} made a prediction — weigh in`,
      detail: poolTitle || undefined,
      highlight: agreementText,
      highlightValue: agreementPct ?? undefined,
      ctaLabel: 'Make your pick',
      ctaHref: '/play/predictions',
      timestamp: post.timestamp,
    };
  }

  if (gameType === 'poll') {
    return {
      id: `sp-${post.id}`,
      variant: 'vote_cast',
      user,
      headline: shortAnswer
        ? `${name} voted "${shortAnswer}" — do you agree?`
        : `${name} voted — cast yours`,
      detail: poolTitle || undefined,
      highlight: agreementText,
      highlightValue: agreementPct ?? undefined,
      ctaLabel: 'Cast your vote',
      ctaHref: '/play/polls',
      timestamp: post.timestamp,
    };
  }

  return {
    id: `sp-${post.id}`,
    variant: 'vote_cast',
    user,
    headline: `${name} just played — your turn`,
    detail: poolTitle || undefined,
    ctaLabel: 'Play now',
    ctaHref: '/play',
    timestamp: post.timestamp,
  };
}

export function buildLeaderboardSocialProof(item: any, index: number): SocialProofCardData {
  const text: string = item.text || item.title || '';
  const isRivalAlert = text.toLowerCase().includes('passed') || text.toLowerCase().includes('ahead');
  const isStreakAlert = text.toLowerCase().includes('streak');

  if (isRivalAlert) {
    return {
      id: `sp-leader-${index}`,
      variant: 'rival_alert',
      headline: text,
      ctaLabel: 'Play to retake your spot',
      ctaHref: item.link || '/leaderboard',
    };
  }

  if (isStreakAlert) {
    return {
      id: `sp-leader-${index}`,
      variant: 'streak_callout',
      headline: text,
      ctaLabel: 'Keep your streak',
      ctaHref: item.link || '/play',
    };
  }

  return {
    id: `sp-leader-${index}`,
    variant: 'leaderboard_move',
    headline: text,
    ctaLabel: 'Play now',
    ctaHref: item.link || '/leaderboard',
  };
}
