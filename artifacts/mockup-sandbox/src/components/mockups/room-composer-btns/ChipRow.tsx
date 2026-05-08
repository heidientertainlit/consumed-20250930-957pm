export function ChipRow() {
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
          <div
            className="flex-1 flex items-center rounded-full px-4"
            style={{
              height: "36px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <span className="text-white/35 text-sm flex-1">Write something...</span>
            <div className="flex items-center gap-3 ml-2">
              <button className="flex items-center gap-1 text-white/50 text-xs font-medium hover:text-white/80 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Discuss
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button className="flex items-center gap-1 text-white/50 text-xs font-medium hover:text-violet-300 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Take
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
