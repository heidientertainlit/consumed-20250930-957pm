import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowUp, ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Plus } from "lucide-react";

const COVER =
  "https://books.google.com/books/content?id=DdR-cUp7ooYC&printsec=frontcover&img=1&zoom=1&edge=curl&imgtk=AFLRE71meE4vkMbl2RYBcujqqYx1ELRXuJfxKcew2dQpNWWyzEF-I6xKpa2tNjtdyYrm4QxHwztHD5leCnipCvEHR75cEh7ucdNLzwXjfDDb6f82c8ZODNXUFyYtklQqXSlGsboGcIdw&source=gbs_api";

function Stars({ count, size = "w-4 h-4" }: { count: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= count ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export function CompactSignal() {
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

        {/* Compact body: small poster + everything inline */}
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
            {/* Community context line — gives the card substance from data */}
            <p className="text-[11px] text-gray-500 mt-2">
              <span className="font-semibold text-gray-700">12 friends</span> rated this · avg{" "}
              <span className="font-semibold text-gray-700">3.5</span>
              <Star className="inline w-3 h-3 fill-yellow-400 text-yellow-400 -mt-0.5 ml-0.5" />
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-5 text-gray-500 text-[13px] mt-3 pt-3 border-t border-gray-100">
          <button className="flex items-center gap-1 hover:text-[#7c3aed]"><ArrowUp className="w-4 h-4" /> Agree</button>
          <button className="flex items-center gap-1 hover:text-red-500"><ArrowDown className="w-4 h-4" /> Disagree</button>
          <button className="flex items-center gap-1 hover:text-yellow-500"><Star className="w-4 h-4" /> Rate</button>
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
