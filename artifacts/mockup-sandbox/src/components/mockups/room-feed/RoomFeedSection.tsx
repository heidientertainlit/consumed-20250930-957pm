import { Bell, Search, User, ChevronRight, Users, Tv, BookOpen, CheckCircle2, Trophy } from "lucide-react";

const ROOMS = [
  {
    id: "friends",
    name: "Friends",
    icon: "☕",
    color: "#7c3aed",
    members: 1240,
    items: [
      {
        type: "prediction",
        question: "Who would win in a trivia battle?",
        options: ["Ross", "Monica", "Chandler", "Joey"],
        votes: [38, 29, 21, 12],
        totalVotes: 847,
        userVoted: 0,
      },
      {
        type: "poll",
        question: "Best Friends holiday episode?",
        options: ["The One with Christmas in Tulsa", "The One Where Rachel Quits", "The One with the Holiday Armadillo"],
        votes: [44, 28, 28],
        totalVotes: 612,
        userVoted: null,
      },
    ],
  },
  {
    id: "gilmore-girls",
    name: "Gilmore Girls",
    icon: "☕",
    color: "#0e7490",
    members: 892,
    items: [
      {
        type: "prediction",
        question: "Who should Rory have ended up with?",
        options: ["Dean", "Jess", "Logan"],
        votes: [19, 47, 34],
        totalVotes: 1103,
        userVoted: null,
      },
    ],
  },
];

function TopNav() {
  return (
    <div className="flex items-center justify-between px-4 pt-12 pb-3" style={{ background: "transparent" }}>
      <div className="flex items-center gap-1">
        <span className="text-xl font-black tracking-tight" style={{ color: "#fff", fontFamily: "'Inter', sans-serif" }}>consumed</span>
      </div>
      <div className="flex items-center gap-4">
        <Search size={20} color="#d1d5db" />
        <Bell size={20} color="#d1d5db" />
        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center">
          <User size={14} color="#fff" />
        </div>
      </div>
    </div>
  );
}

function TodaysPlayCard() {
  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #6d28d9, #7c3aed, #4f46e5)" }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Trophy size={13} color="#fbbf24" />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#fbbf24" }}>Today's Play</span>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>+20 pts</span>
        </div>
        <p className="text-base font-bold text-white mb-3 leading-snug">Team Edward or Team Jacob?</p>
        <div className="flex flex-col gap-2">
          {["Team Edward", "Team Jacob"].map((opt, i) => (
            <button
              key={opt}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-left transition-all"
              style={{
                background: i === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)",
                border: i === 0 ? "1.5px solid rgba(255,255,255,0.5)" : "1.5px solid rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>847 votes</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteBar({ pct, active }: { pct: number; active: boolean }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(0,0,0,0.15)" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: active ? "#7c3aed" : "rgba(107,114,128,0.6)",
        }}
      />
    </div>
  );
}

function RoomPredictionCard({ item, roomColor }: { item: (typeof ROOMS)[0]["items"][0]; roomColor: string }) {
  const total = item.totalVotes;
  return (
    <div className="mb-3 rounded-2xl overflow-hidden" style={{ background: "#1e1b2e", border: "0.5px solid rgba(255,255,255,0.08)" }}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-sm font-semibold text-white mb-3 leading-snug">{item.question}</p>
        <div className="flex flex-col gap-2">
          {item.options.map((opt, i) => {
            const pct = Math.round((item.votes[i] / total) * 100);
            const isVoted = item.userVoted === i;
            return (
              <div key={opt}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isVoted && <CheckCircle2 size={12} color={roomColor} />}
                    <span className="text-xs text-gray-300 font-medium">{opt}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: isVoted ? roomColor : "#9ca3af" }}>{pct}%</span>
                </div>
                <VoteBar pct={pct} active={isVoted} />
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs" style={{ color: "#6b7280" }}>{total.toLocaleString()} votes</span>
          {item.type === "prediction" && (
            <span className="text-xs font-medium" style={{ color: roomColor }}>Prediction</span>
          )}
          {item.type === "poll" && (
            <span className="text-xs font-medium" style={{ color: "#6b7280" }}>Poll</span>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomSection({ room }: { room: (typeof ROOMS)[0] }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: room.color }}>
            <Tv size={12} color="#fff" />
          </div>
          <span className="text-sm font-bold text-white">{room.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
            {room.members.toLocaleString()} members
          </span>
        </div>
        <button className="flex items-center gap-0.5 text-xs" style={{ color: "#6b7280" }}>
          See room <ChevronRight size={12} />
        </button>
      </div>
      <div className="px-4">
        {room.items.map((item, i) => (
          <RoomPredictionCard key={i} item={item as any} roomColor={room.color} />
        ))}
      </div>
    </div>
  );
}

export function RoomFeedSection() {
  return (
    <div
      className="min-h-screen overflow-y-auto"
      style={{
        background: "linear-gradient(180deg, #0d0a1a 0%, #110e22 40%, #0d0a1a 100%)",
        fontFamily: "'Inter', sans-serif",
        maxWidth: 390,
        margin: "0 auto",
      }}
    >
      <TopNav />

      <TodaysPlayCard />

      <div className="mb-2">
        <div className="flex items-center justify-between px-4 mb-3">
          <div className="flex items-center gap-2">
            <Users size={14} color="#a78bfa" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>From rooms you've joined</span>
          </div>
          <button className="text-xs" style={{ color: "#6b7280" }}>Manage</button>
        </div>
        {ROOMS.map((room) => (
          <RoomSection key={room.id} room={room} />
        ))}
      </div>

      <div className="px-4 pt-2 pb-2 mb-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-xs" style={{ color: "#4b5563" }}>Activity Feed</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>

      <div className="px-4 space-y-3 pb-24">
        {[
          { user: "Trey", action: "rated", title: "The White Lotus", rating: "9/10", time: "2m" },
          { user: "MoDjanie", action: "added to library", title: "The Bobiverse", rating: null, time: "14m" },
          { user: "BrookeM22", action: "reviewed", title: "Sinners", rating: "8/10", time: "31m" },
        ].map((post, i) => (
          <div key={i} className="rounded-2xl p-3.5" style={{ background: "#1e1b2e", border: "0.5px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0">
                <User size={14} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-white">{post.user}</span>
                  <span className="text-xs text-gray-500">{post.action}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 font-medium">{post.title}</span>
                  <div className="flex items-center gap-2">
                    {post.rating && (
                      <span className="text-xs font-bold" style={{ color: "#a78bfa" }}>{post.rating}</span>
                    )}
                    <span className="text-xs text-gray-600">{post.time}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
