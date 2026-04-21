import React from "react";
import { Play, Lock } from "lucide-react";

export default function NumberedTimeline() {
  return (
    <div className="flex items-start justify-center min-h-screen bg-[#0f0a1a] p-4 pt-6">
      <div className="w-full max-w-[380px] flex flex-col">
        {/* Section header */}
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50 mb-6 ml-1">
          Today's Games
        </p>

        <div className="relative">
          {/* Vertical connecting line */}
          <div className="absolute left-[19px] top-10 bottom-16 w-[2px] bg-white/10" />

          {/* STEP 1: Today's Play */}
          <div className="flex gap-4 mb-6 relative">
            {/* Number Badge */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.4)] z-10 relative">
                <span className="text-white font-bold text-lg">1</span>
              </div>
            </div>

            {/* Card */}
            <div
              className="flex-1 rounded-2xl p-4 flex flex-col gap-3 shadow-lg shadow-purple-900/20 relative overflow-hidden"
              style={{ background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" }}
            >
              {/* Glow effect */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/30 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200">
                  Today's Play
                </span>
                <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_5px_rgba(74,222,128,0.6)]" />
                  <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
                </span>
              </div>

              <div className="relative z-10 mt-1">
                <p className="text-white text-[15px] font-semibold leading-snug">
                  Which character said "I am the one who knocks"?
                </p>
              </div>

              <div className="flex items-center justify-between mt-2 relative z-10">
                <span className="text-[11px] text-purple-200/70 font-medium">3 questions</span>
                <button className="bg-white hover:bg-gray-100 transition-colors text-purple-950 text-[12px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 shadow-md">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play
                </button>
              </div>
            </div>
          </div>

          {/* STEP 2: Daily Call */}
          <div className="flex gap-4 relative">
            {/* Number Badge (Outlined) */}
            <div className="shrink-0 flex flex-col items-center mt-1">
              <div className="w-10 h-10 rounded-full bg-[#0f0a1a] border-2 border-white/20 flex items-center justify-center z-10 relative">
                <span className="text-white/40 font-bold text-lg">2</span>
              </div>
            </div>

            {/* Card (Desaturated/Dimmed) */}
            <div
              className="flex-1 rounded-2xl p-4 flex flex-col gap-3 opacity-70 transition-opacity hover:opacity-100"
              style={{ background: "linear-gradient(160deg,rgba(30,58,138,0.5) 0%,rgba(30,27,75,0.5) 100%)" }}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300/60">
                  Daily Call
                </span>
                <span className="flex items-center gap-1 bg-black/20 rounded-full px-2 py-0.5">
                  <Lock className="w-2.5 h-2.5 text-white/40" />
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-wide">Up Next</span>
                </span>
              </div>

              <div className="mt-1">
                <p className="text-white/80 text-[15px] font-medium leading-snug">
                  Will The Bear win Best Drama at the 2026 Emmys?
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-blue-200/40 font-medium">1 prediction</span>
                <button className="bg-white/10 text-white/80 border border-white/10 text-[12px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                  Call It
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
