import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Wallet, Plus, Activity, BarChart3, Gamepad2, Users, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import SearchModal from "./search-modal";
import NotificationsModal from "./notifications-modal";
import { useAuth } from "@/lib/auth";

interface NavigationProps {
  onTrackConsumption?: () => void;
}

// Function to fetch notification count
const fetchNotificationCount = async (session: any, userId: string): Promise<number> => {
  if (!session?.access_token || !userId) {
    return 0;
  }

  try {
    const params = new URLSearchParams({
      userId: userId,
    });

    const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/notifications?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return 0;
    }

    const notifications = await response.json();
    return notifications.filter((n: any) => !n.read).length;
  } catch (error) {
    console.error('Failed to fetch notification count:', error);
    return 0;
  }
};

export default function Navigation({ onTrackConsumption }: NavigationProps) {
  const [location] = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { session } = useAuth();

  const { data: user } = useQuery({
    queryKey: ["/api/users/user-1"],
  });

  // For demo purposes, using a hardcoded user ID - in real app this would come from auth
  const userId = "user-1";

  const { data: notificationCount = 0 } = useQuery({
    queryKey: ["notification-count", userId],
    queryFn: () => fetchNotificationCount(session, userId),
    enabled: !!session?.access_token && !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return (
    <>
      {/* Top bar with logo and points */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 sticky top-0 z-50">
        <div className="flex justify-between items-center h-16 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-white">entertainlit</span>
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
            <Link 
              href="/user/user-1" 
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              data-testid="profile-avatar"
            >
              <span className="text-sm font-bold text-white">JD</span>
            </Link>
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
            href="/friends-creators" 
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${location === "/friends-creators" ? "bg-white/20" : ""}`}
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

      {/* Notifications Modal */}
      <NotificationsModal 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />
    </>
  );
}