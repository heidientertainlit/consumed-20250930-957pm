import { Bookmark, MessageSquarePlus, TrendingUp } from "lucide-react";

function WhatRow({ name, action, meta }: { name: string; action: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-gray-900 leading-snug">
          <span className="font-semibold">{name}</span> {action}
        </p>
        <p className="text-[11px] text-gray-400 leading-snug">{meta}</p>
      </div>
    </div>
  );
}

export function PromptRow() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center py-6">
      <div className="w-[390px] bg-white rounded-[28px] shadow-sm overflow-hidden">
        <div className="px-4 pt-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-3">What's Happening</h2>
          <div className="space-y-3">
            <WhatRow name="Maya" action="rated Dune: Part Two" meta="★★★★★ · 2h" />
            <WhatRow name="Jordan" action="added The Bear to Watching" meta="4h" />
          </div>
        </div>

        <div className="px-4 mb-5 mt-4">
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-stretch bg-gray-50 rounded-2xl overflow-hidden divide-x divide-gray-200">
              <button className="flex-1 flex items-center gap-2 px-3.5 py-3 text-left">
                <Bookmark size={16} className="text-purple-600 flex-shrink-0" fill="#7c3aed" />
                <div className="min-w-0">
                  <p className="font-semibold text-[12.5px] text-gray-900 leading-tight">Save it</p>
                  <p className="text-[10.5px] text-gray-500 leading-snug">Track media</p>
                </div>
              </button>
              <button className="flex-1 flex items-center gap-2 px-3.5 py-3 text-left">
                <MessageSquarePlus size={16} className="text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-[12.5px] text-gray-900 leading-tight">Share a take</p>
                  <p className="text-[10.5px] text-gray-500 leading-snug">Post a review</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-900" />
            <h2 className="text-[15px] font-bold text-gray-900">Trending Now</h2>
          </div>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1">
                <div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-gray-200 to-gray-300" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
