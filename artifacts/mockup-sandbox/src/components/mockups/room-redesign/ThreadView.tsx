import React from "react";
import { ArrowLeft, MoreHorizontal, ArrowUp, ArrowDown, MessageSquare, Send } from "lucide-react";

export function ThreadView() {
  return (
    <div className="min-h-screen bg-neutral-100 flex justify-center w-full font-sans">
      <div className="w-full max-w-[430px] bg-gray-50 relative min-h-[100dvh] pb-20 shadow-xl overflow-hidden flex flex-col">
        {/* Top Bar */}
        <div className="bg-gradient-to-r from-purple-700 to-violet-600 text-white flex items-center justify-between px-4 py-3 sticky top-0 z-10 shadow-sm">
          <button className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-[15px] tracking-tight">The Upside Down Room</h1>
          <button className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Original Post */}
          <div className="bg-white p-4 pb-3 border-b border-gray-200">
            <div className="flex gap-3 mb-3">
              <img src="https://picsum.photos/seed/st1/40/40" alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-100" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[15px] text-gray-900 tracking-tight">EddieShreds86</span>
                  <span className="text-gray-400 text-[13px]">· 4h</span>
                </div>
                <div className="mt-0.5">
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-bold tracking-wide uppercase rounded-full">Theory</span>
                </div>
              </div>
            </div>
            
            <p className="text-gray-800 text-[15px] leading-relaxed mb-4">
              Hear me out: Vecna didn't create the Upside Down, he just reshaped it to look like Hawkins. When Eleven first pushed him through, it was just a chaotic yellow sky and floating rocks. He needed a familiar structure to anchor his mind.
            </p>
            
            <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex max-w-[280px]">
              <img src="https://picsum.photos/seed/stpost/80/120" alt="Poster" className="w-16 object-cover" />
              <div className="p-3 flex flex-col justify-center">
                <p className="text-[13px] font-bold text-gray-900 leading-tight">Stranger Things 4</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Season 4, Episode 7</p>
              </div>
            </div>

            <div className="flex items-center gap-5 text-gray-400">
              <div className="flex items-center gap-3 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100">
                <button className="hover:text-purple-600 transition-colors flex items-center gap-1">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-[13px] font-medium text-gray-700">142</span>
                </button>
                <div className="w-[1px] h-3 bg-gray-200"></div>
                <button className="hover:text-purple-600 transition-colors flex items-center gap-1">
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              <button className="flex items-center gap-1.5 hover:text-purple-600 transition-colors">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[13px] font-medium">38</span>
              </button>
            </div>
          </div>

          {/* Thread / Replies */}
          <div className="bg-gray-50 pt-2 pb-6">
            
            {/* Thread Container */}
            <div className="px-4">
              
              {/* Reply 1 */}
              <div className="relative pt-3 pb-3">
                <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-gray-200"></div>
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st2/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">HawkinsAVClub</span>
                      <span className="text-gray-400 text-[12px]">· 3h</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Exactly! The Demogorgons were already there, just acting like wild animals. He organized them into a hive mind.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-600">24</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nested Reply */}
              <div className="relative pl-11 pb-3">
                {/* Connector curve */}
                <div className="absolute left-4 top-0 w-6 h-6 border-l-2 border-b-2 border-gray-200 rounded-bl-xl"></div>
                <div className="flex gap-3 relative z-10 pt-2">
                  <img src="https://picsum.photos/seed/st3/28/28" alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-gray-100 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">ScoopsAhoy99</span>
                      <span className="text-gray-400 text-[12px]">· 2h</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Wait, does that mean the Mind Flayer isn't the ultimate boss? I thought the shadow particles were the real threat.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-600">12</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reply 2 */}
              <div className="relative pt-3 pb-3 border-t border-gray-200/60 mt-2">
                <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-gray-200"></div>
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st4/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">HellfireClub_Mike</span>
                      <span className="text-gray-400 text-[12px]">· 1h</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      If he shaped it, why did he shape it exactly like the day Will went missing? It was frozen on November 6, 1983. Why that specific date if Vecna was banished way earlier?
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-600">89</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Nested Reply */}
              <div className="relative pl-11 pb-3">
                <div className="absolute left-4 top-0 w-6 h-6 border-l-2 border-b-2 border-gray-200 rounded-bl-xl"></div>
                <div className="flex gap-3 relative z-10 pt-2">
                  <img src="https://picsum.photos/seed/st5/28/28" alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-gray-100 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">Eleven011</span>
                      <span className="text-gray-400 text-[12px]">· 45m</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      Because that's when Eleven accidentally opened the gate! The connection bridged the worlds and took a "snapshot" of Hawkins.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-gray-400">
                      <div className="flex items-center gap-2">
                        <button className="hover:text-purple-600"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-medium text-gray-600">45</span>
                        <button className="hover:text-purple-600"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <button className="text-[12px] font-medium hover:text-purple-600">Reply</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reply 3 */}
              <div className="relative pt-3 pb-3 border-t border-gray-200/60 mt-2">
                <div className="flex gap-3">
                  <img src="https://picsum.photos/seed/st6/32/32" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 relative z-10 bg-white" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-gray-900">StarcourtMallRat</span>
                      <span className="text-gray-400 text-[12px]">· 15m</span>
                    </div>
                    <p className="text-gray-800 text-[14px] leading-relaxed mt-0.5">
                      This makes so much sense. I need Season 5 right now 😭
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

        {/* Pinned Reply Box */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex gap-2 items-end pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <img src="https://picsum.photos/seed/myavatar/32/32" alt="My Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-100 mb-1" />
          <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2 min-h-[44px] border border-gray-200 focus-within:border-purple-400 focus-within:bg-white transition-colors">
            <input 
              type="text" 
              placeholder="Add to the conversation..." 
              className="bg-transparent border-none outline-none w-full text-[14px] text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <button className="w-[44px] h-[44px] bg-purple-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-600/20 hover:bg-purple-700 transition-colors">
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
