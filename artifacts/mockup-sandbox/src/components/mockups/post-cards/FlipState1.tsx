import { useState } from "react";

function StarRow({ selected, onSelect }: { selected: number; onSelect: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || selected;
  return (
    <div className="flex items-center gap-2">
      {[1,2,3,4,5].map(i => (
        <button key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)} onClick={() => onSelect(i)}>
          <svg width="36" height="36" viewBox="0 0 24 24"
            fill={active >= i ? "#f59e0b" : "none"}
            stroke={active >= i ? "#f59e0b" : "#c4b5fd"}
            strokeWidth="1.5"
            style={{ transition: "all 0.15s", filter: active >= i ? "drop-shadow(0 0 4px rgba(245,158,11,0.4))" : "none" }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

const dist = [
  { stars: 5, pct: 12 }, { stars: 4, pct: 61 }, { stars: 3, pct: 18 }, { stars: 2, pct: 6 }, { stars: 1, pct: 3 },
];

export default function FlipState1() {
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [peeked, setPeeked] = useState(false);

  const handleRate = (n: number) => { setSelected(n); setTimeout(() => setSubmitted(true), 350); };

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <div className="w-6 h-1 rounded-full bg-gray-200" />
          <div className="w-6 h-1 rounded-full bg-gray-200" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500 ml-1">State 1 — Your Turn First</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* ── TOP: Stars lead ── */}
          <div className="px-4 pt-4 pb-4" style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 44, height: 60, background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #1e3a5f 100%)" }}>
                <div className="w-full h-full flex items-end p-1">
                  <div className="w-3 h-3 rounded bg-black/30 flex items-center justify-center">
                    <svg width="6" height="6" viewBox="0 0 24 24" fill="white" opacity="0.8"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[16px] font-black tracking-tight leading-none">Past Lives</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Rate or answer to unlock</p>
              </div>
              <div className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.13)", border: "0.5px solid rgba(124,58,237,0.2)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="text-violet-700 text-[11px] font-bold">+10 pts</span>
              </div>
            </div>

            {/* Stars */}
            {!submitted ? (
              <StarRow selected={selected} onSelect={handleRate} />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="26" height="26" viewBox="0 0 24 24"
                      fill={i <= selected ? "#f59e0b" : "#e5e7eb"}
                      style={{ filter: i <= selected ? "drop-shadow(0 0 3px rgba(245,158,11,0.4))" : "none" }}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-100">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-green-700 text-[11px] font-bold">Logged +10 pts</span>
                </div>
              </div>
            )}

            {/* Peek toggle — only visible before rating */}
            {!submitted && (
              <button
                onClick={() => setPeeked(p => !p)}
                className="mt-2.5 flex items-center gap-1.5 text-violet-500 text-[11px] font-semibold"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                {peeked ? "Hide ratings" : "Can't decide? Peek at ratings →"}
              </button>
            )}

            {/* Peek panel — expanded inline */}
            {peeked && !submitted && (
              <div className="mt-2.5 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.7)", border: "0.5px solid #ddd6fe" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wide">Consumed avg</p>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4].map(i => <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <span className="text-gray-600 text-[11px] font-bold ml-1">4.1</span>
                    <span className="text-gray-300 text-[10px] ml-1">2.4k</span>
                  </div>
                </div>
                {dist.map(({ stars, pct }) => (
                  <div key={stars} className="flex items-center gap-1.5 mb-1">
                    <span className="text-gray-400 text-[9px] w-3 text-right shrink-0">{stars}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-200" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-gray-400 text-[9px] w-5 shrink-0">{pct}%</span>
                  </div>
                ))}
                <p className="text-violet-500 text-[10px] font-semibold mt-1.5">68% gave it 4+ stars — now what do YOU think?</p>
              </div>
            )}
          </div>

          {/* ── MIDDLE: Marcus's take — blurred until rated ── */}
          <div className="relative" style={{ borderTop: "0.5px solid #e5e7eb" }}>
            <div
              className="px-4 pt-3 pb-3 transition-all duration-500"
              style={{ filter: submitted ? "none" : "blur(4px)", opacity: submitted ? 1 : 0.6, userSelect: submitted ? "auto" : "none" }}
            >
              <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2">From your feed</p>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">M</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700 text-[12px] font-semibold">Marcus Delacroix</span>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4].map(i => <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </div>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-snug mt-0.5">
                    "I'm floored. Greta Lee perfectly captures the 'what ifs' of life. This one stays with you."
                  </p>
                </div>
              </div>
            </div>
            {!submitted && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.55)" }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.1)", border: "0.5px solid #ddd6fe" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="text-violet-600 text-[11px] font-bold">Rate or answer to unlock</span>
                </div>
              </div>
            )}
          </div>

          {/* ── BOTTOM: Compact secondary options ── */}
          <div className="px-4 pt-2 pb-3" style={{ borderTop: "0.5px solid #f3f4f6" }}>
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2">Haven't seen it?</p>
            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg" style={{ border: "0.5px solid #ddd6fe", background: "#faf5ff" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span className="text-violet-600 text-[10px] font-semibold">Want to watch</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg" style={{ border: "0.5px solid #e5e7eb", background: "#f9fafb" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <span className="text-gray-500 text-[10px] font-semibold">Not for me</span>
              </button>
            </div>
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
