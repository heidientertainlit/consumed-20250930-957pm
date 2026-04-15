import { useState } from "react";

function StarRow({ selected, onSelect }: { selected: number; onSelect: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || selected;
  return (
    <div className="flex items-center gap-1.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)} onClick={() => onSelect(i)}>
          <svg width="32" height="32" viewBox="0 0 24 24"
            fill={active >= i ? "#f59e0b" : "none"}
            stroke={active >= i ? "#f59e0b" : "#c4b5fd"}
            strokeWidth="1.5"
            style={{ transition: "all 0.15s", filter: active >= i ? "drop-shadow(0 0 3px rgba(245,158,11,0.4))" : "none" }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function FlipState2() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="w-6 h-1 rounded-full bg-violet-500" />
          <div className="w-6 h-1 rounded-full bg-gray-200" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500 ml-1">State 2 — First Reveal</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Reveal header */}
          <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%)", borderBottom: "0.5px solid #ddd6fe" }}>
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">M</div>
            <div>
              <p className="text-violet-700 text-[11px] font-bold leading-tight">Marcus's take — unlocked</p>
              <p className="text-gray-400 text-[10px]">Because you added it to your watchlist</p>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              {[1,2,3,4].map(i => <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
          </div>

          {/* Marcus's full review — revealed */}
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-start gap-2.5">
              {/* Small poster */}
              <div className="shrink-0 rounded-lg" style={{ width: 40, height: 54, background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #1e3a5f 100%)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[13px] font-bold">Past Lives</p>
                <p className="text-gray-500 text-[12px] leading-snug mt-1">
                  "I'm floored. Greta Lee perfectly captures the 'what ifs' of life. This one stays with you."
                </p>
              </div>
            </div>
          </div>

          {/* Divider with CTA */}
          <div className="mx-4 flex items-center gap-2 mb-3">
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <span className="text-gray-400 text-[10px] font-semibold">Now your turn</span>
            <div className="flex-1 border-t border-dashed border-gray-200" />
          </div>

          {/* Rating zone */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <p className="text-gray-900 text-[13px] font-bold leading-tight">Rate Past Lives</p>
                <p className="text-gray-400 text-[10px] mt-0.5">Your rating stays private until you share</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.1)", border: "0.5px solid rgba(124,58,237,0.2)" }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="text-violet-700 text-[10px] font-bold">+10 pts</span>
              </div>
            </div>

            <StarRow selected={selected} onSelect={setSelected} />

            {selected > 0 && (
              <button className="mt-3 w-full py-2.5 rounded-xl text-white text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
                Submit Rating →
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: "0.5px solid #f3f4f6" }}>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 0-7.78z"/></svg>
              0
            </button>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              0
            </button>
            <span className="ml-auto text-gray-300 text-[11px]">1h</span>
          </div>

        </div>
      </div>
    </div>
  );
}
