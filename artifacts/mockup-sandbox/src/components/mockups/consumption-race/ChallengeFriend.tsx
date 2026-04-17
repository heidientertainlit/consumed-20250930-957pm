export function ChallengeFriend() {
  return (
    <div className="min-h-screen bg-[#f8f8fb] text-gray-900 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
          <svg width="16" height="16" fill="none" stroke="#374151" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="text-[17px] font-bold text-gray-900">Binge Battle</h1>
          <p className="text-[11px] text-gray-400 leading-snug">First to the finish, wins... choose a friend,<br/>set the terms, pick the media, and go.</p>
        </div>
      </div>

      {/* Step 1 — Pick the Media */}
      <div className="mx-4 mb-4">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">1 · Pick the media</p>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-3 shadow-sm">
          <svg width="14" height="14" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="text-[13px] text-gray-400">Search shows, movies, books, podcasts...</span>
        </div>

        {/* Suggestions */}
        <div className="space-y-2">
          {[
            { title: "The White Lotus", sub: "Season 3 · HBO · 8 eps", type: "TV", poster: "https://image.tmdb.org/t/p/w200/b9EkMX6fFJ8oMkFhTiKmLPAOGqH.jpg", selected: true },
            { title: "Severance", sub: "Season 2 · Apple TV+ · 10 eps", type: "TV", poster: "https://image.tmdb.org/t/p/w200/yTD6vPMQuoTBv4TFJNzFLEwtTmo.jpg", selected: false },
            { title: "Intermezzo", sub: "Sally Rooney · 2024", type: "Book", poster: "https://covers.openlibrary.org/b/id/14633854-M.jpg", selected: false },
          ].map((item) => (
            <div
              key={item.title}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                item.selected
                  ? "bg-purple-50 border-purple-200"
                  : "bg-white border-gray-150"
              }`}
              style={{ borderColor: item.selected ? undefined : "#ececf0" }}
            >
              <img src={item.poster} alt={item.title} className="w-10 h-14 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{item.title}</p>
                <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  item.selected ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                }`}>{item.type}</span>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                item.selected ? "bg-purple-600 border-purple-600" : "border-gray-300"
              }`}>
                {item.selected && (
                  <svg width="10" height="10" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2 — Battle Type */}
      <div className="mx-4 mb-4">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">2 · Set the terms</p>
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl text-[12px] font-bold bg-purple-600 text-white border border-purple-600 shadow-sm">
            First to finish
          </button>
          <button className="flex-1 py-2.5 rounded-xl text-[12px] font-bold bg-white text-gray-400 border border-gray-200">
            Most in 7 days
          </button>
        </div>
      </div>

      {/* Step 3 — Challenge Friends */}
      <div className="mx-4 mb-5">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">3 · Choose a friend</p>
        <div className="space-y-2">
          {[
            { name: "Seth", handle: "@seth_watches", avatar: "S", color: "#7c3aed", active: true },
            { name: "Trey", handle: "@treyvibes", avatar: "T", color: "#0891b2", active: false },
            { name: "Kendall", handle: "@kendall", avatar: "K", color: "#d97706", active: false },
          ].map((friend) => (
            <div
              key={friend.name}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                friend.active ? "bg-purple-50 border-purple-200" : "bg-white"
              }`}
              style={{ borderColor: friend.active ? undefined : "#ececf0" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                style={{ background: friend.color }}
              >
                {friend.avatar}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-gray-900">{friend.name}</p>
                <p className="text-[11px] text-gray-400">{friend.handle}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                friend.active ? "bg-purple-600 border-purple-600" : "border-gray-300"
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
        <button className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          Challenge Seth
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2">Seth will get a notification to accept</p>
      </div>
    </div>
  );
}
