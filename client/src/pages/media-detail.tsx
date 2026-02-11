
import { useState, useEffect } from "react";
import { ArrowLeft, Share, Star, Calendar, Clock, ExternalLink, Plus, Trash2, ChevronDown, List, Target, MessageCircle, Heart, Send, Sparkles, Film, Tv, BookOpen, Music, Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { copyLink } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import RatingModal from "@/components/rating-modal";
import CreateListDialog from "@/components/create-list-dialog";
import { QuickAddModal } from "@/components/quick-add-modal";
import { QuickActionSheet } from "@/components/quick-action-sheet";

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
  const [matchStandard, paramsStandard] = useRoute("/media/:type/:source/:id");
  const [matchPrefixed, paramsPrefixed] = useRoute("/media/:type/:source/:prefix/:id");
  const [, setLocation] = useLocation();
  
  // Combine params - for Open Library, the ID includes the prefix (e.g., "works/OL123")
  const params = matchPrefixed && paramsPrefixed ? {
    type: paramsPrefixed.type,
    source: paramsPrefixed.source,
    id: `${paramsPrefixed.prefix}/${paramsPrefixed.id}`
  } : paramsStandard;
  const { session, user } = useAuth();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [composeType, setComposeType] = useState<'thought' | 'hot_take' | 'ask' | 'poll' | 'rank'>('thought');
  const [composeText, setComposeText] = useState('');
  const [composeRating, setComposeRating] = useState(0);
  const [composeSelectedList, setComposeSelectedList] = useState<{ name: string; isCustom: boolean; id?: string } | null>(null);
  const [isComposePosting, setIsComposePosting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params?.id, params?.type, params?.source]);

  // Fetch comments for a post
  const fetchComments = async (postId: string) => {
    if (expandedComments[postId]) {
      // Already loaded, just toggle visibility
      return;
    }
    setLoadingComments(prev => new Set(prev).add(postId));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments?post_id=${postId}&include=meta`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setExpandedComments(prev => ({ ...prev, [postId]: data.comments || data || [] }));
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedComments[postId]) {
      // Hide comments
      setExpandedComments(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      setReplyingTo(null);
    } else {
      // Show comments and fetch them
      fetchComments(postId);
      setReplyingTo(postId);
    }
  };

  // Like mutation - uses social-feed-like edge function
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: postId })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        // If already liked, try to unlike
        if (data.error === 'Already liked') {
          const unlikeResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-like`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ post_id: postId })
            }
          );
          if (!unlikeResponse.ok) throw new Error('Failed to unlike');
          return { liked: false };
        }
        throw new Error(data.error || 'Failed to like');
      }
      return { liked: true };
    },
    onSuccess: (data, postId) => {
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (data.liked) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ['media-detail'] });
    }
  });

  // Reply mutation - uses social-feed-comments edge function
  const replyMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: postId, content })
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add reply');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      setReplyContent("");
      // Refetch comments for this post
      setExpandedComments(prev => {
        const newState = { ...prev };
        delete newState[variables.postId];
        return newState;
      });
      fetchComments(variables.postId);
      queryClient.invalidateQueries({ queryKey: ['media-detail'] });
      toast({ title: "Reply posted!" });
    }
  });

  const handleLike = (postId: string) => {
    if (!session?.access_token) {
      toast({ title: "Please sign in to like posts", variant: "destructive" });
      return;
    }
    likeMutation.mutate(postId);
  };

  const handleReply = (postId: string) => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({ postId, content: replyContent });
  };

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/delete-comment`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ comment_id: commentId })
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete comment');
      }
      return { postId };
    },
    onSuccess: (data) => {
      // Refetch comments for this post
      setExpandedComments(prev => {
        const newState = { ...prev };
        delete newState[data.postId];
        return newState;
      });
      fetchComments(data.postId);
      toast({ title: "Comment deleted" });
    }
  });

  const handleDeleteComment = (commentId: string, postId: string) => {
    deleteCommentMutation.mutate({ commentId, postId });
  };

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

  // Fetch media details from edge function with fallback to cached data
  const { data: mediaItem, isLoading } = useQuery({
    queryKey: ['media-detail', params?.type, params?.source, params?.id],
    queryFn: async () => {
      // First try the main API
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${params?.source}&external_id=${params?.id}&media_type=${params?.type}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.ok) {
        return response.json();
      }
      
      // Fallback: Try to get cached info from list_items table
      console.log('API failed, trying fallback from cached media data...');
      const { data: cachedMedia } = await supabase
        .from('list_items')
        .select('title, media_type, creator, image_url, external_id, external_source')
        .eq('external_id', params?.id)
        .eq('external_source', params?.source)
        .limit(1)
        .single();
      
      if (cachedMedia) {
        return {
          title: cachedMedia.title,
          media_type: cachedMedia.media_type || params?.type,
          creator: cachedMedia.creator,
          image_url: cachedMedia.image_url,
          external_id: cachedMedia.external_id,
          external_source: cachedMedia.external_source,
          fromCache: true
        };
      }
      
      // Second fallback: Try to get info from social_posts
      const { data: postMedia } = await supabase
        .from('social_posts')
        .select('media_title, media_type, media_creator, image_url, media_external_id, media_external_source')
        .eq('media_external_id', params?.id)
        .eq('media_external_source', params?.source)
        .not('media_title', 'is', null)
        .limit(1)
        .single();
      
      if (postMedia) {
        return {
          title: postMedia.media_title,
          media_type: postMedia.media_type || params?.type,
          creator: postMedia.media_creator,
          image_url: postMedia.image_url,
          external_id: postMedia.media_external_id,
          external_source: postMedia.media_external_source,
          fromCache: true
        };
      }
      
      console.error('Failed to fetch media details and no cached data found');
      throw new Error('Media not found');
    },
    enabled: !!params?.source && !!params?.id && !!session?.access_token,
    retry: false
  });

  // Fetch user's own rating from media_ratings table (includes private ratings)
  const { data: userRating } = useQuery({
    queryKey: ['user-media-rating', params?.source, params?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_ratings')
        .select('rating, created_at')
        .eq('media_external_id', params?.id)
        .eq('media_external_source', params?.source)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch user rating:', error);
        return null;
      }
      return data;
    },
    enabled: !!params?.source && !!params?.id && !!user?.id
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
          likes_count,
          comments_count,
          prediction_pool_id,
          users!social_posts_user_id_fkey (
            display_name,
            user_name
          )
        `)
        .eq('media_external_source', params?.source)
        .eq('media_external_id', params?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch social activity:', error);
        return [];
      }

      // Fetch prediction pool details separately for posts that have them
      const postsWithPools = data?.filter(p => p.prediction_pool_id) || [];
      if (postsWithPools.length > 0) {
        const poolIds = postsWithPools.map(p => p.prediction_pool_id);
        const { data: pools } = await supabase
          .from('prediction_pools')
          .select('id, game_type, question, description, options, total_participants')
          .in('id', poolIds);

        // Attach pool data to posts
        if (pools) {
          const poolMap = new Map(pools.map(p => [p.id, p]));
          data?.forEach((post: any) => {
            if (post.prediction_pool_id) {
              post.prediction_pools = poolMap.get(post.prediction_pool_id);
            }
          });
        }
      }

      return data || [];
    },
    enabled: !!params?.source && !!params?.id
  });

  // Separate reviews from other activity
  const reviews = socialActivity.filter((post: any) => post.rating);
  const predictions = socialActivity.filter((post: any) => post.prediction_pool_id && post.prediction_pools?.game_type === 'prediction');
  const polls = socialActivity.filter((post: any) => post.prediction_pool_id && post.prediction_pools?.game_type === 'poll');
  const conversations = socialActivity.filter((post: any) => !post.rating && !post.prediction_pool_id && post.content && post.content.trim());

  // Fetch similar media across different types using AI
  const { data: similarMedia = [], isLoading: isSimilarLoading } = useQuery({
    queryKey: ['similar-media', mediaItem?.title, mediaItem?.type],
    queryFn: async () => {
      if (!session?.access_token || !mediaItem?.title) return [];
      
      const mediaType = mediaItem.type || mediaItem.media_type || params?.type;
      const prompt = `Find me media similar to "${mediaItem.title}" (${mediaType}). Include: other ${mediaType === 'TV Show' ? 'TV shows' : mediaType === 'Movie' ? 'movies' : mediaType?.toLowerCase() + 's'} like it, soundtrack music, books it's based on or similar books, related podcasts, and any connected media. Mix of types please.`;
      
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/conversational-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: prompt })
      });
      
      if (!response.ok) return [];
      const result = await response.json();
      
      // Extract recommendations from AI response (may be in recommendations or results)
      const recs = result.recommendations || result.results || [];
      const limitedRecs = recs.slice(0, 6);
      
      // Enrich each recommendation with poster images by searching media-search
      const enrichedRecs = await Promise.all(
        limitedRecs.map(async (item: any) => {
          const searchQuery = item.title + (item.year ? ` ${item.year}` : '');
          try {
            const searchResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ query: searchQuery, limit: 1 })
            });
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const match = searchData.results?.[0];
              if (match) {
                return {
                  title: match.title || item.title,
                  type: match.type || item.type || item.media_type,
                  poster_url: match.poster_url || match.image_url,
                  year: match.year || item.year,
                  external_id: match.external_id || match.id,
                  external_source: match.external_source || match.source,
                };
              }
            }
          } catch (e) {
            console.error('Failed to enrich recommendation:', e);
          }
          
          // Fallback to original data
          return {
            title: item.title,
            type: item.type || item.media_type,
            poster_url: item.poster_url || item.poster || item.image_url,
            year: item.year,
            external_id: item.external_id || item.id,
            external_source: item.external_source || item.source,
          };
        })
      );
      
      return enrichedRecs;
    },
    enabled: !!session?.access_token && !!mediaItem?.title,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

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

  // Query to find which lists contain this media item
  const { data: listsContainingMedia = [] } = useQuery({
    queryKey: ['lists-containing-media', params?.source, params?.id],
    queryFn: async () => {
      if (!user?.id || !params?.id || !params?.source) return [];
      
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id,
          list_id,
          title,
          lists!inner (
            id,
            title,
            is_system
          )
        `)
        .eq('external_id', params.id)
        .eq('external_source', params.source)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching lists containing media:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id && !!params?.id && !!params?.source,
  });

  // Delete list item mutation
  const deleteListItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/delete-list-item", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to remove item: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['lists-containing-media', params?.source, params?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      toast({
        title: "Removed from list",
        description: "Item has been removed from your list",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveFromList = (itemId: string, listTitle: string) => {
    if (confirm(`Remove from "${listTitle}"?`)) {
      deleteListItemMutation.mutate(itemId);
    }
  };

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
            image_url: resolvedImageUrl,
            media_type: mediaItem.type || params?.type,
          }
        : {
            media: {
              title: mediaItem.title,
              mediaType: mediaItem.type || params?.type,
              creator: mediaItem.creator,
              imageUrl: resolvedImageUrl,
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
    onSuccess: () => {
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

  const handleComposePost = async () => {
    if (!session?.access_token || !mediaItem) return;
    if (!composeText.trim() && !composeRating && !composeSelectedList) return;
    setIsComposePosting(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      if (composeText.trim()) {
        await supabase.from('social_posts').insert({
          user_id: authUser.id,
          content: composeText,
          post_type: composeType,
          visibility: 'public',
          media_title: mediaItem.title,
          media_type: (mediaItem.type || params?.type || 'movie').toLowerCase(),
          media_external_id: params?.id,
          media_external_source: params?.source || 'tmdb',
          image_url: resolvedImageUrl || '',
          fire_votes: 0,
          ice_votes: 0,
        });
      }

      if (composeRating > 0) {
        const rateResponse = await fetch(
          "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/rate-media",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              media: {
                title: mediaItem.title,
                mediaType: mediaItem.type || params?.type,
                creator: mediaItem.creator,
                imageUrl: resolvedImageUrl,
                externalId: params?.id,
                externalSource: params?.source,
              },
              rating: composeRating,
              review: composeText.trim() || null,
            }),
          }
        );
        if (!rateResponse.ok) console.error('Rating failed');
      }

      if (composeSelectedList) {
        addMediaToListMutation.mutate({ 
          listType: composeSelectedList.isCustom ? composeSelectedList.id! : composeSelectedList.name, 
          isCustom: composeSelectedList.isCustom 
        });
      }

      setComposeText('');
      setComposeRating(0);
      setComposeSelectedList(null);
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['media-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      toast({ title: "Posted!", description: "Your post has been shared." });
    } catch (error) {
      console.error('Compose post error:', error);
      toast({ title: "Couldn't post", description: "Please try again.", variant: "destructive" });
    }
    setIsComposePosting(false);
  };

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
              // Use wouter navigation for reliable routing - fallback to activity feed
              setLocation('/');
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
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-100"
                  data-testid="button-go-back"
                >
                  Go to Feed
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use fetched data or fallback to mock data structure
  const getBooksCoverUrl = (id: string) => `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1`;
  const getOpenLibraryCoverUrl = (id: string) => {
    const cleanId = id.replace(/^works\//, '');
    return `https://covers.openlibrary.org/b/olid/${cleanId}-L.jpg`;
  };
  const resolvedImageUrl = (() => {
    const src = params?.source || mediaItem?.external_source;
    const eid = params?.id || mediaItem?.external_id;
    if (src === 'googlebooks' && eid) {
      return getBooksCoverUrl(eid);
    }
    if ((src === 'openlibrary' || src === 'open_library') && eid) {
      return getOpenLibraryCoverUrl(eid);
    }
    const img = mediaItem?.artwork || mediaItem?.image_url || mediaItem?.poster_url || '';
    return img;
  })();

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

      <div className="max-w-6xl mx-auto px-4 pt-2 pb-8">
        {/* Compact Hero Header */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          {/* Back button inline with content */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mb-3 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-8"
            data-testid="button-back"
          >
            <ArrowLeft size={18} className="text-gray-600" />
            <span className="ml-1 text-sm">Back</span>
          </Button>

          {/* Side-by-side layout on all screen sizes */}
          <div className="flex gap-4">
            {/* Poster - smaller and fixed width */}
            <div className="w-28 h-40 md:w-36 md:h-52 rounded-xl overflow-hidden shadow-md flex-shrink-0">
              <img 
                src={resolvedImageUrl} 
                alt={mediaItem.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Info column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight mb-1">{mediaData.title}</h1>
                <button
                  onClick={handleShare}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                  data-testid="button-share"
                >
                  <Share size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-2 truncate">by {mediaData.creator}</p>
              
              {/* Compact metadata chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full">
                  <Star className="w-3 h-3 text-yellow-500 fill-current" />
                  <span className="font-medium">{mediaItem.rating}</span>
                  <span className="text-gray-500">avg</span>
                </div>
                {(userRating?.rating || userReview?.rating) && (
                  <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 text-purple-600 fill-current" />
                    <span className="font-semibold text-purple-700">{userRating?.rating || userReview?.rating}</span>
                    <span className="text-purple-500">you</span>
                  </div>
                )}
                {mediaItem.type === 'Movie' && mediaItem.releaseDate && (
                  <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(mediaItem.releaseDate).getFullYear()}</span>
                  </div>
                )}
                {(mediaItem.type === 'TV Show' || mediaItem.type === 'Podcast') && mediaItem.totalEpisodes > 1 && (
                  <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    <span>{mediaItem.totalEpisodes} eps</span>
                  </div>
                )}
                {mediaItem.averageLength && (
                  <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    <span>~{mediaItem.averageLength}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons - below poster, full width row */}
          {session && (
            <div className="flex gap-2 mt-4">
              <Button 
                size="sm"
                onClick={() => setIsActionSheetOpen(true)}
                className="bg-gradient-to-r from-purple-700 via-purple-500 to-purple-400 hover:from-purple-800 hover:via-purple-600 hover:to-purple-500 text-white text-xs h-9 rounded-full px-5 shadow-md"
                data-testid="button-quick-add"
              >
                <Plus size={14} className="mr-1" />
                Add
              </Button>
              <Button 
                size="sm"
                onClick={() => setShowRatingModal(true)}
                className="bg-gradient-to-r from-purple-700 via-purple-500 to-purple-400 hover:from-purple-800 hover:via-purple-600 hover:to-purple-500 text-white text-xs h-9 rounded-full px-5 shadow-md"
                data-testid="button-add-rating"
              >
                <Star size={14} className="mr-1" />
                Rate
              </Button>
            </div>
          )}

          {/* Find On Platforms - compact inline */}
          {mediaItem.platforms && mediaItem.platforms.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <h3 className="text-xs font-medium text-gray-500 mb-2">
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
                      className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-xs"
                      data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {platform.logo && (
                        <img 
                          src={platform.logo} 
                          alt={platform.name}
                          className="w-3 h-3 object-contain"
                        />
                      )}
                      <span className="font-medium text-gray-700">{platform.name}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-gray-400" />
                    </a>
                  ) : (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg text-xs"
                      data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {platform.logo && (
                        <img 
                          src={platform.logo} 
                          alt={platform.name}
                          className="w-3 h-3 object-contain"
                        />
                      )}
                      <span className="font-medium text-gray-700">{platform.name}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* About - expandable section */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowAbout(!showAbout)}
              className="flex items-center justify-between w-full text-left"
              data-testid="button-toggle-about"
            >
              <span className="text-base font-semibold text-gray-900">About</span>
              <ChevronDown 
                size={18} 
                className={`text-gray-400 transition-transform ${showAbout ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {showAbout && (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">{mediaItem.description}</p>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Category</span>
                    <p className="font-medium text-gray-700">{mediaItem.category}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Language</span>
                    <p className="font-medium text-gray-700">{mediaItem.language}</p>
                  </div>
                  {mediaItem.type === 'Movie' && mediaItem.releaseDate && (
                    <div>
                      <span className="text-gray-400">Release Year</span>
                      <p className="font-medium text-gray-700">{new Date(mediaItem.releaseDate).getFullYear()}</p>
                    </div>
                  )}
                  {(mediaItem.type === 'TV Show' || mediaItem.type === 'Podcast') && mediaItem.releaseDate && (
                    <div>
                      <span className="text-gray-400">Started</span>
                      <p className="font-medium text-gray-700">
                        {new Date(mediaItem.releaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {mediaItem.runtime && (
                    <div>
                      <span className="text-gray-400">Runtime</span>
                      <p className="font-medium text-gray-700">{mediaItem.runtime} min</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Say something - inline compose */}
          {session && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-3">Say something</h3>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-3 mb-3 p-2 bg-white rounded-xl border border-gray-100">
                <img 
                  src={resolvedImageUrl} 
                  alt={mediaItem.title}
                  className="w-10 h-14 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium text-sm truncate">{mediaItem.title}</p>
                  <p className="text-gray-500 text-xs capitalize">{mediaItem.type || params?.type}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {(['thought', 'hot_take'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setComposeType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      composeType === type
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    {type === 'thought' ? 'Thought' : 'Hot Take'}
                  </button>
                ))}
              </div>

              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder={composeType === 'hot_take' ? "What's your hot take?" : composeType === 'ask' ? "What do you want to know?" : "What's on your mind?"}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-purple-400 resize-none mb-3"
                rows={3}
              />

              <div className="flex items-center gap-1 mb-3">
                <span className="text-sm text-gray-600 mr-1">Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setComposeRating(composeRating === star ? 0 : star)}
                    className="p-0.5"
                  >
                    <Star
                      size={22}
                      className={`${star <= composeRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} transition-colors`}
                    />
                  </button>
                ))}
              </div>

              <Button
                onClick={handleComposePost}
                disabled={isComposePosting || (!composeText.trim() && !composeRating)}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-xl py-5 text-sm font-semibold"
              >
                {isComposePosting ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Posting...</>
                ) : (
                  'Post'
                )}
              </Button>
            </div>
          </div>
          )}

          {/* Reviews & Ratings - stacked collapsible */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowReviews(!showReviews)}
              className="flex items-center justify-between w-full text-left"
              data-testid="button-toggle-reviews"
            >
              <span className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                Reviews & Ratings {reviews.length > 0 && `(${reviews.length})`}
              </span>
              <ChevronDown 
                size={18} 
                className={`text-gray-400 transition-transform ${showReviews ? 'rotate-180' : ''}`} 
              />
            </button>
            {showReviews && (
              <>
                {/* Your Rating - always show at top if user has rated */}
                {(userReview || userRating) && (
                  <div className="bg-purple-50 rounded-xl p-4 mt-3 border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-purple-700">Your Rating</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="font-bold text-gray-900">{userReview?.rating || userRating?.rating}</span>
                      </div>
                    </div>
                    {/* Show user's review if they have one */}
                    {userReview?.content && (
                      <p className="text-gray-700 text-sm leading-relaxed mt-2">{userReview.content}</p>
                    )}
                    <p className="text-xs text-purple-500 mt-2">
                      Rated on {new Date(userReview?.created_at || userRating?.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                )}

                {/* Other Reviews */}
                {reviews.filter((r: any) => r.user_id !== user?.id).length > 0 ? (
              <div className="space-y-4 mt-3">
                  {reviews.filter((r: any) => r.user_id !== user?.id).map((review: any) => (
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
                              {review.users?.user_name || review.users?.display_name || 'Anonymous'}
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
                      {/* Like and Reply Actions */}
                      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-50">
                        <button
                          onClick={() => handleLike(review.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            likedPosts.has(review.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                          }`}
                          data-testid={`button-like-review-${review.id}`}
                        >
                          <Heart size={14} className={likedPosts.has(review.id) ? 'fill-current' : ''} />
                          <span>{review.likes_count || 0}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(review.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            expandedComments[review.id] ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'
                          }`}
                          data-testid={`button-reply-review-${review.id}`}
                        >
                          <MessageCircle size={14} />
                          <span>{review.comments_count || 0}</span>
                        </button>
                      </div>
                      
                      {/* Comments Section */}
                      {(expandedComments[review.id] || replyingTo === review.id) && (
                        <div className="mt-3 space-y-3">
                          {/* Loading state */}
                          {loadingComments.has(review.id) && (
                            <p className="text-xs text-gray-400">Loading replies...</p>
                          )}
                          
                          {/* Existing comments */}
                          {expandedComments[review.id]?.length > 0 && (
                            <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                              {expandedComments[review.id].map((comment: any) => (
                                <div key={comment.id} className="text-sm group">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <span className="font-medium text-gray-900">{comment.username || 'User'}</span>
                                      <p className="text-gray-700">{comment.content}</p>
                                      <span className="text-xs text-gray-400">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    {user?.id === comment.user_id && (
                                      <button
                                        onClick={() => handleDeleteComment(comment.id, review.id)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                                        data-testid={`button-delete-comment-${comment.id}`}
                                        title="Delete your comment"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Reply Input */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Write a reply..."
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              onKeyDown={(e) => e.key === 'Enter' && handleReply(review.id)}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(review.id)}
                              disabled={!replyContent.trim() || replyMutation.isPending}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <Send size={14} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !userRating && (
                <div className="text-center py-6 mt-4 border border-dashed border-gray-200 rounded-xl">
                  <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm mb-1">No reviews yet</p>
                  <p className="text-gray-400 text-xs">Rate this title using the Quick Add button above</p>
                </div>
              )}
              </>
            )}
          </div>

        </div>

        {/* Content sections */}
        <div className="space-y-4">
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

            {/* Similar Media Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                You Might Also Like
              </h2>
              
              {isSimilarLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  <span className="ml-2 text-gray-500">Finding similar content...</span>
                </div>
              ) : similarMedia.length > 0 ? (
                <div className="overflow-x-auto -mx-2">
                  <div className="flex gap-3 px-2 pb-2" style={{ minWidth: 'max-content' }}>
                    {similarMedia.map((item: any, index: number) => {
                      const getTypeIcon = (type: string) => {
                        const t = type?.toLowerCase();
                        if (t?.includes('movie')) return <Film className="w-3 h-3" />;
                        if (t?.includes('tv') || t?.includes('series')) return <Tv className="w-3 h-3" />;
                        if (t?.includes('book')) return <BookOpen className="w-3 h-3" />;
                        if (t?.includes('music') || t?.includes('album') || t?.includes('song')) return <Music className="w-3 h-3" />;
                        if (t?.includes('podcast')) return <Mic className="w-3 h-3" />;
                        return <Film className="w-3 h-3" />;
                      };
                      
                      const getTypeColor = (type: string) => {
                        const t = type?.toLowerCase();
                        if (t?.includes('movie')) return 'bg-blue-100 text-blue-700';
                        if (t?.includes('tv') || t?.includes('series')) return 'bg-purple-100 text-purple-700';
                        if (t?.includes('book')) return 'bg-amber-100 text-amber-700';
                        if (t?.includes('music') || t?.includes('album') || t?.includes('song')) return 'bg-green-100 text-green-700';
                        if (t?.includes('podcast')) return 'bg-pink-100 text-pink-700';
                        return 'bg-gray-100 text-gray-700';
                      };

                      const handleClick = () => {
                        // Navigate to media detail if we have IDs, otherwise search
                        if (item.external_id && item.external_source) {
                          setLocation(`/media/${item.type || 'Movie'}/${item.external_source}/${item.external_id}`);
                        } else {
                          const searchTerm = item.title + (item.year ? ` ${item.year}` : '');
                          setLocation(`/add?q=${encodeURIComponent(searchTerm)}`);
                        }
                      };

                      const handleAddClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setQuickAddMedia({
                          title: item.title,
                          mediaType: item.type || 'Movie',
                          imageUrl: item.poster_url,
                          externalId: item.external_id,
                          externalSource: item.external_source,
                        });
                        setIsQuickAddOpen(true);
                      };

                      return (
                        <div
                          key={`${item.title}-${index}`}
                          onClick={handleClick}
                          className="flex-shrink-0 w-28 cursor-pointer group"
                          data-testid={`similar-media-${index}`}
                        >
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 mb-2 shadow-sm group-hover:shadow-md transition-shadow">
                            {item.poster_url ? (
                              <img
                                src={item.poster_url}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-200 to-blue-200">
                                <div className="text-purple-600 opacity-60">
                                  {getTypeIcon(item.type)}
                                </div>
                              </div>
                            )}
                            <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${getTypeColor(item.type)}`}>
                              {getTypeIcon(item.type)}
                              <span className="truncate max-w-[50px]">{item.type || 'Media'}</span>
                            </div>
                            <button
                              onClick={handleAddClick}
                              className="absolute bottom-1 right-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center shadow-sm"
                              data-testid={`add-similar-${index}`}
                            >
                              <Plus size={14} className="text-purple-600" />
                            </button>
                          </div>
                          <p className="text-xs font-medium text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                            {item.title}
                          </p>
                          {item.year && (
                            <p className="text-[10px] text-gray-500">{item.year}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recommendations available yet</p>
                </div>
              )}
            </div>

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

        </div>
      </div>
      
      <RatingModal 
        isOpen={showRatingModal} 
        onClose={() => setShowRatingModal(false)}
        mediaTitle={mediaItem?.title || mediaData.title}
        mediaType={mediaItem?.type || mediaData.type}
        mediaCreator={mediaItem?.creator || mediaData.creator}
        mediaImage={resolvedImageUrl || mediaData.artwork}
        mediaExternalId={params?.id}
        mediaExternalSource={params?.source}
      />
      
      <CreateListDialog 
        open={showCreateListDialog} 
        onOpenChange={(open) => {
          setShowCreateListDialog(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
          }
        }}
      />
      
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddMedia(null);
        }}
        preSelectedMedia={quickAddMedia}
      />
      
      <QuickActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        preselectedMedia={{
          title: mediaItem?.title || mediaData.title,
          mediaType: mediaItem?.type || mediaData.type,
          imageUrl: resolvedImageUrl || mediaData.artwork,
          externalId: params?.id,
          externalSource: params?.source,
          creator: mediaItem?.creator || mediaData.creator,
        }}
      />
    </div>
  );
}
