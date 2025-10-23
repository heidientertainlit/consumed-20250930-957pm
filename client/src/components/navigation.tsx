import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Wallet, Plus, Activity, BarChart3, Gamepad2, Users, Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import SearchModal from "./search-modal";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth";

interface NavigationProps {
  onTrackConsumption?: () => void;
}

export default function Navigation({ onTrackConsumption }: NavigationProps) {
  const [location] = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      {/* Top bar with logo and points */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 sticky top-0 z-50">
        <div className="flex justify-between items-center h-16 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/consumed-logo-white.png"
              alt="consumed"
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              data-testid="search-button"
            >
              <Search className="text-white" size={18} />
            </button>
            <NotificationBell />
            <Link href={user?.id ? `/user/${user.id}` : "/login"}>
              <button
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                data-testid="profile-button"
              >
                <User className="text-white" size={18} />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-purple-900 z-50 pb-safe">
        <div className="flex justify-evenly items-center h-20 pb-2">
          <Link
            href="/feed"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/feed" ? "bg-white/20" : ""}`}
          >
            <Activity className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Feed</span>
          </Link>

          <Link
            href="/track"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/track" || location === "/" ? "bg-white/20" : ""}`}
          >
            <Plus className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Track</span>
          </Link>

          <Link
            href="/play"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/play" ? "bg-white/20" : ""}`}
          >
            <Gamepad2 className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Play</span>
          </Link>

          <Link
            href="/leaderboard"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/leaderboard" ? "bg-white/20" : ""}`}
          >
            <BarChart3 className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Leaders</span>
          </Link>

          <Link
            href="/friends"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/friends" ? "bg-white/20" : ""}`}
          >
            <Users className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Friends</span>
          </Link>

        </div>
      </nav>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}