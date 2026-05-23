import { useState } from "react";
import { Zap, Check } from "lucide-react";

export interface ClashUser {
  displayName: string;
  username: string;
  dnaLabel: string;
  rating: number;
  initials: string;
  color: string;
  votes: number;
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
    <span style={{ color, fontSize: 15, letterSpacing: 1 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function Avatar({ user }: { user: ClashUser }) {
  const firstName = user.displayName.split(" ")[0];
  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center font-bold text-white text-center gap-1"
      style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderRadius: 999,
        background: user.color,
        minWidth: 90,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.15)`,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.1, fontWeight: 800 }}>{firstName}</span>
      <span style={{ fontSize: 13, letterSpacing: 1.5, lineHeight: 1, opacity: 0.95 }}>
        {"★".repeat(user.rating)}{"☆".repeat(5 - user.rating)}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, lineHeight: 1.2, textAlign: 'center' }}>
        {user.dnaLabel}
      </span>
    </div>
  );
}

function Waveform() {
  return (
    <svg width="90" height="48" viewBox="0 0 90 48" fill="none" className="shrink-0">
      <defs>
        <filter id="clash-glow">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="clash-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path
        d="M0,24 L8,24 L11,6 L14,42 L17,10 L20,38 L25,24 L30,2 L33,46 L36,12 L40,24 L43,4 L46,44 L49,14 L54,24 L58,8 L61,40 L64,16 L69,28 L73,24 L82,24 L90,24"
        stroke="url(#clash-wave)"
        strokeWidth="2.4"
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
}: DnaClashFeedCardProps) {
  const [voted, setVoted] = useState<string | null>(null);

  const v1 = voted === user1.username ? user1.votes + 1 : user1.votes;
  const v2 = voted === user2.username ? user2.votes + 1 : user2.votes;
  const total = v1 + v2;
  const pct1 = total > 0 ? Math.round((v1 / total) * 100) : 50;
  const pct2 = 100 - pct1;

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-4 shadow-lg"
      style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #2d1465 45%, #3b1a78 100%)" }}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Label */}
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-purple-300 shrink-0" fill="currentColor" />
          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">DNA Clash</span>
        </div>

        {/* Headline + media title */}
        <div className="-mt-1">
          <p className="text-white font-extrabold text-[18px] leading-tight">
            Completely different takes.
          </p>
          <p className="text-white/60 text-[14px] font-semibold mt-0.5">on {mediaTitle}</p>
        </div>

        {/* Avatars + waveform */}
        <div className="flex items-center justify-center gap-0">
          <Avatar user={user1} />
          <Waveform />
          <Avatar user={user2} />
        </div>

        {/* CTA + vote buttons */}
        {!voted ? (
          <div className="flex flex-col gap-2">
            <p className="text-white/50 text-[11px] font-semibold text-center uppercase tracking-widest">Which side are you on?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setVoted(user1.username)}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all border"
                style={{ background: `${user1.color}22`, borderColor: `${user1.color}55`, color: user1.color }}
              >
                {user1.displayName}'s side
              </button>
              <button
                onClick={() => setVoted(user2.username)}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all border"
                style={{ background: `${user2.color}22`, borderColor: `${user2.color}55`, color: user2.color }}
              >
                {user2.displayName}'s side
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Result bars */}
            <div className="flex flex-col gap-1.5">
              {[{ u: user1, pct: pct1, v: v1 }, { u: user2, pct: pct2, v: v2 }].map(({ u, pct, v }) => (
                <div key={u.username} className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold w-[72px] truncate" style={{ color: u.color }}>
                    {voted === u.username && <Check size={9} className="inline mr-0.5" />}
                    {u.displayName}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: u.color }}
                    />
                  </div>
                  <span className="text-[11px] font-bold w-8 text-right" style={{ color: u.color }}>{pct}%</span>
                </div>
              ))}
            </div>
            <p className="text-white/35 text-[10px] text-center">{total} votes</p>
          </div>
        )}
      </div>
    </div>
  );
}
