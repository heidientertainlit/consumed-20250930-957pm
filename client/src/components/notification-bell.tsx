import { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, UserCheck, Users, AtSign, Star, FileEdit, Trophy, Zap, Brain, BookOpen, Dna, Vote, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.error('[notifications] query error:', error.message, error.code);
        throw error;
      }
      console.log('[notifications] loaded:', data?.length || 0, 'for user', userId, data?.map((n: any) => ({ type: n.type, message: n.message })));
      return data || [];
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpen = () => {
    setOpen(true);
    refetch();
  };

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

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch, userId]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsReadMutation.mutate(notification.id);
    setOpen(false);

    if (notification.action_url) {
      setLocation(notification.action_url);
      return;
    }

    switch (notification.type) {
      case 'comment':
      case 'comment_reply':
      case 'like':
      case 'mention':
      case 'comment_like':
      case 'post_like':
        setLocation(notification.post_id
          ? (notification.comment_id
            ? `/activity?post=${notification.post_id}&comment=${notification.comment_id}`
            : `/activity?post=${notification.post_id}`)
          : '/activity');
        break;
      case 'collaborator_added':
        setLocation(notification.list_id ? `/list/${notification.list_id}` : '/track');
        break;
      case 'room_joined':
      case 'room_added':
      case 'room_new_question':
        setLocation(notification.list_id ? `/room/${notification.list_id}` : '/rooms');
        break;
      case 'friend_request':
        setLocation('/friends');
        break;
      case 'friend_accepted':
        setLocation(notification.triggered_by_user_id ? `/user/${notification.triggered_by_user_id}` : '/friends');
        break;
      case 'follow':
      case 'inner_circle':
        if (notification.triggered_by_user_id) setLocation(`/user/${notification.triggered_by_user_id}`);
        break;
      case 'cast':
        setLocation('/activity');
        break;
      default:
        if (notification.post_id) setLocation(`/activity?post=${notification.post_id}`);
        else if (notification.list_id) setLocation(`/list/${notification.list_id}`);
        else setLocation('/activity');
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
      case 'room_joined':
      case 'room_added':
        return <Users className={`${iconClass} text-violet-400`} />;
      case 'room_new_question':
        return <Bell className={`${iconClass} text-violet-400`} />;
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
    <>
      <button
        className="relative p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        data-testid="button-notifications"
        onClick={handleOpen}
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="bg-slate-900 border-slate-700 rounded-t-2xl p-0 max-h-[80vh] flex flex-col"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white text-base font-semibold">Notifications</SheetTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs text-purple-400 hover:text-purple-300 h-7 px-2"
                    data-testid="button-mark-all-read"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400" data-testid="text-no-notifications">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-4 text-left transition-colors active:bg-slate-700 ${
                      !notification.read ? 'bg-slate-800/50' : 'hover:bg-slate-800'
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
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
