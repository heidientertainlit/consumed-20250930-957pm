import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Wallet, Plus, Activity, BarChart3, Gamepad2, Users, Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import SearchModal from "./search-modal";
import NotificationsModal from "./notifications-modal";
import { useAuth } from "@/lib/auth";

interface NavigationProps {
  onTrackConsumption?: () => void;
}

export default function Navigation({ onTrackConsumption }: NavigationProps) {
  const [location] = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const { data: user } = useQuery({
    queryKey: ["/api/users/user-1"],
  });

  // Check for undismissed static notifications
  useEffect(() => {
    const dismissed = JSON.parse(localStorage.getItem("nudges.dismissed") || "[]");
    const totalNudges = 2; // We have 2 static nudges
    setNotificationCount(totalNudges - dismissed.length);
  }, [isNotificationsOpen]); // Recheck when modal closes

  return (
    <>
      {/* Top bar with logo and points */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 sticky top-0 z-50">
        <div className="flex justify-between items-center h-16 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-white">consumed</span>
          </Link>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              data-testid="search-button"
            >
              <Search className="text-white" size={18} />
            </button>
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              data-testid="notification-bell"
            >
              <Bell className="text-white" size={18} />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-purple-900 z-50">
        <div className="flex justify-around items-center h-20 px-4">
          <Link
            href="/track"
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${location === "/track" || location === "/" ? "bg-white/20" : ""}`}
          >
            <Plus className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Track</span>
          </Link>

          <Link
            href="/play"
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${location === "/play" ? "bg-white/20" : ""}`}
          >
            <Gamepad2 className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Play</span>
          </Link>

          <Link
            href="/leaderboard"
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${location === "/leaderboard" ? "bg-white/20" : ""}`}
          >
            <BarChart3 className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Leaderboard</span>
          </Link>

          <Link
            href="/feed"
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${location === "/feed" ? "bg-white/20" : ""}`}
          >
            <Activity className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Feed</span>
          </Link>

          <Link
            href="/user/user-1"
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${location.startsWith("/user") ? "bg-white/20" : ""}`}
          >
            <div className="relative">
              <User className="text-white" size={24} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="none">
                  {/* DNA double helix strands */}
                  <path d="M2 2 Q8 6 14 4" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.8" />
                  <path d="M2 8 Q8 4 14 8" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.8" />
                  <path d="M2 14 Q8 10 14 12" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.8" />
                  
                  {/* Cross connections */}
                  <line x1="4" y1="3" x2="12" y2="5" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                  <line x1="6" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                  <line x1="4" y1="11" x2="12" y2="9" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                  
                  {/* DNA base nodes */}
                  <circle cx="2" cy="2" r="0.8" fill="currentColor" />
                  <circle cx="14" cy="4" r="0.8" fill="currentColor" />
                  <circle cx="2" cy="8" r="0.8" fill="currentColor" />
                  <circle cx="14" cy="8" r="0.8" fill="currentColor" />
                  <circle cx="2" cy="14" r="0.8" fill="currentColor" />
                  <circle cx="14" cy="12" r="0.8" fill="currentColor" />
                </svg>
              </div>
            </div>
            <span className="text-xs font-medium text-white">Profile</span>
          </Link>

        </div>
      </nav>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </>
  );
}