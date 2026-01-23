import { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, UserCheck, Users, AtSign, Star, FileEdit, Trophy, Zap, Brain, BookOpen, Dna, Vote } from 'lucide-react';
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

  // Fetch notifications (includes both regular and engagement notifications stored in DB)
  const { data: notifications = [], refetch } = useQuery<Notification[]>({
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
    // Mark as read
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }

    // Close dropdown before navigating
    setOpen(false);

    // For notifications with action_url, use it directly
    if (notification.action_url) {
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

      case 'cast':
        // Someone cast you - go to the Activity/Takes page (feed)
        setLocation('/activity');
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
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'like':
      case 'post_like':
      case 'comment_like':
        return <Heart className={`${iconClass} text-red-400`} />;
      case 'comment':
      case 'comment_reply':
      case 'friend_activity':
        return <MessageCircle className={`${iconClass} text-blue-400`} />;
      case 'friend_request':
        return <UserPlus className={`${iconClass} text-purple-400`} />;
      case 'friend_accepted':
        return <UserCheck className={`${iconClass} text-green-400`} />;
      case 'follow':
        return <Users className={`${iconClass} text-purple-400`} />;
      case 'mention':
        return <AtSign className={`${iconClass} text-cyan-400`} />;
      case 'inner_circle':
        return <Star className={`${iconClass} text-yellow-400`} />;
      case 'collaborator_added':
        return <FileEdit className={`${iconClass} text-orange-400`} />;
      case 'cast':
        return <Users className={`${iconClass} text-amber-400`} />;
      case 'leaderboard_position':
        return <Trophy className={`${iconClass} text-yellow-400`} />;
      case 'points_to_rank':
        return <Zap className={`${iconClass} text-purple-400`} />;
      case 'trivia_rank':
        return <Brain className={`${iconClass} text-pink-400`} />;
      case 'tracking_milestone':
      case 'tracking_competition':
        return <BookOpen className={`${iconClass} text-green-400`} />;
      case 'dna_recommendation':
        return <Dna className={`${iconClass} text-indigo-400`} />;
      case 'poll_nudge':
        return <Vote className={`${iconClass} text-blue-400`} />;
      default:
        return <Bell className={`${iconClass} text-slate-400`} />;
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
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 text-left hover:bg-slate-800 transition-colors ${
                    !notification.read ? 'bg-slate-800/50' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
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
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
