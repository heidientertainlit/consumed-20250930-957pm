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
import { DailyHeroSection } from "@/components/daily-hero-section";
import { EntertainmentDNAStrip } from "@/components/entertainment-dna-strip";
import { DnaMomentCard } from "@/components/dna-moment-card";
import { DnaMomentFeaturedCard } from "@/components/dna-moment-featured-card";
import { TriviaCarousel } from "@/components/trivia-carousel";
import CastApprovalCard from "@/components/cast-approval-card";

import { LeaderboardGlimpse } from "@/components/leaderboard-glimpse";
import { PollsCarousel } from "@/components/polls-carousel";
import { RecommendationsGlimpse } from "@/components/recommendations-glimpse";
import { GamesCarousel } from "@/components/games-carousel";
import SeenItGame from "@/components/seen-it-game";
import { RanksCarousel } from "@/components/ranks-carousel";
import { ChallengePoolsFeedBanner } from "@/components/challenge-pools-feed-banner";
import { AwardsCompletionFeed } from "@/components/awards-completion-feed";
import { PointsGlimpse } from "@/components/points-glimpse";
import { QuickReactCard } from "@/components/quick-react-card";

import { Star, StarHalf, Heart, MessageCircle, MessageSquarePlus, Share, ChevronRight, ChevronDown, Check, Badge, User, Vote, TrendingUp, Lightbulb, Users, Film, Send, Trash2, MoreVertical, Eye, EyeOff, Plus, ExternalLink, Sparkles, Book, Music, Tv2, Gamepad2, Headphones, Flame, Snowflake, Target, HelpCircle, Activity, ArrowUp, ArrowDown, Forward, Search as SearchIcon, X, Dices, ThumbsUp, ThumbsDown, Edit3, Brain, BarChart, Dna, Trophy, Medal, ListPlus, SlidersHorizontal, Play, Mic, MoreHorizontal, Flag, Lock, Bookmark, Zap } from "lucide-react";
import CommentsSection from "@/components/comments-section";
import CreatorUpdateCard from "@/components/creator-update-card";
import CollaborativePredictionCard from "@/components/collaborative-prediction-card";
import { UserPollsCarousel } from "@/components/user-polls-carousel";
import { ReportSheet } from "@/components/report-sheet";
import PostDetailSheet from "@/components/post-detail-sheet";
import { type UGCPost } from "@/components/user-content-carousel";
import ConversationsPanel from "@/components/conversations-panel";
import FeedFiltersDialog, { FeedFilters } from "@/components/feed-filters-dialog";
import RankFeedCard from "@/components/rank-feed-card";
import { MediaSearchBar } from "@/components/media-search-bar";
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
import { GameMomentCard } from "@/components/game-moment-card";
import { SocialProofCard, buildGameMomentSocialProof, buildLeaderboardSocialProof } from "@/components/social-proof-card";
import BingeBattleFeedCard from "@/components/binge-battle-feed-card";
import DnaClashFeedCard from "@/components/dna-clash-feed-card";
import DnaCompareFeedCard, { DnaComparePostCard } from "@/components/dna-compare-feed-card";
import { TodaysPlayNudge } from "@/components/todays-play-nudge";
import { WhatsYourMove } from "@/components/whats-your-move"; // kept for reference — not currently rendered
import FeedComposerBar, { FeedActionChips } from "@/components/feed-composer-bar";
import { TrendingNowSection } from "@/components/trending-now-section";

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

// Normalize media type for URL construction — prevents TV show IDs hitting the movie endpoint
const normalizeMediaType = (type: string | undefined | null): string => {
  const t = (type || '').toLowerCase().trim();
  if (t === 'tv' || t === 'tv show' || t === 'tv_show' || t === 'tvshow' || t === 'series' || t === 'television') return 'tv';
  return 'movie';
};

const fetchSocialFeed = async ({ pageParam = 0, session }: { pageParam?: number; session: any }): Promise<SocialPost[]> => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const limit = 200; // Posts per page — higher limit pulls in more diverse users' posts
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
            if ((src === 'open_library' || src === 'openlibrary') && eid) {
              const isISBN = /^[\d-]+$/.test(eid);
              const coverUrl = isISBN
                ? `https://covers.openlibrary.org/b/isbn/${eid}-L.jpg`
                : `https://covers.openlibrary.org/b/olid/${eid}-L.jpg`;
              return { ...m, imageUrl: m.imageUrl || m.image_url || coverUrl, image_url: m.image_url || coverUrl };
            }
            return m;
          })
        };
      }
      return post;
    });

    const userIds = [...new Set(fixedPosts.map((p: any) => p.user?.id).filter(Boolean))];
    if (userIds.length > 0) {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('id, display_name, user_name, first_name, last_name')
          .in('id', userIds);
        if (users && users.length > 0) {
          const userMap = new Map(users.map((u: any) => [u.id, u]));
          fixedPosts.forEach((post: any) => {
            if (post.user?.id) {
              const dbUser = userMap.get(post.user.id);
              if (dbUser) {
                const fullName = (dbUser.first_name && dbUser.last_name)
                  ? `${dbUser.first_name} ${dbUser.last_name}`.trim()
                  : dbUser.first_name || null;
                const resolvedName = fullName || dbUser.display_name || dbUser.user_name || post.user.username;
                post.user.displayName = resolvedName;
                post.user.display_name = resolvedName;
                if (dbUser.user_name) {
                  post.user.username = dbUser.user_name;
                  post.user.user_name = dbUser.user_name;
                }
              }
            }
          });
        }
      } catch (e) {
        console.log('User display name lookup failed (non-blocking):', e);
      }
    }

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

function UGCGroupCard({ post, onLike, isLiked, session, fetchComments, currentUserId, onDeletePost, onAddToList, forceActionFirst, forceNormal, stackPosts, stackIndex, swipeProps }: {
  post: UGCPost;
  onLike: (id: string) => void;
  isLiked: boolean;
  session: any;
  fetchComments: (postId: string) => Promise<any[]>;
  currentUserId?: string;
  onDeletePost?: (postId: string) => void;
  onAddToList?: (media: any) => void;
  forceActionFirst?: boolean;
  forceNormal?: boolean;
  stackPosts?: any[];
  stackIndex?: number;
  swipeProps?: { style: React.CSSProperties; ref: React.RefObject<HTMLDivElement>; overlays: React.ReactNode };
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingJustSaved, setRatingJustSaved] = useState(false);
  const [showStarPicker, setShowStarPicker] = useState(false);
  const [communityRating, setCommunityRating] = useState<number | null>(null);
  const [externalRating, setExternalRating] = useState<number | null>(null);
  const [externalRatingLabel, setExternalRatingLabel] = useState<string>('');
  const [tasteAlignment, setTasteAlignment] = useState<number | null>(null);
  const [alignmentNudge, setAlignmentNudge] = useState(false);
  const [relatedRatings, setRelatedRatings] = useState<Array<{userId: string; userName: string; displayName: string; avatar?: string; rating: number; content?: string}>>([]);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [, setLocation] = useLocation();
  const [seenItDone, setSeenItDone] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  // Default open for other users' posts so "Your Turn" shows without needing to tap Rate it
  const [showInlineRater, setShowInlineRater] = useState(() => {
    const postUserId = post.user?.id || post.userId;
    const myId = session?.user?.id;
    return !!(myId && postUserId && postUserId !== myId);
  });
  const [reviewText, setReviewText] = useState('');
  const [reviewPosted, setReviewPosted] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({});
  const [ratingCount, setRatingCount] = useState(0);
  // Fire / Ice vote state (used by hot_take cards)
  const [fireCount, setFireCount] = useState(post.fire_votes || 0);
  const [iceCount, setIceCount] = useState(post.ice_votes || 0);
  const [fireIceVoted, setFireIceVoted] = useState<'fire' | 'ice' | null>(null);
  // Agree / Hot Take / Not My Take reaction state
  const [localReaction, setLocalReaction] = useState<'flame' | 'down' | null>(null);
  const [reactionLoaded, setReactionLoaded] = useState(false);
  // Poster card detail sheet
  const [posterDetailOpen, setPosterDetailOpen] = useState(false);

  // Load existing reaction from DB on mount
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !post.id || reactionLoaded) return;
    setReactionLoaded(true);
    supabase
      .from('post_reactions')
      .select('reaction')
      .eq('social_post_id', post.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.reaction === 'hot_take') setLocalReaction('flame');
        else if (data?.reaction === 'disagree') setLocalReaction('down');
      });
  }, [post.id, session?.user?.id]);

  const handleReaction = async (type: 'up' | 'flame' | 'down') => {
    const userId = session?.user?.id;
    if (type === 'up') {
      setLocalReaction(null);
      onLike(post.id);
      // remove any existing flame/down reaction
      if (userId) {
        supabase.from('post_reactions').delete()
          .eq('social_post_id', post.id).eq('user_id', userId);
      }
      return;
    }
    if (!userId) return;
    const dbReaction = type === 'flame' ? 'hot_take' : 'disagree';
    const isToggleOff = (type === 'flame' && localReaction === 'flame') || (type === 'down' && localReaction === 'down');
    if (isLiked) onLike(post.id); // un-like when reacting
    if (isToggleOff) {
      setLocalReaction(null);
      await supabase.from('post_reactions').delete()
        .eq('social_post_id', post.id).eq('user_id', userId);
    } else {
      setLocalReaction(type === 'flame' ? 'flame' : 'down');
      await supabase.from('post_reactions')
        .upsert({ social_post_id: post.id, user_id: userId, reaction: dbReaction }, { onConflict: 'social_post_id,user_id' });
      // Fire-and-forget DNA signal refresh
      fetch(`${supabaseUrl}/functions/v1/extract-dna-signals`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {});
    }
  };
  const hasFetched = useRef(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
  const starsRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const [resolvedExternalId, setResolvedExternalId] = useState(post.externalId || '');
  const [resolvedExternalSource, setResolvedExternalSource] = useState(post.externalSource || 'tmdb');
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [reportPostOpen, setReportPostOpen] = useState(false);
  const [reportCommentTarget, setReportCommentTarget] = useState<{id: string; userId: string; userName: string} | null>(null);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowStarPicker(prev => !prev);
    if (!resolvedExternalId && !post.externalId && post.mediaTitle && session?.access_token && !isSearchingMedia) {
      setIsSearchingMedia(true);
      const mediaType = (post.mediaType || 'tv').toLowerCase();
      fetch(
        `${supabaseUrl}/functions/v1/media-search?q=${encodeURIComponent(post.mediaTitle)}&type=${mediaType}&limit=1`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
        .then(r => r.json())
        .then(data => {
          const results = data?.results || data || [];
          const first = Array.isArray(results) ? results[0] : null;
          const newEid = first?.externalId || first?.external_id || first?.id;
          const newEsrc = first?.externalSource || first?.external_source || 'tmdb';
          if (newEid) { setResolvedExternalId(String(newEid)); setResolvedExternalSource(newEsrc); }
        })
        .catch(err => console.error('Media lookup failed', err))
        .finally(() => setIsSearchingMedia(false));
    }
  };

  const handleSeenIt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (seenItDone || !session?.access_token) return;
    setSeenItDone(true);
    try {
      await fetch(`${supabaseUrl}/functions/v1/track-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          media: {
            title: post.mediaTitle,
            mediaType: post.mediaType || 'movie',
            imageUrl: post.mediaImage || '',
            externalId: post.externalId || '',
            externalSource: post.externalSource || 'tmdb',
          },
          listType: 'completed',
          skip_social_post: true,
        }),
      });
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    const externalId = post.externalId || post.mediaItems?.[0]?.externalId;
    const externalSource = post.externalSource || post.mediaItems?.[0]?.externalSource;
    if (!externalId || !externalSource) return;

    // Community average rating + distribution
    supabase
      .from('media_ratings')
      .select('rating')
      .eq('media_external_id', externalId)
      .eq('media_external_source', externalSource)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const avg = data.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / data.length;
          setCommunityRating(Math.round(avg * 10) / 10);
          setRatingCount(data.length);
          const dist: Record<number, number> = {};
          for (let s = 1; s <= 5; s++) {
            const count = data.filter((r: any) => Math.round(Number(r.rating)) === s).length;
            dist[s] = Math.round((count / data.length) * 100);
          }
          setRatingDistribution(dist);
        }
      });

    // User's own existing rating (so "Your Turn" shows already-rated state)
    const userId = session?.user?.id;
    if (userId) {
      supabase
        .from('media_ratings')
        .select('rating')
        .eq('media_external_id', externalId)
        .eq('media_external_source', externalSource)
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.rating) {
            setRatingValue(Number(data.rating));
            setRatingSubmitted(true);
            setShowInlineRater(false);
          }
        });
    }
  }, [post.externalId, post.externalSource, session?.user?.id]);

  // External (3rd-party) rating from TMDB/Spotify etc.
  useEffect(() => {
    const isRatingPost2 = post.type === 'rating' || post.type === 'rate-review' || post.type === 'review';
    if (!isRatingPost2) return;
    const externalId = post.externalId || post.mediaItems?.[0]?.externalId;
    const externalSource = post.externalSource || post.mediaItems?.[0]?.externalSource;
    const mediaType = post.mediaType || post.mediaItems?.[0]?.type;
    if (!externalId || !externalSource) return;
    const sourceLabels: Record<string, string> = { tmdb: 'TMDB', google_books: 'Google Books', googlebooks: 'Google Books', openlibrary: 'Open Library', open_library: 'Open Library', spotify: 'Spotify' };
    const label = sourceLabels[externalSource] || externalSource;
    const url = `${supabaseUrl}/functions/v1/get-media-details?source=${externalSource}&external_id=${externalId}${mediaType ? `&media_type=${mediaType}` : ''}`;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.rating) {
          const val = parseFloat(data.rating);
          if (val > 0) { setExternalRating(Math.round(val * 10) / 10); setExternalRatingLabel(label); }
        }
      })
      .catch(() => {});
  }, [post.externalId, post.externalSource, post.type]);

  // Taste alignment between current user and post author
  useEffect(() => {
    const postUserId = post.user?.id;
    if (!postUserId || !session?.user?.id || postUserId === session?.user?.id) return;
    const isRatingPost2 = post.type === 'rating' || post.type === 'rate-review' || post.type === 'review';
    if (!isRatingPost2) return;
    supabase
      .from('media_ratings')
      .select('user_id, media_external_id, media_external_source, rating')
      .in('user_id', [session.user.id, postUserId])
      .then(({ data }) => {
        if (!data || data.length < 2) return;
        const myRatings: Record<string, number> = {};
        const theirRatings: Record<string, number> = {};
        data.forEach((r: any) => {
          const key = `${r.media_external_id}__${r.media_external_source}`;
          if (r.user_id === session.user.id) myRatings[key] = Number(r.rating);
          else theirRatings[key] = Number(r.rating);
        });
        // Gate on 10 ratings minimum so the score is meaningful
        if (Object.keys(myRatings).length < 10) { setAlignmentNudge(true); return; }
        const sharedKeys = Object.keys(myRatings).filter(k => k in theirRatings);
        if (sharedKeys.length < 2) return;
        const avgDiff = sharedKeys.reduce((sum, k) => sum + Math.abs(myRatings[k] - theirRatings[k]), 0) / sharedKeys.length;
        const alignment = Math.round((1 - avgDiff / 4) * 100);
        setTasteAlignment(Math.max(0, Math.min(100, alignment)));
      });
  }, [post.user?.id, session?.user?.id, post.type]);

  // Related ratings: other users who rated the same media
  useEffect(() => {
    const externalId = post.externalId || post.mediaItems?.[0]?.externalId;
    const externalSource = post.externalSource || post.mediaItems?.[0]?.externalSource;
    if (!externalId || !externalSource) return;
    const primaryUserId = post.user?.id;
    const currentId = session?.user?.id;
    supabase
      .from('media_ratings')
      .select('user_id, rating')
      .eq('media_external_id', externalId)
      .eq('media_external_source', externalSource)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(async ({ data: ratings }) => {
        if (!ratings || ratings.length === 0) return;
        const filtered = ratings.filter((r: any) => r.user_id !== primaryUserId && r.user_id !== currentId);
        if (filtered.length === 0) return;
        const ids = filtered.map((r: any) => r.user_id);
        const { data: users } = await supabase.from('users').select('id, user_name, display_name').in('id', ids);
        const userMap: Record<string, any> = {};
        (users || []).forEach((u: any) => { userMap[u.id] = u; });
        // Also fetch review content from social_posts for these users + same media
        const { data: posts } = await supabase
          .from('social_posts')
          .select('user_id, content')
          .in('user_id', ids)
          .eq('external_id', externalId)
          .in('type', ['rating', 'rate-review', 'review'])
          .not('content', 'is', null)
          .limit(20);
        const contentMap: Record<string, string> = {};
        (posts || []).forEach((p: any) => { if (p.content?.trim()) contentMap[p.user_id] = p.content.trim(); });
        setRelatedRatings(filtered.map((r: any) => ({
          userId: r.user_id,
          userName: userMap[r.user_id]?.user_name || '',
          displayName: userMap[r.user_id]?.display_name || userMap[r.user_id]?.user_name || 'User',
          rating: Number(r.rating),
          content: contentMap[r.user_id],
        })));
      });
  }, [post.externalId, post.externalSource, post.user?.id, session?.user?.id]);

  // Auto-load comments for rating/review cards so they show inline without a tap
  useEffect(() => {
    const isRating = post.type === 'rating' || post.type === 'review' || post.type === 'rate-review' || post.type === 'thought';
    if (!isRating || !post.id || hasFetched.current) return;
    hasFetched.current = true;
    fetchComments(post.id).then(data => setComments(data || []));
  }, [post.id]);

  const handleSubmitRating = async (rating: number) => {
    if (!session?.access_token) return;
    // Optimistic update — lock in stars immediately so the user sees instant feedback
    setRatingValue(rating);
    setRatingSubmitted(true);
    setShowStarPicker(false);
    setHoverRating(0);
    setRatingJustSaved(true);
    setTimeout(() => setRatingJustSaved(false), 1800);
    let externalId = resolvedExternalId || post.externalId || post.mediaItems?.[0]?.externalId || '';
    let externalSource = resolvedExternalSource || post.externalSource || post.mediaItems?.[0]?.externalSource || 'tmdb';
    const mediaTitle = post.mediaTitle || post.mediaItems?.[0]?.title || '';
    const mediaType = post.mediaType || post.mediaItems?.[0]?.type || 'tv';
    const mediaImage = post.mediaImage || post.mediaItems?.[0]?.imageUrl || '';
    if (!externalId && mediaTitle) {
      try {
        const r = await fetch(
          `${supabaseUrl}/functions/v1/media-search?q=${encodeURIComponent(mediaTitle)}&type=${mediaType.toLowerCase()}&limit=1`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const d = await r.json();
        const results = d?.results || d || [];
        const first = Array.isArray(results) ? results[0] : null;
        externalId = String(first?.externalId || first?.external_id || first?.id || '');
        externalSource = first?.externalSource || first?.external_source || 'tmdb';
        if (externalId) { setResolvedExternalId(externalId); setResolvedExternalSource(externalSource); }
      } catch { /* fall through */ }
    }
    if (!externalId) return;
    try {
      await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_external_id: externalId,
          media_external_source: externalSource,
          media_title: mediaTitle,
          media_type: mediaType,
          media_image_url: mediaImage,
          rating,
          skip_social_post: false,
        }),
      });
    } catch (err) {
      console.error('Rating failed', err);
    }
  };

  const handleRemoveRating = async () => {
    if (!session?.access_token) return;
    const externalId = resolvedExternalId || post.externalId || post.mediaItems?.[0]?.externalId || '';
    const externalSource = resolvedExternalSource || post.externalSource || post.mediaItems?.[0]?.externalSource || 'tmdb';
    const mediaTitle = post.mediaTitle || post.mediaItems?.[0]?.title || '';
    const mediaType = post.mediaType || post.mediaItems?.[0]?.type || 'movie';
    const mediaImage = post.mediaImage || post.mediaItems?.[0]?.imageUrl || '';
    setRatingValue(0);
    setRatingSubmitted(false);
    setShowStarPicker(false);
    setHoverRating(0);
    try {
      await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_external_id: externalId,
          media_external_source: externalSource,
          media_title: mediaTitle,
          media_type: mediaType,
          media_image_url: mediaImage,
          rating: 0,
          skip_social_post: true,
        }),
      });
    } catch (err) {
      console.error('Remove rating failed', err);
    }
  };

  const handleWriteReview = async () => {
    if (!reviewText.trim()) { setReviewPosted(true); return; }
    const userId = session?.user?.id;
    if (!userId) return;
    try {
      await supabase.from('social_posts').insert({
        user_id: userId,
        content: reviewText.trim(),
        type: 'thought',
        media_title: post.mediaTitle || null,
        media_image: post.mediaImage || null,
        media_type: post.mediaType || null,
        external_id: resolvedExternalId || post.externalId || null,
        external_source: resolvedExternalSource || post.externalSource || null,
      });
    } catch (err) {
      console.error('Review post failed', err);
    }
    setReviewPosted(true);
  };

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const handleCommentToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!showComments && !hasFetched.current) {
      hasFetched.current = true;
      setLoadingComments(true);
      try {
        const data = await fetchComments(post.id);
        setComments(data || []);
      } catch (_) {}
      setLoadingComments(false);
    }
    setShowComments(s => !s);
  };

  const submitComment = async () => {
    if (!session?.access_token || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/social-feed-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ post_id: post.id, content: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText('');
        setReplyingToId(null);
        setReplyingToName(null);
        hasFetched.current = false;
        const data = await fetchComments(post.id);
        setComments(data || []);
        hasFetched.current = true;
      }
    } catch (_) {}
    setSubmitting(false);
  };

  const submitReply = async (parentId: string | number) => {
    if (!session?.access_token || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/social-feed-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ post_id: post.id, content: replyText.trim(), parent_comment_id: parentId }),
      });
      if (res.ok) {
        setReplyText('');
        setReplyingToId(null);
        hasFetched.current = false;
        const data = await fetchComments(post.id);
        setComments(data || []);
        hasFetched.current = true;
      }
    } catch (_) {}
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    if (!session?.access_token) return;
    const { error } = await supabase.from('social_post_comments').delete().eq('id', commentId);
    if (!error) setComments(prev => prev.filter((c: any) => c.id !== commentId));
  };

  const getTypeInfo = () => {

    if (post.type === 'review') return { label: 'Review', color: 'text-yellow-500', bg: 'bg-yellow-50' };
    if (post.type === 'rating') return { label: 'Rating', color: 'text-yellow-500', bg: 'bg-yellow-50' };
    if (post.type === 'finished') return { label: 'Finished', color: 'text-green-500', bg: 'bg-green-50' };
    if (post.type === 'predict' || post.type === 'prediction') return { label: 'Prediction', color: 'text-purple-500', bg: 'bg-purple-50' };
    if (post.type === 'poll') return { label: 'Cast your vote', color: 'text-purple-500', bg: 'bg-purple-50' };
    if (post.type === 'hot_take') return { label: 'Hot Take', color: 'text-orange-500', bg: 'bg-orange-50' };
    if (post.type === 'question') return { label: 'Question', color: 'text-blue-500', bg: 'bg-blue-50' };
    return { label: 'Post', color: 'text-gray-400', bg: 'bg-gray-50' };
  };

  const ti = getTypeInfo();
  // Normalize to lowercase canonical form for comparison (handles 'Movie', 'TV Show', etc.)
  const mediaTypeNorm = (() => {
    const t = (post.mediaType || '').toLowerCase();
    if (t === 'tv show') return 'tv';
    return t;
  })();
  const mediaTypeLabel = mediaTypeNorm === 'tv' ? 'TV' : mediaTypeNorm === 'movie' ? 'Movie' : mediaTypeNorm === 'book' ? 'Book' : mediaTypeNorm === 'music' ? 'Music' : mediaTypeNorm === 'podcast' ? 'Podcast' : mediaTypeNorm === 'game' ? 'Game' : null;
  const seenItLabel = (() => {
    if (mediaTypeNorm === 'music') return { idle: 'Heard it', done: 'Heard!' };
    if (mediaTypeNorm === 'podcast') return { idle: 'Listened', done: 'Listened!' };
    if (mediaTypeNorm === 'book') return { idle: 'Read it', done: 'Read!' };
    return { idle: 'Seen it', done: 'Seen!' };
  })();

  const isRatingPost = post.type === 'rating' || post.type === 'review' || post.type === 'rate-review' || post.type === 'thought';
  const isOtherUser = post.user?.id !== currentUserId;

  // Action First layout: other users' unrated rating posts, OR any promoted card (forceActionFirst).
  // When forceActionFirst is set we skip the ratingSubmitted check so the section stays visible
  // even after the useEffect loads the user's existing rating from media_ratings.
  const isActionFirst = !forceNormal && isRatingPost && (forceActionFirst || (isOtherUser && !ratingSubmitted)) && session?.access_token;

  // Use external (3rd-party) rating as comparison baseline when available; convert /10 → /5
  // Only use external API rating (TMDB/Google Books/etc.) as baseline.
  // Fall back to community rating only when we have 5+ in-app ratings — a
  // sample of 1-2 people would produce misleading "rare rave / overrated" labels.
  // get-media-details already converts /10 → /5, so use externalRating directly.
  const baselineRating = externalRating
    ? externalRating
    : (ratingCount >= 5 ? communityRating : null);
  const baselineLabel = 'avg';

  const ratingDiffLine = (rating: number, className = 'mt-0.5') => {
    if (!baselineRating) return null;
    const diff = rating - baselineRating;
    const abs = Math.abs(diff);

    let phrase: string;
    let colorClass: string;

    if (abs <= 0.3) {
      // At average — vary by the actual star level
      if (rating >= 4.5) phrase = 'Everyone agrees. A classic.';
      else if (rating >= 4) phrase = 'Crowd-pleaser. You agree.';
      else if (rating <= 2) phrase = "You're not alone on this one.";
      else phrase = 'Safe take.';
      colorClass = 'text-orange-400';
    } else if (diff > 0) {
      // Rated above average
      if (diff >= 2.0) phrase = rating >= 4.5 ? 'A rare rave.' : 'Way more into this than most.';
      else if (diff >= 1.0) phrase = 'Above the crowd on this one.';
      else phrase = 'Warmer than most.';
      colorClass = 'text-green-600';
    } else {
      // Rated below average
      if (diff <= -2.0) phrase = 'Called this overrated.';
      else if (diff <= -1.0) phrase = 'Tougher than the crowd.';
      else phrase = 'Colder than most.';
      colorClass = 'text-orange-500';
    }

    return <p className={`text-[10px] italic ${colorClass} ${className}`}>{phrase}</p>;
  };

  // Reusable action bar
  const actionBar = (
    <div className="flex items-center gap-3">
      {/* ↑ Agree · Flame Hot Take · ↓ Not My Take */}
      <button
        onClick={(e) => { e.stopPropagation(); handleReaction('up'); }}
        className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${isLiked && !localReaction ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'}`}
        title="Agree"
      >
        <ArrowUp size={16} strokeWidth={isLiked && !localReaction ? 2.5 : 1.75} />
        <span className="text-xs">{post.likes || 0}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleReaction('flame'); }}
        className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${localReaction === 'flame' ? 'text-orange-400' : 'text-gray-400 hover:text-orange-400'}`}
        title="Hot Take"
      >
        <Flame size={15} strokeWidth={localReaction === 'flame' ? 2.5 : 1.75} fill={localReaction === 'flame' ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleReaction('down'); }}
        className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${localReaction === 'down' ? 'text-gray-300' : 'text-gray-400 hover:text-gray-300'}`}
        title="Not My Take"
      >
        <ArrowDown size={16} strokeWidth={localReaction === 'down' ? 2.5 : 1.75} />
      </button>
      <button
        onClick={handleCommentToggle}
        className={`flex items-center gap-1.5 text-sm ${showComments ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
      >
        <MessageCircle size={18} />
        <span className="text-xs">{Math.max(post.comments || 0, comments.length)}</span>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        {post.externalId?.startsWith('series-') && <span className="text-[9px] font-semibold text-purple-500 bg-purple-50 border border-purple-200 rounded-full px-1.5 py-0.5">Series</span>}
        <span className={`text-[11px] font-medium ${ti.color} ${ti.bg} px-2 py-0.5 rounded-full`}>{ti.label}</span>
        <span className="text-xs text-gray-400">{timeAgo(post.timestamp)}</span>
      </div>
    </div>
  );

  // Action bar variant for promoted rating cards
  const actionFirstBar = (
    <div className="flex items-center gap-3 py-2">
      {/* ↑ Agree · Flame Hot Take · ↓ Not My Take */}
      <button
        onClick={(e) => { e.stopPropagation(); handleReaction('up'); }}
        className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${isLiked && !localReaction ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'}`}
        title="Agree"
      >
        <ArrowUp size={16} strokeWidth={isLiked && !localReaction ? 2.5 : 1.75} />
        <span className="text-xs">{post.likes || 0}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleReaction('flame'); }}
        className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${localReaction === 'flame' ? 'text-orange-400' : 'text-gray-400 hover:text-orange-400'}`}
        title="Hot Take"
      >
        <Flame size={15} strokeWidth={localReaction === 'flame' ? 2.5 : 1.75} fill={localReaction === 'flame' ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleReaction('down'); }}
        className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${localReaction === 'down' ? 'text-gray-300' : 'text-gray-400 hover:text-gray-300'}`}
        title="Not My Take"
      >
        <ArrowDown size={16} strokeWidth={localReaction === 'down' ? 2.5 : 1.75} />
      </button>
      {/* 💬 Comment */}
      <button
        onClick={handleCommentToggle}
        className={`flex items-center gap-1.5 text-sm ${showComments ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
      >
        <MessageCircle size={18} />
        <span className="text-xs">{Math.max(post.comments || 0, comments.length)}</span>
      </button>
      {/* ⭐ Rate — only for other users' posts */}
      {isOtherUser && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowInlineRater(v => !v); }}
          className={`flex items-center gap-1 text-sm transition-all active:scale-110 ${ratingSubmitted ? 'text-yellow-400' : showInlineRater ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}
          title={ratingSubmitted ? `Your rating: ${ratingValue}/5` : 'Rate this'}
        >
          <Star size={18} fill={ratingSubmitted ? 'currentColor' : 'none'} />
        </button>
      )}
      {/* Pill + timestamp — right side */}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
          {(post.rating || 0) > 0 ? 'rated' : post.type === 'thought' ? 'take' : 'reviewed'}
        </span>
        <span className="text-xs text-gray-400">{timeAgo(post.timestamp)}</span>
      </div>
    </div>
  );

  // Poster helper — styled placeholder tile when no image is available
  const posterFallbackBg: Record<string, string> = {
    podcast: 'from-pink-700 to-rose-900',
    music: 'from-fuchsia-700 to-purple-900',
    book: 'from-emerald-700 to-teal-900',
    game: 'from-blue-700 to-indigo-900',
    tv: 'from-violet-700 to-purple-900',
    movie: 'from-gray-700 to-gray-900',
  };
  const posterFallback = post.mediaTitle ? (
    <div className={`relative flex-shrink-0 w-[88px] h-[132px] rounded-xl overflow-hidden shadow-md bg-gradient-to-br ${posterFallbackBg[mediaTypeNorm || ''] || 'from-gray-700 to-gray-900'} flex flex-col items-end justify-between p-2`}>
      <div className="self-start opacity-60">
        {mediaTypeNorm === 'podcast' && <Headphones size={16} className="text-white" />}
        {mediaTypeNorm === 'music' && <Music size={16} className="text-white" />}
        {mediaTypeNorm === 'book' && <Book size={16} className="text-white" />}
        {mediaTypeNorm === 'game' && <Gamepad2 size={16} className="text-white" />}
        {mediaTypeNorm === 'tv' && <Tv2 size={16} className="text-white" />}
        {(!mediaTypeNorm || mediaTypeNorm === 'movie' || !['podcast','music','book','game','tv'].includes(mediaTypeNorm)) && <Film size={16} className="text-white" />}
      </div>
      <p className="text-white text-[11px] font-bold leading-tight line-clamp-4 w-full drop-shadow">{post.mediaTitle}</p>
    </div>
  ) : null;

  const posterEl = post.mediaImage && post.mediaImage.startsWith('http') ? (
    <div className="relative flex-shrink-0 w-[88px] h-[132px]">
      {post.externalId && post.externalSource ? (
        <Link href={`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`}>
          <div className="relative w-full h-full rounded-xl overflow-hidden shadow-md cursor-pointer hover:opacity-90 transition-opacity">
            <img src={post.mediaImage} alt={post.mediaTitle} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </Link>
      ) : (
        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-md">
          <img src={post.mediaImage} alt={post.mediaTitle} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      {onAddToList && (post.externalId || post.mediaTitle) && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToList({ title: post.mediaTitle, externalId: post.externalId || '', externalSource: post.externalSource || 'tmdb', imageUrl: post.mediaImage || '', type: post.mediaType || 'movie' }); }}
          className="absolute bottom-1.5 right-1.5 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all"
          title="Add to list"
        >
          <Plus size={13} color="white" />
        </button>
      )}
    </div>
  ) : null;

  // ── Hot Take card ──────────────────────────────────────────────────────────
  if (post.type === 'hot_take') {
    const castVote = async (v: 'fire' | 'ice') => {
      if (fireIceVoted || !session?.access_token) return;
      setFireIceVoted(v);
      if (v === 'fire') setFireCount(n => n + 1); else setIceCount(n => n + 1);
      const col = v === 'fire' ? 'fire_votes' : 'ice_votes';
      const newVal = (v === 'fire' ? fireCount : iceCount) + 1;
      await supabase.from('social_posts').update({ [col]: newVal }).eq('id', post.id);
    };
    const spoilerBlurred = post.containsSpoilers && !peeked;
    return (
      <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-1">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Link href={`/user/${post.user?.id}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-xs cursor-pointer shrink-0">
                {post.user?.avatar ? <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : (post.user?.username?.[0]?.toUpperCase() || '?')}
              </div>
            </Link>
            <div>
              <Link href={`/user/${post.user?.id}`}>
                <span className="text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
              </Link>
              {post.user?.username && post.user?.displayName && post.user.username !== post.user.displayName && (
                <p className="text-[10px] text-gray-400 leading-none">@{post.user.username}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-orange-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              <Flame size={11} /> Hot Take
            </span>
            <span className="text-[11px] text-gray-400">{timeAgo(post.timestamp)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          {post.containsSpoilers && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ Spoilers</span>
              {spoilerBlurred && <button onClick={() => setPeeked(true)} className="text-[10px] text-gray-400 underline">Reveal</button>}
            </div>
          )}
          <div className={spoilerBlurred ? 'blur-sm select-none' : ''}>
            <p className="text-[15px] font-semibold text-gray-900 leading-snug">{post.content}</p>
          </div>
          {/* Optional media pill */}
          {post.mediaTitle && (
            <div className="flex items-center gap-2 mt-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              {post.mediaImage && <img src={post.mediaImage} alt="" className="w-8 h-11 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-semibold text-gray-800 truncate">{post.mediaTitle}</p>
                  {post.externalId?.startsWith('series-') && <span className="text-[9px] font-semibold text-purple-500 bg-purple-50 border border-purple-200 rounded-full px-1.5 py-0.5 shrink-0">Series</span>}
                </div>
                {mediaTypeLabel && <span className="text-[10px] text-gray-400">{mediaTypeLabel}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
          <button
            onClick={() => castVote('fire')}
            disabled={!!fireIceVoted}
            className={`flex items-center gap-1.5 text-sm font-medium transition-all active:scale-110 ${fireIceVoted === 'fire' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-400'}`}
          >
            <Flame size={16} fill={fireIceVoted === 'fire' ? 'currentColor' : 'none'} />
            <span className="text-xs">{fireCount}</span>
          </button>
          <button
            onClick={() => castVote('ice')}
            disabled={!!fireIceVoted}
            className={`flex items-center gap-1.5 text-sm font-medium transition-all active:scale-110 ${fireIceVoted === 'ice' ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
          >
            <Snowflake size={16} fill={fireIceVoted === 'ice' ? 'currentColor' : 'none'} />
            <span className="text-xs">{iceCount}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
            className={`flex items-center gap-1.5 text-sm transition-all active:scale-125 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
          >
            <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
            <span className="text-xs">{post.likes || 0}</span>
          </button>
          <button
            onClick={handleCommentToggle}
            className={`flex items-center gap-1.5 text-sm ${showComments ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
          >
            <MessageCircle size={15} />
            <span className="text-xs">{Math.max(post.comments || 0, comments.length)}</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {currentUserId !== post.user?.id && (
              <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="p-1 text-gray-300 hover:text-red-400 transition-colors" title="Report post">
                <Flag size={14} />
              </button>
            )}
            {currentUserId === post.user?.id && onDeletePost && (
              <button onClick={() => onDeletePost(post.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors" title="Delete post">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {showComments && (
          <div className={`border-t border-gray-200 bg-gray-50 ${replyingToName ? 'border-l-[3px] border-violet-400' : ''}`}>
            {loadingComments ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
            ) : comments.length === 0 ? (
              <div className="px-4 pt-4 pb-5">
                <p className="text-[11px] text-gray-400 text-center mb-3">Drop your take 👀</p>
                {session && (
                  <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3.5">
                    <MessageCircle size={16} className="text-violet-400 flex-shrink-0" />
                    <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="What did you think?" className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400" onKeyPress={(e) => e.key === 'Enter' && submitComment()} />
                    <button onClick={submitComment} disabled={!commentText.trim() || submitting} className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors flex-shrink-0">Post</button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {comments.slice(0, 3).map((c: any, idx: number) => (
                  <div key={c.id} className={`px-4 py-3 bg-white ${idx < Math.min(comments.length, 3) - 1 ? 'border-b border-gray-200' : ''}`}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">{c.user?.displayName || c.user?.username || c.username || 'User'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{c.created_at ? timeAgo(c.created_at) : ''}</span>
                        {(currentUserId === (c.user?.id || c.userId) || currentUserId === post.userId) && (
                          <button onClick={(e) => { e.stopPropagation(); deleteComment(c.id); }} className="text-gray-300 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={10} /></button>
                        )}
                        {currentUserId && currentUserId !== (c.user?.id || c.userId) && (
                          <button onClick={(e) => { e.stopPropagation(); setReportCommentTarget({ id: c.id, userId: c.user?.id || c.userId || '', userName: c.user?.username || c.username || 'User' }); }} className="text-gray-300 hover:text-red-400 transition-colors" title="Report"><Flag size={10} /></button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{c.content}</p>
                    <div className="flex items-center gap-3">
                      <button className="text-[11px] font-semibold text-violet-600" onClick={() => { setReplyingToId(replyingToId === c.id ? null : c.id); setReplyText(''); }}>Reply</button>
                      <div className="flex items-center gap-1 text-gray-400"><Heart size={11} /><span className="text-[11px]">{c.likes_count || 0}</span></div>
                    </div>
                    {replyingToId === c.id && (
                      <div className="mt-2 ml-1 pl-3 border-l-2 border-violet-200">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                          <input autoFocus type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Replying to @${c.user?.username || c.username || 'user'}…`} className="flex-1 text-xs bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400" onKeyPress={(e) => e.key === 'Enter' && submitReply(c.id)} />
                          <button onClick={() => submitReply(c.id)} disabled={!replyText.trim() || submitting} className="text-[11px] font-semibold text-violet-600 disabled:opacity-40 px-1">Post</button>
                          <button onClick={() => { setReplyingToId(null); setReplyText(''); }} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>
                        </div>
                      </div>
                    )}
                    {c.replies?.length > 0 && (
                      <div className="mt-2 ml-1 pl-3 border-l-2 border-violet-100 space-y-2">
                        {c.replies.map((r: any) => (
                          <div key={r.id} className="py-1">
                            <span className="text-[11px] font-bold text-gray-800">{r.user?.displayName || r.user?.username || r.username || 'User'}</span>
                            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {comments.length > 3 && (
                  <div className="border-t border-gray-200 px-4 py-2.5 text-center bg-white">
                    <button className="text-xs font-semibold text-violet-600">View all {comments.length} takes →</button>
                  </div>
                )}
                {session && (
                  <div className="border-t border-gray-200 px-3 pt-2 pb-3 bg-gray-50">
                    {replyingToName && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-violet-500 font-medium">Replying to @{replyingToName}</span>
                        <button onClick={() => { setReplyingToName(null); setCommentText(''); }} className="text-gray-300 hover:text-gray-500 leading-none">×</button>
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="What did you think?" className="flex-1 text-xs px-4 py-2.5 rounded-full border border-violet-300 focus:outline-none focus:border-violet-500 bg-white" onKeyPress={(e) => e.key === 'Enter' && submitComment()} />
                      <button onClick={submitComment} disabled={!commentText.trim() || submitting} className="px-4 py-2.5 rounded-full bg-violet-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors">Send</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <ReportSheet isOpen={reportPostOpen} onClose={() => setReportPostOpen(false)} contentType="post" contentId={post.id} reportedUserId={post.user?.id} reportedUserName={post.user?.username} />
      </div>
    );
  }

  // ── Question card ───────────────────────────────────────────────────────────
  if (post.type === 'question') {
    return (
      <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Link href={`/user/${post.user?.id}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs cursor-pointer shrink-0">
                {post.user?.avatar ? <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : (post.user?.username?.[0]?.toUpperCase() || '?')}
              </div>
            </Link>
            <div>
              <Link href={`/user/${post.user?.id}`}>
                <span className="text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
              </Link>
              {post.user?.username && post.user?.displayName && post.user.username !== post.user.displayName && (
                <p className="text-[10px] text-gray-400 leading-none">@{post.user.username}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              <HelpCircle size={11} /> Question
            </span>
            <span className="text-[11px] text-gray-400">{timeAgo(post.timestamp)}</span>
          </div>
        </div>

        {/* Question text + optional media side by side */}
        <div className="px-4 pb-3">
          <div className="flex items-stretch gap-0 bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden">
            <div className="flex-1 px-4 py-3 min-w-0">
              <p className="text-[16px] font-semibold text-gray-900 leading-snug">{post.content}</p>
              {post.mediaTitle && (
                <p className="text-[11px] text-blue-400 font-medium mt-1.5 truncate">{post.mediaTitle}</p>
              )}
            </div>
            {post.mediaImage && (
              <img
                src={post.mediaImage}
                alt={post.mediaTitle || ''}
                className="w-16 object-cover shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
              />
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
          {/* ↑ Agree · Flame Hot Take · ↓ Not My Take */}
          <button
            onClick={(e) => { e.stopPropagation(); handleReaction('up'); }}
            className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${isLiked && !localReaction ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'}`}
            title="Agree"
          >
            <ArrowUp size={15} strokeWidth={isLiked && !localReaction ? 2.5 : 1.75} />
            <span className="text-xs">{post.likes || 0}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleReaction('flame'); }}
            className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${localReaction === 'flame' ? 'text-orange-400' : 'text-gray-400 hover:text-orange-400'}`}
            title="Hot Take"
          >
            <Flame size={14} strokeWidth={localReaction === 'flame' ? 2.5 : 1.75} fill={localReaction === 'flame' ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleReaction('down'); }}
            className={`flex items-center gap-1 text-sm transition-all active:scale-125 ${localReaction === 'down' ? 'text-gray-300' : 'text-gray-400 hover:text-gray-300'}`}
            title="Not My Take"
          >
            <ArrowDown size={15} strokeWidth={localReaction === 'down' ? 2.5 : 1.75} />
          </button>
          <button
            onClick={handleCommentToggle}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${showComments ? 'text-blue-500' : 'text-gray-600 hover:text-blue-500'}`}
          >
            <MessageCircle size={15} />
            <span className="text-xs">{Math.max(post.comments || 0, comments.length) > 0 ? `${Math.max(post.comments || 0, comments.length)} replies` : 'Reply'}</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {currentUserId !== post.user?.id && (
              <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="p-1 text-gray-300 hover:text-red-400 transition-colors" title="Report post">
                <Flag size={14} />
              </button>
            )}
            {currentUserId === post.user?.id && onDeletePost && (
              <button onClick={() => onDeletePost(post.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors" title="Delete post">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {showComments && (
          <div className={`border-t border-gray-200 bg-gray-50 ${replyingToName ? 'border-l-[3px] border-violet-400' : ''}`}>
            {loadingComments ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
            ) : comments.length === 0 ? (
              <div className="px-4 pt-4 pb-5">
                <p className="text-[11px] text-gray-400 text-center mb-3">Drop your take 👀</p>
                {session && (
                  <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3.5">
                    <MessageCircle size={16} className="text-violet-400 flex-shrink-0" />
                    <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="What did you think?" className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400" onKeyPress={(e) => e.key === 'Enter' && submitComment()} />
                    <button onClick={submitComment} disabled={!commentText.trim() || submitting} className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors flex-shrink-0">Post</button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {comments.slice(0, 3).map((c: any, idx: number) => (
                  <div key={c.id} className={`px-4 py-3 bg-white ${idx < Math.min(comments.length, 3) - 1 ? 'border-b border-gray-200' : ''}`}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">{c.user?.displayName || c.user?.username || c.username || 'User'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{c.created_at ? timeAgo(c.created_at) : ''}</span>
                        {(currentUserId === (c.user?.id || c.userId) || currentUserId === post.userId) && (
                          <button onClick={(e) => { e.stopPropagation(); deleteComment(c.id); }} className="text-gray-300 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={10} /></button>
                        )}
                        {currentUserId && currentUserId !== (c.user?.id || c.userId) && (
                          <button onClick={(e) => { e.stopPropagation(); setReportCommentTarget({ id: c.id, userId: c.user?.id || c.userId || '', userName: c.user?.username || c.username || 'User' }); }} className="text-gray-300 hover:text-red-400 transition-colors" title="Report"><Flag size={10} /></button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{c.content}</p>
                    <div className="flex items-center gap-3">
                      <button className="text-[11px] font-semibold text-violet-600" onClick={() => { setReplyingToId(replyingToId === c.id ? null : c.id); setReplyText(''); }}>Reply</button>
                      <div className="flex items-center gap-1 text-gray-400"><Heart size={11} /><span className="text-[11px]">{c.likes_count || 0}</span></div>
                    </div>
                    {replyingToId === c.id && (
                      <div className="mt-2 ml-1 pl-3 border-l-2 border-violet-200">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                          <input autoFocus type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Replying to @${c.user?.username || c.username || 'user'}…`} className="flex-1 text-xs bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400" onKeyPress={(e) => e.key === 'Enter' && submitReply(c.id)} />
                          <button onClick={() => submitReply(c.id)} disabled={!replyText.trim() || submitting} className="text-[11px] font-semibold text-violet-600 disabled:opacity-40 px-1">Post</button>
                          <button onClick={() => { setReplyingToId(null); setReplyText(''); }} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>
                        </div>
                      </div>
                    )}
                    {c.replies?.length > 0 && (
                      <div className="mt-2 ml-1 pl-3 border-l-2 border-violet-100 space-y-2">
                        {c.replies.map((r: any) => (
                          <div key={r.id} className="py-1">
                            <span className="text-[11px] font-bold text-gray-800">{r.user?.displayName || r.user?.username || r.username || 'User'}</span>
                            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {comments.length > 3 && (
                  <div className="border-t border-gray-200 px-4 py-2.5 text-center bg-white">
                    <button className="text-xs font-semibold text-violet-600">View all {comments.length} takes →</button>
                  </div>
                )}
                {session && (
                  <div className="border-t border-gray-200 px-3 pt-2 pb-3 bg-gray-50">
                    {replyingToName && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-violet-500 font-medium">Replying to @{replyingToName}</span>
                        <button onClick={() => { setReplyingToName(null); setCommentText(''); }} className="text-gray-300 hover:text-gray-500 leading-none">×</button>
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="What did you think?" className="flex-1 text-xs px-4 py-2.5 rounded-full border border-violet-300 focus:outline-none focus:border-violet-500 bg-white" onKeyPress={(e) => e.key === 'Enter' && submitComment()} />
                      <button onClick={submitComment} disabled={!commentText.trim() || submitting} className="px-4 py-2.5 rounded-full bg-violet-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors">Send</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <ReportSheet isOpen={reportPostOpen} onClose={() => setReportPostOpen(false)} contentType="post" contentId={post.id} reportedUserId={post.user?.id} reportedUserName={post.user?.username} />
      </div>
    );
  }

  // ── Full-bleed poster card for rating / review / thought posts ───────────
  if (isRatingPost) {
    const displayName = post.user?.displayName || post.user?.username || 'Someone';
    const hasPoster = !!(post.mediaImage && post.mediaImage.startsWith('http'));
    const hasContent = !!(post.content && post.content.trim());
    const hasRating = (post.rating || 0) > 0;

    return (
      <>
        {/* ── Seen It?–style card: white container + internal fan stack ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-visible">

          {/* Header: section label */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Takes & Ratings</p>
          </div>

          {/* Media title — above the fan stack */}
          <div className="px-4 pb-1 pt-0 text-center">
            <p className="font-semibold text-gray-900 text-base leading-tight">{post.mediaTitle || 'Untitled'}</p>
          </div>

          {/* Fan stack area — all cards sit inside the white container */}
          <div className="relative flex items-center justify-center" style={{ height: 310, overflow: 'visible' }}>

            {/* Back peek card (left) */}
            {stackPosts && (stackPosts[(stackIndex ?? 0) + 2]?.mediaImage || '').startsWith('http') && (
              <div style={{
                position: 'absolute', width: 195, height: 282, borderRadius: 16, overflow: 'hidden',
                transform: 'translateX(-52px) rotate(-8deg) scale(0.85)',
                zIndex: 1, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', background: '#111827',
              }}>
                <img src={stackPosts[(stackIndex ?? 0) + 2].mediaImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Middle peek card (right) */}
            {stackPosts && (stackPosts[(stackIndex ?? 0) + 1]?.mediaImage || '').startsWith('http') && (
              <div style={{
                position: 'absolute', width: 195, height: 282, borderRadius: 16, overflow: 'hidden',
                transform: 'translateX(52px) rotate(8deg) scale(0.85)',
                zIndex: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', background: '#111827',
              }}>
                <img src={stackPosts[(stackIndex ?? 0) + 1].mediaImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Front card — tap poster → media detail page */}
            <div
              ref={swipeProps?.ref}
              className="relative rounded-2xl overflow-hidden bg-gray-900 cursor-pointer"
              style={{ height: 282, width: 208, position: 'absolute', zIndex: 5, boxShadow: '0 8px 28px rgba(0,0,0,0.30)', ...(swipeProps?.style ?? {}) }}
              onClick={() => {
                if (post.externalSource && post.externalId) {
                  setLocation(`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`);
                }
              }}
            >
              {swipeProps?.overlays}
          {/* Background image or gradient fallback */}
          {hasPoster ? (
            <img
              src={post.mediaImage!}
              alt={post.mediaTitle || ''}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${posterFallbackBg[mediaTypeNorm || ''] || 'from-gray-700 to-gray-900'}`} />
          )}

          {/* Gradient overlay: transparent top → very dark bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />

          {/* Top-right: media type pill + delete / report */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {mediaTypeLabel && (
              <span className="text-[10px] font-semibold text-white/90 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/15">{mediaTypeLabel}</span>
            )}
            {currentUserId && (post.user?.id === currentUserId || post.user?.is_persona) && onDeletePost && (
              <button onClick={(e) => { e.stopPropagation(); onDeletePost(post.id); }} className="text-white/50 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
            )}
            {currentUserId && post.user?.id !== currentUserId && (
              <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="text-white/50 hover:text-orange-400 transition-colors"><Flag size={13} /></button>
            )}
          </div>

          {/* Bottom content overlay — clicking stars/commentary expands More Ratings, not navigates */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-16" onClick={(e) => { e.stopPropagation(); setShowAllRelated(true); }}>
            {/* Stars */}
            {hasRating && (
              <div className="flex items-center gap-0.5 mb-2">
                {[1,2,3,4,5].map(s => {
                  const r = post.rating!;
                  if (s <= Math.floor(r)) return <Star key={s} size={20} className="text-yellow-400 fill-yellow-400 drop-shadow" />;
                  if (s === Math.ceil(r) && r % 1 >= 0.5) return (
                    <div key={s} className="relative" style={{ width: 20, height: 20 }}>
                      <Star size={20} className="absolute text-white/20" />
                      <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}><Star size={20} className="text-yellow-400 fill-yellow-400 drop-shadow" /></div>
                    </div>
                  );
                  return <Star key={s} size={20} className="text-white/25" />;
                })}
              </div>
            )}

            {/* Quoted review or thought */}
            {hasContent && (
              <p className="text-white text-[14px] font-medium leading-snug line-clamp-2 italic mb-1 drop-shadow-sm">
                "{post.content}"
              </p>
            )}

            {/* Attribution */}
            <p className="text-white/65 text-xs font-medium mb-3">— {displayName}</p>

          </div>
        </div>

          </div>{/* end fan area */}

          {/* Compact rated + aligned row below the fan */}
          {isOtherUser && (ratingSubmitted || tasteAlignment !== null || alignmentNudge) && (
            <div className="flex items-center justify-center gap-3 px-4 py-2">
              {ratingSubmitted && ratingValue > 0 && (
                <span className="text-xs text-gray-500">You rated this <span className="text-yellow-500 font-semibold">{ratingValue}/5 ★</span></span>
              )}
              {ratingSubmitted && tasteAlignment !== null && <span className="text-gray-300 text-xs">·</span>}
              {tasteAlignment !== null && (
                <span className="text-xs text-gray-500">You're <span className="text-violet-600 font-semibold">{tasteAlignment}%</span> aligned</span>
              )}
              {tasteAlignment === null && alignmentNudge && !ratingSubmitted && (
                <span className="text-[11px] text-gray-400 text-center">Rate 10 things to see your alignment with other fans</span>
              )}
            </div>
          )}

          {/* ── Action row ── */}
          <div className="flex items-start justify-center gap-4 px-4 mt-3 pb-4" onClick={(e) => e.stopPropagation()}>
          {/* Agree */}
          <button
            onClick={(e) => { e.stopPropagation(); handleReaction('up'); }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border ${isLiked && !localReaction ? 'bg-purple-100 border-purple-200' : 'bg-white border-gray-200'}`}>
              <ArrowUp size={18} className={isLiked && !localReaction ? 'text-purple-600' : 'text-gray-500'} strokeWidth={isLiked && !localReaction ? 2.5 : 1.75} />
            </div>
            <span className={`text-[10px] font-medium ${isLiked && !localReaction ? 'text-purple-600' : 'text-gray-500'}`}>
              Agree
            </span>
          </button>

          {/* Hot Take */}
          <button
            onClick={(e) => { e.stopPropagation(); handleReaction('flame'); }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border ${localReaction === 'flame' ? 'bg-orange-100 border-orange-200' : 'bg-white border-gray-200'}`}>
              <Flame size={18} className={localReaction === 'flame' ? 'text-orange-500' : 'text-gray-500'} fill={localReaction === 'flame' ? 'currentColor' : 'none'} />
            </div>
            <span className={`text-[10px] font-medium ${localReaction === 'flame' ? 'text-orange-500' : 'text-gray-500'}`}>Hot Take</span>
          </button>

          {/* Not Me */}
          <button
            onClick={(e) => { e.stopPropagation(); handleReaction('down'); }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border ${localReaction === 'down' ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-200'}`}>
              <ArrowDown size={18} className={localReaction === 'down' ? 'text-gray-700' : 'text-gray-500'} strokeWidth={localReaction === 'down' ? 2.5 : 1.75} />
            </div>
            <span className={`text-[10px] font-medium ${localReaction === 'down' ? 'text-gray-700' : 'text-gray-500'}`}>Disagree</span>
          </button>

          {/* Rate it — other user's post */}
          {isOtherUser && session?.access_token && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowInlineRater(v => !v); }}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border ${ratingSubmitted ? 'bg-yellow-400 border-yellow-400' : showInlineRater ? 'bg-violet-600 border-violet-600' : 'bg-white border-gray-200'}`}>
                <Star size={18} className={ratingSubmitted ? 'text-white' : showInlineRater ? 'text-white' : 'text-gray-500'} fill={ratingSubmitted || showInlineRater ? 'none' : 'none'} strokeWidth={showInlineRater ? 2 : 1.75} />
              </div>
              <span className={`text-[10px] font-medium ${showInlineRater ? 'text-purple-600' : ratingSubmitted ? 'text-yellow-500' : 'text-gray-500'}`}>
                {ratingSubmitted ? `${ratingValue}★` : 'Rate it'}
              </span>
            </button>
          )}

          {/* Add to list */}
          {onAddToList && (post.externalId || post.mediaTitle) && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToList({ title: post.mediaTitle, externalId: post.externalId || '', externalSource: post.externalSource || 'tmdb', imageUrl: post.mediaImage || '', type: post.mediaType || 'movie' }); }}
              className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center">
                <Plus size={18} className="text-gray-500" />
              </div>
              <span className="text-[10px] font-medium text-gray-500">Add to list</span>
            </button>
          )}
        </div>

        {/* YOUR TURN — inline star rater appears below card */}
        {isOtherUser && session?.access_token && showInlineRater && !ratingSubmitted && (
          <div
            ref={starsRef}
            className="flex items-center gap-1.5 mt-2 mx-3 py-2.5 px-3 bg-violet-50 rounded-xl touch-none select-none"
            onMouseLeave={() => setHoverRating(0)}
            onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
            onTouchMove={(e) => {
              e.stopPropagation();
              if (!starsRef.current) return;
              const touch = e.touches[0];
              const rect = starsRef.current.getBoundingClientRect();
              const x = touch.clientX - rect.left;
              const starWidth = rect.width / 5;
              const starIndex = Math.floor(x / starWidth);
              const withinStar = (x % starWidth) / starWidth;
              const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
              setHoverRating(Math.round(val * 2) / 2);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              if (hoverRating > 0) { handleSubmitRating(hoverRating); setShowInlineRater(false); }
              setHoverRating(0);
            }}
          >
            <span className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mr-1">Your Turn</span>
            {[1,2,3,4,5].map(star => {
              const displayVal = hoverRating;
              return (
                <div key={star} className="relative" style={{ width: 28, height: 28 }}>
                  <Star size={28} className="absolute inset-0 text-violet-200" />
                  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                    <Star size={28} className="fill-yellow-400 text-yellow-400" />
                  </div>
                  <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star - 0.5)} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star - 0.5); setShowInlineRater(false); }} aria-label={`Rate ${star - 0.5}`} />
                  <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star)} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star); setShowInlineRater(false); }} aria-label={`Rate ${star}`} />
                </div>
              );
            })}
            {hoverRating > 0 && <span className="ml-1 text-xs text-gray-400">{hoverRating}/5</span>}
          </div>
        )}

        {/* ── Other Takes section (collapsed by default) ── */}
        {relatedRatings.length > 0 && (
          <div className="mx-3 mb-3 rounded-xl border border-gray-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Collapsed header — always visible, tap to expand */}
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 active:bg-gray-100 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowAllRelated(v => !v); }}
            >
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">More Ratings</span>
              {/* Avatar bubble stack */}
              <div className="flex -space-x-1.5 flex-shrink-0">
                {relatedRatings.slice(0, 4).map((r) => (
                  <div
                    key={r.userId}
                    className="w-5 h-5 rounded-full border-2 border-gray-50 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                    style={{ background: `hsl(${(r.displayName.charCodeAt(0) * 47) % 360}, 50%, 48%)` }}
                  >
                    {r.displayName[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-medium text-gray-500 flex-1 text-left">
                {relatedRatings.length} rating{relatedRatings.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${showAllRelated ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded list */}
            {showAllRelated && (
              <div className="border-t border-gray-100 bg-white">
                {relatedRatings.map((r) => (
                  <div key={r.userId} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-medium text-gray-700 flex-shrink-0 w-24 truncate">{r.displayName}</span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className={s <= Math.round(r.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                      ))}
                    </div>
                    {r.content ? (
                      <span className="text-[10px] text-gray-400 truncate flex-1">"{r.content}"</span>
                    ) : (
                      <span className="text-[10px] text-gray-300 flex-1 italic">No review</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Inline Comments section ── */}
        <div className="border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
          {/* Header — only shown when there are comments */}
          {(comments.length > 0 || (post.comments || 0) > 0) && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Comments on this take{Math.max(post.comments || 0, comments.length) > 0 ? ` (${Math.max(post.comments || 0, comments.length)})` : ''}
              </span>
              {comments.length > 2 && (
                <button onClick={() => setShowAllComments(v => !v)} className="flex items-center gap-0.5 text-[10px] font-medium text-violet-500">
                  {showAllComments ? 'Less' : 'Newest'} <ChevronDown size={11} className={`transition-transform ${showAllComments ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          {/* Comment list */}
          {comments.length > 0 && (
            <div className="px-4 pt-1 pb-2 space-y-3">
              {(showAllComments ? comments : comments.slice(0, 2)).map((c: any) => {
                const cName = c.user?.displayName || c.user?.username || c.username || 'User';
                const isReplying = replyingToId === c.id;
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 26 }}>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                        {c.user?.avatar ? <img src={c.user.avatar} className="w-full h-full object-cover" alt="" /> : cName[0]?.toUpperCase()}
                      </div>
                      {(c.replies?.length > 0 || isReplying) && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[12px]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900">{cName}</span>
                        <span className="text-[10px] text-gray-400">{c.created_at ? timeAgo(c.created_at) : ''}</span>
                        <div className="ml-auto flex items-center gap-1">
                          {currentUserId === (c.user?.id || c.userId) && (
                            <button onClick={(e) => { e.stopPropagation(); deleteComment(c.id); }} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 leading-snug mt-0.5">{c.content}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <button onClick={() => { setReplyingToId(isReplying ? null : c.id); setReplyText(''); }} className="text-[10px] font-semibold text-gray-400 hover:text-violet-500 transition-colors">Reply</button>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Heart size={10} />
                          {(c.likes_count || 0) > 0 && <span className="text-[10px]">{c.likes_count}</span>}
                        </div>
                      </div>
                      {isReplying && (
                        <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-violet-200">
                          <input autoFocus type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${cName}…`} className="flex-1 text-xs bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400"
                            onKeyPress={(e) => e.key === 'Enter' && submitReply(c.id)} />
                          <button onClick={() => submitReply(c.id)} disabled={!replyText.trim() || submitting} className="text-[11px] font-semibold text-violet-600 disabled:opacity-40">Post</button>
                          <button onClick={() => { setReplyingToId(null); setReplyText(''); }} className="text-gray-400"><X size={11} /></button>
                        </div>
                      )}
                      {c.replies?.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-gray-100 space-y-2">
                          {c.replies.map((r: any) => {
                            const rName = r.user?.displayName || r.user?.username || r.username || 'User';
                            return (
                              <div key={r.id} className="flex gap-2 pt-1">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-300 to-blue-300 flex items-center justify-center text-white text-[9px] font-bold overflow-hidden flex-shrink-0">
                                  {r.user?.avatar ? <img src={r.user.avatar} className="w-full h-full object-cover" alt="" /> : rName[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-gray-800">{rName}</span>
                                    <span className="text-[9px] text-gray-400">{r.created_at ? timeAgo(r.created_at) : ''}</span>
                                  </div>
                                  <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{r.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {!showAllComments && comments.length > 2 && (
                <button onClick={() => setShowAllComments(true)} className="text-[11px] font-semibold text-violet-500 hover:text-violet-700">
                  View all {comments.length} comments ↓
                </button>
              )}
            </div>
          )}

          {/* Comment input bar */}
          {session?.access_token && (
            <div className="flex items-center gap-2 px-3 pb-3 pt-2 mx-3">
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <span className="text-violet-600 text-[10px] font-semibold">
                  {(session?.user?.user_metadata?.display_name || session?.user?.email || 'Y')[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 flex items-center bg-gray-50 rounded-full px-4 py-2 gap-2 border border-gray-100">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add your take..."
                  className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400"
                  onClick={(e) => e.stopPropagation()}
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.stopPropagation(); submitComment(); }}}
                />
                {commentText.trim() && (
                  <button
                    onClick={(e) => { e.stopPropagation(); submitComment(); }}
                    disabled={submitting}
                    className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                  >
                    <Send size={11} className="text-white ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        </div>{/* ── end outer white container ── */}

        {/* Post detail bottom sheet */}
        <PostDetailSheet
          isOpen={posterDetailOpen}
          onClose={() => setPosterDetailOpen(false)}
          post={{
            id: post.id,
            userId: post.userId || post.user?.id || '',
            username: post.user?.username || '',
            displayName: post.user?.displayName,
            avatar: post.user?.avatar,
            mediaTitle: post.mediaTitle || '',
            mediaType: post.mediaType,
            mediaImage: post.mediaImage,
            mediaExternalId: post.externalId,
            mediaExternalSource: post.externalSource,
            rating: post.rating,
            review: post.content,
            timestamp: post.timestamp,
          }}
        />

        <ReportSheet
          isOpen={reportPostOpen}
          onClose={() => setReportPostOpen(false)}
          contentType="post"
          contentId={post.id}
          reportedUserId={post.userId}
          reportedUserName={post.userName}
        />
      </>
    );
  }

  return (
    <>
    <div className={`relative ${forceActionFirst ? 'w-full' : 'snap-start flex-shrink-0 w-[90vw]'} md:w-full md:max-w-none md:snap-align-none md:flex-shrink bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`}>
      {isActionFirst ? (
        // ACTION FIRST layout — stars on top, friend's take below
        <>
          {/* Top-right: media type pill + action button */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            {mediaTypeLabel && (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{mediaTypeLabel}</span>
            )}
            {currentUserId && (post.user?.id === currentUserId || post.user?.is_persona) && onDeletePost && (
              <button onClick={(e) => { e.stopPropagation(); onDeletePost(post.id); }} className="text-gray-400 hover:text-red-400 transition-colors" title="Delete post">
                <Trash2 size={14} />
              </button>
            )}
            {currentUserId && post.user?.id !== currentUserId && (
              <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="text-gray-400 hover:text-orange-400 transition-colors">
                <Flag size={13} />
              </button>
            )}
          </div>
          {/* Poster-left, header+caption-right layout */}
          <div className="px-4 pt-4 pb-3">

            {/* Inline compact star rater — shown when ⭐ in action bar is tapped */}
            {showInlineRater && !ratingSubmitted && (
              <div
                ref={starsRef}
                className="flex items-center gap-1.5 mb-3 py-2.5 px-3 bg-violet-50 rounded-xl touch-none select-none"
                onMouseLeave={() => setHoverRating(0)}
                onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                  if (!starsRef.current) return;
                  const touch = e.touches[0];
                  const rect = starsRef.current.getBoundingClientRect();
                  const x = touch.clientX - rect.left;
                  const starWidth = rect.width / 5;
                  const starIndex = Math.floor(x / starWidth);
                  const withinStar = (x % starWidth) / starWidth;
                  const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
                  setHoverRating(Math.round(val * 2) / 2);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  if (hoverRating > 0) { handleSubmitRating(hoverRating); setShowInlineRater(false); }
                  setHoverRating(0);
                }}
              >
                <span className="text-[10px] font-semibold text-violet-600 mr-1">Rate:</span>
                {[1,2,3,4,5].map(star => {
                  const displayVal = hoverRating;
                  return (
                    <div key={star} className="relative" style={{ width: 28, height: 28 }}>
                      <Star size={28} className="absolute inset-0 text-violet-200" />
                      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                        <Star size={28} className="fill-yellow-400 text-yellow-400" />
                      </div>
                      <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star - 0.5)} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star - 0.5); setShowInlineRater(false); }} aria-label={`Rate ${star - 0.5}`} />
                      <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star)} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star); setShowInlineRater(false); }} aria-label={`Rate ${star}`} />
                    </div>
                  );
                })}
                {hoverRating > 0 && <span className="ml-1 text-xs text-gray-400">{hoverRating}/5</span>}
              </div>
            )}
            {/* Main body: poster left | name + stars + caption right */}
            <div className="flex gap-3 items-start">
              {posterEl ?? posterFallback}
              <div className="flex-1 min-w-0">
                {/* Name */}
                {post.user && (
                  <div className="mb-0.5">
                    <Link href={`/user/${post.user.id || ''}`}>
                      <p className="text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer leading-snug">{post.user.displayName || post.user.username}</p>
                    </Link>
                  </div>
                )}
                {/* Stars + media title */}
                {(post.rating || 0) > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => {
                        const r = post.rating!;
                        if (s <= Math.floor(r)) return <Star key={s} size={14} className="text-yellow-400 fill-yellow-400" />;
                        if (s === Math.ceil(r) && r % 1 >= 0.5) return <div key={s} className="relative"><Star size={14} className="text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={14} className="text-yellow-400 fill-yellow-400" /></div></div>;
                        return <Star key={s} size={14} className="text-gray-200" />;
                      })}
                    </div>
                    {post.mediaTitle && (
                      <div className="truncate min-w-0">
                        {post.externalId && post.externalSource
                          ? <Link href={`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`}><span className="text-[10px] font-light tracking-widest uppercase text-gray-400 hover:text-purple-400 cursor-pointer">{post.mediaTitle}{post.externalId?.startsWith('series-') ? ' Series' : ''}</span></Link>
                          : <span className="text-[10px] font-light tracking-widest uppercase text-gray-400">{post.mediaTitle}{post.externalId?.startsWith('series-') ? ' Series' : ''}</span>
                        }
                      </div>
                    )}
                    {ratingSubmitted && ratingValue > 0 && !ratingJustSaved && (
                      <span className="text-[11px] text-yellow-600 font-semibold">You rated {ratingValue}/5</span>
                    )}
                    {ratingJustSaved && <span className="text-[11px] text-green-600 font-semibold">✓ Saved!</span>}
                  </div>
                )}
                {/* Content text */}
                {post.content ? (
                  <div onClick={(e) => { e.stopPropagation(); setContentExpanded(v => !v); }} className="cursor-pointer">
                    <p className={`text-gray-700 text-[15px] leading-relaxed font-normal ${contentExpanded ? '' : 'line-clamp-4'}`}>{post.content}</p>
                    {!contentExpanded && post.content.length > 120 && <span className="text-purple-500 text-xs font-medium">Read more</span>}
                  </div>
                ) : null}
                {tasteAlignment !== null && (
                  <p className="text-sm font-semibold text-violet-600 mt-1.5">
                    You're {tasteAlignment}% aligned with {post.user?.displayName || post.user?.username || 'them'}'s taste
                  </p>
                )}
                {/* Other raters */}
                {relatedRatings.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    {!showAllRelated ? (
                      <button onClick={() => setShowAllRelated(true)} className="flex items-center gap-2 w-full">
                        <div className="flex -space-x-1.5">
                          {relatedRatings.slice(0, 3).map((r, i) => {
                            const colors = ['bg-purple-500','bg-pink-500','bg-blue-500','bg-indigo-500','bg-teal-500'];
                            const initials = (r.displayName || r.userName || '?').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                            return <div key={r.userId} className={`w-6 h-6 rounded-full ${colors[i % colors.length]} flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white`}>{initials}</div>;
                          })}
                          {relatedRatings.length > 3 && <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[9px] font-bold ring-2 ring-white">+{relatedRatings.length - 3}</div>}
                        </div>
                        <span className="text-[12px] text-gray-400">{relatedRatings.length} more rating{relatedRatings.length !== 1 ? 's' : ''}</span>
                        <ChevronDown size={15} className="text-gray-500 ml-auto" />
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {relatedRatings.map(r => (
                          <div key={r.userId} className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 truncate">{r.displayName || r.userName}</span>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {[1,2,3,4,5].map(s => {
                                if (s <= Math.floor(r.rating)) return <Star key={s} size={11} className="text-yellow-400 fill-yellow-400" />;
                                if (s === Math.ceil(r.rating) && r.rating % 1 >= 0.5) return <div key={s} className="relative w-3 h-3"><Star size={11} className="absolute text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={11} className="text-yellow-400 fill-yellow-400" /></div></div>;
                                return <Star key={s} size={11} className="text-gray-200" />;
                              })}
                            </div>
                          </div>
                        ))}
                        <button onClick={() => setShowAllRelated(false)} className="text-[9px] text-violet-400 font-medium text-left pt-0.5">Show less</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Action bar + discussion */}
          <div className="px-4 pb-4 border-t border-gray-50">
            <div className="pt-0">{actionFirstBar}</div>
            {/* Discussion thread — always visible for action-first cards */}
            <div className="mt-1">
              {/* Existing comments preview */}
              {!showComments && !loadingComments && comments.length > 0 && (
                <div className="pl-2 mb-2 space-y-2">
                  {comments.slice(0, 2).map((c: any) => {
                    const cName = c.user?.displayName || c.user?.username || c.username || 'User';
                    const initials = cName[0]?.toUpperCase();
                    return (
                      <div key={c.id} className="flex gap-2.5">
                        {/* Thread line + avatar */}
                        <div className="flex flex-col items-center gap-0.5 pt-0.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {c.user?.avatar ? <img src={c.user.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : initials}
                          </div>
                          <div className="w-px flex-1 bg-gray-200 min-h-[6px]" />
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-gray-900">{cName}</span>
                            <span className="text-[10px] text-gray-400">{c.created_at ? timeAgo(c.created_at) : ''}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-snug">{c.content}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <button
                              onClick={() => { setReplyingToId(c.id); setReplyText(''); setShowComments(true); }}
                              className="text-[10px] text-gray-400 hover:text-violet-500 font-medium transition-colors flex items-center gap-1"
                            >
                              ↩ Reply
                            </button>
                            <div className="flex items-center gap-1 text-gray-400">
                              <Heart size={11} />
                              {(c.likes_count || 0) > 0 && <span className="text-[10px]">{c.likes_count}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        // NORMAL layout — for already-rated or own posts
        <div className="p-4">
          {/* Top-right: media type pill + action button */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            {mediaTypeLabel && (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{mediaTypeLabel}</span>
            )}
            {currentUserId && post.user?.id === currentUserId && onDeletePost && (
              <button onClick={(e) => { e.stopPropagation(); onDeletePost(post.id); }} className="text-gray-400 hover:text-red-400 transition-colors" title="Delete post">
                <Trash2 size={14} />
              </button>
            )}
            {currentUserId && post.user?.id !== currentUserId && (
              <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="text-gray-400 hover:text-orange-400 transition-colors">
                <Flag size={13} />
              </button>
            )}
          </div>
          {post.mediaTitle ? (
            // Poster-left layout: all metadata lives to the right of the poster
            <div className="flex gap-3 items-start">
              {posterEl ?? posterFallback}
              <div className="min-w-0 flex-1">
                {(() => {
                  const cardDisplayName = post.user?.displayName || post.user?.username || 'Someone';
                  const isSeries = post.externalId?.startsWith('series-');
                  return (
                    <>
                      <Link href={`/user/${post.user?.id || ''}`}>
                        <span className="text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer leading-snug">{cardDisplayName}</span>
                      </Link>
                      {post.rating && post.rating > 0 && (post.type === 'rating' || post.type === 'review' || post.type === 'rate-review' || post.type === 'thought') && (
                        <>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {[1,2,3,4,5].map(s => {
                                const r = post.rating!;
                                if (s <= Math.floor(r)) return <Star key={s} size={13} className="text-yellow-400 fill-yellow-400" />;
                                if (s === Math.ceil(r) && r % 1 >= 0.5) return <div key={s} className="relative"><Star size={13} className="text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={13} className="text-yellow-400 fill-yellow-400" /></div></div>;
                                return <Star key={s} size={13} className="text-gray-200" />;
                              })}
                            </div>
                            <div className="truncate min-w-0">
                              {post.externalId && post.externalSource
                                ? <Link href={`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`}><span className="text-[10px] font-light tracking-widest uppercase text-gray-400 hover:text-purple-400 cursor-pointer">{post.mediaTitle}{isSeries ? ' Series' : ''}</span></Link>
                                : <span className="text-[10px] font-light tracking-widest uppercase text-gray-400">{post.mediaTitle}{isSeries ? ' Series' : ''}</span>
                              }
                            </div>
                          </div>
                          {ratingDiffLine(post.rating, 'mt-0.5')}
                        </>
                      )}
                      {post.content ? (
                        <div onClick={(e) => { e.stopPropagation(); setContentExpanded(v => !v); }} className="cursor-pointer mt-1">
                          <p className={`text-gray-700 text-sm leading-relaxed ${contentExpanded ? '' : 'line-clamp-3'}`}>{post.content}</p>
                          {!contentExpanded && post.content.length > 100 && <span className="text-purple-500 text-xs font-medium">Read more</span>}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic mt-1">No review written</p>
                      )}
                      {currentUserId && post.user?.id !== currentUserId && post.content && (
                        <div className="flex justify-end mt-0.5">
                          <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="text-gray-300 hover:text-red-400 transition-colors" title="Report post">
                            <Flag size={11} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            // No poster: header above content
            <div>
              {(() => {
                const cardDisplayName = post.user?.displayName || post.user?.username || 'Someone';
                return (
                  <div className="flex items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <Link href={`/user/${post.user?.id || ''}`}>
                        <span className="text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer leading-snug">{cardDisplayName}</span>
                      </Link>
                    </div>
                  </div>
                );
              })()}
              {post.content && (
                <div>
                  <div onClick={(e) => { e.stopPropagation(); setContentExpanded(v => !v); }} className="cursor-pointer">
                    <p className={`text-gray-800 text-sm leading-relaxed ${contentExpanded ? '' : 'line-clamp-2'}`}>{post.content}</p>
                    {!contentExpanded && post.content.length > 100 && <span className="text-purple-500 text-xs font-medium">Read more</span>}
                  </div>
                  {currentUserId && post.user?.id !== currentUserId && (
                    <div className="flex justify-end mt-0.5">
                      <button onClick={(e) => { e.stopPropagation(); setReportPostOpen(true); }} className="text-gray-300 hover:text-red-400 transition-colors" title="Report post">
                        <Flag size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Other raters — visually secondary: collapsed avatar tease */}
          {relatedRatings.length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <>
              {relatedRatings.length > 0 && (
                !showAllRelated ? (
                  <button onClick={() => setShowAllRelated(true)} className="flex items-center gap-2 w-full mb-1.5">
                    <div className="flex -space-x-1.5">
                      {relatedRatings.slice(0, 3).map((r, i) => {
                        const colors = ['bg-purple-500','bg-pink-500','bg-blue-500','bg-indigo-500','bg-teal-500'];
                        const initials = (r.displayName || r.userName || '?').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                        return <div key={r.userId} className={`w-6 h-6 rounded-full ${colors[i % colors.length]} flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white`}>{initials}</div>;
                      })}
                      {relatedRatings.length > 3 && <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[9px] font-bold ring-2 ring-white">+{relatedRatings.length - 3}</div>}
                    </div>
                    <span className="text-[12px] text-gray-400">{relatedRatings.length} more rating{relatedRatings.length !== 1 ? 's' : ''}</span>
                    <ChevronDown size={15} className="text-gray-500 ml-auto" />
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 mb-1.5">
                    {relatedRatings.map(r => (
                      <div key={r.userId} className="flex items-center justify-end gap-2">
                        <span className="text-sm text-gray-500">{r.displayName || r.userName}</span>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {[1,2,3,4,5].map(s => {
                            if (s <= Math.floor(r.rating)) return <Star key={s} size={11} className="text-yellow-400 fill-yellow-400" />;
                            if (s === Math.ceil(r.rating) && r.rating % 1 >= 0.5) return <div key={s} className="relative"><Star size={11} className="text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={11} className="text-yellow-400 fill-yellow-400" /></div></div>;
                            return <Star key={s} size={11} className="text-gray-200" />;
                          })}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowAllRelated(false)} className="text-[9px] text-violet-400 font-medium text-left">Show less</button>
                  </div>
                )
              )}
              </>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-50">{actionBar}</div>
          {ratingSubmitted && ratingValue > 0 && isOtherUser && (
            <div className="flex items-center justify-start gap-2 pt-2">
              <span className="text-sm text-gray-500">
                {ratingJustSaved ? <span className="text-green-600 text-xs font-semibold">✓ Saved!</span> : 'Your rating'}
              </span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={11} className={s <= Math.floor(ratingValue) ? 'text-yellow-400 fill-yellow-400' : s === Math.ceil(ratingValue) && ratingValue % 1 >= 0.5 ? 'text-yellow-300 fill-yellow-200' : 'text-gray-200'} />
                ))}
              </div>
              {!ratingJustSaved && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setShowStarPicker(true); }} className="text-[9px] text-gray-400 hover:text-gray-600 transition-colors">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveRating(); }} className="text-[9px] text-red-300 hover:text-red-500 transition-colors">Remove</button>
                </>
              )}
            </div>
          )}

        {/* YOUR TURN / Post-rating section */}
        {isRatingPost && isOtherUser && session?.access_token && (showStarPicker || !ratingSubmitted) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-purple-600 tracking-widest uppercase">{ratingSubmitted ? 'Change Rating' : 'Your Turn'}</p>
              </div>
                <div
                  ref={starsRef}
                  className="flex items-center gap-1 touch-none select-none"
                  onMouseLeave={() => setHoverRating(0)}
                  onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                    if (!starsRef.current) return;
                    const touch = e.touches[0];
                    const rect = starsRef.current.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const starWidth = rect.width / 5;
                    const starIndex = Math.floor(x / starWidth);
                    const withinStar = (x % starWidth) / starWidth;
                    const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
                    setHoverRating(Math.round(val * 2) / 2);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    if (hoverRating > 0) handleSubmitRating(hoverRating);
                    setHoverRating(0);
                  }}
                >
                  {[1, 2, 3, 4, 5].map(star => {
                    const displayVal = hoverRating || (ratingSubmitted ? ratingValue : 0);
                    return (
                      <div key={star} className="relative" style={{ width: 32, height: 32 }}>
                        <Star size={32} className="absolute inset-0 text-gray-200" />
                        <div
                          className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}
                        >
                          <Star size={32} className={hoverRating > 0 ? 'fill-yellow-300 text-yellow-300' : 'fill-yellow-400 text-yellow-400'} />
                        </div>
                        <button
                          className="absolute top-0 left-0 h-full z-10"
                          style={{ width: '50%' }}
                          onMouseEnter={() => setHoverRating(star - 0.5)}
                          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); if (Math.abs(e.changedTouches[0].clientY - touchStartY.current) > 10) return; handleSubmitRating(star - 0.5); }}
                          onClick={(e) => { e.stopPropagation(); handleSubmitRating(star - 0.5); }}
                          aria-label={`Rate ${star - 0.5}`}
                        />
                        <button
                          className="absolute top-0 right-0 h-full z-10"
                          style={{ width: '50%' }}
                          onMouseEnter={() => setHoverRating(star)}
                          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); if (Math.abs(e.changedTouches[0].clientY - touchStartY.current) > 10) return; handleSubmitRating(star); }}
                          onClick={(e) => { e.stopPropagation(); handleSubmitRating(star); }}
                          aria-label={`Rate ${star}`}
                        />
                      </div>
                    );
                  })}
                  {hoverRating > 0 && <span className="ml-1 text-xs text-gray-400">{hoverRating}/5</span>}
                </div>
            </>
          </div>
        )}
        {tasteAlignment !== null && isOtherUser && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <Users size={14} className="text-violet-500 flex-shrink-0" />
              <p className="text-xs text-gray-500">
                You're <span className="font-bold text-violet-600">{tasteAlignment}%</span> aligned with {post.user?.displayName || post.user?.username || 'them'}'s taste
              </p>
            </div>
          </div>
        )}
        </div>
      )}

      <ReportSheet
        isOpen={reportPostOpen}
        onClose={() => setReportPostOpen(false)}
        contentType="post"
        contentId={post.id}
        reportedUserId={post.userId}
        reportedUserName={post.userName}
      />
      <ReportSheet
        isOpen={!!reportCommentTarget}
        onClose={() => setReportCommentTarget(null)}
        contentType="comment"
        contentId={reportCommentTarget?.id || ''}
        reportedUserId={reportCommentTarget?.userId}
        reportedUserName={reportCommentTarget?.userName}
      />
    </div>
    {showComments && (
      <div className="mt-1 rounded-2xl bg-white border border-gray-100 shadow-sm px-4 pt-3 pb-4">
        {loadingComments ? (
          <p className="text-xs text-gray-400 text-center py-3">Loading replies…</p>
        ) : (
          <div className="space-y-1">
            {comments.map((c: any) => {
              const cName = c.user?.displayName || c.user?.username || c.username || 'User';
              const cInitial = cName[0]?.toUpperCase();
              const isReplying = replyingToId === c.id;
              return (
                <div key={c.id} className="flex gap-2.5 py-2">
                  {/* Avatar + thread line column */}
                  <div className="flex flex-col items-center gap-0 flex-shrink-0" style={{ width: 26 }}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                      {c.user?.avatar ? <img src={c.user.avatar} className="w-full h-full object-cover" alt="" /> : cInitial}
                    </div>
                    {(c.replies?.length > 0 || isReplying) && (
                      <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[12px]" />
                    )}
                  </div>
                  {/* Comment body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-900">{cName}</span>
                      <span className="text-[10px] text-gray-400">{c.created_at ? timeAgo(c.created_at) : ''}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        {(currentUserId === (c.user?.id || c.userId) || currentUserId === post.userId) && (
                          <button onClick={(e) => { e.stopPropagation(); deleteComment(c.id); }} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={9} /></button>
                        )}
                        {currentUserId && currentUserId !== (c.user?.id || c.userId) && (
                          <button onClick={(e) => { e.stopPropagation(); setReportCommentTarget({ id: c.id, userId: c.user?.id || c.userId || '', userName: c.user?.username || c.username || 'User' }); }} className="text-gray-300 hover:text-red-400 transition-colors"><Flag size={9} /></button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-snug mt-0.5 mb-1.5">{c.content}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setReplyingToId(isReplying ? null : c.id); setReplyText(''); }}
                        className="text-[10px] font-semibold text-gray-400 hover:text-violet-500 transition-colors"
                      >
                        Reply
                      </button>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Heart size={10} />
                        {(c.likes_count || 0) > 0 && <span className="text-[10px]">{c.likes_count}</span>}
                      </div>
                    </div>
                    {/* Inline reply composer */}
                    {isReplying && (
                      <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-violet-200">
                        <input
                          autoFocus
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${cName}…`}
                          className="flex-1 text-xs bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400"
                          onKeyPress={(e) => e.key === 'Enter' && submitReply(c.id)}
                        />
                        <button onClick={() => submitReply(c.id)} disabled={!replyText.trim() || submitting} className="text-[11px] font-semibold text-violet-600 disabled:opacity-40">Post</button>
                        <button onClick={() => { setReplyingToId(null); setReplyText(''); }} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>
                      </div>
                    )}
                    {/* Nested replies — threaded indent */}
                    {c.replies?.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-gray-100 space-y-2">
                        {c.replies.map((r: any) => {
                          const rName = r.user?.displayName || r.user?.username || r.username || 'User';
                          return (
                            <div key={r.id} className="flex gap-2 pt-1">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-300 to-blue-300 flex items-center justify-center text-white text-[9px] font-bold overflow-hidden flex-shrink-0">
                                {r.user?.avatar ? <img src={r.user.avatar} className="w-full h-full object-cover" alt="" /> : rName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-gray-800">{rName}</span>
                                  <span className="text-[9px] text-gray-400">{r.created_at ? timeAgo(r.created_at) : ''}</span>
                                </div>
                                <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{r.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* New comment composer */}
            {session && (
              <div className="pt-2 mt-2">
                {replyingToName && (
                  <div className="flex items-center gap-2 mb-2 pl-1 border-l-2 border-violet-400">
                    <span className="text-[10px] text-violet-500 font-medium">Replying to @{replyingToName}</span>
                    <button onClick={() => { setReplyingToName(null); setCommentText(''); }} className="text-gray-300 hover:text-gray-500 leading-none">×</button>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden">
                  {session.user?.user_metadata?.avatar_url
                    ? <img src={session.user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="" />
                    : (session.user?.user_metadata?.display_name || session.user?.email || 'Y')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full border border-gray-200 px-3 py-2 focus-within:border-violet-300 transition-colors">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add your take…"
                    className="flex-1 text-xs bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400"
                    onKeyPress={(e) => e.key === 'Enter' && submitComment()}
                  />
                  {commentText.trim() && (
                    <button onClick={submitComment} disabled={submitting} className="text-[11px] font-semibold text-violet-600 disabled:opacity-40 flex-shrink-0">Post</button>
                  )}
                </div>
                </div>
              </div>
            )}
            {/* Empty state */}
            {comments.length === 0 && !loadingComments && (
              <p className="text-xs text-gray-400 text-center py-2">No replies yet — be first!</p>
            )}
          </div>
        )}
      </div>
    )}
    </>
  );
}

function StandalonePost({ post, onLike, onComment, isLiked, isCommentsActive, onCloseComments, fetchComments, onSubmitComment, isSubmitting, session, currentUserId, onDeleteComment, onDeletePost, onLikeComment, onAddToList }: {
  post: UGCPost;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
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
  onLikeComment?: (commentId: string) => void;
  onAddToList?: (media: any) => void;
}) {
  const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const displayName = post.user?.displayName || post.user?.username || 'Someone';
  const rawUsername = post.user?.username || '';
  const avatarLetter = (displayName || rawUsername)[0]?.toUpperCase() || '?';

  const displayContent = (() => {
    if (!post.content) return post.content;
    const contentLower = post.content.toLowerCase();
    const mediaTitle = post.mediaTitle || (post.mediaItems?.[0]?.title ?? '');
    if (mediaTitle) {
      const prefix = `added ${mediaTitle.toLowerCase()} to `;
      if (contentLower.startsWith(prefix)) {
        const listName = post.content.slice(prefix.length);
        return `Added to ${listName}`;
      }
    }
    return post.content;
  })();
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reportCommentLocal, setReportCommentLocal] = useState<{ commentId: string; userId: string; userName: string } | null>(null);
  const hasFetchedComments = useRef(false);
  const [localLikedComments, setLocalLikedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingJustSaved, setRatingJustSaved] = useState(false);
  const [showStarPicker, setShowStarPicker] = useState(false);
  const [communityRating, setCommunityRating] = useState<number | null>(null);
  const [externalRating, setExternalRating] = useState<number | null>(null);
  const [externalRatingLabel, setExternalRatingLabel] = useState<string>('');
  const [tasteAlignment, setTasteAlignment] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const starsRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const [seenItDone, setSeenItDone] = useState(false);
  const [resolvedExternalId, setResolvedExternalId] = useState(post.externalId || '');
  const [resolvedExternalSource, setResolvedExternalSource] = useState(post.externalSource || 'tmdb');
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);

  const handleStarClick = () => {
    setShowStarPicker(prev => !prev);
    if (!resolvedExternalId && post.mediaTitle && session?.access_token && !isSearchingMedia) {
      setIsSearchingMedia(true);
      const mediaType = (post.mediaType || 'tv').toLowerCase();
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search?q=${encodeURIComponent(post.mediaTitle)}&type=${mediaType}&limit=1`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
        .then(r => r.json())
        .then(data => {
          const results = data?.results || data || [];
          const first = Array.isArray(results) ? results[0] : null;
          const eid = first?.externalId || first?.external_id || first?.id;
          const esrc = first?.externalSource || first?.external_source || 'tmdb';
          if (eid) {
            setResolvedExternalId(String(eid));
            setResolvedExternalSource(esrc);
          }
        })
        .catch(err => console.error('Media lookup failed', err))
        .finally(() => setIsSearchingMedia(false));
    }
  };

  const handleSeenIt = async (media: { title: string; externalId: string; externalSource: string; imageUrl: string; type: string }) => {
    if (seenItDone || !session?.access_token) return;
    setSeenItDone(true);
    const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/track-media`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          media: {
            title: media.title,
            mediaType: media.type,
            imageUrl: media.imageUrl,
            externalId: media.externalId,
            externalSource: media.externalSource,
          },
          listType: 'completed',
          skip_social_post: true,
        }),
      });
    } catch {
      // silent fail — UI already updated
    }
  };

  useEffect(() => {
    const externalId = post.externalId || post.mediaItems?.[0]?.externalId;
    const externalSource = post.externalSource || post.mediaItems?.[0]?.externalSource;
    if (!externalId || !externalSource) return;

    // Community average rating
    supabase
      .from('media_ratings')
      .select('rating')
      .eq('media_external_id', externalId)
      .eq('media_external_source', externalSource)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const avg = data.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / data.length;
          setCommunityRating(Math.round(avg * 10) / 10);
        }
      });

    // User's own existing rating — pre-populate "Your Turn"
    if (currentUserId) {
      supabase
        .from('media_ratings')
        .select('rating')
        .eq('media_external_id', externalId)
        .eq('media_external_source', externalSource)
        .eq('user_id', currentUserId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.rating) {
            setRatingValue(Number(data.rating));
            setRatingSubmitted(true);
          }
        });
    }
  }, [post.externalId, post.externalSource, currentUserId]);

  useEffect(() => {
    const isRating = post.type === 'rating' || post.type === 'rate-review' || post.type === 'review' || post.type === 'thought';
    if (!isRating) return;
    const externalId = post.externalId || post.mediaItems?.[0]?.externalId;
    const externalSource = post.externalSource || post.mediaItems?.[0]?.externalSource;
    const mediaType = post.mediaType || post.mediaItems?.[0]?.type;
    if (!externalId || !externalSource) return;
    const sourceLabels: Record<string, string> = {
      tmdb: 'TMDB', google_books: 'Google Books', googlebooks: 'Google Books', openlibrary: 'Open Library', open_library: 'Open Library', spotify: 'Spotify',
    };
    const label = sourceLabels[externalSource] || externalSource;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const url = `${supabaseUrl}/functions/v1/get-media-details?source=${externalSource}&external_id=${externalId}${mediaType ? `&media_type=${mediaType}` : ''}`;
    fetch(url, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.rating) {
          const val = parseFloat(data.rating);
          if (val > 0) { setExternalRating(Math.round(val * 10) / 10); setExternalRatingLabel(label); }
        }
      })
      .catch(() => {});
  }, [post.externalId, post.externalSource, post.type]);

  useEffect(() => {
    const postUserId = post.user?.id;
    if (!postUserId || !currentUserId || postUserId === currentUserId) return;
    const isRating = post.type === 'rating' || post.type === 'rate-review' || post.type === 'review' || post.type === 'thought';
    if (!isRating) return;
    supabase
      .from('media_ratings')
      .select('user_id, media_external_id, media_external_source, rating')
      .in('user_id', [currentUserId, postUserId])
      .then(({ data }) => {
        if (!data || data.length < 2) return;
        const myRatings: Record<string, number> = {};
        const theirRatings: Record<string, number> = {};
        data.forEach((r: any) => {
          const key = `${r.media_external_id}__${r.media_external_source}`;
          if (r.user_id === currentUserId) myRatings[key] = Number(r.rating);
          else theirRatings[key] = Number(r.rating);
        });
        const sharedKeys = Object.keys(myRatings).filter(k => k in theirRatings);
        if (sharedKeys.length < 2) return;
        const avgDiff = sharedKeys.reduce((sum, k) => sum + Math.abs(myRatings[k] - theirRatings[k]), 0) / sharedKeys.length;
        const alignment = Math.round((1 - avgDiff / 4) * 100);
        setTasteAlignment(Math.max(0, Math.min(100, alignment)));
      });
  }, [post.user?.id, currentUserId, post.type]);

  const handleSubmitRating = async (rating: number) => {
    if (!session?.access_token) return;
    setRatingValue(rating);
    setRatingSubmitted(true);
    setShowStarPicker(false);
    setHoverRating(0);
    setRatingJustSaved(true);
    setTimeout(() => setRatingJustSaved(false), 1800);
    let eid = resolvedExternalId || post.externalId || post.mediaItems?.[0]?.externalId || '';
    let esrc = resolvedExternalSource || post.externalSource || post.mediaItems?.[0]?.externalSource || 'tmdb';
    if (!eid && post.mediaTitle) {
      try {
        const mediaType = (post.mediaType || 'tv').toLowerCase();
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search?q=${encodeURIComponent(post.mediaTitle)}&type=${mediaType}&limit=1`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const d = await r.json();
        const results = d?.results || d || [];
        const first = Array.isArray(results) ? results[0] : null;
        eid = String(first?.externalId || first?.external_id || first?.id || '');
        esrc = first?.externalSource || first?.external_source || 'tmdb';
        if (eid) { setResolvedExternalId(eid); setResolvedExternalSource(esrc); }
      } catch { /* fall through with empty eid */ }
    }
    if (!eid) return;
    const media = {
      title: post.mediaTitle || post.mediaItems?.[0]?.title || '',
      externalId: eid,
      externalSource: esrc,
      imageUrl: post.mediaImage || post.mediaItems?.[0]?.imageUrl || '',
      type: post.mediaType || post.mediaItems?.[0]?.type || 'tv',
    };
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/rate-media`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_external_id: media.externalId,
            media_external_source: media.externalSource,
            media_title: media.title,
            media_type: media.type,
            media_image_url: media.imageUrl,
            rating,
            skip_social_post: false,
          }),
        }
      );
    } catch (err) {
      console.error('Rating failed', err);
    }
  };

  const handleRemoveRating = async () => {
    if (!session?.access_token) return;
    const externalId = resolvedExternalId || post.mediaItems?.[0]?.externalId || '';
    const externalSource = resolvedExternalSource || post.mediaItems?.[0]?.externalSource || 'tmdb';
    setRatingValue(0);
    setRatingSubmitted(false);
    setShowStarPicker(false);
    setHoverRating(0);
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/rate-media`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_external_id: externalId, media_external_source: externalSource, media_title: post.mediaTitle, media_type: post.mediaType || 'movie', rating: 0, skip_social_post: true }),
        }
      );
    } catch (err) {
      console.error('Remove rating failed', err);
    }
  };

  const handleCommentLike = (commentId: string, commentLikesCount: number) => {
    const wasLiked = localLikedComments.has(commentId);
    setLocalLikedComments(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, likesCount: (c.likesCount || 0) + (wasLiked ? -1 : 1) } : c
    ));
    onLikeComment?.(commentId);
  };

  const handleReplyTo = (commentId: string, displayName: string) => {
    setReplyingTo({ id: commentId, name: displayName });
    setCommentText(`@${displayName} `);
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const getTypeInfo = (type: string) => {
    switch (type) {

      case 'review': return { label: 'Review', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: Star };
      case 'rating': return { label: 'Rating', color: 'text-yellow-500', bg: 'bg-yellow-50', icon: Star };
      case 'thought': return { label: 'Thought', color: 'text-blue-400', bg: 'bg-blue-50', icon: MessageCircle };
      case 'predict':
      case 'prediction': return { label: 'Prediction', color: 'text-purple-500', bg: 'bg-purple-50', icon: Target };
      case 'poll': return { label: 'Cast your vote', color: 'text-purple-500', bg: 'bg-purple-50', icon: Target };
      case 'rank_share': return { label: 'Rank', color: 'text-purple-500', bg: 'bg-purple-50', icon: Trophy };
      default: return { label: 'Post', color: 'text-gray-400', bg: 'bg-gray-50', icon: MessageCircle };
    }
  };

  const isLeaderboard = post.content ? isLeaderboardRankingPost(post.content) : false;
  const typeInfo = isLeaderboard 
    ? { label: 'Leaderboard', color: 'text-purple-500', bg: 'bg-purple-50', icon: Trophy }
    : getTypeInfo(post.type);
  const TypeIcon = typeInfo.icon;
  const isRatingType = post.type === 'rating' || post.type === 'rate-review' || post.type === 'review' || post.type === 'thought';
  // Normalize media type for case-insensitive icon checks (handles 'Movie', 'TV Show', 'Podcast', etc.)
  const spMediaTypeNorm = (() => {
    const t = (post.mediaType || '').toLowerCase();
    if (t === 'tv show') return 'tv';
    return t;
  })();
  const spMediaTypeLabel = spMediaTypeNorm === 'tv' ? 'TV' : spMediaTypeNorm === 'movie' ? 'Movie' : spMediaTypeNorm === 'book' ? 'Book' : spMediaTypeNorm === 'music' ? 'Music' : spMediaTypeNorm === 'podcast' ? 'Podcast' : spMediaTypeNorm === 'game' ? 'Game' : null;
  const spSeenItLabel = (() => {
    if (spMediaTypeNorm === 'music') return { idle: 'Heard it', done: 'Heard!' };
    if (spMediaTypeNorm === 'podcast') return { idle: 'Listened', done: 'Listened!' };
    if (spMediaTypeNorm === 'book') return { idle: 'Read it', done: 'Read!' };
    return { idle: 'Seen it', done: 'Seen!' };
  })();

  const spIsOtherUser = post.user?.id !== currentUserId;
  const spIsActionFirst = isRatingType && spIsOtherUser && !ratingSubmitted && !!session?.access_token;

  const spRatingDiffLine = (rating: number, extraClass = '') => {
    const ref = externalRating !== null ? externalRating : (ratingCount >= 5 ? communityRating : null);
    if (ref === null) return null;
    const diff = rating - ref;
    const abs = Math.abs(diff);
    let phrase: string;
    let colorClass: string;
    if (abs <= 0.3) {
      if (rating >= 4.5) phrase = 'Everyone agrees. A classic.';
      else if (rating >= 4) phrase = 'Crowd-pleaser. You agree.';
      else if (rating <= 2) phrase = "You're not alone on this one.";
      else phrase = 'Safe take.';
      colorClass = 'text-orange-400';
    } else if (diff > 0) {
      if (diff >= 2.0) phrase = rating >= 4.5 ? 'A rare rave.' : 'Way more into this than most.';
      else if (diff >= 1.0) phrase = 'Above the crowd on this one.';
      else phrase = 'Warmer than most.';
      colorClass = 'text-green-600';
    } else {
      if (diff <= -2.0) phrase = 'Called this overrated.';
      else if (diff <= -1.0) phrase = 'Tougher than the crowd.';
      else phrase = 'Colder than most.';
      colorClass = 'text-orange-500';
    }
    return <p className={`text-[10px] italic ${colorClass} ${extraClass}`}>{phrase}</p>;
  };

  const spPosterEl = post.mediaImage && post.mediaImage.startsWith('http') ? (
    <div className="relative flex-shrink-0 self-start w-16 h-[96px]">
      {post.externalId && post.externalSource ? (
        <Link href={`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`}>
          <img src={post.mediaImage} alt={post.mediaTitle} className="w-16 h-[96px] rounded-xl object-cover shadow-md cursor-pointer hover:opacity-90 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </Link>
      ) : (
        <img src={post.mediaImage} alt={post.mediaTitle} className="w-16 h-[96px] rounded-xl object-cover shadow-md" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      {spMediaTypeNorm && (
        <div className="absolute bottom-1 left-1 bg-purple-600/50 backdrop-blur-sm rounded-md p-1">
          {spMediaTypeNorm === 'tv' && <Tv2 size={9} className="text-white" />}
          {spMediaTypeNorm === 'movie' && <Film size={9} className="text-white" />}
          {spMediaTypeNorm === 'book' && <Book size={9} className="text-white" />}
          {spMediaTypeNorm === 'music' && <Music size={9} className="text-white" />}
          {spMediaTypeNorm === 'podcast' && <Headphones size={9} className="text-white" />}
          {spMediaTypeNorm === 'game' && <Gamepad2 size={9} className="text-white" />}
        </div>
      )}
    </div>
  ) : null;

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
    <>
    <div className="bg-white rounded-2xl border border-gray-100 shadow overflow-hidden mb-3">
      {spIsActionFirst ? (
        // ACTION FIRST layout — gray WHAT'S YOUR TAKE section, then FROM YOUR FEED + friend's content
        <>
          <div className="px-4 pt-4 pb-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase">What's Your Take?</p>
                {spMediaTypeLabel && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">{spMediaTypeLabel}</span>}
              </div>
              <span className="text-[10px] font-bold text-gray-500 px-2 py-0.5 rounded-full bg-white border border-gray-200">+10 pts</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              {spPosterEl}
              <div className="flex-1 min-w-0">
                {post.externalId && post.externalSource ? (
                  <Link href={`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`}>
                    <p className="text-sm font-bold text-gray-900 hover:text-purple-600 line-clamp-2">{post.mediaTitle}</p>
                  </Link>
                ) : (
                  <p className="text-sm font-bold text-gray-900 line-clamp-2">{post.mediaTitle || 'Untitled'}</p>
                )}
              </div>
            </div>
            <div
              ref={starsRef}
              className="flex items-center gap-1.5 touch-none select-none"
              onMouseLeave={() => setHoverRating(0)}
              onTouchMove={(e) => {
                e.stopPropagation();
                if (!starsRef.current) return;
                const touch = e.touches[0];
                const rect = starsRef.current.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const starWidth = rect.width / 5;
                const starIndex = Math.floor(x / starWidth);
                const withinStar = (x % starWidth) / starWidth;
                const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
                setHoverRating(Math.round(val * 2) / 2);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (hoverRating > 0) handleSubmitRating(hoverRating);
                setHoverRating(0);
              }}
            >
              {[1, 2, 3, 4, 5].map(star => {
                const displayVal = hoverRating || (ratingSubmitted ? ratingValue : 0);
                return (
                  <div key={star} className="relative" style={{ width: 38, height: 38 }}>
                    <Star size={38} className="absolute inset-0 text-violet-200" />
                    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                      <Star size={38} className="fill-yellow-400 text-yellow-400" />
                    </div>
                    <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star - 0.5)} onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleSubmitRating(star - 0.5); }} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star - 0.5); }} aria-label={`Rate ${star - 0.5}`} />
                    <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star)} onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleSubmitRating(star); }} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star); }} aria-label={`Rate ${star}`} />
                  </div>
                );
              })}
              {hoverRating > 0 && <span className="ml-1 text-xs text-gray-400">{hoverRating}/5</span>}
              {ratingSubmitted && hoverRating === 0 && <span className="ml-1 text-xs text-gray-400">{ratingValue}/5</span>}
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <Link href={`/user/${post.user?.id || ''}`} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden flex-shrink-0">
                  {post.user?.avatar ? <img src={post.user.avatar} alt="" className="w-full h-full object-cover" /> : avatarLetter}
                </div>
                <span className="text-xs font-semibold text-gray-900 hover:text-purple-600">{displayName}</span>
              </Link>
              <div className="flex items-center gap-2">
                {post.rating && post.rating > 0 && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => {
                        const r = post.rating!;
                        if (s <= Math.floor(r)) return <Star key={s} size={12} className="text-yellow-400 fill-yellow-400" />;
                        if (s === Math.ceil(r) && r % 1 >= 0.5) return <div key={s} className="relative"><Star size={12} className="text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={12} className="text-yellow-400 fill-yellow-400" /></div></div>;
                        return <Star key={s} size={12} className="text-gray-200" />;
                      })}
                    </div>
                    {spRatingDiffLine(post.rating, 'text-right')}
                  </div>
                )}
                {post.type !== 'binge_battle' && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${typeInfo.bg} ${typeInfo.color}`}>{typeInfo.label}</span>
                )}
                <span className="text-[11px] text-gray-400">{timeAgo(post.timestamp)}</span>
                {currentUserId && (post.user?.id === currentUserId || post.user?.is_persona) && onDeletePost && (
                  <button onClick={() => onDeletePost(post.id)} className="text-gray-300 hover:text-red-400 p-1 shrink-0 transition-colors"><Trash2 size={13} /></button>
                )}
                {currentUserId && post.user?.id !== currentUserId && !(post.user?.is_persona && onDeletePost) && (
                  <button onClick={() => setIsReportOpen(true)} className="text-gray-300 hover:text-orange-400 p-1 shrink-0 transition-colors"><Flag size={13} /></button>
                )}
              </div>
            </div>
            {tasteAlignment !== null && (
              <p className="text-[11px] text-violet-600 italic mb-1">
                You're {tasteAlignment}% aligned with {displayName}'s taste overall
              </p>
            )}
            {post.type === 'binge_battle' && displayContent && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-purple-50 mb-2">
                <Zap size={13} className="text-purple-600 shrink-0" />
                <p className="text-[13px] font-semibold text-purple-900 leading-snug">{displayContent}</p>
              </div>
            )}
            {post.type !== 'binge_battle' && displayContent && (
              <div onClick={() => setContentExpanded(e => !e)} className="cursor-pointer mb-2">
                <p className={`text-gray-600 text-sm leading-relaxed ${contentExpanded ? '' : 'line-clamp-3'}`}>{displayContent}</p>
                {!contentExpanded && displayContent.length > 120 && <span className="text-purple-500 text-xs font-medium">Read more</span>}
              </div>
            )}
            <div className="flex items-center gap-4 mt-2 pt-2.5 border-t border-gray-50">
              {onLike && (
                <button onClick={() => onLike(post.id)} className={`flex items-center gap-1.5 text-sm transition-all active:scale-125 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                  <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                  <span className="text-xs">{post.likes || 0}</span>
                </button>
              )}
              <button onClick={() => onComment?.(post.id)} className={`flex items-center gap-1.5 text-sm ${isCommentsActive ? 'text-purple-500' : 'text-gray-400 hover:text-gray-600'} transition-colors`}>
                <MessageCircle size={15} />
                <span className="text-xs">{post.comments || 0}</span>
              </button>
              {onAddToList && post.mediaTitle && (
                <button onClick={() => onAddToList({ title: post.mediaTitle || '', externalId: resolvedExternalId || post.externalId || '', externalSource: resolvedExternalSource || post.externalSource || 'tmdb', imageUrl: post.mediaImage || '', type: post.mediaType || 'movie' })} className="flex items-center gap-1 text-sm text-gray-400 hover:text-purple-500 active:scale-110 transition-all"><Plus size={15} /></button>
              )}
              {post.mediaTitle && currentUserId && (
                <button onClick={() => handleSeenIt({ title: post.mediaTitle || '', externalId: resolvedExternalId || post.externalId || '', externalSource: resolvedExternalSource || post.externalSource || 'tmdb', imageUrl: post.mediaImage || '', type: post.mediaType || 'movie' })} className={`flex items-center gap-1.5 text-sm transition-all ${seenItDone ? 'text-green-500' : 'text-gray-400 hover:text-green-500 active:scale-110'}`} disabled={seenItDone}>
                  <Check size={15} /><span className="text-xs">{seenItDone ? spSeenItLabel.done : spSeenItLabel.idle}</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Counts toward your entertainment DNA</p>
            {isCommentsActive && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {loadingComments ? <p className="text-xs text-gray-400 text-center py-2">Loading...</p> : comments.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">No comments yet</p> : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto mb-2">
                    {comments.slice(0, 5).map((comment: any) => {
                      const commenterName = comment.user?.username || comment.user?.displayName || 'User';
                      const isLikedByMe = localLikedComments.has(String(comment.id)) || comment.likedByCurrentUser;
                      const likeCount = comment.likesCount || 0;
                      return (
                        <div key={comment.id} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-gray-400" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-800">{commenterName}</span>
                              <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
                              {currentUserId && comment.user?.id === currentUserId && onDeleteComment ? <button onClick={() => { onDeleteComment(String(comment.id), post.id); setComments(prev => prev.filter(c => c.id !== comment.id)); }} className="text-gray-400 hover:text-red-500 ml-auto p-1"><Trash2 size={12} /></button> : currentUserId && comment.user?.id && comment.user.id !== currentUserId ? <button onClick={() => setReportCommentLocal({ commentId: String(comment.id), userId: comment.user.id, userName: comment.user.username || commenterName })} className="text-gray-300 hover:text-orange-500 transition-colors ml-auto p-1" title="Report comment"><Flag size={12} /></button> : null}
                            </div>
                            <p className="text-xs text-gray-600 leading-tight mb-1">{comment.content}</p>
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleCommentLike(String(comment.id), likeCount)} className={`flex items-center gap-1 transition-colors ${isLikedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}><Heart size={12} fill={isLikedByMe ? 'currentColor' : 'none'} />{likeCount > 0 && <span className="text-[10px]">{likeCount}</span>}</button>
                              <button onClick={() => handleReplyTo(String(comment.id), commenterName)} className="flex items-center gap-1 text-gray-400 hover:text-purple-500 transition-colors"><MessageCircle size={12} /><span className="text-[10px]">Reply</span></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {session && (
                  <div className="flex items-center gap-2">
                    {replyingTo && <div className="flex items-center gap-1 text-[10px] text-purple-500 px-1"><span>@{replyingTo.name}</span><button onClick={() => { setReplyingTo(null); setCommentText(''); }} className="text-gray-400 hover:text-red-400 ml-1">×</button></div>}
                    <input ref={commentInputRef} type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }} placeholder="Add comment..." className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-purple-300 placeholder-gray-400" />
                    <button onClick={handleSubmitComment} disabled={!commentText.trim() || isSubmitting} className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"><Send size={14} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        // NORMAL layout — own posts or already-rated
        <div className="px-4 pt-4 pb-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2.5">
            <Link href={`/user/${post.user?.id || ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold cursor-pointer flex-shrink-0">
                {post.user?.avatar ? (
                  <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : avatarLetter}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/user/${post.user?.id || ''}`}>
                <span className="font-medium text-sm text-gray-900 hover:text-purple-600 cursor-pointer">
                  {isRatingType ? `${displayName}'s Take` : displayName}
                </span>
              </Link>
              {!isRatingType && <span className="text-xs text-gray-400"> · {timeAgo(post.timestamp)}</span>}
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${typeInfo.bg} ${typeInfo.color}`}>{typeInfo.label}</span>
            {isRatingType && <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(post.timestamp)}</span>}
            {currentUserId && post.user?.id === currentUserId && onDeletePost && (
              <button onClick={() => onDeletePost(post.id)} className="text-gray-300 hover:text-red-500 p-1 shrink-0"><Trash2 size={14} /></button>
            )}
            {currentUserId && post.user?.id !== currentUserId && (
              <button onClick={() => setIsReportOpen(true)} className="text-gray-300 hover:text-orange-400 p-1 shrink-0 transition-colors"><Flag size={13} /></button>
            )}
          </div>

          {!post.mediaTitle && post.rating && post.rating > 0 && (
            <div className="flex items-center gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map(s => {
                const r = post.rating!;
                if (s <= Math.floor(r)) return <Star key={s} size={13} className="text-yellow-400 fill-yellow-400" />;
                if (s === Math.ceil(r) && r % 1 >= 0.5) return <div key={s} className="relative"><Star size={13} className="text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={13} className="text-yellow-400 fill-yellow-400" /></div></div>;
                return <Star key={s} size={13} className="text-gray-200" />;
              })}
            </div>
          )}
          {displayContent && !post.mediaTitle && <p className="text-gray-700 text-sm leading-relaxed">{displayContent}</p>}

          {post.mediaTitle && (
            <div className="flex gap-3 items-start">
              {spPosterEl}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {post.externalId && post.externalSource ? (
                      <Link href={`/media/${normalizeMediaType(post.mediaType)}/${post.externalSource}/${post.externalId}`}>
                        <p className="text-sm font-semibold text-gray-900 hover:text-purple-600 cursor-pointer line-clamp-2">{post.mediaTitle}</p>
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">{post.mediaTitle}</p>
                    )}
                  </div>
                  {post.rating && post.rating > 0 && isRatingType && (
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(s => {
                          const r = post.rating!;
                          if (s <= Math.floor(r)) return <Star key={s} size={13} className="text-yellow-400 fill-yellow-400" />;
                          if (s === Math.ceil(r) && r % 1 >= 0.5) return <div key={s} className="relative"><Star size={13} className="text-gray-200" /><div className="absolute inset-0 overflow-hidden w-[50%]"><Star size={13} className="text-yellow-400 fill-yellow-400" /></div></div>;
                          return <Star key={s} size={13} className="text-gray-200" />;
                        })}
                      </div>
                      {spRatingDiffLine(post.rating, 'text-right')}
                    </div>
                  )}
                </div>
                {displayContent && (
                  post.containsSpoilers && !isSpoilerRevealed ? (
                    <div className="relative mt-1.5">
                      <p className="text-gray-700 text-sm leading-relaxed blur-md select-none line-clamp-3">{displayContent}</p>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button onClick={(e) => { e.stopPropagation(); setIsSpoilerRevealed(true); }} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-lg transition-all flex items-center gap-1">
                          <Eye size={12} /><span>Show Spoiler</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setContentExpanded(e => !e)} className="cursor-pointer">
                      <p className={`text-gray-700 text-sm leading-relaxed mt-1.5 ${contentExpanded ? '' : 'line-clamp-3'}`}>{displayContent}</p>
                      {!contentExpanded && displayContent.length > 120 && <span className="text-purple-500 text-xs font-medium">Read more</span>}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {(post.mediaTitle || resolvedExternalId || post.externalId) && currentUserId && post.user?.id !== currentUserId && showStarPicker && (
            <div className="border-t border-gray-100 mt-3 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-purple-600 tracking-widest uppercase">
                  {ratingJustSaved ? <span className="text-green-600 normal-case font-semibold">✓ Saved!</span> : ratingSubmitted ? 'Change Rating' : 'Your Turn'}
                </p>
                {ratingSubmitted && !ratingJustSaved && <button onClick={handleRemoveRating} className="text-[10px] text-red-400 hover:text-red-600 transition-colors">× Remove rating</button>}
              </div>
              <div ref={starsRef} className="flex items-center gap-0.5 touch-none select-none" onMouseLeave={() => setHoverRating(0)} onTouchMove={(e) => { e.stopPropagation(); if (!starsRef.current) return; const touch = e.touches[0]; const rect = starsRef.current.getBoundingClientRect(); const x = touch.clientX - rect.left; const starWidth = rect.width / 5; const starIndex = Math.floor(x / starWidth); const withinStar = (x % starWidth) / starWidth; const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1))); setHoverRating(Math.round(val * 2) / 2); }} onTouchEnd={(e) => { e.stopPropagation(); if (hoverRating > 0) handleSubmitRating(hoverRating); setHoverRating(0); }}>
                {[1,2,3,4,5].map(star => {
                  const displayVal = hoverRating || ratingValue;
                  return (
                    <div key={star} className="relative" style={{ width: 30, height: 30 }}>
                      <Star size={30} className="absolute inset-0 text-gray-200" />
                      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                        <Star size={30} className={hoverRating > 0 ? 'fill-yellow-300 text-yellow-300' : 'fill-yellow-400 text-yellow-400'} />
                      </div>
                      <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star - 0.5)} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star - 0.5); }} aria-label={`Rate ${star - 0.5}`} />
                      <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }} onMouseEnter={() => setHoverRating(star)} onClick={(e) => { e.stopPropagation(); handleSubmitRating(star); }} aria-label={`Rate ${star}`} />
                    </div>
                  );
                })}
                <span className="ml-2 text-xs text-gray-400">{hoverRating > 0 ? `${hoverRating}/5` : ratingValue > 0 ? `${ratingValue}/5` : ''}</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-gray-50">
            {onLike && (
              <button onClick={() => onLike(post.id)} className={`flex items-center gap-1.5 text-sm transition-all active:scale-125 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                <span className="text-xs">{post.likes || 0}</span>
              </button>
            )}
            <button onClick={() => onComment?.(post.id)} className={`flex items-center gap-1.5 text-sm ${isCommentsActive ? 'text-purple-500' : 'text-gray-400 hover:text-gray-600'} transition-colors`}>
              <MessageCircle size={15} />
              <span className="text-xs">{post.comments || 0}</span>
            </button>
            {(post.externalId || post.mediaItems?.[0]?.externalId || post.mediaTitle) && (() => {
              const media = { title: post.mediaTitle || post.mediaItems?.[0]?.title || '', externalId: resolvedExternalId || post.mediaItems?.[0]?.externalId || '', externalSource: resolvedExternalSource || post.mediaItems?.[0]?.externalSource || 'tmdb', imageUrl: post.mediaImage || post.mediaItems?.[0]?.imageUrl || post.mediaItems?.[0]?.poster_url || '', type: post.mediaType || post.mediaItems?.[0]?.type || 'movie' };
              return (
                <>
                  {onAddToList && <button onClick={() => onAddToList(media)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-purple-500 active:scale-110 transition-all" title="Add to list"><Plus size={15} /></button>}
                  {media.title && currentUserId && post.user?.id !== currentUserId && (
                    <button onClick={handleStarClick} disabled={isSearchingMedia} className={`flex items-center gap-1 active:scale-110 transition-all ${ratingSubmitted ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'} disabled:opacity-50`} title={ratingSubmitted ? 'Change your rating' : 'Rate this'}>
                      {isSearchingMedia ? <div className="w-[15px] h-[15px] border-2 border-gray-300 border-t-yellow-400 rounded-full animate-spin" /> : <Star size={15} fill={ratingSubmitted ? 'currentColor' : 'none'} />}
                      {ratingSubmitted && <span className="text-xs font-medium text-yellow-500">{ratingValue}</span>}
                    </button>
                  )}
                  <button onClick={() => handleSeenIt(media)} className={`flex items-center gap-1.5 text-sm transition-all ${seenItDone ? 'text-green-500' : 'text-gray-400 hover:text-green-500 active:scale-110'}`} title={spSeenItLabel.idle} disabled={seenItDone}>
                    <Check size={15} /><span className="text-xs">{seenItDone ? spSeenItLabel.done : spSeenItLabel.idle}</span>
                  </button>
                </>
              );
            })()}
          </div>
          {isRatingType && <p className="text-[10px] text-gray-400 mt-2">Counts toward your entertainment DNA</p>}
          {isCommentsActive && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {loadingComments ? <p className="text-xs text-gray-400 text-center py-2">Loading...</p> : comments.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">No comments yet</p> : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto mb-2">
                  {comments.slice(0, 5).map((comment: any) => {
                    const commenterName = comment.user?.username || comment.user?.displayName || 'User';
                    const isLikedByMe = localLikedComments.has(String(comment.id)) || comment.likedByCurrentUser;
                    const likeCount = comment.likesCount || 0;
                    return (
                      <div key={comment.id} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-gray-400" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-800">{commenterName}</span>
                            <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
                            {currentUserId && comment.user?.id === currentUserId && onDeleteComment ? <button onClick={() => { onDeleteComment(String(comment.id), post.id); setComments(prev => prev.filter(c => c.id !== comment.id)); }} className="text-gray-400 hover:text-red-500 ml-auto p-1"><Trash2 size={12} /></button> : currentUserId && comment.user?.id && comment.user.id !== currentUserId ? <button onClick={() => setReportCommentLocal({ commentId: String(comment.id), userId: comment.user.id, userName: comment.user.username || commenterName })} className="text-gray-300 hover:text-orange-500 transition-colors ml-auto p-1" title="Report comment"><Flag size={12} /></button> : null}
                          </div>
                          <p className="text-xs text-gray-600 leading-tight mb-1">{comment.content}</p>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleCommentLike(String(comment.id), likeCount)} className={`flex items-center gap-1 transition-colors ${isLikedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}><Heart size={12} fill={isLikedByMe ? 'currentColor' : 'none'} />{likeCount > 0 && <span className="text-[10px]">{likeCount}</span>}</button>
                            <button onClick={() => handleReplyTo(String(comment.id), commenterName)} className="flex items-center gap-1 text-gray-400 hover:text-purple-500 transition-colors"><MessageCircle size={12} /><span className="text-[10px]">Reply</span></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {session && (
                <div className="flex items-center gap-2">
                  {replyingTo && <div className="flex items-center gap-1 text-[10px] text-purple-500 px-1"><span>@{replyingTo.name}</span><button onClick={() => { setReplyingTo(null); setCommentText(''); }} className="text-gray-400 hover:text-red-400 ml-1">×</button></div>}
                  <input ref={commentInputRef} type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }} placeholder="Add comment..." className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-purple-300 placeholder-gray-400" />
                  <button onClick={handleSubmitComment} disabled={!commentText.trim() || isSubmitting} className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"><Send size={14} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    <ReportSheet
      isOpen={isReportOpen}
      onClose={() => setIsReportOpen(false)}
      contentType="post"
      contentId={post.id}
      reportedUserId={post.user?.id}
      reportedUserName={post.user?.username}
    />
    <ReportSheet
      isOpen={reportCommentLocal !== null}
      onClose={() => setReportCommentLocal(null)}
      contentType="comment"
      contentId={reportCommentLocal?.commentId || ''}
      reportedUserId={reportCommentLocal?.userId || ''}
      reportedUserName={reportCommentLocal?.userName || ''}
    />
    </>
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
  onAddToList?: (media: any) => void;
}) {
  const [reportCommentDataLocal, setReportCommentDataLocal] = useState<{ commentId: string; userId: string; userName: string } | null>(null);
  const handleReportComment = (commentId: string, userId: string, userName: string) => {
    setReportCommentDataLocal({ commentId, userId, userName });
  };
  const [showRating, setShowRating] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingJustSaved, setRatingJustSaved] = useState(false);
  const [seenItDone, setSeenItDone] = useState(false);
  const starsRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  
  const rawMedia = post.mediaItems![0];
  const media = (() => {
    const src = rawMedia.externalSource;
    const eid = rawMedia.externalId;
    if (src === 'googlebooks' && eid) {
      return { ...rawMedia, imageUrl: `https://books.google.com/books/content?id=${eid}&printsec=frontcover&img=1&zoom=1` };
    }
    if ((src === 'open_library' || src === 'openlibrary') && eid) {
      const isISBN = /^[\d-]+$/.test(eid);
      const coverUrl = isISBN
        ? `https://covers.openlibrary.org/b/isbn/${eid}-L.jpg`
        : `https://covers.openlibrary.org/b/olid/${eid}-L.jpg`;
      return { ...rawMedia, imageUrl: rawMedia.imageUrl || coverUrl };
    }
    return rawMedia;
  })();
  const isOwnPost = user?.id && post.user?.id === user.id;
  
  const handleSubmitRating = async (rating: number) => {
    if (!session?.access_token) return;
    setSelectedRating(rating);
    setShowRating(false);
    setHoverRating(0);
    setRatingJustSaved(true);
    setTimeout(() => setRatingJustSaved(false), 1800);
    try {
      await fetch(
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
    } catch (error) {
      console.error('Failed to submit rating:', error);
    }
  };

  const handleRemoveRating = async () => {
    if (!session?.access_token) return;
    setSelectedRating(0);
    setShowRating(false);
    setHoverRating(0);
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/rate-media`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_external_id: media.externalId, media_external_source: media.externalSource || 'tmdb', media_title: media.title, media_type: media.mediaType || 'movie', rating: 0, skip_social_post: true }),
        }
      );
    } catch (err) {
      console.error('Remove rating failed', err);
    }
  };

  const handleSeenIt = async () => {
    if (seenItDone || !session?.access_token) return;
    setSeenItDone(true);
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/track-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            media: {
              title: media.title,
              mediaType: media.mediaType || 'movie',
              imageUrl: media.imageUrl || '',
              externalId: media.externalId || '',
              externalSource: media.externalSource || 'tmdb',
            },
            listType: 'completed',
            skip_social_post: true,
          }),
        }
      );
    } catch {
      // silent fail
    }
  };

  // Pre-populate "Your Turn" if the user has already rated this media
  useEffect(() => {
    const userId = session?.user?.id;
    const externalId = media.externalId;
    const externalSource = media.externalSource;
    if (!userId || !externalId || !externalSource || isOwnPost) return;
    supabase
      .from('media_ratings')
      .select('rating')
      .eq('media_external_id', externalId)
      .eq('media_external_source', externalSource)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.rating) {
          setSelectedRating(Number(data.rating));
        }
      });
  }, [media.externalId, media.externalSource, session?.user?.id, isOwnPost]);
  
  const displayName = post.user?.displayName || post.user?.username;
  
  return (
    <>
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
                <div className="flex items-center gap-2">
                  <Link href={`/user/${post.user?.id}`}>
                    <span className="text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
                  </Link>
                  {post.mediaType && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-purple-200 text-purple-500">{post.mediaType}</span>
                  )}
                </div>
                {post.user?.username && post.user?.displayName && post.user.username !== post.user.displayName && (
                  <p className="text-xs text-gray-400">@{post.user.username}</p>
                )}
                <p className="text-sm text-gray-900 mt-0.5">
                  added{' '}
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
              <div className="relative flex-shrink-0">
                <Link href={`/media/${media.mediaType}/${media.externalSource || 'tmdb'}/${media.externalId}`}>
                  <div className="cursor-pointer">
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
                {onAddToList && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToList({ title: media.title, externalId: media.externalId || '', externalSource: media.externalSource || 'tmdb', imageUrl: media.imageUrl || '', type: media.mediaType || 'movie' }); }}
                    className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all"
                    title="Add to list"
                  >
                    <Plus size={11} color="white" />
                  </button>
                )}
              </div>
              
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
          
          {/* Action bar — Comment | Add | Seen it */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
            <div className="flex items-center gap-4">
            <button
              onClick={() => setExpandedComments(prev => {
                const newSet = new Set(prev);
                if (newSet.has(post.id)) newSet.delete(post.id);
                else newSet.add(post.id);
                return newSet;
              })}
              className={`flex items-center gap-1.5 text-sm ${expandedComments.has(post.id) ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
              data-testid={`button-comment-currently-${post.id}`}
            >
              <MessageCircle size={15} />
              <span className="text-xs">{post.comments || 0}</span>
            </button>
            {!isOwnPost && media.externalId && (
              <button
                onClick={() => setShowRating(prev => !prev)}
                className={`flex items-center gap-1 active:scale-110 transition-all ${selectedRating > 0 ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
                title={selectedRating > 0 ? 'Change your rating' : 'Rate this'}
              >
                <Star size={15} fill={selectedRating > 0 ? 'currentColor' : 'none'} />
                {selectedRating > 0 && <span className="text-xs font-medium text-yellow-500">{selectedRating}</span>}
              </button>
            )}
            {(() => {
              const mType = (media.mediaType || '').toLowerCase();
              const siLabel = mType === 'music' ? { idle: 'Heard it', done: 'Heard!' }
                : mType === 'podcast' ? { idle: 'Listened', done: 'Listened!' }
                : mType === 'book' ? { idle: 'Read it', done: 'Read!' }
                : { idle: 'Seen it', done: 'Seen!' };
              return (
                <button
                  onClick={handleSeenIt}
                  className={`flex items-center gap-1.5 text-sm transition-all ${seenItDone ? 'text-green-500' : 'text-gray-400 hover:text-green-500 active:scale-110'}`}
                  disabled={seenItDone}
                  title={siLabel.idle}
                >
                  <Check size={15} />
                  <span className="text-xs">{seenItDone ? siLabel.done : siLabel.idle}</span>
                </button>
              );
            })()}
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

          {/* Your Turn — inline star rating */}
          {media.externalId && !isOwnPost && session?.access_token && (!selectedRating || showRating) && (
            <div className="border-t border-gray-100 mt-3 pt-3">
              {true && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-purple-600 tracking-widest uppercase">{showRating && selectedRating ? 'Change Rating' : 'Your Turn'}</p>
                    {showRating && selectedRating > 0 && (
                      <button onClick={handleRemoveRating} className="text-[10px] text-red-400 hover:text-red-600 transition-colors">× Remove rating</button>
                    )}
                  </div>
                  <div
                    ref={starsRef}
                    className="flex items-center gap-0.5 touch-none select-none"
                    onMouseLeave={() => setHoverRating(0)}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                      if (!starsRef.current) return;
                      const touch = e.touches[0];
                      const rect = starsRef.current.getBoundingClientRect();
                      const x = touch.clientX - rect.left;
                      const starWidth = rect.width / 5;
                      const starIndex = Math.floor(x / starWidth);
                      const withinStar = (x % starWidth) / starWidth;
                      const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
                      setHoverRating(Math.round(val * 2) / 2);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      if (hoverRating > 0) handleSubmitRating(hoverRating);
                      setHoverRating(0);
                    }}
                  >
                    {[1, 2, 3, 4, 5].map(star => {
                      const displayVal = hoverRating || selectedRating;
                      return (
                        <div key={star} className="relative" style={{ width: 28, height: 28 }}>
                          <Star size={28} className="absolute inset-0 text-gray-200" />
                          <div className="absolute inset-0 overflow-hidden pointer-events-none"
                               style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                            <Star size={28} className={hoverRating > 0 ? 'fill-yellow-300 text-yellow-300' : 'fill-yellow-400 text-yellow-400'} />
                          </div>
                          <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }}
                                  onMouseEnter={() => setHoverRating(star - 0.5)}
                                  onClick={(e) => { e.stopPropagation(); handleSubmitRating(star - 0.5); }} aria-label={`Rate ${star - 0.5}`} />
                          <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }}
                                  onMouseEnter={() => setHoverRating(star)}
                                  onClick={(e) => { e.stopPropagation(); handleSubmitRating(star); }} aria-label={`Rate ${star}`} />
                        </div>
                      );
                    })}
                    <span className="ml-2 text-xs">
                      {ratingJustSaved
                        ? <span className="text-green-600 font-semibold">✓ Saved!</span>
                        : hoverRating > 0
                          ? <span className="text-gray-400">{hoverRating}/5</span>
                          : selectedRating > 0
                            ? <span className="text-gray-400">{selectedRating}/5</span>
                            : null}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

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
                onReportComment={handleReportComment}
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
    <ReportSheet
      isOpen={reportCommentDataLocal !== null}
      onClose={() => setReportCommentDataLocal(null)}
      contentType="comment"
      contentId={reportCommentDataLocal?.commentId || ''}
      reportedUserId={reportCommentDataLocal?.userId || ''}
      reportedUserName={reportCommentDataLocal?.userName || ''}
    />
    </>
  );
}

// ── Tinder-style swipeable wrapper for individual UGC feed cards ──────────────
// Shared gesture hook used by both TinderCard and TinderCardStack
function useSwipeGesture({
  onDismiss,
  onOffsetChange,
  onDraggingChange,
}: {
  onDismiss: (dir: 1 | -1) => void;
  onOffsetChange: (dx: number) => void;
  onDraggingChange: (v: boolean) => void;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isHoriz = useRef<boolean | null>(null);
  const offsetRef = useRef(0);
  const active = useRef(false);
  // Persists across attachTo re-calls (which happen on every card swap)
  const wheelCooldownUntil = useRef(0);

  const doStart = useCallback((cx: number, cy: number) => {
    startX.current = cx;
    startY.current = cy;
    startTime.current = Date.now();
    isHoriz.current = null;
    offsetRef.current = 0;
    active.current = true;
    onDraggingChange(true);
  }, [onDraggingChange]);

  const doMove = useCallback((cx: number, cy: number, pd?: () => void) => {
    if (!active.current) return;
    const dx = cx - startX.current;
    const dy = cy - startY.current;
    if (isHoriz.current === null) {
      if (Math.abs(dx) > Math.abs(dy) + 3) isHoriz.current = true;
      else if (Math.abs(dy) > Math.abs(dx) + 3) isHoriz.current = false;
      else return;
    }
    if (isHoriz.current) { pd?.(); offsetRef.current = dx; onOffsetChange(dx); }
  }, [onOffsetChange]);

  const doEnd = useCallback((finalX?: number) => {
    if (!active.current) return;
    active.current = false;
    onDraggingChange(false);
    // Capture direction lock before resetting — if gesture was clearly vertical, ignore it
    const wasVertical = isHoriz.current === false;
    isHoriz.current = null;
    // For mouse gestures use full start→end displacement (fast flicks may only produce
    // 1–2 mousemove events so offsetRef only holds a partial distance).
    // For touch gestures finalX is undefined, fall back to last tracked offset.
    const dx = wasVertical ? 0
      : finalX !== undefined ? finalX - startX.current
      : offsetRef.current;
    const dt = Math.max(1, Date.now() - startTime.current);
    const velocity = Math.abs(dx) / dt; // px/ms
    // Dismiss: dragged far enough OR quick flick (velocity > 0.3 px/ms with at least 15px)
    if (Math.abs(dx) > 80 || (velocity > 0.3 && Math.abs(dx) > 15)) {
      onDismiss(dx > 0 ? 1 : -1);
    } else {
      offsetRef.current = 0;
      onOffsetChange(0);
    }
  }, [onDismiss, onOffsetChange, onDraggingChange]);

  const attachTo = useCallback((el: HTMLElement) => {
    const onTS = (e: TouchEvent) => doStart(e.touches[0].clientX, e.touches[0].clientY);
    const onTM = (e: TouchEvent) => doMove(e.touches[0].clientX, e.touches[0].clientY, () => e.preventDefault());
    const onTE = () => doEnd();
    const onMD = (e: MouseEvent) => doStart(e.clientX, e.clientY);
    const onMM = (e: MouseEvent) => doMove(e.clientX, e.clientY);
    const onMU = (e: MouseEvent) => doEnd(e.clientX);

    // Trackpad horizontal swipe: accumulate deltaX and dismiss once threshold crossed.
    // This makes it feel like a natural carousel swipe on laptop trackpads — no click-drag needed.
    let wheelAccum = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    // wheelCooldownUntil lives in a ref (hook level) so it survives attachTo re-calls
    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      // Ignore primarily-vertical scrolls so the page still scrolls normally
      if (absX < 5 || absX < absY * 0.5) return;
      e.preventDefault();
      // Cooldown: a trackpad swipe fires many events; ignore the tail after a dismiss
      if (Date.now() < wheelCooldownUntil.current) { wheelAccum = 0; return; }
      wheelAccum += e.deltaX;
      // Dismiss once the swipe crosses 60px of accumulated horizontal movement
      if (Math.abs(wheelAccum) > 60) {
        const dir = wheelAccum > 0 ? -1 : 1 as 1 | -1;
        wheelAccum = 0;
        wheelCooldownUntil.current = Date.now() + 700;
        if (wheelTimer) { clearTimeout(wheelTimer); wheelTimer = null; }
        onDismiss(dir);
        return;
      }
      // Reset accumulator if swiping stops
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelAccum = 0; wheelTimer = null; }, 200);
    };

    el.addEventListener('touchstart', onTS, { passive: true });
    el.addEventListener('touchmove', onTM, { passive: false });
    el.addEventListener('touchend', onTE, { passive: true });
    // Use capture phase so child stopPropagation doesn't block the gesture start
    el.addEventListener('mousedown', onMD, { capture: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    return () => {
      el.removeEventListener('touchstart', onTS);
      el.removeEventListener('touchmove', onTM);
      el.removeEventListener('touchend', onTE);
      el.removeEventListener('mousedown', onMD, { capture: true });
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
    };
  }, [doStart, doMove, doEnd, onDismiss]);

  return { attachTo };
}

// Single-card swipeable wrapper (used for _isPromoted standalone cards)
function TinderCard({ id, onDismiss, children }: { id: string; onDismiss: (id: string) => void; children: React.ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [flyingOut, setFlyingOut] = useState(false);

  const { attachTo } = useSwipeGesture({
    onOffsetChange: setOffset,
    onDraggingChange: setIsDragging,
    onDismiss: useCallback((dir: 1 | -1) => {
      setFlyingOut(true);
      setOffset(dir * 380);
      setTimeout(() => { setDismissed(true); onDismiss(id); }, 420);
    }, [id, onDismiss]),
  });

  useEffect(() => {
    if (cardRef.current) return attachTo(cardRef.current);
  }, [attachTo]);

  if (dismissed) return null;
  const rotation = offset * 0.06;
  const showRight = offset > 20;
  const showLeft = offset < -20;

  return (
    <div
      ref={cardRef}
      style={{
        transform: `translateX(${offset}px) rotate(${rotation}deg)`,
        transition: flyingOut ? 'transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)' : isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'transform',
        position: 'relative',
        transformOrigin: 'bottom center',
      }}
    >
      {showRight && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(34,197,94,0.10)', border: '2px solid rgba(34,197,94,0.35)', zIndex: 1, pointerEvents: 'none' }} />}
      {showLeft && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(156,163,175,0.10)', border: '2px solid rgba(156,163,175,0.30)', zIndex: 1, pointerEvents: 'none' }} />}
      {showRight && <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 2, pointerEvents: 'none', background: 'rgba(34,197,94,0.9)', borderRadius: 6, padding: '2px 8px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>DISMISS</span></div>}
      {showLeft && <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, pointerEvents: 'none', background: 'rgba(107,114,128,0.85)', borderRadius: 6, padding: '2px 8px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>SKIP</span></div>}
      {children}
    </div>
  );
}

// Multi-card stack — shows current card with peek cards behind, Tinder-style
function TinderCardStack({ posts, renderCard, hidePeekCards }: {
  posts: any[];
  renderCard: (post: any, allPosts: any[], currentIndex: number, swipeProps?: { style: React.CSSProperties; ref: React.RefObject<HTMLDivElement>; overlays: React.ReactNode }) => React.ReactNode;
  hidePeekCards?: boolean;
}) {
  const [topIndex, setTopIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyingOut, setFlyingOut] = useState(false);
  // Suppress transition during card swap so the next card snaps into place
  // rather than sliding in from the direction the previous card flew off.
  const [skipTransition, setSkipTransition] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback((dir: 1 | -1) => {
    setFlyingOut(true);
    setOffset(dir * 380);
    setTimeout(() => {
      // Kill transition BEFORE changing content so the new card never
      // inherits the outgoing card's position and slides in.
      setSkipTransition(true);
      setTopIndex(i => i + 1);
      setOffset(0);
      setFlyingOut(false);
      // Re-enable transitions two frames later (after browser has painted)
      requestAnimationFrame(() => requestAnimationFrame(() => setSkipTransition(false)));
    }, 420);
  }, []);

  const { attachTo } = useSwipeGesture({
    onOffsetChange: setOffset,
    onDraggingChange: setIsDragging,
    onDismiss: dismiss,
  });

  useEffect(() => {
    if (topRef.current) return attachTo(topRef.current);
  }, [attachTo, topIndex]); // re-attach when top card changes

  const remaining = posts.slice(topIndex);
  if (remaining.length === 0) return null;

  const rotation = offset * 0.06;
  const showRight = offset > 20;
  const showLeft = offset < -20;
  const peekCount = Math.min(2, remaining.length - 1);

  // ── Seen-It style fan constants ─────────────────────────────────────
  const CARD_W = 220;
  const CARD_H = 330;
  // Peek card mini-content helper
  const peekCardContent = (p: any) => {
    const rating = p?.rating || 0;
    const name = p?.user?.displayName || p?.user?.username || '';
    return (
      <>
        {p?.mediaImage && p.mediaImage.startsWith('http') && (
          <img src={p.mediaImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 30%, rgba(0,0,0,0.05) 65%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 12px 14px' }}>
          {rating > 0 && (
            <div style={{ display: 'flex', gap: 2, marginBottom: 5 }}>
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ fontSize: 15, color: s <= Math.round(rating) ? '#facc15' : 'rgba(255,255,255,0.2)' }}>★</span>
              ))}
            </div>
          )}
          {p?.content && (
            <p style={{ color: 'white', fontSize: 11, fontStyle: 'italic', lineHeight: 1.35, margin: '0 0 3px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
              "{p.content}"
            </p>
          )}
          {name && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>— {name}</p>}
          <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={12} color="white" />
          </div>
        </div>
      </>
    );
  };

  return (
    <div style={{ position: 'relative', marginBottom: 16, overflow: 'visible' }}>
      {/* Left peek card (remaining[2]) — rotated counter-clockwise */}
      {!hidePeekCards && peekCount >= 2 && remaining[2] && (
        <div style={{
          position: 'absolute',
          left: `calc(50% - ${CARD_W / 2}px)`,
          top: 14,
          width: CARD_W,
          height: CARD_H,
          borderRadius: 18,
          overflow: 'hidden',
          background: '#111827',
          transform: 'translateX(-110px) rotate(-12deg) scale(0.85)',
          transformOrigin: 'bottom center',
          zIndex: 8,
          pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
        }}>
          {peekCardContent(remaining[2])}
        </div>
      )}

      {/* Right peek card (remaining[1]) — rotated clockwise */}
      {!hidePeekCards && peekCount >= 1 && remaining[1] && (
        <div style={{
          position: 'absolute',
          left: `calc(50% - ${CARD_W / 2}px)`,
          top: 14,
          width: CARD_W,
          height: CARD_H,
          borderRadius: 18,
          overflow: 'hidden',
          background: '#111827',
          transform: 'translateX(110px) rotate(12deg) scale(0.85)',
          transformOrigin: 'bottom center',
          zIndex: 9,
          pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
        }}>
          {peekCardContent(remaining[1])}
        </div>
      )}

      {/* Front/center card */}
      {hidePeekCards ? (
        // When hidePeekCards: white container stays static, only the front poster card gets the swipe transform
        <div style={{ position: 'relative', zIndex: 10, overflow: 'visible' }}>
          {renderCard(remaining[0], posts, topIndex, {
            style: {
              transform: `translateX(${offset}px) rotate(${rotation}deg)`,
              transition: flyingOut ? 'transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)' : (isDragging || skipTransition) ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transformOrigin: 'bottom center',
              willChange: 'transform',
            },
            ref: topRef,
            overlays: (
              <>
                {showRight && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.4)', zIndex: 11, pointerEvents: 'none' }} />}
                {showLeft && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(156,163,175,0.12)', border: '2px solid rgba(156,163,175,0.35)', zIndex: 11, pointerEvents: 'none' }} />}
                {showRight && <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 12, pointerEvents: 'none', background: 'rgba(34,197,94,0.9)', borderRadius: 6, padding: '2px 8px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>AGREE</span></div>}
                {showLeft && <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 12, pointerEvents: 'none', background: 'rgba(107,114,128,0.85)', borderRadius: 6, padding: '2px 8px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>SKIP</span></div>}
              </>
            ),
          })}
        </div>
      ) : (
        // Normal peek-card mode: the whole card animates
        <div
          ref={topRef}
          style={{
            position: 'relative',
            zIndex: 10,
            transform: `translateX(${offset}px) rotate(${rotation}deg)`,
            transition: flyingOut ? 'transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)' : (isDragging || skipTransition) ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transformOrigin: 'bottom center',
            willChange: 'transform',
            overflow: 'visible',
          }}
        >
          {showRight && <div style={{ position: 'absolute', top: 0, left: `calc(50% - ${CARD_W / 2}px)`, width: CARD_W, height: CARD_H, borderRadius: 18, background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.4)', zIndex: 11, pointerEvents: 'none' }} />}
          {showLeft && <div style={{ position: 'absolute', top: 0, left: `calc(50% - ${CARD_W / 2}px)`, width: CARD_W, height: CARD_H, borderRadius: 18, background: 'rgba(156,163,175,0.12)', border: '2px solid rgba(156,163,175,0.35)', zIndex: 11, pointerEvents: 'none' }} />}
          {showRight && <div style={{ position: 'absolute', top: 14, left: `calc(50% - ${CARD_W / 2}px + 14px)`, zIndex: 12, pointerEvents: 'none', background: 'rgba(34,197,94,0.9)', borderRadius: 6, padding: '2px 8px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>AGREE</span></div>}
          {showLeft && <div style={{ position: 'absolute', top: 14, right: `calc(50% - ${CARD_W / 2}px + 14px)`, zIndex: 12, pointerEvents: 'none', background: 'rgba(107,114,128,0.85)', borderRadius: 6, padding: '2px 8px' }}><span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>SKIP</span></div>}
          {renderCard(remaining[0], posts, topIndex)}
        </div>
      )}
    </div>
  );
}

function SwipeableCardStack({ posts, onLike, likedPosts, session, fetchComments, currentUserId, onDeletePost, onAddToList }: {
  posts: any[];
  onLike: (id: string) => void;
  likedPosts: Set<string>;
  session: any;
  fetchComments: any;
  currentUserId: string | undefined;
  onDeletePost: (id: string) => void;
  onAddToList: (media: any) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const currentIndexRef = useRef(currentIndex);
  const postsLengthRef = useRef(posts.length);
  currentIndexRef.current = currentIndex;
  postsLengthRef.current = posts.length;

  // Native listeners: touchmove with passive:false lets us preventDefault on horizontal
  // drags so the browser doesn't steal the gesture for page-scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      // If mostly horizontal, prevent scroll so the swipe is ours
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 44 && dx < 0) {
        if (currentIndexRef.current < postsLengthRef.current - 1) {
          setCurrentIndex(i => i + 1);
        }
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false }); // must be non-passive to preventDefault
    el.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const remaining = posts.length - currentIndex;
  if (remaining === 0) return null;

  const peekCount = Math.min(remaining - 1, 2);
  const { _isPromoted: _p, _promotedKey: _pk, ...frontPost } = posts[currentIndex];

  const advance = () => {
    if (currentIndex < posts.length - 1) setCurrentIndex(i => i + 1);
  };

  // Each peek sliver shows as a strip below the front card
  const PEEK_H = 14; // px visible per sliver
  const containerPadding = peekCount === 2 ? PEEK_H * 2 + 4 : peekCount === 1 ? PEEK_H : 0;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', paddingBottom: containerPadding, marginBottom: 16, touchAction: 'pan-y' }}
    >
      {/* Sliver 3 — furthest back, most inset, at very bottom */}
      {peekCount >= 2 && (
        <div style={{
          position: 'absolute',
          left: 20, right: 20,
          bottom: 0,
          height: PEEK_H * 2 + 32,
          backgroundColor: '#e9eaec',
          borderRadius: 18,
          border: '1px solid #d1d5db',
          zIndex: 1,
        }} />
      )}
      {/* Sliver 2 — middle, slightly less inset */}
      {peekCount >= 1 && (
        <div style={{
          position: 'absolute',
          left: 10, right: 10,
          bottom: peekCount >= 2 ? PEEK_H + 2 : 0,
          height: PEEK_H + 32,
          backgroundColor: '#f1f2f4',
          borderRadius: 18,
          border: '1px solid #d1d5db',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          zIndex: 2,
        }} />
      )}
      {/* Front card */}
      <div style={{ position: 'relative', zIndex: 3 }}>
        <UGCGroupCard
          post={frontPost as any}
          onLike={onLike}
          isLiked={likedPosts.has(frontPost?.id)}
          session={session}
          fetchComments={fetchComments}
          currentUserId={currentUserId}
          onDeletePost={onDeletePost}
          onAddToList={onAddToList}
          forceActionFirst={true}
          forceNormal={true}
        />
        {/* Counter + tap-to-advance */}
        {remaining > 1 && (
          <button
            onClick={advance}
            className="absolute bottom-3 right-3 flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm z-20"
            style={{ pointerEvents: 'auto' }}
          >
            <span className="text-[10px] font-medium text-gray-500">{currentIndex + 1}/{posts.length}</span>
            <ChevronRight size={10} className="text-gray-400" />
          </button>
        )}
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
  const [reportCommentData, setReportCommentData] = useState<{ commentId: string; userId: string; userName: string } | null>(null);
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
  const [dismissedPostIds, setDismissedPostIds] = useState<Set<string>>(new Set()); // Session-only tinder-dismissed UGC cards
  const handleDismissPost = useCallback((id: string) => {
    setDismissedPostIds(prev => new Set([...prev, id]));
  }, []);
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { session, user } = useAuth();
  // Stable user ID that never resets to null once resolved. currentAppUserId (module-level)
  // resets on HMR reloads; session.user.id / user.id may be null on the very first render
  // before Supabase restores the session. Using a ref ensures the value is locked in as soon
  // as any source resolves it and never flips back to null mid-session.
  const _effectiveUserIdRef = useRef<string | null>(null);
  const _resolvedId = currentAppUserId || session?.user?.id || user?.id || null;
  if (_resolvedId && !_effectiveUserIdRef.current) _effectiveUserIdRef.current = _resolvedId;
  const effectiveUserId = _effectiveUserIdRef.current;
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
  const [whatsHappeningOpenPost, setWhatsHappeningOpenPost] = useState<any | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(searchString);
    const postId = urlParams.get('post');
    const commentId = urlParams.get('comment');
    if (postId) {
      setHighlightPostId(postId);
      setHighlightCommentId(commentId);
    }
  }, [searchString]);
  
  // Comment likes always enabled
  const commentLikesEnabled = true;
  
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
  const { data: currentUserName } = useQuery({
    queryKey: ['current-user-name', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('users').select('user_name').eq('id', user.id).single();
      return data?.user_name || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

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

  // Play activity — recent friend wins/streaks, sprinkled into feed
  const { data: playActivity = [] } = useQuery({
    queryKey: ['play-activity', Array.from(friendIds).join(',')],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-play-activity`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ friendIds: Array.from(friendIds) }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
      } catch (_) {
        return [];
      }
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000,
  });

  // Tiebreaker rating sheet — "Who's right?" conflict cards
  const [activeTiebreaker, setActiveTiebreaker] = useState<{
    mediaExternalId: string;
    mediaExternalSource: string;
    mediaTitle: string;
    mediaImage: string;
    mediaType: string;
    friendAName: string;
    friendARating: number;
    friendBName: string;
    friendBRating: number;
  } | null>(null);
  const [tiebreakerHover, setTiebreakerHover] = useState(0);
  const [tiebreakerRating, setTiebreakerRating] = useState(0);
  const [tiebreakerSubmitted, setTiebreakerSubmitted] = useState(false);

  const handleTiebreakerRate = async (rating: number) => {
    if (!session?.access_token || !activeTiebreaker) return;
    setTiebreakerRating(rating);
    setTiebreakerSubmitted(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    try {
      await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_external_id: activeTiebreaker.mediaExternalId,
          media_external_source: activeTiebreaker.mediaExternalSource,
          media_title: activeTiebreaker.mediaTitle,
          media_type: activeTiebreaker.mediaType,
          media_image_url: activeTiebreaker.mediaImage,
          rating,
          skip_social_post: false,
        }),
      });
    } catch { /* best effort */ }
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

  // "What's Happening" — 3 most recent posts, friends first
  const whatHappeningPosts = useMemo(() => {
    if (!socialPosts?.length) return [];
    const getVerb = (type: string) => {
      if (type === 'rating') return 'rated';
      if (type === 'review') return 'reviewed';
      if (type === 'rate-review') return 'rated';
      if (type === 'predict' || type === 'prediction') return 'predicted';
      if (type === 'hot_take') return 'shared a hot take on';
      if (type === 'question') return 'asked about';
      if (type === 'finished') return 'finished';
      if (type === 'poll') return 'voted on';
      if (type === 'game_moment') return 'played trivia on';
      return 'shared about';
    };
    const valid = (socialPosts as any[]).filter((p: any) => {
      return p.user?.id && (p.user?.displayName || p.user?.username) && (p.mediaTitle || p.content) && p.type !== 'dna_compare';
    }).map((p: any) => ({ ...p, _verb: getVerb(p.type) }));
    const friends = valid.filter((p: any) => friendIds.has(p.user?.id));
    const others = valid.filter((p: any) => !friendIds.has(p.user?.id));
    return [...friends, ...others].slice(0, 3);
  }, [socialPosts, friendIds]);

  // Helper: resolve media type from various fields
  const resolveItemMediaType = (m: any): string => {
    const actionTypes = ['consuming', 'consumed', 'add-to-list', 'added_to_list', 'rate', 'review', 'rewatch', 'thought'];
    const mediaType = (m.mediaType || m.media_type || '').toLowerCase();
    if (mediaType && !actionTypes.includes(mediaType)) return mediaType;
    const typeField = (m.type || '').toLowerCase();
    if (typeField && !actionTypes.includes(typeField)) return typeField;
    const src = (m.externalSource || m.external_source || '').toLowerCase();
    if (src === 'spotify') return 'music';
    if (src === 'googlebooks' || src === 'open_library') return 'book';
    if (src === 'tmdb' || src === 'tmdb_movie') return 'movie';
    if (src === 'tmdb_tv') return 'tv';
    if (src === 'youtube') return 'tv';
    return '';
  };

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
      return p.mediaItems.some((m: any) => allowedTypes.includes(resolveItemMediaType(m)));
    });
  };

  const ugcPosts: UGCPost[] = (() => {
    const isAutoGen = (text: string) => !text || text.startsWith('Added ') || text.startsWith('"Added ') || /^"?Added .+ to .+"?$/i.test(text);
    const pool: UGCPost[] = filterByCategory(socialPosts || [])
      .filter((p: any) => {
        // Only require a valid user ID — username may be missing for some users and
        // that should not silently drop their posts from the feed.
        const hasUser = !!(p.user?.id);
        const hasCreator = p.creator?.id && p.creator?.username && p.creator.username !== 'Unknown';
        if (!hasUser && !hasCreator) return false;

        // Skip NON-game_moment posts whose content is raw game moment JSON
        // (these were saved with the wrong post_type and should not show as text posts)
        // game_moment type posts with JSON content are intentional — let them through
        if (p.type !== 'game_moment') {
          const postRawContent = (p.content || '').trim();
          if (postRawContent.startsWith('{"answer":') || postRawContent.startsWith('{"gameType":')) return false;
        }

        if (p.type === 'cast_approved') return true;
        if (p.type === 'game_moment') {
          // Exclude poll-type game moments — "Cast your vote" cards don't belong in the feed
          try {
            const parsed = JSON.parse((p.content || '').trim());
            if (parsed.gameType === 'poll') return false;
          } catch (_) {}
          return true;
        }

        if (p.type === 'ask_for_rec' || p.type === 'ask_for_recs') return true;
        if ((p.type === 'poll' || p.type === 'predict' || p.type === 'prediction') && ((p as any).question || (p as any).options)) return true;
        if (p.type === 'rank' || p.type === 'shared_rank' || p.type === 'rank_share') return true;
        if (p.type === 'review' || p.post_type === 'review' || p.type === 'rate-review' || p.type === 'rate_review' || p.post_type === 'rate_review') return true;
        if (p.type === 'thought' || p.post_type === 'thought') return true;
        if (p.type === 'hot_take' || p.post_type === 'hot_take') return true;
        if (p.type === 'question' || p.post_type === 'question') return true;
        if (p.type === 'dna_compare' || p.post_type === 'dna_compare') return true;
        const content = (p.content || '').trim();
        if (p.rating && p.rating > 0) return true;
        if (content.length > 20 && !isAutoGen(content)) return true;
        if (content.toLowerCase().includes('finished') || content.toLowerCase().includes('completed')) return true;
        return false;
      })
      .map((p: any): UGCPost => {
        let postType: UGCPost['type'] = 'general';
        const content = (p.content || '').trim();
        if (p.type === 'binge_battle') postType = 'binge_battle';
        else if (p.type === 'game_moment') postType = 'game_moment';
        else if (p.type === 'ask_for_rec' || p.type === 'ask_for_recs') postType = 'ask_for_rec';
        else if ((p.type === 'predict' || p.type === 'prediction') && ((p as any).question || (p as any).options)) postType = 'predict';
        else if (p.type === 'poll' && ((p as any).question || (p as any).options)) postType = 'poll';
        else if (p.type === 'cast_approved') postType = 'cast_approved';
        else if (p.type === 'rank' || p.type === 'shared_rank' || p.type === 'rank_share') postType = 'rank';
        else if (p.type === 'hot_take' || p.post_type === 'hot_take') postType = 'hot_take';
        else if (p.type === 'question' || p.post_type === 'question') postType = 'question';
        else if (p.type === 'dna_compare' || p.post_type === 'dna_compare') postType = 'dna_compare';
        else if (content.toLowerCase().includes('finished') || content.toLowerCase().includes('completed')) postType = 'finished';
        else if ((p.type === 'review' || p.post_type === 'review' || p.type === 'rate-review' || p.type === 'rate_review' || p.post_type === 'rate_review') && content) postType = 'review';
        else if (p.type === 'thought' || p.post_type === 'thought') postType = 'thought';
        else if (p.rating && p.rating > 0 && content.length > 20) postType = 'review';
        else if (p.rating && p.rating > 0) postType = 'rating';
        else postType = 'thought';

        const media = p.mediaItems?.[0];
        let mediaImg = media?.imageUrl || media?.image_url || media?.poster_url || (p as any).image_url || '';
        const src = media?.externalSource || media?.external_source || (p as any).media_external_source || 'tmdb';
        const eid = media?.externalId || media?.external_id || (p as any).media_external_id || (p as any).externalId;
        if (src === 'googlebooks' && eid) mediaImg = `https://books.google.com/books/content?id=${eid}&printsec=frontcover&img=1&zoom=1`;
        else if (src === 'open_library' && eid) mediaImg = `https://covers.openlibrary.org/b/olid/${eid}-L.jpg`;

        const userObj = p.user || p.creator;
        return {
          id: p.id, type: postType,
          user: { id: userObj?.id || '', username: userObj?.username || '', displayName: userObj?.displayName || userObj?.display_name || '', avatar: userObj?.avatar_url || userObj?.avatarUrl || userObj?.avatar || '', is_persona: userObj?.is_persona || false },
          content: (postType === 'poll' || postType === 'predict') ? ((p as any).question || content) : content,
          mediaTitle: media?.title || (p as any).mediaTitle || (p as any).media_title, mediaType: media?.mediaType || media?.type || (p as any).media_type, mediaImage: mediaImg, externalId: eid, externalSource: src,
          rating: p.rating, containsSpoilers: p.containsSpoilers || false, likes: p.likes || p.likes_count || 0, comments: p.comments || p.comments_count || 0,
          fire_votes: p.fire_votes || 0, ice_votes: p.ice_votes || 0,
          options: (p as any).options || [], optionVotes: (p as any).optionVotes || [], timestamp: p.createdAt || p.created_at || p.timestamp, pollId: (p as any).poolId || p.id,
          userHasVoted: (p as any).userHasAnswered || false,
          userVotedOption: (p as any).userVotes?.[0]?.vote || undefined,
          origin_type: (p as any).origin_type,
          _rawPost: p,
        };
      });

    const seen = new Set<string>();
    return pool.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  })();

  const ugcUsedIds = new Set(ugcPosts.map(p => p.id));

  const standaloneUGCPosts: any[] = (() => {
    const allUGC = ugcPosts.filter(p => {
      // Only include predict/poll posts that are explicitly user-created — consumed carousel polls belong in TriviaCarousel
      if (p.type === 'predict' || p.type === 'poll' || p.type === 'prediction') {
        return (p as any).origin_type === 'user';
      }
      // Filter out thought posts that have no rating AND no media — they're low-signal filler.
      // But keep thoughts that reference a specific media item (e.g. "Godzilla is my comfort watch").
      if (p.type === 'thought') return !!(p.rating && p.rating > 0) || !!p.mediaTitle;
      return p.type === 'review' || p.type === 'rating' || p.type === 'rate-review' || p.type === 'finished' || p.type === 'ask_for_rec' || p.type === 'rank' || p.type === 'cast_approved' || p.type === 'game_moment' || p.type === 'binge_battle' || p.type === 'hot_take' || p.type === 'question' || p.type === 'dna_compare';
    });

    // Group posts by user within 24-hour rolling windows.
    // If a user posts 2+ things within 24 hours they appear as a swipeable carousel.
    // Single posts appear as individual cards.
    // All items (carousels and solo posts) are sorted by most-recent timestamp.
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const byUser = new Map<string, UGCPost[]>();
    for (const post of allUGC) {
      // game_moment, cast_approved, rank, and binge_battle posts must always be solo cards —
      // never grouped into the 24h carousel because UGCGroupCard doesn't know how to render them
      const uid = (post.type === 'game_moment' || post.type === 'cast_approved' || post.type === 'rank' || post.type === 'binge_battle' || post.type === 'hot_take' || post.type === 'question' || post.type === 'predict' || post.type === 'prediction' || post.type === 'poll' || post.type === 'dna_compare')
        ? `solo-${post.id}`
        : post.user?.id || 'anon';
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(post);
    }

    const feedItems: any[] = [];
    for (const [, userPosts] of byUser) {
      userPosts.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      let window: UGCPost[] = [userPosts[0]];
      const flushWindow = (w: UGCPost[]) => {
        if (w.length >= 2) {
          feedItems.push({ id: `ugc-group-${w[0].id}`, type: 'ugc_group', user: w[0].user, posts: w, timestamp: w[0].timestamp });
        } else {
          feedItems.push(w[0]);
        }
      };
      for (let i = 1; i < userPosts.length; i++) {
        const windowTop = new Date(window[0].timestamp || 0).getTime();
        const cur = new Date(userPosts[i].timestamp || 0).getTime();
        if (windowTop - cur < ONE_DAY_MS) {
          window.push(userPosts[i]);
        } else {
          flushWindow(window);
          window = [userPosts[i]];
        }
      }
      flushWindow(window);
    }

    feedItems.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    // Interleave game_moment cards so they never stack consecutively.
    // Insert at most 1 game_moment for every 2 other posts, starting after the first post.
    const gameMomentItems = feedItems.filter(item => item.type === 'game_moment');
    const otherItems = feedItems.filter(item => item.type !== 'game_moment');
    if (gameMomentItems.length === 0) return feedItems;
    const interleaved: any[] = [];
    let gmIdx = 0;
    for (let i = 0; i < otherItems.length; i++) {
      interleaved.push(otherItems[i]);
      // Drop in a game_moment after every 2nd other post
      if ((i + 1) % 2 === 0 && gmIdx < gameMomentItems.length) {
        interleaved.push(gameMomentItems[gmIdx++]);
      }
    }
    // Append any remaining game_moments after all other content
    while (gmIdx < gameMomentItems.length) {
      interleaved.push(gameMomentItems[gmIdx++]);
    }
    return interleaved;
  })();
  // Split standaloneUGCPosts into two streams:
  // 1. feedPlaySlots — game_moments + user predictions (shown standalone, interleaved with play carousels)
  // 2. feedRatingCarousels — rate/review posts, grouped into cross-user batches of 4 for compact carousels
  const feedPlaySlots: any[] = standaloneUGCPosts.filter((item: any) =>
    item.type === 'game_moment' ||
    item.type === 'predict' ||
    item.type === 'prediction' ||
    item.type === 'rank' ||
    item.type === 'binge_battle' ||
    item.type === 'hot_take' ||
    item.type === 'question'
    // dna_compare intentionally excluded — injected directly in JSX at slot 2
  );

  // dna_compare shared posts — pulled out of the feed pipeline so we can place them
  // precisely in the JSX at position 2 (between the first two UGC posts)
  const dnaComparePostsForFeed = standaloneUGCPosts.filter((item: any) => item.type === 'dna_compare');

  const { feedRatingCarousels, promotedRatings } = (() => {
    const ratingItems: any[] = [];
    standaloneUGCPosts.forEach((item: any) => {
      if (item.type === 'ugc_group') {
        item.posts.forEach((p: any) => ratingItems.push(p));
      } else if (
        item.type !== 'game_moment' &&
        item.type !== 'predict' &&
        item.type !== 'prediction' &&
        item.type !== 'rank' &&
        item.type !== 'binge_battle' &&
        item.type !== 'hot_take' &&
        item.type !== 'question' &&
        item.type !== 'dna_compare'
      ) {
        ratingItems.push(item);
      }
    });

    // Real users come before persona (AI bot) posts
    const realItems = ratingItems.filter((item: any) =>
      !(item._rawPost?.user?.is_persona === true || item.user?.is_persona === true)
    );
    const personaItems = ratingItems.filter((item: any) =>
      item._rawPost?.user?.is_persona === true || item.user?.is_persona === true
    );
    const prioritised = [...realItems, ...personaItems];

    // Cap total posts
    const MAX_RATING_POSTS = 120;
    const capped = prioritised.slice(0, MAX_RATING_POSTS);

    // Two streams:
    // 1. bypassDedup — explicit rate-review posts (post_type='rate-review') AND persona posts.
    //    These always show in full — no one-per-media dedup.
    //    • rate-review: the user deliberately wrote a review; it must always surface.
    //    • persona posts: each AI persona is unique, so their posts never flood the feed.
    //      A real user rating the same title must not silently erase a persona's review.
    // 2. trackingPosts — rated add-to-list posts from real users.
    //    Deduplicated to one representative per media title to prevent the same show
    //    appearing 10 times from 10 different friends.
    const isExplicitReview = (item: any) =>
      item._rawPost?.type === 'rate-review' || item._rawPost?.post_type === 'rate-review';
    const isPersonaPost = (item: any) =>
      item.user?.is_persona === true || item._rawPost?.user?.is_persona === true;

    const bypassDedup = capped.filter((item: any) => isExplicitReview(item) || isPersonaPost(item));
    const trackingPosts = capped.filter((item: any) => !isExplicitReview(item) && !isPersonaPost(item));

    // One-per-media dedup for tracking posts only
    const byMedia = new Map<string, any[]>();
    trackingPosts.forEach((item: any) => {
      const key = item.mediaTitle || item.externalId || `solo-${item.id}`;
      if (!byMedia.has(key)) byMedia.set(key, []);
      byMedia.get(key)!.push(item);
    });

    const sortedGroups = Array.from(byMedia.values())
      .sort((a, b) => {
        const aRecent = Math.max(...a.map((p: any) => new Date(p.timestamp || 0).getTime()));
        const bRecent = Math.max(...b.map((p: any) => new Date(p.timestamp || 0).getTime()));
        return bRecent - aRecent;
      });

    const dedupedTracking: any[] = [];
    for (const group of sortedGroups) {
      group.sort((a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      const representative =
        group.find((p: any) => !p.user?.is_persona) ||
        group[0];
      dedupedTracking.push(representative);
    }

    // Merge: all bypass posts + one-per-media tracking posts, sorted by recency.
    // Then apply a final per-media dedup across both streams so the same title/externalId
    // never appears twice in the carousel (e.g. two explicit rate-review posts for the same book).
    const merged: any[] = [...bypassDedup, ...dedupedTracking]
      .sort((a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
    // Allow up to 3 posts per media title so persona users aren't collapsed to 1.
    // Previously was a Set (max 1 per media); now a Map counting occurrences.
    // To revert to strict 1-per-media: replace Map logic with the old Set version.
    const seenFinalMediaCount = new Map<string, number>();
    const finalOrder: any[] = merged.filter((item: any) => {
      const key = (item.externalId || item.mediaTitle || '').toLowerCase().trim();
      if (!key) return true; // no media info — always keep
      const count = seenFinalMediaCount.get(key) || 0;
      if (count >= 3) return false;
      seenFinalMediaCount.set(key, count + 1);
      return true;
    });

    // PROMOTION: pull a small number of high-signal ratings out of the carousel pool
    // to show as standalone cards interleaved with play slots.
    // Priority 1: the current user's OWN most-recent rating posts (pulled directly from
    //   ratingItems, bypassing one-per-media dedup so they always surface).
    // Priority 2: other real (non-persona) users, most recent, one per author.
    // Cap at 50 so UGC posts appear at least every other slot in the feed.
    const MAX_PROMOTED = 50;
    const seenAuthors = new Set<string>();
    const seenMediaTitles = new Set<string>();
    const promoted: any[] = [];

    // Surface the current user's own rating posts first — but ONLY if posted within the last 30 minutes.
    // After that window it naturally gets displaced by newer content (same as Facebook behaviour).
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    if (effectiveUserId) {
      const myOwnPosts = ratingItems
        .filter((item: any) => {
          const authorId = item.user?.id || item._rawPost?.user?.id;
          if (authorId !== effectiveUserId) return false;
          const postTime = new Date(item.timestamp || 0).getTime();
          return Date.now() - postTime < THIRTY_MIN_MS;
        })
        .sort((a: any, b: any) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
      for (const item of myOwnPosts) {
        if (promoted.length >= 2) break;
        const authorId = item.user?.id || item._rawPost?.user?.id;
        if (!authorId || seenAuthors.has(authorId + '-' + (item.mediaTitle || item.id))) continue;
        seenAuthors.add(authorId + '-' + (item.mediaTitle || item.id));
        if (!seenAuthors.has(authorId)) seenAuthors.add(authorId);
        const mediaKey = (item.mediaTitle || item.externalId || '').toLowerCase().trim();
        if (mediaKey) seenMediaTitles.add(mediaKey);
        promoted.push(item);
      }
    }

    // Fill remaining slots with the most-recent real (non-persona) users' posts.
    // Deduplicate by both author AND media (title or externalId) — same book/show must not appear twice.
    const recencySorted = [...finalOrder].sort((a: any, b: any) =>
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    const promotedIds = new Set(promoted.map((p: any) => p.id));
    for (const item of recencySorted) {
      if (promoted.length >= MAX_PROMOTED) break;
      const authorId = item.user?.id || item._rawPost?.user?.id;
      if (!authorId) continue;
      if (promotedIds.has(item.id)) continue;
      if (seenAuthors.has(authorId)) continue;
      // Use mediaTitle first, fall back to externalId so blank-title items are still deduped
      const mediaKey = (item.mediaTitle || item.externalId || '').toLowerCase().trim();
      if (mediaKey && seenMediaTitles.has(mediaKey)) continue;
      seenAuthors.add(authorId);
      if (mediaKey) seenMediaTitles.add(mediaKey);
      promoted.push(item);
    }
    const promotedIdSet = new Set(promoted.map((p: any) => p.id));
    // Deduplicate the carousel by media title so the same show/movie doesn't
    // appear multiple times (e.g. 9 persona users all rating The Fugitive).
    // finalOrder is already sorted by recency, so the first occurrence per
    // media key is the most recent one — keep that, drop the rest.
    const seenMediaInCarousel = new Set<string>();
    const carouselOrder = finalOrder.filter((p: any) => {
      if (promotedIdSet.has(p.id)) return false;
      const mediaKey = p.mediaTitle || p.externalId || p.id;
      if (seenMediaInCarousel.has(mediaKey)) return false;
      seenMediaInCarousel.add(mediaKey);
      return true;
    });

    // 10 posts per carousel — max 6 carousels total
    const batches: { id: string; type: string; posts: any[] }[] = [];
    const BATCH_SIZE = 10;
    const MAX_CAROUSELS = 6;
    for (let i = 0; i < carouselOrder.length && batches.length < MAX_CAROUSELS; i += BATCH_SIZE) {
      const batch = carouselOrder.slice(i, i + BATCH_SIZE);
      if (batch.length > 0) {
        batches.push({ id: `rating-carousel-${i}`, type: 'rating_carousel', posts: batch });
      }
    }
    return { feedRatingCarousels: batches, promotedRatings: promoted };
  })();

  // Interleave play slots with promoted standalone ratings and binge battle promo cards.
  // Pattern (1-indexed): every 3 play items inserts one promoted rating; positions 5 and 11
  // insert binge-battle promo cards (max 2). Play stays the dominant rhythm of the feed.
  const mixedFeedSlots = useMemo(() => {
    const out: any[] = [];
    let promotedIdx = 0;
    // Flatten all carousel posts into a secondary UGC pool for organic interleaving.
    // These fill the "extra" UGC slots so the feed alternates:
    //   play → UGC,  play → UGC → UGC,  play → UGC,  play → UGC → UGC …
    // To revert to 1:1 interleave only: remove extraUGC + wrapExtra + the extra inject block.
    const extraUGC = feedRatingCarousels.flatMap((c: any) => c.posts);
    let extraIdx = 0;

    const wrapExtra = (idx: number) => ({
      ...extraUGC[idx],
      _isPromoted: true,
      _promotedKey: `extra-${idx}`,
    });

    // Group promoted ratings into stacks of 5 so TinderCardStack shows a card deck.
    // The first stack leads the feed (preserving the persona-first ordering rule).
    const STACK_SIZE = 5;
    const promotedStacks: any[] = [];
    for (let i = 0; i < promotedRatings.length; i += STACK_SIZE) {
      const posts = promotedRatings.slice(i, i + STACK_SIZE);
      promotedStacks.push({ type: 'ugc_stack', id: `promo-stack-${i}`, posts });
    }
    let stackIdx = 0;

    // Lead with the first stack so persona posts are still the very first thing in the feed
    if (promotedStacks.length > 0) {
      out.push(promotedStacks[stackIdx++]);
    }

    feedPlaySlots.forEach((item: any, i: number) => {
      out.push(item);
      // After every 5 play items, insert the next stack of 5 promoted ratings
      if ((i + 1) % 5 === 0 && stackIdx < promotedStacks.length) {
        out.push(promotedStacks[stackIdx++]);
      }
      // Every other play item, inject an extra UGC from the carousel pool.
      if (i % 2 === 1 && extraIdx < extraUGC.length) {
        out.push(wrapExtra(extraIdx));
        extraIdx++;
      }
    });
    // Append remaining stacks
    while (stackIdx < promotedStacks.length) {
      out.push(promotedStacks[stackIdx++]);
    }
    // Append remaining extra UGC after all play slots are consumed
    while (extraIdx < extraUGC.length) {
      out.push(wrapExtra(extraIdx));
      extraIdx++;
    }
    return out;
  }, [feedPlaySlots, promotedRatings, feedRatingCarousels]);

  // Map each play slot to a sequential index for renderPostBatchByIndex
  const slotAssignments = useMemo(() => {
    const map = new Map<number, any>();
    mixedFeedSlots.forEach((item, i) => {
      map.set(i, item);
    });
    return map;
  }, [mixedFeedSlots]);

  // Compact play activity card — leaderboard nudges and friend activity
  const renderPlayActivityCard = (item: any) => {
    const iconConfig: Record<string, { Icon: any; iconColor: string; bgColor: string }> = {
      trophy:      { Icon: Trophy,    iconColor: 'text-yellow-500', bgColor: 'bg-yellow-400/20' },
      flame:       { Icon: Flame,     iconColor: 'text-orange-400', bgColor: 'bg-orange-400/20' },
      'bar-chart': { Icon: BarChart,  iconColor: 'text-violet-500', bgColor: 'bg-violet-400/20' },
      users:       { Icon: Users,     iconColor: 'text-indigo-500', bgColor: 'bg-indigo-400/20' },
      play:        { Icon: Play,      iconColor: 'text-purple-500', bgColor: 'bg-purple-400/20' },
    };
    const { Icon, iconColor, bgColor } = iconConfig[item.icon] || iconConfig.trophy;

    // "Who's right?" conflict cards open the tiebreaker rating sheet
    if (item.icon === 'flame' && item.conflictData) {
      return (
        <button
          key={item.id}
          onClick={() => {
            setActiveTiebreaker(item.conflictData);
            setTiebreakerRating(0);
            setTiebreakerHover(0);
            setTiebreakerSubmitted(false);
          }}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-orange-50/80 border border-orange-100 mb-2 active:opacity-75 transition-opacity">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
              <Icon size={15} className={iconColor} />
            </div>
            <p className="text-sm text-orange-900/80 flex-1 leading-snug">{item.text}</p>
            <ChevronRight size={14} className="text-orange-300 shrink-0" />
          </div>
        </button>
      );
    }

    const dest = item.link || '/leaderboard?tab=engagement';
    return (
      <Link key={item.id} to={dest}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 mb-2 active:opacity-75 transition-opacity">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
            <Icon size={15} className={iconColor} />
          </div>
          <p className="text-sm text-indigo-900/80 flex-1 leading-snug">{item.text}</p>
          <ChevronRight size={14} className="text-indigo-300 shrink-0" />
        </div>
      </Link>
    );
  };

  // Renders one feed item — either a single post or a grouped user activity carousel
  const renderFeedItem = (item: any, keyPrefix: string) => {
    // Cross-user stack of 5 promoted ratings — shown as a swipeable Tinder deck
    if (item?.type === 'ugc_stack') {
      const visiblePosts = item.posts.filter((p: any) => !dismissedPostIds.has(p.id));
      if (visiblePosts.length === 0) return null;
      return (
        <TinderCardStack
          key={item.id}
          posts={visiblePosts}
          hidePeekCards={true}
          renderCard={(p: any, allPosts: any[], idx: number, swipeProps) => (
            <UGCGroupCard
              post={p}
              onLike={handleLike}
              isLiked={likedPosts.has(p.id)}
              session={session}
              fetchComments={fetchComments}
              currentUserId={currentAppUserId || undefined}
              onDeletePost={handleDeletePost}
              onAddToList={(media: any) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
              forceActionFirst={true}
              forceNormal={true}
              stackPosts={allPosts}
              stackIndex={idx}
              swipeProps={swipeProps}
            />
          )}
        />
      );
    }

    if (item?.type === 'ugc_group') {
      const grp = item as { id: string; user: UGCPost['user']; posts: UGCPost[]; timestamp: string };
      const visiblePosts = grp.posts.filter((p) => !dismissedPostIds.has(p.id));
      if (visiblePosts.length === 0) return null;

      return (
        <TinderCardStack
          key={`${keyPrefix}-${grp.id}`}
          posts={visiblePosts}
          hidePeekCards={true}
          renderCard={(p, allPosts, idx, swipeProps) => (
            <UGCGroupCard
              post={p}
              onLike={handleLike}
              isLiked={likedPosts.has(p.id)}
              session={session}
              fetchComments={fetchComments}
              currentUserId={currentAppUserId || undefined}
              onDeletePost={handleDeletePost}
              onAddToList={(media) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
              forceNormal={true}
              stackPosts={allPosts}
              stackIndex={idx}
              swipeProps={swipeProps}
            />
          )}
        />
      );
    }
    // Game moment posts — poll votes, predictions, trivia answers
    if (item?.type === 'game_moment') {
      const spCard = buildGameMomentSocialProof(item);
      return (
        <div key={`${keyPrefix}-game-moment-${item.id}`} id={`post-${item.id}`}>
          <SocialProofCard card={spCard} />
        </div>
      );
    }

    // Cast approved posts — render as proper celebrity cast card
    if (item?.type === 'cast_approved') {
      const raw = item._rawPost || item;
      const celebName = raw.mediaItems?.[0]?.title || item.mediaTitle || 'a celebrity';
      const celebImage = raw.mediaItems?.[0]?.imageUrl || raw.mediaItems?.[0]?.image_url || raw.mediaItems?.[0]?.poster_url || item.mediaImage || '';
      const targetUserName = raw.content || item.content || 'their friend';
      const postUser = raw.user || item.user;
      const postTimestamp = raw.timestamp || raw.createdAt || raw.created_at || item.timestamp;
      const postId = item.id;
      return (
        <div key={`${keyPrefix}-cast-${postId}`} id={`post-${postId}`} className="mb-4">
          <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                {postUser && (
                  <Link href={`/user/${postUser.id}`}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer">
                      {postUser.avatar ? (
                        <img src={postUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm">{postUser.username?.[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                  </Link>
                )}
                <div className="flex-1">
                  <Link href={`/user/${postUser?.id}`}>
                    <span className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer">{postUser?.displayName || postUser?.username}</span>
                  </Link>
                  {postUser?.username && postUser?.displayName && postUser.username !== postUser.displayName && (
                    <p className="text-xs text-gray-400 leading-tight">@{postUser.username}</p>
                  )}
                  <p className="text-sm text-gray-900">cast <span className="font-semibold">@{targetUserName}</span> as</p>
                  <span className="text-xs text-gray-400">{postTimestamp ? formatDate(postTimestamp) : 'Today'}</span>
                </div>
                {user?.id && (postUser?.id === user.id || (currentUserName && targetUserName === currentUserName)) && (
                  <button onClick={() => handleDeletePost(postId)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-purple-50 to-amber-50 rounded-xl">
                {celebImage && <img src={celebImage} alt={celebName} className="w-16 h-20 rounded-xl object-cover" />}
                <div className="flex-1">
                  <p className="font-bold text-lg text-gray-900">{celebName}</p>
                  <p className="text-xs text-gray-500">would play @{targetUserName} in a movie</p>
                </div>
              </div>
              {/* HIDDEN: Cast Your Friends CTA — temporarily hidden while redesigning */}
              {false && <Link href="/cast"><button className="mt-3 w-full py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">Cast Your Friends</button></Link>}
            </div>
            <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => setExpandedComments(prev => { const s = new Set(prev); s.has(postId) ? s.delete(postId) : s.add(postId); return s; })}
                className={`flex items-center gap-1.5 text-sm ${expandedComments.has(postId) ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
              >
                <MessageCircle size={15} />
                <span className="text-xs">{raw.comments || item.comments || 0}</span>
              </button>
            </div>
            {expandedComments.has(postId) && (
              <div className="border-t border-gray-100">
                <CommentsSection
                  postId={postId}
                  session={session}
                  fetchComments={fetchComments}
                  commentInput={commentInputs[postId] || ''}
                  onCommentInputChange={(value) => handleCommentInputChange(postId, value)}
                  onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(postId, parentCommentId, content)}
                  isSubmitting={commentMutation.isPending}
                  currentUserId={user?.id}
                  onDeleteComment={handleDeleteComment}
                  onReportComment={handleReportComment}
                  onLikeComment={handleLikeComment}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    // Promoted standalone rating — a high-signal real-user rating pulled out of the
    // compressed rating carousel and shown as a single full card between play items.
    // Strip the wrapper flag so UGCGroupCard sees the original post (with original
    // type) and renders the "WHAT'S YOUR TAKE?" action-first layout.
    if (item?._isPromoted) {
      const { _isPromoted, _promotedKey, ...originalPost } = item;
      if (dismissedPostIds.has(item.id)) return null;
      return (
        <TinderCard key={`${keyPrefix}-${_promotedKey || 'promoted'}-${item.id}`} id={item.id} onDismiss={handleDismissPost}>
          <div className="mb-4">
            <UGCGroupCard
              post={originalPost as any}
              onLike={handleLike}
              isLiked={likedPosts.has(item.id)}
              session={session}
              fetchComments={fetchComments}
              currentUserId={currentAppUserId || undefined}
              onDeletePost={handleDeletePost}
              onAddToList={(media: any) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
              forceActionFirst={true}
              forceNormal={true}
            />
          </div>
        </TinderCard>
      );
    }


    // DNA Compare posts — proper component with sheet state
    if (item?.type === 'dna_compare') {
      return <DnaComparePostCard key={item.id} item={item} />;
    }

    // Binge Battle posts — render dedicated card
    if (item?.type === 'binge_battle') {
      const raw = item._rawPost || item;
      const postUserId = raw.user?.id || item.user?.id;
      return (
        <BingeBattleFeedCard
          key={`binge-battle-${item.id}`}
          post={{
            id: item.id,
            content: raw.content || item.content || '',
            image_url: raw.mediaItems?.[0]?.imageUrl || raw.image_url || '',
            media_title: raw.mediaItems?.[0]?.title || raw.media_title || '',
            timestamp: raw.timestamp || raw.created_at || '',
            user: raw.user || item.user,
          }}
          isOwn={postUserId === currentAppUserId}
          onDelete={handleDeletePost}
        />
      );
    }

    // Prediction posts — render as interactive voting card
    if ((item?.type === 'predict' || item?.type === 'poll') && (item._rawPost || item.options?.length > 0)) {
      const raw = item._rawPost || item;
      // Skip prediction_pools carousel polls — they live in the TriviaCarousel, not the feed
      const originType = raw.origin_type || item.origin_type || 'user';
      if (originType === 'consumed') return null;
      const predictionCardData = {
        ...raw,
        id: raw.poolId || raw.id,
        title: raw.question || raw.content,
        mediaTitle: raw.mediaTitle || raw.mediaItems?.[0]?.title,
        mediaItems: raw.mediaItems || [],
        creator: raw.creator || raw.user || { username: 'Unknown' },
        poolId: raw.poolId || raw.id,
        options: raw.options || item.options || [],
        optionVotes: raw.optionVotes || item.optionVotes || [],
        userVotes: raw.userVotes || [],
        userHasAnswered: raw.userHasAnswered || item.userHasVoted || false,
        likesCount: raw.likes || 0,
        commentsCount: raw.comments || 0,
        isLiked: raw.isLiked || false,
        origin_type: raw.origin_type || 'user',
        origin_user_id: raw.origin_user_id,
        status: raw.status || 'open',
        type: raw.poolType || 'predict',
      };
      return (
        <div key={`${keyPrefix}-pred-${item.id}`} className="mb-3">
          <CollaborativePredictionCard prediction={predictionCardData as any} currentUserId={currentAppUserId || undefined} />
        </div>
      );
    }

    // Rank share posts — render as RankFeedCard using the preserved _rawPost
    if (item._rawPost?.type === 'rank_share') {
      const rawPost = item._rawPost as any;
      if (rawPost.rankData) {
        return (
          <div key={`${keyPrefix}-rank-${item.id}`} id={`post-${item.id}`} className="mb-4">
            <RankFeedCard
              rank={rawPost.rankData}
              author={{
                id: rawPost.user?.id || '',
                user_name: rawPost.user?.username || '',
                display_name: rawPost.user?.displayName,
                profile_image_url: rawPost.user?.avatar
              }}
              caption={rawPost.content?.startsWith('Check out my ranked list:') ? undefined : rawPost.content || undefined}
              createdAt={rawPost.timestamp}
              postId={item.id}
              likesCount={rawPost.likes}
              commentsCount={rawPost.comments}
              isLiked={likedPosts.has(item.id)}
              onLike={handleLike}
              expandedComments={expandedComments.has(item.id)}
              onToggleComments={() => setExpandedComments(prev => {
                const newSet = new Set(prev);
                if (newSet.has(item.id)) newSet.delete(item.id);
                else newSet.add(item.id);
                return newSet;
              })}
              fetchComments={fetchComments}
              commentInput={commentInputs[item.id] || ''}
              onCommentInputChange={(value) => handleCommentInputChange(item.id, value)}
              onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(item.id, parentCommentId, content)}
              isSubmitting={commentMutation.isPending}
              currentUserId={user?.id}
              onDeleteComment={handleDeleteComment}
              onReportComment={handleReportComment}
              onLikeComment={commentLikesEnabled ? handleLikeComment : undefined}
              onVoteComment={handleVoteComment}
              likedComments={likedComments}
              commentVotes={commentVotes}
            />
          </div>
        );
      }
      const rankId = rawPost.rankId;
      const rankTitle = (() => {
        const content = rawPost.content || '';
        const prefix = 'Check out my ranked list: ';
        return content.startsWith(prefix) ? content.slice(prefix.length) : content;
      })();
      const isStubOwner = rawPost.user?.id && currentAppUserId && rawPost.user.id === currentAppUserId;
      return (
        <div key={`${keyPrefix}-rank-stub-${item.id}`} id={`post-${item.id}`} className="mb-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4">
              {/* Pills */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full uppercase tracking-wide">RANK</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Community</span>
                {isStubOwner && (
                  <button onClick={() => handleDeletePost(item.id)} className="ml-auto p-1 hover:bg-red-50 rounded-full transition-colors">
                    <Trash2 size={14} className="text-gray-300 hover:text-red-400 transition-colors" />
                  </button>
                )}
              </div>
              {/* Author */}
              {rawPost.user && (
                <div className="flex items-center gap-2 mb-3">
                  <Link href={`/user/${rawPost.user.id}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer flex-shrink-0 overflow-hidden">
                      {rawPost.user.avatar
                        ? <img src={rawPost.user.avatar} alt="" className="w-full h-full object-cover" />
                        : (rawPost.user.displayName || rawPost.user.username || '?')[0].toUpperCase()}
                    </div>
                  </Link>
                  <div>
                    <Link href={`/user/${rawPost.user.id}`}>
                      <span className="text-sm font-medium text-gray-900 hover:text-purple-600 cursor-pointer">
                        {rawPost.user.displayName || rawPost.user.username}
                      </span>
                    </Link>
                    <span className="text-xs text-gray-500 ml-2">shared a ranked list</span>
                  </div>
                </div>
              )}
              {/* Title */}
              {rankId ? (
                <Link href={`/rank/${rankId}`}>
                  <h3 className="font-semibold text-gray-900 hover:text-purple-700 cursor-pointer leading-snug mb-2">{rankTitle}</h3>
                </Link>
              ) : (
                <h3 className="font-semibold text-gray-900 leading-snug mb-2">{rankTitle}</h3>
              )}
              {rankId && (
                <Link href={`/rank/${rankId}`}>
                  <span className="text-xs text-purple-600 font-medium hover:text-purple-800">See full rank →</span>
                </Link>
              )}
            </div>
            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4">
              <button
                onClick={() => setExpandedComments(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(item.id)) newSet.delete(item.id);
                  else newSet.add(item.id);
                  return newSet;
                })}
                className={`flex items-center gap-1.5 text-sm ${expandedComments.has(item.id) ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
              >
                <MessageCircle size={15} />
                <span className="text-xs">{rawPost.comments || 0}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Hot take / question — use UGCGroupCard which has dedicated layouts for these
    if (item.type === 'hot_take' || item.type === 'question') {
      return (
        <div key={`${keyPrefix}-${item.id}`} id={`post-${item.id}`} className="mb-4">
          <UGCGroupCard
            post={item as UGCPost}
            onLike={handleLike}
            isLiked={likedPosts.has(item.id)}
            session={session}
            fetchComments={fetchComments}
            currentUserId={currentAppUserId || undefined}
            onDeletePost={handleDeletePost}
            onAddToList={(media: any) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
          />
        </div>
      );
    }

    // Regular single post
    const post = item as UGCPost;
    return (
      <StandalonePost
        key={`${keyPrefix}-${post.id}`}
        post={post}
        onLike={handleLike}
        onComment={(id) => setActiveCommentPostId(prev => prev === id ? null : id)}

        isLiked={likedPosts.has(post.id)}
        isCommentsActive={activeCommentPostId === post.id}
        onCloseComments={() => setActiveCommentPostId(null)}
        fetchComments={fetchComments}
        onSubmitComment={(id, content) => handleComment(id, undefined, content)}
        isSubmitting={commentMutation.isPending}
        session={session}
        currentUserId={currentAppUserId || undefined}
        onDeleteComment={handleDeleteComment}
        onReportComment={handleReportComment}
        onDeletePost={handleDeletePost}
        onLikeComment={handleLikeComment}
        onAddToList={(media) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
      />
    );
  };

  const renderPostBatchByIndex = (batchIndex: number) => {
    if (selectedFilter !== 'All' && selectedFilter !== 'all') return null;
    const len = mixedFeedSlots.length;
    if (len === 0 || batchIndex >= len) return null;
    const item = slotAssignments.get(batchIndex);
    if (!item) return null;
    return renderFeedItem(item, `batch-${batchIndex}`);
  };

  // Rating carousel posts are now folded into mixedFeedSlots for organic interleaving
  // (play → UGC, play → UGC → UGC, play → UGC …). The hardcoded renderRatingCarousel(0..3)
  // calls in JSX safely return null.
  //
  // ── HOW TO RESTORE HORIZONTAL SWIPE CAROUSEL ───────────────────────────────────────
  // 1. Remove the `return null` below and restore the full function body:
  //
  //   if (selectedFilter !== 'All' && selectedFilter !== 'all') return null;
  //   const carousel = feedRatingCarousels[carouselIndex];
  //   if (!carousel || carousel.posts.length === 0) return null;
  //   return (
  //     <div key={carousel.id} className="mb-2">
  //       <div className="flex items-stretch gap-3 overflow-x-auto pb-1 scrollbar-hide
  //                       snap-x snap-mandatory touch-pan-x
  //                       md:flex-col md:overflow-x-visible md:snap-none md:pb-0 md:items-stretch">
  //         {carousel.posts.map((post: any) => (
  //           <UGCGroupCard key={post.id} post={post} onLike={handleLike}
  //             isLiked={likedPosts.has(post.id)} session={session}
  //             fetchComments={fetchComments} currentUserId={currentAppUserId || undefined}
  //             onDeletePost={handleDeletePost}
  //             onAddToList={(media: any) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
  //             forceNormal={true} />
  //         ))}
  //       </div>
  //       {carousel.posts.length > 1 && (
  //         <div className="flex justify-center gap-1.5 mt-2">
  //           {carousel.posts.map((_: any, i: number) => (
  //             <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300" />
  //           ))}
  //         </div>
  //       )}
  //     </div>
  //   );
  //
  // 2. In mixedFeedSlots, remove the extraUGC / wrapExtra / extra inject block.
  // 3. In renderRemainingPosts, restore: feedRatingCarousels.slice(4).map(...)
  // ───────────────────────────────────────────────────────────────────────────────────
  const renderRatingCarousel = (_carouselIndex: number) => null;


  const renderRemainingPosts = () => {
    if (selectedFilter !== 'All' && selectedFilter !== 'all') return null;
    const remaining = mixedFeedSlots.slice(19);
    if (remaining.length === 0) return null;

    // Collect all promoted posts into up to 3 stacks of up to 5 cards each
    const MAX_PER_STACK = 5;
    const promoted = remaining.filter((item: any) => item?._isPromoted);
    const promotedSet = new Set(promoted.map((item: any) => item._promotedKey));
    const rawStacks: any[][] = [];
    for (let i = 0; i < promoted.length && rawStacks.length < 3; i += MAX_PER_STACK) {
      const chunk = promoted.slice(i, i + MAX_PER_STACK);
      if (chunk.length >= 2) rawStacks.push(chunk);
    }

    // If no valid stacks, render everything normally
    if (rawStacks.length === 0) {
      return <>{remaining.map((item: any, i: number) => renderFeedItem(item, `remaining-${i}`))}</>;
    }

    // Compute insertion indices: evenly spread stacks across the remaining array
    const insertAt = rawStacks.map((_, si) =>
      Math.floor(remaining.length * (si + 1) / (rawStacks.length + 1))
    );

    const output: React.ReactNode[] = [];
    let nextStackSlot = 0;

    remaining.forEach((item: any, i: number) => {
      // Insert any stacks whose position we've reached
      while (nextStackSlot < rawStacks.length && i >= insertAt[nextStackSlot]) {
        const stackKey = `stack-fixed-${nextStackSlot}`;
        output.push(
          <SwipeableCardStack
            key={stackKey}
            posts={rawStacks[nextStackSlot]}
            onLike={handleLike}
            likedPosts={likedPosts}
            session={session}
            fetchComments={fetchComments}
            currentUserId={currentAppUserId || undefined}
            onDeletePost={handleDeletePost}
            onAddToList={(media: any) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
          />
        );
        nextStackSlot++;
      }
      // Render non-promoted items normally; skip individual promoted items (they're in stacks)
      if (!promotedSet.has(item._promotedKey)) {
        output.push(renderFeedItem(item, `remaining-${i}`));
      }
    });

    // Flush any stacks not yet inserted (edge case: short remaining array)
    while (nextStackSlot < rawStacks.length) {
      const stackKey = `stack-fixed-${nextStackSlot}`;
      output.push(
        <SwipeableCardStack
          key={stackKey}
          posts={rawStacks[nextStackSlot]}
          onLike={handleLike}
          likedPosts={likedPosts}
          session={session}
          fetchComments={fetchComments}
          currentUserId={currentAppUserId || undefined}
          onDeletePost={handleDeletePost}
          onAddToList={(media: any) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
        />
      );
      nextStackSlot++;
    }

    return <>{output}</>;
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
    
    // These types always show as standalone feed cards — never treat as consumption
    const alwaysStandaloneTypes = [
      'thought', 'rate-review', 'review', 'reviewed',
      'trivia', 'poll', 'prediction', 'predict', 'vote',
      'ask_for_recs', 'ask_for_rec', 'rank_share', 'media_group', 'cast_approved'
    ];
    if (alwaysStandaloneTypes.includes(postType)) return false;
    
    // Explicit consumption/tracking types - silent tracking activity goes here
    const consumptionTypes = [
      'added_to_list', 'add-to-list', 'added',
      'rate', 'rated',
      'finished', 'consuming', 'progress', 'update', 'started',
      'watched', 'read', 'listening', 'played'
    ];
    if (consumptionTypes.includes(postType)) return true;
    
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
            mediaExternalId: p.mediaItems?.[0]?.externalId || p.externalId,
            mediaExternalSource: p.mediaItems?.[0]?.externalSource || p.externalSource || 'tmdb',
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
        mediaExternalId: p.mediaItems?.[0]?.externalId || p.externalId,
        mediaExternalSource: p.mediaItems?.[0]?.externalSource || p.externalSource || 'tmdb',
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
    
    // Hide truly empty/malformed posts: no content at all, no media, no rating, no list/rank data,
    // and not a special post type (prediction/poll/trivia/rank_share)
    // Note: 'add-to-list' (from track-media) is also a valid type
    const specialTypes = ['prediction', 'predict', 'poll', 'vote', 'trivia', 'rank_share', 'media_group', 'added_to_list', 'add-to-list', 'rewatch', 'ask_for_recs', 'ask_for_rec', 'friend_list_group', 'cast_approved'];
    const isSpecialType = specialTypes.includes(post.type || '');
    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
    const hasListData = !!(post as any).listData;
    const hasRankData = !!(post as any).rankData;
    const hasNoContent = !post.content || post.content.trim().length === 0;
    const hasRating = post.rating && post.rating > 0;
    
    // Only hide posts with zero content AND no media, list, rank data, special type, or rating
    if (hasNoContent && !hasMediaItems && !hasListData && !hasRankData && !isSpecialType && !hasRating) {
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
      const hasMatchingMedia = post.mediaItems.some((media: any) => {
        return detailedFilters.mediaTypes.includes(resolveItemMediaType(media));
      });
      if (!hasMatchingMedia) return false;
    }

    // Apply media category pill filter (Movies, TV, Music, Books, etc.)
    // Only filter regular media posts - skip special types that are rendered separately
    if (selectedCategory) {
      const skipFilterTypes = ['cast_approved', 'prediction', 'predict', 'poll', 'vote', 'trivia', 'rank_share', 'ask_for_recs', 'ask_for_rec', 'friend_list_group'];
      const postType = post.type?.toLowerCase() || '';
      if (!skipFilterTypes.includes(postType)) {
        const allowedTypes = categoryToMediaTypeMap[selectedCategory] || [];
        if (allowedTypes.length > 0) {
          const postMediaType = ((post as any).mediaType || (post as any).media_type || '').toLowerCase();
          const postExternalSource = ((post as any).externalSource || (post as any).external_source || '').toLowerCase();
          const postLevelMatch = allowedTypes.includes(postMediaType) || 
            (selectedCategory === 'movies' && (postMediaType === 'movie' || postMediaType === 'film' || postExternalSource === 'tmdb' || postExternalSource === 'tmdb_movie')) ||
            (selectedCategory === 'tv' && (postMediaType === 'tv' || postExternalSource === 'tmdb_tv')) ||
            (selectedCategory === 'music' && (postMediaType === 'music' || postExternalSource === 'spotify')) ||
            (selectedCategory === 'books' && (postMediaType === 'book' || postExternalSource === 'googlebooks' || postExternalSource === 'open_library'));

          if (post.mediaItems && post.mediaItems.length > 0) {
            const hasMatchingMedia = post.mediaItems.some((media: any) => {
              const resolved = resolveItemMediaType(media);
              return allowedTypes.includes(resolved);
            });
            if (!hasMatchingMedia && !postLevelMatch) return false;
          } else {
            if (!postLevelMatch) return false;
          }
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

      // Get all open games — exclude partner-tagged polls (those belong to specific rooms)
      const { data, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .is('partner_tag', null)
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

  // Fetch clash pools from prediction_pools (type='clash')
  const { data: clashPools = [] } = useQuery({
    queryKey: ['/api/clash-pools', user?.id],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const { data } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'clash')
        .eq('status', 'open')
        .is('partner_tag', null)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!session?.access_token,
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



  const handleReportComment = (commentId: string, userId: string, userName: string) => {
    setReportCommentData({ commentId, userId, userName });
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

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };


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
    <div className="min-h-screen bg-gray-100 pb-32">
      <div id="feed-page">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-3 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-6">
          
          {/* Composer Trigger - dark hero zone */}
          <div>

            <h1 className="text-2xl font-bold text-white mb-6 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Your Turn
            </h1>

            <DailyHeroSection />
            <div className="mt-3">
              <DnaMomentFeaturedCard />
            </div>

          </div>
          
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 pb-6" data-feed-content>

        {/* ── What's Happening ── */}
        {whatHappeningPosts.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">What's Happening</p>
            <div className="space-y-0 divide-y divide-gray-100">
              {whatHappeningPosts.map((post: any) => {
                const name = post.user?.displayName || post.user?.username || 'Someone';
                const avatarLetter = name[0]?.toUpperCase();
                // Media title lives in mediaItems[0].title — post.mediaTitle is not a field social-feed sets
                const mediaTitle = post.mediaItems?.[0]?.title || post.mediaTitle || '';
                const isRating = post.type === 'rating' || post.type === 'rate-review';
                const isPrediction = post.type === 'predict' || post.type === 'prediction';
                const hasContent = post.content && post.content.trim().length > 0;
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 py-3 cursor-pointer active:bg-gray-50 rounded-xl -mx-2 px-2 transition-colors"
                    onClick={() => setWhatsHappeningOpenPost(post)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
                      {post.user?.avatar
                        ? <img src={post.user.avatar} alt={name} className="w-full h-full object-cover" />
                        : <span className="text-white text-sm font-bold">{avatarLetter}</span>
                      }
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* "Name verb MediaTitle" all on one line */}
                      <p className="text-xs text-gray-500 leading-snug truncate">
                        <span className="font-semibold text-gray-800">{name}</span>{' '}
                        <span>{post._verb}</span>
                        {mediaTitle && <span className="font-semibold text-gray-800"> {mediaTitle}</span>}
                      </p>
                      {/* Stars for ratings */}
                      {isRating && post.rating > 0 && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={11} className={s <= Math.round(post.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      )}
                      {isPrediction && post.pointsEarned != null && (
                        <p className="text-[11px] text-violet-500 font-medium mt-0.5">{post.pointsEarned} pts</p>
                      )}
                      {/* Content preview as quote */}
                      {hasContent && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">"{post.content.slice(0, 70)}"</p>
                      )}
                    </div>
                    {/* Timestamp */}
                    <span className="text-[11px] text-gray-400 flex-shrink-0 self-start pt-1">
                      {(() => {
                        const d = new Date(post.timestamp);
                        const diff = Date.now() - d.getTime();
                        const m = Math.floor(diff / 60000);
                        if (m < 60) return `${m}m`;
                        const h = Math.floor(m / 60);
                        if (h < 24) return `${h}h`;
                        return `${Math.floor(h / 24)}d`;
                      })()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Action chips ── */}
        <div className="mb-5">
          <FeedActionChips />
        </div>

        {/* ── Trending Now ── */}
        <TrendingNowSection />

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
        <div className="space-y-3">

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
          ) : (filteredPosts && filteredPosts.length > 0) || ['trivia', 'polls', 'predictions', 'dna', 'challenges', 'All', 'all', 'games'].includes(selectedFilter) ? (
            <div className="space-y-4 pb-24">
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
                          {highlightedPost.user.username && highlightedPost.user.displayName && highlightedPost.user.username !== highlightedPost.user.displayName && (
                            <p className="text-xs text-gray-400 leading-tight">@{highlightedPost.user.username}</p>
                          )}
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
                      <div className="flex items-center gap-1.5 text-sm text-red-400">
                        <Heart size={15} fill={highlightedPost.likes > 0 ? 'currentColor' : 'none'} />
                        <span className="text-xs">{highlightedPost.likes || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-purple-500">
                        <MessageCircle size={15} />
                        <span className="text-xs">{highlightedPost.comments || 0}</span>
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
                      onReportComment={handleReportComment}
                      onLikeComment={handleLikeComment}
                      likedComments={likedComments}
                      onVoteComment={handleVoteComment}
                      commentVotes={commentVotes}
                    />
                  </div>
                </div>
              )}


              {/* === FEED SEQUENCE === */}

              {/* TRIVIA - category-selected views (shown regardless of position) */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'music' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Music" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'books' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Books" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'podcasts' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Podcasts" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && selectedCategory === 'games' && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Gaming" />
              )}

              {/* POLLS - category-selected views */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'music' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Music" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'books' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Books" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'podcasts' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Podcasts" />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && selectedCategory === 'games' && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Gaming" />
              )}

              {/* — BLOCK 1 — */}
              {/* UGC slot #0 — most recent user post */}
              {renderPostBatchByIndex(0)}

              {/* DNA Compare shared post — injected at slot 2 so it's always near the top */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && dnaComparePostsForFeed.length > 0 &&
                renderFeedItem(dnaComparePostsForFeed[0], 'dna-compare-shared')}

              {/* UGC slot #1 — second user post, acts as buffer before DNA Clash */}
              {renderPostBatchByIndex(1)}

              {/* Seen It? — Movies (round 1) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="movie" />
              )}

              {/* DNA Clash card — rotates every 2 days, data from prediction_pools (type='clash') */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (() => {
                // Hardcoded fallback used until DB pools are populated
                const hardcodedMatchups = [
                  {
                    id: null,
                    user1: { displayName: 'Ambiannie', username: 'Ambiannie', userId: '2510625e-8a51-4637-9eb4-4d91ba3e76af', dnaLabel: 'Emotional Sleuth', rating: 5, initials: 'A', color: '#a855f7', votes: 0, quote: 'The Fellowship is the emotional heart of the trilogy. Nothing tops it.', tags: ['Emotional', 'Character-Driven', 'Epic'] },
                    user2: { displayName: 'Kimberly Woods', username: 'KJWoodsEMH', userId: 'fa6d73af-da96-494b-b8ee-33d059bed7d5', dnaLabel: 'Mystery-Loving Escapist', rating: 1, initials: 'KW', color: '#3b82f6', votes: 0, quote: "It's the weakest film because nothing actually happens.", tags: ['Pacing', 'Plot-Driven', 'Overrated'] },
                    mediaTitle: 'The Lord of the Rings: Fellowship of the Ring', mediaType: 'movie', externalId: '120', externalSource: 'tmdb',
                  },
                  {
                    id: null,
                    user1: { displayName: 'Trey', username: 'Trey', userId: '7a7a0c3a-f2a4-47ed-b05d-1daf40d46d40', dnaLabel: 'Drama Devotee', rating: 5, initials: 'T', color: '#a855f7', votes: 0, quote: "Euphoria is cinema. The storytelling and visuals are on another level.", tags: ['Cinematic', 'Raw', 'Emotional'] },
                    user2: { displayName: 'Jordan F.', username: 'Jrgibsongirl', userId: '188feb17-6711-43d4-bf24-b117c377591c', dnaLabel: 'Casual Binger', rating: 2, initials: 'JF', color: '#3b82f6', votes: 0, quote: "Way too dark and stylized for no real payoff. It exhausted me.", tags: ['Overhyped', 'Draining', 'Pretentious'] },
                    mediaTitle: 'Euphoria', mediaType: 'tv', externalId: '85552', externalSource: 'tmdb',
                  },
                  {
                    id: null,
                    user1: { displayName: 'Jeeppler', username: 'Jeeppler', userId: '41849796-014e-414c-ad4f-7fe99bdc69f8', dnaLabel: 'Crime Obsessive', rating: 5, initials: 'J', color: '#a855f7', votes: 0, quote: "The greatest show ever made, period. Walter White is unmatched.", tags: ['Masterpiece', 'Intense', 'Rewatchable'] },
                    user2: { displayName: 'Punkin Pie', username: 'punkinpie123', userId: '561f2c21-69e9-4282-bceb-51146a405ea3', dnaLabel: 'Light & Breezy Fan', rating: 1, initials: 'PP', color: '#3b82f6', votes: 0, quote: "Too slow, too dark, too stressful. I gave up after season 2.", tags: ['Slow', 'Dark', 'Overrated'] },
                    mediaTitle: 'Breaking Bad', mediaType: 'tv', externalId: '1396', externalSource: 'tmdb',
                  },
                  {
                    id: null,
                    user1: { displayName: 'Heidi', username: 'HeidiIsConsumed', userId: '88bfb2a0-e8ce-4081-b731-2a49567ff093', dnaLabel: 'Genre Adventurer', rating: 5, initials: 'H', color: '#a855f7', votes: 0, quote: "Comfort TV at its finest. I've rewatched it four times and still laugh.", tags: ['Comfort', 'Funny', 'Rewatchable'] },
                    user2: { displayName: 'Ambiannie', username: 'Ambiannie', userId: '2510625e-8a51-4637-9eb4-4d91ba3e76af', dnaLabel: 'Emotional Sleuth', rating: 2, initials: 'A', color: '#3b82f6', votes: 0, quote: "The cringe humor is too much. Michael Scott makes me want to look away.", tags: ['Cringe', 'Exhausting', 'Overrated'] },
                    mediaTitle: 'The Office', mediaType: 'tv', externalId: '2316', externalSource: 'tmdb',
                  },
                ];

                const dayIndex = Math.floor(Date.now() / 86400000);

                // Use DB pools if available; fall back to hardcoded
                if (clashPools.length > 0) {
                  const pool = clashPools[Math.floor(dayIndex / 2) % clashPools.length];
                  const opts: any[] = Array.isArray(pool.options) ? pool.options : [];
                  if (opts.length < 2) return null;
                  const [o1, o2] = opts;
                  const u1 = {
                    displayName: o1.displayName || o1.label,
                    username: o1.username || o1.label,
                    userId: o1.userId || o1.user_id || '',
                    dnaLabel: o1.dnaLabel || o1.archetype || '',
                    rating: o1.rating || 0,
                    initials: o1.initials || (o1.displayName || o1.label || '').slice(0, 2).toUpperCase(),
                    color: o1.color || '#a855f7',
                    votes: 0,
                  };
                  const u2 = {
                    displayName: o2.displayName || o2.label,
                    username: o2.username || o2.label,
                    userId: o2.userId || o2.user_id || '',
                    dnaLabel: o2.dnaLabel || o2.archetype || '',
                    rating: o2.rating || 0,
                    initials: o2.initials || (o2.displayName || o2.label || '').slice(0, 2).toUpperCase(),
                    color: o2.color || '#3b82f6',
                    votes: 0,
                  };
                  return (
                    <DnaClashFeedCard
                      key={`clash-${pool.id}`}
                      poolId={pool.id}
                      user1={u1}
                      user2={u2}
                      mediaTitle={pool.media_title || ''}
                      mediaType={pool.media_type || ''}
                      externalId={pool.media_external_id || ''}
                      externalSource={pool.media_external_source || ''}
                      posterUrl={pool.poster_url || pool.media_poster || undefined}
                      currentUserId={effectiveUserId || undefined}
                      session={session}
                      onOptOut={() => {}}
                    />
                  );
                }

                // Fallback: hardcoded matchups (no DB pools yet)
                const clash = hardcodedMatchups[Math.floor(dayIndex / 2) % hardcodedMatchups.length];
                return (
                  <DnaClashFeedCard
                    key={`clash-${clash.mediaTitle}`}
                    user1={clash.user1}
                    user2={clash.user2}
                    mediaTitle={clash.mediaTitle}
                    mediaType={clash.mediaType}
                    externalId={clash.externalId}
                    externalSource={clash.externalSource}
                    posterUrl={(clash as any).posterUrl}
                    currentUserId={effectiveUserId || undefined}
                    session={session}
                    onOptOut={() => {}}
                  />
                );
              })()}

              {/* Movies trivia — round 1 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia' || selectedFilter === 'games') &&
               (!selectedCategory || selectedCategory === 'movies') && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Movies" />
              )}

              {/* UGC slot 7 — between Movies trivia and TV Polls */}
              {renderPostBatchByIndex(7)}

              {/* TV Polls — round 1 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && !selectedCategory && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="TV" />
              )}

              {/* UGC slot 8 — after TV Polls */}
              {renderPostBatchByIndex(8)}

              {/* DNA Moment #1 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'dna') && !selectedCategory && (
                <DnaMomentCard />
              )}

              {/* DNA Compare card */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <DnaCompareFeedCard
                  featured={{ displayName: 'Hillary Hess', initials: 'HH', color: '#6366f1', pct: 42, tagline: 'You both love epic adventures and genre-spanning stories.' }}
                  overlaps={[
                    { displayName: 'Jeeppler', initials: 'J', color: '#a855f7', pct: 38 },
                    { displayName: 'Jordan F.', initials: 'JF', color: '#ec4899', pct: 31 },
                    { displayName: 'Ambiannie', initials: 'A', color: '#f59e0b', pct: 24 },
                  ]}
                />
              )}

              {/* Leaderboard #0 */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && playActivity.length > 0 && (
                <SocialProofCard card={buildLeaderboardSocialProof(playActivity[0], 0)} />
              )}

              {/* Challenge Pools banner #1 */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <ChallengePoolsFeedBanner />
              )}

              {/* Seen It? — TV Shows (round 1) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="tv" />
              )}

              {/* — Rating carousel #0 — */}
              {renderRatingCarousel(0)}

              {/* TV trivia — round 1 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia' || selectedFilter === 'games') &&
               (!selectedCategory || selectedCategory === 'tv') && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="TV" />
              )}

              {/* UGC slot 9 — after TV trivia round 1 */}
              {renderPostBatchByIndex(9)}

              {/* — BLOCK 2 — */}
              {/* Movies Polls */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls' || selectedFilter === 'games') &&
               (!selectedCategory || selectedCategory === 'movies') && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Movies" />
              )}

              {/* UGC slot 10 — after Movies Polls */}
              {renderPostBatchByIndex(10)}

              {/* Books trivia */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Books" />
              )}

              {/* UGC slot 11 — after Books trivia */}
              {renderPostBatchByIndex(11)}

              {/* Leaderboard #1 */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && playActivity.length > 1 && (
                <SocialProofCard card={buildLeaderboardSocialProof(playActivity[1], 1)} />
              )}

              {/* Seen It? — Books (round 1) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="book" />
              )}

              {/* Music trivia */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Music" />
              )}

              {/* UGC slot 12 — after Music trivia */}
              {renderPostBatchByIndex(12)}

              {/* Seen It? — Music (round 1) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="music" />
              )}

              {/* TV Polls — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && !selectedCategory && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="TV" />
              )}

              {/* — Rating carousel #1 — */}
              {renderRatingCarousel(1)}

              {/* — BLOCK 3 — */}
              {/* Play slot #2 */}
              {renderPostBatchByIndex(2)}

              {/* Leaderboard #2 + Points Glimpse */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && playActivity.length > 2 && (
                <SocialProofCard card={buildLeaderboardSocialProof(playActivity[2], 2)} />
              )}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <PointsGlimpse />
              )}

              {/* Movies trivia — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Movies" />
              )}

              {/* UGC slot 13 — after Movies trivia round 2 */}
              {renderPostBatchByIndex(13)}

              {/* Seen It? — Movies (round 2) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="movie" />
              )}

              {/* DNA Moment #2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'dna') && !selectedCategory && (
                <DnaMomentCard />
              )}

              {/* TV trivia — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="TV" />
              )}

              {/* UGC slot 14 — after TV trivia round 2 */}
              {renderPostBatchByIndex(14)}

              {/* Seen It? — TV Shows (round 2) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="tv" />
              )}

              {/* — Rating carousel #2 — */}
              {renderRatingCarousel(2)}

              {/* — BLOCK 4 — */}
              {/* Podcasts trivia */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Podcasts" />
              )}

              {/* UGC slot 15 — after Podcasts trivia */}
              {renderPostBatchByIndex(15)}

              {/* Seen It? — Podcasts (round 1) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="podcast" />
              )}


              {/* Play slot #3 */}
              {renderPostBatchByIndex(3)}

              {/* Leaderboard #3 */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && playActivity.length > 3 && (
                <SocialProofCard card={buildLeaderboardSocialProof(playActivity[3], 3)} />
              )}

              {/* Seen It? — Books (round 2) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="book" />
              )}

              {/* Games trivia */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Gaming" />
              )}

              {/* UGC slot 16 — after Games trivia */}
              {renderPostBatchByIndex(16)}

              {/* Movies Polls — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'polls') && !selectedCategory && (
                <PollsCarousel expanded={selectedFilter === 'polls'} category="Movies" />
              )}

              {/* Challenge Pools banner #2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <ChallengePoolsFeedBanner />
              )}

              {/* — Rating carousel #3 — */}
              {renderRatingCarousel(3)}

              {/* — BLOCK 5 — */}
              {/* Play slot #4 */}
              {renderPostBatchByIndex(4)}

              {/* Books trivia — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Books" />
              )}

              {/* UGC slot 17 — after Books trivia round 2 */}
              {renderPostBatchByIndex(17)}

              {/* Music trivia — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Music" />
              )}

              {/* UGC slot 18 — after Music trivia round 2 */}
              {renderPostBatchByIndex(18)}

              {/* Seen It? — Music (round 2) */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && session && (
                <SeenItGame mediaTypeFilter="music" />
              )}

              {/* Play slot #5 */}
              {renderPostBatchByIndex(5)}

              {/* Challenge Pools banner #3 */}
              {(selectedFilter === 'All' || selectedFilter === 'all') && !selectedCategory && (
                <ChallengePoolsFeedBanner />
              )}

              {/* Podcasts trivia — round 2 */}
              {(selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'trivia') && !selectedCategory && (
                <TriviaCarousel expanded={selectedFilter === 'trivia'} category="Podcasts" />
              )}

              {/* Play slot #6 */}
              {renderPostBatchByIndex(6)}

              {renderRemainingPosts()}

              {/* Social Posts */}
              {(() => {
                const feedData = (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games' || selectedFilter === 'predictions') ? filteredPosts.filter((item: any) => {
                if ('originalPostIds' in item) return true;
                if ((item as any).type === 'friend_activity_block') return true;
                if ((item as any).type === 'consumption_carousel') return false;
                if ((item as any).type === 'swipeable_ratings') return false;
                // Exclude consumed carousel polls — only user-created predict/poll posts belong in the feed
                const itemType = (item as any).type;
                if (itemType === 'poll' || itemType === 'predict' || itemType === 'prediction') {
                  if ((item as any).origin_type !== 'user') return false;
                }
                // Exclude poll-type game moments — "Cast your vote" cards don't belong in the main feed
                if (itemType === 'game_moment') {
                  try {
                    const parsed = JSON.parse(((item as any).content || '').trim());
                    if (parsed.gameType === 'poll') return false;
                  } catch (_) {}
                }
                // In 'All' mode, skip posts already rendered via standaloneUGCPosts to prevent duplicates
                if ((selectedFilter === 'All' || selectedFilter === 'all') && item.id && ugcUsedIds.has(item.id)) return false;
                const post = item as SocialPost;
                return !(post.mediaItems?.length > 0 && post.mediaItems[0]?.title?.toLowerCase().includes("does mary leave"));
              }) : [];
              return feedData.map((item: any, postIndex: number) => {
                // Quick Glimpse cards removed from feed
                if ((item as any).type === 'friend_activity_block') {
                  return null;
                }

                if (false && (item as any).type === '__disabled_friend_activity_block') {
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
                
                // Carousel elements to prepend to any post type
                const carouselElements = (
                  <>
                    {shouldShowPointsAchievements && !isFilterActive && (
                      <div className="mb-4">
                        <PointsAchievementCard cardIndex={Math.floor((postIndex - 3) / 8)} />
                      </div>
                    )}
                  </>
                );
                
                // Predictions are rendered inline via renderPostBatchByIndex in the main feed.
                // Only fall through to render here when the Predictions filter is active (renderPostBatchByIndex is off).
                if ((post.type === 'prediction' || post.type === 'predict') && (post as any).question) {
                  if (selectedFilter !== 'predictions') return null;
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
                    <div key={`prediction-${post.id}`} className="mb-4">
                      <CollaborativePredictionCard prediction={predictionCardData as any} currentUserId={currentAppUserId || undefined} />
                    </div>
                  );
                }

                // User polls are rendered in dedicated carousel higher up in feed
                if (post.type === 'poll' && (post as any).question) {
                  return null;
                }

                if (post.type === 'binge_battle') {
                  return (
                    <div key={`binge-battle-${post.id}`} id={`post-${post.id}`}>
                      <BingeBattleFeedCard
                        post={{
                          id: post.id,
                          content: post.content || '',
                          image_url: (post as any).mediaItems?.[0]?.imageUrl || (post as any).image_url || '',
                          media_title: (post as any).mediaItems?.[0]?.title || (post as any).media_title || '',
                          timestamp: post.timestamp,
                          user: post.user,
                        }}
                        isOwn={post.user?.id === currentAppUserId}
                        onDelete={handleDeletePost}
                      />
                    </div>
                  );
                }

                if (post.type === 'rank_share') {
                  const rankPost = post as any;
                  if (rankPost.rankData) {
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
                            caption={post.content?.startsWith('Check out my ranked list:') ? undefined : post.content || undefined}
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
                  const rankId = rankPost.rankId;
                  const rankTitle = (() => {
                    const content = post.content || rankPost.rankData?.title || '';
                    const prefix = 'Check out my ranked list: ';
                    return content.startsWith(prefix) ? content.slice(prefix.length) : content;
                  })();
                  return (
                    <div key={`rank-stub-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-4">
                            {/* Pills */}
                            <div className="flex items-center gap-2 mb-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full uppercase tracking-wide">RANK</span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Community</span>
                            </div>
                            {/* Author */}
                            {post.user && (
                              <div className="flex items-center gap-2 mb-3">
                                <Link href={`/user/${post.user.id}`}>
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer flex-shrink-0 overflow-hidden">
                                    {post.user.avatar
                                      ? <img src={post.user.avatar} alt="" className="w-full h-full object-cover" />
                                      : (post.user.displayName || post.user.username || '?')[0].toUpperCase()}
                                  </div>
                                </Link>
                                <div>
                                  <Link href={`/user/${post.user.id}`}>
                                    <span className="text-sm font-medium text-gray-900 hover:text-purple-600 cursor-pointer">
                                      {post.user.displayName || post.user.username}
                                    </span>
                                  </Link>
                                  <span className="text-xs text-gray-500 ml-2">shared a ranked list</span>
                                </div>
                              </div>
                            )}
                            {/* Title */}
                            {rankId ? (
                              <Link href={`/rank/${rankId}`}>
                                <h3 className="font-semibold text-gray-900 hover:text-purple-700 cursor-pointer leading-snug mb-2">{rankTitle}</h3>
                              </Link>
                            ) : (
                              <h3 className="font-semibold text-gray-900 leading-snug mb-2">{rankTitle}</h3>
                            )}
                            {rankId && (
                              <Link href={`/rank/${rankId}`}>
                                <span className="text-xs text-purple-600 font-medium hover:text-purple-800">See full rank →</span>
                              </Link>
                            )}
                          </div>
                          {/* Footer */}
                          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4">
                            <button
                              onClick={() => handleLike(post.id)}
                              className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                            >
                              <Heart size={16} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} />
                              <span className="text-xs">{post.likes || 0}</span>
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
                              <span className="text-xs">{post.comments || 0}</span>
                            </button>
                          </div>
                        </div>
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
                                <Link href={`/user/${post.user?.id}`}>
                                  <span className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer">{post.user?.displayName || formatUsername(post.user?.username)}</span>
                                </Link>
                                {post.user?.username && post.user?.displayName && post.user.username !== post.user.displayName && (
                                  <p className="text-xs text-gray-400 leading-tight">@{post.user.username}</p>
                                )}
                                <p className="text-gray-900">{post.content}</p>
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
                      onAddToList={(media) => { setQuickAddMedia(media); setIsQuickAddOpen(true); }}
                    />
                  );
                }

                // cast_approved and game_moment posts are rendered inline via renderPostBatchByIndex — skip here to avoid duplicates
                if (post.type === 'cast_approved' || post.type === 'game_moment') {
                  return null;
                }

                // Also skip posts whose content looks like raw game moment JSON — they leaked through with wrong post_type
                const rawContent = (post as any).content || '';
                if (rawContent.startsWith('{"answer":') || rawContent.startsWith('{"gameType":')) {
                  return null;
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
                            {
                              const mediaTitle = post.mediaItems[0]?.title || '';
                              const prefix = `added ${mediaTitle.toLowerCase()} to `;
                              const listNameFromContent = contentLower.startsWith(prefix)
                                ? post.content!.slice(prefix.length)
                                : null;
                              const actionText = listNameFromContent
                                ? `Added to ${listNameFromContent}`
                                : post.content || `Added to list`;
                              return (
                                <p className="text-sm">
                                  <Link
                                    href={`/user/${post.user.id}`}
                                    className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                    data-testid={`link-user-${post.user.id}`}
                                  >
                                    {post.user.username}
                                  </Link>
                                  <span className="text-gray-500"> {actionText}</span>
                                </p>
                              );
                            }
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
                          className={`flex items-center space-x-2 transition-colors ${activeCommentPostId === realPostId ? 'text-purple-600' : 'text-gray-500 hover:text-blue-500'}`}
                        >
                          <MessageCircle size={18} />
                          <span className="text-sm">{post.comments}</span>
                        </button>
                        {/* Add to library - only for posts with media */}
                        {post.mediaItems && post.mediaItems.length > 0 && (
                          <button
                            onClick={() => {
                              const media = post.mediaItems[0];
                              setQuickAddMedia({
                                title: media.title,
                                mediaType: media.mediaType || 'movie',
                                externalId: media.externalId,
                                externalSource: media.externalSource || 'tmdb',
                                imageUrl: media.imageUrl || '',
                              });
                              setIsQuickAddOpen(true);
                            }}
                            className="flex items-center space-x-1 text-gray-500 hover:text-purple-500 transition-colors"
                            data-testid={`button-add-to-library-${post.id}`}
                            title="Add to library"
                          >
                            <Plus size={18} />
                          </button>
                        )}
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

              {isFetchingNextPage && (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-500 mt-3">Loading more posts...</p>
                </div>
              )}

              {hasNextPage && !isFetchingNextPage && (selectedFilter === 'All' || selectedFilter === 'all' || selectedFilter === 'games') && (
                <div ref={loadMoreRef} className="h-20" />
              )}

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
                      <TriviaCarousel category="Podcasts" />
                      <TriviaCarousel category="Gaming" />
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
                      <TriviaCarousel category="Podcasts" challengesOnly />
                      <TriviaCarousel category="Gaming" challengesOnly />
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
          ) : (mediaTypeFilter !== "all" || selectedCategory) ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">No {
                selectedCategory === 'movies' ? "Movies" :
                selectedCategory === 'tv' ? "TV Shows" :
                selectedCategory === 'music' ? "Music" :
                selectedCategory === 'books' ? "Books" :
                selectedCategory === 'sports' ? "Sports" :
                selectedCategory === 'podcasts' ? "Podcasts" :
                selectedCategory === 'gaming' ? "Gaming" :
                mediaTypeFilter === "movie" ? "Movies" : mediaTypeFilter === "tv" ? "TV Shows" : mediaTypeFilter === "book" ? "Books" : mediaTypeFilter === "music" ? "Music" : mediaTypeFilter === "podcast" ? "Podcasts" : "Gaming"
              } Activity Yet</h3>
              <p className="text-gray-600 max-w-sm mx-auto">
                Try selecting a different category or check back later for updates.
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


      {/* Tiebreaker Rating Sheet — "Who's right?" conflict cards */}
      {activeTiebreaker && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setActiveTiebreaker(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold tracking-widest uppercase text-purple-600">What's Your Take?</p>
              <button onClick={() => setActiveTiebreaker(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Media info */}
            <div className="flex gap-3 items-start mb-4">
              {activeTiebreaker.mediaImage && activeTiebreaker.mediaImage.startsWith('http') && (
                <img
                  src={activeTiebreaker.mediaImage}
                  alt={activeTiebreaker.mediaTitle}
                  className="w-14 h-[84px] rounded-xl object-cover shadow-md flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-base leading-tight mb-3">{activeTiebreaker.mediaTitle}</p>
                {/* The two sides of the conflict */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">{activeTiebreaker.friendAName}</span>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className={s <= Math.floor(activeTiebreaker.friendARating) ? 'text-yellow-400 fill-yellow-400' : s === Math.ceil(activeTiebreaker.friendARating) && activeTiebreaker.friendARating % 1 >= 0.5 ? 'text-yellow-200 fill-yellow-200' : 'text-gray-200'} />
                      ))}
                      <span className="text-[10px] text-gray-500 ml-1">{activeTiebreaker.friendARating}/5</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">{activeTiebreaker.friendBName}</span>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className={s <= Math.floor(activeTiebreaker.friendBRating) ? 'text-yellow-400 fill-yellow-400' : s === Math.ceil(activeTiebreaker.friendBRating) && activeTiebreaker.friendBRating % 1 >= 0.5 ? 'text-yellow-200 fill-yellow-200' : 'text-gray-200'} />
                      ))}
                      <span className="text-[10px] text-gray-500 ml-1">{activeTiebreaker.friendBRating}/5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Star rating or success state */}
            {tiebreakerSubmitted ? (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-0.5 mb-2">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={24} className={s <= Math.floor(tiebreakerRating) ? 'text-yellow-400 fill-yellow-400' : s === Math.ceil(tiebreakerRating) && tiebreakerRating % 1 >= 0.5 ? 'text-yellow-200 fill-yellow-200' : 'text-gray-200'} />
                  ))}
                </div>
                <p className="text-sm font-semibold text-gray-800">You gave it {tiebreakerRating}/5 — verdict in!</p>
                <p className="text-xs text-gray-500 mt-1">Your rating has been added to the feed</p>
                <button onClick={() => setActiveTiebreaker(null)} className="mt-4 bg-purple-600 text-white text-sm font-semibold px-6 py-2 rounded-full">Done</button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 text-center mb-3">Tap a star to cast your vote</p>
                <div className="flex items-center justify-center gap-2 touch-none select-none"
                  onMouseLeave={() => setTiebreakerHover(0)}
                >
                  {[1,2,3,4,5].map(star => {
                    const displayVal = tiebreakerHover || tiebreakerRating;
                    return (
                      <div key={star} className="relative" style={{ width: 44, height: 44 }}>
                        <Star size={44} className="absolute inset-0 text-gray-200" />
                        <div className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                          <Star size={44} className={tiebreakerHover > 0 ? 'fill-yellow-300 text-yellow-300' : 'fill-yellow-400 text-yellow-400'} />
                        </div>
                        <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }}
                          onMouseEnter={() => setTiebreakerHover(star - 0.5)}
                          onClick={() => handleTiebreakerRate(star - 0.5)}
                          aria-label={`Rate ${star - 0.5}`}
                        />
                        <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }}
                          onMouseEnter={() => setTiebreakerHover(star)}
                          onClick={() => handleTiebreakerRate(star)}
                          aria-label={`Rate ${star}`}
                        />
                      </div>
                    );
                  })}
                </div>
                {tiebreakerHover > 0 && (
                  <p className="text-center text-sm text-gray-500 mt-2">{tiebreakerHover}/5</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* What's Happening post detail sheet */}
      {whatsHappeningOpenPost && (
        <PostDetailSheet
          isOpen={!!whatsHappeningOpenPost}
          onClose={() => setWhatsHappeningOpenPost(null)}
          post={(() => {
            // media fields live in mediaItems[0] — not top-level on the post object
            const mi = whatsHappeningOpenPost.mediaItems?.[0];
            return {
              id: whatsHappeningOpenPost.id,
              userId: whatsHappeningOpenPost.userId || whatsHappeningOpenPost.user?.id || '',
              username: whatsHappeningOpenPost.user?.username || '',
              displayName: whatsHappeningOpenPost.user?.displayName,
              avatar: whatsHappeningOpenPost.user?.avatar,
              mediaTitle: mi?.title || whatsHappeningOpenPost.mediaTitle || '',
              mediaType: mi?.mediaType || whatsHappeningOpenPost.mediaType || '',
              mediaImage: mi?.imageUrl || whatsHappeningOpenPost.mediaImage || '',
              mediaExternalId: mi?.externalId || whatsHappeningOpenPost.externalId || '',
              mediaExternalSource: mi?.externalSource || whatsHappeningOpenPost.externalSource || '',
              rating: whatsHappeningOpenPost.rating,
              review: whatsHappeningOpenPost.content,
              timestamp: whatsHappeningOpenPost.timestamp,
            };
          })()}
        />
      )}

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

      {/* Comment Report Sheet */}
      <ReportSheet
        isOpen={reportCommentData !== null}
        onClose={() => setReportCommentData(null)}
        contentType="comment"
        contentId={reportCommentData?.commentId || ''}
        reportedUserId={reportCommentData?.userId || ''}
        reportedUserName={reportCommentData?.userName || ''}
      />

      {/* Feedback Dialog */}
      <FeedbackDialog isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      </div>
    </div>
  );
}