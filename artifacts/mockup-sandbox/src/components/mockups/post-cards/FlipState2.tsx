import { useState } from "react";

export default function FlipState2() {
  const userRating = 5;
  const [review, setReview] = useState("");
  const [posted, setPosted] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-6 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="w-6 h-1 rounded-full bg-gray-800" />
          <div className="w-6 h-1 rounded-full bg-gray-200" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">State 2 — Revealed + Review</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Card header — same app style */}
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

          {/* Marcus's full review — revealed */}
          <div className="px-4 pt-3 pb-3" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 rounded-lg" style={{ width: 56, height: 76, background: "linear-gradient(135deg, #2d1b69 0%, #4c1d95 60%, #1e3a5f 100%)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[13px] font-bold">Past Lives</p>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[1,2,3,4].map(i => <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <p className="text-gray-600 text-[12px] leading-snug mt-1">
                  "I'm floored. Greta Lee perfectly captures the 'what ifs' of life. This one stays with you."
                </p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 my-3 flex items-center gap-2">
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <span className="text-gray-400 text-[10px] font-semibold">Your take</span>
            <div className="flex-1 border-t border-dashed border-gray-200" />
          </div>

          {/* User's confirmed rating + write review */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Your rating</p>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="18" height="18" viewBox="0 0 24 24"
                      fill={i <= userRating ? "#f59e0b" : "#e5e7eb"}
                      style={{ filter: i <= userRating ? "drop-shadow(0 0 2px rgba(245,158,11,0.35))" : "none" }}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
              </div>
              <button className="text-gray-400 text-[10px] font-semibold border border-gray-200 px-2 py-1 rounded-lg">Edit</button>
            </div>

            {/* Write a review */}
            {!posted ? (
              <>
                <p className="text-gray-900 text-[13px] font-bold mb-1.5">
                  Add a review <span className="text-gray-400 font-normal text-[11px]">optional</span>
                </p>
                <textarea
                  value={review}
                  onChange={e => setReview(e.target.value)}
                  placeholder="What did you think? Your honest take..."
                  rows={3}
                  className="w-full text-[12px] text-gray-700 placeholder-gray-300 rounded-xl px-3 py-2.5 resize-none outline-none"
                  style={{ border: "0.5px solid #e5e7eb", background: "white", lineHeight: "1.5" }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setPosted(true)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                    style={{
                      background: review ? "#7c3aed" : "#f3f4f6",
                      color: review ? "white" : "#9ca3af"
                    }}
                  >
                    {review ? "Post Review →" : "Skip for now"}
                  </button>
                  {review && (
                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.08)", border: "0.5px solid rgba(124,58,237,0.15)" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <span className="text-violet-700 text-[10px] font-bold">+15 pts</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <p className="text-green-700 text-[12px] font-bold">Review posted</p>
                  <p className="text-green-500 text-[10px]">+15 pts · visible on your profile</p>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: "0.5px solid #f3f4f6" }}>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              0
            </button>
            <button className="flex items-center gap-1 text-gray-400 text-[11px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 0-7.78z"/></svg>
              0
            </button>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 border border-amber-100 ml-1">Review</span>
            <span className="ml-auto text-gray-300 text-[11px]">1h</span>
          </div>

        </div>
      </div>
    </div>
  );
}
