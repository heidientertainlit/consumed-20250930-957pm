import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share, Send, MoreHorizontal, ArrowRight, ThumbsUp, ThumbsDown, UserPlus, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PosterAnchor() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
        
        {/* Header Section */}
        <div className="p-4 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Death by Lightning</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              <p className="text-xs font-medium text-gray-500">423 people talking</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 rounded-full">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Content Section: Poster Left, Takes Right */}
        <div className="flex px-4 pb-4 gap-3 relative overflow-hidden">
          
          {/* Poster Anchor */}
          <div className="w-[120px] shrink-0 relative rounded-xl overflow-hidden shadow-sm">
            <img 
              src="/__mockup/images/death-by-lightning-poster.png" 
              alt="Death by Lightning Poster"
              className="w-full h-[220px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-80" />
            <div className="absolute bottom-2 left-2 right-2">
              <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-0 text-[10px] px-1.5 py-0">TV Series</Badge>
            </div>
          </div>

          {/* Swipeable Takes (Right Side) */}
          <div className="flex-1 overflow-x-auto snap-x snap-mandatory hide-scrollbar flex gap-3 pb-2 -mx-2 px-2">
            
            {/* Take Card 1 */}
            <div className="w-[220px] shrink-0 snap-center flex flex-col justify-between bg-gray-50/80 rounded-xl p-3 border border-gray-100">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border border-white">
                      <AvatarImage src="https://i.pravatar.cc/100?img=11" />
                      <AvatarFallback>TR</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-900 leading-none">Trey</p>
                      <p className="text-[10px] text-[#7c3aed] font-medium mt-0.5">83% Match</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[9px] bg-orange-100 text-orange-700 hover:bg-orange-100 border-0 px-1 py-0 h-4 flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5" /> Take
                  </Badge>
                </div>
                
                <h3 className="text-[15px] font-bold text-gray-900 leading-tight mb-2 tracking-tight">
                  "Hooked after one episode. The pacing is relentless."
                </h3>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-200/60">
                <div className="flex items-center gap-3 text-gray-500">
                  <button className="flex items-center gap-1 hover:text-[#7c3aed] transition-colors">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">236</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                  <button className="flex items-center gap-1 hover:text-[#7c3aed] transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">28</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Take Card 2 */}
            <div className="w-[220px] shrink-0 snap-center flex flex-col justify-between bg-gray-50/80 rounded-xl p-3 border border-gray-100 opacity-90">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border border-white">
                      <AvatarImage src="https://i.pravatar.cc/100?img=5" />
                      <AvatarFallback>AS</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-900 leading-none">Ashley</p>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5">71% Match</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[9px] bg-purple-100 text-purple-700 hover:bg-purple-100 border-0 px-1 py-0 h-4">
                    Theory
                  </Badge>
                </div>
                
                <h3 className="text-[15px] font-bold text-gray-900 leading-tight mb-2 tracking-tight">
                  "Lincoln isn't the real villain. Watch the background characters."
                </h3>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-200/60">
                <div className="flex items-center gap-3 text-gray-500">
                  <button className="flex items-center gap-1 hover:text-[#7c3aed] transition-colors">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">142</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                  <button className="flex items-center gap-1 hover:text-[#7c3aed] transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">12</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Take Card 3 (Peek) */}
            <div className="w-[200px] shrink-0 snap-center flex flex-col justify-between bg-gray-50/50 rounded-xl p-3 border border-gray-100 opacity-60">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>KA</AvatarFallback>
                  </Avatar>
                  <p className="text-[11px] font-semibold">Kai</p>
                </div>
                <h3 className="text-[15px] font-bold text-gray-900 leading-tight">
                  "The beard deserves an Emmy 😂"
                </h3>
              </div>
            </div>
            
            {/* Spacer for scroll */}
            <div className="w-2 shrink-0"></div>
          </div>
        </div>

        {/* Action Row */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <Avatar className="w-6 h-6 border-2 border-white">
                <AvatarImage src="https://i.pravatar.cc/100?img=1" />
              </Avatar>
              <Avatar className="w-6 h-6 border-2 border-white">
                <AvatarImage src="https://i.pravatar.cc/100?img=2" />
              </Avatar>
            </div>
            <button className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1">
              Tell a friend <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-gray-900 bg-white shadow-sm border border-gray-200 rounded-full">
            <Share className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Share</span>
          </Button>
        </div>

        {/* Input Footer */}
        <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src="https://i.pravatar.cc/100?img=33" />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
          <div className="relative flex-1">
            <Input 
              placeholder="Add your take..." 
              className="pr-10 bg-gray-100 border-transparent focus-visible:ring-[#7c3aed] focus-visible:ring-1 rounded-full text-sm h-10"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7c3aed] hover:text-[#6d28d9] p-1.5 rounded-full hover:bg-purple-50 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
