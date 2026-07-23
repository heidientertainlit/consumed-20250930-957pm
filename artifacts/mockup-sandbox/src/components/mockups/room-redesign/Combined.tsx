import React, { useState } from "react";
import { ArrowLeft, Search, MoreHorizontal, Plus, ArrowUp, ArrowDown, ChevronDown, Flame } from "lucide-react";

export function Combined() {
  const [isFollowing, setIsFollowing] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center font-sans">
      <div className="w-full max-w-[430px] bg-white min-h-[100dvh] shadow-xl overflow-hidden flex flex-col relative">
        
        {/* 1. LighterHeader Hero Section */}
        <div className="bg-gradient-to-br from-violet-700 to-purple-900 text-white pb-0 pt-12 px-4 rounded-b-2xl relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none mix-blend-overlay">
            <div className="absolute -top-24 -right-12 w-64 h-64 bg-fuchsia-500 rounded-full blur-3xl"></div>
            <div className="absolute top-12 -left-12 w-48 h-48 bg-indigo-500 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 flex items-center justify-between mb-4">
            <button className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex gap-2">
              <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <Search className="w-5 h-5 text-white" />
              </button>
              <button className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors">
                <MoreHorizontal className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="relative z-10">
            <h1 className="text-2xl font-bold tracking-tight mb-2">The Upside Down Room</h1>
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <img 
                      key={i}
                      src={`https://picsum.photos/seed/avatar${i}/64/64`}
                      alt="Member"
                      className="w-7 h-7 rounded-full border-2 border-purple-800 object-cover"
                    />
                  ))}
                </div>
                <span className="text-sm text-purple-100 font-medium">12.4k members</span>
              </div>
              
              <div className="flex gap-2">
                <button className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm font-medium border border-white/30 backdrop-blur-sm transition-colors">
                  Invite
                </button>
                <button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    isFollowing 
                      ? "bg-white/20 text-white border border-white/30" 
                      : "bg-white text-purple-900 shadow-sm"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            </div>
            
            <div className="flex items-end justify-between group cursor-pointer mb-5">
              <p className="text-sm text-purple-100 leading-snug line-clamp-1 flex-1 pr-4">
                The ultimate hub for all things Stranger Things. Theories, takes, episode discussions...
              </p>
              <ChevronDown className="w-4 h-4 text-purple-200 shrink-0" />
            </div>

            {/* Tab Bar within Hero like DiscussFeed slightly adapted */}
            <div className="flex gap-6 border-b border-white/15 px-1">
              <button className="pb-3 text-white font-medium border-b-2 border-white text-sm">Discuss</button>
              <button className="pb-3 text-purple-300 font-medium hover:text-white transition-colors text-sm">Explore</button>
              <button className="pb-3 text-purple-300 font-medium hover:text-white transition-colors text-sm">Members</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white pb-20">
          
          {/* 2. Room Media Row */}
          <div className="px-4 py-4 bg-white border-b border-gray-100">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Room Media</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {[
                { id: 101, title: "Season 1" },
                { id: 102, title: "Season 2" },
                { id: 103, title: "Season 3" },
                { id: 104, title: "Season 4" },
                { id: 105, title: "The First Shadow" },
              ].map((item) => (
                <div key={item.id} className="flex flex-col gap-1 w-[48px] shrink-0">
                  <img 
                    src={`https://picsum.photos/seed/poster${item.id}/96/144`}
                    alt={item.title}
                    className="w-12 h-[72px] rounded object-cover shadow-sm border border-gray-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Start Conversation Bar */}
          <div className="p-3 bg-white border-b border-gray-100">
            <button className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors text-gray-500 rounded-full py-2 px-3 flex items-center gap-3 text-sm font-medium">
              <div className="bg-purple-100 rounded-full p-1.5 text-purple-700">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              Start a conversation...
            </button>
          </div>

          {/* Feed Container */}
          <div className="p-4 flex flex-col gap-5">
            
            {/* 4. Hot Conversation Card */}
            <div className="bg-purple-50/60 border border-purple-200/60 rounded-[16px] p-4 cursor-pointer hover:bg-purple-50 transition-colors shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wide uppercase rounded-full">Theory</span>
                <span className="text-[11px] font-bold tracking-wider text-purple-600 uppercase flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  Hot Conversation
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-gray-900 mb-2.5 leading-snug">Will Max have powers in Season 5? The clock chimes in the trailer might mean...</h3>
              <div className="bg-white/70 rounded-xl p-3 mb-3 text-[13px] leading-relaxed text-gray-600 border border-purple-100/50 line-clamp-2">
                <span className="font-semibold text-gray-900">@hawkinssleuth:</span> I don't think it's traditional powers, but rather a connection to Vecna's mindscape. If she was brain-dead, where did her consciousness go?
              </div>
              
              <div className="flex items-center justify-between mt-3 pt-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-1.5">
                    <img src="https://picsum.photos/seed/a1/32/32" className="w-[22px] h-[22px] rounded-full border border-purple-100" alt="avatar" />
                    <img src="https://picsum.photos/seed/a2/32/32" className="w-[22px] h-[22px] rounded-full border border-purple-100" alt="avatar" />
                    <img src="https://picsum.photos/seed/a3/32/32" className="w-[22px] h-[22px] rounded-full border border-purple-100" alt="avatar" />
                  </div>
                  <span className="text-[11px] font-medium text-purple-700/80">94 people discussing</span>
                </div>
                <span className="text-[11px] font-semibold text-purple-700 bg-purple-100/80 px-3 py-1.5 rounded-full">Tap to join</span>
              </div>
            </div>

            {/* 5. Minimal Threaded Conversations */}
            <div className="flex flex-col">
              
              {/* Thread 1 (Top Level) */}
              <div className="relative pt-3 pb-3">
                <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-gray-100"></div>
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st2/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">HawkinsAVClub</span>
                      <span className="text-gray-400 text-[12px]">· 3h</span>
                      <span className="ml-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold tracking-wide uppercase rounded-sm">Take</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      The Season 3 mall setting was peak Stranger Things and we'll never get that vibe back. The neon aesthetics were perfect.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-500">142</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nested Reply */}
              <div className="relative pl-11 pb-4">
                <div className="absolute left-4 top-0 w-6 h-6 border-l-2 border-b-2 border-gray-100 rounded-bl-xl"></div>
                <div className="flex gap-3 relative z-10 pt-2">
                  <img src="https://picsum.photos/seed/st3/28/28" alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-gray-100 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">ScoopsAhoy99</span>
                      <span className="text-gray-400 text-[12px]">· 2h</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Hard agree. The balance between the fun summer vibes and the meat flayer was incredible.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-500">45</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-100 my-1"></div>

              {/* Thread 2 */}
              <div className="relative pt-4 pb-4">
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st4/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">HellfireClub_Mike</span>
                      <span className="text-gray-400 text-[12px]">· 4h</span>
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold tracking-wide uppercase rounded-sm">Question</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Who is actually running the Russian base under Starcourt? Did we ever get a real answer on the hierarchy there?
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-500">38</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-100 my-1"></div>

              {/* Thread 3 */}
              <div className="relative pt-4 pb-4">
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st5/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">Eleven011</span>
                      <span className="text-gray-400 text-[12px]">· 5h</span>
                      <span className="ml-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold tracking-wide uppercase rounded-sm">Theory</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Eddie is definitely coming back as Vecna's lieutenant. The Kas theory lines up way too perfectly with the D&D lore established in episode 1.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-500">812</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-100 my-1"></div>

              {/* Thread 4 */}
              <div className="relative pt-4 pb-4">
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st6/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">StarcourtMallRat</span>
                      <span className="text-gray-400 text-[12px]">· 6h</span>
                      <span className="ml-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold tracking-wide uppercase rounded-sm">Rate</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Rate the season finales from best to worst. 3 &gt; 4 &gt; 1 &gt; 2 for me.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
