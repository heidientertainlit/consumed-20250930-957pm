import { Zap } from "lucide-react";
import { useLocation } from "wouter";

interface ClashUser {
  displayName: string;
  username: string;
  dnaLabel: string;
  rating: number;
  initials: string;
  color: string;
}

interface DnaClashFeedCardProps {
  user1: ClashUser;
  user2: ClashUser;
  mediaTitle: string;
  mediaType?: string;
  externalId?: string;
  externalSource?: string;
}

function StarRating({ rating, color }: { rating: number; color: string }) {
  return (
    <span className="font-bold text-[13px]" style={{ color }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))} {rating}
    </span>
  );
}

function Avatar({ user, size = 44 }: { user: ClashUser; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        background: user.color,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.15), 0 0 12px ${user.color}99`,
        fontSize: size * 0.33,
      }}
    >
      {user.initials}
    </div>
  );
}

function Waveform() {
  return (
    <svg width="52" height="44" viewBox="0 0 52 44" fill="none" className="shrink-0">
      <defs>
        <filter id="clash-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="clash-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* Discordant waveform — jagged, uneven peaks to suggest conflict */}
      <path
        d="M0,22 L5,22 L7,8 L9,36 L11,14 L13,30 L16,22 L19,4 L21,40 L23,16 L25,22 L27,6 L29,38 L31,18 L34,22 L37,10 L39,34 L41,20 L43,26 L45,22 L52,22"
        stroke="url(#clash-wave)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#clash-glow)"
      />
    </svg>
  );
}

export default function DnaClashFeedCard({
  user1,
  user2,
  mediaTitle,
  mediaType,
  externalId,
  externalSource,
}: DnaClashFeedCardProps) {
  const [, setLocation] = useLocation();
  const diff = Math.abs(user1.rating - user2.rating);
  const diffLabel = diff >= 4 ? "completely opposite" : diff >= 3 ? "miles apart" : "on different pages";

  const handleCTA = () => {
    if (externalId && externalSource && mediaType) {
      setLocation(`/media/${mediaType}/${externalSource}/${externalId}`);
    }
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-4 shadow-lg"
      style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #2d1465 45%, #3b1a78 100%)" }}
    >
      <div className="p-4 flex gap-3 items-center">
        {/* Left: text content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Label */}
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-purple-300 shrink-0" fill="currentColor" />
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
              Entertainment DNA Clash
            </span>
          </div>

          {/* Headline */}
          <p className="text-white font-extrabold text-[17px] leading-tight">
            Completely different takes.
          </p>

          {/* Ratings summary */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-[11px] w-[72px] truncate">{user1.displayName}</span>
              <StarRating rating={user1.rating} color="#fbbf24" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-[11px] w-[72px] truncate">{user2.displayName}</span>
              <StarRating rating={user2.rating} color="#c084fc" />
            </div>
          </div>

          {/* Media title */}
          <p className="text-white/50 text-[11px] truncate">on {mediaTitle}</p>

          {/* DNA labels */}
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${user1.color}33`, color: user1.color, border: `1px solid ${user1.color}55` }}
            >
              {user1.dnaLabel}
            </span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${user2.color}33`, color: user2.color, border: `1px solid ${user2.color}55` }}
            >
              {user2.dnaLabel}
            </span>
          </div>

          {/* CTA */}
          <button
            onClick={handleCTA}
            className="mt-1 self-start px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-white/15"
          >
            <Zap size={10} fill="currentColor" className="text-purple-300" />
            Which side are you on?
          </button>
        </div>

        {/* Right: avatars + waveform */}
        <div className="flex items-center gap-0 shrink-0">
          <Avatar user={user1} size={46} />
          <Waveform />
          <Avatar user={user2} size={46} />
        </div>
      </div>
    </div>
  );
}
