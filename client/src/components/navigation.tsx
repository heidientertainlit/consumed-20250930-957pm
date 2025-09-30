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
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M3 1.5C3 1.5 6 3 6 6C6 9 3 10.5 3 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9 1.5C9 1.5 6 3 6 6C6 9 9 10.5 9 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="3" cy="2" r="0.4" fill="currentColor" />
                  <circle cx="9" cy="2" r="0.4" fill="currentColor" />
                  <circle cx="6" cy="6" r="0.4" fill="currentColor" />
                  <circle cx="3" cy="10" r="0.4" fill="currentColor" />
                  <circle cx="9" cy="10" r="0.4" fill="currentColor" />
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