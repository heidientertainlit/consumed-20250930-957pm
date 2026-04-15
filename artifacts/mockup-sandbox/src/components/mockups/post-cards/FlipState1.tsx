export default function FlipState1() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <div className="w-6 h-1 rounded-full bg-gray-200" />
          <div className="w-6 h-1 rounded-full bg-gray-200" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500 ml-1">State 1 — Unseen</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Movie identity block */}
          <div className="px-4 pt-4 pb-3" style={{ background: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%)" }}>
            <div className="flex items-center gap-3 mb-3">
              {/* Small poster */}
              <div className="shrink-0 rounded-xl overflow-hidden" style={{ width: 48, height: 65, background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #1e3a5f 100%)" }}>
                <div className="w-full h-full flex items-end p-1">
                  <div className="w-3 h-3 rounded bg-black/30 flex items-center justify-center">
                    <svg width="6" height="6" viewBox="0 0 24 24" fill="white" opacity="0.8"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 text-[17px] font-black tracking-tight leading-none">Past Lives</p>
                <p className="text-gray-400 text-[11px] mt-0.5">2023 · Romance / Drama</p>
                {/* Social proof */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4].map(i => <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                  <span className="text-gray-500 text-[11px] font-semibold">4.1 avg</span>
                  <span className="text-gray-300 text-[10px]">·</span>
                  <span className="text-gray-400 text-[10px]">2.4k ratings</span>
                </div>
              </div>
            </div>

            {/* Social proof bar */}
            <div className="rounded-xl px-3 py-2 mb-3" style={{ background: "rgba(124,58,237,0.08)", border: "0.5px solid rgba(124,58,237,0.15)" }}>
              <p className="text-violet-700 text-[12px] font-semibold leading-snug">
                68% of people who've seen this gave it 4+ stars.
              </p>
              <p className="text-violet-400 text-[10px] mt-0.5">Will you watch it?</p>
            </div>

            {/* 3-option buttons */}
            <div className="flex flex-col gap-2">
              <button className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white w-full text-left" style={{ border: "0.5px solid #ddd6fe", boxShadow: "0 1px 3px rgba(124,58,237,0.08)" }}>
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div>
                  <p className="text-gray-900 text-[13px] font-semibold">Want to watch</p>
                  <p className="text-gray-400 text-[10px]">Add to your watchlist</p>
                </div>
                <svg className="ml-auto text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white w-full text-left" style={{ border: "0.5px solid #e5e7eb" }}>
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <div>
                  <p className="text-gray-900 text-[13px] font-semibold">Not for me</p>
                  <p className="text-gray-400 text-[10px]">Skip this one</p>
                </div>
                <svg className="ml-auto text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white w-full text-left" style={{ border: "0.5px solid #e5e7eb" }}>
                <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <p className="text-gray-900 text-[13px] font-semibold">Already seen it →</p>
                  <p className="text-gray-400 text-[10px]">Rate it & see Marcus's take</p>
                </div>
                <svg className="ml-auto text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          {/* Teaser footer — hidden take */}
          <div className="px-4 py-2.5 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">M</div>
            <p className="text-gray-400 text-[11px]">Marcus Delacroix logged this · <span className="text-violet-500 font-semibold">See his take →</span></p>
          </div>

        </div>
      </div>
    </div>
  );
}
