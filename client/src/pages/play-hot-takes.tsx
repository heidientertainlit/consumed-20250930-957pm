import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, ThumbsDown, MessageCircle, Share2, Search, User, ChevronDown, UserPlus } from 'lucide-react';
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
  media_type_category?: string;
  isConsumed?: boolean;
}

export default function PlayHotTakesPage() {
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'topic' | null>(null);
  const [newTake, setNewTake] = useState('');
  const [postCategory, setPostCategory] = useState('Pop Culture');

  const categoryFilters = [
    { id: 'Movies', label: 'Movies' },
    { id: 'TV', label: 'TV Shows' },
    { id: 'Music', label: 'Music' },
    { id: 'Books', label: 'Books' },
    { id: 'Sports', label: 'Sports' },
    { id: 'Pop Culture', label: 'Pop Culture' },
  ];

  const consumedHotTakes: HotTake[] = [
    {
      id: 'consumed-hot-take-1',
      user_id: 'consumed',
      content: "Friends is overrated. The laugh track does all the heavy lifting.",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 127,
      downvotes: 89,
      comments_count: 34,
      user_display_name: 'Consumed',
      user_username: 'consumed',
      heat_score: 38,
      media_type_category: 'TV',
      isConsumed: true,
    },
    {
      id: 'consumed-hot-take-2',
      user_id: 'consumed',
      content: "The Marvel Cinematic Universe peaked with Infinity War and it's been downhill ever since.",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 215,
      downvotes: 142,
      comments_count: 67,
      user_display_name: 'Consumed',
      user_username: 'consumed',
      heat_score: 73,
      media_type_category: 'Movies',
      isConsumed: true,
    },
    {
      id: 'consumed-hot-take-3',
      user_id: 'consumed',
      content: "Taylor Swift's best album is Folklore and it's not even close.",
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 342,
      downvotes: 98,
      comments_count: 89,
      user_display_name: 'Consumed',
      user_username: 'consumed',
      heat_score: 244,
      media_type_category: 'Music',
      isConsumed: true,
    },
    {
      id: 'consumed-hot-take-4',
      user_id: 'consumed',
      content: "The book is NOT always better than the movie. Fight Club proves this.",
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 189,
      downvotes: 67,
      comments_count: 45,
      user_display_name: 'Consumed',
      user_username: 'consumed',
      heat_score: 122,
      media_type_category: 'Books',
      isConsumed: true,
    },
    {
      id: 'consumed-hot-take-5',
      user_id: 'consumed',
      content: "The Office (US) became unwatchable after Michael Scott left.",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 276,
      downvotes: 54,
      comments_count: 78,
      user_display_name: 'Consumed',
      user_username: 'consumed',
      heat_score: 222,
      media_type_category: 'TV',
      isConsumed: true,
    },
    {
      id: 'consumed-hot-take-6',
      user_id: 'consumed',
      content: "Beyoncé is talented but overrated. There, I said it.",
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      upvotes: 156,
      downvotes: 234,
      comments_count: 102,
      user_display_name: 'Consumed',
      user_username: 'consumed',
      heat_score: -78,
      media_type_category: 'Music',
      isConsumed: true,
    },
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
          fire_votes,
          ice_votes,
          comments_count,
          media_type,
          users:user_id (
            display_name,
            user_name,
            avatar
          )
        `)
        .eq('post_type', 'hot_take')
        .eq('hidden', false)
        .order('created_at', { ascending: false });

      if (selectedCategory) {
        query = query.eq('media_type', selectedCategory);
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
        upvotes: post.fire_votes || 0,
        downvotes: post.ice_votes || 0,
        comments_count: post.comments_count || 0,
        user_display_name: post.users?.display_name,
        user_username: post.users?.user_name,
        user_avatar_url: post.users?.avatar,
        user_voted: userVotes[post.id] || null,
        heat_score: (post.fire_votes || 0) - (post.ice_votes || 0),
        media_type_category: post.media_type || 'Pop Culture',
        isConsumed: false
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
          media_type: postCategory,
          hidden: false,
          fire_votes: 0,
          ice_votes: 0,
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
        .select('fire_votes, ice_votes')
        .eq('id', postId)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from('hot_take_votes').delete().eq('id', existingVote.id);
          const currentValue = voteType === 'up' 
            ? (currentPost?.fire_votes || 0) 
            : (currentPost?.ice_votes || 0);
          await supabase
            .from('social_posts')
            .update(voteType === 'up' 
              ? { fire_votes: Math.max(0, currentValue - 1) }
              : { ice_votes: Math.max(0, currentValue - 1) })
            .eq('id', postId);
          return { action: 'removed', voteType };
        } else {
          await supabase.from('hot_take_votes').update({ vote_type: voteType }).eq('id', existingVote.id);
          const oldValue = existingVote.vote_type === 'up' 
            ? (currentPost?.fire_votes || 0) 
            : (currentPost?.ice_votes || 0);
          const newValue = voteType === 'up' 
            ? (currentPost?.fire_votes || 0) 
            : (currentPost?.ice_votes || 0);
          await supabase
            .from('social_posts')
            .update(existingVote.vote_type === 'up' 
              ? { fire_votes: Math.max(0, oldValue - 1) }
              : { ice_votes: Math.max(0, oldValue - 1) })
            .eq('id', postId);
          await supabase
            .from('social_posts')
            .update(voteType === 'up' 
              ? { fire_votes: newValue + 1 }
              : { ice_votes: newValue + 1 })
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
          ? (currentPost?.fire_votes || 0) 
          : (currentPost?.ice_votes || 0);
        await supabase
          .from('social_posts')
          .update(voteType === 'up' 
            ? { fire_votes: currentValue + 1 }
            : { ice_votes: currentValue + 1 })
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

  const allHotTakes = useMemo(() => {
    let filteredConsumed = consumedHotTakes;
    
    if (selectedCategory) {
      filteredConsumed = filteredConsumed.filter(t => t.media_type_category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredConsumed = filteredConsumed.filter(t => 
        t.content.toLowerCase().includes(query)
      );
    }
    
    return [...filteredConsumed, ...hotTakes];
  }, [hotTakes, selectedCategory, searchQuery]);

  const takesByCategory = useMemo(() => {
    const groups: Record<string, HotTake[]> = {};
    allHotTakes.forEach((take: HotTake) => {
      const category = take.media_type_category || 'Pop Culture';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(take);
    });
    return groups;
  }, [allHotTakes]);

  const hottestTake = useMemo(() => {
    if (allHotTakes.length === 0) return null;
    return [...allHotTakes].sort((a, b) => (b.heat_score || 0) - (a.heat_score || 0))[0];
  }, [allHotTakes]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading hot takes...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="mb-2">
            <h1 className="text-3xl font-semibold text-white" data-testid="hot-takes-title">
              Hot Takes
            </h1>
          </div>
          <p className="text-gray-400 text-left mb-6">
            Share your bold opinions and vote on the spiciest takes
          </p>

          {/* Search Row */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Search hot takes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 rounded-xl text-white placeholder:text-gray-400"
              data-testid="hot-takes-search-input"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <button
                onClick={() => setExpandedFilter(expandedFilter === 'topic' ? null : 'topic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-sm ${
                  selectedCategory
                    ? 'text-purple-300'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                data-testid="topic-filter-toggle"
              >
                <span>
                  Topic{selectedCategory ? `: ${categoryFilters.find(c => c.id === selectedCategory)?.label}` : ''}
                </span>
                <ChevronDown size={14} className={`transition-transform ${expandedFilter === 'topic' ? 'rotate-180' : ''}`} />
              </button>
              {expandedFilter === 'topic' && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg p-2 z-20 min-w-[160px]">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setExpandedFilter(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                      !selectedCategory
                        ? 'bg-purple-100 text-purple-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid="filter-all-topics"
                  >
                    All Topics
                  </button>
                  {categoryFilters.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setExpandedFilter(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      data-testid={`filter-${cat.id}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Post New Take Card */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-4">
            <textarea
              value={newTake}
              onChange={(e) => setNewTake(e.target.value)}
              placeholder="Drop your hottest take... 🔥"
              className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              data-testid="input-hot-take"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2 flex-wrap">
                {categoryFilters.slice(0, 4).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPostCategory(cat.id)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      postCategory === cat.id
                        ? 'bg-orange-100 text-orange-700 font-medium'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    data-testid={`post-category-${cat.id.toLowerCase()}`}
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
          </CardContent>
        </Card>

        {/* Hottest Take Highlight */}
        {hottestTake && hottestTake.heat_score && hottestTake.heat_score > 0 && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 mb-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-white/20 text-white text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider">
                🔥 Hottest Take
              </Badge>
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

        {/* Takes by Category */}
        {allHotTakes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="text-4xl mb-3">🔥</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Hot Takes Yet</h3>
            <p className="text-gray-500 text-sm">Be the first to share a bold opinion!</p>
          </div>
        ) : Object.keys(takesByCategory).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(takesByCategory).map(([category, takes]) => (
              <div key={category} className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{category}</h2>
                  <span className="text-sm text-gray-500">({takes.length})</span>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {takes.map((take) => (
                    <div key={take.id} className="flex-shrink-0 w-80">
                      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden h-full" data-testid={`hot-take-${take.id}`}>
                        <CardHeader className="pb-2 pt-4 px-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider ${
                                take.isConsumed 
                                  ? 'border-transparent bg-purple-600 text-white' 
                                  : 'border-gray-300 text-gray-500 bg-transparent'
                              }`}
                            >
                              {take.isConsumed ? 'CONSUMED' : 'User'}
                            </Badge>
                            <button
                              className="p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
                              data-testid={`invite-${take.id}`}
                            >
                              <UserPlus size={14} className="text-purple-600" />
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                              {take.user_avatar_url ? (
                                <img src={take.user_avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <User size={16} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 text-sm">
                                <span className="font-semibold text-gray-900 truncate">
                                  {take.user_display_name || take.user_username || 'Anonymous'}
                                </span>
                                <span className="text-gray-400 text-xs">
                                  · {formatDistanceToNow(new Date(take.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-800 text-sm mb-4 line-clamp-3">{take.content}</p>
                          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => voteMutation.mutate({ postId: take.id, voteType: 'up' })}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors text-sm ${
                                take.user_voted === 'up'
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'text-gray-500 hover:bg-gray-100'
                              }`}
                              data-testid={`vote-up-${take.id}`}
                            >
                              <Flame size={14} />
                              <span className="font-medium">{take.upvotes}</span>
                            </button>
                            <button
                              onClick={() => voteMutation.mutate({ postId: take.id, voteType: 'down' })}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors text-sm ${
                                take.user_voted === 'down'
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'text-gray-500 hover:bg-gray-100'
                              }`}
                              data-testid={`vote-down-${take.id}`}
                            >
                              <ThumbsDown size={14} />
                              <span className="font-medium">{take.downvotes}</span>
                            </button>
                            <button 
                              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
                              data-testid={`comments-${take.id}`}
                            >
                              <MessageCircle size={14} />
                              <span>{take.comments_count}</span>
                            </button>
                            <button 
                              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 ml-auto"
                              data-testid={`share-${take.id}`}
                            >
                              <Share2 size={14} />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <FeedbackFooter />
      <ConsumptionTracker isOpen={isTrackModalOpen} onClose={() => setIsTrackModalOpen(false)} />
    </div>
  );
}
