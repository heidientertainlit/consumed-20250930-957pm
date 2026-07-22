import React, { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Share, Send, MoreHorizontal, ArrowRight, ArrowUp, ArrowDown, Star, Plus, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TAKES = [
  {
    name: "Trey",
    avatar: "https://i.pravatar.cc/100?img=11",
    fallback: "TR",
    aligned: "83% aligned with you",
    alignedHot: true,
    stars: 4,
    tag: { label: "Take", flame: true, cls: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
    text: '"Hooked after one episode. The pacing is relentless."',
    agrees: 236,
  },
  {
    name: "Ashley",
    avatar: "https://i.pravatar.cc/100?img=5",
    fallback: "AS",
    aligned: "71% aligned with you",
    alignedHot: false,
    stars: 4,
    tag: { label: "Theory", flame: false, cls: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
    text: '"Lincoln isn\'t the real villain. Watch the background characters."',
    agrees: 142,
  },
  {
    name: "Kai",
    avatar: "",
    fallback: "KA",
    aligned: "64% aligned with you",
    alignedHot: false,
    stars: 5,
    tag: { label: "Take", flame: true, cls: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
    text: '"The beard deserves an Emmy 😂"',
    agrees: 87,
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= count ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export function PosterAnchor() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const CARD_W = 232; // card width + gap

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(TAKES.length - 1, next));
    setIndex(clamped);
    scrollerRef.current?.scrollTo({ left: clamped * CARD_W, behavior: "smooth" });
  };

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
        <div className="flex px-4 pb-4 gap-3 relative">

          {/* Poster Anchor */}
          <div className="w-[120px] shrink-0 relative rounded-xl overflow-hidden shadow-sm">
            <img
              src="/__mockup/images/death-by-lightning-poster.png"
              alt="Death by Lightning Poster"
              className="w-full h-[236px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-80" />
            {/* App's Add button */}
            <button className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center text-[#7c3aed] hover:bg-white transition-colors">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <div className="absolute bottom-2 left-2 right-2">
              <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-0 text-[10px] px-1.5 py-0">TV Series</Badge>
            </div>
          </div>

          {/* Swipeable Takes (Right Side) */}
          <div className="flex-1 relative overflow-hidden">
            <div
              ref={scrollerRef}
              className="overflow-x-auto snap-x snap-mandatory hide-scrollbar flex gap-3 pb-2 h-full"
              onScroll={(e) => {
                const i = Math.round(e.currentTarget.scrollLeft / CARD_W);
                if (i !== index) setIndex(Math.max(0, Math.min(TAKES.length - 1, i)));
              }}
            >
              {TAKES.map((t, i) => (
                <div
                  key={t.name}
                  className="w-[220px] shrink-0 snap-start flex flex-col justify-between bg-gray-50/80 rounded-xl p-3 border border-gray-100"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-white">
                          {t.avatar && <AvatarImage src={t.avatar} />}
                          <AvatarFallback>{t.fallback}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-900 leading-none">{t.name}</p>
                          <p className={`text-[10px] font-medium mt-0.5 ${t.alignedHot ? "text-[#7c3aed]" : "text-gray-500"}`}>
                            {t.aligned}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-[9px] border-0 px-1 py-0 h-4 flex items-center gap-0.5 ${t.tag.cls}`}>
                        {t.tag.flame && <Flame className="w-2.5 h-2.5" />} {t.tag.label}
                      </Badge>
                    </div>

                    <div className="mb-1.5">
                      <Stars count={t.stars} />
                    </div>

                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight mb-2 tracking-tight">
                      {t.text}
                    </h3>
                  </div>

                  {/* App actions: Agree / Disagree / Rate */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-200/60 text-gray-500">
                    <button className="flex items-center gap-1 hover:text-[#7c3aed] transition-colors">
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">Agree · {t.agrees}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">Disagree</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-yellow-500 transition-colors">
                      <Star className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">Rate</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Spacer for scroll */}
              <div className="w-2 shrink-0"></div>
            </div>

            {/* Carousel arrows */}
            {index > 0 && (
              <button
                onClick={() => goTo(index - 1)}
                className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-[#7c3aed] transition-colors z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {index < TAKES.length - 1 && (
              <button
                onClick={() => goTo(index + 1)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-[#7c3aed] transition-colors z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Dots */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1">
              {TAKES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${i === index ? "w-3 bg-[#7c3aed]" : "w-1 bg-gray-300"}`}
                />
              ))}
            </div>
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
