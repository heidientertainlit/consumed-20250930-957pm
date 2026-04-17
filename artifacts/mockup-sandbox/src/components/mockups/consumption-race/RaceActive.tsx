export function RaceActive() {
  return (
    <div className="min-h-screen bg-[#0f0f13] text-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3">
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="text-[16px] font-bold leading-tight">The White Lotus</h1>
          <p className="text-[11px] text-white/40">Race · First to finish</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-semibold">Live</span>
        </div>
      </div>

      {/* Media card */}
      <div className="mx-4 mb-4">
        <div className="rounded-2xl overflow-hidden relative h-[120px]" style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"
        }}>
          <img
            src="https://image.tmdb.org/t/p/w780/kjQBrc00fB2RjHZB3PGR4w9ibpz.jpg"
            alt="The White Lotus"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 p-4 flex items-end">
            <div>
              <p className="text-white font-bold text-[15px]">The White Lotus S3</p>
              <p className="text-white/60 text-[11px]">HBO · 8 episodes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Race label */}
      <div className="mx-4 mb-3">
        <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Who's ahead</p>
      </div>

      {/* Players */}
      <div className="mx-4 space-y-3 mb-5">
        {/* You — leading */}
        <div className="bg-purple-600/12 rounded-2xl p-4 border border-purple-500/25">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-[14px] font-bold">H</div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                <svg width="8" height="8" fill="white" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold">You</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 font-bold uppercase tracking-wide">Leading</span>
              </div>
              <p className="text-[11px] text-white/50">Ep 6 of 8 · 75% done</p>
            </div>
            <p className="text-[20px] font-black text-purple-300">6/8</p>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: "75%" }} />
          </div>
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-white/30 font-bold">VS</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Seth — trailing */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center text-[14px] font-bold">S</div>
            <div className="flex-1">
              <p className="text-[13px] font-bold">Seth</p>
              <p className="text-[11px] text-white/50">Ep 3 of 8 · 37% done</p>
            </div>
            <p className="text-[20px] font-black text-white/40">3/8</p>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-white/30" style={{ width: "37%" }} />
          </div>
        </div>
      </div>

      {/* Taunt message */}
      <div className="mx-4 mb-5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <p className="text-[12px] text-amber-300/80 text-center">
          You're <span className="font-bold text-amber-300">3 episodes ahead</span> of Seth — keep going!
        </p>
      </div>

      {/* Actions */}
      <div className="mx-4 mt-auto pb-10 space-y-2.5">
        <button className="w-full py-3.5 rounded-2xl font-bold text-[14px] bg-purple-600 text-white flex items-center justify-center gap-2">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          Update My Progress
        </button>
        <button className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-green-500/40 text-green-400 bg-green-500/8 flex items-center justify-center gap-2">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
          I Finished — Done!
        </button>
      </div>
    </div>
  );
}
