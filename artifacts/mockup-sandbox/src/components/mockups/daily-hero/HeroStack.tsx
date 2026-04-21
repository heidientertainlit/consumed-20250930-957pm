import { Play, TrendingUp, Trophy } from "lucide-react";

export default function HeroStack() {
  return (
    <div className="flex items-start justify-center min-h-screen bg-[#0f0a1a] p-4 pt-6">
      <div className="w-full max-w-[380px] flex flex-col gap-3">
        {/* Section Eyebrow */}
        <div className="px-1 mb-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
            Today's Games
          </h2>
        </div>

        {/* Today's Play - Dominant Hero */}
        <div
          className="relative rounded-[24px] p-6 flex flex-col min-h-[300px] overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" }}
        >
          {/* Decorative background icon */}
          <Trophy className="absolute -bottom-6 -right-6 w-48 h-48 text-purple-900/30 -rotate-12 pointer-events-none" strokeWidth={1} />
          
          <div className="relative flex-1 flex flex-col h-full z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-auto">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-300">
                Today's Play
              </span>
              <span className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                <span className="text-[9px] font-bold text-white/90 tracking-widest">LIVE</span>
              </span>
            </div>

            {/* Content */}
            <div className="mt-auto pb-6">
              <span className="inline-block px-2.5 py-1 rounded-md bg-white/10 text-purple-100 text-[11px] font-medium mb-3 border border-white/5 backdrop-blur-sm">
                3 questions
              </span>
              <p className="text-white text-[22px] font-bold leading-[1.2] tracking-tight">
                Which character said "I am the one who knocks"?
              </p>
            </div>

            {/* CTA */}
            <button className="w-full flex items-center justify-center gap-2 bg-white hover:bg-purple-50 text-purple-950 text-[15px] font-bold py-4 px-4 rounded-full transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <Play className="w-4 h-4 fill-current" />
              Play
            </button>
          </div>
        </div>

        {/* Daily Call - Compact Secondary */}
        <div
          className="relative rounded-[20px] p-3.5 flex items-center gap-3.5 overflow-hidden shadow-lg min-h-[88px]"
          style={{ background: "linear-gradient(160deg,#1e3a8a 0%,#1e1b4b 100%)" }}
        >
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />

          {/* Left Icon/Badge */}
          <div className="shrink-0 w-[50px] h-[50px] rounded-full bg-black/20 border border-white/5 flex items-center justify-center relative">
             <TrendingUp className="w-6 h-6 text-blue-300" strokeWidth={2} />
             <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-[#0f0a1a] rounded-full p-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
             </span>
          </div>

          {/* Center Content */}
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                Daily Call
              </span>
              <span className="w-1 h-1 rounded-full bg-blue-400/30" />
              <span className="text-[11px] text-blue-200/50 font-medium">
                1 prediction
              </span>
            </div>
            <p className="text-white text-[14px] font-semibold leading-snug truncate pr-2">
              Will The Bear win Best Drama at the 2026 Emmys?
            </p>
          </div>

          {/* Right CTA */}
          <button className="shrink-0 bg-white hover:bg-blue-50 text-blue-950 text-[13px] font-bold px-5 py-2.5 rounded-full transition-colors shadow-md whitespace-nowrap">
            Call It
          </button>
        </div>

      </div>
    </div>
  );
}
