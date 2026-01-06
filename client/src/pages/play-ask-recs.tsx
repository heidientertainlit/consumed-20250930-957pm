import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, MessageCircle, Heart, Share2, Search, User, Film, Tv, Music, Book } from 'lucide-react';
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
  responses?: Array<{
    id: string;
    content: string;
    user_display_name: string;
    user_username: string;
  }>;
}

export default function PlayAskRecsPage() {
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
            username,
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
        user_username: post.users?.username,
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-black mb-2 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <Lightbulb className="text-yellow-500" size={28} />
            Ask for Recs
          </h1>
          <p className="text-base text-gray-600">
            Get personalized recommendations from the community
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <textarea
            value={newRequest}
            onChange={(e) => setNewRequest(e.target.value)}
            placeholder="What are you looking for? (e.g., 'Looking for a feel-good comedy to watch this weekend')"
            className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
            rows={3}
            data-testid="input-rec-request"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-2">
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
                    data-testid={`category-${cat.id.toLowerCase()}`}
                  >
                    <Icon size={14} />
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
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requests..."
              className="pl-10 bg-white"
              data-testid="input-search-recs"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-purple-600 text-white font-medium'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
            data-testid="filter-all"
          >
            All
          </button>
          {categoryFilters.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`flex items-center gap-1 px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white font-medium'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
                data-testid={`filter-${cat.id.toLowerCase()}`}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : recRequests.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="text-4xl mb-3">💡</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Requests Yet</h3>
            <p className="text-gray-500 text-sm">Be the first to ask for a recommendation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recRequests.map((request) => {
              const CategoryIcon = getCategoryIcon(request.rec_category);
              return (
                <Card key={request.id} className="bg-white border-gray-100" data-testid={`rec-request-${request.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-semibold">
                        {request.user_avatar_url ? (
                          <img src={request.user_avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {request.user_display_name || request.user_username || 'Anonymous'}
                          </span>
                          <span className="text-gray-400 text-sm">
                            @{request.user_username || 'user'}
                          </span>
                          <Badge className={`${getCategoryColor(request.rec_category)} text-xs`}>
                            <CategoryIcon size={12} className="mr-1" />
                            {request.rec_category}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                        <p className="text-gray-800 mb-3">{request.content}</p>
                        <div className="flex items-center gap-4">
                          <button 
                            className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors"
                            data-testid={`like-${request.id}`}
                          >
                            <Heart size={16} />
                            <span className="text-sm" data-testid={`likes-count-${request.id}`}>{request.likes_count}</span>
                          </button>
                          <button 
                            className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors"
                            data-testid={`comments-${request.id}`}
                          >
                            <MessageCircle size={16} />
                            <span className="text-sm" data-testid={`comments-count-${request.id}`}>{request.comments_count} recs</span>
                          </button>
                          <button 
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 ml-auto"
                            data-testid={`share-${request.id}`}
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <FeedbackFooter />
      <ConsumptionTracker isOpen={isTrackModalOpen} onClose={() => setIsTrackModalOpen(false)} />
    </div>
  );
}
