import { useLocation } from "wouter";
import { Dna, ArrowRight, Users } from "lucide-react";

interface OverlapUser {
  displayName: string;
  initials: string;
  color: string;
  pct: number;
}

interface CompareUser {
  displayName: string;
  initials: string;
  color: string;
  pct: number;
  tagline: string;
}

interface DnaCompareFeedCardProps {
  featured: CompareUser;
  overlaps: OverlapUser[];
}

function Avatar({ initials, color, size = 44 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 0 14px ${color}77`,
        fontSize: Math.round(size * 0.3),
      }}
    >
      {initials}
    </div>
  );
}

function Waveform() {
  return (
    <svg width="44" height="38" viewBox="0 0 44 38" fill="none" className="shrink-0">
      <defs>
        <filter id="compare-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="compare-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      {/* Smooth aligned waveform — users are in sync */}
      <path
        d="M0,19 Q4,8 8,19 Q12,30 16,19 Q20,8 22,19 Q24,30 28,19 Q32,8 36,19 Q40,30 44,19"
        stroke="url(#compare-wave)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        filter="url(#compare-glow)"
      />
    </svg>
  );
}

export default function DnaCompareFeedCard({ featured, overlaps }: DnaCompareFeedCardProps) {
  const [, setLocation] = useLocation();

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-4 shadow-lg"
      style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #1a1050 45%, #1e1460 100%)" }}
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Label */}
        <div className="flex items-center gap-1.5">
          <Dna size={11} className="text-indigo-300 shrink-0" />
          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Compare</span>
        </div>

        {/* Main content: left = text, right = overlaps list */}
        <div className="flex gap-3 -mt-1">
          {/* Left */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Avatars + waveform */}
            <div className="flex items-center gap-0">
              <Avatar initials="Me" color="#6366f1" size={40} />
              <Waveform />
              <Avatar initials={featured.initials} color={featured.color} size={40} />
            </div>

            {/* Alignment headline */}
            <div>
              <p className="text-white font-extrabold leading-tight" style={{ fontSize: 18 }}>
                <span style={{ color: "#c084fc" }}>{featured.pct}%</span> aligned with
              </p>
              <p className="text-white font-extrabold leading-tight" style={{ fontSize: 18 }}>
                {featured.displayName}
              </p>
            </div>

            {/* Tagline */}
            <p className="text-white/55 text-[11px] leading-snug">{featured.tagline}</p>
          </div>

          {/* Right: overlap list */}
          <div className="flex flex-col gap-1 pt-1 min-w-[110px]">
            <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest mb-0.5">Top overlaps</span>
            {overlaps.map((u) => (
              <div key={u.displayName} className="flex items-center gap-2">
                <Avatar initials={u.initials} color={u.color} size={22} />
                <span className="text-white/70 text-[11px] truncate flex-1">{u.displayName}</span>
                <span className="text-white/50 text-[11px] font-semibold shrink-0">{u.pct}%</span>
              </div>
            ))}
            <button
              onClick={() => setLocation("/friends")}
              className="flex items-center gap-0.5 text-purple-400 text-[11px] font-semibold mt-1 hover:text-purple-300 transition-colors"
            >
              See all Friends <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/8" />

        {/* Two CTA buttons */}
        <div className="flex flex-col gap-2 -mt-1">
          <button
            onClick={() => setLocation("/dna")}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/15 text-white text-[12px] font-semibold hover:bg-white/10 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <span>What's your entertainment DNA?</span>
            <span className="text-purple-400 text-[11px] font-bold shrink-0 ml-2">Take the quiz →</span>
          </button>
          <button
            onClick={() => setLocation("/friends")}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/15 text-white text-[12px] font-semibold hover:bg-white/10 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <span className="flex items-center gap-2">
              <Users size={13} className="text-indigo-300 shrink-0" />
              Compare your DNA with a friend
            </span>
            <ArrowRight size={13} className="text-indigo-300 shrink-0 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}
