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

// Parse "X% of players agree · N votes" into {pct, votes}
function parseHighlight(highlight?: string): { pct: string | null; votes: string | null } {
  if (!highlight) return { pct: null, votes: null };
  const pctMatch = highlight.match(/^(\d+)%/);
  const votesMatch = highlight.match(/(\d+)\s+vote/);
  return {
    pct: pctMatch ? `${pctMatch[1]}% agreed` : null,
    votes: votesMatch ? `${votesMatch[1]} votes` : null,
  };
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

  // Trivia cards open in expanded state by default (show pills + "Answer to earn" button)
  // showOptions: true = showing actual answer rows
  const [expanded, setExpanded] = useState(hasInlineTrivia);
  const [showOptions, setShowOptions] = useState(false);
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
      // silent fail
    } finally {
      setIsSubmitting(false);
    }
  };

  const pts = card.pointsReward ?? 10;
  const { pct, votes } = parseHighlight(card.highlight);

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

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden mb-3">
      <div className="px-4 pt-4 pb-4">

        {/* Avatar · name · timestamp · type pill */}
        <div className="flex items-center gap-2 mb-3">
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
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
              {pill.label}
            </span>
          )}
        </div>

        {/* Challenge headline */}
        <p className="font-semibold text-gray-900 leading-snug mb-1">
          {card.headline}
        </p>

        {/* Question in italic */}
        {card.detail && (
          <p className="text-sm text-gray-600 italic mb-3">
            &ldquo;{card.detail}&rdquo;
          </p>
        )}

        {/* Stats: plain text when collapsed, pill badges when expanded */}
        {card.highlight && !expanded && (
          <p className="text-xs text-gray-400 mb-3">{card.highlight}</p>
        )}

        {card.highlight && expanded && (pct || votes) && (
          <div className="flex items-center gap-2 mb-4">
            {pct && (
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                {pct}
              </span>
            )}
            {votes && (
              <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-500">
                {votes}
              </span>
            )}
          </div>
        )}

        {/* Wrong answer chips (non-expanded only) */}
        {!expanded && (card.userAnswer || card.correctAnswer) && (
          <div className="flex flex-wrap gap-2 mb-3">
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

        {/* Default (not expanded): stat text + CTA */}
        {!expanded && (
          <div className="flex items-center justify-between">
            <span />
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

        {/* Intermediate state: "Answer to earn +N pts" button */}
        {expanded && !showOptions && hasInlineTrivia && (
          <button
            onClick={() => setShowOptions(true)}
            className="w-full py-3.5 border border-blue-200 rounded-2xl text-center text-blue-600 font-medium text-sm bg-blue-50 active:bg-blue-100 transition-colors"
          >
            Answer to earn +{pts} pts
          </button>
        )}

        {/* Options state */}
        {expanded && showOptions && hasInlineTrivia && (
          <div className="space-y-2.5">
            {card.options!.map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === card.correctAnswer;
              const showResult = result !== null && isSelected;
              const showCorrectHighlight = result !== null && isCorrect && !isSelected;

              let rowStyle = 'border border-gray-200 bg-white text-gray-900';
              if (showResult && result === 'correct') rowStyle = 'border border-green-500 bg-green-50 text-green-800';
              else if (showResult && result === 'wrong') rowStyle = 'border border-red-400 bg-red-50 text-red-800';
              else if (showCorrectHighlight) rowStyle = 'border border-green-400 bg-green-50 text-green-700';
              else if (isSelected && !result) rowStyle = 'border border-purple-400 bg-purple-50 text-purple-900';

              return (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={!!selectedAnswer || isSubmitting}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-normal transition-colors flex items-center justify-between ${rowStyle} ${!selectedAnswer ? 'active:bg-gray-50' : ''}`}
                >
                  <span>{option}</span>
                  {showResult && result === 'correct' && isSelected && (
                    <Check size={15} className="text-green-600 shrink-0" />
                  )}
                  {showResult && result === 'wrong' && isSelected && (
                    <X size={15} className="text-red-500 shrink-0" />
                  )}
                  {showCorrectHighlight && (
                    <Check size={15} className="text-green-500 shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Footer */}
            {result ? (
              <p className={`text-xs font-medium pt-1 ${result === 'correct' ? 'text-green-600' : 'text-red-500'}`}>
                {result === 'correct'
                  ? `Correct! +${pts} pts`
                  : `Not quite — the answer was "${card.correctAnswer}"`}
              </p>
            ) : (
              <p className="text-xs text-gray-400 pt-1">Tap to answer · +{pts} pts</p>
            )}
          </div>
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
  const gm = post._rawPost?.gameMoment || post.gameMoment || null;
  const agreementPct: number | null = gm?.agreement_pct ?? null;
  const totalVotes: number = gm?.total_votes ?? 0;
  const correctAnswer: string | null = gm?.correct_answer || null;
  const poolTitle: string = gm?.pool_title || post.mediaTitle || post._rawPost?.media_title || '';
  const options: string[] = gm?.options || [];
  const predictionPoolId: string | undefined = gm?.prediction_pool_id;

  const user = post.user;
  const name = user?.displayName || user?.username || 'Someone';

  const agreementText = (agreementPct !== null && totalVotes > 0)
    ? `${agreementPct}% of players agree · ${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`
    : undefined;

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
