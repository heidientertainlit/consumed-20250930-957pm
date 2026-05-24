import { Zap, Trash2, Trophy, Swords } from "lucide-react";
import { useLocation } from "wouter";

interface BingeBattleFeedCardProps {
  post: {
    id: string;
    content: string;
    image_url?: string;
    media_title?: string;
    timestamp?: string;
    user?: {
      displayName?: string;
      username?: string;
    };
  };
  isOwn?: boolean;
  isPromo?: boolean;
  onDelete?: (id: string) => void;
}

function parseContent(content: string, fallbackTitle?: string) {
  const match = content.match(/^(.+?) just beat (.+?) in a Binge Battle on (.+?)!?$/i);
  if (match) {
    return { winner: match[1].trim(), opponent: match[2].trim(), title: match[3].trim() };
  }
  return { winner: null, opponent: null, title: fallbackTitle || null };
}

export default function BingeBattleFeedCard({ post, isOwn, isPromo, onDelete }: BingeBattleFeedCardProps) {
  const [, setLocation] = useLocation();
  const { winner, opponent, title } = parseContent(post.content, post.media_title);

  const displayTitle = title || post.media_title || "this title";
  const displayWinner = winner || post.user?.displayName || post.user?.username || null;
  const displayOpponent = opponent || "their opponent";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4 relative">

      {/* Delete button */}
      {isOwn && onDelete && (
        <button
          onClick={() => onDelete(post.id)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Delete post"
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="flex items-stretch">
        {/* Main content */}
        <div className="flex-1 flex flex-col">

          {/* Header row */}
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
            <Zap size={11} className="text-amber-500 shrink-0" fill="currentColor" />
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">Binge Battle</span>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 flex flex-col gap-2.5 flex-1">
            {isPromo || !displayWinner ? (
              <>
                <div className="flex items-start gap-2">
                  <Swords size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-gray-900 font-extrabold text-[18px] leading-tight">
                    {post.content || "Race a friend. First to finish wins."}
                  </span>
                </div>
                <button
                  onClick={() => setLocation("/play/binge-battle")}
                  className="mt-1 self-start px-4 py-2 rounded-xl text-[12px] font-bold text-white flex items-center gap-1.5 transition-colors"
                  style={{ background: '#f59e0b' }}
                >
                  <Zap size={11} fill="currentColor" />
                  Start a Binge Battle
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <Trophy size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-gray-900 font-extrabold text-[18px] leading-tight">
                    {displayWinner} Won!
                  </span>
                </div>
                <p className="text-gray-500 text-[13px] leading-snug">
                  <span className="text-gray-800 font-semibold">{displayWinner}</span>
                  {" beat "}
                  <span className="text-gray-800 font-semibold">{displayOpponent}</span>
                  {" in a "}
                  <span className="text-gray-800 font-semibold">{displayTitle}</span>
                  {" binge battle. "}
                  <span className="text-amber-500 font-bold">+100 pts</span>
                </p>
                <button
                  onClick={() => setLocation("/play/binge-battle")}
                  className="mt-1 self-start px-4 py-2 rounded-xl text-[12px] font-bold text-white flex items-center gap-1.5 transition-colors"
                  style={{ background: '#f59e0b' }}
                >
                  <Zap size={11} fill="currentColor" />
                  Start Your Own
                </button>
              </>
            )}
          </div>
        </div>

        {/* Media cover — flush right, rounded on right side only */}
        {post.image_url && (
          <div className="w-[80px] shrink-0 self-stretch overflow-hidden" style={{ borderRadius: '0 16px 16px 0' }}>
            <img
              src={post.image_url}
              alt={displayTitle}
              className="w-full h-full object-cover"
              style={{ minHeight: 140 }}
              onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
