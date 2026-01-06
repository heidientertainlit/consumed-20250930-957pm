import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, MessageCircle, Heart, Share2, Search, User, Film, Tv, Music, Book, ChevronDown, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import FeedbackFooter from '@/components/feedback-footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface RecRequest {
  id: string;
  user_id: string;
  content: string;
  rec_category: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  user_display_name?: string;
  user_username?: string;
  user_avatar_url?: string;
}

export default function PlayAskRecsPage() {
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'topic' | null>(null);
  const [newRequest, setNewRequest] = useState('');
  const [requestCategory, setRequestCategory] = useState('Movies');

  const categoryFilters = [
    { id: 'Movies', label: 'Movies', icon: Film },
    { id: 'TV', label: 'TV Shows', icon: Tv },
    { id: 'Music', label: 'Music', icon: Music },
    { id: 'Books', label: 'Books', icon: Book },
  ];

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const { data: recRequests = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/ask-recs', selectedCategory, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          content,
          rec_category,
          created_at,
          likes_count,
          comments_count,
          users:user_id (
            display_name,
            user_name,
            avatar_url
          )
        `)
        .eq('post_type', 'ask_for_recs')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (selectedCategory) {
        query = query.eq('rec_category', selectedCategory);
      }

      if (searchQuery) {
        query = query.ilike('content', `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching rec requests:', error);
        return [];
      }

      return (data || []).map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        content: post.content,
        rec_category: post.rec_category || 'Movies',
        created_at: post.created_at,
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        user_display_name: post.users?.display_name,
        user_username: post.users?.user_name,
        user_avatar_url: post.users?.avatar_url,
      }));
    },
  });

  const submitRequestMutation = useMutation({
    mutationFn: async ({ content, category }: { content: string; category: string }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to post');
      }

      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          content: content,
          post_type: 'ask_for_recs',
          rec_category: category,
          media_type_category: category,
          is_hidden: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: '💡 Recommendation request posted!' });
      setNewRequest('');
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to post', description: error.message, variant: 'destructive' });
    }
  });

  const requestsByCategory = useMemo(() => {
    const groups: Record<string, RecRequest[]> = {};
    recRequests.forEach((request: RecRequest) => {
      const category = request.rec_category || 'Movies';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(request);
    });
    return groups;
  }, [recRequests]);

  const getCategoryIcon = (category: string) => {
    const cat = categoryFilters.find(c => c.id === category);
    return cat ? cat.icon : Film;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Movies': return 'bg-purple-100 text-purple-700';
      case 'TV': return 'bg-blue-100 text-blue-700';
      case 'Music': return 'bg-green-100 text-green-700';
      case 'Books': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading recommendations...</div>
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
            <h1 className="text-3xl font-semibold text-white flex items-center gap-2" data-testid="ask-recs-title">
              <Lightbulb className="text-yellow-500" size={28} />
              Ask for Recs
            </h1>
          </div>
          <p className="text-gray-400 text-left mb-6">
            Get personalized recommendations from the community
          </p>

          {/* Search Row */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 rounded-xl text-white placeholder:text-gray-400"
              data-testid="ask-recs-search-input"
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
                  {categoryFilters.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setExpandedFilter(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                          selectedCategory === cat.id
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        data-testid={`filter-${cat.id}`}
                      >
                        <Icon size={14} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Post New Request Card */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-4">
            <textarea
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              placeholder="What are you looking for? (e.g., 'Looking for a feel-good comedy to watch this weekend')"
              className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
              rows={3}
              data-testid="input-rec-request"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2 flex-wrap">
                {categoryFilters.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setRequestCategory(cat.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-colors ${
                        requestCategory === cat.id
                          ? getCategoryColor(cat.id) + ' font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      data-testid={`post-category-${cat.id.toLowerCase()}`}
                    >
                      <Icon size={12} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => newRequest.trim() && submitRequestMutation.mutate({ content: newRequest.trim(), category: requestCategory })}
                disabled={!newRequest.trim() || submitRequestMutation.isPending}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
                data-testid="button-post-request"
              >
                <Lightbulb size={16} className="mr-1" />
                Ask
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Requests by Category */}
        {recRequests.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="text-4xl mb-3">💡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Requests Yet</h3>
            <p className="text-gray-500 text-sm">Be the first to ask for a recommendation!</p>
          </div>
        ) : Object.keys(requestsByCategory).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(requestsByCategory).map(([category, requests]) => {
              const CategoryIcon = getCategoryIcon(category);
              return (
                <div key={category} className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CategoryIcon size={20} className="text-gray-600" />
                    <h2 className="text-xl font-bold text-gray-900">{category}</h2>
                    <span className="text-sm text-gray-500">({requests.length})</span>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {requests.map((request) => (
                      <div key={request.id} className="flex-shrink-0 w-80">
                        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden h-full" data-testid={`rec-request-${request.id}`}>
                          <CardHeader className="pb-2 pt-4 px-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={`${getCategoryColor(request.rec_category)} text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider`}>
                                {request.rec_category}
                              </Badge>
                              <button
                                className="p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
                                data-testid={`invite-${request.id}`}
                              >
                                <UserPlus size={14} className="text-purple-600" />
                              </button>
                            </div>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                {request.user_avatar_url ? (
                                  <img src={request.user_avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <User size={16} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 text-sm">
                                  <span className="font-semibold text-gray-900 truncate">
                                    {request.user_display_name || request.user_username || 'Anonymous'}
                                  </span>
                                  <span className="text-gray-400 text-xs">
                                    · {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-800 text-sm mb-4 line-clamp-3">{request.content}</p>
                            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                              <button 
                                className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors text-sm"
                                data-testid={`like-${request.id}`}
                              >
                                <Heart size={14} />
                                <span data-testid={`likes-count-${request.id}`}>{request.likes_count}</span>
                              </button>
                              <button 
                                className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors text-sm"
                                data-testid={`comments-${request.id}`}
                              >
                                <MessageCircle size={14} />
                                <span data-testid={`comments-count-${request.id}`}>{request.comments_count} recs</span>
                              </button>
                              <button 
                                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 ml-auto"
                                data-testid={`share-${request.id}`}
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
              );
            })}
          </div>
        ) : null}
      </div>

      <FeedbackFooter />
      <ConsumptionTracker isOpen={isTrackModalOpen} onClose={() => setIsTrackModalOpen(false)} />
    </div>
  );
}
