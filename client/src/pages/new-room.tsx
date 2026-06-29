import { useState } from "react";
import {
  ChevronLeft, MoreHorizontal, Check, Plus, Star, Trophy, Search, Globe, Copy,
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

        {/* ── Purple gradient hero header ── */}
        <div className="relative px-4 pt-3 pb-5" style={{ background: "linear-gradient(165deg, #14101f 0%, #1d1638 55%, #2d1f6e 100%)" }}>
          {/* glow */}
          <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(circle at 85% 10%, rgba(168,85,247,0.45), transparent 55%)" }} />

          <div className="relative">
            {/* Top utility bar */}
            <div className="flex items-center justify-end gap-3 mb-4">
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span className="text-[13px] font-bold text-white">16.4k</span>
                <span className="text-[12px] text-white/50">pts</span>
              </div>
              <button className="active:scale-90 transition-transform"><Trophy size={20} className="text-white/85" /></button>
              <button className="active:scale-90 transition-transform"><Search size={20} className="text-white/85" /></button>
              <button className="active:scale-90 transition-transform"><Bell size={20} className="text-white/85" /></button>
            </div>

            {/* Back + Following / Invite */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => window.history.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
                <ChevronLeft size={26} className="text-white" />
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setFollowing(f => !f)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold active:scale-95 transition-all"
                  style={following
                    ? { background: "rgba(124,58,237,0.35)", border: "1px solid rgba(168,85,247,0.6)", color: "#e9d5ff" }
                    : { background: ACCENT, color: "#fff" }}
                >
                  {following ? <><Check size={15} /> Following</> : <><Plus size={15} /> Follow</>}
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white/90 active:scale-95 transition-all" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
                  <Copy size={14} /> Invite
                </button>
              </div>
            </div>

            {/* Title block (no poster) */}
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-purple-300/80 mb-1">Room</p>
            <h1 className="text-[30px] font-extrabold text-white leading-tight">True Crime</h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Globe size={14} className="text-emerald-400" />
              <span className="text-[14px] font-semibold text-emerald-400">Public</span>
            </div>

            {/* Member avatars */}
            <div className="flex items-center mt-3">
              {[
                { i: "J", c: "#f59e0b" },
                { i: "J", c: "#a855f7" },
                { i: "H", c: "#22d3ee" },
              ].map((a, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white ring-2"
                  style={{ background: a.c, marginLeft: idx === 0 ? 0 : -8, ['--tw-ring-color' as any]: "#1d1638" }}
                >
                  {a.i}
                </div>
              ))}
              <span className="ml-3 text-[13px] text-white/50">124K members</span>
            </div>

            {/* Room vibe bar (carries MATCH %) */}
            <div className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Room Vibe</span>
              <div className="flex items-center gap-1.5">
                <MessageCircle size={15} className="text-purple-300" />
                <span className="text-[14px] font-semibold text-white">Discussion crew</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7)" }}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">Match</span>
                <span className="text-[13px] font-extrabold text-white">{matchPct}%</span>
              </div>
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
