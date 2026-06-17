import { Search, Bell, Flame, ChevronRight, Bookmark, PenSquare, TrendingUp, Heart, MessageCircle } from "lucide-react";

function AppBar() {
  return (
    <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100">
      <span className="text-[17px] font-extrabold text-gray-900 tracking-tight">Consumed</span>
      <div className="flex items-center gap-3.5 text-gray-700">
        <Search size={19} />
        <Bell size={19} />
      </div>
    </div>
  );
}

function DailyStrip() {
  return (
    <button className="w-full flex items-center gap-2 bg-purple-50 px-4 py-2.5 text-left">
      <Flame size={15} className="text-purple-600 flex-shrink-0" />
      <span className="text-[12.5px] font-semibold text-purple-900">5-day streak</span>
      <span className="text-purple-300">·</span>
      <span className="text-[12.5px] text-purple-700">Today's Play ready</span>
      <ChevronRight size={15} className="text-purple-400 ml-auto" />
    </button>
  );
}

function WhatRow({ name, action, meta }: { name: string; action: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-gray-900 leading-snug"><span className="font-semibold">{name}</span> {action}</p>
        <p className="text-[11px] text-gray-400 leading-snug">{meta}</p>
      </div>
    </div>
  );
}

function SamplePost() {
  return (
    <div className="px-4 mt-4">
      <div className="border border-gray-100 rounded-2xl p-3.5">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-pink-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 leading-tight">Sofia Reyes</p>
            <p className="text-[11px] text-gray-400">rated a movie · 1h</p>
          </div>
          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Review</span>
        </div>
        <div className="flex gap-3">
          <div className="w-14 aspect-[2/3] rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 leading-tight">Dune: Part Two</p>
            <p className="text-[12px] text-amber-500 mt-0.5">★★★★★</p>
            <p className="text-[12px] text-gray-600 mt-1 leading-snug line-clamp-2">Villeneuve outdid himself — the scale is operatic and the sound design is unreal.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-gray-50 text-gray-400">
          <span className="flex items-center gap-1 text-[12px]"><Heart size={14} /> 24</span>
          <span className="flex items-center gap-1 text-[12px]"><MessageCircle size={14} /> 6</span>
        </div>
      </div>
    </div>
  );
}

export function StripComposer() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center py-6">
      <div className="w-[390px] bg-white rounded-[28px] shadow-sm overflow-hidden">
        <AppBar />
        <DailyStrip />

        {/* HEADER COMPOSER — tap-to-open field + quick chips */}
        <div className="px-4 pt-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex-shrink-0" />
            <div className="flex-1 h-10 rounded-full bg-gray-100 flex items-center px-4 text-[13px] text-gray-400">
              Share a take or save something…
            </div>
          </div>
          <div className="flex gap-2 mt-2.5 pl-11">
            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded-full px-3 py-1.5 text-[12px] font-medium">
              <Bookmark size={13} fill="currentColor" /> Save it
            </span>
            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded-full px-3 py-1.5 text-[12px] font-medium">
              <PenSquare size={13} /> Share a take
            </span>
          </div>
        </div>

        <div className="px-4 mt-4">
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-[15px] font-bold text-gray-900 mb-3">What's Happening</h2>
            <div className="space-y-3">
              <WhatRow name="Maya" action="rated Dune: Part Two" meta="★★★★★ · 2h" />
              <WhatRow name="Jordan" action="added The Bear to Watching" meta="4h" />
            </div>
          </div>
        </div>

        <SamplePost />

        <div className="px-4 pt-5 pb-6">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-900" />
            <h2 className="text-[15px] font-bold text-gray-900">Trending Now</h2>
          </div>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1"><div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-gray-200 to-gray-300" /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
