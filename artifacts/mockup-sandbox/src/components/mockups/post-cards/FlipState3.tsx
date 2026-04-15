export default function FlipState3() {
  const userRating = 5;
  const distribution = [
    { stars: 5, pct: 12, label: "5 stars" },
    { stars: 4, pct: 61, label: "4 stars" },
    { stars: 3, pct: 18, label: "3 stars" },
    { stars: 2, pct: 6,  label: "2 stars" },
    { stars: 1, pct: 3,  label: "1 star"  },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="w-6 h-1 rounded-full bg-gray-300" />
          <div className="w-6 h-1 rounded-full bg-violet-500" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500 ml-1">State 3 — Second Reveal</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Bold call verdict */}
          <div className="px-4 pt-4 pb-3" style={{ background: "linear-gradient(160deg, #fef3c7 0%, #fde68a 100%)", borderBottom: "0.5px solid #fcd34d" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-amber-900 text-[15px] font-black leading-tight">Bold call.</p>
                <p className="text-amber-700 text-[12px] leading-snug mt-0.5">
                  You're in the <span className="font-bold">12%</span> who gave <em>Past Lives</em> 5 stars.
                </p>
              </div>
              {/* User's rating badge */}
              <div className="shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl" style={{ background: "rgba(245,158,11,0.15)", border: "0.5px solid rgba(245,158,11,0.4)" }}>
                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wide">You</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= userRating ? "#f59e0b" : "#e5e7eb"}
                      style={{ filter: i <= userRating ? "drop-shadow(0 0 2px rgba(245,158,11,0.5))" : "none" }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rating distribution */}
          <div className="px-4 pt-3 pb-3">
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2.5">How 2,400 people rated it</p>
            <div className="space-y-1.5">
              {distribution.map(({ stars, pct, label }) => {
                const isUser = stars === userRating;
                const isMajority = stars === 4;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-10 shrink-0 text-right" style={{ color: isUser ? "#f59e0b" : "#9ca3af" }}>{label}</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: isUser
                            ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                            : isMajority
                            ? "#c4b5fd"
                            : "#e5e7eb"
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold w-7 shrink-0" style={{ color: isUser ? "#f59e0b" : isMajority ? "#7c3aed" : "#d1d5db" }}>{pct}%</span>
                    {isUser && (
                      <span className="text-[9px] font-bold text-amber-500 shrink-0">← you</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Majority note */}
            <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "#f5f3ff", border: "0.5px solid #ddd6fe" }}>
              <p className="text-violet-600 text-[11px] font-semibold leading-snug">
                Most people agree with Marcus — 61% gave it 4 stars.
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center text-[8px] text-white font-bold">M</div>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4].map(i => <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <span className="text-gray-400 text-[10px]">Marcus rated it 4</span>
                <span className="text-gray-300 text-[10px]">·</span>
                <span className="text-violet-500 text-[10px] font-semibold">You: 5 — You're a superfan</span>
              </div>
            </div>
          </div>

          {/* Points earned */}
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: "0.5px solid #f3f4f6", background: "#fafafa" }}>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.1)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-violet-700 text-[11px] font-bold">+10 pts earned</span>
            </div>
            <button className="ml-auto text-violet-500 text-[11px] font-semibold">Share your take →</button>
          </div>

        </div>
      </div>
    </div>
  );
}
