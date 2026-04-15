import { useState } from "react";

function StarRow({ selected, onSelect }: { selected: number; onSelect: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || selected;
  return (
    <div className="flex items-center gap-2">
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onSelect(i)}
        >
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

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={i <= rating ? "#f59e0b" : "#e5e7eb"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

function SmallPoster() {
  return (
    <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 44, height: 60, background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #1e3a5f 100%)" }}>
      <div className="w-full h-full flex items-end p-1">
        <div className="w-3 h-3 rounded bg-black/30 flex items-center justify-center">
          <svg width="6" height="6" viewBox="0 0 24 24" fill="white" opacity="0.8"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
        </div>
      </div>
    </div>
  );
}

export default function ActionFirstSmallPoster() {
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (n: number) => {
    setSelected(n);
    setTimeout(() => setSubmitted(true), 300);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">Action First — Small Poster</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* ── TOP: The game prompt ── */}
          <div className="px-4 pt-4 pb-4" style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%)" }}>
            {/* Media identity with thumbnail */}
            <div className="flex items-center gap-2.5 mb-3">
              <SmallPoster />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[16px] font-black tracking-tight leading-none">Past Lives</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Have you seen it? Rate it.</p>
              </div>
              <div className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.13)", border: "0.5px solid rgba(124,58,237,0.2)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="text-violet-700 text-[11px] font-bold">+10 pts</span>
              </div>
            </div>

            {/* Big interactive stars */}
            {!submitted ? (
              <StarRow selected={selected} onSelect={handleSelect} />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="28" height="28" viewBox="0 0 24 24"
                      fill={i <= selected ? "#f59e0b" : "#e5e7eb"}
                      style={{ filter: i <= selected ? "drop-shadow(0 0 4px rgba(245,158,11,0.35))" : "none" }}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-100">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="text-green-700 text-[11px] font-bold">Logged! +10 pts</span>
                </div>
              </div>
            )}
          </div>

          {/* ── BOTTOM: Marcus's take, secondary ── */}
          <div className="px-4 pt-3 pb-3" style={{ borderTop: "0.5px solid #e5e7eb" }}>
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2">From your feed</p>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">M</div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-700 text-[12px] font-semibold">Marcus Delacroix</span>
                  <MiniStars rating={4} />
                </div>
                <p className="text-gray-400 text-[11px] leading-snug mt-0.5 line-clamp-2">
                  I'm floored. Greta Lee perfectly captures the 'what ifs' of life...
                </p>
              </div>
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
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Seen it
            </button>
            <span className="ml-auto text-gray-300 text-[11px]">1h</span>
          </div>

        </div>
      </div>
    </div>
  );
}
