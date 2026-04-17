export function ChallengeFriend() {
  return (
    <div className="min-h-screen bg-[#0f0f13] text-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="text-[17px] font-bold">Challenge a Friend</h1>
      </div>

      {/* Selected Media */}
      <div className="mx-4 mb-5">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Racing on</p>
        <div className="bg-white/8 rounded-2xl p-3 flex items-center gap-3 border border-white/10">
          <img
            src="https://image.tmdb.org/t/p/w200/b9EkMX6fFJ8oMkFhTiKmLPAOGqH.jpg"
            alt="The White Lotus"
            className="w-14 h-20 rounded-lg object-cover shrink-0"
          />
          <div>
            <p className="text-[15px] font-bold">The White Lotus</p>
            <p className="text-[12px] text-white/50 mt-0.5">Season 3 · HBO · 8 episodes</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">TV Show</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/8 text-white/50">Drama</span>
            </div>
          </div>
          <button className="ml-auto p-2 rounded-xl bg-white/8 text-white/40">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>

      {/* Race Type */}
      <div className="mx-4 mb-5">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Race type</p>
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl text-[12px] font-bold bg-purple-600 text-white border border-purple-500">
            First to finish
          </button>
          <button className="flex-1 py-2.5 rounded-xl text-[12px] font-bold bg-white/8 text-white/50 border border-white/10">
            Most progress in 7 days
          </button>
        </div>
      </div>

      {/* Challenge Friends */}
      <div className="mx-4 mb-5">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-3 font-semibold">Challenge</p>
        <div className="space-y-2">
          {[
            { name: "Seth", handle: "@seth_watches", avatar: "S", color: "#7c3aed", active: true },
            { name: "Trey", handle: "@treyvibes", avatar: "T", color: "#0891b2", active: false },
            { name: "Kendall", handle: "@kendall", avatar: "K", color: "#d97706", active: false },
          ].map((friend) => (
            <div
              key={friend.name}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                friend.active
                  ? "bg-purple-600/15 border-purple-500/40"
                  : "bg-white/5 border-white/8"
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                style={{ background: friend.color }}
              >
                {friend.avatar}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold">{friend.name}</p>
                <p className="text-[11px] text-white/40">{friend.handle}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                friend.active ? "bg-purple-600 border-purple-500" : "border-white/20"
              }`}>
                {friend.active && (
                  <svg width="10" height="10" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mx-4 mt-auto pb-10">
        <button className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          Send Challenge to Seth
        </button>
        <p className="text-center text-[11px] text-white/30 mt-2">Seth will get a notification to accept</p>
      </div>
    </div>
  );
}
