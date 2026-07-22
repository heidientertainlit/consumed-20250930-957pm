import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Share, ThumbsDown, ThumbsUp, AtSign, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function Hybrid() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-100">
        
        {/* Header - Poster Band */}
        <div className="flex gap-4 p-4 border-b border-gray-50">
          <div className="shrink-0">
            <img 
              src="/__mockup/images/death-by-lightning-poster.png" 
              alt="Death by Lightning" 
              className="w-20 h-28 object-cover rounded-lg shadow-sm"
            />
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 leading-tight mb-1">
              Death by Lightning
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">TV Series</span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-500 font-medium">2024</span>
            </div>
            
            <div className="flex items-center gap-2 mt-auto">
              <div className="flex -space-x-2">
                <Avatar className="w-6 h-6 border-2 border-white">
                  <AvatarImage src="https://i.pravatar.cc/100?u=1" />
                </Avatar>
                <Avatar className="w-6 h-6 border-2 border-white">
                  <AvatarImage src="https://i.pravatar.cc/100?u=2" />
                </Avatar>
                <Avatar className="w-6 h-6 border-2 border-white">
                  <AvatarImage src="https://i.pravatar.cc/100?u=3" />
                </Avatar>
              </div>
              <span className="text-sm font-medium text-gray-600">
                <strong className="text-gray-900">423</strong> talking
              </span>
            </div>
          </div>
        </div>

        {/* Takes Deck - Swipeable */}
        <div className="bg-gray-50/50 py-5">
          <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-2 px-4 gap-3">
            
            {/* Card 1 */}
            <div className="snap-center shrink-0 w-[85%] bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="https://i.pravatar.cc/150?u=trey" />
                    <AvatarFallback>TR</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-bold text-gray-900">Trey</div>
                    <div className="text-[10px] text-[#7c3aed] font-semibold bg-violet-50 px-1.5 py-0.5 rounded-sm inline-block">
                      83% aligned
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none font-bold text-[10px]">
                  🔥 Hot Take
                </Badge>
              </div>
              
              <div className="mb-4 flex-grow">
                <div className="flex gap-0.5 mb-2">
                  {[1,2,3,4].map(i => <span key={i} className="text-yellow-400 text-xs">★</span>)}
                  <span className="text-gray-300 text-xs">★</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 leading-snug">
                  "Hooked after one episode. The pacing is relentless."
                </h3>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-green-600 hover:bg-green-50">
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    <span className="text-xs font-semibold">236</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-red-600 hover:bg-red-50">
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">28</span>
                </Button>
              </div>
            </div>

            {/* Card 2 */}
            <div className="snap-center shrink-0 w-[85%] bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="https://i.pravatar.cc/150?u=ash" />
                    <AvatarFallback>AS</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-bold text-gray-900">Ashley</div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[10px]">
                  🧠 Theory
                </Badge>
              </div>
              
              <div className="mb-4 flex-grow">
                <h3 className="text-xl font-bold text-gray-900 leading-snug">
                  "Lincoln isn't the real villain here. Watch the background characters closely."
                </h3>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-green-600 hover:bg-green-50">
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    <span className="text-xs font-semibold">142</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-red-600 hover:bg-red-50">
                    <ThumbsDown className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">89</span>
                </Button>
              </div>
            </div>

            {/* Card 3 */}
            <div className="snap-center shrink-0 w-[85%] bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col opacity-50 relative">
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Button variant="secondary" className="rounded-full shadow-md bg-white text-gray-900 hover:bg-gray-50">
                  See 420 more <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="flex items-center justify-between mb-3 filter blur-[2px]">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="https://i.pravatar.cc/150?u=kai" />
                  </Avatar>
                  <div>
                    <div className="text-sm font-bold">Kai</div>
                  </div>
                </div>
              </div>
              <div className="mb-4 flex-grow filter blur-[2px]">
                <h3 className="text-xl font-bold leading-snug">
                  "The beard deserves an Emmy 😂"
                </h3>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src="https://i.pravatar.cc/150?u=me" />
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
            <div className="relative flex-grow">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <AtSign className="w-4 h-4" />
              </div>
              <Input 
                placeholder="Tell a friend or add a take..." 
                className="pl-9 pr-4 bg-gray-50 border-transparent rounded-full h-10 text-sm focus-visible:ring-[#7c3aed] focus-visible:ring-1 focus-visible:bg-white"
              />
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 text-gray-400 hover:text-gray-900 rounded-full h-10 w-10 bg-gray-50 hover:bg-gray-100">
              <Share className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
