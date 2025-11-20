
import { useState } from "react";
import { ArrowLeft, Share, Star, Calendar, Clock, ExternalLink, Plus, Trash2, ChevronDown, List, Flame, Target, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { copyLink } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import RatingModal from "@/components/rating-modal";
import CreateListDialog from "@/components/create-list-dialog";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function MediaDetail() {
  const [, params] = useRoute("/media/:type/:source/:id");
  const [, setLocation] = useLocation();
  const { session, user } = useAuth();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShare = async () => {
    try {
      await copyLink({
        kind: 'media',
        obj: {
          type: params?.type,
          source: params?.source,
          id: params?.id
        }
      });
      toast({
        title: "Link copied!",
        description: "Share this media with your friends",
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({
        title: "Failed to copy link",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Fetch media details from edge function
  const { data: mediaItem, isLoading } = useQuery({
    queryKey: ['media-detail', params?.type, params?.source, params?.id],
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${params?.source}&external_id=${params?.id}&media_type=${params?.type}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) {
        console.error('Failed to fetch media details:', response.status, await response.text());
        throw new Error('Failed to fetch media details');
      }
      return response.json();
    },
    enabled: !!params?.source && !!params?.id && !!session?.access_token
  });

  // Fetch ALL social activity for this specific media
  const { data: socialActivity = [] } = useQuery({
    queryKey: ['media-social-activity', params?.source, params?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          post_type,
          rating,
          content,
          created_at,
          reply_count,
          reaction_count,
          prediction_pool_id,
          users:user_id (
            display_name,
            user_name
          ),
          prediction_pools:prediction_pool_id (
            id,
            game_type,
            question,
            description,
            options,
            total_participants
          )
        `)
        .eq('media_external_source', params?.source)
        .eq('media_external_id', params?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch social activity:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!params?.source && !!params?.id
  });

  // Separate reviews from other activity
  const reviews = socialActivity.filter((post: any) => post.rating);
  const hotTakes = socialActivity.filter((post: any) => post.post_type === 'hot_take');
  const predictions = socialActivity.filter((post: any) => post.prediction_pool_id && post.prediction_pools?.game_type === 'prediction');
  const polls = socialActivity.filter((post: any) => post.prediction_pool_id && post.prediction_pools?.game_type === 'poll');
  const conversations = socialActivity.filter((post: any) => !post.rating && post.post_type !== 'hot_take' && !post.prediction_pool_id);

  // Fetch user's lists (including custom lists)
  const { data: userListsData } = useQuery({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch lists');
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const customLists = userListsData?.lists?.filter((list: any) => list.isCustom) || [];

  // Delete review mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Delete using Supabase client directly
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id); // Ensure user can only delete their own posts

      if (error) {
        console.error('Delete error:', error);
        throw new Error('Failed to delete review');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['media-reviews'] });
      toast({
        title: "Review deleted",
        description: "Your review has been removed",
      });
    },
  });

  const handleDeleteReview = async (postId: string) => {
    if (confirm('Are you sure you want to delete this review?')) {
      await deleteReviewMutation.mutateAsync(postId);
    }
  };


  // Mutation for adding current media to lists
  const addMediaToListMutation = useMutation({
    mutationFn: async ({ listType, isCustom }: { listType: string; isCustom?: boolean }) => {
      if (!session?.access_token || !mediaItem) {
        throw new Error("Authentication required");
      }

      const endpoint = isCustom 
        ? "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-to-custom-list"
        : "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media";

      const body = isCustom
        ? {
            listId: listType,
            title: mediaItem.title,
            type: mediaItem.type || params?.type,
            creator: mediaItem.creator,
            image_url: mediaItem.artwork || mediaItem.image_url,
            media_type: mediaItem.type || params?.type,
          }
        : {
            media: {
              title: mediaItem.title,
              mediaType: mediaItem.type || params?.type,
              creator: mediaItem.creator,
              imageUrl: mediaItem.artwork || mediaItem.image_url,
              externalId: params?.id,
              externalSource: params?.source,
              description: mediaItem.description || null
            },
            rating: null,
            review: null,
            listType: listType
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to add media to list');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const listTitle = data.listTitle || 'list';
      toast({
        title: "Added to list!",
        description: `${mediaItem?.title} added to ${listTitle}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'], exact: true });
    },
    onError: (error) => {
      toast({
        title: "Failed to add to list",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMediaToList = (listType: string, isCustom: boolean = false) => {
    addMediaToListMutation.mutate({ listType, isCustom });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!mediaItem) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                setLocation('/');
              }
            }}
            className="mb-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            data-testid="button-back"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </Button>

          <div className="max-w-md mx-auto mt-16">
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="text-purple-600" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Media Not Available
              </h2>
              <p className="text-gray-600 mb-6">
                We couldn't find detailed information for this item. It might be unavailable or not yet in our database.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setLocation('/track')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-browse-media"
                >
                  Browse Your Media
                </Button>
                <Button
                  onClick={() => window.history.back()}
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-100"
                  data-testid="button-go-back"
                >
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use fetched data or fallback to mock data structure
  const mediaData = mediaItem || {
    id: "spotify_0Yzd0g8NYmn27k2HFNplv7",
    title: "SmartLess",
    creator: "Jason Bateman, Sean Hayes, Will Arnett",
    type: "Podcast",
    provider: "Spotify",
    artwork: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop",
    description: "Jason Bateman, Sean Hayes, and Will Arnett invite their favorite people for uninformed conversations.",
    rating: 4.8,
    totalEpisodes: 245,
    subscribers: "2.1M",
    category: "Comedy",
    language: "English",
    releaseDate: "2020-07-20",
    lastEpisode: "2024-01-15",
    averageLength: "45 min"
  };

  // Find user's own rating
  const userReview = reviews.find((review: any) => review.user_id === user?.id);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              setLocation('/');
            }
          }}
          className="mb-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          data-testid="button-back"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Media Header */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                  <img 
                    src={mediaItem.artwork} 
                    alt={mediaItem.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{mediaData.title}</h1>
                    <p className="text-lg text-gray-600 mb-4">by {mediaData.creator}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="font-medium">{mediaItem.rating}</span>
                        <span className="text-xs text-gray-500 ml-1">avg</span>
                      </div>
                      {userReview?.rating && (
                        <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-md">
                          <Star className="w-4 h-4 text-purple-600 fill-current" />
                          <span className="font-semibold text-purple-700">{userReview.rating}</span>
                          <span className="text-xs text-purple-600 ml-1">your rating</span>
                        </div>
                      )}
                      {mediaItem.type === 'Movie' && mediaItem.releaseDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(mediaItem.releaseDate).getFullYear()}</span>
                        </div>
                      )}
                      {(mediaItem.type === 'TV Show' || mediaItem.type === 'Podcast') && mediaItem.totalEpisodes > 1 && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{mediaItem.totalEpisodes} episodes</span>
                        </div>
                      )}
                      {mediaItem.averageLength && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>~{mediaItem.averageLength}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {session && (
                      <>
                        <div className="flex">
                          <Button 
                            variant="outline"
                            onClick={() => handleAddMediaToList('queue')}
                            disabled={addMediaToListMutation.isPending}
                            className="rounded-r-none border-r-0"
                            data-testid="button-quick-add"
                          >
                            <Plus size={16} className="mr-2" />
                            {addMediaToListMutation.isPending ? "Adding..." : "Quick Add"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="rounded-l-none px-2"
                                disabled={addMediaToListMutation.isPending}
                                data-testid="button-add-list-dropdown"
                              >
                                <ChevronDown size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem
                                onClick={() => handleAddMediaToList('currently')}
                                className="cursor-pointer"
                                disabled={addMediaToListMutation.isPending}
                              >
                                Currently
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAddMediaToList('queue')}
                                className="cursor-pointer"
                                disabled={addMediaToListMutation.isPending}
                              >
                                Queue
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAddMediaToList('finished')}
                                className="cursor-pointer"
                                disabled={addMediaToListMutation.isPending}
                              >
                                Finished
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAddMediaToList('dnf')}
                                className="cursor-pointer"
                                disabled={addMediaToListMutation.isPending}
                              >
                                Did Not Finish
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAddMediaToList('favorites')}
                                className="cursor-pointer"
                                disabled={addMediaToListMutation.isPending}
                              >
                                Favorites
                              </DropdownMenuItem>
                              
                              {/* Custom Lists */}
                              {customLists.length > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold">
                                    MY CUSTOM LISTS
                                  </div>
                                  {customLists.map((list: any) => (
                                    <DropdownMenuItem
                                      key={list.id}
                                      onClick={() => handleAddMediaToList(list.id, true)}
                                      className="cursor-pointer pl-4"
                                      disabled={addMediaToListMutation.isPending}
                                    >
                                      <List className="text-purple-600 mr-2 h-4 w-4" />
                                      {list.title}
                                    </DropdownMenuItem>
                                  ))}
                                </>
                              )}
                              
                              {/* Create New List */}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setShowCreateListDialog(true)}
                                className="cursor-pointer text-purple-400 hover:text-purple-300 pl-4"
                                disabled={addMediaToListMutation.isPending}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create New List
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowRatingModal(true)}
                          data-testid="button-add-rating"
                        >
                          <Star size={16} className="mr-2" />
                          {userReview?.rating ? "Update My Rating" : "Add My Rating"}
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline"
                      onClick={handleShare}
                      data-testid="button-share"
                    >
                      <Share size={16} className="mr-2" />
                      Share
                    </Button>
                  </div>

                  {/* Find On Platforms */}
                  {mediaItem.platforms && mediaItem.platforms.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        {mediaItem.type === 'Movie' || mediaItem.type === 'TV Show' 
                          ? 'Watch On' 
                          : mediaItem.type === 'Podcast' || mediaItem.type === 'Music' 
                          ? 'Listen On' 
                          : mediaItem.type === 'Book' 
                          ? 'Read On' 
                          : 'Find On'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {mediaItem.platforms.map((platform: any, index: number) => (
                          platform.url ? (
                            <a
                              key={index}
                              href={platform.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                              data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {platform.logo && (
                                <img 
                                  src={platform.logo} 
                                  alt={platform.name}
                                  className="w-4 h-4 object-contain"
                                />
                              )}
                              <span className="font-medium text-gray-700">{platform.name}</span>
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </a>
                          ) : (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm"
                              data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {platform.logo && (
                                <img 
                                  src={platform.logo} 
                                  alt={platform.name}
                                  className="w-4 h-4 object-contain"
                                />
                              )}
                              <span className="font-medium text-gray-700">{platform.name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
              <p className="text-gray-700 leading-relaxed mb-6">{mediaItem.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Category</span>
                  <p className="font-medium text-gray-900">{mediaItem.category}</p>
                </div>
                <div>
                  <span className="text-gray-500">Language</span>
                  <p className="font-medium text-gray-900">{mediaItem.language}</p>
                </div>
                {mediaItem.type === 'Movie' && mediaItem.releaseDate && (
                  <div>
                    <span className="text-gray-500">Release Year</span>
                    <p className="font-medium text-gray-900">{new Date(mediaItem.releaseDate).getFullYear()}</p>
                  </div>
                )}
                {(mediaItem.type === 'TV Show' || mediaItem.type === 'Podcast') && mediaItem.releaseDate && (
                  <div>
                    <span className="text-gray-500">Started</span>
                    <p className="font-medium text-gray-900">
                      {new Date(mediaItem.releaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {mediaItem.runtime && (
                  <div>
                    <span className="text-gray-500">Runtime</span>
                    <p className="font-medium text-gray-900">{mediaItem.runtime} min</p>
                  </div>
                )}
              </div>
            </div>

            {/* Social Activity Summary */}
            {socialActivity.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Community Activity
                </h2>
                <div className="flex flex-wrap gap-4 text-sm">
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold text-gray-900">{reviews.length}</span>
                      <span className="text-gray-600">Reviews</span>
                    </div>
                  )}
                  {hotTakes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold text-gray-900">{hotTakes.length}</span>
                      <span className="text-gray-600">Hot Takes</span>
                    </div>
                  )}
                  {predictions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-500" />
                      <span className="font-semibold text-gray-900">{predictions.length}</span>
                      <span className="text-gray-600">Predictions</span>
                    </div>
                  )}
                  {polls.length > 0 && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-gray-900">{polls.length}</span>
                      <span className="text-gray-600">Polls</span>
                    </div>
                  )}
                  {conversations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold text-gray-900">{conversations.length}</span>
                      <span className="text-gray-600">Posts</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hot Takes */}
            {hotTakes.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Hot Takes ({hotTakes.length})
                </h2>
                <div className="space-y-4">
                  {hotTakes.map((take: any) => (
                    <div key={take.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-orange-600 text-sm font-medium">
                            {take.users?.display_name?.[0]?.toUpperCase() || take.users?.user_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {take.users?.display_name || take.users?.user_name || 'Anonymous'}
                          </p>
                          <p className="text-gray-700 text-sm leading-relaxed mt-1">{take.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{take.reaction_count || 0} upvotes</span>
                            <span>{take.reply_count || 0} replies</span>
                            <span>{new Date(take.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Predictions */}
            {predictions.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Predictions ({predictions.length})
                </h2>
                <div className="space-y-4">
                  {predictions.map((pred: any) => (
                    <div key={pred.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-600 text-sm font-medium">
                            {pred.users?.display_name?.[0]?.toUpperCase() || pred.users?.user_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">
                            {pred.prediction_pools?.question}
                          </p>
                          <p className="text-sm text-gray-600">
                            {pred.prediction_pools?.total_participants || 0} participants
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Polls */}
            {polls.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  Polls ({polls.length})
                </h2>
                <div className="space-y-4">
                  {polls.map((poll: any) => (
                    <div key={poll.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 text-sm font-medium">
                            {poll.users?.display_name?.[0]?.toUpperCase() || poll.users?.user_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">
                            {poll.prediction_pools?.question}
                          </p>
                          <p className="text-sm text-gray-600">
                            {poll.prediction_pools?.total_participants || 0} votes
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews & Ratings */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Reviews & Ratings ({reviews.length})
                </h2>
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-purple-600 text-sm font-medium">
                              {review.users?.display_name?.[0]?.toUpperCase() || review.users?.user_name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {review.users?.display_name || review.users?.user_name || 'Anonymous'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(review.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {review.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              <span className="font-medium text-gray-900">{review.rating}</span>
                            </div>
                          )}
                          {user?.id === review.user_id && (
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              data-testid={`button-delete-review-${review.id}`}
                              title="Delete review"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-gray-700 text-sm leading-relaxed">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Posts/Conversations */}
            {conversations.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-gray-500" />
                  Conversations ({conversations.length})
                </h2>
                <div className="space-y-4">
                  {conversations.map((post: any) => (
                    <div key={post.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 text-sm font-medium">
                            {post.users?.display_name?.[0]?.toUpperCase() || post.users?.user_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {post.users?.display_name || post.users?.user_name || 'Anonymous'}
                          </p>
                          <p className="text-gray-700 text-sm leading-relaxed mt-1">{post.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{post.reply_count || 0} replies</span>
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sidebar placeholder - can add future content here */}
          </div>
        </div>
      </div>
      
      <RatingModal 
        isOpen={showRatingModal} 
        onClose={() => setShowRatingModal(false)}
        mediaTitle={mediaItem?.title || mediaData.title}
        mediaType={mediaItem?.type || mediaData.type}
        mediaCreator={mediaItem?.creator || mediaData.creator}
        mediaImage={mediaItem?.artwork || mediaData.artwork}
        mediaExternalId={params?.id}
        mediaExternalSource={params?.source}
      />
      
      <CreateListDialog 
        isOpen={showCreateListDialog} 
        onClose={() => setShowCreateListDialog(false)}
        onListCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
        }}
      />
    </div>
  );
}
