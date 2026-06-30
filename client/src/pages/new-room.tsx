import { useState } from "react";
import {
  ChevronLeft, ChevronRight, MoreHorizontal, Check, Plus, Globe, Copy,
  TrendingUp, Sparkle, MessageCircle, ArrowUpRight,
  Brain, Vote, Tv, Flame, Bell, Users, X,
  Flag, EyeOff, BellOff, ChevronDown, CircleHelp,
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

// ── Play quick-launch round icons ─────────────────────────────────────
const PLAY_ICONS = [
  { label: "Trivia", icon: Brain, bg: "#f3effe", fg: "#7c3aed" },
  { label: "Cast Vote", icon: Vote, bg: "#eaf1ff", fg: "#2563eb" },
  { label: "Predictions", icon: TrendingUp, bg: "#e7f9f0", fg: "#10b981" },
];

// ── Play cards (static design placeholders) ───────────────────────────
const VOTE_CARD = {
  question: "How would you describe the vibe of Paradise?",
  options: ["Political thriller first", "Murder mystery first", "Sci-fi first", "Equal parts all three"],
};
const TRIVIA_CARD = {
  tag: "PARADISE",
  question: "What is the name of Sterling K. Brown's character in Paradise?",
  options: ["Xavier", "Marcus", "Sterling", "Dele"],
};

// ── Popular titles (gradient poster placeholders for the template) ────
const TITLES = [
  { name: "Paradise", from: "#3a2f5e", to: "#1a1530" },
  { name: "Dateline", from: "#1f2937", to: "#0b1220" },
  { name: "Making a Murderer", from: "#4a2f2f", to: "#1f1414" },
  { name: "On Patrol Live", from: "#1e3a34", to: "#0c1a17" },
];

// ── Optional conversation tags (everything is a discussion; tag is optional) ──
const TAGS = [
  { label: "Take", icon: Flame, bg: "#fff1e8", fg: "#f97316" },
  { label: "Theory", icon: Brain, bg: "#f3effe", fg: "#7c3aed" },
  { label: "Prediction", icon: TrendingUp, bg: "#e7f9f0", fg: "#10b981" },
  { label: "Question", icon: CircleHelp, bg: "#eaf1ff", fg: "#2563eb" },
];
const tagDef = (label: string | null) => TAGS.find((g) => g.label === label);

// ── Trending discussions (horizontal cards) ───────────────────────────
const TRENDING = [
  { title: "Paradise finale theories", replies: 289, bg: "#f3effe" },
  { title: "Did the sheriff know?", replies: 237, bg: "#eaf1ff" },
  { title: "New doc on Netflix", replies: 112, bg: "#fdeeee" },
];

// ── Conversations (all discussions; tag is optional) ──────────────────
const CONVERSATIONS = [
  { author: "Maya R.", tag: "Theory", title: "The sheriff was working with him", body: "Rewatch episode 3 — the way he dodges every question gives it away.", stat: 237, statLabel: "agree", replies: 89 },
  { author: "Devon K.", tag: "Take", title: "This finale was overrated", body: "Great buildup, but the payoff just didn't land for me.", stat: 154, statLabel: "agree", replies: 41 },
  { author: "Priya S.", tag: "Prediction", title: "She's definitely dying next episode", body: "All the foreshadowing this season is pointing right at her.", stat: 128, statLabel: "agree", replies: 72 },
  { author: "Sam T.", tag: "Question", title: "Why did he leave the key behind?", body: "Was it intentional, or just a continuity slip?", stat: 64, statLabel: "agree", replies: 33 },
  { author: "Jordan L.", tag: null, title: "Anyone else rewatching from the start?", body: "Doing a full rewatch before the finale — so many details I missed first time.", stat: 51, statLabel: "agree", replies: 19 },
];

function SectionHeader({ title, action = "See all" }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between px-5 mb-3">
      <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      <button className="text-[13px] font-semibold" style={{ color: ACCENT }}>{action}</button>
    </div>
  );
}

const TABS = ["Discuss", "Play", "Explore"] as const;
type Tab = (typeof TABS)[number];

export default function NewRoom() {
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<Tab>("Discuss");
  const [composerTag, setComposerTag] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<number[]>([]);
  const matchPct = 92;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto pb-28">

        {/* ── Purple gradient hero header (nav + hero = one surface) ── */}
        <div className="relative pb-5" style={{ background: "linear-gradient(165deg, #14101f 0%, #1d1638 55%, #2d1f6e 100%)" }}>
          {/* glow */}
          <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(circle at 85% 10%, rgba(168,85,247,0.45), transparent 55%)" }} />

          <div className="relative">
            <Navigation />

            <div className="px-4 pt-2">
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
        </div>

        {/* ── Tabs ── */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="flex px-4">
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative flex-1 py-3.5 text-[14px] font-semibold transition-colors ${active ? "text-gray-900" : "text-gray-400"}`}
                >
                  {t}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full" style={{ background: ACCENT }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════════ PLAY ════════ */}
        {tab === "Play" && (
        <div className="pt-5 pb-2">
          {/* round quick-launch icons */}
          <div className="grid grid-cols-3 gap-2 px-6 mb-5">
            {PLAY_ICONS.map((p, i) => {
              const Icon = p.icon;
              return (
                <button key={i} className="flex flex-col items-center gap-1.5 py-1 active:scale-95 transition-transform">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: p.bg }}>
                    <Icon size={22} style={{ color: p.fg }} />
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700">{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cast Your Vote card */}
          <div className="px-4">
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#eaf1ff" }}>
                    <Tv size={18} style={{ color: "#2563eb" }} />
                  </div>
                  <span className="text-[16px] font-bold text-gray-900">Cast Your Vote</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-gray-400">1/3</span>
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                    <ChevronRight size={16} className="text-gray-500" />
                  </div>
                </div>
              </div>
              <p className="text-[19px] font-extrabold text-gray-900 leading-snug mb-4">{VOTE_CARD.question}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {VOTE_CARD.options.map((o, i) => (
                  <button key={i} className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-4 text-[14px] font-medium text-gray-700 text-center active:scale-[0.98] transition-transform">
                    {o}
                  </button>
                ))}
              </div>
              <p className="text-right text-[13px] font-bold text-emerald-500 mt-3">+10 pts</p>
            </div>
          </div>

          {/* Paradise Trivia card */}
          <div className="px-4 mt-4">
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#f3effe" }}>
                    <Brain size={18} style={{ color: "#7c3aed" }} />
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-gray-900 leading-tight">Paradise Trivia</p>
                    <p className="text-[12px] text-gray-400">2 questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                    <ChevronRight size={16} className="text-gray-500" />
                  </div>
                  <span className="text-[13px] text-gray-400">1/2</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tv size={13} style={{ color: "#7c3aed" }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#7c3aed" }}>{TRIVIA_CARD.tag}</span>
              </div>
              <p className="text-[19px] font-extrabold text-gray-900 leading-snug mb-4">{TRIVIA_CARD.question}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {TRIVIA_CARD.options.map((o, i) => (
                  <button key={i} className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-4 text-[14px] font-medium text-gray-700 text-center active:scale-[0.98] transition-transform">
                    {o}
                  </button>
                ))}
              </div>
              <p className="text-right text-[13px] font-bold text-emerald-500 mt-3">+30 pts</p>
            </div>
          </div>
        </div>
        )}

        {/* ════════ EXPLORE ════════ */}
        {tab === "Explore" && (<>

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
        </>)}

        {/* ════════ DISCUSS · composer + takes ════════ */}
        {tab === "Discuss" && (
        <div className="pt-7">
          {/* ── Trending this week ── */}
          <SectionHeader title="Trending this week" action="See all" />
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 -mt-1 mb-6 scrollbar-hide">
            {TRENDING.map((t, i) => (
              <div key={i} className="flex-shrink-0 w-[150px] rounded-2xl p-3.5 flex flex-col justify-between" style={{ background: t.bg, minHeight: 96 }}>
                <p className="text-[14px] font-bold text-gray-900 leading-snug">{t.title}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[12px] text-gray-500">{t.replies} replies</span>
                  <Flame size={15} className="text-orange-500" />
                </div>
              </div>
            ))}
          </div>

          {/* ── Start a Conversation button ── */}
          <div className="px-4">
            <button
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-full border-2 py-3.5 text-[16px] font-bold active:scale-[0.99] transition-transform"
              style={{ borderColor: "rgba(124,58,237,0.4)", color: ACCENT }}
            >
              <Plus size={20} /> Start a Conversation
            </button>
          </div>

          {/* ── Composer (opens from the button) ── */}
          {composerOpen && (
          <div className="px-4 mt-3">
            <div className="relative rounded-3xl border border-gray-100 shadow-sm bg-white overflow-hidden">
              {/* close button */}
              <button
                onClick={() => setComposerOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 active:bg-gray-100 transition-colors z-10"
                aria-label="Close composer"
              >
                <X size={20} />
              </button>

              {/* title + body */}
              <div className="px-5 pt-5 pb-4 pr-12">
                <input
                  autoFocus
                  placeholder="Add a title…"
                  className="w-full border-0 outline-none bg-transparent text-[17px] font-bold text-gray-900 placeholder:text-gray-300 mb-2"
                />
                <textarea
                  rows={3}
                  placeholder="Start a discussion…"
                  className="w-full resize-none border-0 outline-none bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div className="border-t border-gray-100" />

              {/* optional tag picker — pills */}
              <div className="px-5 py-4">
                <p className="text-[12px] font-semibold text-gray-400 mb-2.5">Add a tag (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((s, i) => {
                    const Icon = s.icon;
                    const active = composerTag === s.label;
                    return (
                      <button
                        key={i}
                        onClick={() => setComposerTag(active ? null : s.label)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold border transition-all active:scale-95"
                        style={active
                          ? { background: s.bg, color: s.fg, borderColor: s.fg }
                          : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }}
                      >
                        <Icon size={14} style={active ? { color: s.fg } : undefined} /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* full-width Post button */}
              <div className="px-4 pb-4">
                <button className="w-full rounded-full py-3 text-[15px] font-semibold bg-purple-50 text-purple-600 active:bg-purple-100 transition-colors">Post</button>
              </div>
            </div>
          </div>
          )}

          {/* ── All conversations ── */}
          <div className="flex items-center justify-between px-5 mt-7 mb-3">
            <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">All conversations</p>
            <button className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 active:bg-gray-50 transition-colors">
              <Flame size={14} className="text-orange-500" /> Hot <ChevronDown size={15} className="text-gray-400" />
            </button>
          </div>

          <div className="px-4 space-y-3">
            {CONVERSATIONS.map((t, i) => {
              const g = tagDef(t.tag);
              const TagIcon = g?.icon;
              return (
              <div key={i} className="rounded-2xl border border-gray-100 p-4">
                {flagged.includes(i) ? (
                  <div className="flex items-center gap-2 py-2 text-[13px] text-gray-500">
                    <Flag size={15} className="text-gray-400" />
                    <span>Thanks — this conversation has been reported for review.</span>
                  </div>
                ) : (
                <>
                {g && TagIcon && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold mb-2" style={{ background: g.bg, color: g.fg }}>
                    <TagIcon size={12} /> {g.label}
                  </span>
                )}
                <p className="text-[16px] font-bold text-gray-900 leading-snug">{t.title}</p>
                <p className="text-[14px] text-gray-500 leading-snug mt-1">{t.body}</p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-[13px] text-gray-500">
                    <span className="flex items-center gap-1"><Users size={14} /> {t.stat} {t.statLabel}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={14} /> {t.replies} replies</span>
                  </div>
                  <div className="relative flex items-center gap-3 text-gray-400">
                    <button className="active:text-gray-700"><Bell size={16} /></button>
                    <button onClick={() => setMenuFor(menuFor === i ? null : i)} aria-label="More options">
                      <MoreHorizontal size={18} />
                    </button>
                    {menuFor === i && (
                      <>
                        {/* tap-away backdrop */}
                        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                        <div className="absolute right-0 top-7 z-20 w-52 rounded-2xl border border-gray-100 bg-white shadow-lg overflow-hidden py-1">
                          <button
                            onClick={() => { setFlagged((f) => [...f, i]); setMenuFor(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-red-600 active:bg-gray-50"
                          >
                            <Flag size={16} /> Flag as inappropriate
                          </button>
                          <button
                            onClick={() => setMenuFor(null)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-700 active:bg-gray-50"
                          >
                            <EyeOff size={16} className="text-gray-400" /> Not interested
                          </button>
                          <button
                            onClick={() => setMenuFor(null)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-700 active:bg-gray-50"
                          >
                            <BellOff size={16} className="text-gray-400" /> Mute {t.author}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                </>
                )}
              </div>
              );
            })}
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
