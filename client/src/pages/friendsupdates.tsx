import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import PlayCard from "@/components/play-card";
import MediaCarousel from "@/components/media-carousel";
import { Star, Heart, MessageCircle, Share, ChevronRight, Check, Badge, User, Vote, TrendingUp, Lightbulb, Users, Film, Send, Trash2, MoreVertical, Eye, EyeOff } from "lucide-react";
import ShareUpdateDialog from "@/components/share-update-dialog";
import CommentsSection from "@/components/comments-section";
import CreatorUpdateCard from "@/components/creator-update-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { renderMentions } from "@/lib/mentions";

interface SocialPost {
  id: string;
  type: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  likedByCurrentUser?: boolean;
  containsSpoilers?: boolean;
  mediaItems: Array<{
    id: string;
    title: string;
    creator: string;
    mediaType: string;
    imageUrl: string;
    rating?: number;
    externalId: string;
    externalSource: string;
  }>;
}

const fetchSocialFeed = async ({ pageParam = 0, session }: { pageParam?: number; session: any }): Promise<SocialPost[]> => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const limit = 15; // Posts per page
  const offset = pageParam * limit;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch social feed: ${response.statusText}`);
  }

  return response.json();
};

export default function FriendsUpdates() {
  // Load Inter font for this page only
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set()); // Track liked comments
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set()); // Track revealed spoiler posts
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Check for URL parameters to scroll to specific post/comment
  const urlParams = new URLSearchParams(window.location.search);
  const highlightPostId = urlParams.get('post');
  const highlightCommentId = urlParams.get('comment');
  
  // Feature flag for comment likes
  const commentLikesEnabled = import.meta.env.VITE_FEED_COMMENT_LIKES === 'true';
  console.log('🎯 Feed: VITE_FEED_COMMENT_LIKES =', import.meta.env.VITE_FEED_COMMENT_LIKES, 'enabled =', commentLikesEnabled);
  
  // Debug session state
  useEffect(() => {
    console.log('🔍 Feed Session Debug:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      hasUser: !!user,
      userId: user?.id,
      sessionKeys: session ? Object.keys(session) : 'no session'
    });
  }, [session, user]);
  // Using window.location.assign for navigation as we are not using react-router-dom
  const setLocation = (path: string) => {
    window.location.assign(path);
  };

  const { 
    data: infinitePosts, 
    isLoading, 
    error: feedError,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage = false
  } = useInfiniteQuery({
    queryKey: ["social-feed"],
    queryFn: ({ pageParam = 0 }) => fetchSocialFeed({ pageParam, session }),
    enabled: !!session?.access_token,
    retry: false,
    getNextPageParam: (lastPage, allPages) => {
      // If we got less than 15 posts, we've reached the end
      if (lastPage.length < 15) return undefined;
      return allPages.length; // Return the next page number
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single array
  const socialPosts = infinitePosts?.pages.flat() || [];

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' } // Trigger 200px before reaching the bottom
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Log feed errors for debugging
  useEffect(() => {
    if (feedError) {
      console.error('❌ Feed fetch error:', feedError);
    }
  }, [feedError]);

  // Initialize likedPosts from feed data
  useEffect(() => {
    if (socialPosts) {
      const likedIds = new Set(
        socialPosts
          .filter(post => post.likedByCurrentUser)
          .map(post => post.id)
      );
      setLikedPosts(likedIds);
      console.log('✅ Initialized liked posts:', likedIds.size);
    }
  }, [socialPosts]);

  // Handle scrolling to specific post/comment from notification
  useEffect(() => {
    if (highlightPostId && socialPosts.length > 0) {
      // Auto-expand comments for the highlighted post
      setExpandedComments(prev => new Set(prev).add(highlightPostId));
      
      // Wait for comments to load and then scroll
      setTimeout(() => {
        if (highlightCommentId) {
          // Scroll to specific comment
          const commentElement = document.getElementById(`comment-${highlightCommentId}`);
          if (commentElement) {
            commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          // Just scroll to the post
          const postElement = document.getElementById(`post-${highlightPostId}`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 500); // Give time for comments to render
    }
  }, [highlightPostId, highlightCommentId, socialPosts]);

  // Fetch Play games for inline play
  const { data: playGames = [] } = useQuery({
    queryKey: ["/api/play-games", user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];

      console.log('🎮 Fetching games for Feed from prediction_pools...');

      // Get user's existing predictions
      const { data: userPredictions } = await supabase
        .from('user_predictions')
        .select('pool_id')
        .eq('user_id', user.id);

      const completedPoolIds = new Set(userPredictions?.map(p => p.pool_id) || []);
      console.log('✅ User has completed:', completedPoolIds);

      // Get all open games
      const { data, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching play games:', error);
        return [];
      }

      console.log('✅ Loaded games for Feed:', data);

      // Filter out games user has already played and process
      const availableGames = (data || [])
        .filter((game: any) => !completedPoolIds.has(game.id))
        .map((game: any) => {
          const isLongForm = Array.isArray(game.options) && 
            typeof game.options[0] === 'object' && 
            game.options[0]?.options;

          const isMultiCategory = false; // Not used for these games

          return {
            ...game,
            isLongForm,
            isMultiCategory,
          };
        })
        .filter((game: any) => !game.isLongForm) // Only show quick games inline
        .slice(0, 5); // Limit to 5 games

      console.log('🔄 Available games for Feed:', availableGames);
      return availableGames;
    },
    enabled: !!session?.access_token && !!user?.id,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch creator updates
  const { data: creatorUpdates = [] } = useQuery({
    queryKey: ["/api/creator-updates"],
    queryFn: async () => {
      if (!session?.access_token) return [];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-creator-updates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch creator updates');
        return [];
      }

      const data = await response.json();
      return data.updates || [];
    },
    enabled: !!session?.access_token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Like mutation with optimistic updates
  const likeMutation = useMutation({
    mutationFn: async ({ postId }: { postId: string; wasLiked: boolean }) => {
      console.log('❤️ Submitting like:', { postId });
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ post_id: postId }),
      });

      console.log('💗 Like response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Like error:', errorText);
        throw new Error('Failed to like post');
      }
      const result = await response.json();
      console.log('✅ Like success:', result);
      return result;
    },
    onMutate: async ({ postId, wasLiked }) => {
      // Optimistic update - immediately update UI
      console.log('⚡ Optimistic like update for:', postId, 'wasLiked:', wasLiked);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["social-feed"] });

      // Snapshot previous values
      const previousPosts = queryClient.getQueryData(["social-feed"]);
      const previousLikedPosts = new Set(likedPosts);

      // Optimistically update posts - toggle like (handle infinite query structure)
      queryClient.setQueryData(["social-feed"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: SocialPost[]) => 
            page.map(post => 
              post.id === postId 
                ? { 
                    ...post, 
                    likes: wasLiked 
                      ? Math.max((post.likes || 0) - 1, 0)  // Unlike: decrement (min 0)
                      : (post.likes || 0) + 1                // Like: increment
                  }
                : post
            )
          )
        };
      });

      // Update local like state - toggle
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });

      return { previousPosts, previousLikedPosts, wasLiked };
    },
    onError: (err, { postId }, context) => {
      console.log('💥 Like mutation error - reverting optimistic update:', err);

      // Revert optimistic update to query cache
      if (context?.previousPosts) {
        queryClient.setQueryData(["social-feed"], context.previousPosts);
      }

      // Revert local like state to previous value
      if (context?.previousLikedPosts) {
        setLikedPosts(context.previousLikedPosts);
      }
    },
    onSettled: () => {
      // Always refetch after mutation (success or error)
      console.log('🔄 Refetching social feed after like mutation');
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });

  // Comment mutation with support for replies
  const commentMutation = useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: { postId: string; content: string; parentCommentId?: string }) => {
      console.log('🔥 Submitting comment:', { postId, content, parentCommentId });
      if (!session?.access_token) throw new Error('Not authenticated');

      const body: any = { post_id: postId, content };
      if (parentCommentId) {
        body.parent_comment_id = parentCommentId;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('📬 Comment response:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Comment error:', errorText);
        throw new Error('Failed to add comment');
      }
      const result = await response.json();
      console.log('✅ Comment success:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('🔄 Invalidating queries for comment success');
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["post-comments", variables.postId] });
      setCommentInputs(prev => ({ ...prev, [variables.postId]: '' }));
    },
    onError: (error) => {
      console.log('💥 Comment mutation error:', error);
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      console.log('🗑️ Deleting post directly from Supabase:', postId);
      if (!user?.id) throw new Error('Not authenticated');

      // Delete directly using Supabase client
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id); // Only delete if user owns the post

      if (error) {
        console.error('❌ Delete error:', error);
        throw new Error(error.message || 'Failed to delete post');
      }

      console.log('✅ Post deleted successfully');
      return { success: true };
    },
    onMutate: async (postId) => {
      // Optimistic update - immediately remove post from UI
      console.log('⚡ Optimistic delete for:', postId);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["social-feed"] });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(["social-feed"]);

      // Optimistically remove the post (handle infinite query structure)
      queryClient.setQueryData(["social-feed"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: SocialPost[]) => 
            page.filter(post => post.id !== postId)
          )
        };
      });

      // Return context for rollback on error
      return { previousPosts };
    },
    onError: (error, postId, context) => {
      console.error('💥 Delete mutation error:', error);
      // Rollback on error
      if (context?.previousPosts) {
        queryClient.setQueryData(["social-feed"], context.previousPosts);
      }
    },
    onSuccess: () => {
      console.log('🔄 Invalidating feed query after delete');
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/delete-comment`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment_id: commentId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete comment');
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["post-comments", variables.postId] });
    },
  });

  // Comment like mutation (feature flagged)
  const commentLikeMutation = useMutation({
    mutationFn: async ({ commentId, wasLiked }: { commentId: string; wasLiked: boolean }) => {
      console.log('💗 Comment like mutation start:', { commentId, wasLiked });
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const method = wasLiked ? 'DELETE' : 'POST';
      console.log('💗 Sending comment like request:', { method, commentId });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-comment-like`, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment_id: commentId }),
      });

      console.log('💗 Comment like response:', { status: response.status, ok: response.ok });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💗 Comment like error response:', errorText);
        throw new Error(errorText || 'Failed to toggle comment like');
      }
      const result = await response.json();
      console.log('💗 Comment like success:', result);
      return result;
    },
    onMutate: async ({ commentId }) => {
      // Capture current state before optimistic update
      const wasLiked = likedComments.has(commentId);
      
      // Optimistic update
      setLikedComments(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
          newSet.delete(commentId);
        } else {
          newSet.add(commentId);
        }
        return newSet;
      });
      
      // Return context for potential rollback
      return { wasLiked };
    },
    onSuccess: (data, commentId) => {
      // Invalidate comments query to get updated like counts
      // We need to find which post this comment belongs to
      // For now, invalidate all post comments queries
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
    },
    onError: (error, { commentId }, context) => {
      console.error('Comment like error:', error);
      // Revert optimistic update on error using saved context
      const wasLiked = context?.wasLiked ?? false;
      setLikedComments(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
          newSet.add(commentId); // Restore to liked state
        } else {
          newSet.delete(commentId); // Restore to not liked state
        }
        return newSet;
      });
    },
  });

  // Fetch comments query with recursive transformation for nested replies
  const fetchComments = async (postId: string) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    console.log('🔍 Fetching comments for post:', postId);
    
    // Add include=meta parameter if feature flag is enabled
    const includeParam = commentLikesEnabled ? '&include=meta' : '';
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments?post_id=${postId}${includeParam}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Comments response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Comments fetch error:', errorText);
      throw new Error('Failed to fetch comments');
    }

    const result = await response.json();
    console.log('✅ Comments fetch success:', result);

    // Recursive function to transform comment tree
    const transformComment = (comment: any): any => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at, // Transform created_at to createdAt
      user: {
        id: comment.user_id,
        username: comment.username,
        displayName: comment.username, // Use username as displayName for now
        avatar: ''
      },
      likesCount: comment.likesCount || 0,
      likedByCurrentUser: comment.isLiked || false,
      replies: comment.replies?.map(transformComment) || [] // Recursively transform replies
    });

    // Transform the response to match frontend interface
    const transformedComments = result.comments?.map(transformComment) || [];

    console.log('🔄 Transformed comments with nesting:', transformedComments);
    return transformedComments;
  };

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareUpdate = () => {
    setIsShareDialogOpen(true);
  };

  const handleLike = (postId: string) => {
    const wasLiked = likedPosts.has(postId);
    likeMutation.mutate({ postId, wasLiked });
  };

  const handleComment = (postId: string, parentCommentId?: string, replyContent?: string) => {
    // For replies, use the provided replyContent; for top-level comments, use commentInputs
    const content = replyContent?.trim() || commentInputs[postId]?.trim();
    if (!content) return;

    commentMutation.mutate({ postId, content, parentCommentId });
  };

  const handleDeletePost = (postId: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      deletePostMutation.mutate(postId);
    }
  };

  const handleDeleteComment = (commentId: string, postId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate({ commentId, postId });
    }
  };

  const handleLikeComment = (commentId: string) => {
    if (!commentLikesEnabled) return; // Safety check
    const wasLiked = likedComments.has(commentId);
    commentLikeMutation.mutate({ commentId, wasLiked });
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleCommentInputChange = (postId: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [postId]: value }));
  };

  const getCreatorForMedia = (title: string) => {
    const creators = {
      "SmartLess": "Jason Bateman",
      "The Bear": "Jeremy Allen White",
      "Inception": "Christopher Nolan",
      "Dune": "Denis Villeneuve",
      "The Seven Husbands of Evelyn Hugo": "Taylor Jenkins Reid",
      "Atomic Habits": "James Clear",
      "Harry's House": "Harry Styles",
      "Renaissance": "Beyoncé"
    };
    return creators[title as keyof typeof creators] || "Unknown Creator";
  };

  const getMediaArtwork = (title: string, category: string) => {
    // Mock artwork URLs for different media
    const artworkMap: { [key: string]: string } = {
      "SmartLess": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=100&h=100&fit=crop",
      "The Bear": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=100&h=100&fit=crop",
      "Inception": "https://images.unsplash.com/photo-1489599843444-10da8eb01117?w=100&h=100&fit=crop",
      "Dune": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop",
      "The Seven Husbands of Evelyn Hugo": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=100&h=100&fit=crop",
      "Atomic Habits": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100&h=100&fit=crop",
      "Harry's House": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop",
      "Renaissance": "https://images.unsplash.com/photo-1520523839897-bd0b52f915a0?w=100&h=100&fit=crop"
    };

    return artworkMap[title] || `https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Fetch trending TV shows from TMDB
  const { data: trendingTVShows = [] } = useQuery({
    queryKey: ['trending-tv-shows'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-tv`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          console.error('Failed to fetch trending TV shows');
          return [];
        }
        const data = await response.json();
        // Add externalId and externalSource for MediaCarousel compatibility
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb'
        }));
      } catch (error) {
        console.error('Error fetching trending TV shows:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch NY Times bestseller books
  const { data: bestsellerBooks = [] } = useQuery({
    queryKey: ['bestseller-books'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-bestseller-books`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          console.error('Failed to fetch bestseller books');
          return [];
        }
        const data = await response.json();
        // Add externalId and externalSource for MediaCarousel compatibility
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'openlibrary',
          mediaType: 'book'
        }));
      } catch (error) {
        console.error('Error fetching bestseller books:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch trending movies
  const { data: trendingMovies = [] } = useQuery({
    queryKey: ['trending-movies'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-movies`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        // Add externalId and externalSource for MediaCarousel compatibility
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb'
        }));
      } catch (error) {
        console.error('Error fetching trending movies:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch trending podcasts
  const { data: trendingPodcasts = [] } = useQuery({
    queryKey: ['trending-podcasts'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-podcasts`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        // Add externalId and externalSource for MediaCarousel compatibility
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'spotify',
          mediaType: 'podcast'
        }));
      } catch (error) {
        console.error('Error fetching trending podcasts:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch DNA-based personalized recommendations (cached, instant <1s load!)
  const fetchRecommendations = async () => {
    if (!session?.access_token) {
      console.log('No session token available for recommendations');
      return [];
    }

    const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-recommendations", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const recommendations = data.recommendations || [];
    
    // Transform DNA recommendations to MediaCarousel format
    return recommendations.map((rec: any) => ({
      id: `${rec.external_source}-${rec.external_id}`,
      title: rec.title,
      imageUrl: rec.image_url, // Transform snake_case to camelCase
      rating: rec.confidence,
      year: rec.year?.toString(),
      mediaType: rec.media_type || rec.type,
      author: rec.creator,
      externalId: rec.external_id, // Pass through for proper API calls
      externalSource: rec.external_source, // Pass through for proper API calls
    }));
  };

  const { data: recommendedContent = [] } = useQuery({
    queryKey: ['recommended-content'],
    queryFn: fetchRecommendations,
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000, // Refetch after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: false,
  });

  const handleMediaClick = (item: any) => {
    console.log("Clicked media item:", item);
    
    // Determine the media type and source for the URL
    const mediaType = item.mediaType || 'movie';
    let source = 'tmdb'; // Default to TMDB
    
    // Determine source based on media type
    if (mediaType === 'book') {
      source = 'openlibrary';
    } else if (mediaType === 'podcast') {
      source = 'spotify';
    } else if (mediaType === 'movie' || mediaType === 'tv') {
      source = 'tmdb';
    }
    
    const externalId = item.id;
    
    // Navigate to media detail page
    setLocation(`/media/${mediaType}/${source}/${externalId}`);
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-32" style={{ fontFamily: 'Inter, sans-serif !important' }}>
      <style>{`
        #friendsupdates-page * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        #friendsupdates-page h1 {
          font-family: 'Poppins', sans-serif !important;
        }
      `}</style>
      <div id="friendsupdates-page">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Feed
          </h1>
          <p className="text-base text-gray-600">
            See what your friends are watching, reading, and listening to. Ask questions, share reactions, or post what's on your mind.
          </p>
        </div>


        {/* Activity Stream */}
        <div className="space-y-6">

          {/* Threads-Style Composer */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {user?.email?.substring(0, 2).toUpperCase() || 'ME'}
              </div>
              
              {/* Input */}
              <button
                onClick={handleShareUpdate}
                className="flex-1 text-left text-gray-400 text-base px-0"
                data-testid="composer-input"
              >
                What's new?
              </button>
              
              {/* Post Button */}
              <Button
                onClick={handleShareUpdate}
                variant="outline"
                className="text-sm font-semibold px-6 border-gray-300 hover:bg-gray-50"
                data-testid="share-update-button"
              >
                Post
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse shadow-sm">
                  {/* User info skeleton */}
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>

                  {/* Text skeleton */}
                  <div className="h-4 bg-gray-200 rounded mb-4 w-3/4"></div>

                  {/* Media card skeleton */}
                  <div className="bg-gray-100 rounded-2xl p-4 mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-5 bg-gray-200 rounded mb-2 w-2/3"></div>
                        <div className="h-3 bg-gray-200 rounded mb-2 w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </div>
                  </div>

                  {/* Interaction bar skeleton */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <div className="h-6 bg-gray-200 rounded w-8"></div>
                      <div className="h-6 bg-gray-200 rounded w-8"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : !session ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Please sign in to view your social feed.</p>
            </div>
          ) : socialPosts && socialPosts.length > 0 ? (
            <div className="space-y-4">
              {socialPosts.map((post: SocialPost, postIndex: number) => {
                // Inject PlayCard every 3rd post
                const shouldShowPlayCard = (postIndex + 1) % 3 === 0;
                const playCardIndex = Math.floor(postIndex / 3);
                const currentGame = playGames && playGames.length > 0 
                  ? playGames[playCardIndex % playGames.length]
                  : null;

                // Only show quick games inline (no long-form trivia or multi-category predictions)
                const canPlayInline = currentGame && !currentGame.isLongForm && !currentGame.isMultiCategory;

                // Inject Creator Update Card every 6th post
                const shouldShowCreatorUpdate = (postIndex + 1) % 6 === 0;
                const creatorUpdateIndex = Math.floor(postIndex / 6);
                const currentCreatorUpdate = creatorUpdates && creatorUpdates.length > 0 
                  ? creatorUpdates[creatorUpdateIndex % creatorUpdates.length]
                  : null;

                // Inject MediaCarousel every 4th post, rotating through types
                const shouldShowMediaCarousel = (postIndex + 1) % 4 === 0;
                const carouselIndex = Math.floor(postIndex / 4);
                
                // Rotation order: Books → Podcasts → Movies → Recommended → (repeat)
                const carouselTypes = [
                  { type: 'book', title: 'NY Times Bestsellers', items: bestsellerBooks },
                  { type: 'podcast', title: 'Trending Podcasts', items: trendingPodcasts },
                  { type: 'movie', title: 'Trending Movies', items: trendingMovies },
                  { type: 'mixed', title: 'Recommended For You', items: recommendedContent },
                ];
                const currentCarousel = carouselTypes[carouselIndex % carouselTypes.length];

                return (
                  <div key={`post-wrapper-${postIndex}`}>
                    {/* Insert MediaCarousel every 4th post */}
                    {shouldShowMediaCarousel && currentCarousel.items.length > 0 && (
                      <MediaCarousel
                        title={currentCarousel.title}
                        mediaType={currentCarousel.type}
                        items={currentCarousel.items}
                        onItemClick={handleMediaClick}
                      />
                    )}

                    {/* Insert PlayCard every 3rd post */}
                    {shouldShowPlayCard && canPlayInline && (
                      <PlayCard 
                        game={currentGame}
                        onComplete={() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/play-games", user?.id] });
                        }}
                      />
                    )}

                    {/* Insert Creator Update Card every 6th post */}
                    {shouldShowCreatorUpdate && currentCreatorUpdate && (
                      <div className="mb-4">
                        <CreatorUpdateCard 
                          update={currentCreatorUpdate}
                          onClick={() => {
                            const mediaType = currentCreatorUpdate.type === 'book' ? 'book' : 
                                             currentCreatorUpdate.type === 'album' || currentCreatorUpdate.type === 'single' ? 'music' : 
                                             currentCreatorUpdate.type === 'movie' ? 'movie' : 
                                             currentCreatorUpdate.type === 'tv' ? 'tv' : 'mixed';
                            setLocation(`/media/${mediaType}/${currentCreatorUpdate.external_source}/${currentCreatorUpdate.external_id}`);
                          }}
                        />
                      </div>
                    )}

                  {/* Original Post */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" id={`post-${post.id}`}>
                    {/* User Info and Date */}
                    <div className="flex items-center space-x-3 mb-4">
                      <Link href={`/user/${post.user.id}`}>
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors">
                          <User size={24} className="text-gray-600" />
                        </div>
                      </Link>
                      <div className="flex-1">
                        <Link 
                          href={`/user/${post.user.id}`}
                          className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                          data-testid={`link-user-${post.user.id}`}
                        >
                          {post.user.username}
                        </Link>
                        <div className="text-sm text-gray-500">{formatFullDate(post.timestamp)}</div>
                      </div>
                      {user?.id === post.user.id && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          data-testid={`button-delete-post-${post.id}`}
                          title="Delete post"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                  {/* Post Content with Spoiler Blur */}
                  {post.content && (
                    <div className="mb-4 relative">
                      {post.containsSpoilers && !revealedSpoilers.has(post.id) ? (
                        <>
                          {/* Blurred Text */}
                          <p className="text-gray-800 blur-md select-none">{post.content}</p>
                          
                          {/* Spoiler Badge Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => setRevealedSpoilers(prev => new Set(prev).add(post.id))}
                              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-lg transition-all hover:scale-105 flex items-center space-x-1"
                              data-testid={`reveal-spoiler-${post.id}`}
                            >
                              <Eye size={12} />
                              <span>Show Spoiler</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-800">{renderMentions(post.content)}</p>
                      )}
                    </div>
                  )}

                  {/* Media Cards - Always Visible */}
                  {post.mediaItems && post.mediaItems.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {post.mediaItems.map((media, index) => {
                        const isClickable = media.externalId && media.externalSource;
                        return (
                        <div 
                          key={index} 
                          className={`bg-gray-100 rounded-2xl p-4 transition-colors ${
                            isClickable ? 'cursor-pointer hover:bg-gray-200' : 'cursor-default'
                          }`}
                          onClick={() => {
                            if (isClickable) {
                              setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                            }
                          }}
                        >
                          <div className="flex items-center space-x-4">
                            {/* Media Artwork */}
                            <div className="w-16 h-24 rounded-lg overflow-hidden">
                              <img 
                                src={media.imageUrl || getMediaArtwork(media.title, media.mediaType)}
                                alt={`${media.title} artwork`}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Media Info */}
                            <div className="flex-1">
                              <h3 className={`font-semibold text-gray-900 text-lg mb-1 line-clamp-2 transition-colors ${
                                isClickable ? 'hover:text-purple-600' : ''
                              }`}>
                                {media.title}
                              </h3>

                              {/* Creator Info */}
                              {media.creator && (
                                <div className="text-gray-600 text-sm mb-2">
                                  by {media.creator}
                                </div>
                              )}

                              <div className="text-gray-600 text-sm capitalize mb-2">
                                {media.mediaType}
                              </div>
                              {media.rating && (
                                <div className="flex items-center">
                                  <div className="flex text-yellow-400">
                                    {Array.from({ length: 5 }, (_, i) => (
                                      <Star
                                        key={i}
                                        size={16}
                                        fill={i < media.rating! ? "currentColor" : "none"}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm text-gray-600 ml-2">({media.rating}/5)</span>
                                </div>
                              )}
                            </div>

                            {/* Arrow - only show if clickable */}
                            {isClickable && <ChevronRight className="text-gray-400" size={20} />}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Interaction Bar */}
                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <button 
                          onClick={() => handleLike(post.id)}
                          disabled={likeMutation.isPending}
                          className={`flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            likedPosts.has(post.id) 
                              ? 'text-red-500' 
                              : 'text-gray-500 hover:text-red-500'
                          }`}
                          data-testid={`button-like-${post.id}`}
                        >
                          <Heart 
                            size={18} 
                            fill={likedPosts.has(post.id) ? 'currentColor' : 'none'}
                          />
                          <span className="text-sm">{post.likes}</span>
                        </button>
                        <button 
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
                        >
                          <MessageCircle size={18} />
                          <span className="text-sm">{post.comments}</span>
                        </button>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(post.timestamp)}
                      </div>
                    </div>

                    {/* Comments Section */}
                    {expandedComments.has(post.id) && (
                      <CommentsSection 
                        postId={post.id}
                        fetchComments={fetchComments}
                        session={session}
                        commentInput={commentInputs[post.id] || ''}
                        onCommentInputChange={(value) => handleCommentInputChange(post.id, value)}
                        onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(post.id, parentCommentId, content)}
                        isSubmitting={commentMutation.isPending}
                        currentUserId={user?.id}
                        onDeleteComment={handleDeleteComment}
                        onLikeComment={commentLikesEnabled ? handleLikeComment : undefined}
                        likedComments={likedComments}
                      />
                    )}
                  </div>
                  </div>

                </div>
              );
              })}

              {/* Infinite Scroll Loading Indicator */}
              {isFetchingNextPage && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-500 mt-3">Loading more posts...</p>
                </div>
              )}

              {/* Intersection Observer Target */}
              {hasNextPage && !isFetchingNextPage && (
                <div ref={loadMoreRef} className="h-20" />
              )}

              {/* End of Feed Indicator */}
              {!hasNextPage && socialPosts.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">🎉 You've reached the end!</p>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="text-5xl mb-4">📡</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">No Activity Yet</h3>
              <p className="text-gray-600 max-w-sm mx-auto">
                The feed will show activity from you and other users as they start tracking their entertainment.
              </p>
            </div>
          )}
        </div>
      </div>

      <FeedbackFooter />

      <ConsumptionTracker
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />

      <ShareUpdateDialog
        isOpen={isShareDialogOpen}
        onClose={() => {
          setIsShareDialogOpen(false);
          // Refresh the social feed when dialog closes
          queryClient.invalidateQueries({ queryKey: ["social-feed"] });
        }}
      />
      </div>
    </div>
  );
}