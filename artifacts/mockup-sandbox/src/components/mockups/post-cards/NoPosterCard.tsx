function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.floor(rating) ? "#f59e0b" : "#e5e7eb"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

function InteractiveStars() {
  return (
    <div className="flex items-center gap-1.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="28" height="28" viewBox="0 0 24 24"
          fill="none" stroke="#c4b5fd" strokeWidth="1.5"
          style={{ cursor: "pointer", transition: "all 0.15s" }}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

export default function NoPosterCard() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">No Poster — Gamified</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">M</div>
            <div>
              <p className="text-gray-900 text-[13px] font-semibold leading-tight">Marcus Delacroix's Take</p>
              <p className="text-gray-400 text-[11px]">@marcusdelacroix</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-3.5 pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-gray-900 text-[13px] font-bold">Past Lives</p>
              <span className="text-[9px] font-bold uppercase tracking-wide text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">Movie</span>
            </div>
            <div className="mb-1.5"><Stars rating={4} /></div>
            <p className="text-gray-500 text-[12px] leading-snug">
              I'm floored. Greta Lee perfectly captures the 'what ifs' of life...
            </p>
          </div>

          {/* Footer actions */}
          <div className="px-3.5 py-2 flex items-center gap-3" style={{ borderTop: "0.5px solid #f3f4f6" }}>
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

          {/* YOUR TURN — Gamified CTA */}
          <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", borderTop: "0.5px solid #ddd6fe" }}>
            <div className="px-3.5 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-violet-700 text-[12px] font-bold leading-tight">What's your take?</p>
                  <p className="text-violet-400 text-[10px] leading-tight mt-0.5">Rate to log it & earn points</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.12)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span className="text-violet-700 text-[11px] font-bold">+10 pts</span>
                </div>
              </div>
              <InteractiveStars />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
