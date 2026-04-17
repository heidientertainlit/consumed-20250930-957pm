export function RaceFinished() {
  return (
    <div className="min-h-screen bg-[#f8f8fb] text-gray-900 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
          <svg width="16" height="16" fill="none" stroke="#374151" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Binge Battle</h1>
          <p className="text-[11px] text-gray-400">The White Lotus S3 · Complete</p>
        </div>
      </div>

      {/* Winner card */}
      <div className="mx-4 mb-5 mt-2">
        <div
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #6d28d9, #7c3aed, #8b5cf6)" }}
        >
          <div className="absolute inset-0 opacity-20" style={{
            background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5), transparent 70%)"
          }} />
          <div className="relative">
            <div className="text-[48px] mb-2">🏆</div>
            <p className="text-[11px] text-purple-200 uppercase tracking-widest font-bold mb-1">Battle won</p>
            <h2 className="text-[26px] font-black text-white mb-1">First to Finish!</h2>
            <p className="text-[13px] text-purple-200">You beat Seth by 3 days</p>
          </div>
        </div>
      </div>

      {/* Result comparison */}
      <div className="mx-4 mb-4">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Final standings</p>
        <div className="space-y-2">
          {/* Winner */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-purple-200 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-[12px] font-black text-amber-900">1</div>
            <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-[13px] font-bold text-white">H</div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-gray-900">You</p>
              <p className="text-[11px] text-gray-400">Finished Apr 14</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-black text-purple-600">8/8</p>
              <p className="text-[10px] text-gray-400">episodes</p>
            </div>
          </div>

          {/* Runner up */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[12px] font-bold text-gray-400">2</div>
            <div className="w-9 h-9 rounded-full bg-[#7c3aed] flex items-center justify-center text-[13px] font-bold text-white">S</div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-gray-500">Seth</p>
              <p className="text-[11px] text-gray-400">Still watching · Ep 5</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-black text-gray-300">5/8</p>
              <p className="text-[10px] text-gray-300">episodes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Points earned */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
          <svg width="15" height="15" fill="none" stroke="#7c3aed" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <p className="text-[13px] text-gray-600">You earned <span className="font-black text-purple-600">+50 pts</span> for winning</p>
        </div>
      </div>

      {/* Taunt */}
      <div className="mx-4 mb-5">
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
          <p className="text-[12px] text-gray-400 italic">"Think you can beat me next time?" — send the challenge back</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mx-4 mt-auto pb-10 space-y-2.5">
        <button className="w-full py-3.5 rounded-2xl font-bold text-[14px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-md shadow-purple-100">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          Rematch Seth
        </button>
        <button className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-gray-200 text-gray-600 bg-white flex items-center justify-center gap-2">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share Result
        </button>
      </div>
    </div>
  );
}
