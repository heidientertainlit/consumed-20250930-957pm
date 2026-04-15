function SmallPoster({ w, h }: { w: number; h: number }) {
  return (
    <div className="shrink-0 rounded-lg overflow-hidden relative" style={{ width: w, height: h, background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 50%, #1e3a5f 100%)" }}>
      <div className="absolute inset-0 flex items-end p-1">
        <div className="w-3 h-3 rounded bg-black/40 flex items-center justify-center">
          <svg width="6" height="6" viewBox="0 0 24 24" fill="white" opacity="0.9"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
        </div>
      </div>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.floor(rating) ? "#f59e0b" : "#e5e7eb"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

export default function SmallPosterCard() {
  // 40% less space = poster is 48x65px instead of 80x108px
  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">40% Smaller Poster</p>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">M</div>
            <div>
              <p className="text-gray-900 text-[13px] font-semibold leading-tight">Marcus Delacroix's Take</p>
              <p className="text-gray-400 text-[11px]">@marcusdelacroix</p>
            </div>
          </div>

          {/* Content — smaller poster */}
          <div className="px-3.5 pb-3 flex gap-2.5">
            {/* Poster at 48x65 (40% less than 80x108) */}
            <SmallPoster w={48} h={65} />
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-gray-900 text-[13px] font-bold">Past Lives</p>
              <div className="my-1"><Stars rating={4} /></div>
              <p className="text-gray-500 text-[12px] leading-snug">
                I'm floored. Greta Lee perfectly captures the 'what ifs' of life...
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-3.5 py-2 flex items-center gap-3" style={{ borderTop: "0.5px solid #f3f4f6" }}>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 0-7.78z"/></svg>
              0
            </button>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              0
            </button>
            <button className="text-gray-400">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
            <button className="text-gray-400">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Seen it
            </button>
            <span className="ml-auto text-[11px] font-bold text-amber-500">Review</span>
            <span className="text-gray-300 text-[11px]">1h</span>
          </div>
          <div className="px-3.5 py-2.5" style={{ borderTop: "0.5px solid #f3f4f6" }}>
            <p className="text-violet-600 text-[10px] font-bold uppercase tracking-widest mb-1.5">Your Turn</p>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="#e5e7eb">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
