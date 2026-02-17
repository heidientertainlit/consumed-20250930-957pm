import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import Navigation from "@/components/navigation";
import { QuickAddModal } from "@/components/quick-add-modal";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import PlayCard from "@/components/play-card";
import GameCarousel from "@/components/game-carousel";
import InlineGameCard from "@/components/inline-game-card";
import PointsAchievementCard from "@/components/points-achievement-card";
import MediaCarousel from "@/components/media-carousel";
import FeedHero from "@/components/feed-hero";
import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { DnaMomentCard } from "@/components/dna-moment-card";
import { TriviaCarousel } from "@/components/trivia-carousel";
import CastApprovalCard from "@/components/cast-approval-card";
import SeenItGame from "@/components/seen-it-game";
import { LeaderboardGlimpse } from "@/components/leaderboard-glimpse";
import { PollsCarousel } from "@/components/polls-carousel";
import { RecommendationsGlimpse } from "@/components/recommendations-glimpse";
import { GamesCarousel } from "@/components/games-carousel";
import { RanksCarousel } from "@/components/ranks-carousel";
import { AwardsCompletionFeed } from "@/components/awards-completion-feed";
import { PointsGlimpse } from "@/components/points-glimpse";
import { QuickReactCard } from "@/components/quick-react-card";
import { HotTakeFeedCard } from "@/components/hot-take-feed-card";
import { Star, Heart, MessageCircle, Share, ChevronRight, Check, Badge, User, Vote, TrendingUp, Lightbulb, Users, Film, Send, Trash2, MoreVertical, Eye, EyeOff, Plus, ExternalLink, Sparkles, Book, Music, Tv2, Gamepad2, Headphones, Flame, Snowflake, Target, HelpCircle, Activity, ArrowUp, ArrowDown, Forward, Search as SearchIcon, X, Dices, ThumbsUp, ThumbsDown, Edit3, Brain, BarChart, Dna, Trophy, Medal, ListPlus, SlidersHorizontal, Play } from "lucide-react";
import CommentsSection from "@/components/comments-section";
import CreatorUpdateCard from "@/components/creator-update-card";
import CollaborativePredictionCard from "@/components/collaborative-prediction-card";
import { UserPollsCarousel } from "@/components/user-polls-carousel";
import { type UGCPost } from "@/components/user-content-carousel";
import ConversationsPanel from "@/components/conversations-panel";
import FeedFiltersDialog, { FeedFilters } from "@/components/feed-filters-dialog";
import RankFeedCard from "@/components/rank-feed-card";
import ConsolidatedActivityCard, { ConsolidatedActivity } from "@/components/consolidated-activity-card";
import GroupedActivityCard from "@/components/grouped-activity-card";
import RecommendationCard from "@/components/recommendation-card";
import ConsumptionCarousel from "@/components/consumption-carousel";
import SwipeableRatingCards from "@/components/swipeable-rating-cards";
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
  postType?: string;
  fire_votes?: number;
  ice_votes?: number;
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
    
    // Debug: Check for cast_approved posts before filtering
    const castApprovedBefore = data.posts.filter((p: any) => p.type === 'cast_approved');
    console.log('🎬 Cast_approved posts BEFORE filter:', castApprovedBefore.length, castApprovedBefore.map((p: any) => ({ id: p.id, type: p.type, content: p.content, hasMedia: !!p.mediaItems?.length })));
    
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
    
    // Debug: Check for cast_approved posts after filtering
    const castApprovedAfter = filteredPosts.filter((p: any) => p.type === 'cast_approved');
    console.log('🎬 Cast_approved posts AFTER filter:', castApprovedAfter.length);
    
    // Debug: Check for hot_take posts
    const hotTakePosts = data.posts.filter((p: any) => p.type === 'hot_take');
    console.log('🔥 Hot take posts in feed:', hotTakePosts.length, hotTakePosts.map((p: any) => ({ id: p.id, type: p.type, content: p.content })));
    
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
    
    const fixedPosts = filteredPosts.map((post: any) => {
      if (post.mediaItems?.length > 0) {
        return {
          ...post,
          mediaItems: post.mediaItems.map((m: any) => {
            const src = m.externalSource || m.external_source || '';
            const eid = m.externalId || m.external_id || '';
            if (src === 'googlebooks' && eid) {
              return { ...m, imageUrl: `https://books.google.com/books/content?id=${eid}&printsec=frontcover&img=1&zoom=1`, image_url: `https://books.google.com/books/content?id=${eid}&printsec=frontcover&img=1&zoom=1` };
            }
            if (src === 'open_library' && eid) {
              return { ...m, imageUrl: `https://covers.openlibrary.org/b/olid/${eid}-L.jpg`, image_url: `https://covers.openlibrary.org/b/olid/${eid}-L.jpg` };
            }
            return m;
          })
        };
      }
      return post;
    });
    return fixedPosts;
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
      
      if (isDuplicate) {
        toast({
          title: "Already in list!",
          description: `${media.title} is already in this list.`,
        });
      }
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

function StandalonePost({ post, onLike, onComment, onFireVote, onIceVote, isLiked, isCommentsActive, onCloseComments, fetchComments, onSubmitComment, isSubmitting, session, currentUserId, onDeleteComment, onDeletePost }: {
  post: UGCPost;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onFireVote?: (id: string) => void;
  onIceVote?: (id: string) => void;
  isLiked?: boolean;
  isCommentsActive?: boolean;
  onCloseComments?: () => void;
  fetchComments?: (postId: string) => Promise<any[]>;
  onSubmitComment?: (postId: string, content: string) => void;
  isSubmitting?: boolean;
  session?: any;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onDeletePost?: (postId: string) => void;
}) {
  const username = post.user?.displayName || post.user?.username || 'Someone';
  const avatarLetter = username[0]?.toUpperCase() || '?';
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const hasFetchedComments = useRef(false);

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'hot_take': return { label: 'Hot Take', color: 'text-orange-500', bg: 'bg-orange-50', icon: Flame };
      case 'review': return { label: 'Review', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: Star };
      case 'rating': return { label: 'Rating', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: Star };
      case 'thought': return { label: 'Thought', color: 'text-blue-400', bg: 'bg-blue-50', icon: MessageCircle };
      default: return { label: 'Post', color: 'text-gray-400', bg: 'bg-gray-50', icon: MessageCircle };
    }
  };

  const typeInfo = getTypeInfo(post.type);
  const TypeIcon = typeInfo.icon;

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  };

  useEffect(() => {
    if (isCommentsActive && !hasFetchedComments.current && fetchComments) {
      hasFetchedComments.current = true;
      setLoadingComments(true);
      fetchComments(post.id).then(data => {
        setComments(data || []);
        setLoadingComments(false);
      }).catch(() => setLoadingComments(false));
    }
  }, [isCommentsActive, post.id]);

  const handleSubmitComment = () => {
    if (!commentText.trim() || !onSubmitComment) return;
    onSubmitComment(post.id, commentText.trim());
    setCommentText('');
    setTimeout(() => {
      if (fetchComments) {
        fetchComments(post.id).then(data => setComments(data || []));
      }
    }, 1000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/user/${post.user?.id || ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-semibold cursor-pointer flex-shrink-0">
              {post.user?.avatar ? (
                <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : avatarLetter}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/user/${post.user?.id || ''}`}>
                <span className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer text-sm">{username}</span>
              </Link>
              <div className="ml-auto flex items-center gap-1.5">
                {post.mediaType && (
                  <span className="text-[11px] font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full capitalize">
                    {post.mediaType === 'tv' ? 'TV' : post.mediaType}
                  </span>
                )}
                {currentUserId && post.user?.id === currentUserId && onDeletePost && (
                  <button onClick={() => onDeletePost(post.id)} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {!post.mediaTitle && post.rating && post.rating > 0 && (
              <div className="flex items-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} size={13} className={s <= post.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                ))}
              </div>
            )}

            {post.content && !post.mediaTitle && (
              <p className="text-gray-800 text-sm leading-relaxed mt-2">{post.content}</p>
            )}
          </div>
        </div>

        {post.mediaTitle && (
          <div className="flex gap-3 mt-2">
            {post.mediaImage && post.mediaImage.startsWith('http') && (
              post.externalId && post.externalSource ? (
                <Link href={`/media/${post.mediaType || 'movie'}/${post.externalSource}/${post.externalId}`}>
                  <img
                    src={post.mediaImage}
                    alt={post.mediaTitle}
                    className="w-20 h-[120px] rounded-xl object-cover flex-shrink-0 shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </Link>
              ) : (
                <img
                  src={post.mediaImage}
                  alt={post.mediaTitle}
                  className="w-20 h-[120px] rounded-xl object-cover flex-shrink-0 shadow-md"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              {post.externalId && post.externalSource ? (
                <Link href={`/media/${post.mediaType || 'movie'}/${post.externalSource}/${post.externalId}`}>
                  <p className="text-sm font-semibold text-gray-900 hover:text-purple-600 cursor-pointer line-clamp-2">{post.mediaTitle}</p>
                </Link>
              ) : (
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{post.mediaTitle}</p>
              )}
              {post.rating && post.rating > 0 && (
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={14} className={s <= post.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                  ))}
                </div>
              )}
              {post.content && (
                <p className="text-gray-700 text-sm leading-relaxed mt-1.5 line-clamp-3">{post.content}</p>
              )}
            </div>
          </div>
        )}
        {post.mediaTitle && !(post.mediaImage && post.mediaImage.startsWith('http')) && post.content && (
          <p className="text-gray-800 text-sm leading-relaxed mt-2">{post.content}</p>
        )}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
          {post.type === 'hot_take' ? (
            <>
              <button
                onClick={() => onFireVote?.(post.id)}
                className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 active:scale-110 transition-transform"
              >
                <Flame size={16} /> <span className="text-xs">{post.fire_votes || 0}</span>
              </button>
              <button
                onClick={() => onIceVote?.(post.id)}
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-500 active:scale-110 transition-transform"
              >
                <Snowflake size={16} /> <span className="text-xs">{post.ice_votes || 0}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onLike?.(post.id)}
              className={`flex items-center gap-1.5 text-sm ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'} active:scale-110 transition-transform`}
            >
              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
              <span className="text-xs">{post.likes || 0}</span>
            </button>
          )}
          <button
            onClick={() => onComment?.(post.id)}
            className={`flex items-center gap-1.5 text-sm ${isCommentsActive ? 'text-purple-500' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
          >
            <MessageCircle size={16} />
            <span className="text-xs">{post.comments || 0}</span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`text-[11px] font-medium ${typeInfo.color} flex items-center gap-1 ${typeInfo.bg} px-2 py-0.5 rounded-full`}>
              <TypeIcon size={11} />
              {typeInfo.label}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(post.timestamp)}</span>
          </div>
        </div>

        {isCommentsActive && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {loadingComments ? (
              <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto mb-2">
                {comments.slice(0, 5).map((comment: any) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={12} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-800">{comment.user?.username || comment.user?.displayName || 'User'}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
                        {currentUserId && comment.user?.id === currentUserId && onDeleteComment && (
                          <button
                            onClick={() => {
                              onDeleteComment(String(comment.id), post.id);
                              setComments(prev => prev.filter(c => c.id !== comment.id));
                            }}
                            className="text-gray-400 hover:text-red-500 ml-auto p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-tight">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {session && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                  placeholder="Add comment..."
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-purple-300 placeholder-gray-400"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || isSubmitting}
                  className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
  
  const rawMedia = post.mediaItems![0];
  const media = (() => {
    const src = rawMedia.externalSource;
    const eid = rawMedia.externalId;
    if (src === 'googlebooks' && eid) {
      return { ...rawMedia, imageUrl: `https://books.google.com/books/content?id=${eid}&printsec=frontcover&img=1&zoom=1` };
    }
    if (src === 'open_library' && eid) {
      return { ...rawMedia, imageUrl: `https://covers.openlibrary.org/b/olid/${eid}-L.jpg` };
    }
    return rawMedia;
  })();
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
  
  // Get display name - prefer displayName from API, fallback to cleaned username
  const displayName = post.user?.displayName || (post.user?.username || '').replace(/consumed|IsConsumed/gi, '').trim() || post.user?.username;
  
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
                    <span className="font-semibold hover:text-purple-600 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
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
                  post.user?.displayName || formatUsername(post.user?.username),
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryPills, setShowCategoryPills] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
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
  // Store in state so the highlighted post persists after URL cleanup
  const searchString = useSearch();
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(searchString);
    const postId = urlParams.get('post');
    const commentId = urlParams.get('comment');
    if (postId) {
      setHighlightPostId(postId);
      setHighlightCommentId(commentId);
    }
  }, [searchString]);
  
  // Feature flag for comment likes
  const commentLikesEnabled = import.meta.env.VITE_FEED_COMMENT_LIKES === 'true';
  
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
  const friendIds = new Set(friendsData.map((friend: any) => friend.friend?.id || friend.id).filter(Boolean));

  const { data: friendsConsuming = [] } = useQuery({
    queryKey: ['friends-consuming', Array.from(friendIds).sort().join(',')],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const targetIds = friendIds.size > 0 ? Array.from(friendIds) : [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      try {
        console.log('🍿 Fetching friends consuming... targetIds:', targetIds.length);
        const response = await fetch(`${supabaseUrl}/functions/v1/get-friends-consuming`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ friendIds: targetIds }),
        });
        
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.log('🍿 Friends consuming fetch failed:', response.status, errText);
          return [];
        }
        
        const data = await response.json();
        console.log('🍿 Friends consuming data:', data.items?.length || 0, 'items');
        return data.items || [];
      } catch (err: any) {
        console.error('🍿 Friends consuming error:', err?.message || err);
        return [];
      }
    },
    enabled: !!session?.access_token,
    staleTime: 60000,
  });

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

  // Fetch specific highlighted post when coming from a notification
  const { data: highlightedPost } = useQuery({
    queryKey: ["highlighted-post", highlightPostId],
    queryFn: async () => {
      if (!highlightPostId || !session?.access_token) return null;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed?post_id=${highlightPostId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) return null;
      const data = await response.json();
      return data.posts?.[0] || null;
    },
    enabled: !!highlightPostId && !!session?.access_token,
  });

  // Flatten all pages into a single array, prepending highlighted post if not already included
  const basePosts = infinitePosts?.pages.flat() || [];
  const socialPosts = highlightedPost && !basePosts.find((p: any) => p.id === highlightedPost.id)
    ? [highlightedPost, ...basePosts]
    : basePosts;

  // Helper: filter social posts by selected media category
  const categoryToMediaTypeMap: { [key: string]: string[] } = {
    'movies': ['movie', 'film'],
    'tv': ['tv', 'tv_show', 'tv show', 'series'],
    'music': ['music', 'album', 'song', 'track'],
    'books': ['book', 'ebook', 'audiobook'],
    'sports': ['sports', 'sport'],
    'podcasts': ['podcast'],
    'gaming': ['game', 'gaming', 'video_game'],
  };

  const filterByCategory = (posts: any[]) => {
    if (!selectedCategory) return posts;
    const allowedTypes = categoryToMediaTypeMap[selectedCategory] || [];
    if (allowedTypes.length === 0) return posts;
    return posts.filter((p: any) => {
      if (!p.mediaItems || p.mediaItems.length === 0) return false;
      return p.mediaItems.some((m: any) => {
        const mt = m.mediaType?.toLowerCase() || '';
        return allowedTypes.includes(mt);
      });
    });
  };

  const ugcSlots: UGCPost[][] = (() => {
    const isAutoGen = (text: string) => !text || text.startsWith('Added ') || text.startsWith('"Added ') || /^"?Added .+ to .+"?$/i.test(text);
    const pool: UGCPost[] = filterByCategory(socialPosts || [])
      .filter((p: any) => {
        const hasUser = p.user?.id && p.user?.username && p.user.username !== 'Unknown';
        const hasCreator = p.creator?.id && p.creator?.username && p.creator.username !== 'Unknown';
        if (!hasUser && !hasCreator) return false;
        if (p.type === 'cast_approved') return true;
        if (p.type === 'hot_take' || p.post_type === 'hot_take') return true;
        if (p.type === 'ask_for_rec' || p.type === 'ask_for_recs') return true;
        if ((p.type === 'poll' || p.type === 'predict' || p.type === 'prediction') && ((p as any).question || (p as any).options)) return true;
        if (p.type === 'rank' || p.type === 'shared_rank') return true;
        const content = (p.content || '').trim();
        if (p.rating && p.rating > 0) return true;
        if (content.length > 20 && !isAutoGen(content)) return true;
        if (content.toLowerCase().includes('finished') || content.toLowerCase().includes('completed')) return true;
        return false;
      })
      .map((p: any): UGCPost => {
        let postType: UGCPost['type'] = 'general';
        const content = (p.content || '').trim();
        if (p.type === 'hot_take' || p.post_type === 'hot_take') postType = 'hot_take';
        else if (p.type === 'ask_for_rec' || p.type === 'ask_for_recs') postType = 'ask_for_rec';
        else if ((p.type === 'predict' || p.type === 'prediction') && ((p as any).question || (p as any).options)) postType = 'predict';
        else if (p.type === 'poll' && ((p as any).question || (p as any).options)) postType = 'poll';
        else if (p.type === 'cast_approved') postType = 'cast_approved';
        else if (p.type === 'rank' || p.type === 'shared_rank') postType = 'rank';
        else if (content.toLowerCase().includes('finished') || content.toLowerCase().includes('completed')) postType = 'finished';
        else if (p.rating && p.rating > 0 && content.length > 20) postType = 'review';
        else if (p.rating && p.rating > 0) postType = 'rating';
        else postType = 'thought';

        const media = p.mediaItems?.[0];
        let mediaImg = media?.imageUrl || media?.image_url || media?.poster_url || '';
        const src = media?.externalSource || media?.external_source || 'tmdb';
        const eid = media?.externalId || media?.external_id;
        if (src === 'googlebooks' && eid) mediaImg = `https://books.google.com/books/content?id=${eid}&printsec=frontcover&img=1&zoom=1`;
        else if (src === 'open_library' && eid) mediaImg = `https://covers.openlibrary.org/b/olid/${eid}-L.jpg`;

        const userObj = p.user || p.creator;
        return {
          id: p.id, type: postType,
          user: { id: userObj?.id || '', username: userObj?.username || '', displayName: userObj?.displayName || userObj?.display_name || userObj?.username || '', avatar: userObj?.avatar_url || userObj?.avatarUrl || userObj?.avatar || '' },
          content: (postType === 'poll' || postType === 'predict') ? ((p as any).question || content) : content,
          mediaTitle: media?.title || (p as any).mediaTitle, mediaType: media?.mediaType || media?.type, mediaImage: mediaImg, externalId: eid, externalSource: src,
          rating: p.rating, likes: p.likes || p.likes_count || 0, comments: p.comments || p.comments_count || 0,
          fire_votes: p.fire_votes || 0, ice_votes: p.ice_votes || 0,
          options: (p as any).options || [], optionVotes: (p as any).optionVotes || [], timestamp: p.createdAt || p.created_at || p.timestamp, pollId: (p as any).poolId || p.id,
          userHasVoted: (p as any).userHasAnswered || false,
          userVotedOption: (p as any).userVotes?.[0]?.vote || undefined,
        };
      });

    const seen = new Set<string>();
    const unique = pool.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

    const sizes = [4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    const slots: UGCPost[][] = [];
    let cur = 0;
    for (const s of sizes) { slots.push(unique.slice(cur, cur + s)); cur += s; }
    if (cur < unique.length) slots.push(unique.slice(cur));
    return slots;
  })();

  const ugcUsedIds = new Set(ugcSlots.flat().map(p => p.id));

  const standaloneUGCPosts: UGCPost[] = (() => {
    const allUGC = ugcSlots.flat();
    return allUGC.filter(p => {
      if (p.type === 'rating' && (!p.content || p.content.trim().length < 10)) return false;
      return p.type === 'review' || p.type === 'thought' || p.type === 'hot_take' || p.type === 'rating' || p.type === 'predict' || p.type === 'poll' || p.type === 'finished' || p.type === 'general' || p.type === 'ask_for_rec' || p.type === 'rank';
    });
  })();

  const POSTS_PER_BATCH = 3;
  const postBatches = useMemo(() => {
    const batches: UGCPost[][] = [];
    for (let i = 0; i < standaloneUGCPosts.length; i += POSTS_PER_BATCH) {
      batches.push(standaloneUGCPosts.slice(i, i + POSTS_PER_BATCH));
    }
    return batches;
  }, [standaloneUGCPosts]);

  const renderPostBatchByIndex = (batchIndex: number) => {
    if (selectedFilter !== 'All' && selectedFilter !== 'all') return null;
    const batch = postBatches[batchIndex];
    if (!batch || batch.length === 0) return null;
    return (
      <>
        {batch.map((post) => (
          <StandalonePost
            key={`standalone-${post.id}`}
            post={post}
            onLike={handleLike}
            onComment={(id) => setActiveCommentPostId(prev => prev === id ? null : id)}
            onFireVote={(id) => handleHotTakeVote(id, 'fire')}
            onIceVote={(id) => handleHotTakeVote(id, 'ice')}
            isLiked={likedPosts.has(post.id)}
            isCommentsActive={activeCommentPostId === post.id}
            onCloseComments={() => setActiveCommentPostId(null)}
            fetchComments={fetchComments}
            onSubmitComment={(id, content) => handleComment(id, undefined, content)}
            isSubmitting={commentMutation.isPending}
            session={session}
            currentUserId={currentAppUserId || undefined}
            onDeleteComment={handleDeleteComment}
            onDeletePost={handleDeletePost}
          />
        ))}
      </>
    );
  };

  const TOTAL_BATCH_SLOTS = 22;
  const renderRemainingPosts = () => {
    if (selectedFilter !== 'All' && selectedFilter !== 'all') return null;
    const remainingBatches = postBatches.slice(TOTAL_BATCH_SLOTS);
    if (remainingBatches.length === 0) return null;
    return (
      <>
        {remainingBatches.flat().map((post) => (
          <StandalonePost
            key={`standalone-remaining-${post.id}`}
            post={post}
            onLike={handleLike}
            onComment={(id) => setActiveCommentPostId(prev => prev === id ? null : id)}
            onFireVote={(id) => handleHotTakeVote(id, 'fire')}
            onIceVote={(id) => handleHotTakeVote(id, 'ice')}
            isLiked={likedPosts.has(post.id)}
            isCommentsActive={activeCommentPostId === post.id}
            onCloseComments={() => setActiveCommentPostId(null)}
            fetchComments={fetchComments}
            onSubmitComment={(id, content) => handleComment(id, undefined, content)}
            isSubmitting={commentMutation.isPending}
            session={session}
            currentUserId={currentAppUserId || undefined}
            onDeleteComment={handleDeleteComment}
            onDeletePost={handleDeletePost}
          />
        ))}
      </>
    );
  };

  const roomItems = useMemo(() => {
    if (!socialPosts || socialPosts.length === 0) return [];
    const filtered = filterByCategory(socialPosts || [])
      .filter((p: any) => p.mediaItems?.length > 0 && p.user && p.user.id && p.user.username !== 'Unknown' && p.type !== 'cast_approved');
    const seen = new Map<string, any>();
    const isAutoAdd = (text: string) => /^"?Added .+ to .+"?$/i.test(text) || text.startsWith('Added ');
    const getListName = (text: string) => {
      const m = text.match(/to\s+["']?([^"']+)["']?\s*$/i) || text.match(/Added .+ to (.+?)["']?\s*$/i);
      return m ? m[1].replace(/"/g, '').trim() : '';
    };
    for (const p of filtered) {
      const mediaId = p.mediaItems?.[0]?.externalId || p.mediaItems?.[0]?.external_id || p.mediaItems?.[0]?.id || '';
      const mediaTitle = (p.mediaItems?.[0]?.title || '').toLowerCase().trim();
      const userId = p.user?.id || '';
      const idKey = `${userId}-id-${mediaId}`;
      const titleKey = mediaTitle ? `${userId}-title-${mediaTitle}` : '';
      const existingById = seen.get(idKey);
      const existingByTitle = titleKey ? seen.get(titleKey) : undefined;
      const existing = existingById || existingByTitle;
      if (!existing) {
        const clone = { ...p };
        const content = (clone.content || '').trim();
        if (isAutoAdd(content)) {
          clone._listName = getListName(content);
        }
        seen.set(idKey, clone);
        if (titleKey) seen.set(titleKey, clone);
      } else {
        const content = (p.content || '').trim();
        const hasRating = p.rating && p.rating > 0;
        const existingHasRating = existing.rating && existing.rating > 0;
        if (isAutoAdd(content)) {
          existing._listName = existing._listName || getListName(content);
        }
        if (hasRating && !existingHasRating) {
          const merged = { ...p, _listName: existing._listName };
          seen.set(idKey, merged);
          if (titleKey) seen.set(titleKey, merged);
        } else if (hasRating) {
          existing._listName = existing._listName || getListName(content);
        } else if (!existingHasRating && !isAutoAdd(content) && content.length > (existing.content || '').length) {
          const merged = { ...p, _listName: existing._listName };
          seen.set(idKey, merged);
          if (titleKey) seen.set(titleKey, merged);
        }
      }
    }
    const uniquePosts = new Map<string, any>();
    for (const [, p] of seen) {
      uniquePosts.set(p.id, p);
    }
    return Array.from(uniquePosts.values()).map((p: any) => ({
      id: p.id,
      type: 'media_added' as const,
      userId: p.user?.id || '',
      username: p.user?.username || '',
      displayName: p.user?.displayName || p.user?.display_name || p.user?.username || '',
      avatar: p.user?.avatar_url || p.user?.avatarUrl,
      mediaTitle: p.mediaItems[0]?.title || '',
      mediaType: p.mediaItems[0]?.mediaType || p.mediaItems[0]?.media_type || p.mediaItems[0]?.type || 'movie',
      mediaImage: p.mediaItems[0]?.imageUrl || p.mediaItems[0]?.image_url || p.mediaItems[0]?.poster_url || '',
      mediaExternalId: p.mediaItems[0]?.externalId || p.mediaItems[0]?.external_id || '',
      mediaExternalSource: p.mediaItems[0]?.externalSource || p.mediaItems[0]?.external_source || 'tmdb',
      activityText: p.rating && p._listName
        ? `rated ${p.rating}/5 · ${p._listName}`
        : p.rating ? `rated ${p.rating}/5`
        : p._listName ? `added to ${p._listName}`
        : (p.activityText || 'added'),
      rating: p.rating || null,
      review: p.content || p.review || null,
      timestamp: p.createdAt || new Date().toISOString()
    }));
  }, [socialPosts, selectedCategory]);

  const ROOM_BATCH_SIZE = 6;
  const roomBatches = useMemo(() => {
    const batches: typeof roomItems[] = [];
    for (let i = 0; i < roomItems.length; i += ROOM_BATCH_SIZE) {
      batches.push(roomItems.slice(i, i + ROOM_BATCH_SIZE));
    }
    return batches;
  }, [roomItems]);

  const ROOM_LEADERBOARD_VARIANTS: ('trivia' | 'overall' | 'consumption' | 'polls' | 'predictions')[] = ['trivia', 'polls', 'predictions', 'consumption', 'overall'];

  const renderRoomCarousel = (batchIndex: number, title?: string) => {
    if (selectedFilter !== 'All' && selectedFilter !== 'all') return null;
    const batch = roomBatches[batchIndex];
    if (!batch || batch.length === 0) return null;
    const lbVariant = ROOM_LEADERBOARD_VARIANTS[batchIndex % ROOM_LEADERBOARD_VARIANTS.length];
    return (
      <ConsumptionCarousel
        items={batch}
        title={title || "Quick Glimpse"}
        onItemDeleted={() => queryClient.invalidateQueries({ queryKey: ["social-feed"] })}
        currentUserId={currentAppUserId}
        leaderboardVariant={lbVariant}
      />
    );
  };

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
      
      // Never consolidate the highlighted post from a notification - it needs its own element for scrolling
      if (highlightPostId && post.id === highlightPostId) {
        ungroupablePosts.push(post);
        return;
      }
      
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
    if (['prediction', 'predict', 'poll', 'vote', 'bet'].includes(postType)) {
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
    const gameTypes = ['trivia', 'poll', 'prediction', 'predict', 'vote', 'ask_for_recs', 'ask_for_rec', 'rank_share', 'media_group', 'cast_approved'];
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

  // Helper to check if a consumption post has meaningful content (rating or thought)
  const hasMeaningfulContent = (post: SocialPost): boolean => {
    const hasRating = post.rating && post.rating > 0;
    // Check for user-written content that isn't auto-generated "Added X to Y" text
    const content = post.content?.trim() || '';
    const isAutoGenerated = content.startsWith('Added ') || 
                            content.startsWith('"Added ') ||
                            content.match(/^"?Added .+ to .+"?$/i);
    const hasUserWrittenContent = content.length > 30 && !isAutoGenerated;
    return hasRating || hasUserWrittenContent;
  };

  // Helper to deduplicate rating posts - keep only one per user+media, preferring the one with content
  const deduplicateRatingPosts = (posts: any[]): any[] => {
    const seen = new Map<string, any>();
    const isAutoContent = (text: string) => !text || text.startsWith('Added ') || text.startsWith('"Added ') || /^"?Added .+ to .+"?$/i.test(text);
    const postScore = (post: any) => {
      const hasRating = post.rating && post.rating > 0;
      const content = post.content?.trim() || '';
      const auto = isAutoContent(content);
      let score = 0;
      if (hasRating) score += 100;
      if (!auto && content.length > 0) score += 50 + content.length;
      return score;
    };
    for (const post of posts) {
      const mediaId = post.mediaItems?.[0]?.externalId || post.mediaItems?.[0]?.external_id || post.mediaItems?.[0]?.id || '';
      const mediaTitle = (post.mediaItems?.[0]?.title || '').toLowerCase().trim();
      const userId = post.user?.id || '';
      const idKey = `${userId}-id-${mediaId}`;
      const titleKey = `${userId}-title-${mediaTitle}`;
      const existingById = seen.get(idKey);
      const existingByTitle = seen.get(titleKey);
      const existing = existingById || existingByTitle;
      if (!existing) {
        seen.set(idKey, post);
        if (mediaTitle) seen.set(titleKey, post);
      } else {
        if (postScore(post) > postScore(existing)) {
          seen.set(idKey, post);
          if (mediaTitle) seen.set(titleKey, post);
        }
      }
    }
    const uniquePosts = new Map<string, any>();
    for (const [, p] of seen) {
      uniquePosts.set(p.id, p);
    }
    return Array.from(uniquePosts.values());
  };

  // Type for swipeable rating cards block
  interface SwipeableRatingBlock {
    id: string;
    type: 'swipeable_ratings';
    posts: SocialPost[];
  }

  // Create tiered feed with The Room carousel AND swipeable rating cards
  const createTieredFeed = (posts: (SocialPost | ConsolidatedActivity)[]): (SocialPost | ConsolidatedActivity | FriendActivityBlock | ConsumptionCarouselBlock | SwipeableRatingBlock)[] => {
    const result: (SocialPost | ConsolidatedActivity | FriendActivityBlock | ConsumptionCarouselBlock | SwipeableRatingBlock)[] = [];
    const simpleAddPosts: SocialPost[] = []; // Simple "added to list" posts for The Room
    const ratingPosts: SocialPost[] = []; // Posts with ratings/thoughts for swipeable cards
    let feedItemCount = 0;
    const RATING_CARD_INTERVAL = 4; // Show swipeable rating cards every 4 feed items
    const CAROUSEL_INTERVAL = 8; // Show The Room carousel every 8 feed items
    const MAX_ITEMS_PER_CAROUSEL = 8;
    const MAX_RATING_CARDS = 5; // Max posts per swipeable rating block

    for (const item of posts) {
      // Skip ConsolidatedActivity items - pass through as-is
      if ('originalPostIds' in item) {
        result.push(item);
        feedItemCount++;
        continue;
      }

      const post = item as SocialPost;
      
      if (isConsumptionPost(post)) {
        // Split consumption posts: meaningful content vs simple adds
        if (hasMeaningfulContent(post)) {
          // Collect rating/thought posts for swipeable cards
          ratingPosts.push(post);
        } else {
          // Simple adds go to The Room carousel
          simpleAddPosts.push(post);
        }
      } else {
        // This is a game/engagement post - add directly to result
        result.push(post);
        feedItemCount++;
        
        // Insert swipeable rating cards every RATING_CARD_INTERVAL items
        if (feedItemCount % RATING_CARD_INTERVAL === 0 && ratingPosts.length > 0) {
          const postsToShow = ratingPosts.splice(0, MAX_RATING_CARDS);
          result.push({
            id: `swipeable-ratings-${feedItemCount}`,
            type: 'swipeable_ratings',
            posts: postsToShow
          } as SwipeableRatingBlock);
        }
        
        // Insert The Room carousel every CAROUSEL_INTERVAL items
        if (feedItemCount % CAROUSEL_INTERVAL === 0 && simpleAddPosts.length > 0) {
          const carouselItems = simpleAddPosts.splice(0, MAX_ITEMS_PER_CAROUSEL).map(p => ({
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
              id: `carousel-${feedItemCount}`,
              type: 'consumption_carousel',
              items: carouselItems
            } as ConsumptionCarouselBlock);
          }
        }
      }
    }
    
    // Add remaining rating posts as a final swipeable block
    if (ratingPosts.length > 0) {
      result.push({
        id: `swipeable-ratings-final`,
        type: 'swipeable_ratings',
        posts: ratingPosts
      } as SwipeableRatingBlock);
    }
    
    // Add any remaining simple add posts as a final carousel
    if (simpleAddPosts.length > 0) {
      const carouselItems = simpleAddPosts.slice(0, MAX_ITEMS_PER_CAROUSEL).map(p => ({
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
    
    // Never filter out the highlighted post from a notification
    if (highlightPostId && post.id === highlightPostId) return true;
    
    const postType = post.type?.toLowerCase() || '';
    
    // Hide malformed posts: short content (looks like just a title), no media items, 
    // and not a special post type (prediction/poll/trivia/rank_share)
    // Note: 'add-to-list' (from track-media) is also a valid type
    const specialTypes = ['prediction', 'predict', 'poll', 'vote', 'trivia', 'rank_share', 'media_group', 'added_to_list', 'add-to-list', 'rewatch', 'ask_for_recs', 'ask_for_rec', 'friend_list_group', 'cast_approved', 'hot_take'];
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
    
    
    // Apply media type filter from detailed filters dialog
    if (detailedFilters.mediaTypes.length > 0) {
      if (!post.mediaItems || post.mediaItems.length === 0) return false;
      const hasMatchingMedia = post.mediaItems.some(media => {
        const mediaType = media.mediaType?.toLowerCase();
        return detailedFilters.mediaTypes.includes(mediaType || '');
      });
      if (!hasMatchingMedia) return false;
    }

    // Apply media category pill filter (Movies, TV, Music, Books, etc.)
    // Only filter regular media posts - skip special types that are rendered separately
    if (selectedCategory) {
      const skipFilterTypes = ['cast_approved', 'hot_take', 'prediction', 'predict', 'poll', 'vote', 'trivia', 'rank_share', 'ask_for_recs', 'ask_for_rec', 'friend_list_group'];
      const postType = post.type?.toLowerCase() || '';
      if (!skipFilterTypes.includes(postType)) {
        const allowedTypes = categoryToMediaTypeMap[selectedCategory] || [];
        if (allowedTypes.length > 0) {
          if (!post.mediaItems || post.mediaItems.length === 0) return false;
          const hasMatchingMedia = post.mediaItems.some(media => {
            const mediaType = media.mediaType?.toLowerCase() || '';
            return allowedTypes.includes(mediaType);
          });
          if (!hasMatchingMedia) return false;
        }
      }
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
        const gameTypes = ['trivia', 'poll', 'prediction', 'predict', 'vote'];
        if (!gameTypes.includes(postType)) return false;
      } else if (selectedFilter === 'trivia') {
        if (postType !== 'trivia') return false;
      } else if (selectedFilter === 'polls') {
        if (postType !== 'poll' && postType !== 'vote') return false;
      } else if (selectedFilter === 'predictions') {
        if (postType !== 'prediction' && postType !== 'predict') return false;
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
  // Uses setInterval to avoid being cancelled by re-renders when socialPosts changes
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (!highlightPostId || !highlightedPost) return;
    
    // Clean up any previous scroll intervals
    if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; }
    if (scrollTimeoutRef.current) { clearTimeout(scrollTimeoutRef.current); scrollTimeoutRef.current = null; }
    
    console.log('🔔 Notification scroll starting: postId=', highlightPostId, 'commentId=', highlightCommentId, 'postLoaded=', !!highlightedPost);
    
    // Auto-expand comments for the highlighted post so CommentsSection mounts and fetches
    setExpandedComments(prev => new Set(prev).add(highlightPostId));
    
    let attempts = 0;
    const maxAttempts = 40;
    let scrolledToPost = false;
    
    const highlightElement = (el: HTMLElement, isComment: boolean) => {
      console.log('🔔 Found element, scrolling to', isComment ? 'comment' : 'post');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background-color 0.5s ease-in-out';
      el.style.backgroundColor = isComment ? 'rgba(147, 51, 234, 0.15)' : 'rgba(147, 51, 234, 0.1)';
      el.style.borderRadius = isComment ? '8px' : '12px';
      setTimeout(() => {
        el.style.backgroundColor = 'transparent';
      }, 2500);
    };
    
    const cleanupUrl = () => {
      window.history.replaceState({}, '', '/activity');
    };
    
    scrollIntervalRef.current = setInterval(() => {
      attempts++;
      
      const postElement = document.getElementById(`post-${highlightPostId}`);
      
      if (highlightCommentId) {
        const commentElement = document.getElementById(`comment-${highlightCommentId}`);
        if (commentElement) {
          highlightElement(commentElement, true);
          if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
          cleanupUrl();
          return;
        }
        // Scroll to post first while waiting for comment to load
        if (postElement && !scrolledToPost) {
          scrolledToPost = true;
          postElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (attempts <= 5 || attempts % 5 === 0) {
          console.log(`🔔 Attempt ${attempts}/${maxAttempts}: comment-${highlightCommentId} not found yet`);
        }
      } else {
        if (postElement) {
          highlightElement(postElement, false);
          if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
          cleanupUrl();
          return;
        }
        if (attempts <= 5 || attempts % 5 === 0) {
          console.log(`🔔 Attempt ${attempts}/${maxAttempts}: post-${highlightPostId} not found yet`);
        }
      }
      
      if (attempts >= maxAttempts) {
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
        // Fallback: scroll to post if comment wasn't found
        if (highlightCommentId && postElement) {
          console.log('🔔 Comment not found, falling back to post scroll');
          highlightElement(postElement, false);
        } else {
          console.log('🔔 Gave up scrolling after', maxAttempts, 'attempts');
        }
        cleanupUrl();
      }
    }, 500);
    
    return () => {
      if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; }
      if (scrollTimeoutRef.current) { clearTimeout(scrollTimeoutRef.current); scrollTimeoutRef.current = null; }
    };
  }, [highlightPostId, highlightCommentId, highlightedPost]);

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

  // Fetch pending friend casts for the current user
  const { data: pendingCasts = [], refetch: refetchPendingCasts } = useQuery({
    queryKey: ["/api/pending-casts", user?.id],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-friend-casts?forMe=true&pending=true`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.log('🎭 Pending casts fetch failed:', response.status);
        return [];
      }
      const data = await response.json();
      console.log('🎭 Pending casts fetched:', data.casts?.length || 0, data.casts);
      return data.casts || [];
    },
    enabled: !!session?.access_token && !!user?.id,
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

  const isPredictionPost = (postId: string): boolean => {
    const allPosts = socialPosts || [];
    const post = allPosts.find((p: any) => p.id === postId);
    return !!(post && (post.type === 'prediction' || post.type === 'predict' || (post as any).poolId));
  };

  // Comment mutation with support for replies
  const commentMutation = useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: { postId: string; content: string; parentCommentId?: string }) => {
      const isPrediction = isPredictionPost(postId);
      console.log('🔥 Submitting comment:', { postId, content, parentCommentId, isPrediction });
      if (!session?.access_token) throw new Error('Not authenticated');

      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      let body: any;
      let endpoint: string;

      if (isPrediction) {
        endpoint = `${baseUrl}/functions/v1/prediction-comments`;
        body = { pool_id: postId, content };
      } else {
        endpoint = `${baseUrl}/functions/v1/social-feed-comments`;
        body = { post_id: postId, content };
      }
      if (parentCommentId) {
        body.parent_comment_id = parentCommentId;
      }

      const response = await fetch(endpoint, {
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

      const isPrediction = isPredictionPost(postId);
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const endpoint = isPrediction
        ? `${baseUrl}/functions/v1/prediction-comments?comment_id=${commentId}`
        : `${baseUrl}/functions/v1/delete-comment`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        ...(isPrediction ? {} : { body: JSON.stringify({ comment_id: commentId }) }),
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

    const isPrediction = isPredictionPost(postId);
    console.log('🔍 Fetching comments for post:', postId, 'isPrediction:', isPrediction);
    
    const includeParam = commentLikesEnabled ? '&include=meta' : '';
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    
    const url = isPrediction
      ? `${baseUrl}/functions/v1/prediction-comments?pool_id=${postId}${includeParam}`
      : `${baseUrl}/functions/v1/social-feed-comments?post_id=${postId}${includeParam}`;

    const response = await fetch(url, {
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

  const handleHotTakeVote = async (postId: string, voteType: 'fire' | 'ice') => {
    console.log('🔥🧊 handleHotTakeVote called:', { postId, voteType, hasSession: !!session?.access_token });
    if (!session?.access_token) {
      console.log('❌ No session for hot take vote');
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/hot-take-vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ postId, voteType }),
      });
      const result = await response.json();
      console.log('🔥🧊 Hot take vote response:', response.status, result);
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      }
    } catch (error) {
      console.error('Hot take vote error:', error);
    }
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

  const handleVotePrediction = async (poolId: string, option: string) => {
    if (!session?.access_token) return;
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${baseUrl}/functions/v1/predictions/predict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pool_id: poolId,
          prediction: option,
        }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Vote prediction error:', err);
      }
    } catch (error) {
      console.error('Vote prediction error:', error);
    }
  };

  // Delete a post (for cast posts and other user-owned content)
  const handleDeletePost = async (postId: string) => {
    if (!session?.access_token) return;
    
    try {
      console.log('🗑️ handleDeletePost called with postId:', postId);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-delete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ post_id: postId }),
        }
      );
      
      const responseData = await response.json().catch(() => ({}));
      console.log('🗑️ Delete response:', response.status, responseData);
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      } else {
        console.error('🗑️ Delete failed:', response.status, responseData);
        throw new Error(responseData?.error || 'Failed to delete');
      }
    } catch (error: any) {
      console.error('Error deleting post:', error?.message || error);
      toast({
        title: "Error",
        description: "Could not delete the post. Please try again.",
        variant: "destructive",
      });
    }
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
    setActiveCommentPostId(prev => prev === postId ? null : postId);
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

  // Check if user has completed Oscar ballot (hide promotion if completed)
  const { data: hasCompletedOscarBallot } = useQuery({
    queryKey: ['oscar-ballot-complete', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Get Oscar event and its categories
      const { data: event } = await supabase
        .from('awards_events')
        .select('id')
        .or("name.ilike.%academy%,name.ilike.%oscar%")
        .eq('status', 'open')
        .single();
      
      if (!event) return false;
      
      const { data: categories } = await supabase
        .from('awards_categories')
        .select('id')
        .eq('event_id', event.id);
      
      if (!categories || categories.length === 0) return false;
      
      const totalCategories = categories.length;
      const categoryIds = categories.map(c => c.id);
      
      // Count user's picks
      const { data: picks } = await supabase
        .from('awards_picks')
        .select('id')
        .eq('user_id', user.id)
        .in('category_id', categoryIds);
      
      return (picks?.length || 0) >= totalCategories;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Get total number of users who have made Oscar ballot picks
  const { data: oscarBallotCount = 0 } = useQuery({
    queryKey: ['oscar-ballot-count'],
    queryFn: async () => {
      // Get Oscar event
      const { data: event } = await supabase
        .from('awards_events')
        .select('id')
        .or("name.ilike.%academy%,name.ilike.%oscar%")
        .eq('status', 'open')
        .single();
      
      if (!event) return 0;
      
      // Count distinct users who have made picks for this event
      const { data: picks } = await supabase
        .from('awards_picks')
        .select('user_id, awards_categories!inner(event_id)')
        .eq('awards_categories.event_id', event.id);
      
      if (!picks) return 0;
      
      // Count unique users
      const uniqueUsers = new Set(picks.map(p => p.user_id));
      return uniqueUsers.size;
    },
    staleTime: 60000,
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
          
          {/* Daily Challenge */}
          <div className="mb-2">
            <DailyChallengeCard />
          </div>
          
          
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 pb-6" data-feed-content>
        {/* Pending Friend Casts - You've Been Cast! - At top of white feed area */}
        {pendingCasts.length > 0 && (
          <div className="space-y-3 mb-4">
            {pendingCasts.map((cast: any) => (
              <CastApprovalCard 
                key={cast.id} 
                cast={cast}
                onRespond={() => refetchPendingCasts()}
              />
            ))}
          </div>
        )}
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
          ) : (filteredPosts && filteredPosts.length > 0) || ['trivia', 'polls', 'predictions', 'dna', 'challenges'].includes(selectedFilter) ? (
            <div className="space-y-4 pb-24">
              {/* Feed Filter Pills - Media Types shown by default, Play types behind Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide mb-2">
                {/* Play Type Toggle */}
                <button
                  onClick={() => setShowCategoryPills(!showCategoryPills)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedFilter !== 'All' && selectedFilter !== 'all'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : showCategoryPills
                        ? 'bg-gray-200 text-gray-700 border border-gray-300'
                        : 'bg-gray-100 text-gray-500 border border-dashed border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  <span>{selectedFilter !== 'All' && selectedFilter !== 'all' ? selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1) : 'Filter'}</span>
                  {selectedFilter !== 'All' && selectedFilter !== 'all' && (
                    <X 
                      size={12} 
                      className="ml-1 hover:text-white/80"
                      onClick={(e) => { e.stopPropagation(); setSelectedFilter('All'); setShowCategoryPills(false); }}
                    />
                  )}
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

                {/* Media Type Pills - Always visible */}
                {[
                  { id: null, label: 'All', Icon: Sparkles },
                  { id: 'movies', label: 'Movies', Icon: Film },
                  { id: 'tv', label: 'TV', Icon: Tv2 },
                  { id: 'music', label: 'Music', Icon: Music },
                  { id: 'books', label: 'Books', Icon: Book },
                  { id: 'sports', label: 'Sports', Icon: Activity },
                  { id: 'podcasts', label: 'Podcasts', Icon: Headphones },
                  { id: 'gaming', label: 'Gaming', Icon: Gamepad2 },
                ].map((cat) => (
                  <button
                    key={cat.id || 'all'}
                    onClick={() => {
                      setSelectedCategory(cat.id === selectedCategory ? null : cat.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      cat.id === null && selectedCategory === null
                        ? 'bg-gradient-to-r from-indigo-600 via-purple-700 to-blue-700 text-white shadow-sm'
                        : cat.id !== null && cat.id === selectedCategory
                          ? 'bg-purple-100 text-purple-700 border border-purple-300'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <cat.Icon size={14} />
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Play Type Pills Row - Shown when Filter toggled */}
              {showCategoryPills && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide mb-2">
                  {[
                    { id: 'all', label: 'All', Icon: Sparkles },
                    { id: 'trivia', label: 'Trivia', Icon: Brain },
                    { id: 'challenges', label: 'Challenges', Icon: Trophy },
                    { id: 'polls', label: 'Polls', Icon: BarChart },
                    { id: 'predictions', label: 'Predictions', Icon: Target },
                    { id: 'commentary', label: 'Commentary', Icon: Flame },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        setSelectedFilter(filter.id === selectedFilter ? 'All' : filter.id);
                        if (filter.id === 'all' || filter.id === selectedFilter) {
                          setShowCategoryPills(false);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        (filter.id === 'all' && selectedFilter === 'All') || filter.id === selectedFilter
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-700 to-blue-700 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                      data-testid={`feed-filter-${filter.id}`}
                    >
                      <filter.Icon size={14} />
                      <span>{filter.label}</span>
                    </button>
                  ))}
                </div>
              )}


              {/* What Friends Are Consuming - horizontal carousel */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && friendsConsuming.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Play size={14} className="text-purple-500" />
                      What Friends Are Consuming
                    </h3>
                    <span className="text-[10px] text-purple-500 font-medium">{friendsConsuming.length} items</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                    {friendsConsuming.map((item: any, idx: number) => (
                      <Link key={item.id || idx} href={`/media/${item.media_type || 'movie'}/${item.external_source || 'tmdb'}/${item.external_id || item.id}`}>
                        <div className="w-[80px] flex-shrink-0 cursor-pointer group">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-1.5 ring-1 ring-gray-200 group-hover:ring-purple-400 transition-all">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                                <Film size={16} className="text-purple-400" />
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuickAddMedia({
                                  title: item.title,
                                  mediaType: item.media_type || 'movie',
                                  externalId: item.external_id || item.id,
                                  externalSource: item.external_source || 'tmdb',
                                  imageUrl: item.image_url || '',
                                });
                                setIsQuickAddOpen(true);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all"
                            >
                              <Plus size={12} className="text-white" strokeWidth={2.5} />
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-800 truncate font-medium">{item.title}</p>
                          <p className="text-[9px] text-gray-400 truncate capitalize">{(item.media_type || 'movie').replace('_', ' ')}</p>
                          <p className="text-[9px] text-purple-500 truncate">{item.owner?.display_name || item.owner?.user_name || 'User'}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {renderRoomCarousel(0, "Quick Glimpse")}

              {/* Empty state for filtered views */}
              {feedFilter === 'friends' && filteredPosts.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100" data-testid="empty-filter-state">
                  <div className="text-4xl mb-3">👥</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Friend Activity</h3>
                  <p className="text-gray-500 text-sm">Follow more friends to see their activity!</p>
                </div>
              )}

              {/* Highlighted post from notification - rendered at top of feed */}
              {highlightPostId && highlightedPost && (
                <div 
                  id={`post-${highlightedPost.id}`}
                  className="rounded-2xl border-2 border-purple-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <span className="text-xs text-purple-500 font-medium">From notification</span>
                    <button 
                      onClick={() => { setHighlightPostId(null); setHighlightCommentId(null); }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="px-4 pb-4">
                    {highlightedPost.user && (
                      <div className="flex items-start gap-3 mb-3">
                        <Link href={`/user/${highlightedPost.user.id}`}>
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer flex-shrink-0">
                            {highlightedPost.user.avatar ? (
                              <img src={highlightedPost.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-sm">{highlightedPost.user.displayName?.[0]?.toUpperCase() || highlightedPost.user.username?.[0]?.toUpperCase() || '?'}</span>
                            )}
                          </div>
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/user/${highlightedPost.user.id}`}>
                            <span className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer">
                              {highlightedPost.user.displayName || highlightedPost.user.username}
                            </span>
                          </Link>
                          <p className="text-xs text-gray-400">{highlightedPost.timestamp ? formatDate(highlightedPost.timestamp) : ''}</p>
                        </div>
                      </div>
                    )}

                    {highlightedPost.mediaItems?.[0] && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0">
                            {highlightedPost.mediaItems[0].imageUrl && highlightedPost.mediaItems[0].imageUrl.startsWith('http') ? (
                              <img
                                src={highlightedPost.mediaItems[0].imageUrl}
                                alt={highlightedPost.mediaItems[0].title}
                                className="w-14 h-18 rounded-lg object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-14 h-18 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                                <Film size={18} className="text-purple-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-gray-900 line-clamp-2">{highlightedPost.mediaItems[0].title}</h3>
                            {highlightedPost.mediaItems[0].mediaType && (
                              <p className="text-xs text-gray-500 capitalize">{highlightedPost.mediaItems[0].mediaType}</p>
                            )}
                            {highlightedPost.rating && highlightedPost.rating > 0 && (
                              <div className="flex items-center gap-0.5 mt-1">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} size={13} className={s <= (highlightedPost.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {highlightedPost.content && !highlightedPost.content.toLowerCase().startsWith('rated ') && !highlightedPost.content.toLowerCase().startsWith('added ') && (
                      <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
                        {renderMentions(highlightedPost.content)}
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleLike(highlightedPost.id)}
                        className={`flex items-center gap-1.5 text-sm ${likedPosts.has(highlightedPost.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                      >
                        <Heart size={16} fill={likedPosts.has(highlightedPost.id) ? 'currentColor' : 'none'} />
                        <span>{highlightedPost.likes || 0}</span>
                      </button>
                      <div className="flex items-center gap-1.5 text-sm text-purple-500">
                        <MessageCircle size={16} />
                        <span>{highlightedPost.comments || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    <CommentsSection
                      postId={highlightedPost.id}
                      fetchComments={fetchComments}
                      session={session}
                      commentInput={commentInputs[highlightedPost.id] || ''}
                      onCommentInputChange={(value) => handleCommentInputChange(highlightedPost.id, value)}
                      onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(highlightedPost.id, parentCommentId, content)}
                      isSubmitting={commentMutation.isPending}
                      currentUserId={user?.id}
                      onDeleteComment={(commentId) => handleDeleteComment(commentId, highlightedPost.id)}
                      onVoteComment={handleVoteComment}
                      commentVotes={commentVotes}
                    />
                  </div>
                </div>
              )}

              {/* 2026 Academy Awards - Featured at top! (hidden if user completed ballot, not shown in predictions filter to avoid duplicate) */}
              {!hasCompletedOscarBallot && 
               (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && 
               (!selectedCategory || selectedCategory === 'movies') && (
                <Link href="/play/awards/oscars-2026">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-gray-900 font-medium text-sm">2026 Oscars Ballot</h3>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <p className="text-gray-500 text-xs">{oscarBallotCount} picks made - join the competition</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              )}

              {renderPostBatchByIndex(0)}

              {/* Filtered views - show only the selected category */}
              {/* TRIVIA filter - Movies category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia' || selectedFilter === 'games') && 
               (!selectedCategory || selectedCategory === 'movies') && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Movies" />
              )}

              {/* TRIVIA - Other categories (show when that category is selected) */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'music' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Music" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'books' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Books" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'sports' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Sports" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'podcasts' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Podcasts" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'games' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Games" />
              )}

              {renderPostBatchByIndex(1)}

              {/* Entertainment DNA Card #1 - in All or DNA filter */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'dna') && !selectedCategory && (
                <DnaMomentCard />
              )}

              {renderPostBatchByIndex(2)}

              {/* TV Polls */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && !selectedCategory && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="TV" />
              )}

              {renderPostBatchByIndex(3)}

              {/* Seen It Game */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <SeenItGame onAddToList={(media) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }} />
              )}

              {renderPostBatchByIndex(4)}

              {/* POLLS filter - Movies category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls' || selectedFilter === 'games') && 
               (!selectedCategory || selectedCategory === 'movies') && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Movies" />
              )}

              {/* POLLS - Other categories (show when that category is selected) */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'music' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Music" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'books' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Books" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'sports' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Sports" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'podcasts' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Podcasts" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'games' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Games" />
              )}

              {renderPostBatchByIndex(5)}

              {/* Points Glimpse - only in All view */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <PointsGlimpse />
              )}

              {renderPostBatchByIndex(6)}

              {/* Consumed Rankings Carousel - only in All view */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <RanksCarousel offset={0} />
              )}

              {renderPostBatchByIndex(7)}

              {renderRoomCarousel(1, "Quick Glimpse")}

              {renderPostBatchByIndex(8)}

              {/* Oscar Ballot Completions - only in All view */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <AwardsCompletionFeed />
              )}

              {renderPostBatchByIndex(9)}

              {/* TRIVIA filter - TV category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia' || selectedFilter === 'games') && 
               (!selectedCategory || selectedCategory === 'tv') && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="TV" />
              )}

              {renderPostBatchByIndex(10)}

              {/* Read It? - Books */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <SeenItGame mediaTypeFilter="book" onAddToList={(media) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }} />
              )}

              {renderPostBatchByIndex(11)}

              {renderRoomCarousel(2, "Quick Glimpse")}

              {renderPostBatchByIndex(12)}

              {/* Entertainment DNA Card #2 - second instance deeper in feed */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'dna') && !selectedCategory && (
                <DnaMomentCard />
              )}

              {renderPostBatchByIndex(13)}

              {/* POLLS filter - TV category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls' || selectedFilter === 'games') && 
               (!selectedCategory || selectedCategory === 'tv') && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="TV" />
              )}

              {renderPostBatchByIndex(14)}

              {/* More Ranks */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <RanksCarousel offset={1} />
              )}

              {renderPostBatchByIndex(15)}

              {/* Listened to It? - Music & Podcasts */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <SeenItGame mediaTypeFilter="music" onAddToList={(media) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }} />
              )}

              {renderPostBatchByIndex(16)}

              {renderRoomCarousel(3, "Quick Glimpse")}

              {renderPostBatchByIndex(17)}

              {/* TRIVIA - Books category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Books" />
              )}

              {renderPostBatchByIndex(18)}

              {/* TRIVIA - Podcasts category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Podcasts" />
              )}

              {renderPostBatchByIndex(19)}

              {/* TRIVIA - Gaming category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Games" />
              )}

              {renderPostBatchByIndex(20)}

              {/* TRIVIA - Sports category */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Sports" />
              )}

              {renderPostBatchByIndex(21)}

              {renderRemainingPosts()}

              {/* Social Posts */}
              {(() => {
                const feedData = (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') ? filteredPosts.filter((item: any) => {
                if ('originalPostIds' in item) return true;
                if ((item as any).type === 'friend_activity_block') return true;
                if ((item as any).type === 'consumption_carousel') return false;
                if ((item as any).type === 'swipeable_ratings') return false;
                const post = item as SocialPost;
                return !(post.mediaItems?.length > 0 && post.mediaItems[0]?.title?.toLowerCase().includes("does mary leave"));
              }) : [];
              return feedData.map((item: any, postIndex: number) => {
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
                    const name = activity.user?.displayName || formatUsername(activity.user?.username);
                    
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
                // Media carousel at positions 9, 21, 33... (every 12 posts starting at 9)
                const shouldShowMediaCarousel = postIndex === 9 || (postIndex > 9 && (postIndex - 9) % 12 === 0);
                const shouldShowRecommendations = false;
                
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
                if ((post.type === 'prediction' || post.type === 'predict') && (post as any).question) {
                  const predPost = post as any;
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

                // User polls are rendered in dedicated carousel higher up in feed
                if (post.type === 'poll' && (post as any).question) {
                  return null;
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
                              userName: targetUser?.displayName || formatUsername(targetUser?.username),
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
                                    <span className="font-semibold hover:text-purple-600 cursor-pointer">{post.user?.displayName || formatUsername(post.user?.username)}</span>
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

                // Check if this item is a cast_approved post (friend casting)
                if (post.type === 'cast_approved') {
                  console.log('🎭 RENDERING cast_approved post:', post.id, post.content, post.mediaItems?.[0]?.title);
                  const celebName = post.mediaItems?.[0]?.title || 'a celebrity';
                  const celebImage = post.mediaItems?.[0]?.imageUrl;
                  const targetUserName = post.content || 'their friend';
                  
                  return (
                    <div key={`cast-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                          <div className="p-4">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-3">
                              {post.user && (
                                <Link href={`/user/${post.user.id}`}>
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer">
                                    {post.user.avatar ? (
                                      <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      <span className="text-sm">{post.user.username?.[0]?.toUpperCase() || '?'}</span>
                                    )}
                                  </div>
                                </Link>
                              )}
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">
                                  <Link href={`/user/${post.user?.id}`}>
                                    <span className="font-semibold hover:text-purple-600 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
                                  </Link>
                                  {' '}cast{' '}
                                  <span className="font-semibold">@{targetUserName}</span>
                                  {' '}as
                                </p>
                                <span className="text-xs text-gray-400">{post.timestamp ? formatDate(post.timestamp) : 'Today'}</span>
                              </div>
                              {user?.id && post.user?.id === user.id && (
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                  aria-label="Delete cast"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                            
                            {/* Celebrity Card */}
                            <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-purple-50 to-amber-50 rounded-xl">
                              {celebImage && (
                                <img 
                                  src={celebImage} 
                                  alt={celebName}
                                  className="w-16 h-20 rounded-xl object-cover"
                                />
                              )}
                              <div className="flex-1">
                                <p className="font-bold text-lg text-gray-900">{celebName}</p>
                                <p className="text-xs text-gray-500">would play @{targetUserName} in a movie</p>
                              </div>
                            </div>
                            
                            {/* CTA */}
                            <Link href="/cast">
                              <button className="mt-3 w-full py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
                                Cast Your Friends
                              </button>
                            </Link>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-100">
                            <button
                              onClick={() => handleLike(post.id)}
                              className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
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
                            >
                              <MessageCircle size={16} />
                              <span>{post.comments || 0}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Check if this item is an ask_for_recs post (handles both 'ask_for_recs' and 'ask_for_rec' variants)
                if (post.type === 'ask_for_recs' || post.type === 'ask_for_rec') {
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
                              Asking for recommendations ⬇️
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
                            
                            {/* Actions row */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <button
                                onClick={() => handleLike(post.id)}
                                className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                                data-testid={`button-follow-${post.id}`}
                                title="Follow for updates"
                              >
                                <span className="text-base">👀</span>
                                <span>{likedPosts.has(post.id) ? 'Following' : 'Follow'}</span>
                              </button>
                              <span className="text-xs text-gray-400">{post.comments || 0} recs</span>
                            </div>
                          
                            {/* Recommendations section - always visible with add input open */}
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
                                forceShowAddInput={true}
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
                          
                          let userDisplayName: string | undefined;
                          if (post.user) {
                            userId = post.user.id;
                            username = post.user.username;
                            userDisplayName = post.user.displayName;
                          } else if (post.groupedActivities?.[0]) {
                            const activity = post.groupedActivities[0] as any;
                            userId = activity.userId;
                            username = activity.username;
                            userDisplayName = activity.displayName;
                          }
                          
                          if (!userId || !username) return null;
                          
                          const displayName = userDisplayName || username.replace(/consumed|IsConsumed/gi, '').trim() || username;
                          
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
                        {(post.type === 'hot_take' || post.postType === 'hot_take') ? (
                          <>
                            <button 
                              onClick={() => handleHotTakeVote(realPostId, 'fire')}
                              className="flex items-center space-x-1.5 text-orange-500 hover:text-orange-600 transition-colors"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <Flame size={18} />
                              <span className="text-sm">{post.fire_votes || 0}</span>
                            </button>
                            <button 
                              onClick={() => handleHotTakeVote(realPostId, 'ice')}
                              className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-500 transition-colors"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <Snowflake size={18} />
                              <span className="text-sm">{post.ice_votes || 0}</span>
                            </button>
                          </>
                        ) : (
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
                        )}
                        <button 
                          onClick={() => toggleComments(realPostId)}
                          className={`flex items-center space-x-2 transition-colors ${activeCommentPostId === realPostId ? 'text-purple-600' : 'text-gray-500 hover:text-blue-500'}`}
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
                          const userName = post.user?.displayName || formatUsername(post.user?.username);
                          
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
                        {post.timestamp ? formatDate(post.timestamp) : 'Today'}
                      </div>
                    </div>

                    {activeCommentPostId === realPostId && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
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
                      </div>
                    )}
                  </div>
                  </div>

                </div>
              );
              });
              })()}

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
                  {selectedCategory ? (
                    <TriviaCarousel category={selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} />
                  ) : (
                    <>
                      <TriviaCarousel category="Movies" />
                      <TriviaCarousel category="TV" />
                      <TriviaCarousel category="Books" />
                      <TriviaCarousel category="Music" />
                      <TriviaCarousel category="Sports" />
                      <TriviaCarousel category="Podcasts" />
                      <TriviaCarousel category="Games" />
                      <TriviaCarousel category="Other" />
                    </>
                  )}
                </div>
              )}

              {/* Category carousels for challenges filter - shows multi-question trivia */}
              {selectedFilter === 'challenges' && (
                <div className="space-y-4 mt-4">
                  <div className="text-center py-2">
                    <p className="text-sm font-medium text-gray-700">Challenge Sets</p>
                    <p className="text-xs text-gray-500">Compete with friends or alone on these challenge sets</p>
                  </div>
                  {selectedCategory ? (
                    <TriviaCarousel category={selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} challengesOnly />
                  ) : (
                    <>
                      <TriviaCarousel category="Movies" challengesOnly />
                      <TriviaCarousel category="TV" challengesOnly />
                      <TriviaCarousel category="Books" challengesOnly />
                      <TriviaCarousel category="Music" challengesOnly />
                      <TriviaCarousel category="Sports" challengesOnly />
                      <TriviaCarousel category="Podcasts" challengesOnly />
                      <TriviaCarousel category="Games" challengesOnly />
                    </>
                  )}
                </div>
              )}

              {/* Category carousels for polls filter */}
              {selectedFilter === 'polls' && (
                <div className="space-y-4 mt-4">
                  {selectedCategory ? (
                    <PollsCarousel category={selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} />
                  ) : (
                    <>
                      <PollsCarousel category="Movies" />
                      <PollsCarousel category="TV" />
                      <PollsCarousel category="Books" />
                      <PollsCarousel category="Music" />
                      <PollsCarousel category="Sports" />
                      <PollsCarousel category="Podcasts" />
                      <PollsCarousel category="Other" />
                    </>
                  )}
                </div>
              )}

              {/* Predictions Filter - Show all awards */}
              {selectedFilter === 'predictions' && (
                <div className="space-y-3">
                  {/* 2026 Academy Awards - Show different state based on completion */}
                  <Link href="/play/awards/oscars-2026">
                    {hasCompletedOscarBallot ? (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-gray-900 font-medium text-sm">2026 Oscars Ballot</h3>
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-600 text-[10px] font-medium rounded">Done</span>
                            </div>
                            <p className="text-gray-500 text-xs">View or share your picks</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-gray-900 font-medium text-sm">2026 Oscars Ballot</h3>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            </div>
                            <p className="text-gray-500 text-xs">{oscarBallotCount} picks made - join the competition</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    )}
                  </Link>

                </div>
              )}

              {/* End of Feed message for DNA filter only */}
              {selectedFilter === 'dna' && (
                <div className="text-center py-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 mt-4">
                  <div className="text-3xl mb-2">🧬</div>
                  <p className="text-gray-600 font-medium">That's all for now!</p>
                  <p className="text-gray-500 text-sm mt-1">Check back later for more Entertainment DNA</p>
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