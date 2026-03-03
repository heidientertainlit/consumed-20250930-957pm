import Navigation from "@/components/navigation";
import CastFriendsGame from "@/components/cast-friends-game";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PlayCastPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />

      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => window.history.back()}
              className="flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-semibold text-white">Cast a Friend</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <CastFriendsGame />
      </div>
    </div>
  );
}
