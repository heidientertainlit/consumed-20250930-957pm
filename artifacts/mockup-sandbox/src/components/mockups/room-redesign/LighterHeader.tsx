import React, { useState } from "react";
import { ArrowLeft, Search, MoreHorizontal, Users, Plus, ArrowUp, ArrowDown, MessageCircle, ChevronDown } from "lucide-react";

export function LighterHeader() {
  const [isFollowing, setIsFollowing] = useState(false);

  return (
    <div className="max-w-[430px] mx-auto bg-gray-50 min-h-[100dvh] font-sans text-gray-900 shadow-xl overflow-hidden flex flex-col">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-violet-700 to-purple-900 text-white pb-4 pt-12 px-4 rounded-b-2xl relative">
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
          
          <div className="flex items-end justify-between group cursor-pointer">
            <p className="text-sm text-purple-100 leading-snug line-clamp-1 flex-1 pr-4">
              The ultimate hub for all things Stranger Things. Theories, takes, episode discussions, and waiting for Season 5...
            </p>
            <ChevronDown className="w-4 h-4 text-purple-200 shrink-0" />
          </div>
        </div>
      </div>

      {/* Featured Media Row */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Room Media</h3>
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

      {/* Tab Bar */}
      <div className="flex items-center px-2 bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        {["Discuss", "Explore", "Members"].map((tab, idx) => (
          <button 
            key={tab}
            className={`flex-1 py-3 text-sm font-medium relative ${
              idx === 0 ? "text-purple-700" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab}
            {idx === 0 && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-purple-600 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-12">
        {/* Composer Bar */}
        <div className="p-4 bg-white">
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 shadow-sm cursor-text hover:bg-gray-100 transition-colors">
            <img 
              src="https://picsum.photos/seed/myuser/64/64"
              className="w-6 h-6 rounded-full object-cover"
              alt="You"
            />
            <span className="text-gray-400 text-sm flex-1 font-medium">Start a conversation...</span>
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-purple-700" />
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="flex flex-col">
          {/* Post 1 */}
          <div className="bg-white p-4 border-b border-gray-100">
            <div className="flex items-start gap-3 mb-2">
              <img 
                src="https://picsum.photos/seed/user88/64/64"
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                alt="HawkinsInsider"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-gray-900 truncate">HawkinsInsider</span>
                  <span className="text-gray-400 text-xs">· 2h</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wide">
                    Theory
                  </span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
            
            <h2 className="text-[15px] font-medium text-gray-900 mb-1 leading-snug">
              Max isn't actually in a coma, she's trapped in Vecna's mind lair and will be the key to destroying him from the inside.
            </h2>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              Think about it. When Eleven was looking for her in the void, she couldn't find her. Because Vecna consumed her consciousness just like the others.
            </p>
            
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1">
                <button className="p-1 -ml-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-gray-600">142</span>
                <button className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              <button className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 group">
                <div className="p-1 -ml-1 group-hover:bg-gray-100 rounded">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">24 Replies</span>
              </button>
            </div>
          </div>

          {/* Post 2 */}
          <div className="bg-white p-4 border-b border-gray-100">
            <div className="flex items-start gap-3 mb-2">
              <img 
                src="https://picsum.photos/seed/user42/64/64"
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                alt="SteveFan99"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-gray-900 truncate">SteveFan99</span>
                  <span className="text-gray-400 text-xs">· 5h</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wide">
                    Take
                  </span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
            
            <h2 className="text-[15px] font-medium text-gray-900 mb-1 leading-snug">
              Season 1 is still the best season purely because of the mystery aspect. We knew nothing.
            </h2>
            
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1">
                <button className="p-1 -ml-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded text-purple-600">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-gray-600 text-purple-700">89</span>
                <button className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              <button className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 group">
                <div className="p-1 -ml-1 group-hover:bg-gray-100 rounded">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">12 Replies</span>
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
