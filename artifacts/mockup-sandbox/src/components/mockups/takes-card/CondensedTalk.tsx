import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Flame, MessageCircle, ChevronRight, TrendingUp, ArrowUp } from "lucide-react";

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

        {/* ── Then: See what everyone thinks ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2">
              <Avatar className="w-6 h-6 border-2 border-white"><AvatarImage src="https://i.pravatar.cc/100?img=1" /></Avatar>
              <Avatar className="w-6 h-6 border-2 border-white"><AvatarImage src="https://i.pravatar.cc/100?img=2" /></Avatar>
              <Avatar className="w-6 h-6 border-2 border-white"><AvatarImage src="https://i.pravatar.cc/100?img=3" /></Avatar>
            </div>
            <span className="text-gray-900 font-semibold text-sm">See what everyone thinks</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>

      </div>
    </div>
  );
}
