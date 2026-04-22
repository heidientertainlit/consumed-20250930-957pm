export default function VariantA() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] p-6">
      <div className="w-full max-w-[340px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-center mb-3" style={{ color: '#22d3ee' }}>A — Cyan Electric</p>
        <div
          className="rounded-2xl p-5 flex flex-col justify-between min-h-[210px] relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #06b6d4 0%, #0891b2 45%, #0c4a6e 100%)' }}
        >
          {/* Subtle glow overlay */}
          <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />

          {/* Header */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01M8 12h.01M16 12h.01"/>
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Today's Play</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-bold text-white">LIVE</span>
            </div>
          </div>

          {/* Question */}
          <div className="relative z-10 flex-1 flex items-center py-3">
            <h2 className="text-white font-bold text-[22px] leading-snug">What year did 'The Great Gatsby' premiere?</h2>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between relative z-10">
            <span className="text-white/60 text-sm font-medium">3 questions</span>
            <button className="bg-white text-[#0c4a6e] font-bold text-[15px] px-6 py-2.5 rounded-full flex items-center gap-2 shadow-lg">
              Play <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
