import { useState, useEffect } from "react";
import { X, Bell, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Notification {
  id: string;
  user_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

const fetchNotifications = async (session: any, userId: string): Promise<Notification[]> => {
  if (!session?.access_token || !userId) {
    throw new Error('No authentication token or user ID available');
  }

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
    throw new Error(`Failed to fetch notifications: ${response.statusText}`);
  }

  return response.json();
};

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  
  // For demo purposes, using a hardcoded user ID - in real app this would come from auth
  const userId = "user-1";

  const { data: notifications, isLoading, error } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(session, userId),
    enabled: !!session?.access_token && !!userId && isOpen,
  });

  if (!isOpen) return null;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getNotificationIcon = (message: string) => {
    if (message.toLowerCase().includes('achievement') || message.toLowerCase().includes('badge')) {
      return <CheckCircle className="text-green-600" size={20} />;
    }
    if (message.toLowerCase().includes('friend') || message.toLowerCase().includes('follow')) {
      return <Bell className="text-blue-600" size={20} />;
    }
    return <AlertCircle className="text-purple-600" size={20} />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            data-testid="close-notifications"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {!session ? (
            <div className="p-6 text-center">
              <p className="text-gray-600">Please sign in to view notifications.</p>
            </div>
          ) : isLoading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="animate-pulse">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertCircle className="text-red-500 mx-auto mb-2" size={24} />
              <p className="text-red-600 font-medium">Failed to load notifications</p>
              <p className="text-gray-600 text-sm mt-1">Please try again later</p>
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50' : ''}`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.message)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="text-gray-400" size={12} />
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bell className="text-gray-400 mx-auto mb-3" size={32} />
              <p className="text-gray-600 font-medium">No notifications yet</p>
              <p className="text-gray-500 text-sm mt-1">
                You'll see updates about your activity here
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications && notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {notifications.filter(n => !n.read).length} unread
              </p>
              <Button
                onClick={() => {
                  // In a real app, you'd implement mark all as read functionality
                  console.log('Mark all as read');
                }}
                variant="outline"
                size="sm"
                className="text-xs"
                data-testid="mark-all-read"
              >
                Mark all as read
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}