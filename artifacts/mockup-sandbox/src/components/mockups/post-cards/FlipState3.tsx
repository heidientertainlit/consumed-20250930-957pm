export default function FlipState3() {
  const userRating = 5;
  const distribution = [
    { stars: 5, pct: 12 }, { stars: 4, pct: 61 }, { stars: 3, pct: 18 }, { stars: 2, pct: 6 }, { stars: 1, pct: 3 },
  ];

  const external = [
    { name: "IMDb", score: "7.8", outOf: "/10", color: "#f5c518", bg: "#1a1a1a" },
    { name: "RT", score: "96%", outOf: "", color: "#FA320A", bg: "#fff" },
    { name: "Lttrboxd", score: "4.1", outOf: "/5", color: "#00e054", bg: "#14181c" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4 pb-6">
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
              <div className="shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl" style={{ background: "rgba(245,158,11,0.15)", border: "0.5px solid rgba(245,158,11,0.4)" }}>
                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wide">You</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="12" height="12" viewBox="0 0 24 24"
                      fill={i <= userRating ? "#f59e0b" : "#e5e7eb"}
                      style={{ filter: i <= userRating ? "drop-shadow(0 0 2px rgba(245,158,11,0.5))" : "none" }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* External ratings */}
          <div className="px-4 pt-3 pb-2.5" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2">What the world thinks</p>
            <div className="flex items-center gap-2">
              {external.map(({ name, score, outOf, color, bg }) => (
                <div key={name} className="flex-1 flex flex-col items-center py-2 rounded-xl" style={{ background: bg === "#fff" ? "#fafafa" : bg, border: "0.5px solid #e5e7eb" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: bg === "#1a1a1a" || bg === "#14181c" ? "#aaa" : "#6b7280" }}>{name}</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="font-black text-[15px]" style={{ color }}>{score}</span>
                    {outOf && <span className="text-[9px]" style={{ color: bg === "#1a1a1a" || bg === "#14181c" ? "#666" : "#9ca3af" }}>{outOf}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consumed distribution */}
          <div className="px-4 pt-3 pb-3">
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2.5">Consumed — 2,400 ratings</p>
            <div className="space-y-1.5">
              {distribution.map(({ stars, pct }) => {
                const isUser = stars === userRating;
                const isMajority = stars === 4;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-3 shrink-0 text-right" style={{ color: isUser ? "#f59e0b" : "#9ca3af" }}>{stars}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${pct}%`,
                        background: isUser ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : isMajority ? "#c4b5fd" : "#e5e7eb"
                      }} />
                    </div>
                    <span className="text-[10px] font-bold w-7 shrink-0" style={{ color: isUser ? "#f59e0b" : isMajority ? "#7c3aed" : "#d1d5db" }}>{pct}%</span>
                    {isUser && <span className="text-[9px] font-bold text-amber-500 shrink-0">← you</span>}
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 rounded-xl px-3 py-2" style={{ background: "#f5f3ff", border: "0.5px solid #ddd6fe" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center text-[8px] text-white font-bold">M</div>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4].map(i => <svg key={i} width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <span className="text-gray-400 text-[10px]">Marcus: 4</span>
                <span className="text-gray-300">·</span>
                <span className="text-violet-500 text-[10px] font-semibold">You: 5 — You're a superfan</span>
              </div>
            </div>
          </div>

          {/* Poll CTA */}
          <div className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ border: "0.5px solid #ddd6fe" }}>
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <p className="text-white text-[10px] font-bold uppercase tracking-wide">Related poll</p>
              <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/20">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="text-white text-[9px] font-bold">+5 pts</span>
              </div>
            </div>
            <div className="px-3 py-2.5" style={{ background: "#faf5ff" }}>
              <p className="text-gray-800 text-[12px] font-bold leading-snug mb-2">Best A24 film of the decade?</p>
              <div className="space-y-1.5">
                {["Past Lives", "Everything Everywhere All at Once", "Hereditary"].map((opt, i) => (
                  <button key={opt} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left" style={{ background: i === 0 ? "#ede9fe" : "white", border: `0.5px solid ${i === 0 ? "#c4b5fd" : "#e5e7eb"}` }}>
                    {i === 0 && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
                    <span className="text-gray-700 text-[11px]" style={{ fontWeight: i === 0 ? 600 : 400 }}>{opt}</span>
                    {i === 0 && <span className="ml-auto text-violet-500 text-[10px] font-bold">38%</span>}
                  </button>
                ))}
              </div>
              <button className="mt-2 w-full py-1.5 rounded-lg text-violet-600 text-[11px] font-bold" style={{ border: "0.5px solid #ddd6fe", background: "white" }}>
                Vote now →
              </button>
            </div>
          </div>

          {/* Points + share */}
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
