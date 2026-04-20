export default function PreGame() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0a1a] p-4">
      <div className="w-full max-w-[380px] flex flex-col gap-3">

        {/* Section header */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 px-0.5">
          Today's Games
        </p>

        {/* Card row */}
        <div className="grid grid-cols-2 gap-2.5">

          {/* TODAY'S PLAY — purple */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between min-h-[190px]"
            style={{ background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" }}
          >
            <div className="flex items-start justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-purple-300/80">
                Today's Play
              </span>
              <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[8px] font-bold text-white/70">LIVE</span>
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center pt-3 pb-2">
              <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
                Which character said "I am the one who knocks"?
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-purple-200/50 font-medium">3 questions</span>
              <button className="bg-white text-purple-900 text-[11px] font-bold px-3 py-1.5 rounded-full">
                Play
              </button>
            </div>
          </div>

          {/* DAILY CALL — indigo/blue */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between min-h-[190px]"
            style={{ background: "linear-gradient(160deg,#1e3a8a 0%,#1e1b4b 100%)" }}
          >
            <div className="flex items-start justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                Daily Call
              </span>
              <span className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[8px] font-bold text-white/70">LIVE</span>
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center pt-3 pb-2">
              <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
                Will The Bear win Best Drama at the 2026 Emmys?
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-blue-200/50 font-medium">1 prediction</span>
              <button className="bg-white text-blue-900 text-[11px] font-bold px-3 py-1.5 rounded-full">
                Call It
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
