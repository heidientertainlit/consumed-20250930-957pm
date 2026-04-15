export default function FlipState3() {
  const userRating = 5;
  const distribution = [
    { stars: 5, pct: 12 }, { stars: 4, pct: 61 }, { stars: 3, pct: 18 }, { stars: 2, pct: 6 }, { stars: 1, pct: 3 },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4 pb-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="w-6 h-1 rounded-full bg-gray-300" />
          <div className="w-6 h-1 rounded-full bg-gray-800" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">State 3 — Second Reveal</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Card header */}
          <div className="px-4 pt-3 pb-2.5 flex items-center justify-between" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">M</div>
              <div>
                <p className="text-gray-900 text-[13px] font-bold leading-tight">Marcus Delacroix's Take</p>
                <p className="text-gray-400 text-[10px]">@marcusdelacroix</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-100">Movie</span>
          </div>

          {/* Bold call verdict */}
          <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-gray-900 text-[15px] font-black leading-tight">Bold call.</p>
                <p className="text-gray-600 text-[12px] leading-snug mt-0.5">
                  You're in the <span className="font-bold text-amber-500">12%</span> who gave <em>Past Lives</em> 5 stars.
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl bg-amber-50" style={{ border: "0.5px solid #fde68a" }}>
                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wide">You</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="11" height="11" viewBox="0 0 24 24"
                      fill={i <= userRating ? "#f59e0b" : "#e5e7eb"}
                      style={{ filter: i <= userRating ? "drop-shadow(0 0 2px rgba(245,158,11,0.4))" : "none" }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* "Everyone" aggregate — no source named */}
          <div className="px-4 pt-3 pb-3" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2">What everyone thinks</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-gray-50" style={{ border: "0.5px solid #e5e7eb" }}>
                <p className="text-gray-900 text-[20px] font-black leading-none">4.1</p>
                <div className="flex mt-0.5">
                  {[1,2,3,4].map(i => <svg key={i} width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <p className="text-gray-400 text-[8px] mt-0.5">47K ratings</p>
              </div>
              <div className="flex-1">
                <p className="text-gray-700 text-[12px] font-semibold leading-snug">
                  68% of people gave it 4 stars or higher.
                </p>
                <p className="text-gray-400 text-[11px] mt-0.5">Most people agree with Marcus.</p>
              </div>
            </div>

            {/* Consumed distribution */}
            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-2">Consumed — 2,400 ratings</p>
            <div className="space-y-1.5">
              {distribution.map(({ stars, pct }) => {
                const isUser = stars === userRating;
                const isMajority = stars === 4;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-3 shrink-0 text-right" style={{ color: isUser ? "#f59e0b" : "#9ca3af" }}>{stars}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${pct}%`,
                        background: isUser ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : isMajority ? "#d8b4fe" : "#e5e7eb"
                      }} />
                    </div>
                    <span className="text-[10px] font-bold w-7 shrink-0" style={{ color: isUser ? "#f59e0b" : isMajority ? "#7c3aed" : "#d1d5db" }}>{pct}%</span>
                    {isUser && <span className="text-[9px] font-bold text-amber-400 shrink-0">← you</span>}
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 rounded-xl px-3 py-2 bg-gray-50" style={{ border: "0.5px solid #f3f4f6" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center text-[8px] text-white font-bold">M</div>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4].map(i => <svg key={i} width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <span className="text-gray-500 text-[10px]">Marcus: 4</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-600 text-[10px] font-semibold">You: 5 — bold call</span>
              </div>
            </div>
          </div>

          {/* Poll CTA — matches Cast Your Vote carousel */}
          <div className="mx-4 my-3 bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-gray-900">Cast Your Vote</p>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                +5 pts
              </div>
            </div>

            {/* Question */}
            <p className="text-gray-900 font-semibold text-[13px] mb-3 leading-snug">Best A24 film of the decade?</p>

            {/* Options — pill style, one pre-selected with dark blue gradient */}
            <div className="flex flex-col gap-2">
              {[
                { label: "Past Lives", selected: true, pct: 38 },
                { label: "Everything Everywhere All at Once", selected: false, pct: 44 },
                { label: "Hereditary", selected: false, pct: 18 },
              ].map(({ label, selected, pct }) => (
                <div
                  key={label}
                  className="relative py-2.5 px-4 rounded-full border overflow-hidden"
                  style={{
                    background: selected
                      ? "linear-gradient(to right, #1e293b, #1e3a5f, #164e63)"
                      : "#f3f4f6",
                    borderColor: selected ? "rgba(59,130,246,0.5)" : "#e5e7eb"
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                      <span className="text-[12px] font-medium" style={{ color: selected ? "white" : "#374151" }}>{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={selected ? "rgba(255,255,255,0.6)" : "#9ca3af"} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span className="text-[11px] font-bold" style={{ color: selected ? "white" : "#9ca3af" }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Points + share */}
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: "0.5px solid #f3f4f6" }}>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.08)", border: "0.5px solid rgba(124,58,237,0.12)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-violet-700 text-[11px] font-bold">+10 pts earned</span>
            </div>
            <button className="ml-auto text-violet-600 text-[11px] font-semibold">Share your take →</button>
          </div>

        </div>
      </div>
    </div>
  );
}
