import { useState } from "react";
import { ChevronLeft, ChevronRight, Star, Flame, CheckCircle2, X, Share2, Users } from "lucide-react";

const QUESTIONS = [
  {
    id: 1,
    text: "What platform did On Patrol: Live originally stream on before Reelz?",
    options: ["Peacock", "YouTube Live", "Twitch", "Facebook Live"],
    correct: "Reelz",
    answered: "YouTube Live",
    isCorrect: false,
    voteCounts: { "Peacock": 18, "YouTube Live": 41, "Twitch": 9, "Facebook Live": 12 },
    players: 80,
  },
  {
    id: 2,
    text: "On Patrol: Live is a revival of which cancelled show?",
    options: ["The First 48", "Live PD", "Cops", "The Rookie"],
    correct: "Live PD",
    answered: null,
    isCorrect: null,
    voteCounts: {},
    players: 0,
  },
  {
    id: 3,
    text: "Which element of Gangsters: America's Most Evil is most compelling to you?",
    options: ["The rise — how they built power", "The fall — how they got caught", "The inner circle betrayals", "The victims' stories"],
    correct: null,
    answered: null,
    isCorrect: null,
    voteCounts: {},
    players: 0,
  },
  {
    id: 4,
    text: "What's more disturbing to you on Murder Made Me Famous?",
    options: ["That killers become household names", "The media's role in making them famous", "How ordinary their lives looked before", "The victims get less coverage"],
    correct: null,
    answered: null,
    isCorrect: null,
    voteCounts: {},
    players: 0,
  },
  {
    id: 5,
    text: "Do you watch On Patrol: Live live, or catch it later?",
    options: ["Always live — that's the whole point", "Usually live, occasionally catch up", "Mostly on demand later", "I didn't know there was a difference"],
    correct: null,
    answered: null,
    isCorrect: null,
    voteCounts: {},
    players: 0,
  },
];

const FRIENDS = ["Jordan", "Seth", "Trey"];
const FRIENDS_SCORES = [
  { name: "Jordan", score: 3, color: "bg-violet-500" },
  { name: "Seth", score: 1, color: "bg-blue-500" },
  { name: "Trey", score: 2, color: "bg-emerald-500" },
];

function avatarColor(name: string) {
  const colors = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  return colors[name.charCodeAt(0) % colors.length];
}

export function PlayingScreen() {
  const [cardIndex, setCardIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<number, string>>({ 1: "YouTube Live" });
  const [showShare, setShowShare] = useState(false);

  const current = QUESTIONS[cardIndex];
  const myAnswer = localAnswers[current.id] ?? null;
  const hasAnswered = myAnswer !== null;
  const answeredCount = Object.keys(localAnswers).length;

  const totalVotes = Object.values(current.voteCounts).reduce((s, n) => s + n, 0);

  function handlePick(opt: string) {
    if (hasAnswered) return;
    setLocalAnswers(prev => ({ ...prev, [current.id]: opt }));
  }

  return (
    <div
      className="w-[390px] h-[844px] flex flex-col overflow-hidden relative"
      style={{ background: "#09091a", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0">
        <span className="text-white text-xs font-semibold">9:41</span>
        <div className="w-4 h-2.5 rounded-sm border border-white/50 relative">
          <div className="absolute inset-y-0.5 left-0.5 right-1 bg-white/60 rounded-sm" />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-1 pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <button className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={14} className="text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest leading-none">Reelz True Crime</p>
            <p className="text-white text-[15px] font-bold leading-tight">Round 1 · Official Pool</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(249,115,22,0.15)", border: "0.5px solid rgba(249,115,22,0.3)" }}>
            <Flame size={10} className="text-orange-400" />
            <span className="text-orange-300 text-[10px] font-bold">Closes in 18h</span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/40 text-[10px] font-medium">{answeredCount} of {QUESTIONS.length} answered</span>
          <div className="flex items-center gap-1">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-amber-400 text-[10px] font-bold">{answeredCount * 2} pts</span>
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          />
        </div>
      </div>

      {/* Friends mini-leaderboard */}
      <div className="px-4 mb-3 shrink-0">
        <div
          className="rounded-2xl px-3 py-2.5 flex items-center justify-between"
          style={{ background: "rgba(168,85,247,0.08)", border: "0.5px solid rgba(168,85,247,0.15)" }}
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {FRIENDS.map((n) => (
                <div key={n} className={`w-5 h-5 ${avatarColor(n)} rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-[#09091a]`}>
                  {n[0]}
                </div>
              ))}
            </div>
            <span className="text-purple-300 text-[10px] font-medium">3 friends playing</span>
          </div>
          <div className="flex items-center gap-2">
            {FRIENDS_SCORES.map((f) => (
              <div key={f.name} className="flex items-center gap-1">
                <div className={`w-4 h-4 ${f.color} rounded-full flex items-center justify-center text-[7px] font-bold text-white`}>{f.name[0]}</div>
                <span className="text-white/60 text-[9px] font-semibold">{f.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col px-4 min-h-0">
        <div
          className="rounded-2xl overflow-hidden flex flex-col flex-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)" }}
        >
          {/* Card header */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Q{cardIndex + 1} / {QUESTIONS.length}</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}
            >
              2 pts
            </span>
          </div>

          {/* Question */}
          <div className="px-4 pb-4 shrink-0">
            <p className="text-white text-[15px] font-semibold leading-snug">{current.text}</p>
          </div>

          {/* Options or Results */}
          <div className="px-4 pb-4 space-y-2 flex-1 flex flex-col justify-center">
            {!hasAnswered ? (
              current.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handlePick(opt)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.2)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.5)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  {opt}
                </button>
              ))
            ) : (
              (() => {
                const votes = totalVotes > 0 ? current.voteCounts :
                  Object.fromEntries(current.options.map((o, i) => [o, [35, 28, 22, 15][i]]));
                const totalV = Object.values(votes).reduce((s, n) => s + n, 0);
                const isCorrect = current.correct ? myAnswer === current.correct : null;
                return current.options.map((opt) => {
                  const count = votes[opt] || 0;
                  const pct = totalV > 0 ? Math.round((count / totalV) * 100) : 0;
                  const isMine = opt === myAnswer;
                  const isCorrectOpt = current.correct === opt;
                  return (
                    <div key={opt} className="relative">
                      <div
                        className="relative rounded-xl px-4 py-2.5 overflow-hidden"
                        style={{
                          border: isCorrectOpt
                            ? "0.5px solid rgba(34,197,94,0.5)"
                            : isMine
                              ? "0.5px solid rgba(168,85,247,0.5)"
                              : "0.5px solid rgba(255,255,255,0.08)"
                        }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: isCorrectOpt
                              ? "rgba(34,197,94,0.12)"
                              : isMine
                                ? "rgba(168,85,247,0.15)"
                                : "rgba(255,255,255,0.04)"
                          }}
                        />
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isMine && isCorrect === true && <CheckCircle2 size={12} className="text-green-400 shrink-0" />}
                            {isMine && isCorrect === false && <X size={12} className="text-red-400 shrink-0" />}
                            {isMine && isCorrect === null && <CheckCircle2 size={12} className="text-purple-400 shrink-0" />}
                            {isCorrectOpt && !isMine && <CheckCircle2 size={12} className="text-green-400 shrink-0" />}
                            <span className="text-sm font-medium" style={{
                              color: isCorrectOpt ? "#86efac" : isMine ? "#d8b4fe" : "rgba(255,255,255,0.5)"
                            }}>
                              {opt}
                            </span>
                          </div>
                          <span className="text-xs font-bold tabular-nums" style={{
                            color: isCorrectOpt ? "#86efac" : isMine ? "#d8b4fe" : "rgba(255,255,255,0.3)"
                          }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>

          {/* Card footer */}
          <div className="px-4 py-2.5 shrink-0" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {["Jordan", "Seth", "MoDjanie"].map((n) => (
                    <div key={n} className={`w-4 h-4 ${avatarColor(n)} rounded-full flex items-center justify-center text-[7px] font-bold text-white border border-[#09091a]`}>{n[0]}</div>
                  ))}
                </div>
                <span className="text-white/30 text-[10px]">
                  {hasAnswered ? "80 players answered" : "Be the first to answer"}
                </span>
              </div>
              {hasAnswered && (
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                  style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}
                  onClick={() => setShowShare(true)}
                >
                  <Share2 size={10} />
                  Challenge
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dot indicators + Nav */}
      <div className="flex justify-center gap-1.5 py-3 shrink-0">
        {QUESTIONS.map((q, i) => {
          const answered = localAnswers[q.id] !== undefined;
          const active = i === cardIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCardIndex(i)}
              className="rounded-full transition-all"
              style={{
                width: active ? 16 : 8,
                height: 8,
                background: active ? "#a855f7" : answered ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.15)"
              }}
            />
          );
        })}
      </div>

      {/* Prev / Next */}
      <div className="flex items-center justify-between px-4 mb-2 shrink-0">
        <button
          onClick={() => setCardIndex(i => Math.max(0, i - 1))}
          disabled={cardIndex === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          style={{
            background: cardIndex === 0 ? "transparent" : "rgba(255,255,255,0.06)",
            color: cardIndex === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
            border: "0.5px solid",
            borderColor: cardIndex === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)"
          }}
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <button
          onClick={() => setCardIndex(i => Math.min(QUESTIONS.length - 1, i + 1))}
          disabled={cardIndex === QUESTIONS.length - 1}
          className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold transition-all"
          style={{
            background: cardIndex === QUESTIONS.length - 1 ? "transparent" : "rgba(168,85,247,0.15)",
            color: cardIndex === QUESTIONS.length - 1 ? "rgba(255,255,255,0.15)" : "#c084fc",
            border: "0.5px solid",
            borderColor: cardIndex === QUESTIONS.length - 1 ? "rgba(255,255,255,0.05)" : "rgba(168,85,247,0.3)"
          }}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Bottom nav */}
      <div
        className="shrink-0 flex items-center justify-around px-2 pt-2 pb-6"
        style={{ background: "rgba(9,9,26,0.95)", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}
      >
        {[
          { key: "activity", label: "Activity", icon: "●" },
          { key: "dna", label: "DNA", icon: "◈" },
          { key: "play", label: "Play", icon: "▶" },
          { key: "library", label: "Library", icon: "⊞" },
          { key: "leaders", label: "Leaders", icon: "◎" },
        ].map((item) => {
          const active = item.key === "play";
          return (
            <button key={item.key} className="flex flex-col items-center gap-0.5">
              <span className={`text-lg leading-none ${active ? "text-purple-400" : "text-white/30"}`}>{item.icon}</span>
              <span className={`text-[9px] font-semibold ${active ? "text-purple-400" : "text-white/30"}`}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Share overlay */}
      {showShare && (
        <div
          className="absolute inset-0 flex items-end"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowShare(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: "#13132b", border: "0.5px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <p className="text-white text-base font-bold mb-1">Challenge your friends</p>
            <p className="text-white/40 text-sm mb-5">Share this pool link — they play the same round and compete on your leaderboard</p>
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
              style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)" }}
            >
              <span className="text-white/60 text-sm flex-1 truncate">consumed.app/pool/reelz-round-1</span>
              <button className="text-purple-400 text-sm font-bold">Copy</button>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: "#7c3aed", color: "white" }}>
                Send in App
              </button>
              <button className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                Share Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
