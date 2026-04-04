import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Trophy, Vote, Zap } from "lucide-react";

interface GameMomentCardProps {
  post: {
    id: string;
    user?: { id: string; username: string; displayName: string; avatar?: string };
    creator?: { id: string; username: string; displayName: string; avatar?: string };
    content?: string;
    mediaTitle?: string;
    timestamp?: string;
    created_at?: string;
    prediction_pool_id?: string;
    _rawPost?: any;
  };
}

interface MomentData {
  answer: string;
  gameType: 'poll' | 'predict' | 'trivia';
  isCorrect: boolean | null;
}

function parseMomentData(content: string): MomentData {
  try {
    const parsed = JSON.parse(content);
    return {
      answer: parsed.answer || '',
      gameType: parsed.gameType || 'poll',
      isCorrect: parsed.isCorrect ?? null,
    };
  } catch {
    return { answer: content || '', gameType: 'poll', isCorrect: null };
  }
}

function getActionText(gameType: string) {
  switch (gameType) {
    case 'trivia': return 'answered a trivia question';
    case 'predict': return 'made a prediction';
    default: return 'voted on a poll';
  }
}

function getGameIcon(gameType: string) {
  switch (gameType) {
    case 'trivia': return <Zap size={13} className="text-yellow-500" />;
    case 'predict': return <Trophy size={13} className="text-purple-500" />;
    default: return <Vote size={13} className="text-blue-500" />;
  }
}

function getGameLabel(gameType: string) {
  switch (gameType) {
    case 'trivia': return 'Trivia';
    case 'predict': return 'Prediction';
    default: return 'Poll';
  }
}

export function GameMomentCard({ post }: GameMomentCardProps) {
  const raw = post._rawPost || post;
  const userObj = raw.user || raw.creator || post.user || post.creator;
  const content = raw.content || post.content || '';
  const gameTitle = raw.mediaTitle || raw.media_title || post.mediaTitle || '';
  const timestamp = raw.timestamp || raw.created_at || raw.createdAt || post.timestamp || post.created_at || '';

  const moment = parseMomentData(content);

  const avatarInitial = (userObj?.displayName || userObj?.display_name || userObj?.username || '?')[0]?.toUpperCase();
  const displayName = userObj?.displayName || userObj?.display_name || userObj?.username || 'Someone';

  const answerPillClass = moment.isCorrect === true
    ? 'bg-green-100 text-green-700 border border-green-200'
    : moment.isCorrect === false
    ? 'bg-red-100 text-red-700 border border-red-200'
    : 'bg-purple-100 text-purple-700 border border-purple-200';

  const formattedTime = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
      <div className="flex items-start gap-3">
        <Link href={`/user/${userObj?.id}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm cursor-pointer flex-shrink-0 overflow-hidden">
            {userObj?.avatar || userObj?.avatarUrl || userObj?.avatar_url ? (
              <img src={userObj.avatar || userObj.avatarUrl || userObj.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{avatarInitial}</span>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/user/${userObj?.id}`}>
              <span className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer">{displayName}</span>
            </Link>
            <span className="text-sm text-gray-500">{getActionText(moment.gameType)}</span>
          </div>
          {formattedTime && (
            <p className="text-xs text-gray-400 mt-0.5">{formattedTime}</p>
          )}

          <div className="mt-2.5 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              {getGameIcon(moment.gameType)}
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{getGameLabel(moment.gameType)}</span>
            </div>
            {gameTitle && (
              <p className="text-sm font-medium text-gray-900 leading-snug mb-2">{gameTitle}</p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Answered:</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${answerPillClass} flex items-center gap-1`}>
                {moment.isCorrect === true && <CheckCircle size={11} />}
                {moment.isCorrect === false && <XCircle size={11} />}
                {moment.answer}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
