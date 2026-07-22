import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowUp, ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Plus } from "lucide-react";

const COVER =
  "https://books.google.com/books/content?id=DdR-cUp7ooYC&printsec=frontcover&img=1&zoom=1&edge=curl&imgtk=AFLRE71meE4vkMbl2RYBcujqqYx1ELRXuJfxKcew2dQpNWWyzEF-I6xKpa2tNjtdyYrm4QxHwztHD5leCnipCvEHR75cEh7ucdNLzwXjfDDb6f82c8ZODNXUFyYtklQqXSlGsboGcIdw&source=gbs_api";

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= count ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export function RateBackHook() {
  const [mine, setMine] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || mine;

  return (
    <div className="flex items-start justify-center min-h-screen bg-gray-100 p-4 pt-10 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7c3aed]" />
            <span className="text-[15px] font-bold text-gray-900">See what everyone thinks</span>
            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-0 text-[11px] px-2 py-0">Book</Badge>
          </div>
          <div className="flex items-center gap-1 text-[#7c3aed] text-xs font-medium">
            <ChevronLeft className="w-3.5 h-3.5 text-gray-300" /> 1 of 8 <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-3">
          <div className="relative w-[72px] shrink-0 rounded-lg overflow-hidden shadow-sm">
            <img src={COVER} alt="Cinder" className="w-full h-[108px] object-cover" />
            <button className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-[#7c3aed]/90 flex items-center justify-center text-white">
              <Plus className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 bg-teal-500">
                <AvatarFallback className="bg-teal-500 text-white text-xs">A</AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold text-gray-900">Ashley Hughes</p>
                <p className="text-[11px] font-medium text-[#7c3aed]">47% aligned with you</p>
              </div>
            </div>
            <p className="text-[15px] font-bold text-gray-900 mt-2">Cinder</p>
            <p className="text-[11px] text-gray-500 -mt-0.5 mb-1">Marissa Meyer</p>
            <Stars count={4} />
          </div>
        </div>

        {/* The hook: turn the missing commentary into a question + one-tap rate-back */}
        <div className="mt-3 rounded-xl bg-purple-50/70 border border-purple-100 px-3 py-2.5">
          <p className="text-[13px] text-gray-700">
            Ashley didn't say why. <span className="font-semibold text-gray-900">Do you agree with 4 stars?</span>
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-medium text-gray-500">Your call:</span>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setMine(i)} onMouseEnter={() => setHover(i)}>
                  <Star className={`w-5 h-5 transition-colors ${i <= shown ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            {mine > 0 && <span className="text-[11px] font-semibold text-[#7c3aed]">Saved!</span>}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-5 text-gray-500 text-[13px] mt-3 pt-3 border-t border-gray-100">
          <button className="flex items-center gap-1 hover:text-[#7c3aed]"><ArrowUp className="w-4 h-4" /> Agree</button>
          <button className="flex items-center gap-1 hover:text-red-500"><ArrowDown className="w-4 h-4" /> Disagree</button>
          <button className="flex items-center gap-1 hover:text-gray-900 ml-auto">Tell a friend <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>

        {/* Take bar */}
        <div className="flex items-center gap-2 mt-3">
          <Avatar className="w-8 h-8 bg-purple-100">
            <AvatarFallback className="bg-purple-100 text-[#7c3aed] text-xs">H</AvatarFallback>
          </Avatar>
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400">
            Add your take or @tag a friend...
          </div>
        </div>
      </div>
    </div>
  );
}
