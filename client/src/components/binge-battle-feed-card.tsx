import { Zap, Trash2, Trophy } from "lucide-react";
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
  onDelete?: (id: string) => void;
}

function parseContent(content: string, fallbackTitle?: string) {
  // Expected format: "{winner} just beat {opponent} in a Binge Battle on {title}!"
  const match = content.match(/^(.+?) just beat (.+?) in a Binge Battle on (.+?)!?$/i);
  if (match) {
    return {
      winner: match[1].trim(),
      opponent: match[2].trim(),
      title: match[3].trim(),
    };
  }
  return { winner: null, opponent: null, title: fallbackTitle || null };
}

export default function BingeBattleFeedCard({ post, isOwn, onDelete }: BingeBattleFeedCardProps) {
  const [, setLocation] = useLocation();
  const { winner, opponent, title } = parseContent(post.content, post.media_title);

  return (
    <div className="relative rounded-2xl overflow-hidden mb-4 shadow-lg" style={{ background: "linear-gradient(135deg, #3b0764 0%, #4c1d95 40%, #5b21b6 100%)" }}>
      {/* Delete button — top right, only for own post */}
      {isOwn && onDelete && (
        <button
          onClick={() => onDelete(post.id)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/90 transition-colors"
          aria-label="Delete post"
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="flex items-stretch gap-0">
        {/* Main content */}
        <div className="flex-1 p-4 pr-3 flex flex-col gap-2">
          {/* Label pill */}
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-yellow-400" fill="currentColor" />
            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Binge Battle</span>
          </div>

          {/* Winner headline */}
          {winner ? (
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400 shrink-0" />
              <span className="text-white font-extrabold text-[20px] leading-tight">{winner} Won!</span>
            </div>
          ) : (
            <span className="text-white font-extrabold text-[18px] leading-tight">{post.content}</span>
          )}

          {/* Narrative line */}
          {winner && opponent && (
            <p className="text-white/70 text-[12px] leading-snug">
              {winner} and {opponent} went head to head in a Binge Battle
              {title ? <> on <span className="text-white/90 font-semibold">{title}</span></> : null}
            </p>
          )}

          {/* CTA button */}
          <button
            onClick={() => setLocation("/play/binge-battle")}
            className="mt-1 self-start px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors border border-white/20"
          >
            <Zap size={11} fill="currentColor" />
            Start Your Own Battle
          </button>
        </div>

        {/* Media cover */}
        {post.image_url && (
          <div className="w-[72px] shrink-0 self-stretch">
            <img
              src={post.image_url}
              alt={title || post.media_title || ""}
              className="w-full h-full object-cover"
              style={{ minHeight: 120 }}
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
