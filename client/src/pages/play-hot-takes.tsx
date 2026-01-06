import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, ThumbsDown, MessageCircle, Share2, Trophy, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import FeedbackFooter from '@/components/feedback-footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface HotTake {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  user_display_name?: string;
  user_username?: string;
  user_avatar_url?: string;
  user_voted?: 'up' | 'down' | null;
  heat_score?: number;
}

export default function PlayHotTakesPage() {
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'topic' | null>(null);
  const [newTake, setNewTake] = useState('');

  const categoryFilters = [
    { id: 'Movies', label: 'Movies' },
    { id: 'TV', label: 'TV Shows' },
    { id: 'Music', label: 'Music' },
    { id: 'Books', label: 'Books' },
    { id: 'Sports', label: 'Sports' },
    { id: 'Pop Culture', label: 'Pop Culture' },
  ];

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const { data: hotTakes = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/hot-takes', selectedCategory, searchQuery],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          content,
          created_at,
          hot_take_upvotes,
          hot_take_downvotes,
          comments_count,
          media_type_category,
          users:user_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('post_type', 'hot_take')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (selectedCategory) {
        query = query.eq('media_type_category', selectedCategory);
      }

      if (searchQuery) {
        query = query.ilike('content', `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching hot takes:', error);
        return [];
      }

      let userVotes: Record<string, 'up' | 'down'> = {};
      if (user) {
        const { data: votes } = await supabase
          .from('hot_take_votes')
          .select('post_id, vote_type')
          .eq('user_id', user.id);
        
        if (votes) {
          votes.forEach((v: any) => {
            userVotes[v.post_id] = v.vote_type;
          });
        }
      }

      return (data || []).map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        content: post.content,
        created_at: post.created_at,
        upvotes: post.hot_take_upvotes || 0,
        downvotes: post.hot_take_downvotes || 0,
        comments_count: post.comments_count || 0,
        user_display_name: post.users?.display_name,
        user_username: post.users?.username,
        user_avatar_url: post.users?.avatar_url,
        user_voted: userVotes[post.id] || null,
        heat_score: (post.hot_take_upvotes || 0) - (post.hot_take_downvotes || 0)
      }));
    },
  });

  const submitTakeMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to post');
      }

      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          content: content,
          post_type: 'hot_take',
          media_type_category: selectedCategory || 'Pop Culture',
          is_hidden: false,
          hot_take_upvotes: 0,
          hot_take_downvotes: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: '🔥 Hot take posted!' });
      setNewTake('');
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to post', description: error.message, variant: 'destructive' });
    }
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: 'up' | 'down' }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to vote');
      }

      const { data: existingVote } = await supabase
        .from('hot_take_votes')
        .select('id, vote_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: currentPost } = await supabase
        .from('social_posts')
        .select('hot_take_upvotes, hot_take_downvotes')
        .eq('id', postId)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from('hot_take_votes').delete().eq('id', existingVote.id);
          const currentValue = voteType === 'up' 
            ? (currentPost?.hot_take_upvotes || 0) 
            : (currentPost?.hot_take_downvotes || 0);
          await supabase
            .from('social_posts')
            .update(voteType === 'up' 
              ? { hot_take_upvotes: Math.max(0, currentValue - 1) }
              : { hot_take_downvotes: Math.max(0, currentValue - 1) })
            .eq('id', postId);
          return { action: 'removed', voteType };
        } else {
          await supabase.from('hot_take_votes').update({ vote_type: voteType }).eq('id', existingVote.id);
          const oldValue = existingVote.vote_type === 'up' 
            ? (currentPost?.hot_take_upvotes || 0) 
            : (currentPost?.hot_take_downvotes || 0);
          const newValue = voteType === 'up' 
            ? (currentPost?.hot_take_upvotes || 0) 
            : (currentPost?.hot_take_downvotes || 0);
          await supabase
            .from('social_posts')
            .update(existingVote.vote_type === 'up' 
              ? { hot_take_upvotes: Math.max(0, oldValue - 1) }
              : { hot_take_downvotes: Math.max(0, oldValue - 1) })
            .eq('id', postId);
          await supabase
            .from('social_posts')
            .update(voteType === 'up' 
              ? { hot_take_upvotes: newValue + 1 }
              : { hot_take_downvotes: newValue + 1 })
            .eq('id', postId);
          return { action: 'changed', voteType };
        }
      } else {
        await supabase.from('hot_take_votes').insert({
          post_id: postId,
          user_id: user.id,
          vote_type: voteType
        });
        const currentValue = voteType === 'up' 
          ? (currentPost?.hot_take_upvotes || 0) 
          : (currentPost?.hot_take_downvotes || 0);
        await supabase
          .from('social_posts')
          .update(voteType === 'up' 
            ? { hot_take_upvotes: currentValue + 1 }
            : { hot_take_downvotes: currentValue + 1 })
          .eq('id', postId);
        return { action: 'added', voteType };
      }
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Vote failed', description: error.message, variant: 'destructive' });
    }
  });

  const sortedTakes = useMemo(() => {
    return [...hotTakes].sort((a, b) => (b.heat_score || 0) - (a.heat_score || 0));
  }, [hotTakes]);

  const hottestTake = sortedTakes[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-black mb-2 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <Flame className="text-orange-500" size={28} />
            Hot Takes
          </h1>
          <p className="text-base text-gray-600">
            Share your bold opinions and vote on the spiciest takes
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <textarea
            value={newTake}
            onChange={(e) => setNewTake(e.target.value)}
            placeholder="Drop your hottest take... 🔥"
            className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            rows={3}
            data-testid="input-hot-take"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-2">
              {categoryFilters.slice(0, 4).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-orange-100 text-orange-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`filter-${cat.id.toLowerCase()}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <Button
              onClick={() => newTake.trim() && submitTakeMutation.mutate(newTake.trim())}
              disabled={!newTake.trim() || submitTakeMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              data-testid="button-post-take"
            >
              <Flame size={16} className="mr-1" />
              Post Take
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hot takes..."
              className="pl-10 bg-white"
              data-testid="input-search-takes"
            />
          </div>
        </div>

        {hottestTake && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 mb-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={20} />
              <span className="font-semibold">Hottest Take Right Now</span>
            </div>
            <p className="text-lg font-medium mb-2">"{hottestTake.content}"</p>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              <span>— @{hottestTake.user_username || 'anonymous'}</span>
              <span className="flex items-center gap-1">
                <Flame size={14} /> {hottestTake.heat_score} heat
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : hotTakes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="text-4xl mb-3">🔥</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hot Takes Yet</h3>
            <p className="text-gray-500 text-sm">Be the first to share a bold opinion!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hotTakes.map((take) => (
              <Card key={take.id} className="bg-white border-gray-100" data-testid={`hot-take-${take.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold">
                      {take.user_avatar_url ? (
                        <img src={take.user_avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {take.user_display_name || take.user_username || 'Anonymous'}
                        </span>
                        <span className="text-gray-400 text-sm">
                          @{take.user_username || 'user'}
                        </span>
                        <span className="text-gray-400 text-sm">·</span>
                        <span className="text-gray-400 text-sm">
                          {formatDistanceToNow(new Date(take.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-gray-800 mb-3">{take.content}</p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => voteMutation.mutate({ postId: take.id, voteType: 'up' })}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                            take.user_voted === 'up'
                              ? 'bg-orange-100 text-orange-600'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          data-testid={`vote-up-${take.id}`}
                        >
                          <Flame size={16} />
                          <span className="text-sm font-medium">{take.upvotes}</span>
                        </button>
                        <button
                          onClick={() => voteMutation.mutate({ postId: take.id, voteType: 'down' })}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                            take.user_voted === 'down'
                              ? 'bg-blue-100 text-blue-600'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          data-testid={`vote-down-${take.id}`}
                        >
                          <ThumbsDown size={16} />
                          <span className="text-sm font-medium">{take.downvotes}</span>
                        </button>
                        <button 
                          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                          data-testid={`comments-${take.id}`}
                        >
                          <MessageCircle size={16} />
                          <span className="text-sm" data-testid={`comments-count-${take.id}`}>{take.comments_count}</span>
                        </button>
                        <button 
                          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 ml-auto"
                          data-testid={`share-${take.id}`}
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <FeedbackFooter />
      <ConsumptionTracker isOpen={isTrackModalOpen} onClose={() => setIsTrackModalOpen(false)} />
    </div>
  );
}
