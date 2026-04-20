import { Check, Share2 } from "lucide-react";

export default function PostPill() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0a1a] p-4">
      <div className="w-full max-w-[380px] flex flex-col gap-3">

        {/* Section header */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 px-0.5">
          Today's Games
        </p>

        {/* Collapsed completion pill */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1a0a36 0%,#0d1a38 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-stretch">

            {/* Left: Today's Play result */}
            <div className="flex-1 flex items-center gap-2.5 px-4 py-3.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(139,92,246,0.25)" }}
              >
                <Check className="w-3.5 h-3.5 text-purple-400" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-purple-300/70">Today's Play</p>
                <p className="text-white text-[15px] font-bold leading-none mt-0.5">2 <span className="text-white/30 font-normal text-[12px]">/ 3</span></p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-white/8 self-stretch" />

            {/* Right: Daily Call result */}
            <div className="flex-1 flex items-center gap-2.5 px-4 py-3.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(59,130,246,0.2)" }}
              >
                <Check className="w-3.5 h-3.5 text-blue-400" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-blue-300/70">Daily Call</p>
                <p className="text-white text-[12px] font-semibold leading-none mt-0.5">Locked In</p>
              </div>
            </div>

            {/* Share button */}
            <div className="flex items-center px-3.5 border-l border-white/8">
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <Share2 className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>

          </div>
        </div>

        {/* Sub-note */}
        <p className="text-center text-[10px] text-white/25 tracking-wide">Come back tomorrow for new games</p>

      </div>
    </div>
  );
}
