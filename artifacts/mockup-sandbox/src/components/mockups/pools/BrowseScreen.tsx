import { useState } from "react";
import { Flame, Star, Users, ChevronRight, Zap, Trophy, Share2, BookOpen, Tv, Music } from "lucide-react";

const DOMAIN = "";

const POOLS = [
  {
    id: 1,
    title: "Harry Potter",
    subtitle: "Wizarding World Trivia",
    round: "Round 2 of 3",
    players: 1284,
    closesIn: "18h",
    urgent: true,
    gradient: "linear-gradient(135deg, #1a0533 0%, #4a1272 50%, #7c3aed 100%)",
    icon: "⚡",
    friendsPlaying: ["Jordan", "Seth", "Trey"],
    myScore: null,
  },
  {
    id: 2,
    title: "Reelz True Crime",
    subtitle: "Official Partner Round",
    round: "Round 1 of 1",
    players: 847,
    closesIn: "2d",
    urgent: false,
    gradient: "linear-gradient(135deg, #1a0a0a 0%, #7f1d1d 50%, #dc2626 100%)",
    icon: "🔍",
    friendsPlaying: ["Jordan"],
    myScore: null,
    official: true,
  },
  {
    id: 3,
    title: "The Traitors S3",
    subtitle: "Who's the Traitor?",
    round: "Round 3 of 3",
    players: 2341,
    closesIn: "5d",
    urgent: false,
    gradient: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 50%, #2563eb 100%)",
    icon: "🗡️",
    friendsPlaying: ["Seth", "MoDjanie"],
    myScore: 8,
  },
  {
    id: 4,
    title: "Stranger Things",
    subtitle: "The Upside Down Edition",
    round: "Round 1 of 2",
    players: 3102,
    closesIn: "4d",
    urgent: false,
    gradient: "linear-gradient(135deg, #0a1a0a 0%, #14532d 50%, #16a34a 100%)",
    icon: "🔦",
    friendsPlaying: [],
    myScore: null,
  },
];

const FRIENDS_ACTIVITY = [
  { name: "Jordan", pool: "Harry Potter", score: 9, total: 10, color: "bg-violet-500" },
  { name: "Seth", pool: "The Traitors S3", score: 7, total: 10, color: "bg-blue-500" },
  { name: "Trey", pool: "Harry Potter", score: 6, total: 10, color: "bg-emerald-500" },
];

function AvatarCluster({ names, size = "sm" }: { names: string[]; size?: "sm" | "md" }) {
  const colors = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
  const sz = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[11px]";
  return (
    <div className="flex -space-x-1.5">
      {names.slice(0, 3).map((n, i) => (
        <div key={n} className={`${sz} ${colors[i % colors.length]} rounded-full flex items-center justify-center font-bold text-white border border-[#09091a] shrink-0`}>
          {n[0]}
        </div>
      ))}
    </div>
  );
}

export function BrowseScreen() {
  const [activeTab, setActiveTab] = useState("pools");
  const [navTab, setNavTab] = useState("play");

  return (
    <div
      className="w-[390px] h-[844px] flex flex-col overflow-hidden relative"
      style={{ background: "#09091a", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0">
        <span className="text-white text-xs font-semibold">9:41</span>
        <div className="flex gap-1 items-center">
          <div className="w-4 h-2.5 rounded-sm border border-white/50 relative">
            <div className="absolute inset-y-0.5 left-0.5 right-1 bg-white/60 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Top nav */}
      <div className="px-5 pt-1 pb-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Play</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <Trophy size={15} className="text-amber-400" />
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-0 px-5 mb-4 shrink-0">
        {["Trivia", "Polls", "Pools"].map((tab) => {
          const key = tab.toLowerCase();
          const active = activeTab === key;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(key)}
              className="flex-1 pb-2.5 text-sm font-semibold transition-all"
              style={{
                color: active ? "#a855f7" : "rgba(255,255,255,0.4)",
                borderBottom: active ? "2px solid #a855f7" : "2px solid rgba(255,255,255,0.08)",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24" style={{ scrollbarWidth: "none" }}>

        {/* Section: Friends playing */}
        {FRIENDS_ACTIVITY.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Friends Playing Now</p>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {FRIENDS_ACTIVITY.map((f) => (
                <div
                  key={f.name}
                  className="shrink-0 rounded-2xl px-3 py-2.5 flex items-center gap-2.5"
                  style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", minWidth: 160 }}
                >
                  <div className={`w-8 h-8 ${f.color} rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {f.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold leading-tight">{f.name}</p>
                    <p className="text-white/40 text-[10px] leading-tight truncate">{f.pool}</p>
                    <p className="text-amber-400 text-[10px] font-bold mt-0.5">{f.score}/{f.total} correct</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Available Pools */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Active Rounds</p>
            <button className="text-purple-400 text-xs font-medium flex items-center gap-0.5">
              See all <ChevronRight size={12} />
            </button>
          </div>

          <div className="space-y-3">
            {POOLS.map((pool) => (
              <div
                key={pool.id}
                className="rounded-2xl overflow-hidden relative"
                style={{ background: pool.gradient, border: "0.5px solid rgba(255,255,255,0.12)" }}
              >
                {pool.official && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.4)", border: "0.5px solid rgba(255,255,255,0.2)" }}>
                    <Zap size={9} className="text-amber-400" />
                    <span className="text-amber-300 text-[9px] font-bold uppercase tracking-wide">Official</span>
                  </div>
                )}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl leading-none mt-0.5">{pool.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[15px] font-bold leading-tight">{pool.title}</p>
                      <p className="text-white/60 text-xs mt-0.5">{pool.subtitle}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-white/50 text-[10px] font-medium">{pool.round}</span>
                        <div className="flex items-center gap-1">
                          {pool.urgent ? (
                            <Flame size={9} className="text-orange-400" />
                          ) : (
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                          )}
                          <span className={`text-[10px] font-semibold ${pool.urgent ? "text-orange-300" : "text-white/40"}`}>
                            Closes in {pool.closesIn}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Users size={10} className="text-white/40" />
                        <span className="text-white/40 text-[10px] font-medium">{pool.players.toLocaleString()} playing</span>
                      </div>
                      {pool.friendsPlaying.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AvatarCluster names={pool.friendsPlaying} />
                          <span className="text-purple-300 text-[10px] font-medium">{pool.friendsPlaying.length} friend{pool.friendsPlaying.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {pool.myScore !== null && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)" }}>
                          <Star size={9} className="text-amber-400 fill-amber-400" />
                          <span className="text-amber-300 text-[10px] font-bold">{pool.myScore}/10</span>
                        </div>
                      )}
                    </div>
                    <button
                      className="px-3 py-1.5 rounded-xl text-xs font-bold"
                      style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                    >
                      {pool.myScore !== null ? "See Results" : "Play Now"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create your own */}
        <div className="mt-4 mb-2">
          <div
            className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
            style={{ background: "rgba(168,85,247,0.08)", border: "0.5px dashed rgba(168,85,247,0.3)" }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)" }}>
              <Share2 size={16} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-purple-300 text-sm font-semibold">Challenge your friends</p>
              <p className="text-purple-400/60 text-xs mt-0.5">Share a pool link and compete</p>
            </div>
            <ChevronRight size={14} className="text-purple-400/60" />
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-2 pt-2 pb-6"
        style={{ background: "rgba(9,9,26,0.95)", borderTop: "0.5px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
      >
        {[
          { key: "activity", label: "Activity", icon: "●" },
          { key: "dna", label: "DNA", icon: "◈" },
          { key: "play", label: "Play", icon: "▶" },
          { key: "library", label: "Library", icon: "⊞" },
          { key: "leaders", label: "Leaders", icon: "◎" },
        ].map((item) => {
          const active = navTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setNavTab(item.key)}
              className="flex flex-col items-center gap-0.5"
            >
              <span className={`text-lg leading-none ${active ? "text-purple-400" : "text-white/30"}`}>{item.icon}</span>
              <span className={`text-[9px] font-semibold ${active ? "text-purple-400" : "text-white/30"}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
