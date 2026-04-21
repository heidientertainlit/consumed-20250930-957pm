import { Play, TrendingUp } from "lucide-react";

export default function DeckLayered() {
  return (
    <div className="flex items-start justify-center min-h-screen bg-[#0f0a1a] p-4 pt-6">
      <div className="w-full max-w-[380px] flex flex-col gap-3">
        
        {/* Header with Counter */}
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Today's Games
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-white/40 tracking-wider">1 / 2</span>
            <div className="flex gap-1 ml-1">
              <div className="w-3 h-1 rounded-full bg-white/80"></div>
              <div className="w-1.5 h-1 rounded-full bg-white/20"></div>
            </div>
          </div>
        </div>

        {/* Deck Container */}
        <div className="relative mt-4">
          
          {/* BACK CARD (Daily Call) */}
          <div 
            className="absolute top-0 left-0 right-0 rounded-2xl p-4 flex flex-col justify-between min-h-[210px] opacity-80 border border-white/5"
            style={{ 
              background: "linear-gradient(160deg,#1e3a8a 0%,#1e1b4b 100%)",
              transform: "translateY(-16px) scale(0.92)",
              zIndex: 0,
              boxShadow: "0 -4px 20px rgba(0,0,0,0.5)"
            }}
          >
            <div className="flex items-start justify-between opacity-80">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-300" />
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300">
                  Daily Call
                </span>
              </div>
              <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[8px] font-bold text-white/70">LIVE</span>
              </span>
            </div>

            {/* Hidden content just to maintain height matching */}
            <div className="flex-1 flex flex-col justify-center pt-3 pb-2 opacity-0">
              <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
                Will The Bear win Best Drama at the 2026 Emmys?
              </p>
            </div>
            <div className="flex items-center justify-between opacity-0">
              <span className="text-[10px] text-blue-200/50 font-medium">1 prediction</span>
              <button className="bg-white text-blue-900 text-[11px] font-bold px-3 py-1.5 rounded-full">
                Call It
              </button>
            </div>
          </div>

          {/* FRONT CARD (Today's Play) */}
          <div 
            className="relative rounded-2xl p-5 flex flex-col justify-between min-h-[210px] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.8)]"
            style={{ 
              background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)",
              zIndex: 10
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <Play className="w-4 h-4 text-purple-300 fill-purple-300" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-purple-300/90">
                  Today's Play
                </span>
              </div>
              <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                <span className="text-[8px] font-bold text-white/80">LIVE</span>
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center py-2">
              <p className="text-white text-xl font-bold leading-tight drop-shadow-sm">
                Which character said "I am the one who knocks"?
              </p>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-purple-200/60 font-medium">3 questions</span>
              <button className="bg-white hover:bg-gray-100 text-purple-950 text-sm font-bold px-6 py-2.5 rounded-full shadow-lg transform transition active:scale-95 flex items-center gap-1.5">
                Play
                <Play className="w-3 h-3 fill-purple-950" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
