import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Flame, MessageCircle, ChevronRight, ChevronLeft, ChevronDown, TrendingUp, ArrowUp, ArrowDown, ArrowRight, Sparkles, Plus, Send } from "lucide-react";

const MORE_CONVOS = [
  { title: "Superman", meta: "Movie", talking: 664, hot: '"Corenswet IS Superman. Sorry not sorry."', trend: "+128 today" },
  { title: "The Bear", meta: "TV", talking: 512, hot: '"Season 4 redeemed everything."', trend: "+86 today" },
  { title: "Fourth Wing", meta: "Book", talking: 312, hot: '"The dragons deserve their own book."', trend: "+41 today" },
  { title: "Alien: Earth", meta: "TV", talking: 288, hot: '"Scarier than the movies. Watch with lights on."', trend: "+37 today" },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3 h-3 ${i <= count ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export function CondensedTalk() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 flex items-start justify-center font-sans">
      <div className="w-full max-w-[400px]">

        {/* ── Section header ── */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" fill="#f97316" />
            <h2 className="text-[15px] font-bold text-gray-900">Everyone's Talking</h2>
          </div>
          <button className="text-xs font-medium text-[#7c3aed]">See all</button>
        </div>

        {/* ── Condensed featured card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
          <div className="flex gap-3 p-3">
            <img
              src="/__mockup/images/death-by-lightning-poster.png"
              alt="Death by Lightning"
              className="w-[64px] h-[92px] object-cover rounded-lg shadow-sm shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900 leading-tight">Death by Lightning</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
                    <p className="text-[11px] font-medium text-gray-500">423 talking · 4.2</p>
                    <Stars count={4} />
                  </div>
                </div>
              </div>

              {/* Top take inline */}
              <div className="mt-2 bg-gray-50 rounded-lg px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src="https://i.pravatar.cc/100?img=11" />
                    <AvatarFallback>T</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-semibold text-gray-700">Trey</span>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-0 text-[9px] px-1 py-0 h-4">
                    Top take
                  </Badge>
                </div>
                <p className="text-[12px] font-semibold text-gray-900 leading-snug line-clamp-2">
                  "Hooked after one episode. The pacing is relentless."
                </p>
                <div className="flex items-center gap-3 mt-1 text-gray-500">
                  <span className="flex items-center gap-0.5 text-[10px] font-medium">
                    <ArrowUp className="w-3 h-3" /> 236 agree
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-medium">
                    <MessageCircle className="w-3 h-3" /> 28
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Join strip */}
          <button className="w-full flex items-center justify-between px-3.5 py-2 border-t border-gray-100 bg-gray-50/60">
            <span className="text-[11px] font-semibold text-[#7c3aed]">Add your take</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#7c3aed]" />
          </button>
        </div>

        {/* ── More conversations — compact, text-only ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 mb-3">
          {MORE_CONVOS.map((c) => (
            <button key={c.title} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-gray-900 truncate">{c.title}</span>
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide shrink-0">{c.meta}</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.hot}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-bold text-gray-900">{c.talking}</p>
                <p className="text-[9px] font-medium text-green-600 flex items-center gap-0.5 justify-end">
                  <TrendingUp className="w-2.5 h-2.5" /> {c.trend}
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>

        {/* ── Then: the app's real "See what everyone thinks" card ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-visible">
          {/* Header: label + ‹ N of M › nav */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center flex-wrap gap-2 gap-y-1">
              <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
              <span className="text-gray-900 font-semibold text-sm">See what everyone thinks</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="disabled:opacity-30" disabled>
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <span className="text-purple-500 text-xs font-medium">1 of 6</span>
              <button>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content row — poster left, take right */}
          <div className="flex px-4 pt-2 pb-1 gap-3 select-none">
            {/* Poster anchor */}
            <div
              className="relative w-[120px] shrink-0 rounded-xl overflow-hidden bg-gray-900 self-start"
              style={{ height: 180, boxShadow: "0 6px 20px rgba(0,0,0,0.22)" }}
            >
              <img
                src="/__mockup/images/death-by-lightning-poster.png"
                alt="Death by Lightning"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <button className="absolute bottom-2 right-2 z-10 w-7 h-7 rounded-full bg-purple-500/40 backdrop-blur-sm border border-purple-300/40 flex items-center justify-center">
                <Plus size={14} className="text-white" strokeWidth={2.5} />
              </button>
            </div>

            {/* Take (right) */}
            <div className="flex-1 min-w-0 flex flex-col" style={{ minHeight: 180 }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                  style={{ background: "hsl(212, 50%, 48%)" }}
                >
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-gray-800 leading-tight truncate">Ashley</p>
                  <p className="text-[12px] text-violet-600 font-medium leading-tight"><span className="font-semibold">71%</span> aligned with you</p>
                </div>
              </div>

              <div className="mt-2 min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 leading-snug">Death by Lightning</p>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="text-[9px] font-bold px-1.5 py-px rounded-full shrink-0 bg-blue-100 text-blue-700">TV</span>
                </div>
              </div>

              <div className="flex items-center gap-0.5 mt-1.5">
                {[1, 2, 3, 4].map((s) => <Star key={s} size={16} className="text-yellow-400 fill-yellow-400" />)}
                <Star size={16} className="text-gray-300" />
              </div>

              <p className="text-[15px] font-normal text-gray-700 leading-snug mt-1.5">"Lincoln isn't the real villain. Watch the background characters."</p>
            </div>
          </div>

          {/* Other ratings: slim avatar-stack line */}
          <div className="px-4 mt-3">
            <button className="w-full flex items-center gap-2 py-1.5">
              <div className="flex -space-x-1.5 flex-shrink-0">
                {["K", "M", "J"].map((l, i) => (
                  <div
                    key={l}
                    className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                    style={{ background: `hsl(${(l.charCodeAt(0) * 47) % 360}, 50%, 48%)` }}
                  >
                    {l}
                  </div>
                ))}
                <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-500 text-[8px] font-bold flex-shrink-0">+2</div>
              </div>
              <span className="text-[11px] font-medium text-gray-500 flex-1 text-left">
                5 more ratings<span className="text-gray-400"> · </span>
                <Star size={10} className="inline text-yellow-400 fill-yellow-400 -mt-px" /> 4.1 avg
              </span>
              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            </button>
          </div>

          {/* divider */}
          <div className="border-t border-gray-100 mx-4 mb-3 mt-1.5" />

          {/* Action row */}
          <div className="flex items-center justify-start gap-6 px-4 pb-4">
            <button className="flex items-center gap-1.5">
              <ArrowUp size={15} className="text-gray-400" strokeWidth={2} />
              <span className="text-[12px] text-gray-500 font-medium">Agree</span>
            </button>
            <button className="flex items-center gap-1.5">
              <ArrowDown size={15} className="text-gray-400" strokeWidth={2} />
              <span className="text-[12px] text-gray-500 font-medium">Disagree</span>
            </button>
            <button className="flex items-center gap-1.5">
              <Star size={15} className="text-gray-400" strokeWidth={2} />
              <span className="text-[12px] text-gray-500 font-medium">Rate</span>
            </button>
            <button className="flex items-center gap-1.5">
              <span className="text-[12px] font-medium text-gray-500">Tell a friend</span>
              <ArrowRight size={13} className="text-gray-400" />
            </button>
          </div>

          {/* Take bar */}
          <div className="flex items-center gap-2 px-4 pb-4 pt-0">
            <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <span className="text-violet-600 text-[9px] font-bold">H</span>
            </div>
            <div className="flex-1 flex items-center bg-gray-50 rounded-full px-3 py-1.5 gap-2 border border-gray-100">
              <span className="flex-1 text-[13px] text-gray-400">Add your take or @tag a friend...</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
