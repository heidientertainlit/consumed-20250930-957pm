import { useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Play, Check, X, CheckCircle, XCircle } from 'lucide-react';
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
  // Inline trivia / prediction fields
  options?: string[];
  predictionPoolId?: string;
  pointsReward?: number;
  voteCounts?: Record<string, number>;
}

const VARIANT_LABEL: Record<SocialProofVariant, string | null> = {
  trivia_score:     'Trivia',
  wrong_answer:     'Trivia',
  prediction_made:  'Prediction',
  vote_cast:        'Poll',
  hot_take:         'Poll',
  divided_house:    'Poll',
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
  const label = VARIANT_LABEL[card.variant];
  const { session } = useAuth();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const hasInlineTrivia = !!(
    (card.variant === 'trivia_score' || card.variant === 'wrong_answer') &&
    card.options && card.options.length > 0 &&
    card.predictionPoolId
  );

  const hasInlinePrediction = !!(
    card.variant === 'prediction_made' &&
    card.options && card.options.length > 0 &&
    card.predictionPoolId
  );

  const hasInlinePoll = !!(
    card.variant === 'vote_cast' &&
    card.options && card.options.length > 0 &&
    card.predictionPoolId
  );

  const hasInline = hasInlineTrivia || hasInlinePrediction || hasInlinePoll;

  const [showOptions, setShowOptions] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const handleAnswer = async (option: string) => {
    if (selectedAnswer || isSubmitting) return;
    setSelectedAnswer(option);
    // Show feedback immediately — don't wait for server
    if (hasInlineTrivia) {
      setResult(option === card.correctAnswer ? 'correct' : 'wrong');
    } else {
      setSubmitted(true);
    }
    // Fire-and-forget to persist the answer
    try {
      fetch(`${supabaseUrl}/functions/v1/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          pool_id: card.predictionPoolId,
          prediction: option,
          score: hasInlineTrivia ? (option === card.correctAnswer ? 1 : 0) : 0,
        }),
      });
    } catch {
      // silent fail — feedback already shown
    }
  };

  const pts = card.pointsReward ?? 10;

  // Leaderboard / system cards (no user) — compact purple strip
  if (!card.user || !label) {
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

  const displayName = card.user.displayName || card.user.username || '';

  const renderHeadline = () => {
    const idx = displayName ? card.headline.indexOf(displayName) : -1;
    if (idx === -1) return <>{card.headline}</>;
    return (
      <>
        {card.headline.slice(0, idx)}
        <span>{displayName}</span>
        {card.headline.slice(idx + displayName.length)}
      </>
    );
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden mb-3">
      <div className="px-4 pt-4 pb-4">

        {/* Top row: type pill left, pts badge or timestamp right */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">
            {label}
          </span>
          {hasInline ? (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">
              +{pts} pts
            </span>
          ) : card.timestamp ? (
            <span className="text-xs text-gray-400">{timeAgo(card.timestamp)}</span>
          ) : null}
        </div>

        {/* Question — big bold */}
        {card.detail && (
          <p className="text-lg font-bold text-gray-900 leading-snug mb-2">
            {card.detail}
          </p>
        )}

        {/* Non-poll: soft subtitle headline */}
        {card.variant !== 'vote_cast' && (
          <p className="text-sm text-gray-500 font-medium leading-snug mb-3">
            {renderHeadline()}
          </p>
        )}

        {/* Non-poll: stats */}
        {card.variant !== 'vote_cast' && card.highlight && (
          <p className="text-sm text-gray-400 mb-4">{card.highlight}</p>
        )}

        {/* Wrong answer chips (trivia only — not polls) */}
        {card.variant !== 'vote_cast' && (card.userAnswer || card.correctAnswer) && !showOptions && (
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

        {/* Inline expand button */}
        {hasInline && !showOptions && (
          <>
            <button
              onClick={() => setShowOptions(true)}
              className="w-full py-3.5 rounded-2xl text-center text-purple-600 font-medium text-sm bg-gray-100 active:bg-gray-200 transition-colors"
            >
              {hasInlinePoll
                ? `Cast your vote · +${pts} pts`
                : hasInlinePrediction
                  ? `Make your pick · +${pts} pts`
                  : `Answer to earn +${pts} pts`}
            </button>
            {/* Poll attribution footnote — collapsed state */}
            {hasInlinePoll && card.user && (
              <p className="text-xs text-gray-400 text-center mt-2.5 leading-snug">
                {card.user.displayName?.split(' ')[0] || card.user.username}
                {card.userAnswer ? ` picked "${card.userAnswer}"` : ' already voted'}
                {card.highlight ? ` · ${card.highlight}` : ''}
              </p>
            )}
          </>
        )}

        {/* Inline options */}
        {hasInline && showOptions && (
          <div className="space-y-2.5">
            {/* Trivia: percentage bars after answering */}
            {hasInlineTrivia && result !== null ? (() => {
              const vcTotal = Object.values(card.voteCounts || {}).reduce((s: number, c: number) => s + c, 0);
              const fallbackCorrectPct = Math.round(card.highlightValue ?? 50);
              const fallbackWrongPct = (card.options?.length ?? 1) > 1
                ? Math.round((100 - fallbackCorrectPct) / ((card.options?.length ?? 1) - 1))
                : 0;
              return (
                <>
                  <div className="flex flex-col gap-2">
                    {card.options!.map((option) => {
                      const isUserAnswer = selectedAnswer === option;
                      const isCorrect = option === card.correctAnswer;
                      const pct = vcTotal > 0
                        ? Math.round(((card.voteCounts?.[option] || 0) / vcTotal) * 100)
                        : (isCorrect ? fallbackCorrectPct : fallbackWrongPct);
                      return (
                        <div
                          key={option}
                          className={`relative py-3 px-4 rounded-full overflow-hidden ${
                            isCorrect ? 'bg-green-100' : isUserAnswer ? 'bg-red-100' : 'bg-gray-100'
                          }`}
                        >
                          <div
                            className={`absolute inset-0 transition-all duration-1000 ease-out ${
                              isCorrect ? 'bg-green-200/60' : 'bg-gray-200/40'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {isCorrect && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                              {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                              <span className={`text-sm font-medium ${isCorrect ? 'text-green-800' : isUserAnswer ? 'text-red-800' : 'text-gray-800'}`}>
                                {option}
                              </span>
                              {isUserAnswer && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                }`}>You</span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-gray-600">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Link to="/play/trivia">
                    <button className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 active:opacity-90">
                      Play more trivia
                    </button>
                  </Link>
                </>
              );
            })() : hasInlineTrivia ? (
              /* Trivia: plain buttons before answering */
              <>
                {card.options!.map((option) => {
                  const isSelected = selectedAnswer === option;
                  let rowStyle = 'border border-gray-200 bg-white text-gray-900';
                  if (isSelected) rowStyle = 'border border-purple-400 bg-purple-50 text-purple-900';
                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      disabled={!!selectedAnswer}
                      className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-normal transition-colors flex items-center justify-between ${rowStyle} ${!selectedAnswer ? 'active:bg-gray-50' : ''}`}
                    >
                      <span>{option}</span>
                    </button>
                  );
                })}
                <p className="text-xs text-gray-400 pt-1">Tap to answer · +{pts} pts</p>
              </>
            ) : hasInlinePoll ? (
              /* Poll options */
              <>
                {card.options!.map((option) => {
                  const isSelected = selectedAnswer === option;
                  let rowStyle = 'border border-gray-200 bg-white text-gray-900';
                  if (isSelected && submitted) rowStyle = 'border border-purple-500 bg-purple-50 text-purple-900';
                  else if (isSelected) rowStyle = 'border border-purple-400 bg-purple-50 text-purple-900';
                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      disabled={!!selectedAnswer}
                      className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-normal transition-colors flex items-center justify-between ${rowStyle} ${!selectedAnswer ? 'active:bg-gray-50' : ''}`}
                    >
                      <span>{option}</span>
                      {isSelected && submitted && <Check size={15} className="text-purple-600 shrink-0" />}
                    </button>
                  );
                })}
                {submitted ? (
                  <p className="text-xs font-medium text-purple-600 pt-1">Vote cast! +{pts} pts</p>
                ) : (
                  <p className="text-xs text-gray-400 pt-1">Tap to cast your vote · +{pts} pts</p>
                )}
                {/* Attribution footnote — expanded state */}
                {card.user && (
                  <p className="text-xs text-gray-400 text-center pt-1 leading-snug">
                    {card.user.displayName?.split(' ')[0] || card.user.username}
                    {card.userAnswer ? ` picked "${card.userAnswer}"` : ' already voted'}
                    {card.highlight ? ` · ${card.highlight}` : ''}
                  </p>
                )}
              </>
            ) : (
              /* Prediction options */
              <>
                {card.options!.map((option) => {
                  const isSelected = selectedAnswer === option;
                  let rowStyle = 'border border-gray-200 bg-white text-gray-900';
                  if (isSelected && submitted) rowStyle = 'border border-purple-500 bg-purple-50 text-purple-900';
                  else if (isSelected) rowStyle = 'border border-purple-400 bg-purple-50 text-purple-900';
                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      disabled={!!selectedAnswer}
                      className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-normal transition-colors flex items-center justify-between ${rowStyle} ${!selectedAnswer ? 'active:bg-gray-50' : ''}`}
                    >
                      <span>{option}</span>
                      {isSelected && submitted && <Check size={15} className="text-purple-600 shrink-0" />}
                    </button>
                  );
                })}
                {submitted ? (
                  <p className="text-xs font-medium text-purple-600 pt-1">Prediction locked in! +{pts} pts when results drop</p>
                ) : (
                  <p className="text-xs text-gray-400 pt-1">Tap to make your pick · +{pts} pts</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Non-inline CTA */}
        {!hasInline && (
          <>
            <Link to={card.ctaHref}>
              <div className="w-full py-3.5 rounded-2xl text-center text-purple-600 font-medium text-sm bg-gray-100 active:bg-gray-200 transition-colors">
                {card.ctaLabel}
              </div>
            </Link>
            {/* Poll: attribution footnote below the button */}
            {card.variant === 'vote_cast' && card.user && (
              <p className="text-xs text-gray-400 text-center mt-2.5 leading-snug">
                {card.user.displayName?.split(' ')[0] || card.user.username}
                {card.userAnswer ? ` picked "${card.userAnswer}"` : ' already voted'}
                {card.highlight ? ` · ${card.highlight}` : ''}
              </p>
            )}
          </>
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
  const voteCounts: Record<string, number> | undefined = gm?.vote_counts;

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
        voteCounts: voteCounts || undefined,
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
      correctAnswer: correctAnswer || undefined,
      voteCounts: voteCounts || undefined,
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
      ctaHref: predictionPoolId ? `/play/predictions#${predictionPoolId}` : '/play/predictions',
      timestamp: post.timestamp,
      options,
      predictionPoolId,
      pointsReward: gm?.points_reward || 20,
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
      userAnswer: answer || undefined,
      highlight: agreementText,
      highlightValue: agreementPct ?? undefined,
      ctaLabel: 'Cast your vote',
      ctaHref: '/play/polls',
      timestamp: post.timestamp,
      options,
      predictionPoolId,
      pointsReward: gm?.points_reward || 10,
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
