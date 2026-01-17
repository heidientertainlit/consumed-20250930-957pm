import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Flame, ChevronRight, ThumbsUp, MessageCircle } from 'lucide-react';

interface HotTake {
  id: string;
  content: string;
  user: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  likes_count: number;
  comments_count: number;
  origin_type?: string;
}

export function HotTakesGlimpse() {
  const { session } = useAuth();

  const { data: hotTakes, isLoading } = useQuery({
    queryKey: ['hot-takes-glimpse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          content,
          likes_count,
          comments_count,
          origin_type,
          user:profiles!social_posts_user_id_fkey(username, display_name, avatar_url)
        `)
        .eq('post_type', 'hot_take')
        .order('likes_count', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return (data || []).map(post => ({
        ...post,
        user: Array.isArray(post.user) ? post.user[0] : post.user
      })) as HotTake[];
    },
    enabled: !!session?.access_token
  });

  if (!session || isLoading || !hotTakes || hotTakes.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-orange-500 to-red-500 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Hot Takes</p>
            <p className="text-[10px] text-white/70">Spicy opinions</p>
          </div>
        </div>
        <Link href="/play/hot-takes">
          <div className="flex items-center gap-1 text-white/80 hover:text-white cursor-pointer">
            <span className="text-xs font-medium">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="space-y-2">
        {hotTakes.slice(0, 2).map((take) => (
          <div 
            key={take.id}
            className="bg-white/15 rounded-xl p-3 backdrop-blur-sm"
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                {take.user?.avatar_url ? (
                  <img src={take.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-[10px] text-white font-bold">
                    {(take.user?.display_name || take.user?.username || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80">
                  {take.user?.display_name || take.user?.username}
                  {take.origin_type === 'consumed' && (
                    <span className="ml-1 text-[10px] bg-yellow-400/30 text-yellow-200 px-1 rounded">Consumed</span>
                  )}
                </p>
                <p className="text-sm text-white font-medium line-clamp-2">{take.content}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/60 text-xs">
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                <span>{take.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                <span>{take.comments_count || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
