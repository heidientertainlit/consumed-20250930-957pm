import { useState, useEffect } from 'react';
import { Bell, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  post_id?: string;
  comment_id?: string;
  list_id?: string;
  triggered_by_user_id: string;
  action_url?: string;
  isEngagement?: boolean;
}

interface EngagementNotification {
  type: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  // Fetch regular notifications
  const { data: regularNotifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch engagement notifications (nudges)
  const { data: engagementNotifications = [] } = useQuery<EngagementNotification[]>({
    queryKey: ['/api/engagement-notifications', userId],
    enabled: !!userId && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return [];
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-engagement-notifications`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) return [];
        const result = await response.json();
        return result.notifications || [];
      } catch (e) {
        console.error('Failed to fetch engagement notifications:', e);
        return [];
      }
    },
  });

  // Combine notifications - regular first, then engagement nudges
  const notifications: Notification[] = [
    ...regularNotifications,
    ...engagementNotifications.map((n, idx) => ({
      id: `engagement-${idx}`,
      type: n.type,
      message: n.message,
      read: true,
      created_at: new Date().toISOString(),
      triggered_by_user_id: '',
      action_url: n.action_url,
      isEngagement: true,
    })),
  ];

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', userId] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', userId] });
    },
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New notification received:', payload);
          // Refetch to get the new notification
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, userId]);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read (only for regular notifications)
    if (!notification.read && !notification.isEngagement) {
      markAsReadMutation.mutate(notification.id);
    }

    // Close dropdown before navigating
    setOpen(false);

    // For engagement notifications, use action_url
    if (notification.isEngagement && notification.action_url) {
      setLocation(notification.action_url);
      return;
    }

    // Navigate based on notification type and available data
    switch (notification.type) {
      case 'comment':
      case 'comment_reply':
      case 'like':
      case 'mention':
      case 'comment_like':
      case 'post_like':
        // Post-related notifications - go to the specific post and comment
        if (notification.post_id) {
          const url = notification.comment_id 
            ? `/activity?post=${notification.post_id}&comment=${notification.comment_id}`
            : `/activity?post=${notification.post_id}`;
          setLocation(url);
        } else {
          setLocation('/activity');
        }
        break;

      case 'collaborator_added':
        // Go directly to the specific list
        if (notification.list_id) {
          setLocation(`/list/${notification.list_id}`);
        } else {
          setLocation('/track');
        }
        break;

      case 'friend_request':
        // Someone sent YOU a friend request - go to Friends page to approve/reject
        setLocation('/friends');
        break;

      case 'friend_accepted':
        // Someone accepted YOUR friend request - go to their profile
        if (notification.triggered_by_user_id) {
          setLocation(`/user/${notification.triggered_by_user_id}`);
        } else {
          setLocation('/friends');
        }
        break;

      case 'follow':
      case 'inner_circle':
        // Go to the follower's profile
        if (notification.triggered_by_user_id) {
          setLocation(`/user/${notification.triggered_by_user_id}`);
        }
        break;

      default:
        // Fallback: if there's a post_id, go to feed; if list_id, go to that list
        if (notification.post_id) {
          setLocation(`/activity?post=${notification.post_id}`);
        } else if (notification.list_id) {
          setLocation(`/list/${notification.list_id}`);
        } else {
          setLocation('/activity');
        }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
      case 'post_like':
      case 'comment_like':
        return '❤️';
      case 'comment':
      case 'comment_reply':
        return '💬';
      case 'friend_request':
        return '👋';
      case 'friend_accepted':
        return '✅';
      case 'follow':
        return '👥';
      case 'mention':
        return '@';
      case 'inner_circle':
        return '⭐';
      case 'collaborator_added':
        return '📝';
      case 'leaderboard_position':
        return '🏆';
      case 'points_to_rank':
        return '⚡';
      case 'friend_activity':
        return '💬';
      case 'trivia_rank':
        return '🧠';
      case 'tracking_milestone':
      case 'tracking_competition':
        return '📚';
      case 'dna_recommendation':
        return '🧬';
      case 'poll_nudge':
        return '🗳️';
      default:
        return '🔔';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button 
          className="relative p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold"
              data-testid="text-unread-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-slate-900 border-slate-700">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              className="text-xs text-purple-400 hover:text-purple-300"
              data-testid="button-mark-all-read"
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400" data-testid="text-no-notifications">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {regularNotifications.length > 0 && regularNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 text-left hover:bg-slate-800 transition-colors ${
                    !notification.read ? 'bg-slate-800/50' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-label={notification.type}>
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'text-white font-medium' : 'text-slate-300'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5" />
                    )}
                  </div>
                </button>
              ))}
              
              {engagementNotifications.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-y border-purple-700/30">
                    <p className="text-xs text-purple-300 font-medium flex items-center gap-1.5">
                      <Sparkles size={12} /> For You
                    </p>
                  </div>
                  {engagementNotifications.map((notification, idx) => (
                    <button
                      key={`engagement-${idx}`}
                      onClick={() => handleNotificationClick({
                        id: `engagement-${idx}`,
                        type: notification.type,
                        message: notification.message,
                        read: true,
                        created_at: new Date().toISOString(),
                        triggered_by_user_id: '',
                        action_url: notification.action_url,
                        isEngagement: true,
                      })}
                      className="w-full p-4 text-left hover:bg-purple-900/30 transition-colors bg-purple-950/20"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl" aria-label={notification.type}>
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-purple-200">
                            {notification.message}
                          </p>
                        </div>
                        <div className="text-purple-400">
                          →
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
