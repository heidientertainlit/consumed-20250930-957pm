function ActivityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1.5" /><rect x="14" y="2" width="8" height="8" rx="1.5" />
      <rect x="2" y="14" width="8" height="8" rx="1.5" /><rect x="14" y="14" width="8" height="8" rx="1.5" />
      <circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none" /><circle cx="18" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function LibraryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
function RoomsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" />
      <path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L4 20V5.562a2 2 0 0 1 1.515-1.94l6-1.5a1 1 0 0 1 1.243.97v.44z" />
    </svg>
  );
}

export default function VariantA() {
  return (
    <div className="w-[390px] h-[140px] flex flex-col justify-end" style={{ background: "linear-gradient(to bottom, #0a0a0f, #12121f)" }}>
      <nav className="flex justify-around items-center px-2 pb-4 pt-2" style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }}>
        <button className="flex flex-col items-center gap-0.5 text-white opacity-50">
          <div className="h-[22px] flex items-center"><ActivityIcon /></div>
          <span className="text-[10px]">Now</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-white opacity-50">
          <div className="h-[22px] flex items-center"><PlayIcon /></div>
          <span className="text-[10px]">Play</span>
        </button>

        {/* Variant A: Gradient glowing FAB */}
        <button className="flex flex-col items-center gap-0.5 -mt-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", boxShadow: "0 0 14px 3px rgba(139,92,246,0.55)" }}>
            <span className="text-white text-[22px] font-light leading-none mb-px">+</span>
          </div>
          <span className="text-transparent text-[10px]">·</span>
        </button>

        <button className="flex flex-col items-center gap-0.5 text-white opacity-50">
          <div className="h-[22px] flex items-center"><LibraryIcon /></div>
          <span className="text-[10px]">Library</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-white opacity-50">
          <div className="h-[22px] flex items-center"><RoomsIcon /></div>
          <span className="text-[10px]">Rooms</span>
        </button>
      </nav>
    </div>
  );
}
