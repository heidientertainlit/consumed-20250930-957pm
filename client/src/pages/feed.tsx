import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import PlayCard from "@/components/play-card";
import MediaCarousel from "@/components/media-carousel";
import { Star, Heart, MessageCircle, Share, ChevronRight, Check, Badge, User, Vote, TrendingUp, Lightbulb, Users, Film, Send, Trash2, MoreVertical, Eye, EyeOff, Plus, ExternalLink, Sparkles, Book, Music, Tv2, Gamepad2, Headphones, Flame, Target, HelpCircle, Activity, ArrowUp, ArrowDown } from "lucide-react";
import InlineComposer from "@/components/inline-composer";
import CommentsSection from "@/components/comments-section";
import CreatorUpdateCard from "@/components/creator-update-card";
import CollaborativePredictionCard from "@/components/collaborative-prediction-card";
import ConversationsPanel from "@/components/conversations-panel";
import FeedFiltersDialog, { FeedFilters } from "@/components/feed-filters-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge as UIBadge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { renderMentions } from "@/lib/mentions";
import { copyLink } from "@/lib/share";

interface SocialPost {
  id: string;
  type: string;
  user?: {
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
  rating?: number;
  progress?: string;
  listPreview?: Array<{
    id: string;
    title: string;
    creator: string;
    mediaType: string;
    imageUrl: string;
    externalId: string;
    externalSource: string;
  }>;
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
  // Grouped media fields
  groupedActivities?: Array<{
    postId: string;
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
    activityText: string;
    content: string;
    rating?: number;
    timestamp: string;
  }>;
  activityCount?: number;
  // Prediction-specific fields
  poolId?: string;
  question?: string;
  options?: string[];
  optionVotes?: Array<{
    option: string;
    count: number;
    percentage: number;
  }>;
  creator?: {
    username: string;
  };
  invitedFriend?: {
    username: string;
  };
  creatorPrediction?: string;
  friendPrediction?: string;
  userHasAnswered?: boolean;
  participantCount?: number;
  voteCounts?: {
    yes: number;
    no: number;
    total: number;
  };
  origin_type?: 'consumed' | 'user';
  origin_user_id?: string;
  deadline?: string | null;
  status?: 'open' | 'locked' | 'completed';
  resolved_at?: string | null;
  winning_option?: string;
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

// Media Card Quick Actions Component
function MediaCardActions({ media, session }: { media: any; session: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Fetch media details for platform chips (always load for visible content)
  const { data: mediaDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['media-details', media.externalSource, media.externalId],
    queryFn: async () => {
      if (!session?.access_token || !media.externalId || !media.externalSource) {
        return null;
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-media-details?source=${media.externalSource}&external_id=${media.externalId}&media_type=${media.mediaType}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.access_token && !!media.externalId && !!media.externalSource,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch user lists ONLY when dropdown is opened
  const { data: userLists } = useQuery({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-user-lists-with-media`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isDropdownOpen && !!session?.access_token,
  });

  // Add to list mutation
  const addToListMutation = useMutation({
    mutationFn: async ({ listType, isCustom }: { listType: string; isCustom?: boolean }) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const mediaData = {
        title: media.title,
        mediaType: media.mediaType || 'movie',
        creator: media.creator || '',
        imageUrl: media.imageUrl,
        externalId: media.externalId,
        externalSource: media.externalSource
      };

      const url = isCustom 
        ? `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/add-to-custom-list`
        : `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/track-media`;

      const body = isCustom
        ? { media: mediaData, customListId: listType }
        : { media: mediaData, listType };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || 'Failed to add to list');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      const isDuplicate = result?.message?.toLowerCase().includes('already');
      
      toast({
        title: isDuplicate ? "Already in list!" : "Added to list!",
        description: isDuplicate 
          ? `${media.title} is already in this list.`
          : `${media.title} has been added to your list.`,
      });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item to list. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleShare = async () => {
    try {
      await copyLink({
        kind: 'media',
        obj: {
          type: media.mediaType?.toLowerCase(),
          source: media.externalSource,
          id: media.externalId
        }
      });
      toast({
        title: "Link copied!",
        description: "Media link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get platforms - only from API data, no fallbacks
  const getPlatforms = () => {
    if (mediaDetails?.platforms && mediaDetails.platforms.length > 0) {
      return mediaDetails.platforms;
    }
    return [];
  };

  // Get platform label based on media type
  const getPlatformLabel = () => {
    const mediaType = media.mediaType?.toLowerCase();
    if (mediaType === 'podcast') return 'Listen On';
    if (mediaType === 'music') return 'Listen On';
    if (mediaType === 'movie' || mediaType === 'tv') return 'Watch On';
    if (mediaType === 'book') return 'Read On';
    return 'Available On';
  };
  
  const platforms = getPlatforms();
  // Extract lists from response object
  const listsData = userLists?.lists || userLists || [];
  const listsArray = Array.isArray(listsData) ? listsData : [];
  // Filter out 'All' list from the dropdown (only for viewing, not for adding)
  const defaultLists = listsArray.filter((list: any) => list.is_default && list.title !== 'All');
  const customLists = listsArray.filter((list: any) => !list.is_default);

  const displayedPlatforms = platforms.slice(0, 2);
  const remainingCount = platforms.length - displayedPlatforms.length;

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {/* Platforms row */}
      {platforms.length > 0 && (
        <div className="pt-2 border-t border-gray-200 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 whitespace-nowrap">{getPlatformLabel()}:</span>
          {displayedPlatforms.map((platform: any, idx: number) => (
            <a
              key={idx}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:border-gray-400 transition-colors whitespace-nowrap text-xs"
              onClick={(e) => e.stopPropagation()}
              data-testid={`platform-chip-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {platform.logo && (
                <img src={platform.logo} alt={platform.name} className="w-3.5 h-3.5 object-contain flex-shrink-0" />
              )}
              <span className="text-gray-700 font-medium">{platform.name}</span>
            </a>
          ))}
          {remainingCount > 0 && (
            <button
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              onClick={(e) => e.stopPropagation()}
              data-testid="button-view-more-platforms"
            >
              +{remainingCount} more
            </button>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-start gap-2 pb-2">
        {/* Add to List */}
        <DropdownMenu onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              disabled={addToListMutation.isPending}
              data-testid="button-add-to-list"
            >
              <Plus size={14} className="mr-1" />
              <span className="text-xs">Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {defaultLists.map((list: any) => (
              <DropdownMenuItem
                key={list.id}
                onClick={() => addToListMutation.mutate({ listType: list.title, isCustom: false })}
                data-testid={`add-to-${list.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {list.title}
              </DropdownMenuItem>
            ))}
            {customLists.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {customLists.map((list: any) => (
                  <DropdownMenuItem
                    key={list.id}
                    onClick={() => addToListMutation.mutate({ listType: list.id, isCustom: true })}
                    data-testid={`add-to-custom-${list.id}`}
                  >
                    {list.title}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Share */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50"
          onClick={handleShare}
          data-testid="button-share-media"
        >
          <Share size={14} className="mr-1" />
          <span className="text-xs">Share</span>
        </Button>
      </div>
    </div>
  );
}

// Helper function to render post content with star ratings
function renderPostWithRating(content: string) {
  // Match rating pattern at start: "4.5." or "5." or "10." etc
  const ratingMatch = content.match(/^\s*(\d{1,2}(?:\.\d{1,2})?)\s*[.:]\s*/);
  
  if (!ratingMatch) {
    return renderMentions(content);
  }
  
  const rawRating = parseFloat(ratingMatch[1]);
  
  // Only render stars for ratings between 0-5
  if (rawRating < 0 || rawRating > 5) {
    return renderMentions(content);
  }
  
  // Round to nearest 0.5 for clean star display
  const rating = Math.round(rawRating * 2) / 2;
  const restOfText = content.slice(ratingMatch[0].length);
  
  return (
    <>
      <span className="inline-flex items-center gap-1 mr-2">
        {Array.from({ length: 5 }, (_, i) => {
          const fillLevel = Math.max(0, Math.min(1, rating - i));
          
          if (fillLevel === 1) {
            // Full star
            return (
              <Star
                key={i}
                size={14}
                className="text-yellow-400 fill-yellow-400"
              />
            );
          } else if (fillLevel === 0.5) {
            // Half star
            return (
              <span key={i} className="relative inline-block w-3.5 h-3.5">
                <Star size={14} className="absolute text-gray-300 fill-gray-300" />
                <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star size={14} className="text-yellow-400 fill-yellow-400" />
                </span>
              </span>
            );
          } else {
            // Empty star
            return (
              <Star
                key={i}
                size={14}
                className="text-gray-300 fill-gray-300"
              />
            );
          }
        })}
        <span className="font-medium text-gray-700">{rawRating}</span>
      </span>
      {renderMentions(restOfText)}
    </>
  );
}

export default function Feed() {
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
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set()); // Track liked comments
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set()); // Track revealed spoiler posts
  const [feedFilter, setFeedFilter] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [detailedFilters, setDetailedFilters] = useState<FeedFilters>({ audience: "everyone", mediaTypes: [], engagementTypes: [] });
  const [inlineRatings, setInlineRatings] = useState<{ [postId: string]: string }>({}); // Track inline ratings
  const [activeInlineRating, setActiveInlineRating] = useState<string | null>(null); // Track which post has inline rating open
  const [currentVerb, setCurrentVerb] = useState("watching");
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Rotating verbs for header subheadline
  useEffect(() => {
    const verbs = ["watching", "reading", "playing", "listening to", "consuming"];
    let index = 0;
    
    const interval = setInterval(() => {
      index = (index + 1) % verbs.length;
      setCurrentVerb(verbs[index]);
    }, 3000); // Change every 3 seconds
    
    return () => clearInterval(interval);
  }, []);
  
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

  // Fetch user's friends list for filtering
  const { data: friendsData = [] } = useQuery({
    queryKey: ['user-friends'],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getFriends' })
      });
      
      if (!response.ok) return [];
      const data = await response.json();
      return data.friends || [];
    },
    enabled: !!session?.access_token,
  });

  // Create a Set of friend user IDs for quick lookup
  const friendIds = new Set(friendsData.map((friend: any) => friend.id));

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

  // Filter posts by detailed filters and feed filter
  const filteredPosts = socialPosts.filter(post => {
    // Apply main feed filter (All, Friends, Hot Take, Predictions, Polls, Rate/Review, Trivia)
    if (feedFilter === 'friends') {
      // Show only posts from friends (not own posts)
      if (!post.user || post.user.id === user?.id || !friendIds.has(post.user.id)) {
        return false;
      }
    }
    
    if (feedFilter === 'hot-takes') {
      // Show only posts without media items (text-only posts = hot takes)
      if (post.mediaItems && post.mediaItems.length > 0) return false;
    }
    
    if (feedFilter === 'predictions') {
      const postType = post.type?.toLowerCase() || '';
      if (postType !== 'prediction') return false;
    }
    
    if (feedFilter === 'polls') {
      const postType = post.type?.toLowerCase() || '';
      if (postType !== 'poll' && postType !== 'vote') return false;
    }
    
    if (feedFilter === 'trivia') {
      const postType = post.type?.toLowerCase() || '';
      if (postType !== 'trivia') return false;
    }
    
    if (feedFilter === 'rate-review') {
      // Show only posts with media items that have ratings/reviews
      if (!post.mediaItems || post.mediaItems.length === 0) return false;
      // At least one media item should have a rating
      const hasRating = post.mediaItems.some(item => item.rating && item.rating > 0);
      if (!hasRating) return false;
    }
    
    // Apply media type filter
    if (detailedFilters.mediaTypes.length > 0) {
      if (!post.mediaItems || post.mediaItems.length === 0) return false;
      const hasMatchingMedia = post.mediaItems.some(media => {
        const mediaType = media.mediaType?.toLowerCase();
        return detailedFilters.mediaTypes.includes(mediaType || '');
      });
      if (!hasMatchingMedia) return false;
    }

    // Apply engagement type filter
    if (detailedFilters.engagementTypes.length > 0) {
      const postType = post.type?.toLowerCase() || '';
      // Map post types to engagement filter IDs
      const engagementTypeMap: { [key: string]: string } = {
        'consuming': 'consuming',
        'prediction': 'prediction',
        'poll': 'poll',
        'rate': 'rate-review',
        'review': 'rate-review',
        'trivia': 'trivia'
      };
      const mappedType = engagementTypeMap[postType] || postType;
      if (!detailedFilters.engagementTypes.includes(mappedType)) return false;
    }

    return true;
  });

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
      console.log('🔍 First game origin_type:', data?.[0]?.origin_type);

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

  const hasRating = (content: string): boolean => {
    return /^\s*(\d{1,2}(?:\.\d{1,2})?)\s*[.:]/.test(content);
  };

  const toggleInlineRating = (postId: string) => {
    if (activeInlineRating === postId) {
      setActiveInlineRating(null);
    } else {
      setActiveInlineRating(postId);
    }
  };

  const handleInlineRatingChange = (postId: string, rating: string) => {
    setInlineRatings(prev => ({ ...prev, [postId]: rating }));
  };

  const submitInlineRating = (postId: string) => {
    const rating = inlineRatings[postId];
    if (!rating || parseFloat(rating) === 0) return;

    // Format as rating-only comment: "4.5."
    const formattedComment = `${rating}.`;
    
    // Use the existing comment mutation
    commentMutation.mutate(
      {
        postId,
        content: formattedComment,
      },
      {
        onSuccess: () => {
          // Clear rating and close inline rating
          setInlineRatings(prev => ({ ...prev, [postId]: '' }));
          setActiveInlineRating(null);
          
          // Optionally open comments to show the rating
          setExpandedComments(prev => new Set(prev).add(postId));
        },
        onError: (error) => {
          console.error('Error submitting rating:', error);
        },
      }
    );
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

  // Trending queries disabled - only showing Recommended for you
  // const { data: trendingTVShows = [] } = useQuery({
  //   queryKey: ['trending-tv-shows'],
  //   queryFn: async () => {
  //     try {
  //       const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  //       const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-tv`, {
  //         headers: {
  //           'Authorization': `Bearer ${anonKey}`,
  //           'Content-Type': 'application/json',
  //         },
  //       });
  //       if (!response.ok) {
  //         console.error('Failed to fetch trending TV shows');
  //         return [];
  //       }
  //       const data = await response.json();
  //       // Add externalId and externalSource for MediaCarousel compatibility
  //       return data.map((item: any) => ({
  //         ...item,
  //         externalId: item.id,
  //         externalSource: 'tmdb'
  //       }));
  //     } catch (error) {
  //       console.error('Error fetching trending TV shows:', error);
  //       return [];
  //     }
  //   },
  //   staleTime: 1000 * 60 * 60, // Cache for 1 hour
  // });

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

  // Trending queries disabled - only showing Recommended for you
  // const { data: trendingMovies = [] } = useQuery({
  //   queryKey: ['trending-movies'],
  //   queryFn: async () => {
  //     try {
  //       const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  //       const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-movies`, {
  //         headers: {
  //           'Authorization': `Bearer ${anonKey}`,
  //           'Content-Type': 'application/json',
  //         },
  //       });
  //       if (!response.ok) return [];
  //       const data = await response.json();
  //       // Add externalId and externalSource for MediaCarousel compatibility
  //       return data.map((item: any) => ({
  //         ...item,
  //         externalId: item.id,
  //         externalSource: 'tmdb'
  //       }));
  //     } catch (error) {
  //       console.error('Error fetching trending movies:', error);
  //       return [];
  //     }
  //   },
  //   staleTime: 1000 * 60 * 60,
  // });

  // const { data: trendingPodcasts = [] } = useQuery({
  //   queryKey: ['trending-podcasts'],
  //   queryFn: async () => {
  //     try {
  //       const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  //       const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-podcasts`, {
  //         headers: {
  //           'Authorization': `Bearer ${anonKey}`,
  //           'Content-Type': 'application/json',
  //         },
  //       });
  //       if (!response.ok) return [];
  //       const data = await response.json();
  //       // Add externalId and externalSource for MediaCarousel compatibility
  //       return data.map((item: any) => ({
  //         ...item,
  //         externalId: item.id,
  //         externalSource: 'spotify',
  //         mediaType: 'podcast'
  //       }));
  //     } catch (error) {
  //       console.error('Error fetching trending podcasts:', error);
  //       return [];
  //     }
  //   },
  //   staleTime: 1000 * 60 * 60,
  // });

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
    <div className="min-h-screen bg-gray-50 pb-32">
      <div id="feed-page">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Extended Purple Gradient Section for Composer */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 pb-8 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-6">
          {/* Inline Composer - Always Visible */}
          <InlineComposer />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Activity Stream */}
        <div className="space-y-6">

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
          ) : filteredPosts && filteredPosts.length > 0 ? (
            <div className="space-y-4">
              {/* Quick Glimpse - Scrolling ticker */}
              {(() => {
                // Extract friend activities from recent posts with media
                const friendActivities = filteredPosts
                  .filter((p: SocialPost) => p.user && p.user.id !== user?.id && p.mediaItems && p.mediaItems.length > 0)
                  .slice(0, 6)
                  .map((p: SocialPost) => ({
                    username: p.user!.username,
                    media: p.mediaItems[0].title,
                    action: p.content ? 'is loving' : 'added'
                  }));
                
                if (friendActivities.length === 0) return null;
                
                return (
                  <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 shadow-sm overflow-hidden">
                    <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <span>✨</span>
                      Quick Glimpse
                    </p>
                    <div className="h-5 overflow-hidden">
                      <div 
                        className="ticker-wrapper"
                        style={{
                          '--ticker-distance': `-${friendActivities.length * 20}px`,
                          '--ticker-duration': `${friendActivities.length * 3}s`
                        } as React.CSSProperties}
                      >
                        {/* Duplicate for seamless loop */}
                        {[...friendActivities, ...friendActivities].map((activity, idx) => (
                          <div 
                            key={idx}
                            className="h-5 flex items-center text-sm text-gray-900"
                          >
                            <span className="font-medium">{activity.username}</span>
                            <span className="mx-1">{activity.action}</span>
                            <span>{activity.media}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Recommended for you section - using MediaCarousel with working + and ★ buttons */}
              {recommendedContent && recommendedContent.length > 0 && (
                <div className="mb-4">
                  <MediaCarousel
                    title="Recommended for you"
                    mediaType="mixed"
                    items={recommendedContent}
                    onItemClick={handleMediaClick}
                  />
                </div>
              )}

              {/* Feed Filter Button */}
              <FeedFiltersDialog filters={detailedFilters} onFiltersChange={setDetailedFilters} />

              {/* MOCK: Smart Unified Grouped Card (remove after deploying edge function) */}
              <div className="mb-4 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm relative">
                {/* Preview badge */}
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                    Preview
                  </span>
                </div>
                
                {/* Media header */}
                <div className="p-4 pb-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Dune: Part Two</h3>
                  <p className="text-sm text-gray-600 mb-3">Denis Villeneuve</p>
                  
                  {/* Individual activities */}
                  <div className="text-sm text-gray-800 space-y-1 mb-3">
                    <div>
                      <Link to="/@emma" className="font-semibold hover:text-purple-600">
                        Emma
                      </Link>
                      {' '}
                      <span className="text-gray-700">finished it</span>
                    </div>
                    <div>
                      <Link to="/@rachel" className="font-semibold hover:text-purple-600">
                        Rachel
                      </Link>
                      {' '}
                      <span className="text-gray-700">rated it ★★★★★</span>
                    </div>
                  </div>

                  {/* Aggregated discussion metrics */}
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-3 pb-3 border-b border-gray-100">
                    <span className="flex items-center gap-1">
                      <Target size={14} className="text-purple-500" />
                      <strong className="text-gray-900">3</strong> Predictions
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={14} className="text-blue-500" />
                      <strong className="text-gray-900">24</strong> Comments
                    </span>
                  </div>

                  {/* Featured top take */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Top take:</p>
                    <p className="text-sm text-gray-900 italic">"Best sequel since Empire Strikes Back"</p>
                    <p className="text-xs text-gray-500 mt-1">
                      — <Link to="/@alex" className="font-semibold hover:text-purple-600">Alex</Link>
                    </p>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Link 
                      to="/media/movie/tmdb/693134"
                      className="flex-1 text-xs font-medium text-purple-600 hover:text-purple-700 py-2 px-3 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors text-center"
                    >
                      → See all activity
                    </Link>
                  </div>
                </div>
                
                {/* Media image */}
                <div className="aspect-[16/9] relative bg-gray-100">
                  <img 
                    src="https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" 
                    alt="Dune: Part Two"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              
              {filteredPosts.map((post: SocialPost, postIndex: number) => {
                // Check if this is a grouped media item
                if (post.type === 'media_group' && post.groupedActivities && post.mediaItems?.[0]) {
                  const media = post.mediaItems[0];
                  const activities = post.groupedActivities;
                  
                  return (
                    <div key={post.id} className="mb-4 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                      {/* Media header */}
                      <div className="p-4 pb-2">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{media.title}</h3>
                        {media.creator && (
                          <p className="text-sm text-gray-600 mb-3">{media.creator}</p>
                        )}
                        
                        {/* Activity summary - stacked for readability */}
                        <div className="text-sm text-gray-800 space-y-1">
                          {activities.slice(0, 3).map((activity) => (
                            <div key={activity.postId}>
                              <Link to={`/@${activity.username}`} className="font-semibold hover:text-purple-600">
                                {activity.displayName}
                              </Link>
                              {' '}
                              <span className="text-gray-700">{activity.activityText}</span>
                            </div>
                          ))}
                          {activities.length > 3 && (
                            <div className="text-gray-600 font-medium">+{activities.length - 3} more</div>
                          )}
                        </div>
                        
                        {/* See what they said link */}
                        <Link 
                          to={`/media/${media.mediaType}/${media.externalSource}/${media.externalId}`}
                          className="mt-3 text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center"
                        >
                          → See all activity
                        </Link>
                      </div>
                      
                      {/* Media image */}
                      {media.imageUrl && (
                        <div className="aspect-[16/9] relative bg-gray-100">
                          <img 
                            src={media.imageUrl} 
                            alt={media.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  );
                }
                
                // Check if this item is a prediction from the API
                if (post.type === 'prediction' && post.question) {
                  return (
                    <div key={`prediction-${post.id}`} className="mb-4">
                      <CollaborativePredictionCard 
                        prediction={post as any}
                        onCastPrediction={() => console.log("Cast prediction")}
                      />
                    </div>
                  );
                }

                // Pattern: 2 posts → prediction → trivia → creator update → 2 posts → recommended → (repeat)
                // Pattern repeats every 8 items
                const patternPosition = postIndex % 8;
                
                // After 2nd post (position 2), show prediction
                const shouldShowPrediction = patternPosition === 2;
                
                // After prediction (position 3), show trivia (only actual trivia, not polls)
                const shouldShowTrivia = patternPosition === 3;
                const triviaIndex = Math.floor(postIndex / 8);
                // Filter to only show actual trivia games, not polls or predictions
                const triviaGames = playGames?.filter(g => g.type === 'trivia') || [];
                const currentGame = triviaGames && triviaGames.length > 0 
                  ? triviaGames[triviaIndex % triviaGames.length]
                  : null;
                
                // After trivia (position 4), show creator update
                const shouldShowCreatorUpdate = patternPosition === 4;
                const creatorUpdateIndex = Math.floor(postIndex / 8);
                const currentCreatorUpdate = creatorUpdates && creatorUpdates.length > 0 
                  ? creatorUpdates[creatorUpdateIndex % creatorUpdates.length]
                  : null;
                
                // After 2 more posts (position 7), show recommended carousel
                const shouldShowMediaCarousel = patternPosition === 7;
                const carouselIndex = Math.floor(postIndex / 8);
                
                // Only show Recommended for you carousel
                const currentCarousel = { type: 'mixed', title: 'Recommended for you', items: recommendedContent };
                
                // Dummy predictions data
                const predictions = [
                  {
                    id: "pred-consumed",
                    question: "Will The Bear win Outstanding Comedy Series at the 2025 Emmys?",
                    creator: { username: "consumed" },
                    invitedFriend: { username: "team" },
                    creatorPrediction: "Yes",
                    friendPrediction: "No",
                    mediaTitle: "The Bear",
                    participantCount: 142,
                    userHasAnswered: false,
                    poolId: "pred-pool-consumed",
                    voteCounts: { yes: 89, no: 53, total: 142 },
                    likesCount: 45,
                    commentsCount: 18,
                    isLiked: false,
                    origin_type: 'consumed' as const,
                    origin_user_id: null,
                    deadline: new Date(Date.now() - 86400000).toISOString(),
                    status: 'open' as const,
                    resolved_at: null,
                    winning_option: null
                  },
                  {
                    id: "pred-1",
                    question: "Will Dune Part 2 win Best Picture at the Oscars?",
                    creator: { username: "heidi" },
                    invitedFriend: { username: "trey" },
                    creatorPrediction: "Yes",
                    friendPrediction: "No",
                    mediaTitle: "Dune Part 2",
                    participantCount: 8,
                    userHasAnswered: false,
                    poolId: "pred-pool-1",
                    voteCounts: { yes: 5, no: 3, total: 8 },
                    likesCount: 12,
                    commentsCount: 3,
                    isLiked: false,
                    origin_type: 'user' as const,
                    deadline: null,
                    status: 'completed' as const,
                    resolved_at: new Date(Date.now() - 3600000).toISOString(),
                    winning_option: "Yes"
                  },
                  {
                    id: "pred-3",
                    question: "Will they finish watching Breaking Bad?",
                    creator: { username: "alex" },
                    invitedFriend: { username: "jordan" },
                    creatorPrediction: "Yes - they're hooked!",
                    friendPrediction: "Probably, but it'll take months",
                    mediaTitle: "Breaking Bad",
                    participantCount: 15,
                    userHasAnswered: false,
                    poolId: "pred-pool-3",
                    voteCounts: { yes: 9, no: 6, total: 15 },
                    likesCount: 8,
                    commentsCount: 2,
                    isLiked: false,
                    origin_type: 'user' as const,
                    deadline: new Date(Date.now() + 86400000).toISOString(),
                    status: 'open' as const,
                    resolved_at: null,
                    winning_option: null
                  }
                ];
                const predictionIndex = Math.floor(postIndex / 8);
                const currentPrediction = predictions[predictionIndex % predictions.length];

                return (
                  <div key={`post-wrapper-${postIndex}`}>
                    {/* After 2 posts: Show Prediction */}
                    {shouldShowPrediction && (
                      <div className="mb-4">
                        <CollaborativePredictionCard 
                          prediction={currentPrediction}
                          onCastPrediction={() => console.log("Cast prediction")}
                        />
                      </div>
                    )}

                    {/* After prediction: Show Trivia */}
                    {shouldShowTrivia && currentGame && !currentGame.isLongForm && !currentGame.isMultiCategory && (
                      <div className="mb-4">
                        <PlayCard 
                          game={currentGame}
                          compact={true}
                          onComplete={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/play-games", user?.id] });
                          }}
                        />
                      </div>
                    )}

                    {/* After trivia: Show Pop Culture Update */}
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

                    {/* After 2 more posts: Show Recommended Carousel */}
                    {shouldShowMediaCarousel && currentCarousel.items.length > 0 && (
                      <div className="mb-4">
                        <MediaCarousel
                          title={currentCarousel.title}
                          mediaType={currentCarousel.type}
                          items={currentCarousel.items}
                          onItemClick={handleMediaClick}
                        />
                      </div>
                    )}

                  {/* Original Post */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm" id={`post-${post.id}`}>
                    {/* Post Type Label */}
                    {(() => {
                      const postType = post.type?.toLowerCase() || '';
                      let typeLabel = '';
                      let typeColor = '';
                      
                      // Check if it's a simple "added to list" post (no content, just media)
                      const isSimpleAddToList = !post.content && post.mediaItems && post.mediaItems.length > 0;
                      
                      // Skip label for simple add-to-list posts
                      if (isSimpleAddToList) {
                        return null;
                      }
                      
                      if (postType === 'prediction') {
                        typeLabel = '🎯 Prediction';
                        typeColor = 'bg-blue-100 text-blue-700';
                      } else if (postType === 'poll') {
                        typeLabel = '🗳️ Poll';
                        typeColor = 'bg-green-100 text-green-700';
                      } else if (post.rating || (post.content && /⭐|\/5|rated/i.test(post.content))) {
                        typeLabel = '⭐ Rate/Review';
                        typeColor = 'bg-yellow-100 text-yellow-700';
                      }
                      
                      return typeLabel ? (
                        <div className="mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                            {typeLabel}
                          </span>
                        </div>
                      ) : null;
                    })()}
                    
                    {/* User Info and Date */}
                    {post.user && (
                    <div className="flex items-center space-x-2 mb-3">
                      <Link href={`/user/${post.user.id}`}>
                        <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors">
                          <User size={18} className="text-gray-600" />
                        </div>
                      </Link>
                      <div className="flex-1">
                        <Link 
                          href={`/user/${post.user.id}`}
                          className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                          data-testid={`link-user-${post.user.id}`}
                        >
                          {post.user.username}
                        </Link>
                        <div className="text-xs text-gray-500">{formatFullDate(post.timestamp)}</div>
                      </div>
                      {user?.id === post.user.id && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          data-testid={`button-delete-post-${post.id}`}
                          title="Delete post"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    )}

                  {/* Post Content */}
                  {post.content ? (
                    <div className="mb-2 relative">
                      {post.containsSpoilers && !revealedSpoilers.has(post.id) ? (
                        <>
                          <p className="text-gray-800 text-sm blur-md select-none">{post.content}</p>
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
                        <div className="text-gray-800 text-sm">
                          {renderPostWithRating(post.content)}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Media Cards */}
                  {post.content && post.mediaItems && post.mediaItems.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {post.mediaItems.map((media, index) => {
                        const isClickable = media.externalId && media.externalSource;
                        return (
                          <div 
                            key={index} 
                            className="bg-gray-50 rounded-lg p-3 transition-colors"
                          >
                            <div 
                              className={`flex items-center space-x-3 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                              onClick={() => {
                                if (isClickable) {
                                  setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                }
                              }}
                            >
                              <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                                <img 
                                  src={media.imageUrl || getMediaArtwork(media.title, media.mediaType)}
                                  alt={`${media.title} artwork`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-gray-900 line-clamp-1">
                                  {media.title}
                                </h3>
                                {media.creator && (
                                  <div className="text-gray-600 text-xs mb-1">
                                    by {media.creator}
                                  </div>
                                )}
                                <div className="text-gray-500 text-xs capitalize">
                                  {media.mediaType}
                                </div>
                              </div>
                              {isClickable && <ChevronRight className="text-gray-400 flex-shrink-0" size={16} />}
                            </div>
                            
                            {/* Quick Actions - Always show for platform links */}
                            <MediaCardActions media={media} session={session} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !post.content && post.mediaItems && post.mediaItems.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-2">
                        <div 
                          className="flex items-center space-x-3 cursor-pointer mb-2"
                          onClick={() => {
                            const media = post.mediaItems[0];
                            if (media.externalId && media.externalSource) {
                              setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                            }
                          }}
                        >
                          <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                            <img 
                              src={post.mediaItems[0].imageUrl || getMediaArtwork(post.mediaItems[0].title, post.mediaItems[0].mediaType)}
                              alt={`${post.mediaItems[0].title} artwork`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 text-xs mb-1">
                              Added
                            </p>
                            <h3 className="font-semibold text-sm text-gray-900 line-clamp-1">
                              {post.mediaItems[0].title}
                            </h3>
                            {post.mediaItems[0].creator && (
                              <div className="text-gray-600 text-xs mb-0.5">
                                by {post.mediaItems[0].creator}
                              </div>
                            )}
                            <div className="text-gray-500 text-xs capitalize">
                              {post.mediaItems[0].mediaType}
                            </div>
                          </div>
                          <ChevronRight className="text-gray-400 flex-shrink-0" size={16} />
                        </div>
                        
                        {/* Platform badges and share button */}
                        <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                            {/* Left: Platform chips */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {(() => {
                                const media = post.mediaItems[0];
                                const mediaType = media.mediaType?.toLowerCase();
                                let platforms: Array<{ name: string; url: string }> = [];
                                let platformLabel = 'Available On';
                                
                                if (mediaType === 'podcast') {
                                  platformLabel = 'Listen On';
                                  platforms = [
                                    { name: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(media.title)}` },
                                    { name: 'Apple', url: `https://podcasts.apple.com/search?term=${encodeURIComponent(media.title)}` },
                                  ];
                                } else if (mediaType === 'music') {
                                  platformLabel = 'Listen On';
                                  platforms = [
                                    { name: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(media.title)}` },
                                    { name: 'Apple', url: `https://music.apple.com/search?term=${encodeURIComponent(media.title)}` },
                                  ];
                                } else if (mediaType === 'movie' || mediaType === 'tv') {
                                  platformLabel = 'Watch On';
                                  platforms = [
                                    { name: 'Netflix', url: `https://www.netflix.com/search?q=${encodeURIComponent(media.title)}` },
                                    { name: 'Prime', url: `https://www.amazon.com/s?k=${encodeURIComponent(media.title)}` },
                                  ];
                                } else if (mediaType === 'book') {
                                  platformLabel = 'Read On';
                                  platforms = [
                                    { name: 'Amazon', url: `https://www.amazon.com/s?k=${encodeURIComponent(media.title)}` },
                                    { name: 'Goodreads', url: `https://www.goodreads.com/search?q=${encodeURIComponent(media.title)}` },
                                  ];
                                }
                                
                                return platforms.length > 0 ? (
                                  <>
                                    <span className="text-xs text-gray-500 whitespace-nowrap">{platformLabel}:</span>
                                    {platforms.slice(0, 2).map((platform, idx) => (
                                      <a
                                        key={idx}
                                        href={platform.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors text-xs text-gray-700"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {platform.name}
                                      </a>
                                    ))}
                                  </>
                                ) : null;
                              })()}
                            </div>
                            
                            {/* Right: Share button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const media = post.mediaItems[0];
                                try {
                                  await copyLink({
                                    kind: 'media',
                                    obj: {
                                      type: media.mediaType?.toLowerCase(),
                                      source: media.externalSource,
                                      id: media.externalId
                                    }
                                  });
                                  toast({
                                    title: "Link copied!",
                                    description: "Media link has been copied to your clipboard.",
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to copy link.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-purple-600 transition-colors"
                              data-testid="button-share-media"
                            >
                              <Share size={16} />
                            </button>
                          </div>
                        </div>
                        
                        {/* See more link */}
                        {post.user && (
                          <div className="mt-3">
                            <button
                              onClick={() => setLocation(`/user/${post.user.id}?tab=lists`)}
                              className="text-sm text-gray-500 hover:text-purple-600 transition-colors"
                            >
                              See more of @{post.user.username}'s lists →
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Interaction Bar */}
                  <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
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
                        {hasRating(post.content) && !activeInlineRating && (
                          <button 
                            onClick={() => toggleInlineRating(post.id)}
                            className="flex items-center space-x-2 text-gray-500 hover:text-purple-600 transition-colors"
                            data-testid={`button-rate-review-${post.id}`}
                          >
                            <Star size={18} />
                            <span className="text-sm">Rate</span>
                          </button>
                        )}
                        {hasRating(post.content) && activeInlineRating === post.id && (
                          <div className="flex items-center space-x-2">
                            <Star size={18} className="text-gray-400" />
                            <span className="text-sm text-gray-600">Rate</span>
                            <input
                              type="text"
                              value={inlineRatings[post.id] || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  const num = parseFloat(value);
                                  if (value === '' || (num >= 0 && num <= 5)) {
                                    handleInlineRatingChange(post.id, value);
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  submitInlineRating(post.id);
                                } else if (e.key === 'Escape') {
                                  setActiveInlineRating(null);
                                }
                              }}
                              placeholder="0"
                              autoFocus
                              className="w-16 text-sm text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              data-testid={`inline-rating-input-${post.id}`}
                            />
                            <span className="text-sm text-gray-700">/5</span>
                            <Button
                              onClick={() => submitInlineRating(post.id)}
                              disabled={!inlineRatings[post.id] || parseFloat(inlineRatings[post.id]) === 0 || commentMutation.isPending}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 h-7"
                            >
                              <Send size={14} />
                            </Button>
                          </div>
                        )}
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
              {!hasNextPage && filteredPosts.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">🎉 You've reached the end!</p>
                </div>
              )}

            </div>
          ) : mediaTypeFilter !== "all" ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">No {mediaTypeFilter === "movie" ? "Movies" : mediaTypeFilter === "tv" ? "TV Shows" : mediaTypeFilter === "book" ? "Books" : mediaTypeFilter === "music" ? "Music" : mediaTypeFilter === "podcast" ? "Podcasts" : "Games"} Found</h3>
              <p className="text-gray-600 max-w-sm mx-auto">
                Try selecting a different media type filter or check back later for updates.
              </p>
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

      </div>
    </div>
  );
}