import React from 'react';
import { Plus, ArrowUp, ArrowDown, MessageSquare, ChevronLeft, MoreHorizontal, Share, Flame } from 'lucide-react';

function getTagColorClass(color: 'purple' | 'blue' | 'amber' | 'green') {
  switch (color) {
    case 'purple': return 'bg-purple-100 text-purple-700';
    case 'blue': return 'bg-blue-100 text-blue-700';
    case 'amber': return 'bg-amber-100 text-amber-700';
    case 'green': return 'bg-emerald-100 text-emerald-700';
  }
}

function ConversationRow({ 
  tag, 
  tagColor, 
  title, 
  upvotes, 
  replies, 
  time, 
  hasPoster 
}: { 
  tag: string;
  tagColor: 'purple' | 'blue' | 'amber' | 'green';
  title: string;
  upvotes: number;
  replies: number;
  time: string;
  hasPoster?: boolean;
}) {
  return (
    <div className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-full ${getTagColorClass(tagColor)}`}>
              {tag}
            </span>
          </div>
          <h3 className="text-[15px] text-gray-900 leading-snug mb-3 pr-2">{title}</h3>
          
          <div className="flex items-center text-xs font-medium text-gray-400">
            <div className="flex items-center gap-1.5 hover:text-gray-600 py-1 pr-3">
              <ArrowUp className="w-[14px] h-[14px]" />
              {upvotes > 0 && <span>{upvotes}</span>}
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-600 py-1 pr-4">
              <ArrowDown className="w-[14px] h-[14px]" />
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-600 py-1">
              <MessageSquare className="w-[14px] h-[14px]" />
              <span>{replies} Replies</span>
            </div>
            <span className="ml-auto">{time}</span>
          </div>
        </div>
        
        {hasPoster && (
          <div className="shrink-0 pt-1">
            <img 
              src="https://picsum.photos/seed/st3/48/72" 
              alt="Poster" 
              className="w-10 h-14 object-cover rounded shadow-sm border border-gray-200" 
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function DiscussFeed() {
  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center font-sans">
      <div className="w-full max-w-[430px] bg-white min-h-[100dvh] shadow-xl overflow-hidden flex flex-col relative">
        
        {/* Room Hero / Header */}
        <div className="bg-gradient-to-br from-violet-900 via-purple-800 to-fuchsia-900 text-white px-4 pt-12 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-5">
            <button className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-1">
              <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <Share className="w-5 h-5" />
              </button>
              <button className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="px-1 mb-6">
            <h1 className="text-[26px] font-bold tracking-tight mb-1">The Upside Down Room</h1>
            <p className="text-purple-200/90 text-sm font-medium">34.2k Members · Stranger Things</p>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-6 border-b border-white/15 px-1">
            <button className="pb-3 text-white font-medium border-b-2 border-white text-sm">Discuss</button>
            <button className="pb-3 text-purple-300 font-medium hover:text-white transition-colors text-sm">Takes</button>
            <button className="pb-3 text-purple-300 font-medium hover:text-white transition-colors text-sm">Theories</button>
            <button className="pb-3 text-purple-300 font-medium hover:text-white transition-colors text-sm">Lore</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 pb-20">
          {/* Start conversation bar */}
          <div className="bg-white p-3 border-b border-gray-100 sticky top-0 z-10 shadow-sm shadow-gray-100/50">
            <button className="w-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500 rounded-full py-2 px-3 flex items-center gap-3 text-sm font-medium">
              <div className="bg-purple-600 rounded-full p-1.5 text-white">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              Start a conversation...
            </button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Hot Conversation */}
            <div className="bg-purple-50/60 border border-purple-200/60 rounded-[20px] p-4 cursor-pointer hover:bg-purple-50 transition-colors shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wide uppercase rounded-full">Theory</span>
                <span className="text-[11px] font-bold tracking-wider text-purple-600 uppercase flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  Hot Conversation
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2.5 leading-snug">Will Max have powers in Season 5? The clock chimes in the trailer might mean...</h3>
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

            {/* List of conversations */}
            <div className="bg-white rounded-[20px] border border-gray-100 overflow-hidden shadow-sm">
              
              <ConversationRow 
                tag="Take"
                tagColor="purple"
                title="The Season 3 mall setting was peak Stranger Things and we'll never get that vibe back."
                upvotes={142}
                replies={45}
                time="2h"
                hasPoster
              />

              <ConversationRow 
                tag="Question"
                tagColor="amber"
                title="Who is actually running the Russian base under Starcourt? Did we ever get a real answer?"
                upvotes={38}
                replies={12}
                time="4h"
              />

              <ConversationRow 
                tag="Theory"
                tagColor="blue"
                title="Eddie is definitely coming back as Vecna's lieutenant (Kas theory explained again)"
                upvotes={812}
                replies={156}
                time="5h"
              />

              <ConversationRow 
                tag="Rate"
                tagColor="green"
                title="Rate the season finales from best to worst. 3 > 4 > 1 > 2 for me."
                upvotes={0}
                replies={8}
                time="6h"
              />

              <ConversationRow 
                tag="Take"
                tagColor="purple"
                title="Steve Harrington's character arc is a bit overrated. He just became a babysitter."
                upvotes={12}
                replies={89}
                time="8h"
              />

              <ConversationRow 
                tag="Theory"
                tagColor="blue"
                title="The time jump in S5 will be exactly to 1989, aligning with the real-world aging of the cast."
                upvotes={45}
                replies={11}
                time="10h"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
