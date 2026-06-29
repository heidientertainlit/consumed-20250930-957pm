import { useState } from "react";
import {
  ChevronLeft, Share2, MoreHorizontal, Sparkles, Check, Plus,
  TrendingUp, Sparkle, MessageCircle, ArrowUpRight,
  Brain, Vote, Zap, Flame, Bookmark, Bell, Users,
} from "lucide-react";
import Navigation from "@/components/navigation";

/**
 * NEW ROOM (design template) — genre/topic room, e.g. "True Crime".
 * Standalone at /new-room so the live room template (pool-detail.tsx) is untouched.
 * Layers in: a "% match" (how much the room fits the user), Follow/Following,
 * and a new "Play" games strip — on top of the spotlight / explore / titles / takes flow.
 */

const ACCENT = "#7c3aed";

// ── Explore quick-filters ─────────────────────────────────────────────
const EXPLORE = [
  { label: "Trending\nThis Week", icon: TrendingUp, bg: "#f3effe", fg: "#7c3aed" },
  { label: "New\nReleases", icon: Sparkle, bg: "#eef4ff", fg: "#3b6df6" },
  { label: "Most\nDiscussed", icon: MessageCircle, bg: "#ffeef0", fg: "#ef4d65" },
  { label: "Predictions\nRising", icon: ArrowUpRight, bg: "#fff6e8", fg: "#e08a14" },
];

// ── Play (games) strip ────────────────────────────────────────────────
const GAMES = [
  { kind: "Trivia", title: "Who really did it?", meta: "3 questions", pts: 30, icon: Brain, from: "#7c3aed", to: "#a855f7" },
  { kind: "Daily Poll", title: "Best true-crime doc of all time?", meta: "1.2K voted", pts: 10, icon: Vote, from: "#2563eb", to: "#3b82f6" },
  { kind: "Prediction", title: "Will the verdict come back guilty?", meta: "Closes in 2d", pts: 25, icon: Zap, from: "#db2777", to: "#f43f5e" },
];

// ── Popular titles (gradient poster placeholders for the template) ────
const TITLES = [
  { name: "Paradise", from: "#3a2f5e", to: "#1a1530" },
  { name: "Dateline", from: "#1f2937", to: "#0b1220" },
  { name: "Making a Murderer", from: "#4a2f2f", to: "#1f1414" },
  { name: "On Patrol Live", from: "#1e3a34", to: "#0c1a17" },
];

// ── Hot takes ─────────────────────────────────────────────────────────
const TAKES = [
  { author: "Maya R.", time: "2h", text: "The sheriff absolutely knew.", agree: 237, replies: 89 },
  { author: "Devon K.", time: "5h", text: "Episode 4 reframes the whole timeline — rewatch the diner scene.", agree: 154, replies: 41 },
];

function SectionHeader({ title, action = "See all" }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between px-5 mb-3">
      <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      <button className="text-[13px] font-semibold" style={{ color: ACCENT }}>{action}</button>
    </div>
  );
}

export default function NewRoom() {
  const [following, setFollowing] = useState(false);
  const matchPct = 92;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto pb-28">

        {/* ── Header ── */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center justify-between px-3 py-3">
            <button onClick={() => window.history.back()} className="p-1.5 rounded-full active:bg-gray-100">
              <ChevronLeft size={24} className="text-gray-900" />
            </button>
            <div className="text-center">
              <h1 className="text-[17px] font-bold text-gray-900 leading-tight">True Crime</h1>
              <p className="text-[12px] text-gray-500">
                124K members <span className="text-emerald-500">•</span> 2.1K online
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-full active:bg-gray-100"><Share2 size={19} className="text-gray-700" /></button>
              <button className="p-1.5 rounded-full active:bg-gray-100"><MoreHorizontal size={20} className="text-gray-700" /></button>
            </div>
          </div>
        </div>

        {/* ── Match + Follow (room vibe) ── */}
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-gray-100 p-3.5" style={{ background: "linear-gradient(135deg,#faf7ff,#f3effe)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ACCENT }}>
                  <Sparkles size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-gray-900 leading-tight">
                    {matchPct}% your vibe
                  </p>
                  <p className="text-[12px] text-gray-500 leading-tight">Matches your Entertainment DNA</p>
                </div>
              </div>
              <button
                onClick={() => setFollowing(f => !f)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold flex-shrink-0 transition-all active:scale-95 ${
                  following ? "bg-gray-100 text-gray-700" : "text-white"
                }`}
                style={following ? undefined : { background: ACCENT }}
              >
                {following ? <><Check size={15} /> Following</> : <><Plus size={15} /> Follow</>}
              </button>
            </div>
            {/* match bar */}
            <div className="mt-3 h-1.5 rounded-full bg-white overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${matchPct}%`, background: `linear-gradient(90deg,${ACCENT},#a855f7)` }} />
            </div>
          </div>
        </div>

        {/* ── This Week's Spotlight ── */}
        <div className="px-4 pt-6">
          <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500 mb-3 px-1">This Week's Spotlight</p>
          <div className="relative rounded-3xl overflow-hidden h-44" style={{ background: "linear-gradient(120deg,#1a1530 0%,#2d1f4e 55%,#4a2f5e 100%)" }}>
            <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 80% 30%, rgba(168,85,247,0.6), transparent 60%)" }} />
            <div className="absolute inset-0 p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-white text-2xl font-extrabold leading-tight">Paradise Finale</h2>
                <p className="text-white/70 text-[14px] mt-1 max-w-[200px]">Everyone is debating the ending.</p>
              </div>
              <button className="self-start bg-white text-gray-900 text-[13px] font-bold px-4 py-2.5 rounded-full active:scale-95 transition-transform">
                Join the conversation
              </button>
            </div>
          </div>
        </div>

        {/* ── Play (games) ── NEW */}
        <div className="pt-7">
          <SectionHeader title="Play" />
          <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {GAMES.map((g, i) => {
              const Icon = g.icon;
              return (
                <button
                  key={i}
                  className="flex-shrink-0 w-[200px] rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
                  style={{ background: `linear-gradient(135deg,${g.from},${g.to})` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Icon size={18} className="text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white bg-black/20 px-2 py-0.5 rounded-full">+{g.pts} pts</span>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{g.kind}</p>
                  <p className="text-[14px] font-bold text-white leading-snug mt-0.5">{g.title}</p>
                  <p className="text-[12px] text-white/60 mt-2">{g.meta}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Explore ── */}
        <div className="pt-7">
          <SectionHeader title="Explore" />
          <div className="grid grid-cols-4 gap-2.5 px-4">
            {EXPLORE.map((e, i) => {
              const Icon = e.icon;
              return (
                <button key={i} className="rounded-2xl p-3 text-left active:scale-95 transition-transform" style={{ background: e.bg }}>
                  <p className="text-[11px] font-bold text-gray-800 leading-tight whitespace-pre-line mb-3">{e.label}</p>
                  <Icon size={16} style={{ color: e.fg }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Popular Titles ── */}
        <div className="pt-7">
          <SectionHeader title="Popular Titles" />
          <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {TITLES.map((t, i) => (
              <div key={i} className="flex-shrink-0 w-[110px]">
                <div className="relative w-[110px] h-[160px] rounded-xl overflow-hidden flex items-end p-2.5" style={{ background: `linear-gradient(160deg,${t.from},${t.to})` }}>
                  <span className="text-white text-[13px] font-extrabold leading-tight drop-shadow">{t.name}</span>
                </div>
                <p className="text-[12px] font-medium text-gray-700 mt-1.5 text-center leading-tight">{t.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hot Takes ── */}
        <div className="pt-7">
          <SectionHeader title="Hot Takes" action="" />
          <div className="px-4 space-y-3">
            {TAKES.map((t, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Flame size={14} className="text-orange-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-orange-500">Hot Take</span>
                    <span className="text-[12px] text-gray-400">· {t.time}</span>
                  </div>
                  <button><MoreHorizontal size={18} className="text-gray-400" /></button>
                </div>
                <p className="text-[15px] font-semibold text-gray-900 mb-3">{t.text}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[13px] text-gray-500">
                    <span className="flex items-center gap-1"><Users size={14} /> {t.agree} agree</span>
                    <span>{t.replies} replies</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400">
                    <button className="active:text-gray-700"><Bookmark size={16} /></button>
                    <button className="active:text-gray-700"><Bell size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      <Navigation />
    </div>
  );
}
