import { useState } from "react";
import { Zap, X, Check } from "lucide-react";

export interface ClashUser {
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
    <span style={{ color, fontSize: 14, letterSpacing: 1 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function Avatar({ user, size = 50 }: { user: ClashUser; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        background: user.color,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 0 16px ${user.color}88`,
        fontSize: Math.round(size * 0.3),
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
        <filter id="clash-glow">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="clash-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M0,22 L4,22 L6,6 L8,38 L10,12 L12,32 L16,22 L19,2 L21,42 L23,14 L26,22 L28,4 L30,40 L32,16 L36,22 L39,8 L41,36 L43,18 L46,26 L48,22 L52,22"
        stroke="url(#clash-wave)"
        strokeWidth="2.2"
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
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10 flex flex-col gap-5"
        style={{ background: "linear-gradient(160deg, #1e0a3c 0%, #2d1465 60%, #3b1a78 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />

        <div className="flex items-center justify-between -mt-2">
          <span className="text-white font-bold text-[17px]">Who's right?</span>
          <button onClick={onClose} className="p-1 rounded-full bg-white/10 text-white/50 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-white/55 text-[12px] -mt-3">
          on <span className="text-white/80 font-medium">{mediaTitle}</span>
        </p>

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
                  opacity: otherVoted ? 0.4 : 1,
                  cursor: voted ? "default" : "pointer",
                  transform: isVoted ? "scale(1.03)" : "scale(1)",
                }}
              >
                <Avatar user={u} size={56} />
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <span className="text-white font-bold text-[14px] leading-tight">{u.displayName}</span>
                  <FilledStars rating={u.rating} color={u.color} />
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                    style={{ background: `${u.color}28`, color: u.color, border: `1px solid ${u.color}45` }}
                  >
                    {u.dnaLabel}
                  </span>
                </div>
                {isVoted && (
                  <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: u.color }}>
                    <Check size={12} /> You agree
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
        <div className="p-4 flex flex-col gap-3">
          {/* Label */}
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-purple-300 shrink-0" fill="currentColor" />
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">Clash</span>
          </div>

          {/* Headline */}
          <p className="text-white font-extrabold text-[18px] leading-tight -mt-1">
            Completely different takes.
          </p>

          {/* Avatars + waveform — centred */}
          <div className="flex items-center justify-center gap-0 mt-1">
            <Avatar user={user1} size={52} />
            <Waveform />
            <Avatar user={user2} size={52} />
          </div>

          {/* Info columns — one per user, stacked below their avatar */}
          <div className="flex gap-3 mt-1">
            {/* User 1 */}
            <div
              className="flex-1 flex flex-col gap-1 p-3 rounded-xl"
              style={{ background: `${user1.color}15`, border: `1px solid ${user1.color}30` }}
            >
              <span className="text-white font-semibold text-[13px] leading-tight">{user1.displayName}</span>
              <FilledStars rating={user1.rating} color={user1.color} />
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full self-start mt-0.5"
                style={{ background: `${user1.color}28`, color: user1.color, border: `1px solid ${user1.color}45` }}
              >
                {user1.dnaLabel}
              </span>
            </div>

            {/* User 2 */}
            <div
              className="flex-1 flex flex-col gap-1 p-3 rounded-xl"
              style={{ background: `${user2.color}15`, border: `1px solid ${user2.color}30` }}
            >
              <span className="text-white font-semibold text-[13px] leading-tight">{user2.displayName}</span>
              <FilledStars rating={user2.rating} color={user2.color} />
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full self-start mt-0.5"
                style={{ background: `${user2.color}28`, color: user2.color, border: `1px solid ${user2.color}45` }}
              >
                {user2.dnaLabel}
              </span>
            </div>
          </div>

          {/* Media title + CTA */}
          <p className="text-white/35 text-[11px] truncate -mb-1">on {mediaTitle}</p>
          <button
            onClick={() => setSheetOpen(true)}
            className="self-start px-3 py-1.5 rounded-xl text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-white/15"
            style={{ background: voted ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.10)" }}
          >
            <Zap size={10} fill="currentColor" className="text-purple-300" />
            {voted ? "You voted · See result" : "Which side are you on?"}
          </button>
        </div>
      </div>

      {sheetOpen && (
        <VoteSheet
          user1={user1}
          user2={user2}
          mediaTitle={mediaTitle}
          voted={voted}
          onVote={(u) => setVoted(u)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
