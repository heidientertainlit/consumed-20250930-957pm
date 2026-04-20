import { Check, Share2 } from "lucide-react";

export default function PostBadge() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0a1a] p-4">
      <div className="w-full max-w-[380px] flex flex-col gap-3">

        {/* Section header */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 px-0.5">
          Today's Games
        </p>

        {/* Mini badge pair — much smaller than pre-game cards */}
        <div className="grid grid-cols-2 gap-2.5">

          {/* TODAY'S PLAY — completed mini card */}
          <div
            className="rounded-2xl p-3.5 flex flex-col gap-2"
            style={{
              background: "linear-gradient(150deg,#2e1065 0%,#1a0a36 100%)",
              border: "1px solid rgba(139,92,246,0.25)"
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-purple-300/60">
                Today's Play
              </span>
              <div
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.3)" }}
              >
                <Check className="w-2.5 h-2.5 text-purple-300" strokeWidth={3} />
              </div>
            </div>

            <div>
              <p className="text-white text-[28px] font-black leading-none">2</p>
              <p className="text-white/30 text-[11px] font-medium">out of 3</p>
            </div>

            <button className="flex items-center gap-1 text-purple-300/60 text-[10px] font-semibold w-fit">
              <Share2 className="w-3 h-3" />
              Share score
            </button>
          </div>

          {/* DAILY CALL — completed mini card */}
          <div
            className="rounded-2xl p-3.5 flex flex-col gap-2"
            style={{
              background: "linear-gradient(150deg,#1e3a8a 0%,#0d1a38 100%)",
              border: "1px solid rgba(59,130,246,0.25)"
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-blue-300/60">
                Daily Call
              </span>
              <div
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center"
                style={{ background: "rgba(59,130,246,0.25)" }}
              >
                <Check className="w-2.5 h-2.5 text-blue-300" strokeWidth={3} />
              </div>
            </div>

            <div>
              <p className="text-white text-[16px] font-bold leading-tight mt-1">Locked<br />In</p>
              <p className="text-white/30 text-[11px] font-medium mt-1">Pending result</p>
            </div>

            <button className="flex items-center gap-1 text-blue-300/60 text-[10px] font-semibold w-fit">
              <Share2 className="w-3 h-3" />
              Share call
            </button>
          </div>

        </div>

        {/* Sub-note */}
        <p className="text-center text-[10px] text-white/25 tracking-wide">Come back tomorrow for new games</p>

      </div>
    </div>
  );
}
