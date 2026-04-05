import { Link } from 'wouter';
import { ChevronRight, Trophy, Zap, Target, Users, TrendingUp, ThumbsUp, Brain } from 'lucide-react';

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
}

const VARIANT_CONFIG: Record<SocialProofVariant, {
  Icon: any;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  iconBg: string;
}> = {
  wrong_answer:     { Icon: Brain,       borderColor: 'border-orange-500/25', bgColor: 'bg-orange-500/5',  iconColor: 'text-orange-400',  iconBg: 'bg-orange-500/15' },
  prediction_made:  { Icon: Target,      borderColor: 'border-purple-500/25', bgColor: 'bg-purple-500/5',  iconColor: 'text-purple-400',  iconBg: 'bg-purple-500/15' },
  vote_cast:        { Icon: ThumbsUp,    borderColor: 'border-violet-500/25', bgColor: 'bg-violet-500/5',  iconColor: 'text-violet-400',  iconBg: 'bg-violet-500/15' },
  trivia_score:     { Icon: Zap,         borderColor: 'border-yellow-500/25', bgColor: 'bg-yellow-500/5',  iconColor: 'text-yellow-400',  iconBg: 'bg-yellow-500/15' },
  leaderboard_move: { Icon: Trophy,      borderColor: 'border-yellow-500/25', bgColor: 'bg-yellow-500/5',  iconColor: 'text-yellow-400',  iconBg: 'bg-yellow-500/15' },
  hot_take:         { Icon: ThumbsUp,    borderColor: 'border-red-500/25',    bgColor: 'bg-red-500/5',     iconColor: 'text-red-400',     iconBg: 'bg-red-500/15'    },
  streak_callout:   { Icon: Zap,         borderColor: 'border-orange-500/25', bgColor: 'bg-orange-500/5',  iconColor: 'text-orange-400',  iconBg: 'bg-orange-500/15' },
  divided_house:    { Icon: Users,       borderColor: 'border-indigo-500/25', bgColor: 'bg-indigo-500/5',  iconColor: 'text-indigo-400',  iconBg: 'bg-indigo-500/15' },
  rival_alert:      { Icon: TrendingUp,  borderColor: 'border-purple-500/25', bgColor: 'bg-purple-500/5',  iconColor: 'text-purple-400',  iconBg: 'bg-purple-500/15' },
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
  const { Icon, borderColor, bgColor, iconColor, iconBg } = VARIANT_CONFIG[card.variant];

  return (
    <div className={`rounded-2xl border ${borderColor} ${bgColor} p-4 mb-3`}>

      {card.user && (
        <div className="flex items-center gap-2 mb-3">
          {card.user.avatar ? (
            <img
              src={card.user.avatar}
              alt={card.user.username}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
              {(card.user.displayName || card.user.username || '?')[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium text-gray-900">
            {card.user.displayName || card.user.username}
          </span>
          {card.timestamp && (
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(card.timestamp)}</span>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon size={14} className={iconColor} />
        </div>
        <p className="text-gray-900 font-semibold text-sm leading-snug pt-1">{card.headline}</p>
      </div>

      {card.detail && (
        <p className="text-gray-600 text-sm italic mb-3 pl-10">
          &ldquo;{card.detail}&rdquo;
        </p>
      )}

      {(card.userAnswer || card.correctAnswer) && (
        <div className="pl-10 mb-3 flex flex-wrap gap-2">
          {card.userAnswer && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">They said:</span>
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {card.userAnswer}
              </span>
            </div>
          )}
          {card.correctAnswer && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Right answer:</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {card.correctAnswer}
              </span>
            </div>
          )}
        </div>
      )}

      {card.highlight && (
        <div className="pl-10 mb-3">
          <p className="text-xs text-gray-600 mb-1">{card.highlight}</p>
          {card.highlightValue !== undefined && (
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, card.highlightValue))}%` }}
              />
            </div>
          )}
        </div>
      )}

      <Link to={card.ctaHref}>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 active:opacity-70 transition-colors">
          {card.ctaLabel}
          <ChevronRight size={13} />
        </span>
      </Link>
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
