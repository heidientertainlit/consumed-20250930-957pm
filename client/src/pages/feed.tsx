import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import PlayCard from "@/components/play-card";
import GameCarousel from "@/components/game-carousel";
import InlineGameCard from "@/components/inline-game-card";
import MediaCarousel from "@/components/media-carousel";
import { Star, Heart, MessageCircle, Share, ChevronRight, Check, Badge, User, Vote, TrendingUp, Lightbulb, Users, Film, Send, Trash2, MoreVertical, Eye, EyeOff, Plus, ExternalLink, Sparkles, Book, Music, Tv2, Gamepad2, Headphones, Flame, Target, HelpCircle, Activity, ArrowUp, ArrowDown, Forward, Search as SearchIcon, X } from "lucide-react";
import InlineComposer from "@/components/inline-composer";
import CommentsSection from "@/components/comments-section";
import CreatorUpdateCard from "@/components/creator-update-card";
import CollaborativePredictionCard from "@/components/collaborative-prediction-card";
import ConversationsPanel from "@/components/conversations-panel";
import FeedFiltersDialog, { FeedFilters } from "@/components/feed-filters-dialog";
import RankFeedCard from "@/components/rank-feed-card";
import ConsolidatedActivityCard, { ConsolidatedActivity } from "@/components/consolidated-activity-card";
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
  
  // Handle new response format with currentUserId
  if (data && typeof data === 'object' && !Array.isArray(data) && 'posts' in data && 'currentUserId' in data) {
    currentAppUserId = data.currentUserId;
    console.log('📌 Current app user ID set to:', currentAppUserId);
    return data.posts;
  }
  
  // Fallback for old response format (array of posts)
  console.log('⚠️ Using old response format (array)');
  return data;
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
  const [expandedAddRecInput, setExpandedAddRecInput] = useState<Set<string>>(new Set()); // Track recs posts with add input expanded
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const likedPostsInitialized = useRef(false); // Track if we've done initial sync
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set()); // Track liked comments
  const [commentVotes, setCommentVotes] = useState<Map<string, 'up' | 'down'>>(new Map()); // Track user's comment votes
  const [hotTakeVotes, setHotTakeVotes] = useState<Map<string, 'fire' | 'ice'>>(new Map()); // Track user's hot take votes
  const [hotTakeVoteCounts, setHotTakeVoteCounts] = useState<Map<string, { fire: number; ice: number }>>(new Map()); // Track vote counts
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set()); // Track revealed spoiler posts
  const [feedFilter, setFeedFilter] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [detailedFilters, setDetailedFilters] = useState<FeedFilters>({ audience: "everyone", mediaTypes: [], engagementTypes: [] });
  const [inlineRatings, setInlineRatings] = useState<{ [postId: string]: string }>({}); // Track inline ratings
  const [activeInlineRating, setActiveInlineRating] = useState<string | null>(null); // Track which post has inline rating open
  const [currentVerb, setCurrentVerb] = useState("watching");
  const [passItPostId, setPassItPostId] = useState<string | null>(null); // Hot Take "Pass It" modal
  const [passItSearch, setPassItSearch] = useState(""); // Search friends for Pass It
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null); // Selected friend for Pass It
  const [isPassingHotTake, setIsPassingHotTake] = useState(false); // Loading state for passing
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
      // Only stop if we get zero posts - filtering may cause partial pages
      if (lastPage.length === 0) return undefined;
      return allPages.length; // Return the next page number
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single array
  const socialPosts = infinitePosts?.pages.flat() || [];

  // Group same-user activities within 3-hour windows into consolidated cards BY ACTIVITY TYPE
  const TIME_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
  
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
      const isGroupable = (
        postType === 'add-to-list' || 
        postType === 'rating' || 
        postType === 'finished' || 
        postType === 'progress' ||
        postType === 'update'
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

  // Filter posts by detailed filters and feed filter
  const filteredPosts = processedPosts.filter(item => {
    // Skip ConsolidatedActivity items from filtering (they're already processed)
    if ('originalPostIds' in item) return true;
    
    const post = item as SocialPost;
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

  const handleDeletePost = (postId: string) => {
    console.log('🗑️ handleDeletePost called for:', postId);
    if (confirm('Are you sure you want to delete this post?')) {
      console.log('✅ User confirmed delete');
      deletePostMutation.mutate(postId);
    } else {
      console.log('❌ User cancelled delete');
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

  // Hot Take vote mutation with optimistic updates (same pattern as comment votes)
  const hotTakeVoteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: 'fire' | 'ice' }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/hot-take-vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, voteType }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to vote');
      }
      return await response.json();
    },
    onMutate: async ({ postId, voteType }) => {
      const previousVote = hotTakeVotes.get(postId);
      const previousCounts = hotTakeVoteCounts.get(postId) || { fire: 0, ice: 0 };
      
      // Calculate new counts optimistically
      let newCounts = { ...previousCounts };
      if (previousVote === voteType) {
        // Clicking same vote type removes vote
        newCounts[voteType] = Math.max(0, newCounts[voteType] - 1);
      } else {
        // Add vote to new type
        newCounts[voteType] = newCounts[voteType] + 1;
        // If switching votes, remove from previous type
        if (previousVote) {
          newCounts[previousVote] = Math.max(0, newCounts[previousVote] - 1);
        }
      }
      
      // Optimistically update vote state
      setHotTakeVotes(prev => {
        const newMap = new Map(prev);
        if (previousVote === voteType) {
          newMap.delete(postId);
        } else {
          newMap.set(postId, voteType);
        }
        return newMap;
      });
      
      // Optimistically update counts
      setHotTakeVoteCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, newCounts);
        return newMap;
      });
      
      return { previousVote, previousCounts };
    },
    onSuccess: () => {
      // No toast needed - UI already shows the vote count update
    },
    onError: (error, { postId }, context) => {
      console.error('Hot take vote error:', error);
      // Revert optimistic updates
      setHotTakeVotes(prev => {
        const newMap = new Map(prev);
        if (context?.previousVote) {
          newMap.set(postId, context.previousVote);
        } else {
          newMap.delete(postId);
        }
        return newMap;
      });
      setHotTakeVoteCounts(prev => {
        const newMap = new Map(prev);
        if (context?.previousCounts) {
          newMap.set(postId, context.previousCounts);
        }
        return newMap;
      });
      toast({
        title: "Vote Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle Hot Take voting (fire/ice)
  const handleHotTakeVote = (postId: string, voteType: 'fire' | 'ice') => {
    if (!session?.access_token) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to vote.",
        variant: "destructive",
      });
      return;
    }
    hotTakeVoteMutation.mutate({ postId, voteType });
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

      {/* Extended Purple Gradient Section for Composer */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 pb-8 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-6">
          {/* Tagline */}
          <div className="text-center mb-6">
            <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">What's everyone consuming?</h1>
            <p className="text-gray-400 text-sm mt-2">See what everyone is watching, reading, and listening to. Add yours.</p>
          </div>
          
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
            <div className="space-y-4 pb-24">
              {/* Quick Glimpse - Scrolling ticker */}
              {(() => {
                // Extract friend activities from recent posts with media (only regular posts, not grouped)
                const friendActivities = filteredPosts
                  .filter((item): item is SocialPost => !('slides' in item) && !!(item as SocialPost).user && (item as SocialPost).user!.id !== user?.id && !!(item as SocialPost).mediaItems && (item as SocialPost).mediaItems.length > 0)
                  .slice(0, 6)
                  .map((p: SocialPost) => {
                    // Build action text based on rating
                    let action = 'added';
                    if (p.rating !== undefined && p.rating !== null) {
                      action = `gave ${p.mediaItems[0].title} ${p.rating} star${p.rating !== 1 ? 's' : ''}`;
                      return {
                        username: p.user!.username,
                        media: '', // Already included in action
                        action
                      };
                    }
                    return {
                      username: p.user!.username,
                      media: p.mediaItems[0].title,
                      action: 'added'
                    };
                  });
                
                if (friendActivities.length === 0) return null;
                
                return (
                  <div className="bg-purple-50 rounded-2xl p-3 border border-purple-100 shadow-sm overflow-hidden">
                    <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <span>✨</span>
                      Quick Glimpse
                    </p>
                    <div className="h-[60px] overflow-hidden">
                      <div 
                        className="flex flex-col"
                        style={{
                          animation: `scrollVertical ${friendActivities.length * 3}s linear infinite`,
                          '--scroll-distance': `-${friendActivities.length * 20}px`
                        } as React.CSSProperties}
                      >
                        {/* Duplicate for seamless loop */}
                        {[...friendActivities, ...friendActivities].map((activity, idx) => (
                          <div 
                            key={idx}
                            className="h-5 flex items-center text-xs text-gray-700 whitespace-nowrap"
                          >
                            <span className="font-medium truncate">{activity.username}</span>
                            <span className="mx-1 text-gray-500">{activity.action}</span>
                            <span className="truncate">{activity.media}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <style>{`
                      @keyframes scrollVertical {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(calc(var(--scroll-distance))); }
                      }
                    `}</style>
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

              
              {filteredPosts.filter((item: SocialPost | ConsolidatedActivity) => {
                // Filter out incorrectly formatted prediction posts
                if ('originalPostIds' in item) return true; // Keep consolidated activities
                const post = item as SocialPost;
                return !(post.mediaItems?.length > 0 && post.mediaItems[0]?.title?.toLowerCase().includes("does mary leave"));
              }).map((item: SocialPost | ConsolidatedActivity, postIndex: number) => {
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
                
                // Carousel logic FIRST - before any early returns to ensure carousels always render at correct positions
                // Show inline game card every 4 posts (starting at 2nd post)
                const shouldShowInlineGame = postIndex === 1 || (postIndex > 1 && (postIndex - 1) % 4 === 0);
                // Show game carousel every 20 posts (less frequent, for discovery)
                const shouldShowGameCarousel = postIndex === 19 || (postIndex > 19 && (postIndex - 19) % 20 === 0);
                const shouldShowMediaCarousel = (postIndex + 1) % 15 === 0 && postIndex > 0 && !shouldShowGameCarousel && !shouldShowInlineGame;
                
                // Rotate through different carousel types
                const carouselTypes = [
                  { type: 'tv', title: 'Trending in TV', items: trendingTVShows },
                  { type: 'podcast', title: 'Trending in Podcasts', items: trendingPodcasts },
                  { type: 'book', title: 'Trending in Books', items: bestsellerBooks },
                ];
                const carouselIndex = Math.floor((postIndex + 1) / 15) - 1;
                const currentCarousel = carouselTypes[carouselIndex % carouselTypes.length] || carouselTypes[0];
                
                // Calculate which game to show for this inline card position
                const inlineGameIndex = shouldShowInlineGame ? Math.floor(postIndex / 4) : 0;
                
                // Carousel elements to prepend to any post type
                const carouselElements = (
                  <>
                    {shouldShowInlineGame && (
                      <div className="mb-4">
                        <InlineGameCard gameIndex={inlineGameIndex} />
                      </div>
                    )}
                    {shouldShowGameCarousel && (
                      <div className="mb-4">
                        <GameCarousel />
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
                if (post.type === 'prediction' && (post as any).question) {
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

                // Check if this item is a rank_share post
                if (post.type === 'rank_share' && (post as any).rankData) {
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

                // Check if this item is a hot_take post
                if (post.type === 'hot_take') {
                  // Use local state for optimistic updates, fallback to post data
                  const localCounts = hotTakeVoteCounts.get(post.id);
                  const serverCounts = { 
                    fire: (post as any).fireVotes || (post as any).fire_votes || 0, 
                    ice: (post as any).iceVotes || (post as any).ice_votes || 0 
                  };
                  const displayCounts = localCounts || serverCounts;
                  const userHotTakeVote = hotTakeVotes.get(post.id) || (post as any).userHotTakeVote; // 'fire' | 'ice' | null
                  
                  return (
                    <div key={`hot-take-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                          {/* Hot Take Header Strip */}
                          <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 px-4 py-2.5">
                            <p className="text-sm text-white font-medium flex items-center gap-1.5">
                              <span>🔥</span>
                              <span className="font-bold tracking-wide">HOT TAKE</span>
                            </p>
                          </div>
                          
                          {/* Card Body */}
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
                                {post.user.id === user?.id && (
                                  <button
                                    onClick={() => handleDeletePost(post.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    data-testid={`button-delete-hot-take-${post.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            )}
                            
                            {/* Hot Take Content */}
                            <p className="text-lg font-medium text-gray-900 mb-3">{post.content}</p>
                            
                            {/* Media if attached */}
                            {post.mediaItems && post.mediaItems.length > 0 && (
                              <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-lg mb-3">
                                {post.mediaItems[0].imageUrl && (
                                  <img 
                                    src={post.mediaItems[0].imageUrl} 
                                    alt={post.mediaItems[0].title}
                                    className="w-10 h-14 object-cover rounded-md"
                                  />
                                )}
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{post.mediaItems[0].title}</p>
                                  <p className="text-xs text-gray-500 capitalize">{post.mediaItems[0].mediaType}</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Fire/Ice Voting Pills */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleHotTakeVote(post.id, 'fire')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-all ${
                                  userHotTakeVote === 'fire'
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                                data-testid={`button-hot-take-fire-${post.id}`}
                              >
                                <span>🔥</span>
                                <span>{displayCounts.fire}</span>
                              </button>
                              
                              <button
                                onClick={() => handleHotTakeVote(post.id, 'ice')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-all ${
                                  userHotTakeVote === 'ice'
                                    ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                                data-testid={`button-hot-take-ice-${post.id}`}
                              >
                                <span>🧊</span>
                                <span>{displayCounts.ice}</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Bottom Bar with Likes/Comments */}
                          <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-4">
                              {/* Like */}
                              <button
                                onClick={() => handleLike(post.id)}
                                className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                                data-testid={`button-like-${post.id}`}
                              >
                                <Heart size={16} className={likedPosts.has(post.id) ? 'fill-current' : ''} />
                                <span>{post.likes || 0}</span>
                              </button>
                              
                              {/* Comments */}
                              <button
                                onClick={() => setExpandedComments(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(post.id)) newSet.delete(post.id);
                                  else newSet.add(post.id);
                                  return newSet;
                                })}
                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-600"
                                data-testid={`button-comments-${post.id}`}
                              >
                                <MessageCircle size={16} />
                                <span>{post.comments || 0}</span>
                              </button>
                            </div>
                            <span className="text-xs text-gray-400">
                              {post.timestamp ? formatDate(post.timestamp) : 'Today'}
                            </span>
                          </div>
                          
                          {/* Comments Section */}
                          {expandedComments.has(post.id) && (
                            <div className="px-3 pb-3 border-t border-gray-100">
                              <CommentsSection
                                postId={post.id}
                                isExpanded={true}
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
                                    <span className="font-semibold hover:text-purple-600 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
                                  </Link>
                                  {' '}{post.content}
                                </p>
                                <span className="text-xs text-gray-400">{post.timestamp ? formatDate(post.timestamp) : 'Today'}</span>
                              </div>
                            </div>
                            {isOwnPost && (
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                data-testid={`button-delete-rewatch-${post.id}`}
                              >
                                <Trash2 size={16} />
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
                                isExpanded={true}
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
                const listData = (post as any).listData;
                const isCurrentlyPost = listData?.title === 'Currently' && post.mediaItems && post.mediaItems.length > 0;
                
                if (isCurrentlyPost) {
                  const media = post.mediaItems[0];
                  const isOwnPost = user?.id && post.user?.id === user.id;
                  
                  // Determine verb based on media type
                  const getVerb = (mediaType: string | undefined) => {
                    const type = (mediaType || '').toLowerCase();
                    if (type === 'book') return 'reading';
                    if (type === 'tv' || type === 'tv show' || type === 'series') return 'watching';
                    if (type === 'movie') return 'watching';
                    if (type === 'game') return 'playing';
                    if (type === 'podcast') return 'listening to';
                    if (type === 'music') return 'listening to';
                    return 'consuming';
                  };
                  
                  const verb = getVerb(media.mediaType);
                  
                  return (
                    <div key={`currently-${post.id}`} id={`post-${post.id}`}>
                      {carouselElements}
                      <div className="mb-4">
                        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                          {/* Header with user info */}
                          <div className="p-4 pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
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
                                <div>
                                  <p className="text-gray-900">
                                    <Link href={`/user/${post.user?.id}`}>
                                      <span className="font-semibold hover:text-purple-600 cursor-pointer">{post.user?.displayName || post.user?.username}</span>
                                    </Link>
                                    {' '}is currently {verb}...
                                  </p>
                                  <span className="text-xs text-gray-400">{post.timestamp ? formatDate(post.timestamp) : 'Today'}</span>
                                </div>
                              </div>
                              {isOwnPost && (
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  data-testid={`button-delete-currently-${post.id}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Featured media - horizontal layout with smaller poster */}
                          <div className="flex gap-4 px-4 pb-4">
                            <Link href={`/media/${media.mediaType}/${media.externalSource || 'tmdb'}/${media.externalId}`}>
                              <div className="cursor-pointer group flex-shrink-0">
                                {media.imageUrl ? (
                                  <img 
                                    src={media.imageUrl} 
                                    alt={media.title || ''} 
                                    className="w-24 h-36 rounded-lg object-cover shadow-md group-hover:shadow-lg transition-shadow"
                                  />
                                ) : (
                                  <div className="w-24 h-36 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                                    <Film size={24} className="text-purple-300" />
                                  </div>
                                )}
                              </div>
                            </Link>
                            
                            {/* Media info and actions */}
                            <div className="flex-1 min-w-0">
                              <Link href={`/media/${media.mediaType}/${media.externalSource || 'tmdb'}/${media.externalId}`}>
                                <h3 className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer line-clamp-2">{media.title}</h3>
                              </Link>
                              <p className="text-sm text-gray-500 capitalize mb-3">{media.mediaType}</p>
                              
                              {/* Compact actions */}
                              <MediaCardActions media={media} session={session} />
                            </div>
                          </div>
                          
                          {/* Like/Comment actions */}
                          <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-100">
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
                          </div>
                          
                          {/* Comments Section */}
                          {expandedComments.has(post.id) && (
                            <div className="px-4 pb-4 border-t border-gray-100">
                              <CommentsSection
                                postId={post.id}
                                isExpanded={true}
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
                                    onClick={() => handleDeletePost(post.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    data-testid={`button-delete-ask-recs-${post.id}`}
                                  >
                                    <Trash2 size={16} />
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
                            // Post with content about media (thoughts about a specific title)
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
                            // Thoughts post - has content but no media
                            return (
                              <p className="text-sm">
                                <Link 
                                  href={`/user/${post.user.id}`}
                                  className="font-semibold text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
                                  data-testid={`link-user-${post.user.id}`}
                                >
                                  {post.user.username}
                                </Link>
                                <span className="text-gray-500"> added thoughts</span>
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
                          onClick={() => handleDeletePost(post.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          data-testid={`button-delete-post-${post.id}`}
                          title="Delete post"
                        >
                          <Trash2 size={16} />
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
                          {/* Show delete button if current user owns any activity in this post */}
                          {myActivity && (
                            <button
                              onClick={() => handleDeletePost(myActivity.postId)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              data-testid={`button-delete-post-${post.id}`}
                              title="Delete post"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })()
                    )}

                  {/* Post Content - hide "Added..." and "Rated..." content since it's shown in the header */}
                  {(() => {
                    if (!post.content) return null;
                    const contentLower = post.content.toLowerCase();
                    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
                    const isAddedOrRatedPost = (contentLower.startsWith('added ') || contentLower.startsWith('rated ') || contentLower.startsWith('shared ')) && hasMediaItems;
                    
                    if (isAddedOrRatedPost) {
                      return post.rating && post.rating > 0 ? (
                        <div className="mb-2">
                          <div className="flex items-center gap-1">
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
                        </div>
                      ) : null;
                    }
                    
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
                        {/* Show rating stars below review text if post has a rating */}
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
                            <span className="ml-1 text-sm font-semibold text-gray-700">{post.rating}/5</span>
                          </div>
                        )}
                        {/* See more lists link for rate-review posts with list_id */}
                        {post.type === 'rate-review' && (post as any).listId && post.user && (
                          <Link
                            href={`/user/${post.user.id}?tab=lists`}
                            className="text-sm text-purple-600 hover:text-purple-700 transition-colors font-medium mt-2 inline-block"
                            data-testid={`link-see-lists-${post.user.id}`}
                          >
                            See more of {(post.user.username || '').replace(/consumed|IsConsumed/gi, '').trim() || post.user.username}'s lists →
                          </Link>
                        )}
                      </div>
                    );
                  })()}

                  {/* Media Cards */}
                  {/* List Preview Card for added_to_list posts - use content-based detection matching header logic */}
                  {(() => {
                    const hasMediaItems = post.mediaItems && post.mediaItems.length > 0;
                    const contentLower = (post.content || '').toLowerCase();
                    const isAddedPost = contentLower.startsWith('added ') || (!post.content && hasMediaItems && !post.rating);
                    const hasListData = !!(post as any).listData;
                    const isListPost = post.type === 'added_to_list' || (isAddedPost && hasListData) || (post.type === 'rate-review' && hasListData);
                    
                    return isListPost && hasMediaItems ? (
                    <div className="mb-2">
                      <div className="bg-gray-50 rounded-lg p-3">
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
                          
                          {/* List items - use listData.items if available, otherwise use mediaItems as fallback */}
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
                                href={`/list/${(post as any).listId}`}
                                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                              >
                                +{(post as any).listData.totalCount - 3} more →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* See more of user's lists link */}
                      {post.user && (
                        <Link
                          href={`/user/${post.user.id}?tab=lists`}
                          className="text-sm text-purple-600 hover:text-purple-700 transition-colors font-medium mt-2 inline-block"
                          data-testid={`link-see-lists-${post.user.id}`}
                        >
                          See more of {(post.user.username || '').replace(/consumed|IsConsumed/gi, '').trim() || post.user.username}'s lists →
                        </Link>
                      )}
                    </div>
                  ) : post.content && post.mediaItems && post.mediaItems.length > 0 ? (
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
                      
                      {/* See more of user's lists link for posts with media */}
                      {(() => {
                        const contentLower = (post.content || '').toLowerCase();
                        const isAddedPost = post.type === 'added_to_list' || contentLower.startsWith('added ');
                        const isRateReview = post.type === 'rate-review';
                        if (!isAddedPost && !isRateReview) return null;
                        
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
                        
                        const displayName = username.replace(/consumed|IsConsumed/gi, '').trim() || username;
                        
                        return (
                          <Link
                            href={`/user/${userId}?tab=lists`}
                            className="text-sm text-purple-600 hover:text-purple-700 transition-colors font-medium mt-2 inline-block"
                            data-testid={`link-see-lists-${userId}`}
                          >
                            See more of {displayName}'s lists →
                          </Link>
                        );
                      })()}
                    </div>
                  ) : (
                    !post.content && post.mediaItems && post.mediaItems.length > 0 && (
                      <div className="mb-2">
                        {/* Show rating stars if present */}
                        {post.rating && (
                          <div className="text-gray-800 text-sm mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>Rated</span>
                              <span className="font-semibold text-purple-600">{post.mediaItems[0].title}</span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const fillPercent = Math.min(Math.max((post.rating || 0) - (star - 1), 0), 1) * 100;
                                  return (
                                    <span key={star} className="relative inline-block w-3.5 h-3.5">
                                      <Star size={14} className="absolute text-gray-300" />
                                      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                                        <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                      </span>
                                    </span>
                                  );
                                })}
                                <span className="ml-1 text-sm font-medium text-gray-700">{post.rating}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* List Preview Card for posts - show compact format even without listData */}
                        {(post.type === 'added_to_list' || (post.type === 'rate-review' && (post as any).listData)) && post.mediaItems && post.mediaItems.length > 0 ? (
                          <div className="bg-gray-50 rounded-lg p-3 mb-2">
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
                            <div className="w-16 h-20 rounded overflow-hidden flex-shrink-0">
                              <img 
                                src={post.mediaItems[0].imageUrl || getMediaArtwork(post.mediaItems[0].title, post.mediaItems[0].mediaType)}
                                alt={`${post.mediaItems[0].title} artwork`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
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
                            <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
                          </div>
                          
                          {/* Platform badges and actions - use consistent MediaCardActions component */}
                          <MediaCardActions media={post.mediaItems[0]} session={session} />
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

              {/* End of Feed - keep it clean, no message */}
              {!hasNextPage && filteredPosts.length > 0 && (
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

      <FeedbackFooter />

      <ConsumptionTracker
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />

      {/* Pass It Modal for Hot Takes */}
      {passItPostId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Pass It to a Friend</h3>
              <button
                onClick={() => {
                  setPassItPostId(null);
                  setPassItSearch("");
                  setSelectedFriendId(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              {/* Search Input */}
              <div className="relative mb-4">
                <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={passItSearch}
                  onChange={(e) => setPassItSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="input-pass-it-search"
                />
              </div>
              
              {/* Friend List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friendsData.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Add friends to pass Hot Takes! They'll get to defend or drop your take.
                  </p>
                ) : (
                  friendsData
                    .filter((friend: any) => {
                      if (!passItSearch) return true;
                      const searchLower = passItSearch.toLowerCase();
                      return (
                        friend.user_name?.toLowerCase().includes(searchLower) ||
                        friend.display_name?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((friend: any) => (
                      <button
                        key={friend.id}
                        onClick={() => setSelectedFriendId(friend.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          selectedFriendId === friend.id
                            ? 'bg-purple-100 border-2 border-purple-500'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                        data-testid={`button-select-friend-${friend.id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                          {friend.profile_image_url ? (
                            <img src={friend.profile_image_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span>{friend.display_name?.[0]?.toUpperCase() || friend.user_name?.[0]?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-medium text-gray-900">{friend.display_name || friend.user_name}</p>
                          {friend.user_name && friend.display_name && (
                            <p className="text-sm text-gray-500">@{friend.user_name}</p>
                          )}
                        </div>
                        {selectedFriendId === friend.id && (
                          <Check size={20} className="text-purple-600" />
                        )}
                      </button>
                    ))
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={async () => {
                  if (!selectedFriendId || !passItPostId) {
                    toast({
                      title: "Select a Friend",
                      description: "Please select a friend to pass this Hot Take to.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setIsPassingHotTake(true);
                  try {
                    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/pass-hot-take`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        postId: passItPostId,
                        targetUserId: selectedFriendId
                      }),
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to pass Hot Take');
                    }
                    
                    toast({
                      title: "🔥 Hot Take Passed!",
                      description: "Your friend will get a notification to defend or drop it.",
                    });
                    
                    setPassItPostId(null);
                    setPassItSearch("");
                    setSelectedFriendId(null);
                  } catch (error) {
                    console.error('Error passing hot take:', error);
                    toast({
                      title: "Failed to Pass",
                      description: "Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsPassingHotTake(false);
                  }
                }}
                disabled={!selectedFriendId || isPassingHotTake}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  selectedFriendId && !isPassingHotTake
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                data-testid="button-pass-it-confirm"
              >
                {isPassingHotTake ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Passing...
                  </span>
                ) : (
                  'Pass This Hot Take'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}