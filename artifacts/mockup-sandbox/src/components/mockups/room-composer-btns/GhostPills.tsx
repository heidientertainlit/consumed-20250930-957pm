export function GhostPills() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0f1a]">
      <div className="w-[390px] px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan"
            alt="avatar"
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            style={{ background: "#2a2a3a" }}
          />
          <div className="flex gap-2 flex-1">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full border border-white/20 text-white/70 text-sm font-medium hover:border-white/40 hover:text-white transition-colors"
              style={{ background: "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Start a conversation
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full border border-white/20 text-white/70 text-sm font-medium hover:border-violet-400/60 hover:text-violet-300 transition-colors"
              style={{ background: "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Drop a take
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
