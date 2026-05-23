import { useState } from "react";
import { Zap, X, Check } from "lucide-react";

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

function FilledStars({ rating, color }: { rating: number; color: string }) {
  return (
    <span style={{ color, fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function Avatar({ user, size = 46 }: { user: ClashUser; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        background: user.color,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 0 14px ${user.color}88`,
        fontSize: Math.round(size * 0.3),
      }}
    >
      {user.initials}
    </div>
  );
}

function Waveform() {
  return (
    <svg width="48" height="40" viewBox="0 0 48 40" fill="none" className="shrink-0">
      <defs>
        <filter id="clash-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="clash-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M0,20 L4,20 L6,6 L8,34 L10,12 L12,28 L15,20 L18,2 L20,38 L22,14 L24,20 L26,4 L28,36 L30,16 L33,20 L36,8 L38,32 L40,18 L42,24 L44,20 L48,20"
        stroke="url(#clash-wave)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#clash-glow)"
      />
    </svg>
  );
}

function VoteSheet({
  user1,
  user2,
  mediaTitle,
  voted,
  onVote,
  onClose,
}: {
  user1: ClashUser;
  user2: ClashUser;
  mediaTitle: string;
  voted: string | null;
  onVote: (username: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10 flex flex-col gap-5"
        style={{ background: "linear-gradient(160deg, #1e0a3c 0%, #2d1465 60%, #3b1a78 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + close */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <span className="text-white font-bold text-[17px]">Who's right?</span>
          <button onClick={onClose} className="p-1 rounded-full bg-white/10 text-white/50 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-white/60 text-[12px] -mt-2">
          on <span className="text-white/80 font-medium">{mediaTitle}</span>
        </p>

        {/* The two sides */}
        <div className="flex gap-3">
          {[user1, user2].map((u) => {
            const isVoted = voted === u.username;
            const otherVoted = voted && voted !== u.username;
            return (
              <button
                key={u.username}
                onClick={() => !voted && onVote(u.username)}
                className="flex-1 flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-200 border"
                style={{
                  background: isVoted ? `${u.color}22` : "rgba(255,255,255,0.05)",
                  borderColor: isVoted ? u.color : "rgba(255,255,255,0.1)",
                  opacity: otherVoted ? 0.45 : 1,
                  cursor: voted ? "default" : "pointer",
                  transform: isVoted ? "scale(1.02)" : "scale(1)",
                }}
              >
                <Avatar user={u} size={54} />
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-white font-bold text-[14px] leading-tight">{u.displayName}</span>
                  <FilledStars rating={u.rating} color={u.color} />
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
                    style={{ background: `${u.color}30`, color: u.color, border: `1px solid ${u.color}50` }}
                  >
                    {u.dnaLabel}
                  </span>
                </div>
                {isVoted && (
                  <div
                    className="flex items-center gap-1 text-[11px] font-bold mt-1"
                    style={{ color: u.color }}
                  >
                    <Check size={12} />
                    You agree
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {voted && (
          <p className="text-center text-white/50 text-[12px]">
            You're with <span className="text-white font-semibold">
              {voted === user1.username ? user1.displayName : user2.displayName}
            </span> on this one.
          </p>
        )}
      </div>
    </div>
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [voted, setVoted] = useState<string | null>(null);

  return (
    <>
      <div
        className="relative rounded-2xl overflow-hidden mb-4 shadow-lg"
        style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #2d1465 45%, #3b1a78 100%)" }}
      >
        <div className="p-4 flex gap-3 items-center">
          {/* Left: text */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Label */}
            <div className="flex items-center gap-1.5">
              <Zap size={11} className="text-purple-300 shrink-0" fill="currentColor" />
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">Clash</span>
            </div>

            {/* Headline */}
            <p className="text-white font-extrabold text-[17px] leading-tight">
              Completely different takes.
            </p>

            {/* Users + ratings — with DNA label inline */}
            <div className="flex flex-col gap-1.5 mt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${user1.color}28`, color: user1.color, border: `1px solid ${user1.color}45` }}
                >
                  {user1.dnaLabel}
                </span>
                <span className="text-white font-semibold text-[12px] shrink-0">{user1.displayName}</span>
                <FilledStars rating={user1.rating} color={user1.color} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: `${user2.color}28`, color: user2.color, border: `1px solid ${user2.color}45` }}
                >
                  {user2.dnaLabel}
                </span>
                <span className="text-white font-semibold text-[12px] shrink-0">{user2.displayName}</span>
                <FilledStars rating={user2.rating} color={user2.color} />
              </div>
            </div>

            {/* Media title */}
            <p className="text-white/40 text-[11px] truncate">on {mediaTitle}</p>

            {/* CTA */}
            <button
              onClick={() => setSheetOpen(true)}
              className="mt-1 self-start px-3 py-1.5 rounded-xl text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-white/15"
              style={{
                background: voted ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.10)",
              }}
            >
              <Zap size={10} fill="currentColor" className="text-purple-300" />
              {voted ? "You voted · See result" : "Which side are you on?"}
            </button>
          </div>

          {/* Right: avatars + waveform */}
          <div className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <Avatar user={user1} size={44} />
              <span className="text-white/30 text-[8px] font-semibold uppercase tracking-wide" style={{ maxWidth: 44, textAlign: 'center', lineHeight: 1.1 }}>
                {user1.initials}
              </span>
            </div>
            <Waveform />
            <div className="flex flex-col items-center gap-1">
              <Avatar user={user2} size={44} />
              <span className="text-white/30 text-[8px] font-semibold uppercase tracking-wide" style={{ maxWidth: 44, textAlign: 'center', lineHeight: 1.1 }}>
                {user2.initials}
              </span>
            </div>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <VoteSheet
          user1={user1}
          user2={user2}
          mediaTitle={mediaTitle}
          voted={voted}
          onVote={(username) => setVoted(username)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
