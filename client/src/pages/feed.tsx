import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import Navigation from "@/components/navigation";
import { QuickAddModal } from "@/components/quick-add-modal";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import PlayCard from "@/components/play-card";
import GameCarousel from "@/components/game-carousel";
import InlineGameCard from "@/components/inline-game-card";
import LeaderboardFeedCard from "@/components/leaderboard-feed-card";
import PointsAchievementCard from "@/components/points-achievement-card";
import MediaCarousel from "@/components/media-carousel";
import FeedHero from "@/components/feed-hero";
import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { DnaMomentCard } from "@/components/dna-moment-card";
import { TriviaCarousel } from "@/components/trivia-carousel";
import CastFriendsGame from "@/components/cast-friends-game";
import SeenItGame from "@/components/seen-it-game";
import TrackCard from "@/components/track-card";
import { LeaderboardGlimpse } from "@/components/leaderboard-glimpse";
import { PollsCarousel } from "@/components/polls-carousel";
import { RecommendationsGlimpse } from "@/components/recommendations-glimpse";
import { GamesCarousel } from "@/components/games-carousel";
import { RanksCarousel } from "@/components/ranks-carousel";
import { PointsGlimpse } from "@/components/points-glimpse";
import { Star, Heart, MessageCircle, Share, ChevronRight, Check, Badge, User, Vote, TrendingUp, Lightbulb, Users, Film, Send, Trash2, MoreVertical, Eye, EyeOff, Plus, ExternalLink, Sparkles, Book, Music, Tv2, Gamepad2, Headphones, Flame, Target, HelpCircle, Activity, ArrowUp, ArrowDown, Forward, Search as SearchIcon, X, Dices, ThumbsUp, ThumbsDown, Edit3, Brain, BarChart, Dna, Trophy, Medal, ListPlus } from "lucide-react";
import CommentsSection from "@/components/comments-section";
import CreatorUpdateCard from "@/components/creator-update-card";
import CollaborativePredictionCard from "@/components/collaborative-prediction-card";
import ConversationsPanel from "@/components/conversations-panel";
import FeedFiltersDialog, { FeedFilters } from "@/components/feed-filters-dialog";
import RankFeedCard from "@/components/rank-feed-card";
import ConsolidatedActivityCard, { ConsolidatedActivity } from "@/components/consolidated-activity-card";
import GroupedActivityCard from "@/components/grouped-activity-card";
import RecommendationCard from "@/components/recommendation-card";
import ConsumptionCarousel from "@/components/consumption-carousel";
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
import { FeedbackDialog } from "@/components/feedback-dialog";

interface SocialPost {
  id: string;
  type: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    email?: string;
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
    email?: string;
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

interface FeedResponse {
  posts: SocialPost[];
  currentUserId: string;
}

// Store the current user's app user ID globally for delete button matching
let currentAppUserId: string | null = null;

export const getCurrentAppUserId = () => currentAppUserId;

// Helper to format username consistently across the app
const formatUsername = (username?: string): string => {
  if (!username) return 'Unknown';
  let clean = username;
  
  // Handle email-style usernames with + (e.g., "thinkhp+jordanrivers24")
  if (clean.includes('+')) {
    clean = clean.split('+').pop() || clean;
    // For + style emails, also remove trailing numbers and format
    clean = clean.replace(/\d+$/, '');
    // Capitalize first letter
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  
  // Remove @ and domain if email
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }
  
  return clean || 'User';
};

const fetchSocialFeed = async ({ pageParam = 0, session }: { pageParam?: number; session: any }): Promise<SocialPost[]> => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const limit = 15; // Posts per page
  const offset = pageParam * limit;

  console.log('🔄 FETCHING FEED - page:', pageParam, 'offset:', offset);

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('🔄 Feed response status:', response.status);

  if (!response.ok) {
    throw new Error(`Failed to fetch social feed: ${response.statusText}`);
  }

  const data = await response.json();
  
  console.log('🔄 Feed response data type:', typeof data);
  console.log('🔄 Feed response is array:', Array.isArray(data));
  console.log('🔄 Feed response has posts key:', data && 'posts' in data);
  console.log('🔄 Feed response has currentUserId key:', data && 'currentUserId' in data);
  console.log('🔄 Feed _debug:', data?._debug);
  
  // Handle new response format with currentUserId
  if (data && typeof data === 'object' && !Array.isArray(data) && 'posts' in data && 'currentUserId' in data) {
    currentAppUserId = data.currentUserId;
    console.log('📌 Current app user ID set to:', currentAppUserId);
    
    // Filter out empty posts (no content, no rating, no media, no list)
    const filteredPosts = data.posts.filter((post: any) => {
      const hasContent = post.content && post.content.trim().length > 0;
      const hasRating = post.rating && post.rating > 0;
      const hasMedia = post.mediaItems && post.mediaItems.length > 0;
      const hasList = post.listData && post.listData.items && post.listData.items.length > 0;
      const hasGame = post.prediction_pool_id || post.game;
      // Keep post if it has any meaningful content
      return hasContent || hasRating || hasMedia || hasList || hasGame;
    });
    
    // Debug: Log posts with missing or problematic imageUrls
    filteredPosts.forEach((post: any, idx: number) => {
      if (post.mediaItems?.length > 0) {
        const media = post.mediaItems[0];
        if (!media.imageUrl || media.imageUrl === '' || !media.imageUrl.startsWith('http')) {
          console.log(`🖼️ POST ${idx} (${post.user?.username}) missing/bad imageUrl:`, {
            title: media.title,
            imageUrl: media.imageUrl,
            externalSource: media.externalSource,
            externalId: media.externalId
          });
        }
      }
      if (post.listData?.items?.length > 0) {
        post.listData.items.forEach((item: any, itemIdx: number) => {
          if (!item.imageUrl || item.imageUrl === '' || !item.imageUrl.startsWith('http')) {
            console.log(`🖼️ LIST ITEM ${idx}/${itemIdx} missing/bad imageUrl:`, {
              title: item.title,
              imageUrl: item.imageUrl,
              externalSource: item.externalSource
            });
          }
        });
      }
    });
    
    return filteredPosts;
  }
  
  // Fallback for old response format (array of posts)
  console.log('⚠️ Using old response format (array)');
  return data;
};

// Media Card Quick Actions Component
function MediaCardActions({ media, session }: { media: any; session: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
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
    enabled: isSheetOpen && !!session?.access_token,
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
        {/* Add to List - opens bottom sheet */}
        <Button
          size="sm"
          className="h-7 px-3 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 text-white rounded-full hover:from-purple-700 hover:via-purple-600 hover:to-indigo-600 shadow-sm"
          onClick={() => setIsSheetOpen(true)}
          data-testid="button-add-to-list"
        >
          <Plus size={14} className="mr-1" />
          <span className="text-xs font-medium">Add</span>
        </Button>

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

      {/* Quick Add List Sheet */}
      <QuickAddListSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        media={{
          title: media.title,
          mediaType: media.mediaType,
          imageUrl: media.imageUrl,
          externalId: media.externalId,
          externalSource: media.externalSource,
          creator: media.creator,
        }}
      />
    </div>
  );
}

// Helper function to check if content is a leaderboard ranking post
function isLeaderboardRankingPost(content: string): boolean {
  return /I'm #\d+/.test(content) && /on Consumed/i.test(content);
}

// Helper function to render leaderboard ranking with link
function renderLeaderboardRanking(content: string) {
  return (
    <>
      <span>{renderMentions(content)}</span>
      <a 
        href="/leaderboard"
        className="block text-purple-600 hover:text-purple-700 text-sm font-medium mt-1"
      >
        See who else is winning →
      </a>
    </>
  );
}

// Helper function to render post content with star ratings
function renderPostWithRating(content: string) {
  // Check for leaderboard ranking posts first
  if (isLeaderboardRankingPost(content)) {
    return renderLeaderboardRanking(content);
  }
  
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

// Date formatting helper (module level for use in all components)
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

// Currently Consuming Feed Card Component (extracted to use hooks properly)
function CurrentlyConsumingFeedCard({
  post,
  carouselElements,
  user,
  session,
  likedPosts,
  expandedComments,
  setExpandedComments,
  handleLike,
  handleHidePost,
  fetchComments,
  commentInputs,
  handleCommentInputChange,
  handleComment,
  commentMutation,
  handleDeleteComment,
  commentLikesEnabled,
  handleLikeComment,
  handleVoteComment,
  likedComments,
  commentVotes,
  onBet,
}: {
  post: SocialPost;
  carouselElements: React.ReactNode;
  user: any;
  session: any;
  likedPosts: Set<string>;
  expandedComments: Set<string>;
  setExpandedComments: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleLike: (postId: string) => void;
  handleHidePost: (postId: string) => void;
  fetchComments: (postId: string) => Promise<any>;
  commentInputs: { [postId: string]: string };
  handleCommentInputChange: (postId: string, value: string) => void;
  handleComment: (postId: string, parentCommentId?: string, content?: string) => void;
  commentMutation: any;
  handleDeleteComment: (commentId: string) => void;
  commentLikesEnabled: boolean;
  handleLikeComment?: (commentId: string) => void;
  handleVoteComment: (commentId: string, voteType: 'up' | 'down') => void;
  likedComments: Set<string>;
  commentVotes: Map<string, 'up' | 'down'>;
  onBet?: (postId: string, mediaTitle: string, userName: string, targetUserId: string, externalId?: string, externalSource?: string, mediaType?: string) => void;
}) {
  const [showRating, setShowRating] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  
  const media = post.mediaItems![0];
  const isOwnPost = user?.id && post.user?.id === user.id;
  
  const handleSubmitRating = async (rating: number) => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/rate-media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media: {
              title: media.title,
              mediaType: media.mediaType,
              imageUrl: media.imageUrl,
              externalId: media.externalId,
              externalSource: media.externalSource,
            },
            rating,
          }),
        }
      );
      if (response.ok) {
        setShowRating(false);
        setSelectedRating(rating);
      }
    } catch (error) {
      console.error('Failed to submit rating:', error);
    }
  };
  
  // Get display name without "consumed/IsConsumed" suffix
  const displayName = (post.user?.username || '').replace(/consumed|IsConsumed/gi, '').trim() || post.user?.username;
  
  return (
    <div id={`post-${post.id}`}>
      {carouselElements}
      <div className="mb-4">
        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden p-4">
          {/* Header with user info - consistent with other posts */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              {post.user && (
                <Link href={`/user/${post.user.id}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer flex-shrink-0">
                    {post.user.avatar ? (
                      <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm">{post.user.username?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                </Link>
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-900">
                  <Link href={`/user/${post.user?.id}`}>
                    <span className="font-semibold hover:text-purple-600 cursor-pointer">{post.user?.username}</span>
                  </Link>
                  {' '}added{' '}
                  <Link href={`/media/${media.mediaType}/${media.externalSource || 'tmdb'}/${media.externalId}`}>
                    <span className="hover:text-purple-600 cursor-pointer">{media.title}</span>
                  </Link>
                  {' '}→ <span className="text-purple-600">Currently</span>
                </p>
              </div>
            </div>
            {isOwnPost && (
              <button
                onClick={() => handleHidePost(post.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                data-testid={`button-hide-currently-${post.id}`}
                title="Hide from feed"
              >
                <EyeOff size={16} />
              </button>
            )}
          </div>
          
          {/* Media card in gray box - consistent design */}
          <div className="bg-white rounded-lg p-3 mb-2 border border-gray-100">
            <div className="flex gap-3">
              <Link href={`/media/${media.mediaType}/${media.externalSource || 'tmdb'}/${media.externalId}`}>
                <div className="cursor-pointer flex-shrink-0">
                  {media.imageUrl ? (
                    <img 
                      src={media.imageUrl} 
                      alt={media.title || ''} 
                      className="w-16 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                      <Film size={20} className="text-purple-300" />
                    </div>
                  )}
                </div>
              </Link>
              
              {/* Media info and actions */}
              <div className="flex-1 min-w-0">
                <Link href={`/media/${media.mediaType}/${media.externalSource || 'tmdb'}/${media.externalId}`}>
                  <h3 className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer line-clamp-1">{media.title}</h3>
                </Link>
                {media.creator && (
                  <p className="text-xs text-gray-600 mb-0.5">by {media.creator}</p>
                )}
                <p className="text-xs text-gray-500 capitalize mb-2">{media.mediaType}</p>
                
                {/* Compact actions */}
                <MediaCardActions media={media} session={session} />
              </div>
              <ChevronRight className="text-gray-400 flex-shrink-0 mt-6" size={16} />
            </div>
          </div>
          
          {/* See more link - consistent with other posts */}
          <Link href={`/user/${post.user?.id}?tab=lists`}>
            <p className="text-sm text-purple-600 hover:text-purple-700 cursor-pointer font-medium">
              See more of {displayName}'s lists →
            </p>
          </Link>
          
          {/* Like/Comment/Rate actions */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
            <div className="flex items-center gap-4">
            <button
              onClick={() => handleLike(post.id)}
              className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
              data-testid={`button-like-currently-${post.id}`}
            >
              <Heart size={16} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} />
              <span>{post.likes || 0}</span>
            </button>
            <button
              onClick={() => setExpandedComments(prev => {
                const newSet = new Set(prev);
                if (newSet.has(post.id)) newSet.delete(post.id);
                else newSet.add(post.id);
                return newSet;
              })}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
              data-testid={`button-comment-currently-${post.id}`}
            >
              <MessageCircle size={16} />
              <span>{post.comments || 0}</span>
            </button>
            {/* Star rating - show existing rating from post, or button to add rating */}
            {(post as any).rating ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className={star <= (post as any).rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
                  />
                ))}
              </div>
            ) : !showRating && !selectedRating && (
              <button
                onClick={() => setShowRating(true)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-500"
                data-testid={`button-rate-currently-${post.id}`}
              >
                <Star size={16} />
              </button>
            )}
            {showRating && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const currentValue = hoverRating || selectedRating;
                  const isFullFilled = currentValue >= star;
                  const isHalfFilled = currentValue >= star - 0.5 && currentValue < star;
                  return (
                    <div
                      key={star}
                      className="relative p-0.5 cursor-pointer"
                      onMouseLeave={() => setHoverRating(0)}
                      data-testid={`star-${star}-${post.id}`}
                    >
                      <Star size={16} className="text-gray-300" />
                      {/* Half fill overlay */}
                      <div 
                        className="absolute inset-0 overflow-hidden p-0.5"
                        style={{ width: isFullFilled ? '100%' : isHalfFilled ? '50%' : '0%' }}
                      >
                        <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      </div>
                      {/* Left half click zone for .5 */}
                      <div 
                        className="absolute inset-y-0 left-0 w-1/2"
                        onMouseEnter={() => setHoverRating(star - 0.5)}
                        onClick={() => handleSubmitRating(star - 0.5)}
                      />
                      {/* Right half click zone for whole number */}
                      <div 
                        className="absolute inset-y-0 right-0 w-1/2"
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() => handleSubmitRating(star)}
                      />
                    </div>
                  );
                })}
                <button
                  onClick={() => setShowRating(false)}
                  className="ml-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            )}
            {selectedRating > 0 && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFullFilled = selectedRating >= star;
                  const isHalfFilled = selectedRating >= star - 0.5 && selectedRating < star;
                  return (
                    <span key={star} className="relative inline-block w-3.5 h-3.5">
                      <Star size={14} className="absolute text-gray-300" />
                      <span 
                        className="absolute inset-0 overflow-hidden" 
                        style={{ width: isFullFilled ? '100%' : isHalfFilled ? '50%' : '0%' }}
                      >
                        <Star size={14} className="fill-yellow-400 text-yellow-400" />
                      </span>
                    </span>
                  );
                })}
                <span className="ml-1 text-xs text-gray-600">{selectedRating}/5</span>
              </div>
            )}
            {/* Bet button - only for other users' Currently posts */}
            {!isOwnPost && onBet && (
              <button
                onClick={() => onBet(
                  post.id, 
                  media.title, 
                  formatUsername(post.user?.username),
                  post.user?.id || '',
                  media.externalId,
                  media.externalSource,
                  media.mediaType
                )}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-500 transition-colors"
                data-testid={`button-bet-currently-${post.id}`}
                title="Bet on their reaction"
              >
                <Dices size={16} />
              </button>
            )}
            </div>
            {/* Timestamp on the right */}
            <span className="text-sm text-gray-400">{post.timestamp ? formatDate(post.timestamp) : 'Today'}</span>
          </div>
          
          {/* Comments Section */}
          {expandedComments.has(post.id) && (
            <div className="pt-3 mt-2 border-t border-gray-100">
              <CommentsSection
                postId={post.id}
                isLiked={likedPosts.has(post.id)}
                onLike={handleLike}
                expandedComments={true}
                onToggleComments={() => {}}
                fetchComments={fetchComments}
                commentInput={commentInputs[post.id] || ''}
                onCommentInputChange={(value) => handleCommentInputChange(post.id, value)}
                onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(post.id, parentCommentId, content)}
                isSubmitting={commentMutation.isPending}
                currentUserId={user?.id}
                onDeleteComment={handleDeleteComment}
                onLikeComment={commentLikesEnabled ? handleLikeComment : undefined}
                onVoteComment={handleVoteComment}
                likedComments={likedComments}
                commentVotes={commentVotes}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Feed() {
  const [, setLocation] = useLocation();
  
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
  const [trackModalPreSelectedMedia, setTrackModalPreSelectedMedia] = useState<any>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [expandedAddRecInput, setExpandedAddRecInput] = useState<Set<string>>(new Set()); // Track recs posts with add input expanded
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const likedPostsInitialized = useRef(false); // Track if we've done initial sync
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set()); // Track liked comments
  const [commentVotes, setCommentVotes] = useState<Map<string, 'up' | 'down'>>(new Map()); // Track user's comment votes
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set()); // Track revealed spoiler posts
  const [feedFilter, setFeedFilter] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [detailedFilters, setDetailedFilters] = useState<FeedFilters>({ audience: "everyone", mediaTypes: [], engagementTypes: [] });
  const [inlineRatings, setInlineRatings] = useState<{ [postId: string]: string }>({}); // Track inline ratings
  const [activeInlineRating, setActiveInlineRating] = useState<string | null>(null); // Track which post has inline rating open
  const [currentVerb, setCurrentVerb] = useState("watching");
  const [activeBetPost, setActiveBetPost] = useState<{ 
    postId: string; 
    mediaTitle: string; 
    userName: string;
    targetUserId: string;
    externalId?: string;
    externalSource?: string;
    mediaType?: string;
  } | null>(null); // Bet modal state
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [suggestedRotation, setSuggestedRotation] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Check for URL parameters to scroll to specific post/comment (reactive to URL changes)
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
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

  // Check for DNA profile and show notification once per session
  useEffect(() => {
    const checkDNAProfile = async () => {
      if (!session?.access_token) return;
      
      // Only show once per session
      const hasShownDNANotification = sessionStorage.getItem('shownDNANotification');
      if (hasShownDNANotification) return;

      try {
        const { data: dnaProfile } = await supabase
          .from('dna_profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        if (!dnaProfile) {
          // User doesn't have a DNA profile - show notification
          sessionStorage.setItem('shownDNANotification', 'true');
          toast({
            title: "Complete Your Entertainment DNA",
            description: "Take a quick survey to unlock personalized recommendations and discover your entertainment personality.",
            duration: 8000,
          });
        }
      } catch (error) {
        // No profile found or error - show notification
        const hasShown = sessionStorage.getItem('shownDNANotification');
        if (!hasShown) {
          sessionStorage.setItem('shownDNANotification', 'true');
          toast({
            title: "Complete Your Entertainment DNA",
            description: "Take a quick survey to unlock personalized recommendations and discover your entertainment personality.",
            duration: 8000,
          });
        }
      }
    };

    checkDNAProfile();
  }, [session?.access_token, user?.id, toast]);

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
      // Only stop if we get zero posts - filtering may cause partial pages
      if (lastPage.length === 0) return undefined;
      return allPages.length; // Return the next page number
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single array
  const socialPosts = infinitePosts?.pages.flat() || [];

  // Group same-user activities within same-day windows into consolidated cards BY ACTIVITY TYPE
  // Ratings consolidate if 2+ in same day, list adds go to Quick Glimpse (don't consolidate)
  const TIME_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours (same day)
  
  type ActivityType = 'list_adds' | 'ratings' | 'finished' | 'games';

  // Helper function to create a consolidated card (must be defined before groupUserActivities)
  const createConsolidatedCard = (posts: SocialPost[], activityType: ActivityType): ConsolidatedActivity | null => {
    if (!posts.length || !posts[0].user) return null;
    
    const user = posts[0].user;
    
    // Track unique media items by ID to avoid double counting
    const uniqueMediaMap = new Map<string, any>();
    const uniqueLists = new Set<string>();
    const listNames: string[] = [];
    
    // For list adds, group items BY LIST for carousel display
    const listGroups = new Map<string, { listId: string; listName: string; items: any[] }>();
    
    // Collect all unique items with their ratings
    posts.forEach(p => {
      const listId = (p as any).listId || 'default';
      const listData = (p as any).listData;
      const listName = listData?.title || 'List';
      
      if (listId !== 'default') {
        uniqueLists.add(listId);
        if (!listNames.includes(listName)) {
          listNames.push(listName);
        }
      }
      
      // Initialize list group if needed
      if (!listGroups.has(listId)) {
        listGroups.set(listId, { listId, listName, items: [] });
      }
      
      (p.mediaItems || []).forEach(m => {
        const itemKey = `${m.externalSource}-${m.externalId}`;
        if (!uniqueMediaMap.has(itemKey)) {
          // Preserve per-item rating if available
          const itemWithRating = { 
            ...m, 
            rating: m.rating || (activityType === 'ratings' ? p.rating : undefined) 
          };
          uniqueMediaMap.set(itemKey, itemWithRating);
          
          // Add to list group for carousel
          if (activityType === 'list_adds') {
            listGroups.get(listId)!.items.push(itemWithRating);
          }
        }
      });
    });
    
    const items = Array.from(uniqueMediaMap.values());
    if (items.length === 0) return null;
    
    // Sum up engagement counts from all posts
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
    
    // Build lists array for carousel (only for list_adds with multiple lists)
    const lists = activityType === 'list_adds' && listGroups.size > 1
      ? Array.from(listGroups.values()).filter(lg => lg.items.length > 0)
      : undefined;
    
    return {
      id: `consolidated-${activityType}-${user.id}-${posts[0].timestamp}`,
      type: activityType,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar
      },
      timestamp: posts[0].timestamp,
      items,
      totalItems: items.length,
      totalLists: uniqueLists.size,
      listNames,
      lists, // Array of {listId, listName, items[]} for carousel
      likes: totalLikes,
      comments: totalComments,
      likedByCurrentUser: posts.some(p => p.likedByCurrentUser),
      originalPostIds: posts.map(p => p.id)
    };
  };
  
  const groupUserActivities = (posts: SocialPost[]): (SocialPost | ConsolidatedActivity)[] => {
    if (!posts || posts.length === 0) return [];
    
    // Separate posts by groupability
    const groupablePosts: SocialPost[] = [];
    const ungroupablePosts: SocialPost[] = [];
    
    posts.forEach(post => {
      const postType = post.type?.toLowerCase() || '';
      
      // Only ratings and finished are groupable into consolidated cards
      // List adds (add-to-list) go to Quick Glimpse instead - don't consolidate them
      const isGroupable = (
        postType === 'rating' || 
        postType === 'finished'
      ) && post.mediaItems && post.mediaItems.length > 0;
      
      if (isGroupable) {
        groupablePosts.push(post);
      } else {
        ungroupablePosts.push(post);
      }
    });
    
    // Group posts by user + activity type
    const userTypeGroups = new Map<string, SocialPost[]>();
    
    const getActivityType = (post: SocialPost): ActivityType => {
      const postType = post.type?.toLowerCase() || '';
      if (postType === 'rating' || (post.rating && post.rating > 0)) return 'ratings';
      if (postType === 'finished') return 'finished';
      return 'list_adds';
    };
    
    groupablePosts.forEach(post => {
      if (!post.user?.id) return;
      const activityType = getActivityType(post);
      const key = `${post.user.id}-${activityType}`;
      if (!userTypeGroups.has(key)) {
        userTypeGroups.set(key, []);
      }
      userTypeGroups.get(key)!.push(post);
    });
    
    // Process each user+type group into time windows
    const consolidatedCards: ConsolidatedActivity[] = [];
    const postsToRemove = new Set<string>();
    
    userTypeGroups.forEach((typePosts, key) => {
      if (typePosts.length < 2) return; // Don't consolidate single posts
      
      const activityType = key.split('-').pop() as ActivityType;
      
      // Sort by timestamp descending (newest first)
      typePosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Find posts within 3-hour windows
      let windowStart = new Date(typePosts[0].timestamp).getTime();
      let windowPosts: SocialPost[] = [typePosts[0]];
      
      for (let i = 1; i < typePosts.length; i++) {
        const postTime = new Date(typePosts[i].timestamp).getTime();
        
        if (windowStart - postTime <= TIME_WINDOW_MS) {
          windowPosts.push(typePosts[i]);
        } else {
          // Outside window - process current window and start new one
          if (windowPosts.length >= 2) {
            const card = createConsolidatedCard(windowPosts, activityType);
            if (card) {
              consolidatedCards.push(card);
              windowPosts.forEach(p => postsToRemove.add(p.id));
            }
          }
          windowStart = postTime;
          windowPosts = [typePosts[i]];
        }
      }
      
      // Process final window
      if (windowPosts.length >= 2) {
        const card = createConsolidatedCard(windowPosts, activityType);
        if (card) {
          consolidatedCards.push(card);
          windowPosts.forEach(p => postsToRemove.add(p.id));
        }
      }
    });
    
    // Remove consolidated posts from original list
    const remainingGroupable = groupablePosts.filter(p => !postsToRemove.has(p.id));
    
    // Combine all posts and sort by timestamp
    const allItems: (SocialPost | ConsolidatedActivity)[] = [
      ...ungroupablePosts,
      ...remainingGroupable,
      ...consolidatedCards
    ];
    
    // Sort by timestamp (newest first)
    allItems.sort((a, b) => {
      const timeA = new Date((a as any).timestamp).getTime();
      const timeB = new Date((b as any).timestamp).getTime();
      return timeB - timeA;
    });
    
    return allItems;
  };
  
  // Apply grouping to social posts
  const processedPosts = groupUserActivities(socialPosts);

  // Shared predicate: Check if post type is a list-add (handles all variants)
  const isListAddType = (postType: string): boolean => {
    const normalizedType = postType?.toLowerCase() || '';
    // Use pattern matching to catch ALL variants (any combo of "list" and "add")
    // This catches: add-to-list, added_to_list, list_add, list_add_single, list-add-single, etc.
    if (normalizedType.includes('list') && normalizedType.includes('add')) {
      return true;
    }
    // Also check for specific known variants without both keywords
    return ['addtolist', 'listadd', 'added_to_list'].includes(normalizedType);
  };

  // Tier classification for feed priority (maintains chronological order)
  type PostTier = 1 | 2 | 3;
  
  const classifyPostTier = (item: SocialPost | ConsolidatedActivity): PostTier => {
    // ConsolidatedActivity cards stay as Tier 1 - they have engagement controls (ratings, finished)
    if ('originalPostIds' in item) return 1;
    
    const post = item as SocialPost;
    const postType = post.type?.toLowerCase() || '';
    
    // Tier 1: Jump-in moments (high engagement, interactive)
    if (['prediction', 'poll', 'vote', 'bet'].includes(postType)) {
      return 1;
    }
    
    // Tier 1: Ratings - people can engage with agree/disagree
    if (postType === 'rating' || (post.rating && post.rating > 0)) {
      return 1;
    }
    
    // Tier 1: Cross-user media groups (multiple people added same thing)
    if (postType === 'media_group' && post.groupedActivities && post.groupedActivities.length > 1) {
      return 1;
    }
    
    // Tier 1: Posts with substantial text content (reviews)
    if (post.content && post.content.length > 100) {
      return 1;
    }
    
    // Tier 3: Receipts (low signal - trivia scores, rank edits)
    if (['trivia', 'rank_edit', 'badge', 'achievement'].includes(postType)) {
      return 3;
    }
    
    // List adds now show as regular Tier 1 cards (user prefers clickable items)
    if (isListAddType(postType)) {
      return 1;
    }
    
    // Tier 2: Simple activities (finished without rating, progress, consuming)
    if (['finished', 'progress', 'update', 'consuming'].includes(postType)) {
      // Only Tier 2 if it's a simple activity without detailed content
      if (!post.content || post.content.length < 50) {
        return 2;
      }
    }
    
    // Posts with media items but short/no content are Tier 2
    if (post.mediaItems?.length > 0 && (!post.content || post.content.length < 50)) {
      return 2;
    }
    
    // Everything else is Tier 1 (regular posts, comments-worthy content)
    return 1;
  };

  // Group consecutive Tier 2 activities into compact "Friend Activity" blocks while maintaining chronological order
  interface FriendActivityBlock {
    id: string;
    type: 'friend_activity_block';
    timestamp: string;
    activities: Array<{
      user: { id: string; username: string; displayName?: string; avatar?: string };
      action: string;
      mediaTitle: string;
      mediaType?: string;
      rating?: number;
      listName?: string;
      postId: string;
    }>;
  }

  // Helper to check if a post is a consumption/tracking type (adds, ratings, simple updates)
  const isConsumptionPost = (post: SocialPost): boolean => {
    const postType = post.type?.toLowerCase() || '';
    
    // Explicit consumption/tracking types - all tracking activity goes here
    const consumptionTypes = [
      'added_to_list', 'add-to-list', 'added', 
      'rate', 'rate-review', 'rated', 'review', 'reviewed',
      'finished', 'consuming', 'progress', 'update', 'started',
      'watched', 'read', 'listening', 'played'
    ];
    
    // Game/engagement posts should NEVER be consumption posts - always show prominently
    const gameTypes = ['trivia', 'poll', 'prediction', 'vote', 'ask_for_recs', 'rank_share', 'media_group'];
    if (gameTypes.includes(postType)) return false;
    
    // Check explicit consumption types
    if (consumptionTypes.includes(postType)) return true;
    
    // Posts with media items but without substantial engagement content are consumption posts
    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
    
    // If it has media and isn't a game type, it's consumption
    if (hasMediaItems && !gameTypes.includes(postType)) {
      return true;
    }
    
    return false;
  };

  // Interface for consumption carousel blocks
  interface ConsumptionCarouselBlock {
    id: string;
    type: 'consumption_carousel';
    items: Array<{
      id: string;
      userId: string;
      username: string;
      displayName: string;
      avatar?: string;
      action: string;
      mediaTitle: string;
      mediaType?: string;
      mediaImage?: string;
      rating?: number;
      listName?: string;
      timestamp: string;
    }>;
  }

  // Create tiered feed with consumption carousels
  const createTieredFeed = (posts: (SocialPost | ConsolidatedActivity)[]): (SocialPost | ConsolidatedActivity | FriendActivityBlock | ConsumptionCarouselBlock)[] => {
    const result: (SocialPost | ConsolidatedActivity | FriendActivityBlock | ConsumptionCarouselBlock)[] = [];
    const consumptionPosts: SocialPost[] = [];
    let gamePostCount = 0;
    const CAROUSEL_INTERVAL = 5; // Show a consumption carousel every 5 game/engagement posts
    const MAX_ITEMS_PER_CAROUSEL = 8;

    for (const item of posts) {
      // Skip ConsolidatedActivity items - pass through as-is
      if ('originalPostIds' in item) {
        result.push(item);
        continue;
      }

      const post = item as SocialPost;
      
      if (isConsumptionPost(post)) {
        // Collect consumption posts for carousels
        consumptionPosts.push(post);
      } else {
        // This is a game/engagement post - add directly to result
        result.push(post);
        gamePostCount++;
        
        // After every CAROUSEL_INTERVAL game posts, insert a consumption carousel if we have items
        if (gamePostCount % CAROUSEL_INTERVAL === 0 && consumptionPosts.length > 0) {
          const carouselItems = consumptionPosts.splice(0, MAX_ITEMS_PER_CAROUSEL).map(p => ({
            id: p.id,
            userId: p.user?.id || '',
            username: p.user?.username || '',
            displayName: p.user?.displayName || p.user?.username || '',
            avatar: p.user?.avatar,
            action: p.type || 'added',
            mediaTitle: p.mediaItems?.[0]?.title || 'Unknown',
            mediaType: p.mediaItems?.[0]?.mediaType,
            mediaImage: p.mediaItems?.[0]?.imageUrl,
            rating: p.rating,
            listName: (p as any).listData?.name,
            timestamp: p.timestamp
          }));
          
          if (carouselItems.length > 0) {
            result.push({
              id: `carousel-${gamePostCount}`,
              type: 'consumption_carousel',
              items: carouselItems
            } as ConsumptionCarouselBlock);
          }
        }
      }
    }
    
    // Add any remaining consumption posts as a final carousel (even if just 1-2 items, don't drop them)
    if (consumptionPosts.length > 0) {
      const carouselItems = consumptionPosts.slice(0, MAX_ITEMS_PER_CAROUSEL).map(p => ({
        id: p.id,
        userId: p.user?.id || '',
        username: p.user?.username || '',
        displayName: p.user?.displayName || p.user?.username || '',
        avatar: p.user?.avatar,
        action: p.type || 'added',
        mediaTitle: p.mediaItems?.[0]?.title || 'Unknown',
        mediaType: p.mediaItems?.[0]?.mediaType,
        mediaImage: p.mediaItems?.[0]?.imageUrl,
        rating: p.rating,
        listName: (p as any).listData?.name,
        timestamp: p.timestamp
      }));
      
      result.push({
        id: `carousel-final`,
        type: 'consumption_carousel',
        items: carouselItems
      } as ConsumptionCarouselBlock);
    }
    
    return result;
  };

  // Apply tiered grouping (maintains chronological order)
  const tieredPosts = createTieredFeed(processedPosts);

  // Filter posts by detailed filters and feed filter
  const filteredPosts = tieredPosts.filter(item => {
    // Skip FriendActivityBlock from filtering
    if ((item as any).type === 'friend_activity_block') return true;
    // Skip ConsolidatedActivity items from filtering (they're already processed)
    if ('originalPostIds' in item) return true;
    
    const post = item as SocialPost;
    
    // Hide user-generated polls and predictions - only show Consumed-created ones
    const postType = post.type?.toLowerCase() || '';
    if (['prediction', 'poll', 'vote'].includes(postType)) {
      const postData = post as any;
      const isUserGenerated = postData.origin_type === 'user' || 
        (!postData.origin_type && postData.origin_user_id) ||
        (postData.user && !postData.origin_type);
      if (isUserGenerated) {
        return false; // Hide user-generated polls/predictions
      }
    }
    
    // Hide malformed posts: short content (looks like just a title), no media items, 
    // and not a special post type (prediction/poll/trivia/rank_share)
    // Note: 'add-to-list' (from track-media) is also a valid type
    const specialTypes = ['prediction', 'poll', 'trivia', 'rank_share', 'media_group', 'added_to_list', 'add-to-list', 'rewatch', 'ask_for_recs', 'friend_list_group'];
    const isSpecialType = specialTypes.includes(post.type || '');
    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
    const hasListData = !!(post as any).listData;
    const hasRankData = !!(post as any).rankData;
    const isShortContent = post.content && post.content.length < 80 && !post.content.includes('\n');
    const hasRating = post.rating && post.rating > 0;
    
    // If post has short content, no media, no list/rank data, not a special type, and no rating - hide it
    // Posts with ratings should always be shown
    if (isShortContent && !hasMediaItems && !hasListData && !hasRankData && !isSpecialType && !hasRating) {
      return false;
    }
    
    // Apply main feed filter (All, Friends, Ask for Recs)
    if (feedFilter === 'friends') {
      // Show only posts from friends (not own posts)
      if (!post.user || post.user.id === user?.id || !friendIds.has(post.user.id)) {
        return false;
      }
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

    // Apply selected filter (games, trivia, polls, predictions)
    if (selectedFilter && selectedFilter !== 'All' && selectedFilter !== 'all') {
      const postType = post.type?.toLowerCase() || '';
      
      if (selectedFilter === 'games') {
        // Show all game types: trivia, poll, prediction
        const gameTypes = ['trivia', 'poll', 'prediction', 'vote'];
        if (!gameTypes.includes(postType)) return false;
      } else if (selectedFilter === 'trivia') {
        if (postType !== 'trivia') return false;
      } else if (selectedFilter === 'polls') {
        if (postType !== 'poll' && postType !== 'vote') return false;
      } else if (selectedFilter === 'predictions') {
        if (postType !== 'prediction') return false;
      }
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

  // Initialize likedPosts from feed data - only on first load
  useEffect(() => {
    if (socialPosts && !likedPostsInitialized.current) {
      const likedIds = new Set(
        socialPosts
          .filter(post => post.likedByCurrentUser)
          .map(post => post.id)
      );
      setLikedPosts(likedIds);
      likedPostsInitialized.current = true;
      console.log('✅ Initialized liked posts:', likedIds.size);
    }
  }, [socialPosts]);

  // Handle scrolling to specific post/comment from notification
  useEffect(() => {
    if (highlightPostId && socialPosts.length > 0) {
      // Auto-expand comments for the highlighted post
      setExpandedComments(prev => new Set(prev).add(highlightPostId));
      
      // Retry scrolling until element is found (comments may take time to load)
      let attempts = 0;
      const maxAttempts = 10;
      
      const tryScroll = () => {
        attempts++;
        
        if (highlightCommentId) {
          // Scroll to specific comment
          const commentElement = document.getElementById(`comment-${highlightCommentId}`);
          if (commentElement) {
            commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add subtle highlight effect with smooth fade
            commentElement.style.transition = 'background-color 0.5s ease-in-out';
            commentElement.style.backgroundColor = 'rgba(147, 51, 234, 0.15)';
            commentElement.style.borderRadius = '8px';
            setTimeout(() => {
              commentElement.style.backgroundColor = 'transparent';
            }, 2500);
            // Clear URL params to prevent re-triggering
            window.history.replaceState({}, '', '/activity');
            return; // Success
          }
        } else {
          // Just scroll to the post (for likes)
          const postElement = document.getElementById(`post-${highlightPostId}`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add subtle highlight effect with smooth fade
            postElement.style.transition = 'background-color 0.5s ease-in-out';
            postElement.style.backgroundColor = 'rgba(147, 51, 234, 0.1)';
            postElement.style.borderRadius = '12px';
            setTimeout(() => {
              postElement.style.backgroundColor = 'transparent';
            }, 2500);
            // Clear URL params to prevent re-triggering
            window.history.replaceState({}, '', '/activity');
            return; // Success
          }
        }
        
        // Retry if element not found yet
        if (attempts < maxAttempts) {
          setTimeout(tryScroll, 300);
        }
      };
      
      // Start trying after initial delay
      setTimeout(tryScroll, 500);
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
    mutationFn: async ({ postId, wasLiked }: { postId: string; wasLiked: boolean }) => {
      console.log('❤️ Submitting like:', { postId, wasLiked, method: wasLiked ? 'DELETE' : 'POST' });
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-like`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
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
      // For grouped posts, check if any groupedActivity's postId matches
      queryClient.setQueryData(["social-feed"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: SocialPost[]) => 
            page.map(post => {
              // Check if this post matches the postId directly
              const directMatch = post.id === postId;
              // For grouped posts, check if any grouped activity has this postId
              const groupedMatch = post.groupedActivities?.some((a: any) => a.postId === postId);
              
              if (directMatch || groupedMatch) {
                return { 
                  ...post, 
                  likes: wasLiked 
                    ? Math.max((post.likes || 0) - 1, 0)  // Unlike: decrement (min 0)
                    : (post.likes || 0) + 1                // Like: increment
                };
              }
              return post;
            })
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
    onSuccess: () => {
      console.log('✅ Like mutation succeeded - optimistic update is correct');
      // Don't refetch immediately - let the optimistic update stand
      // The next natural feed refresh will sync the data
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
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const deleteUrl = `${baseUrl}/functions/v1/social-feed-delete`;
      
      console.log('🗑️ DELETE MUTATION STARTING');
      console.log('🗑️ Post ID:', postId);
      console.log('🗑️ VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('🗑️ Full delete URL:', deleteUrl);
      console.log('🗑️ Has access token:', !!session?.access_token);
      
      if (!session?.access_token) throw new Error('Not authenticated');

      console.log('🗑️ Making fetch call now...');
      
      try {
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ post_id: postId }),
        });

        console.log('🗑️ Response status:', response.status);
        console.log('🗑️ Response ok:', response.ok);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Delete error response:', errorData);
          throw new Error(errorData.error || 'Failed to delete post');
        }

        const result = await response.json();
        console.log('✅ Delete success response:', result);
        return result;
      } catch (fetchError) {
        console.error('❌ Fetch threw error:', fetchError);
        throw fetchError;
      }
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
      console.error('💥 Delete mutation onError:', error);
      console.error('💥 Post ID that failed:', postId);
      // Rollback on error
      if (context?.previousPosts) {
        console.log('💥 Rolling back to previous posts');
        queryClient.setQueryData(["social-feed"], context.previousPosts);
      }
    },
    onSuccess: (data) => {
      console.log('✅ Delete mutation onSuccess, data:', data);
      console.log('🔄 Invalidating feed query after delete');
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
    onSettled: (data, error) => {
      console.log('🏁 Delete mutation settled:', { data, error: error?.message });
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

  // Comment vote mutation (upvote/downvote)
  const commentVoteMutation = useMutation({
    mutationFn: async ({ commentId, direction }: { commentId: string; direction: 'up' | 'down' }) => {
      console.log('🗳️ Comment vote called:', { commentId, direction });
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const currentVote = commentVotes.get(commentId);
      const isRemoving = currentVote === direction;
      console.log('🗳️ Vote details:', { currentVote, isRemoving, method: isRemoving ? 'DELETE' : 'POST' });
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/comment-vote`, {
        method: isRemoving ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment_id: commentId, direction }),
      });

      console.log('🗳️ Vote response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log('🗳️ Vote error:', errorText);
        throw new Error(errorText || 'Failed to vote on comment');
      }
      const result = await response.json();
      console.log('🗳️ Vote success:', result);
      return result;
    },
    onMutate: async ({ commentId, direction }) => {
      const previousVote = commentVotes.get(commentId);
      
      // Optimistic update
      setCommentVotes(prev => {
        const newMap = new Map(prev);
        if (previousVote === direction) {
          // Clicking same direction removes vote
          newMap.delete(commentId);
        } else {
          newMap.set(commentId, direction);
        }
        return newMap;
      });
      
      return { previousVote };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
    },
    onError: (error, { commentId }, context) => {
      console.error('Comment vote error:', error);
      // Revert optimistic update
      setCommentVotes(prev => {
        const newMap = new Map(prev);
        if (context?.previousVote) {
          newMap.set(commentId, context.previousVote);
        } else {
          newMap.delete(commentId);
        }
        return newMap;
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
      upVoteCount: comment.upVoteCount || 0,
      downVoteCount: comment.downVoteCount || 0,
      voteScore: comment.voteScore || 0,
      currentUserVote: comment.currentUserVote || null,
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
    console.log('🔴 handleLike called with postId:', postId, 'isValidUUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId));
    const wasLiked = likedPosts.has(postId);
    likeMutation.mutate({ postId, wasLiked });
  };

  const handleComment = (postId: string, parentCommentId?: string, replyContent?: string) => {
    // For replies, use the provided replyContent; for top-level comments, use commentInputs
    const content = replyContent?.trim() || commentInputs[postId]?.trim();
    if (!content) return;

    commentMutation.mutate({ postId, content, parentCommentId });
  };

  const handleHidePost = (postId: string) => {
    console.log('🙈 handleHidePost called for:', postId);
    if (confirm('Hide this post from the feed? Your rating will still be saved.')) {
      console.log('✅ User confirmed hide');
      deletePostMutation.mutate(postId);
    } else {
      console.log('❌ User cancelled hide');
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

  const handleVoteComment = (commentId: string, direction: 'up' | 'down') => {
    commentVoteMutation.mutate({ commentId, direction });
  };

  // Place bet on friend's reaction
  const handlePlaceBet = async (prediction: 'will_like' | 'will_dislike') => {
    if (!activeBetPost || !session?.access_token) return;
    
    setIsPlacingBet(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/place-bet`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: activeBetPost.postId,
            target_user_id: activeBetPost.targetUserId,
            media_title: activeBetPost.mediaTitle,
            media_type: activeBetPost.mediaType,
            external_id: activeBetPost.externalId,
            external_source: activeBetPost.externalSource,
            prediction
          }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bet');
      }
      
      toast({
        title: "🎲 Bet placed!",
        description: prediction === 'will_like' 
          ? `You bet ${activeBetPost.userName} will love ${activeBetPost.mediaTitle}. You'll earn 5 points if you're right!`
          : `You bet ${activeBetPost.userName} won't like ${activeBetPost.mediaTitle}. You'll earn 5 points if you're right!`,
      });
      setActiveBetPost(null);
    } catch (error: any) {
      console.error('Failed to place bet:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to place bet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPlacingBet(false);
    }
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

  const submitInlineRating = async (postId: string, media?: any) => {
    const rating = inlineRatings[postId];
    if (!rating || parseFloat(rating) === 0) return;
    if (!session?.access_token) return;

    // If media is provided, save to rate-media endpoint for proper tracking
    if (media) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/rate-media`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              media_title: media.title,
              media_type: media.mediaType,
              media_image_url: media.imageUrl,
              media_external_id: media.externalId,
              media_external_source: media.externalSource,
              rating: parseFloat(rating),
              skip_social_post: true,
            }),
          }
        );
        
        if (response.ok) {
          setInlineRatings(prev => ({ ...prev, [postId]: '' }));
          setActiveInlineRating(null);
          queryClient.invalidateQueries({ queryKey: ['/api/social-feed'] });
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Rate-media error response:', errorData);
          throw new Error(errorData.error || 'Failed to save rating');
        }
      } catch (error: any) {
        console.error('Error submitting rating:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to save rating. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }

    // Fallback: Format as rating-only comment: "4.5."
    const formattedComment = `${rating}.`;
    commentMutation.mutate(
      {
        postId,
        content: formattedComment,
      },
      {
        onSuccess: () => {
          setInlineRatings(prev => ({ ...prev, [postId]: '' }));
          setActiveInlineRating(null);
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

  // Fetch trending TV shows
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
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb',
          mediaType: 'tv'
        }));
      } catch (error) {
        console.error('Error fetching trending TV shows:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
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

  // Suggested quick adds - personalized from recommendations or trending
  // TODO: Add friend-activity sourcing as top priority (requires new backend query)
  // Priority should be: 1. Friends' recent activity → 2. DNA recommendations → 3. Trending content
  const suggestedQuickAdds = useMemo(() => {
    // Priority 1 (future): Source from friends' recent tracked items
    // Priority 2: Use personalized DNA recommendations if available
    if (recommendedContent && recommendedContent.length >= 2) {
      const startIdx = (suggestedRotation * 2) % Math.max(recommendedContent.length - 1, 1);
      return recommendedContent.slice(startIdx, startIdx + 2);
    }
    // Priority 3: Mix trending TV and books
    const allTrending = [...(trendingTVShows || []), ...(bestsellerBooks || [])];
    if (allTrending.length >= 2) {
      const startIdx = (suggestedRotation * 2) % Math.max(allTrending.length - 1, 1);
      return allTrending.slice(startIdx, startIdx + 2);
    }
    return [];
  }, [recommendedContent, trendingTVShows, bestsellerBooks, suggestedRotation]);

  // Rotate suggestions every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestedRotation(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
    
    // Use externalId if available, otherwise extract from the prefixed id
    const externalId = item.externalId || item.id?.replace(/^(tmdb|spotify|openlibrary)-/, '');
    
    // Navigate to media detail page
    setLocation(`/media/${mediaType}/${source}/${externalId}`);
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div id="feed-page">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Header Section - Track First */}
      <div className="bg-gradient-to-b from-[#0a0a0f] via-[#12121f] to-[#1a1a2e] pb-4 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="text-center mb-4">
            <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight leading-snug">
              See how you stack up.
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Answer, vote, and share your takes.
            </p>
          </div>
          
          {/* Daily Challenge */}
          <div className="mb-2">
            <DailyChallengeCard />
          </div>
          
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 pb-6" data-feed-content>
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
          ) : (filteredPosts && filteredPosts.length > 0) || ['trivia', 'polls', 'predictions', 'dna', 'games', 'track'].includes(selectedFilter) ? (
            <div className="space-y-4 pb-24">
              {/* Feed Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide mb-4">
                {[
                  { id: 'all', label: 'All', Icon: Sparkles },
                  { id: 'games', label: 'Play', Icon: Gamepad2 },
                  { id: 'track', label: 'Track', Icon: ListPlus },
                  { id: 'trivia', label: 'Trivia', Icon: Brain },
                  { id: 'polls', label: 'Polls', Icon: BarChart },
                  { id: 'predictions', label: 'Predictions', Icon: Target },
                  { id: 'dna', label: 'DNA', Icon: Dna },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id === selectedFilter ? 'All' : filter.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      (filter.id === 'all' && selectedFilter === 'All') || filter.id === selectedFilter
                        ? 'bg-gradient-to-r from-indigo-600 via-purple-700 to-blue-700 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                    data-testid={`feed-filter-${filter.id}`}
                  >
                    <filter.Icon size={14} />
                    <span>{filter.label}</span>
                  </button>
                ))}
              </div>

              {/* Empty state for filtered views */}
              {feedFilter === 'friends' && filteredPosts.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100" data-testid="empty-filter-state">
                  <div className="text-4xl mb-3">👥</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Friend Activity</h3>
                  <p className="text-gray-500 text-sm">Follow more friends to see their activity!</p>
                </div>
              )}

              {/* Filtered views - show only the selected category */}
              {/* TRIVIA filter - Movies/TV category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia' || selectedFilter === 'games') && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Movies" />
              )}

              {/* Leaderboard - Trivia Champions */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <LeaderboardFeedCard variant="trivia" />
              )}

              {/* DNA Moment Card - in All or DNA filter */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'dna') && (
                <DnaMomentCard />
              )}

              {/* Cast Your Friends Game */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <CastFriendsGame />
              )}

              {/* Seen It Game */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <SeenItGame />
              )}

              {/* Quick Track Card */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'track') && (
                <TrackCard />
              )}

              {/* The Room - Friend Activity with reactions */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && socialPosts && socialPosts.length > 0 && (
                <ConsumptionCarousel 
                  items={(socialPosts || [])
                    .filter((p: any) => p.mediaItems?.length > 0 && p.user && p.user.id && p.user.username !== 'Unknown')
                    .slice(0, 10)
                    .map((p: any) => ({
                      id: p.id,
                      type: 'media_added' as const,
                      userId: p.user?.id || '',
                      username: p.user?.username || '',
                      displayName: p.user?.displayName || p.user?.display_name || p.user?.username || '',
                      avatar: p.user?.avatar_url || p.user?.avatarUrl,
                      mediaTitle: p.mediaItems[0]?.title || '',
                      mediaType: p.mediaItems[0]?.type || 'movie',
                      mediaImage: p.mediaItems[0]?.imageUrl || '',
                      activityText: p.activityText || 'added',
                      timestamp: p.createdAt || new Date().toISOString()
                    }))}
                  title="The Room"
                />
              )}

              {/* POLLS filter - Movies category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls' || selectedFilter === 'games') && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Movies" />
              )}

              {/* Leaderboard - Top Engagers */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <LeaderboardFeedCard variant="overall" />
              )}

              {/* Academy Awards 2026 Coming Soon Card */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <div className="bg-gradient-to-r from-amber-900 via-yellow-800 to-amber-900 rounded-2xl p-4 shadow-lg border border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold text-lg">2026 Academy Awards</h3>
                        <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-medium rounded-full">COMING SOON</span>
                      </div>
                      <p className="text-amber-200/80 text-sm">Nominations announced soon - be ready to predict the winners!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Points Glimpse - only in All view */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <PointsGlimpse />
              )}

              {/* Consumed Rankings Carousel - only in All view */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <RanksCarousel offset={0} />
              )}

              {/* TRIVIA filter - TV category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia' || selectedFilter === 'games') && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="TV" />
              )}

              {/* Leaderboard - Poll Masters */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <LeaderboardFeedCard variant="polls" />
              )}

              {/* POLLS filter - TV category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls' || selectedFilter === 'games') && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="TV" />
              )}

              {/* Leaderboard - Prediction Pros */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <LeaderboardFeedCard variant="predictions" />
              )}

              {/* More Ranks */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <RanksCarousel offset={1} />
              )}

              {/* Leaderboard - Media Leaders */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <LeaderboardFeedCard variant="consumption" />
              )}

              {/* Complete Your DNA Card */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'dna') && (
                <div className="bg-gradient-to-br from-purple-600 via-teal-500 to-cyan-500 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Dna className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Complete Your DNA</h3>
                      <p className="text-white/70 text-xs">Answer more questions to unlock personalized insights</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-[52px]">
                    <Link href="/dna">
                      <button className="bg-white text-purple-600 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/90 transition-colors">
                        Take DNA Quiz
                      </button>
                    </Link>
                    <Link href="/profile#dna">
                      <button className="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white/30 transition-colors">
                        View My DNA
                      </button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Recommendations - For You */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <RecommendationsGlimpse />
              )}

              {/* End of Feed Message */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm font-medium text-purple-600">You're all caught up! 🎉</p>
                  <p className="text-xs mt-2 max-w-xs mx-auto">Give feedback and tell us what you want more of, what went wrong, or scroll up and go play more trivia.</p>
                  <Button
                    onClick={() => setIsFeedbackOpen(true)}
                    className="mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6"
                  >
                    Give Feedback
                  </Button>
                </div>
              )}

              {/* Social Posts - DISABLED: feed ends at "You're all caught up" message */}
              {false && (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && filteredPosts.filter((item: any) => {
                // Filter out incorrectly formatted prediction posts
                if ('originalPostIds' in item) return true; // Keep consolidated activities
                if ((item as any).type === 'friend_activity_block') return true; // Keep friend activity blocks
                if ((item as any).type === 'consumption_carousel') return false; // Skip - handled separately above
                const post = item as SocialPost;
                return !(post.mediaItems?.length > 0 && post.mediaItems[0]?.title?.toLowerCase().includes("does mary leave"));
              }).map((item: any, postIndex: number) => {
                // Handle Quick Glimpse cards (scrolling Tier 2 grouped activities)
                if ((item as any).type === 'friend_activity_block') {
                  const block = item as any;
                  
                  const activities = block.activities || [];
                  
                  // Calculate points for each activity type
                  const getPointsForAction = (action: string, rating?: number) => {
                    if (action === 'scored' || action === 'trivia') return null; // Points shown in action text
                    if (action === 'rated') return rating && rating >= 4 ? 10 : 5;
                    if (action === 'finished') return 15;
                    if (action === 'added to currently') return 5;
                    if (action === 'added to queue') return 3;
                    if (action === 'added') return 5;
                    return 5;
                  };

                  // Format activity text with points emphasis for games
                  const formatActivityText = (activity: any) => {
                    const points = getPointsForAction(activity.action, activity.rating);
                    const name = formatUsername(activity.user?.username);
                    
                    // Game activities - show scoring
                    if (activity.action === 'trivia' || activity.action === 'scored') {
                      return { name, text: `scored ${activity.points || points || 60} on ${activity.mediaTitle}` };
                    }
                    if (activity.action === 'rated' && activity.rating) {
                      return { name, text: `rated ${activity.mediaTitle} ${activity.rating}★`, points };
                    }
                    if (activity.action === 'finished') {
                      return { name, text: `finished ${activity.mediaTitle}`, points };
                    }
                    return { name, text: `${activity.action} ${activity.mediaTitle}`, points };
                  };

                  return (
                    <div key={block.id} className="mb-4 bg-purple-50 rounded-2xl p-3 border border-purple-100 shadow-sm overflow-hidden" data-testid="quick-glimpse-card">
                      <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span>✨</span>
                        Quick Glimpse
                      </p>
                      <div className="h-[72px] overflow-hidden">
                        <div 
                          className="flex flex-col"
                          style={{
                            animation: `scrollVerticalGlimpse ${activities.length * 3}s linear infinite`,
                            '--scroll-distance': `-${activities.length * 24}px`
                          } as React.CSSProperties}
                        >
                          {/* Duplicate for seamless loop */}
                          {[...activities, ...activities].map((activity: any, idx: number) => {
                            const { name, text, points } = formatActivityText(activity);
                            return (
                              <div 
                                key={`${activity.postId}-${idx}`}
                                className="h-6 flex items-center text-sm whitespace-nowrap gap-1.5"
                              >
                                <span className="font-medium text-gray-900 truncate">{name}</span>
                                <span className="text-gray-600 truncate flex-1">{text}</span>
                                {points && (
                                  <span className="text-purple-600 font-semibold text-xs ml-auto">+{points}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <style>{`
                        @keyframes scrollVerticalGlimpse {
                          0% { transform: translateY(0); }
                          100% { transform: translateY(calc(var(--scroll-distance))); }
                        }
                      `}</style>
                    </div>
                  );
                }
                
                // Handle ConsolidatedActivity cards (per activity type)
                if ('originalPostIds' in item && 'type' in item && ['list_adds', 'ratings', 'finished', 'games'].includes((item as any).type)) {
                  const consolidated = item as ConsolidatedActivity;
                  return (
                    <div key={consolidated.id} className="mb-4">
                      <ConsolidatedActivityCard
                        activity={consolidated}
                        onLike={(postId) => handleLike(postId)}
                        onComment={(postId) => toggleComments(postId)}
                        onDelete={(postIds) => {
                          postIds.forEach(postId => deletePostMutation.mutate(postId));
                        }}
                        onBet={(postId, mediaTitle, userName, targetUserId, externalId, externalSource, mediaType) => 
                          setActiveBetPost({ postId, mediaTitle, userName, targetUserId, externalId, externalSource, mediaType })
                        }
                        isLiked={consolidated.originalPostIds.some(id => likedPosts.has(id))}
                        currentUserId={currentAppUserId}
                      />
                    </div>
                  );
                }
                
                const post = item as SocialPost;
                
                // Calculate real post ID for grouped posts (for likes/comments)
                const isGroupedPost = post.id.startsWith('grouped-') || (post as any).type === 'media_group';
                const realPostId = isGroupedPost && post.groupedActivities?.[0]?.postId 
                  ? post.groupedActivities[0].postId 
                  : post.id;
                
                // Check if any filter is active (for hiding other elements)
                const isFilterActive = selectedFilter && selectedFilter !== 'All' && selectedFilter !== 'all';
                
                // Points achievement at positions 5, 17, 29... (every 12 posts starting at 5)
                const shouldShowPointsAchievements = postIndex === 5 || (postIndex > 5 && (postIndex - 5) % 12 === 0);
                // Leaderboard at positions 1, 13, 25... (every 12 posts starting at 1)
                const shouldShowLeaderboard = postIndex === 1 || (postIndex > 1 && (postIndex - 1) % 12 === 0);
                // Rotate through leaderboard variants
                const leaderboardVariants = ['trivia', 'overall', 'consumption', 'polls', 'predictions'] as const;
                const leaderboardOccurrence = shouldShowLeaderboard ? Math.floor((postIndex - 1) / 12) : 0;
                const leaderboardVariant = leaderboardVariants[leaderboardOccurrence % leaderboardVariants.length];
                // Media carousel at positions 9, 21, 33... (every 12 posts starting at 9)
                const shouldShowMediaCarousel = postIndex === 9 || (postIndex > 9 && (postIndex - 9) % 12 === 0);
                // Recommendations only at position 2 (early in feed)
                const shouldShowRecommendations = postIndex === 2 && recommendedContent && recommendedContent.length > 0;
                
                // Rotate through different carousel types
                const carouselTypes = [
                  { type: 'tv', title: 'Trending in TV', items: trendingTVShows },
                  { type: 'podcast', title: 'Trending in Podcasts', items: trendingPodcasts },
                  { type: 'book', title: 'Trending in Books', items: bestsellerBooks },
                ];
                const carouselIndex = Math.floor((postIndex + 1) / 15) - 1;
                const currentCarousel = carouselTypes[carouselIndex % carouselTypes.length] || carouselTypes[0];
                
                // Carousel elements to prepend to any post type
                const carouselElements = (
                  <>
                    {shouldShowRecommendations && (
                      <div className="mb-4 bg-gradient-to-r from-[#1a1a2e] via-[#2d1f4e] to-[#1a1a2e] rounded-2xl border border-purple-900/50 p-4 shadow-lg" data-testid="recommendations-feed-card">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">✨</span>
                          <h3 className="font-semibold text-white">Recommended for you</h3>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                          {recommendedContent.slice(0, 6).map((item: any, idx: number) => (
                            <RecommendationCard
                              key={item.id || idx}
                              item={item}
                              idx={idx}
                              onMediaClick={handleMediaClick}
                              onAddClick={(mediaItem) => {
                                setQuickAddMedia({
                                  title: mediaItem.title,
                                  mediaType: mediaItem.type || mediaItem.mediaType || 'movie',
                                  imageUrl: mediaItem.imageUrl || mediaItem.posterPath,
                                  externalId: mediaItem.externalId || mediaItem.id,
                                  externalSource: mediaItem.externalSource || 'tmdb',
                                  creator: mediaItem.creator || mediaItem.author,
                                });
                                setIsQuickAddOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {shouldShowPointsAchievements && !isFilterActive && (
                      <div className="mb-4">
                        <PointsAchievementCard cardIndex={Math.floor((postIndex - 3) / 8)} />
                      </div>
                    )}
                    {shouldShowLeaderboard && !isFilterActive && (
                      <div className="mb-4">
                        <LeaderboardFeedCard variant={leaderboardVariant} />
                      </div>
                    )}
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
                  </>
                );
                
                // Check if this item is a prediction from the API
                // Skip user-generated predictions - only show Consumed-created ones
                if (post.type === 'prediction' && (post as any).question) {
                  const predPost = post as any;
                  const isUserGenerated = predPost.origin_type === 'user' || (!predPost.origin_type && predPost.origin_user_id);
                  if (isUserGenerated) {
                    return null; // Hide user-generated predictions
                  }
                  const predictionCardData = {
                    ...post,
                    id: predPost.poolId || post.id,
                    title: predPost.question,
                    mediaTitle: predPost.mediaTitle || post.mediaItems?.[0]?.title,
                    mediaItems: predPost.mediaItems || post.mediaItems || [],
                    creator: predPost.creator || post.user || { username: 'Unknown' },
                    poolId: predPost.poolId || post.id,
                    options: predPost.options || [],
                    optionVotes: predPost.optionVotes || [],
                    userVotes: predPost.userVotes || [],
                    userHasAnswered: predPost.userHasAnswered || false,
                    likesCount: predPost.likes || 0,
                    commentsCount: predPost.comments || 0,
                    isLiked: predPost.isLiked || false,
                    origin_type: predPost.origin_type || 'user',
                    origin_user_id: predPost.origin_user_id,
                    status: predPost.status || 'open',
                    type: predPost.poolType || 'predict',
                  };

                  return (
                    <div key={`prediction-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <CollaborativePredictionCard 
                          prediction={predictionCardData as any}
                        />
                      </div>
                    </div>
                  );
                }

                // Skip user rank_share posts - only show Consumed Rankings carousel
                if (post.type === 'rank_share') {
                  return null;
                }

                // Legacy rank_share rendering removed - user ranks no longer shown in feed
                if (false && post.type === 'rank_share' && (post as any).rankData) {
                  const rankPost = post as any;
                  return (
                    <div key={`rank-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <RankFeedCard
                          rank={rankPost.rankData}
                          author={{
                            id: post.user?.id || '',
                            user_name: post.user?.username || '',
                            display_name: post.user?.displayName,
                            profile_image_url: post.user?.avatar
                          }}
                          caption={post.content}
                          createdAt={post.timestamp}
                          postId={post.id}
                          likesCount={post.likes}
                          commentsCount={post.comments}
                          isLiked={likedPosts.has(post.id)}
                          onLike={handleLike}
                          expandedComments={expandedComments.has(post.id)}
                          onToggleComments={() => setExpandedComments(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(post.id)) {
                              newSet.delete(post.id);
                            } else {
                              newSet.add(post.id);
                            }
                            return newSet;
                          })}
                          fetchComments={fetchComments}
                          commentInput={commentInputs[post.id] || ''}
                          onCommentInputChange={(value) => handleCommentInputChange(post.id, value)}
                          onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(post.id, parentCommentId, content)}
                          isSubmitting={commentMutation.isPending}
                          currentUserId={user?.id}
                          onDeleteComment={handleDeleteComment}
                          onLikeComment={commentLikesEnabled ? handleLikeComment : undefined}
                          onVoteComment={handleVoteComment}
                          likedComments={likedComments}
                          commentVotes={commentVotes}
                        />
                      </div>
                    </div>
                  );
                }

                // Check if this item is a friend_list_group post (multiple friends added same media)
                if (post.type === 'friend_list_group') {
                  const friendGroupPost = post as any;
                  const usersWithPostIds = (friendGroupPost.groupedActivities || []).map((activity: any) => ({
                    id: activity.userId,
                    username: activity.username,
                    displayName: activity.displayName,
                    avatar: activity.avatar,
                    postId: activity.postId
                  }));
                  
                  return (
                    <div key={`friend-group-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <GroupedActivityCard
                          media={{
                            id: friendGroupPost.media?.id || post.mediaItems?.[0]?.id || '',
                            title: friendGroupPost.media?.title || post.mediaItems?.[0]?.title || 'Unknown',
                            imageUrl: friendGroupPost.media?.imageUrl || post.mediaItems?.[0]?.imageUrl,
                            mediaType: friendGroupPost.media?.mediaType || post.mediaItems?.[0]?.mediaType || 'movie',
                            externalId: friendGroupPost.media?.externalId || post.mediaItems?.[0]?.externalId || '',
                            externalSource: friendGroupPost.media?.externalSource || post.mediaItems?.[0]?.externalSource || ''
                          }}
                          users={usersWithPostIds}
                          listType={friendGroupPost.listType || 'list'}
                          onBetClick={(userId, postId, media) => {
                            const targetUser = usersWithPostIds.find((u: any) => u.id === userId);
                            setActiveBetPost({
                              postId: postId,
                              mediaTitle: media.title,
                              userName: formatUsername(targetUser?.username),
                              targetUserId: userId,
                              externalId: media.externalId,
                              externalSource: media.externalSource,
                              mediaType: media.mediaType
                            });
                          }}
                          timestamp={post.timestamp}
                        />
                      </div>
                    </div>
                  );
                }

                // Check if this item is a rewatch post (simple one-liner)
                if (post.type === 'rewatch') {
                  const isOwnPost = user?.id && post.user?.id === user.id;
                  
                  return (
                    <div key={`rewatch-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden p-4">
                          {/* User info with content in one line */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {post.user && (
                                <Link href={`/user/${post.user.id}`}>
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer flex-shrink-0">
                                    {post.user.avatar ? (
                                      <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      <span className="text-sm">{post.user.username?.[0]?.toUpperCase() || '?'}</span>
                                    )}
                                  </div>
                                </Link>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-900">
                                  <Link href={`/user/${post.user?.id}`}>
                                    <span className="font-semibold hover:text-purple-600 cursor-pointer">{formatUsername(post.user?.username)}</span>
                                  </Link>
                                  {' '}{post.content}
                                </p>
                                <span className="text-xs text-gray-400">{post.timestamp ? formatDate(post.timestamp) : 'Today'}</span>
                              </div>
                            </div>
                            {isOwnPost && (
                              <button
                                onClick={() => handleHidePost(post.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                                data-testid={`button-hide-rewatch-${post.id}`}
                                title="Hide from feed"
                              >
                                <EyeOff size={16} />
                              </button>
                            )}
                          </div>
                          
                          {/* Media thumbnail if available */}
                          {post.mediaItems && post.mediaItems[0]?.imageUrl && (
                            <div className="mt-3 flex items-center gap-3">
                              <img 
                                src={post.mediaItems[0].imageUrl} 
                                alt={post.mediaItems[0].title || ''} 
                                className="w-12 h-16 rounded-lg object-cover"
                              />
                              <div>
                                <p className="font-medium text-gray-900">{post.mediaItems[0].title}</p>
                                <p className="text-xs text-gray-500 capitalize">{post.mediaItems[0].mediaType}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Simple like/comment actions */}
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleLike(post.id)}
                              className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                              data-testid={`button-like-rewatch-${post.id}`}
                            >
                              <Heart size={16} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} />
                              <span>{post.likes || 0}</span>
                            </button>
                            <button
                              onClick={() => setExpandedComments(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(post.id)) newSet.delete(post.id);
                                else newSet.add(post.id);
                                return newSet;
                              })}
                              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
                              data-testid={`button-comment-rewatch-${post.id}`}
                            >
                              <MessageCircle size={16} />
                              <span>{post.comments || 0}</span>
                            </button>
                          </div>
                          
                          {/* Comments Section */}
                          {expandedComments.has(post.id) && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                          <CommentsSection
                            postId={post.id}
                            isLiked={likedPosts.has(post.id)}
                            onLike={handleLike}
                            expandedComments={true}
                            onToggleComments={() => {}}
                            fetchComments={fetchComments}
                            commentInput={commentInputs[post.id] || ''}
                            onCommentInputChange={(value) => handleCommentInputChange(post.id, value)}
                            onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(post.id, parentCommentId, content)}
                            isSubmitting={commentMutation.isPending}
                            currentUserId={user?.id}
                            onDeleteComment={handleDeleteComment}
                            onLikeComment={commentLikesEnabled ? handleLikeComment : undefined}
                            onVoteComment={handleVoteComment}
                            likedComments={likedComments}
                            commentVotes={commentVotes}
                          />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Check if this is a "currently consuming" post (added to Currently list)
                const postListData = (post as any).listData;
                const isCurrentlyPost = postListData?.title === 'Currently' && post.mediaItems && post.mediaItems.length > 0;
                
                if (isCurrentlyPost) {
                  return (
                    <CurrentlyConsumingFeedCard
                      key={`currently-${post.id}`}
                      post={post}
                      carouselElements={carouselElements}
                      user={user}
                      session={session}
                      likedPosts={likedPosts}
                      expandedComments={expandedComments}
                      setExpandedComments={setExpandedComments}
                      handleLike={handleLike}
                      handleHidePost={handleHidePost}
                      fetchComments={fetchComments}
                      commentInputs={commentInputs}
                      handleCommentInputChange={handleCommentInputChange}
                      handleComment={handleComment}
                      commentMutation={commentMutation}
                      handleDeleteComment={handleDeleteComment}
                      commentLikesEnabled={commentLikesEnabled}
                      handleLikeComment={handleLikeComment}
                      handleVoteComment={handleVoteComment}
                      likedComments={likedComments}
                      commentVotes={commentVotes}
                      onBet={(postId, mediaTitle, userName, targetUserId, externalId, externalSource, mediaType) => 
                        setActiveBetPost({ postId, mediaTitle, userName, targetUserId, externalId, externalSource, mediaType })
                      }
                    />
                  );
                }

                // Check if this item is an ask_for_recs post
                if (post.type === 'ask_for_recs') {
                  const recCategory = (post as any).recCategory;
                  const categoryLabels: Record<string, string> = {
                    movies: 'movies', tv: 'TV shows', books: 'books', music: 'music', 
                    podcasts: 'podcasts', games: 'games'
                  };
                  const categoryText = recCategory && categoryLabels[recCategory] 
                    ? categoryLabels[recCategory] 
                    : 'anything';
                  const isOwnPost = user?.id && post.user?.id === user.id;
                  
                  return (
                    <div key={`ask-recs-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                          {/* Purpose Strip - Dark purple gradient with category in text */}
                          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 px-4 py-2.5">
                            <p className="text-sm text-white font-medium">
                              Asking for recommendations for {categoryText} 👇
                            </p>
                          </div>
                          
                          {/* Card body */}
                          <div className="p-4">
                            {/* User info with trash icon */}
                            {post.user && (
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Link href={`/user/${post.user.id}`}>
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer">
                                      {post.user.avatar ? (
                                        <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                      ) : (
                                        <span className="text-xs">{post.user.username?.[0]?.toUpperCase() || '?'}</span>
                                      )}
                                    </div>
                                  </Link>
                                  <Link href={`/user/${post.user.id}`}>
                                    <span className="text-sm font-semibold text-gray-900 hover:text-purple-600 cursor-pointer">
                                      {post.user.username}
                                    </span>
                                  </Link>
                                </div>
                                {isOwnPost && (
                                  <button
                                    onClick={() => handleHidePost(post.id)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    data-testid={`button-hide-ask-recs-${post.id}`}
                                    title="Hide from feed"
                                  >
                                    <EyeOff size={16} />
                                  </button>
                                )}
                              </div>
                            )}
                            
                            {/* Request Content */}
                            <p className="text-lg font-medium text-gray-900 mb-4">{post.content}</p>
                            
                            {/* Simplified actions for recs card */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setExpandedAddRecInput(prev => {
                                      const newSet = new Set(prev);
                                      newSet.add(post.id);
                                      return newSet;
                                    });
                                  }}
                                  className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
                                  data-testid={`button-add-rec-${post.id}`}
                                >
                                  <Plus size={16} />
                                  <span>Add rec</span>
                                </button>
                                <button
                                  onClick={() => handleLike(post.id)}
                                  className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                                  data-testid={`button-follow-${post.id}`}
                                  title="Follow for updates"
                                >
                                  <span className="text-base">👀</span>
                                  <span>{likedPosts.has(post.id) ? 'Following' : 'Follow'}</span>
                                </button>
                              </div>
                              <span className="text-xs text-gray-400">{post.comments || 0} recs</span>
                            </div>
                          
                            {/* Recommendations section - always visible */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
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
                                onVoteComment={handleVoteComment}
                                likedComments={likedComments}
                                commentVotes={commentVotes}
                                isRecsMode={true}
                                recCategory={recCategory}
                                forceShowAddInput={expandedAddRecInput.has(post.id)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={`post-wrapper-${postIndex}`}>
                    {carouselElements}

                  {/* Original Post */}
                  <div 
                    className={`rounded-2xl border p-4 shadow-sm ${
                      post.content && isLeaderboardRankingPost(post.content)
                        ? 'bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 border-purple-200'
                        : 'bg-white border-gray-200'
                    }`} 
                    id={`post-${post.id}`}
                  >
                    {/* Post Type Label - hidden for now but type is tracked on backend */}
                    
                    {/* User Info and Date */}
                    {post.user ? (
                    <div className="flex items-center space-x-2 mb-3">
                      <Link href={`/user/${post.user.id}`}>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                          {post.user.avatar ? (
                            <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-sm">{post.user.displayName?.[0]?.toUpperCase() || post.user.username?.[0]?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex-1">
                        {/* Username with action text for add/rate posts */}
                        {(() => {
                          const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
                          const contentLower = (post.content || '').toLowerCase();
                          const isAddedPost = contentLower.startsWith('added ') || (!post.content && hasMediaItems && !post.rating);
                          const isRatedPost = contentLower.startsWith('rated ') || post.rating;
                          
                          if (isAddedPost && hasMediaItems) {
                            // Check if we have listData for the new format
                            const listData = (post as any).listData;
                            if (listData) {
                              return (
                                <p className="text-sm">
                                  <Link 
                                    href={`/user/${post.user.id}`}
                                    className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                    data-testid={`link-user-${post.user.id}`}
                                  >
                                    {post.user.username}
                                  </Link>
                                  <span className="text-gray-500"> added to → </span>
                                  <Link 
                                    href={`/user/${post.user.id}?tab=lists`}
                                    className="font-medium text-purple-600 hover:text-purple-700"
                                  >
                                    {listData.title}
                                  </Link>
                                </p>
                              );
                            }
                            return (
                              <p className="text-sm">
                                <Link 
                                  href={`/user/${post.user.id}`}
                                  className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                  data-testid={`link-user-${post.user.id}`}
                                >
                                  {post.user.username}
                                </Link>
                                <span className="text-gray-500"> {post.content || `added ${post.mediaItems[0].title}`}</span>
                              </p>
                            );
                          } else if (isRatedPost && hasMediaItems) {
                            const listData = (post as any).listData;
                            return (
                              <p className="text-sm">
                                <Link 
                                  href={`/user/${post.user.id}`}
                                  className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                  data-testid={`link-user-${post.user.id}`}
                                >
                                  {post.user.username}
                                </Link>
                                <span className="text-gray-500"> rated {post.mediaItems[0].title}</span>
                                {listData && (
                                  <>
                                    <span className="text-gray-500"> → </span>
                                    <Link 
                                      href={`/user/${post.user.id}?tab=lists`}
                                      className="font-medium text-purple-600 hover:text-purple-700"
                                    >
                                      {listData.title}
                                    </Link>
                                  </>
                                )}
                              </p>
                            );
                          } else if (post.content && hasMediaItems) {
                            // Check if content is just the media title (not actual thoughts)
                            const contentIsJustTitle = post.mediaItems[0]?.title && 
                              post.content.toLowerCase().trim() === post.mediaItems[0].title.toLowerCase().trim();
                            
                            if (contentIsJustTitle) {
                              // Just showing the add, not actual thoughts
                              return (
                                <p className="text-sm">
                                  <Link 
                                    href={`/user/${post.user.id}`}
                                    className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                    data-testid={`link-user-${post.user.id}`}
                                  >
                                    {post.user.username}
                                  </Link>
                                  <span className="text-gray-500"> added {post.mediaItems[0].title}</span>
                                </p>
                              );
                            }
                            
                            // Post with actual content about media (thoughts about a specific title)
                            return (
                              <p className="text-sm">
                                <Link 
                                  href={`/user/${post.user.id}`}
                                  className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                  data-testid={`link-user-${post.user.id}`}
                                >
                                  {post.user.username}
                                </Link>
                                <span className="text-gray-500"> added thoughts about {post.mediaItems[0].title}</span>
                              </p>
                            );
                          } else if (post.content && !hasMediaItems) {
                            // Check if this is a leaderboard achievement post
                            const isLeaderboardPost = isLeaderboardRankingPost(post.content);
                            if (isLeaderboardPost) {
                              return (
                                <p className="text-sm">
                                  <Link 
                                    href={`/user/${post.user.id}`}
                                    className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                    data-testid={`link-user-${post.user.id}`}
                                  >
                                    {post.user.username}
                                  </Link>
                                  <span className="text-gray-500"> hit the leaderboard</span>
                                </p>
                              );
                            }
                            // If content is short (looks like just a title), show it inline
                            // Otherwise show "added thoughts" and content separately
                            const isShortContent = post.content.length < 60 && !post.content.includes('\n');
                            if (isShortContent) {
                              return (
                                <p className="text-sm">
                                  <Link 
                                    href={`/user/${post.user.id}`}
                                    className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                    data-testid={`link-user-${post.user.id}`}
                                  >
                                    {post.user.username}
                                  </Link>
                                  <span className="text-gray-500"> added {post.content}</span>
                                </p>
                              );
                            }
                            // Thoughts post - has actual content to show
                            return (
                              <p className="text-sm">
                                <Link 
                                  href={`/user/${post.user.id}`}
                                  className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                  data-testid={`link-user-${post.user.id}`}
                                >
                                  {post.user.username}
                                </Link>
                                <span className="text-gray-500"> shared a thought</span>
                              </p>
                            );
                          } else {
                            return (
                              <Link 
                                href={`/user/${post.user.id}`}
                                className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                data-testid={`link-user-${post.user.id}`}
                              >
                                {post.user.username}
                              </Link>
                            );
                          }
                        })()}
                      </div>
                      {/* Use currentAppUserId for matching since auth UID may differ from app user ID */}
                      {currentAppUserId && post.user.id === currentAppUserId && (
                        <button
                          onClick={() => handleHidePost(post.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid={`button-hide-post-${post.id}`}
                          title="Hide from feed"
                        >
                          <EyeOff size={16} />
                        </button>
                      )}
                    </div>
                    ) : (
                    /* Fallback for posts missing user data - show user from grouped activities */
                    (() => {
                      const myActivity = post.groupedActivities?.find(a => currentAppUserId && a.userId === currentAppUserId);
                      const firstActivity = post.groupedActivities?.[0];
                      const displayUser = myActivity || firstActivity;
                      
                      return (
                        <div className="flex items-center space-x-2 mb-3">
                          {displayUser ? (
                            <>
                              <Link href={`/user/${displayUser.userId}`}>
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                                  {displayUser.avatar ? (
                                    <img src={displayUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    <span className="text-sm">{displayUser.displayName?.[0]?.toUpperCase() || displayUser.username?.[0]?.toUpperCase() || '?'}</span>
                                  )}
                                </div>
                              </Link>
                              <div className="flex-1">
                                {/* Username with action text for add/rate posts */}
                                {(() => {
                                  const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
                                  const contentLower = (post.content || '').toLowerCase();
                                  const isAddedPost = contentLower.startsWith('added ') || (!post.content && hasMediaItems && !post.rating);
                                  const isRatedPost = contentLower.startsWith('rated ') || post.rating;
                                  
                                  if (isAddedPost && hasMediaItems) {
                                    // Check if we have listData for the new format
                                    const listData = (post as any).listData;
                                    if (listData) {
                                      return (
                                        <p className="text-sm">
                                          <Link 
                                            href={`/user/${displayUser.userId}`}
                                            className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                            data-testid={`link-user-${displayUser.userId}`}
                                          >
                                            {displayUser.username}
                                          </Link>
                                          <span className="text-gray-500"> added to → </span>
                                          <Link 
                                            href={`/user/${displayUser.userId}?tab=lists`}
                                            className="font-medium text-purple-600 hover:text-purple-700"
                                          >
                                            {listData.title}
                                          </Link>
                                        </p>
                                      );
                                    }
                                    return (
                                      <p className="text-sm">
                                        <Link 
                                          href={`/user/${displayUser.userId}`}
                                          className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                          data-testid={`link-user-${displayUser.userId}`}
                                        >
                                          {displayUser.username}
                                        </Link>
                                        <span className="text-gray-500"> {post.content || `added ${post.mediaItems[0].title}`}</span>
                                      </p>
                                    );
                                  } else if (isRatedPost && hasMediaItems) {
                                    const listData = (post as any).listData;
                                    return (
                                      <p className="text-sm">
                                        <Link 
                                          href={`/user/${displayUser.userId}`}
                                          className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                          data-testid={`link-user-${displayUser.userId}`}
                                        >
                                          {displayUser.username}
                                        </Link>
                                        <span className="text-gray-500"> rated {post.mediaItems[0].title}</span>
                                        {listData && (
                                          <>
                                            <span className="text-gray-500"> → </span>
                                            <Link 
                                              href={`/user/${displayUser.userId}?tab=lists`}
                                              className="font-medium text-purple-600 hover:text-purple-700"
                                            >
                                              {listData.title}
                                            </Link>
                                          </>
                                        )}
                                      </p>
                                    );
                                  } else if (hasMediaItems) {
                                    // Post with media - just say "added [title]" regardless of whether there's content
                                    return (
                                      <p className="text-sm">
                                        <Link 
                                          href={`/user/${displayUser.userId}`}
                                          className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                          data-testid={`link-user-${displayUser.userId}`}
                                        >
                                          {displayUser.username}
                                        </Link>
                                        <span className="text-gray-500"> added {post.mediaItems[0].title}</span>
                                      </p>
                                    );
                                  } else if (post.content && !hasMediaItems) {
                                    // Check if this is a leaderboard achievement post
                                    const isLeaderboardPost = isLeaderboardRankingPost(post.content);
                                    if (isLeaderboardPost) {
                                      return (
                                        <p className="text-sm">
                                          <Link 
                                            href={`/user/${displayUser.userId}`}
                                            className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                            data-testid={`link-user-${displayUser.userId}`}
                                          >
                                            {displayUser.username}
                                          </Link>
                                          <span className="text-gray-500"> hit the leaderboard</span>
                                        </p>
                                      );
                                    }
                                    // Thoughts post - has content but no media
                                    return (
                                      <p className="text-sm">
                                        <Link 
                                          href={`/user/${displayUser.userId}`}
                                          className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                          data-testid={`link-user-${displayUser.userId}`}
                                        >
                                          {displayUser.username}
                                        </Link>
                                        <span className="text-gray-500"> added thoughts</span>
                                      </p>
                                    );
                                  } else {
                                    return (
                                      <Link 
                                        href={`/user/${displayUser.userId}`}
                                        className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                        data-testid={`link-user-${displayUser.userId}`}
                                      >
                                        {displayUser.username}
                                      </Link>
                                    );
                                  }
                                })()}
                              </div>
                            </>
                          ) : (
                            <div className="flex-1">
                            </div>
                          )}
                          {/* Show hide button if current user owns any activity in this post */}
                          {myActivity && (
                            <button
                              onClick={() => handleHidePost(myActivity.postId)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              data-testid={`button-hide-post-${post.id}`}
                              title="Hide from feed"
                            >
                              <EyeOff size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })()
                    )}

                  {/* Post Content - show review text and ratings */}
                  {(() => {
                    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
                    const contentLower = (post.content || '').toLowerCase();
                    const contentIsJustTitle = hasMediaItems && post.mediaItems[0]?.title && 
                      (post.content || '').toLowerCase().trim() === post.mediaItems[0].title.toLowerCase().trim();
                    
                    // Check if there's actual review text (not just "rated X", not empty, not just the title)
                    const hasReviewText = post.content && 
                      post.content.trim().length > 0 &&
                      !contentIsJustTitle && 
                      !contentLower.startsWith('rated ') &&
                      !contentLower.startsWith('added ');
                    
                    // For rated posts: show stars, then review if exists
                    const isRatedPost = post.rating && post.rating > 0;
                    
                    if (isRatedPost) {
                      return (
                        <div className="mb-2">
                          {/* Show rating stars */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const fillPercent = Math.min(Math.max((post.rating || 0) - (star - 1), 0), 1) * 100;
                              return (
                                <span key={star} className="relative inline-block w-4 h-4">
                                  <Star size={16} className="absolute text-gray-300" />
                                  <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                                    <Star size={16} className="fill-yellow-400 text-yellow-400" />
                                  </span>
                                </span>
                              );
                            })}
                            <span className="ml-1 text-sm font-semibold text-gray-700">{post.rating}/5</span>
                          </div>
                          {/* Show review text if present */}
                          {hasReviewText && (
                            <div className="text-gray-800 text-sm mt-2">
                              {post.containsSpoilers && !revealedSpoilers.has(post.id) ? (
                                <div className="relative">
                                  <p className="blur-md select-none">{post.content}</p>
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
                                </div>
                              ) : (
                                <p>{renderMentions(post.content || '')}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }
                    
                    // Non-rated posts
                    if (!post.content) return null;
                    if (contentIsJustTitle) return null;
                    if (contentLower.startsWith('added ') && contentLower.includes(' to ') && hasMediaItems) return null;
                    const isShortContentNoMedia = !hasMediaItems && post.content.length < 60 && !post.content.includes('\n');
                    if (isShortContentNoMedia) return null;
                    
                    return (
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
                    );
                  })()}

                  {/* Media Cards */}
                  {/* Unified media card for all post types */}
                  {(() => {
                    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
                    const contentLower = (post.content || '').toLowerCase();
                    // Check if content is just the media title - treat as added post
                    const contentIsJustTitle = hasMediaItems && post.mediaItems[0]?.title && 
                      (post.content || '').toLowerCase().trim() === post.mediaItems[0].title.toLowerCase().trim();
                    // Don't treat "thoughts" posts as simple "added" posts - they should show content + media card
                    const isThoughtsPost = !contentIsJustTitle && (contentLower.includes('thoughts') || (post.content && post.content.length > 50 && hasMediaItems));
                    const isAddedPost = contentIsJustTitle || (!isThoughtsPost && (post.type === 'added_to_list' || contentLower.startsWith('added ') || (!post.content && hasMediaItems && !post.rating)));
                    const hasListData = !!(post as any).listData;
                    
                    // For added_to_list posts, show full media card with actions
                    if (isAddedPost && hasMediaItems) {
                      const media = post.mediaItems[0];
                      const isClickable = media.externalId && media.externalSource;
                      
                      return (
                        <div className="mb-2">
                          {/* Full media card */}
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="flex gap-3">
                              <div 
                                className={`w-16 h-20 rounded overflow-hidden flex-shrink-0 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                onClick={() => {
                                  if (isClickable) {
                                    setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                  }
                                }}
                              >
                                <img 
                                  src={media.imageUrl || getMediaArtwork(media.title, media.mediaType)}
                                  alt={`${media.title} artwork`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div 
                                  className={`${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                  onClick={() => {
                                    if (isClickable) {
                                      setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                    }
                                  }}
                                >
                                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 hover:text-purple-600">
                                    {media.title}
                                  </h3>
                                  {media.creator && (
                                    <div className="text-gray-600 text-xs mb-0.5">
                                      by {media.creator}
                                    </div>
                                  )}
                                  <div className="text-gray-500 text-xs capitalize mb-2">
                                    {media.mediaType}
                                  </div>
                                </div>
                                {/* Actions - Add, Share, Available On */}
                                <MediaCardActions media={media} session={session} />
                              </div>
                              {isClickable && <ChevronRight className="text-gray-400 flex-shrink-0 mt-6" size={16} />}
                            </div>
                          </div>
                          
                          {/* Other list items if listData available */}
                          {hasListData && (post as any).listData?.items?.length > 1 && (
                            <div className="bg-white rounded-lg p-3 mt-2 border border-gray-100">
                              <div className="space-y-1">
                                {(post as any).listData.items.slice(0, 3).map((item: any, idx: number) => {
                                  const mediaTypeEmoji = item.mediaType?.toLowerCase() === 'book' ? '📚' :
                                    item.mediaType?.toLowerCase() === 'music' ? '🎵' :
                                    item.mediaType?.toLowerCase() === 'podcast' ? '🎧' :
                                    item.mediaType?.toLowerCase() === 'game' ? '🎮' : '🎬';
                                  return (
                                    <div 
                                      key={item.id || idx}
                                      className="flex items-center gap-1.5 cursor-pointer hover:text-purple-600 transition-colors"
                                      onClick={() => {
                                        if (item.externalId && item.externalSource) {
                                          setLocation(`/media/${item.mediaType?.toLowerCase()}/${item.externalSource}/${item.externalId}`);
                                        }
                                      }}
                                    >
                                      <span className="text-xs">{mediaTypeEmoji}</span>
                                      <span className="text-sm text-gray-800 truncate">{item.title}</span>
                                    </div>
                                  );
                                })}
                                {(post as any).listData.totalCount > 3 && (
                                  <Link
                                    href={`/list/${(post as any).listId}`}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                  >
                                    +{(post as any).listData.totalCount - 3} more →
                                  </Link>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    
                    // For posts with listData but no mediaItems - wrap list items in gray card
                    if (hasListData && !hasMediaItems && (post as any).listData?.items?.length > 0) {
                      return (
                        <div className="mb-2">
                          <div className="bg-gray-100 rounded-lg p-3">
                            <div className="space-y-1.5">
                              {(post as any).listData.items.slice(0, 5).map((item: any, idx: number) => {
                                const mediaTypeEmoji = item.mediaType?.toLowerCase() === 'book' ? '📚' :
                                  item.mediaType?.toLowerCase() === 'music' ? '🎵' :
                                  item.mediaType?.toLowerCase() === 'tv' ? '📺' :
                                  item.mediaType?.toLowerCase() === 'podcast' ? '🎧' :
                                  item.mediaType?.toLowerCase() === 'game' ? '🎮' : '🎬';
                                return (
                                  <div 
                                    key={item.id || idx}
                                    className="flex items-center gap-2 py-0.5 cursor-pointer hover:text-purple-600 transition-colors"
                                    onClick={() => {
                                      if (item.externalId && item.externalSource) {
                                        setLocation(`/media/${item.mediaType?.toLowerCase()}/${item.externalSource}/${item.externalId}`);
                                      }
                                    }}
                                  >
                                    <span className="text-sm">{mediaTypeEmoji}</span>
                                    <span className="text-sm text-gray-800 truncate">{item.title}</span>
                                  </div>
                                );
                              })}
                              {(post as any).listData.totalCount > 5 && (
                                <Link
                                  href={`/list/${(post as any).listId}`}
                                  className="text-xs text-purple-600 hover:text-purple-700 font-medium pt-1"
                                >
                                  +{(post as any).listData.totalCount - 5} more →
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // For posts with content and media (reviews, thoughts)
                    return post.content && post.mediaItems && post.mediaItems.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {post.mediaItems.map((media, index) => {
                        const isClickable = media.externalId && media.externalSource;
                        return (
                          <div 
                            key={index} 
                            className="bg-white rounded-lg p-3 transition-colors border border-gray-100"
                          >
                            <div className="flex space-x-3">
                              <div 
                                className={`w-12 h-16 rounded overflow-hidden flex-shrink-0 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                onClick={() => {
                                  if (isClickable) {
                                    setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                  }
                                }}
                              >
                                <img 
                                  src={media.imageUrl || getMediaArtwork(media.title, media.mediaType)}
                                  alt={`${media.title} artwork`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div 
                                  className={`${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                  onClick={() => {
                                    if (isClickable) {
                                      setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                    }
                                  }}
                                >
                                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 hover:text-purple-600">
                                    {media.title}
                                  </h3>
                                  {media.creator && (
                                    <div className="text-gray-600 text-xs mb-0.5">
                                      by {media.creator}
                                    </div>
                                  )}
                                  <div className="text-gray-500 text-xs capitalize mb-2">
                                    {media.mediaType}
                                  </div>
                                </div>
                                {/* Quick Actions - inline with content */}
                                <MediaCardActions media={media} session={session} />
                              </div>
                              {isClickable && <ChevronRight className="text-gray-400 flex-shrink-0 mt-4" size={16} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !post.content && post.mediaItems && post.mediaItems.length > 0 && (
                      <div className="mb-2">
                        {/* List Preview Card for posts - show compact format even without listData */}
                        {(post.type === 'added_to_list' || (post.type === 'rate-review' && (post as any).listData)) && post.mediaItems && post.mediaItems.length > 0 ? (
                          <div className="bg-white rounded-lg p-3 mb-2 border border-gray-100">
                            <div className="flex gap-3">
                              {/* Poster on left - only show if single item */}
                              {((post as any).listData?.items?.length || post.mediaItems.length) === 1 && (
                                <div 
                                  className="w-16 h-20 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                                  onClick={() => {
                                    const media = post.mediaItems[0];
                                    if (media.externalId && media.externalSource) {
                                      setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                    }
                                  }}
                                >
                                  <img 
                                    src={post.mediaItems[0].imageUrl || getMediaArtwork(post.mediaItems[0].title, post.mediaItems[0].mediaType)}
                                    alt={`${post.mediaItems[0].title} artwork`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              
                              {/* List items - use listData.items if available, otherwise use mediaItems */}
                              <div className="flex-1 min-w-0 space-y-1">
                                {((post as any).listData?.items || post.mediaItems).slice(0, 3).map((item: any, idx: number) => {
                                  const mediaTypeEmoji = item.mediaType?.toLowerCase() === 'book' ? '📚' :
                                    item.mediaType?.toLowerCase() === 'music' ? '🎵' :
                                    item.mediaType?.toLowerCase() === 'podcast' ? '🎧' :
                                    item.mediaType?.toLowerCase() === 'game' ? '🎮' : '🎬';
                                  return (
                                    <div 
                                      key={item.id || idx}
                                      className="flex items-center gap-1.5 cursor-pointer hover:text-purple-600 transition-colors"
                                      onClick={() => {
                                        if (item.externalId && item.externalSource) {
                                          setLocation(`/media/${item.mediaType?.toLowerCase()}/${item.externalSource}/${item.externalId}`);
                                        }
                                      }}
                                    >
                                      <span className="text-xs">{mediaTypeEmoji}</span>
                                      <span className="text-sm text-gray-800 truncate">{item.title}</span>
                                    </div>
                                  );
                                })}
                                {(post as any).listData?.totalCount > 3 && (
                                  <Link
                                    href={`/user/${post.user?.id}?tab=lists`}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                  >
                                    +{(post as any).listData.totalCount - 3} more →
                                  </Link>
                                )}
                              </div>
                            </div>
                            
                            {/* Rating stars if post has a rating (for list posts with ratings) */}
                            {post.rating && post.rating > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const fillPercent = Math.min(Math.max((post.rating || 0) - (star - 1), 0), 1) * 100;
                                  return (
                                    <span key={star} className="relative inline-block w-4 h-4">
                                      <Star size={16} className="absolute text-gray-300" />
                                      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                                        <Star size={16} className="fill-yellow-400 text-yellow-400" />
                                      </span>
                                    </span>
                                  );
                                })}
                                <span className="ml-1 text-sm font-semibold text-gray-700">{post.rating}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                        /* Standard Media Card for other posts */
                        <div className="bg-white rounded-lg p-3 mb-2 border border-gray-100">
                          <div className="flex space-x-3">
                            <div 
                              className="w-16 h-20 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                              onClick={() => {
                                const media = post.mediaItems[0];
                                if (media.externalId && media.externalSource) {
                                  setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                }
                              }}
                            >
                              <img 
                                src={post.mediaItems[0].imageUrl || getMediaArtwork(post.mediaItems[0].title, post.mediaItems[0].mediaType)}
                                alt={`${post.mediaItems[0].title} artwork`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div 
                                className="cursor-pointer"
                                onClick={() => {
                                  const media = post.mediaItems[0];
                                  if (media.externalId && media.externalSource) {
                                    setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                                  }
                                }}
                              >
                                <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 hover:text-purple-600">
                                  {post.mediaItems[0].title}
                                </h3>
                                {post.mediaItems[0].creator && (
                                  <div className="text-gray-600 text-xs mb-0.5">
                                    by {post.mediaItems[0].creator}
                                  </div>
                                )}
                                <div className="text-gray-500 text-xs capitalize mb-2">
                                  {post.mediaItems[0].mediaType}
                                </div>
                              </div>
                              {/* Platform badges and actions inline */}
                              <MediaCardActions media={post.mediaItems[0]} session={session} />
                            </div>
                            <ChevronRight className="text-gray-400 flex-shrink-0 mt-6" size={20} />
                          </div>
                        </div>
                        )}
                        
                        {/* See more of user's lists link for added_to_list posts */}
                        {(() => {
                          // Get user info from post.user or fallback to groupedActivities
                          let userId: string | undefined;
                          let username: string | undefined;
                          
                          if (post.user) {
                            userId = post.user.id;
                            username = post.user.username;
                          } else if (post.groupedActivities?.[0]) {
                            const activity = post.groupedActivities[0] as any;
                            userId = activity.userId;
                            username = activity.username;
                          }
                          
                          if (!userId || !username) return null;
                          
                          // Get the first name or username for display
                          const displayName = username.replace(/consumed|IsConsumed/gi, '').trim() || username;
                          
                          return (
                            <Link
                              href={`/user/${userId}?tab=lists`}
                              className="text-sm text-purple-600 hover:text-purple-700 transition-colors font-medium"
                              data-testid={`link-see-lists-${userId}`}
                            >
                              See more of {displayName}'s lists →
                            </Link>
                          );
                        })()}
                      </div>
                    )
                  );
                  })()}

                  {/* Interaction Bar */}
                  <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        {/* Like button - uses realPostId for grouped posts */}
                        <button 
                          onClick={() => handleLike(realPostId)}
                          disabled={likeMutation.isPending}
                          className={`flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            likedPosts.has(realPostId) 
                              ? 'text-red-500' 
                              : 'text-gray-500 hover:text-red-500'
                          }`}
                          data-testid={`button-like-${post.id}`}
                        >
                          <Heart 
                            size={18} 
                            fill={likedPosts.has(realPostId) ? 'currentColor' : 'none'}
                          />
                          <span className="text-sm">{post.likes}</span>
                        </button>
                        <button 
                          onClick={() => toggleComments(realPostId)}
                          className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
                        >
                          <MessageCircle size={18} />
                          <span className="text-sm">{post.comments}</span>
                        </button>
                        {/* Star rating for posts with media */}
                        {post.mediaItems && post.mediaItems.length > 0 && !activeInlineRating && (
                          <button 
                            onClick={() => toggleInlineRating(post.id)}
                            className="flex items-center space-x-1 text-gray-500 hover:text-yellow-500 transition-colors"
                            data-testid={`button-rate-${post.id}`}
                          >
                            <Star size={18} />
                          </button>
                        )}
                        {post.mediaItems && post.mediaItems.length > 0 && activeInlineRating === post.id && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const currentVal = parseFloat(inlineRatings[post.id] || '0');
                              const isFullFilled = currentVal >= star;
                              const isHalfFilled = currentVal >= star - 0.5 && currentVal < star;
                              const media = post.mediaItems[0];
                              return (
                                <div
                                  key={star}
                                  className="relative p-0.5 cursor-pointer"
                                  data-testid={`star-${star}-post-${post.id}`}
                                >
                                  <Star size={18} className="text-gray-300" />
                                  <div 
                                    className="absolute inset-0 overflow-hidden p-0.5"
                                    style={{ width: isFullFilled ? '100%' : isHalfFilled ? '50%' : '0%' }}
                                  >
                                    <Star size={18} className="text-yellow-400 fill-yellow-400" />
                                  </div>
                                  <div 
                                    className="absolute inset-y-0 left-0 w-1/2"
                                    onMouseEnter={() => handleInlineRatingChange(post.id, String(star - 0.5))}
                                    onClick={() => {
                                      handleInlineRatingChange(post.id, String(star - 0.5));
                                      setTimeout(() => submitInlineRating(post.id, media), 100);
                                    }}
                                  />
                                  <div 
                                    className="absolute inset-y-0 right-0 w-1/2"
                                    onMouseEnter={() => handleInlineRatingChange(post.id, String(star))}
                                    onClick={() => {
                                      handleInlineRatingChange(post.id, String(star));
                                      setTimeout(() => submitInlineRating(post.id, media), 100);
                                    }}
                                  />
                                </div>
                              );
                            })}
                            <button
                              onClick={() => setActiveInlineRating(null)}
                              className="ml-1 text-xs text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {/* Bet button - only show for Currently/Want To list posts */}
                        {(() => {
                          const listData = (post as any).listData;
                          const listNames = (post as any).listNames as string[] | undefined;
                          
                          // Check multiple sources for list name
                          const listTitle = (listData?.title || listNames?.[0] || '').toLowerCase();
                          
                          // Direct check for bettable lists
                          const isBettableList = listTitle === 'currently' || listTitle === 'want to';
                          const hasMedia = post.mediaItems && post.mediaItems.length > 0;
                          const isOwnPost = currentAppUserId && post.user?.id === currentAppUserId;
                          const userName = formatUsername(post.user?.username);
                          
                          // Only show bet button for other users' posts (can't bet on your own)
                          if (isBettableList && hasMedia && !activeInlineRating && !isOwnPost) {
                            const media = post.mediaItems[0];
                            return (
                              <button 
                                onClick={() => setActiveBetPost({
                                  postId: post.id,
                                  mediaTitle: media.title,
                                  userName,
                                  targetUserId: post.user?.id || '',
                                  externalId: media.externalId,
                                  externalSource: media.externalSource,
                                  mediaType: media.mediaType
                                })}
                                className="flex items-center space-x-1 text-gray-500 hover:text-purple-500 transition-colors"
                                data-testid={`button-bet-${post.id}`}
                                title="Bet on their reaction"
                              >
                                <Dices size={18} />
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(post.timestamp)}
                      </div>
                    </div>

                    {/* Comments Section - uses realPostId for grouped posts */}
                    {expandedComments.has(realPostId) && (
                      <CommentsSection 
                        postId={realPostId}
                        fetchComments={fetchComments}
                        session={session}
                        commentInput={commentInputs[realPostId] || ''}
                        onCommentInputChange={(value) => handleCommentInputChange(realPostId, value)}
                        onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(realPostId, parentCommentId, content)}
                        isSubmitting={commentMutation.isPending}
                        currentUserId={user?.id}
                        onDeleteComment={handleDeleteComment}
                        onLikeComment={commentLikesEnabled ? handleLikeComment : undefined}
                        onVoteComment={handleVoteComment}
                        likedComments={likedComments}
                        commentVotes={commentVotes}
                      />
                    )}
                  </div>
                  </div>

                </div>
              );
              })}

              {/* Infinite Scroll Loading Indicator - DISABLED */}
              {/* 
              {isFetchingNextPage && (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-500 mt-3">Loading more posts...</p>
                </div>
              )}
              */}

              {/* Intersection Observer Target - DISABLED */}
              {/* 
              {hasNextPage && !isFetchingNextPage && (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <div ref={loadMoreRef} className="h-20" />
              )}
              */}

              {/* Category carousels for trivia filter */}
              {selectedFilter === 'trivia' && (
                <div className="space-y-4 mt-4">
                  <div className="text-center py-4">
                    <p className="text-gray-700 font-semibold">Browse by Category</p>
                  </div>
                  <TriviaCarousel category="Movies" />
                  <TriviaCarousel category="TV" />
                  <TriviaCarousel category="Books" />
                  <TriviaCarousel category="Music" />
                  <TriviaCarousel category="Sports" />
                  <TriviaCarousel category="Podcasts" />
                  <TriviaCarousel category="Other" />
                </div>
              )}

              {/* Category carousels for polls filter */}
              {selectedFilter === 'polls' && (
                <div className="space-y-4 mt-4">
                  <div className="text-center py-4">
                    <p className="text-gray-700 font-semibold">Browse by Category</p>
                  </div>
                  <PollsCarousel category="Movies" />
                  <PollsCarousel category="TV" />
                  <PollsCarousel category="Books" />
                  <PollsCarousel category="Music" />
                  <PollsCarousel category="Sports" />
                  <PollsCarousel category="Podcasts" />
                  <PollsCarousel category="Other" />
                </div>
              )}

              {/* Predictions Filter - Show all awards */}
              {selectedFilter === 'predictions' && (
                <div className="space-y-3">
                  {/* 2026 Academy Awards - Coming Soon */}
                  <div className="bg-gradient-to-r from-amber-900 via-yellow-800 to-amber-900 rounded-2xl p-4 shadow-lg border border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-lg">2026 Academy Awards</h3>
                          <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-medium rounded-full">COMING SOON</span>
                        </div>
                        <p className="text-amber-200/80 text-sm">Nominations announced soon - be ready to predict!</p>
                      </div>
                    </div>
                  </div>

                  {/* 2026 Grammy Awards - Coming Soon */}
                  <div className="bg-gradient-to-r from-rose-900 via-pink-800 to-rose-900 rounded-2xl p-4 shadow-lg border border-rose-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-lg">2026 Grammy Awards</h3>
                          <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-medium rounded-full">COMING SOON</span>
                        </div>
                        <p className="text-rose-200/80 text-sm">Music's biggest night - predictions opening soon</p>
                      </div>
                    </div>
                  </div>

                  {/* 2026 Emmy Awards - Coming Soon */}
                  <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-900 rounded-2xl p-4 shadow-lg border border-blue-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Tv2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-lg">2026 Emmy Awards</h3>
                          <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-medium rounded-full">COMING SOON</span>
                        </div>
                        <p className="text-blue-200/80 text-sm">Television's finest - stay tuned for nominations</p>
                      </div>
                    </div>
                  </div>

                  {/* End message */}
                  <div className="text-center py-4 text-gray-400 text-sm">
                    More award shows coming soon!
                  </div>
                </div>
              )}

              {/* End of Feed message for DNA filter only */}
              {selectedFilter === 'dna' && (
                <div className="text-center py-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 mt-4">
                  <div className="text-3xl mb-2">🧬</div>
                  <p className="text-gray-600 font-medium">That's all for now!</p>
                  <p className="text-gray-500 text-sm mt-1">Check back later for more DNA moments</p>
                </div>
              )}

              {/* End of Feed - keep it clean, no message */}
              {!hasNextPage && filteredPosts.length > 0 && (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <div className="h-8" />
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


      <QuickAddModal
        isOpen={isTrackModalOpen}
        onClose={() => {
          setIsTrackModalOpen(false);
          setTrackModalPreSelectedMedia(null);
        }}
        preSelectedMedia={trackModalPreSelectedMedia}
      />

      <QuickAddListSheet
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddMedia(null);
        }}
        media={quickAddMedia}
      />

      {/* Bet Modal - Will they like it? */}
      {activeBetPost && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl animate-in slide-in-from-bottom duration-300">
            <div className="p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                <Dices size={24} className="text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Place Your Bet</h3>
              <p className="text-gray-600 text-sm mb-6">
                Will {activeBetPost.userName} like<br />
                <span className="font-semibold text-gray-900">{activeBetPost.mediaTitle}</span>?
              </p>
              
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => handlePlaceBet('will_like')}
                  disabled={isPlacingBet}
                  className="flex-1 py-4 px-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="bet-love-it"
                >
                  {isPlacingBet ? (
                    <div className="w-7 h-7 mx-auto mb-2 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ThumbsUp size={28} className="mx-auto mb-2 text-green-600" />
                  )}
                  <span className="font-semibold text-green-700">They'll love it</span>
                </button>
                <button
                  onClick={() => handlePlaceBet('will_dislike')}
                  disabled={isPlacingBet}
                  className="flex-1 py-4 px-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="bet-wont-like"
                >
                  {isPlacingBet ? (
                    <div className="w-7 h-7 mx-auto mb-2 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ThumbsDown size={28} className="mx-auto mb-2 text-red-500" />
                  )}
                  <span className="font-semibold text-red-600">Nope</span>
                </button>
              </div>
              
              <p className="text-xs text-gray-400 mb-4">
                🏆 Win 5 points if you're right!
              </p>
              
              <button
                onClick={() => setActiveBetPost(null)}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      <FeedbackDialog isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      </div>
    </div>
  );
}