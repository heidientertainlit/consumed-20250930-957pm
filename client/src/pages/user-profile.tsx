import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, useRoute, Link } from "wouter";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ListShareModal from "@/components/list-share-modal";
import FriendsManager from "@/components/friends-manager";
import CreateRankDialog from "@/components/create-rank-dialog";
import CreateListDialog from "@/components/create-list-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star, User, Users, MessageCircle, Share, Play, BookOpen, Music, Film, Tv, Trophy, Heart, Plus, Settings, Calendar, TrendingUp, Clock, Headphones, Sparkles, Brain, Share2, ChevronDown, ChevronUp, CornerUpRight, RefreshCw, Loader2, ChevronLeft, ChevronRight, List, Search, X, LogOut, Mic, Gamepad2, Lock, Upload, HelpCircle, Medal, Flame, Target, BarChart3, Edit2, MoreHorizontal, Activity } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { copyLink } from "@/lib/share";
import { AuthModal } from "@/components/auth";
import { queryClient } from "@/lib/queryClient";
import { DNALevelBadge, DNAFeatureLock } from "@/components/dna-level-badge";
import { FriendDNAComparison } from "@/components/friend-dna-comparison";
import { FriendDNACompareButton } from "@/components/friend-dna-comparison";
import { CurrentlyConsumingCard } from "@/components/currently-consuming-card";

export default function UserProfile() {
  const { user, session, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Get user ID from URL using wouter's useRoute
  // Support both /user/:id and /me routes
  const [userMatch, userParams] = useRoute('/user/:id');
  const [meMatch] = useRoute('/me');
  
  // If we're on /me or params.id is "profile" or not set, use current user's ID (own profile)
  // Otherwise use the ID from the URL
  const viewingUserId = (userMatch && userParams?.id && userParams.id !== 'profile') 
    ? userParams.id 
    : user?.id;
  const isOwnProfile = meMatch || !userParams?.id || userParams.id === 'profile' || viewingUserId === user?.id;
  
  // Track if route is still resolving to prevent showing wrong profile
  // Must wait for BOTH userMatch AND userParams.id to be available
  const isRouteResolving = location.startsWith('/user/') && (!userMatch || !userParams?.id);

  // Store return URL for redirect after login
  useEffect(() => {
    if (!user && !loading && userParams?.id) {
      // Store the profile URL they're trying to visit
      sessionStorage.setItem('returnUrl', `/user/${userParams.id}`);
    }
  }, [user, loading, userParams?.id]);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isDNAExpanded, setIsDNAExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedListForShare, setSelectedListForShare] = useState<{name: string, items: number, isPublic: boolean} | null>(null);
  const [isDNASurveyOpen, setIsDNASurveyOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false); // Added state for highlight modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Add Friend states
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'friends' | 'pending_sent' | 'pending_received' | 'loading'>('loading');

  // Public profile - no restrictions for viewing
  const canViewProfile = true; // Always true for now - will add privacy settings later

  // Entertainment DNA states
  const [dnaProfileStatus, setDnaProfileStatus] = useState<'no_profile' | 'has_profile' | 'generating'>('no_profile');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [dnaProfile, setDnaProfile] = useState<any>(null);
  
  // DNA Level states (0=No Survey, 1=DNA Summary (10+ items), 2=Friend Compare (30+ items))
  const [dnaLevel, setDnaLevel] = useState<0 | 1 | 2>(0);
  const [dnaItemCount, setDnaItemCount] = useState(0);
  const [isLoadingDnaLevel, setIsLoadingDnaLevel] = useState(false);
  
  // Tracked genre analysis states
  const [trackedGenres, setTrackedGenres] = useState<Record<string, number>>({});
  const [isLoadingTrackedGenres, setIsLoadingTrackedGenres] = useState(false);
  const [trackedGenresLoaded, setTrackedGenresLoaded] = useState(false);

  // Survey states
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<{ questionId: string; answer: string | string[] }[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // User lists states
  const [userLists, setUserLists] = useState<any[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [userRanks, setUserRanks] = useState<any[]>([]);
  const [isLoadingRanks, setIsLoadingRanks] = useState(false);
  const [showCreateRankDialog, setShowCreateRankDialog] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  
  // Ref to track current fetch request to prevent stale data
  const currentFetchUserIdRef = useRef<string | null>(null);

  // User stats states
  const [userStats, setUserStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // User points states
  const [userPoints, setUserPoints] = useState<any>(null);
  const [userRank, setUserRank] = useState<{ global: number; total_users: number } | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);

  // User profile data from custom users table
  const [userProfileData, setUserProfileData] = useState<any>(null);

  // Game predictions states
  const [userPredictionsList, setUserPredictionsList] = useState<any[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [showAllGameHistory, setShowAllGameHistory] = useState(false);

  // Media History filters
  const [mediaHistorySearch, setMediaHistorySearch] = useState("");
  const [mediaHistoryYear, setMediaHistoryYear] = useState("all");
  const [mediaHistoryMonth, setMediaHistoryMonth] = useState("all");
  const [mediaHistoryType, setMediaHistoryType] = useState("all");
  const [mediaHistoryRating, setMediaHistoryRating] = useState("all");
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'year' | 'month' | 'type' | null>(null);
  const [showAllMediaHistory, setShowAllMediaHistory] = useState(false);

  // Import media modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Highlights state
  const [highlights, setHighlights] = useState<any[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);

  // Badges state
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);

  // DNA Recommendations state
  const [dnaRecommendations, setDnaRecommendations] = useState<any[]>([]);
  const [isDnaRecsLoading, setIsDnaRecsLoading] = useState(false);
  const [isDnaRecsGenerating, setIsDnaRecsGenerating] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [ratingStars, setRatingStars] = useState<Record<string, boolean>>({});
  const [hoveredStar, setHoveredStar] = useState<Record<string, number | null>>({});

  // Creator search states
  const [creatorSearchQuery, setCreatorSearchQuery] = useState("");
  const [creatorSearchResults, setCreatorSearchResults] = useState<any[]>([]);
  const [isSearchingCreators, setIsSearchingCreators] = useState(false);
  
  // Followed creators state
  const [followedCreators, setFollowedCreators] = useState<any[]>([]);
  const [isLoadingFollowedCreators, setIsLoadingFollowedCreators] = useState(false);
  const [isFollowingCreator, setIsFollowingCreator] = useState<string | null>(null);

  // Section navigation refs and state
  const statsRef = useRef<HTMLDivElement>(null);
  const dnaRef = useRef<HTMLDivElement>(null);
  const friendsRef = useRef<HTMLDivElement>(null);
  const listsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>('stats');
  const [collectionsSubTab, setCollectionsSubTab] = useState<'lists'>('lists');
  const [activitySubFilter, setActivitySubFilter] = useState<'all' | 'history' | 'ratings' | 'posts' | 'games' | 'bets'>('all');
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  
  // Bets state
  const [userBets, setUserBets] = useState<any[]>([]);
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  const [betsTab, setBetsTab] = useState<'placed' | 'received'>('placed');
  const [openFilter, setOpenFilter] = useState<'type' | 'year' | 'rating' | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportHelpOpen, setIsImportHelpOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Fetch highlights from Supabase
  const fetchHighlights = async () => {
    if (!session?.access_token || !viewingUserId) return;

    setIsLoadingHighlights(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/user-highlights?user_id=${viewingUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHighlights(data.highlights || []);
        console.log('Highlights loaded:', data.highlights);
      } else {
        console.error('Failed to fetch highlights');
        setHighlights([]);
      }
    } catch (error) {
      console.error('Error fetching highlights:', error);
      setHighlights([]);
    } finally {
      setIsLoadingHighlights(false);
    }
  };

  // Fetch user badges
  const fetchBadges = async () => {
    if (!viewingUserId) return;

    setIsLoadingBadges(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-badges?user_id=${viewingUserId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setUserBadges(data.badges || []);
      } else {
        console.error('Failed to fetch badges');
        setUserBadges([]);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
      setUserBadges([]);
    } finally {
      setIsLoadingBadges(false);
    }
  };

  // Fetch user bets
  const fetchBets = async (type: 'placed' | 'received' = 'placed') => {
    if (!session?.access_token || !isOwnProfile) return;

    setIsLoadingBets(true);
    try {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-bets?type=${type}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUserBets(data.bets || []);
      } else {
        console.error('Failed to fetch bets');
        setUserBets([]);
      }
    } catch (error) {
      console.error('Error fetching bets:', error);
      setUserBets([]);
    } finally {
      setIsLoadingBets(false);
    }
  };

  // Calculate DNA Level from local stats (fallback when edge function isn't deployed)
  // Level 0 = No survey, Level 1 = Survey + 10 items (DNA Summary), Level 2 = Survey + 30 items (Friend Compare)
  const calculateDnaLevelFromStats = (stats: typeof userStats, hasSurvey: boolean) => {
    if (!stats) return { level: 0 as const, itemCount: 0 };
    
    const totalItems = (stats.moviesWatched || 0) + (stats.tvShowsWatched || 0) + 
                       (stats.booksRead || 0) + (stats.gamesPlayed || 0);
    
    if (!hasSurvey) return { level: 0 as const, itemCount: totalItems };
    
    let level: 0 | 1 | 2 = 0;
    if (totalItems >= 30) level = 2;
    else if (totalItems >= 10) level = 1;
    
    return { level, itemCount: totalItems };
  };

  // Fetch DNA Level (calculates level based on logged items)
  const fetchDnaLevel = async () => {
    if (!viewingUserId) return;

    setIsLoadingDnaLevel(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-dna-level?user_id=${viewingUserId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        // Use new 2-level system: 0=No Survey, 1=DNA Summary (10+), 2=Friend Compare (30+)
        const hasSurvey = dnaProfileStatus === 'has_profile';
        const itemsLogged = data.items_logged || 0;
        let newLevel: 0 | 1 | 2 = 0;
        if (hasSurvey && itemsLogged >= 30) newLevel = 2;
        else if (hasSurvey && itemsLogged >= 10) newLevel = 1;
        setDnaLevel(newLevel);
        setDnaItemCount(itemsLogged);
      } else {
        // Fallback: calculate from local stats
        const hasSurvey = dnaProfileStatus === 'has_profile';
        const { level, itemCount } = calculateDnaLevelFromStats(userStats, hasSurvey);
        setDnaLevel(level);
        setDnaItemCount(itemCount);
      }
    } catch (error) {
      console.error('Error fetching DNA level:', error);
      // Fallback: calculate from local stats
      const hasSurvey = dnaProfileStatus === 'has_profile';
      const { level, itemCount } = calculateDnaLevelFromStats(userStats, hasSurvey);
      setDnaLevel(level);
      setDnaItemCount(itemCount);
    } finally {
      setIsLoadingDnaLevel(false);
    }
  };

  // Add highlight to Supabase
  const addHighlight = async (media: any) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/user-highlights', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: media.title,
          creator: media.creator || '',
          media_type: media.type || media.media_type || 'mixed',
          image_url: media.image || media.image_url || null,
          description: media.description || null,
          external_id: media.external_id || null,
          external_source: media.external_source || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({ 
          title: "Highlight Added!", 
          description: `Added "${media.title}" to your highlights` 
        });
        // Refresh highlights from server
        fetchHighlights();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Add Highlight",
          description: error.error || "Unable to add highlight",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error adding highlight:', error);
      toast({
        title: "Error",
        description: "An error occurred while adding highlight",
        variant: "destructive"
      });
    }
  };

  // Delete highlight from Supabase
  const deleteHighlight = async (highlightId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/user-highlights?id=${highlightId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({ 
          title: "Highlight Removed", 
          description: "Highlight removed successfully" 
        });
        // Refresh highlights from server
        fetchHighlights();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Remove Highlight",
          description: error.error || "Unable to remove highlight",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting highlight:', error);
      toast({
        title: "Error",
        description: "An error occurred while removing highlight",
        variant: "destructive"
      });
    }
  };

  // Fetch DNA-based recommendations
  const fetchDNARecommendations = async () => {
    if (!session?.access_token || dnaProfileStatus !== 'has_profile') return;

    setIsDnaRecsLoading(true);
    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-recommendations", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDnaRecommendations(data.recommendations || []);
        setIsDnaRecsGenerating(data.isGenerating || false);
      }
    } catch (error) {
      console.error('Error fetching DNA recommendations:', error);
    } finally {
      setIsDnaRecsLoading(false);
    }
  };

  // Add to list mutation
  const addDNARecommendationMutation = useMutation({
    mutationFn: async ({ recommendation, listType }: { recommendation: any; listType: string }) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      const isCustomList = userLists.some((list: any) => list.id === listType && list.isCustom);
      const endpoint = isCustomList 
        ? "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-to-custom-list"
        : "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          media: {
            title: recommendation.title,
            mediaType: recommendation.media_type,
            creator: recommendation.creator,
            imageUrl: recommendation.image_url,
            externalId: recommendation.external_id,
            externalSource: recommendation.external_source,
            description: recommendation.description,
          },
          rating: null,
          review: null,
          ...(isCustomList ? { customListId: listType } : { listType: listType }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Add recommendation error response:', response.status, errorText);
        throw new Error(`Failed to add recommendation: ${response.status} - ${errorText}`);
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      const listTitle = data.listTitle || 'list';
      toast({
        title: "Added to list!",
        description: `${variables.recommendation.title} added to ${listTitle}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'], exact: true });
      fetchUserLists(); // Refresh lists
    },
    onError: (error) => {
      toast({
        title: "Failed to add recommendation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Rate recommendation mutation
  const rateDNARecommendationMutation = useMutation({
    mutationFn: async ({ recommendation, rating }: { recommendation: any; rating: number }) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/rate-media', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          media_external_id: recommendation.external_id,
          media_external_source: recommendation.external_source,
          media_title: recommendation.title,
          media_type: recommendation.media_type || recommendation.type,
          rating: rating,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rate item');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Rating submitted!",
        description: `You rated ${variables.recommendation.title} ${variables.rating} stars.`,
      });
      const uniqueId = `${variables.recommendation.external_source}-${variables.recommendation.external_id}`;
      setRatingStars(prev => ({ ...prev, [uniqueId]: false }));
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update progress mutation for Currently Consuming items
  const updateProgressMutation = useMutation({
    mutationFn: async ({ itemId, progress, total, mode, progressDisplay }: { itemId: string; progress: number; total?: number; mode: string; progressDisplay: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            progress,
            progress_total: total,
            progress_mode: mode,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to update progress');
      return { ...await response.json(), progressDisplay };
    },
    onSuccess: (data) => {
      toast({ title: `Progress updated to ${data.progressDisplay}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchUserLists(viewingUserId);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    },
  });

  // Move item to different list mutation
  const moveToListMutation = useMutation({
    mutationFn: async ({ itemId, targetList, listName }: { itemId: string; targetList: string; listName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/move-item-to-list',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            target_list: targetList,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to move item');
      }
      return { ...await response.json(), listName };
    },
    onSuccess: (data) => {
      toast({ title: `Moved to ${data.listName}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchUserLists(viewingUserId);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move item", variant: "destructive" });
    },
  });

  // Media search states for highlights
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["All Media"]);

  // Categories for media search
  const categories = ["All Media", "Movies", "TV Shows", "Books", "Music", "Podcasts", "Games", "Sports", "YouTube"];

  // Search mutation using React Query pattern
  const searchMutation = {
    isPending: false,
    mutate: async () => {
      // Search functionality will be implemented
    }
  };

  // Perform search function
  const performSearch = async () => {
    if (!searchQuery.trim() || !session?.access_token) return;

    try {
      setSearchResults([]);
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          type: selectedCategories.includes("All Media") ? null : 
                selectedCategories.includes("Movies") ? "movie" :
                selectedCategories.includes("TV Shows") ? "tv" :
                selectedCategories.includes("Books") ? "book" :
                selectedCategories.includes("Music") ? "music" :
                selectedCategories.includes("Podcasts") ? "podcast" :
                selectedCategories.includes("Games") ? "game" :
                selectedCategories.includes("Sports") ? "sports" :
                selectedCategories.includes("YouTube") ? "youtube" : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        console.error('Search failed:', response.status);
        toast({
          title: "Search Failed",
          description: "Unable to search for media. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Auto-search as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 500); // 500ms delay after user stops typing

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategories]);

  // Auto-search creators as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (creatorSearchQuery.trim()) {
        searchCreators(creatorSearchQuery);
      } else {
        setCreatorSearchResults([]);
      }
    }, 500); // 500ms delay after user stops typing

    return () => clearTimeout(timer);
  }, [creatorSearchQuery]);

  // Search for friends
  const searchFriends = async (query: string) => {
    if (!query || query.length < 2 || !session?.access_token) {
      setFriendSearchResults([]);
      return;
    }

    setIsSearchingFriends(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'searchUsers',
          query: query
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFriendSearchResults(data.users || []);
      } else {
        toast({
          title: "Search Failed",
          description: "Unable to search for users.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Friend search error:', error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingFriends(false);
    }
  };

  // Search for creators
  const searchCreators = async (query: string) => {
    if (!query || query.trim().length < 2 || !session?.access_token) {
      setCreatorSearchResults([]);
      return;
    }

    setIsSearchingCreators(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/search-creators', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setCreatorSearchResults(data.results || []);
      } else {
        console.error('Creator search failed:', response.status);
      }
    } catch (error) {
      console.error('Creator search error:', error);
    } finally {
      setIsSearchingCreators(false);
    }
  };

  // Fetch followed creators
  const fetchFollowedCreators = async () => {
    if (!session?.access_token) return;

    setIsLoadingFollowedCreators(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }
        }
      );

      const { data, error } = await supabase
        .from('followed_creators')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching followed creators:', error);
      } else {
        setFollowedCreators(data || []);
      }
    } catch (error) {
      console.error('Error fetching followed creators:', error);
    } finally {
      setIsLoadingFollowedCreators(false);
    }
  };

  // Follow or unfollow a creator
  const handleFollowCreator = async (creator: any, action: 'follow' | 'unfollow') => {
    if (!session?.access_token) return;

    const creatorKey = `${creator.external_source}-${creator.external_id}`;
    setIsFollowingCreator(creatorKey);

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/follow-creator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          creatorName: creator.name,
          creatorRole: creator.role,
          creatorImage: creator.image || null,
          externalId: creator.external_id,
          externalSource: creator.external_source
        })
      });

      if (response.ok) {
        toast({
          title: action === 'follow' ? "Following!" : "Unfollowed",
          description: action === 'follow' 
            ? `You're now following ${creator.name}` 
            : `You unfollowed ${creator.name}`,
        });
        // Refresh the followed creators list
        fetchFollowedCreators();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Unable to update following status.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error following/unfollowing creator:', error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsFollowingCreator(null);
    }
  };

  // Helper to check if a creator is already followed
  const isCreatorFollowed = (creator: any) => {
    return followedCreators.some(fc => 
      fc.external_id === creator.external_id && 
      fc.external_source === creator.external_source
    );
  };

  // Send friend request
  const sendFriendRequest = async (friendId: string) => {
    if (!session?.access_token) return;

    setIsSendingRequest(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendRequest',
          friendId: friendId
        })
      });

      if (response.ok) {
        toast({
          title: "Request Sent!",
          description: "Friend request sent successfully.",
        });
        // Clear search results and close modal
        setFriendSearchResults([]);
        setFriendSearchQuery("");
        setIsAddFriendModalOpen(false);
        // Refresh friendship status
        checkFriendshipStatus();
      } else {
        const data = await response.json();
        toast({
          title: "Request Failed",
          description: data.error || "Unable to send friend request.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Send friend request error:', error);
      toast({
        title: "Request Error",
        description: "An error occurred while sending request.",
        variant: "destructive"
      });
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Check friendship status
  const checkFriendshipStatus = async () => {
    if (!session?.access_token || !viewingUserId || isOwnProfile) {
      setFriendshipStatus('none');
      return;
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        }
      );

      // Check if they're already friends (accepted status)
      const { data: friendships, error: friendsError } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', user?.id)
        .eq('friend_id', viewingUserId)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('Error checking friendships:', friendsError);
        setFriendshipStatus('none');
        return;
      }

      if (friendships && friendships.length > 0) {
        setFriendshipStatus('friends');
        return;
      }

      // Check if there's a pending request I sent
      const { data: sentRequests, error: sentError } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', user?.id)
        .eq('friend_id', viewingUserId)
        .eq('status', 'pending');

      if (sentError) {
        console.error('Error checking sent requests:', sentError);
      }

      if (sentRequests && sentRequests.length > 0) {
        setFriendshipStatus('pending_sent');
        return;
      }

      // Check if there's a pending request they sent me
      const { data: receivedRequests, error: receivedError } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', viewingUserId)
        .eq('friend_id', user?.id)
        .eq('status', 'pending');

      if (receivedError) {
        console.error('Error checking received requests:', receivedError);
      }

      if (receivedRequests && receivedRequests.length > 0) {
        setFriendshipStatus('pending_received');
        return;
      }

      // No relationship exists
      setFriendshipStatus('none');
    } catch (error) {
      console.error('Error checking friendship status:', error);
      setFriendshipStatus('none');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown-container')) {
        setOpenFilterDropdown(null);
      }
    };

    if (openFilterDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openFilterDropdown]);

  // Fetch user profile data from custom users table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!session?.access_token || !viewingUserId) return;

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        // Retry logic for newly created users
        let retries = 3;
        let data = null;
        let error = null;

        while (retries > 0 && !data) {
          const result = await supabase
            .from('users')
            .select('user_name, first_name, last_name')
            .eq('id', viewingUserId)
            .single();

          data = result.data;
          error = result.error;

          if (error || !data) {
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (!error && data) {
          console.log('✅ User profile data loaded successfully:', data);
          setUserProfileData(data);
        } else {
          console.error('❌ Failed to load user profile after retries:', error);
          console.log('User ID being queried:', viewingUserId);
          console.log('Auth user metadata:', user?.user_metadata);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [session?.access_token, viewingUserId]);

  // Clear state when switching profiles to avoid showing stale data
  useEffect(() => {
    // Reset all profile-specific state when viewingUserId changes
    setUserLists([]);
    setUserRanks([]);
    setUserStats(null);
    setUserPoints(null);
    setDnaProfile(null);
    setDnaProfileStatus('no_profile');
    setDnaLevel(0);
    setDnaItemCount(0);
    setHighlights([]);
    setUserBadges([]);
    setFriendshipStatus('loading');
  }, [viewingUserId]);

  // Fetch profile data - accessible to everyone (public profiles)
  // Wait until route is resolved before fetching to prevent wrong data
  useEffect(() => {
    if (session?.access_token && viewingUserId && !isRouteResolving) {
      // Pass viewingUserId explicitly to avoid stale closure issues
      fetchDnaProfile();
      fetchUserLists(viewingUserId);
      fetchUserRanks(viewingUserId);
      fetchUserStats();
      fetchUserPoints();
      fetchUserPredictions();
      fetchHighlights();
      fetchBadges();
      fetchDnaLevel();
      if (isOwnProfile) {
        fetchFollowedCreators();
      }
      if (!isOwnProfile) {
        checkFriendshipStatus();
      }
    }
  }, [session?.access_token, viewingUserId, isRouteResolving]);

  // Fetch DNA recommendations when DNA profile exists
  useEffect(() => {
    if (session?.access_token && dnaProfileStatus === 'has_profile' && isOwnProfile) {
      fetchDNARecommendations();
    }
  }, [session?.access_token, dnaProfileStatus, isOwnProfile]);

  // Update DNA level from local stats when userStats loads (always prefer higher count)
  useEffect(() => {
    if (userStats) {
      const hasSurvey = dnaProfileStatus === 'has_profile';
      const { level, itemCount } = calculateDnaLevelFromStats(userStats, hasSurvey);
      // Always use local calculation if it's higher (more accurate than edge function)
      if (itemCount > dnaItemCount) {
        setDnaLevel(level);
        setDnaItemCount(itemCount);
      }
    }
  }, [userStats, dnaItemCount, dnaProfileStatus]);

  // Reset tracked genres when viewing a different user or when lists change
  useEffect(() => {
    setTrackedGenres({});
    setTrackedGenresLoaded(false);
  }, [viewingUserId]);

  // Fetch bets when switching to the bets filter or changing bets tab
  useEffect(() => {
    if (activitySubFilter === 'bets' && isOwnProfile && session?.access_token) {
      fetchBets(betsTab);
    }
  }, [activitySubFilter, betsTab, isOwnProfile]);

  // Create a stable fingerprint of list items to detect any changes (not just length)
  const listItemsFingerprint = useMemo(() => {
    const items = userLists.flatMap(list => 
      (list.items || []).map(item => `${item.id}-${item.media_id}-${item.updated_at || ''}`)
    );
    return items.sort().join('|');
  }, [userLists]);

  // Recompute tracked genres when list items change (including swaps/edits, not just length)
  useEffect(() => {
    if (trackedGenresLoaded && listItemsFingerprint.length > 0) {
      // Reset to trigger re-fetch when list contents change
      setTrackedGenresLoaded(false);
    }
  }, [listItemsFingerprint]);

  // Fetch tracked genres when userLists loads (for genre comparison in DNA card)
  useEffect(() => {
    if (userLists.length > 0 && !trackedGenresLoaded && !isLoadingTrackedGenres && dnaProfileStatus === 'has_profile') {
      fetchTrackedGenres();
    }
  }, [userLists, trackedGenresLoaded, isLoadingTrackedGenres, dnaProfileStatus]);

  // Handle URL tab parameter to switch to specific tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab) {
      // Map 'lists' to 'collections' for backward compatibility
      const validTabs = ['stats', 'dna', 'badges', 'friends', 'collections', 'activity'];
      const normalizedTab = tab === 'lists' ? 'collections' : tab;
      if (validTabs.includes(normalizedTab)) {
        setActiveSection(normalizedTab);
      }
    }
  }, []);

  // Handle save profile
  const handleSaveProfile = async () => {
    if (!session?.access_token || !user) {
      toast({
        title: "Error",
        description: "You must be logged in to edit your profile",
        variant: "destructive"
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      // Update users table (only first/last name - username is permanent)
      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: editFirstName || null,
          last_name: editLastName || null
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        toast({
          title: "Update Failed",
          description: "Failed to update profile. Please try again.",
          variant: "destructive"
        });
        setIsSavingProfile(false);
        return;
      }

      // Update local state with new profile data (keep existing username)
      setUserProfileData({
        user_name: editUsername,
        first_name: editFirstName || null,
        last_name: editLastName || null
      });

      // Success!
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully"
      });

      // Close modal - no reload needed!
      setIsEditProfileOpen(false);

    } catch (error) {
      console.error('Save profile error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Fetch user lists from Supabase edge function
  const fetchUserLists = async (targetUserId?: string) => {
    const userId = targetUserId || viewingUserId;
    if (!session?.access_token || !userId) return;

    // Track which user we're fetching for to prevent stale data
    currentFetchUserIdRef.current = userId;
    console.log('🔄 FETCHING LISTS for userId:', userId);
    setIsLoadingLists(true);
    try {
      const url = `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${userId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      // Check if this is still the current request before updating state
      if (currentFetchUserIdRef.current !== userId) {
        console.log('⏭️ Skipping stale lists response for', userId, '- current is', currentFetchUserIdRef.current);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Lists loaded for', userId, '- count:', data.lists?.length);
        setUserLists(data.lists || []);
      } else {
        console.error('Failed to fetch user lists');
        setUserLists([]);
      }
    } catch (error) {
      console.error('Error fetching user lists:', error);
      if (currentFetchUserIdRef.current === userId) {
        setUserLists([]);
      }
    } finally {
      if (currentFetchUserIdRef.current === userId) {
        setIsLoadingLists(false);
      }
    }
  };

  // Fetch user ranks from Supabase edge function
  const fetchUserRanks = async (targetUserId?: string) => {
    const userId = targetUserId || viewingUserId;
    if (!session?.access_token || !userId) return;

    setIsLoadingRanks(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserRanks(data.ranks || []);
        console.log('User ranks loaded for', userId, ':', data.ranks?.length);
      } else {
        console.error('Failed to fetch user ranks');
        setUserRanks([]);
      }
    } catch (error) {
      console.error('Error fetching user ranks:', error);
      setUserRanks([]);
    } finally {
      setIsLoadingRanks(false);
    }
  };

  // Fetch user stats from Supabase edge function
  const fetchUserStats = async () => {
    if (!session?.access_token || !viewingUserId) return;

    setIsLoadingStats(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-stats?user_id=${viewingUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
        console.log('User stats loaded:', data.stats);
      } else {
        console.error('Failed to fetch user stats');
        setUserStats(null);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setUserStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch tracked genres from media items (analyzes movie/TV genres from TMDB)
  const fetchTrackedGenres = async () => {
    if (!session?.access_token || trackedGenresLoaded || isLoadingTrackedGenres) return;
    if (userLists.length === 0) return;
    
    setIsLoadingTrackedGenres(true);
    try {
      // Get unique movie/TV items with TMDB external IDs
      const allItems: any[] = [];
      const seenIds = new Set<string>();
      
      userLists.forEach(list => {
        if (list.items) {
          list.items.forEach((item: any) => {
            const key = item.external_id || item.media_id;
            if (!seenIds.has(key) && (item.media_type === 'movie' || item.media_type === 'tv') && item.external_id) {
              seenIds.add(key);
              allItems.push(item);
            }
          });
        }
      });
      
      // Limit to top 30 items to avoid too many API calls
      const itemsToFetch = allItems.slice(0, 30);
      
      if (itemsToFetch.length === 0) {
        setTrackedGenresLoaded(true);
        setIsLoadingTrackedGenres(false);
        return;
      }
      
      const genreCounts: Record<string, number> = {};
      
      // Fetch genres in parallel batches of 5
      const batchSize = 5;
      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            try {
              const source = item.external_source || 'tmdb';
              const response = await fetch(
                `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${source}&external_id=${item.external_id}&media_type=${item.media_type}`,
                {
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              
              if (response.ok) {
                const data = await response.json();
                return data.genres || [];
              }
              return [];
            } catch {
              return [];
            }
          })
        );
        
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const value = result.value;
            // Verify we have an array before iterating
            if (!Array.isArray(value)) {
              console.warn('Unexpected genre response (not array):', value);
              return;
            }
            value.forEach((genre: any) => {
              // Handle both string genres and object genres with multiple possible keys
              let genreName: string | null = null;
              if (typeof genre === 'string') {
                genreName = genre;
              } else if (genre && typeof genre === 'object') {
                // Try multiple common keys for genre name
                genreName = genre.name ?? genre.genre ?? genre.label ?? null;
                if (!genreName) {
                  console.warn('Unknown genre object shape:', genre);
                }
              }
              if (genreName && typeof genreName === 'string' && genreName !== '[object Object]') {
                genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
              }
            });
          }
        });
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < itemsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      setTrackedGenres(genreCounts);
      setTrackedGenresLoaded(true);
      console.log('Tracked genres loaded:', genreCounts);
    } catch (error) {
      console.error('Error fetching tracked genres:', error);
    } finally {
      setIsLoadingTrackedGenres(false);
    }
  };

  // Fetch user points from Supabase edge function
  const fetchUserPoints = async () => {
    if (!session?.access_token || !viewingUserId) return;

    setIsLoadingPoints(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-user-points?user_id=${viewingUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserPoints(data.points);
        setUserRank(data.rank || null);
        console.log('User points loaded:', data.points, 'Rank:', data.rank);
      } else {
        console.error('Failed to fetch user points');
        setUserPoints(null);
        setUserRank(null);
      }
    } catch (error) {
      console.error('Error fetching user points:', error);
      setUserPoints(null);
      setUserRank(null);
    } finally {
      setIsLoadingPoints(false);
    }
  };

  // Fetch user predictions from Supabase database
  const fetchUserPredictions = async () => {
    if (!session?.access_token || !viewingUserId) return;

    setIsLoadingPredictions(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data, error } = await supabase
        .from('user_predictions')
        .select(`
          pool_id, 
          prediction, 
          points_earned,
          created_at,
          prediction_pools (
            id,
            title,
            type,
            category
          )
        `)
        .eq('user_id', viewingUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user predictions:', error);
        setUserPredictionsList([]);
      } else {
        setUserPredictionsList(data || []);
        console.log('User predictions loaded:', data);
      }
    } catch (error) {
      console.error('Error fetching user predictions:', error);
      setUserPredictionsList([]);
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  // Fetch survey questions from database
  const fetchSurveyQuestions = async () => {
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/rest/v1/edna_questions?select=*&order=display_order.asc', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const questions = await response.json();
        setSurveyQuestions(questions);
        return true;
      } else {
        console.error('Failed to fetch survey questions');
        return false;
      }
    } catch (error) {
      console.error('Error fetching survey questions:', error);
      return false;
    }
  };

  // Fetch DNA profile from database
  const fetchDnaProfile = async () => {
    if (!session?.access_token || !viewingUserId) return;

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      const { data: profiles, error } = await supabase
        .from('dna_profiles')
        .select('*')
        .eq('user_id', viewingUserId);

      if (error) {
        console.error('Error fetching DNA profile:', error);
        setDnaProfileStatus('no_profile');
        return;
      }

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        setDnaProfile(profile);
        setDnaProfileStatus('has_profile');
        console.log('DNA profile loaded:', profile);
      } else {
        setDnaProfileStatus('no_profile');
      }
    } catch (error) {
      console.error('Failed to fetch DNA profile:', error);
      setDnaProfileStatus('no_profile');
    }
  };

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Helper function to map list titles for display (e.g., "Queue" -> "Want To")
  const getDisplayTitle = (title: string): string => {
    const displayMap: { [key: string]: string } = {
      'Queue': 'Want To',
    };
    return displayMap[title] || title;
  };


  const handleShareList = (listName: string, itemCount: number, isPublic: boolean) => {
    setSelectedListForShare({ name: listName, items: itemCount, isPublic });
    setShareModalOpen(true);
  };

  // Share list using unified helper
  const handleShareListDirect = async (listId: string, listTitle: string) => {
    try {
      const listSlug = listTitle.toLowerCase().replace(/\s+/g, '-');
      const userId = session?.user?.id || profileUser?.id;
      
      console.log('Sharing list:', { listId, listTitle, listSlug, userId });
      
      await copyLink({
        kind: 'list',
        obj: { id: listSlug, user_id: userId }
      });

      toast({
        title: "List Link Copied!",
        description: "Share this with your friends to show your entertainment list",
      });
    } catch (error) {
      console.error('Error sharing list:', error);
      toast({
        title: "Share Failed",
        description: "Unable to create share link",
        variant: "destructive"
      });
    }
  };

  const handleCreateList = () => {
    // For now, show a toast - this can be expanded to open a create list modal
    toast({
      title: "Create List",
      description: "List creation feature coming soon!",
    });
  };

  const handleListClick = (listName: string) => {
    const listId = listName.toLowerCase().replace(/\s+/g, '-');
    // Include user parameter when viewing someone else's profile
    const userParam = !isOwnProfile && viewingUserId ? `?user=${viewingUserId}` : '';
    setLocation(`/list/${listId}${userParam}`);
  };

  // Handle file upload for media import
  const handleFileUpload = async () => {
    if (!uploadFile || !session?.access_token) {
      toast({
        title: "Error",
        description: "Please select a file and ensure you're logged in",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/import-media", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Import failed: ${errorText}`);
      }

      const result = await response.json();

      toast({
        title: "Import successful!",
        description: `Imported ${result.imported} items${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
      });

      // Refresh lists
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchUserLists();

      // Close modal and reset
      setIsUploadModalOpen(false);
      setUploadFile(null);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import media",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.zip')) {
        toast({
          title: "Invalid file",
          description: "Please select a CSV or ZIP file",
          variant: "destructive",
        });
        return;
      }
      setUploadFile(file);
    }
  };

  // Entertainment DNA API Functions
  const submitSurveyResponses = async (responses: { questionId: string; answer: string }[]) => {

    console.log('Auth session check:', { hasSession: !!session, hasToken: !!session?.access_token });
    console.log('Session details:', session ? { user: session.user?.id, token_length: session.access_token?.length } : 'No session');

    if (!session?.access_token) {
      console.log('No authentication token - using mock submission for now');
      // For now, mock the submission and proceed with profile generation
      return responses.map(r => ({ success: true, questionId: r.questionId, answer: r.answer }));
    }

    // Submit each response individually to match edge function structure
    const results = [];
    for (const { questionId, answer } of responses) {
      try {
        console.log(`Submitting to edge function for question ${questionId}:`, { questionId, answer: answer.substring(0, 50) + '...' });

        const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/dna-survey-responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            user_id: session.user?.id,
            question_id: questionId, 
            answer_text: answer 
          }),
        });

        console.log(`Edge function response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Edge function error ${response.status}:`, errorText);
          throw new Error(`Failed to submit survey response: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const responseData = await response.json();
        console.log('Edge function success:', responseData);
        results.push(responseData);
      } catch (error) {
        console.error(`Error submitting response for question ${questionId}:`, error);
        throw error;
      }
    }

    return results;
  };

  const generateDNAProfile = async () => {

    console.log('Generating DNA profile...');

    if (!session?.access_token) {
      console.log('No authentication token - using mock profile generation');
      // Mock DNA profile generation for now
      return {
        success: true,
        profile: {
          id: 'mock-profile-123',
          profile_text: 'Based on your responses, you are an Entertainment Explorer! You love discovering new content through recommendations and enjoy diverse genres. Your entertainment choices are driven by emotional connection and you actively engage in discussions about what you consume.',
          favorite_genres: ['Action', 'Comedy', 'Drama'],
          personality_type: 'Explorer',
          created_at: new Date().toISOString()
        }
      };
    }

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-dna-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: session.user?.id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DNA generation failed ${response.status}:`, errorText);
        throw new Error(`Failed to generate profile: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error generating DNA profile:', error);
      throw error;
    }
  };

  const fetchDNAProfile = async () => {
    if (!session?.access_token || !viewingUserId) {
      console.log('No session or viewing user ID available');
      setDnaProfileStatus('no_profile');
      return;
    }

    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-public-dna?user_id=${viewingUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('No DNA profile found for user');
          setDnaProfileStatus('no_profile');
          setDnaProfile(null);
          return;
        }
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('DNA Profile fetched successfully:', data);
      setDnaProfile(data);
      setDnaProfileStatus('has_profile');
    } catch (error) {
      console.error('Error fetching DNA profile:', error);
      setDnaProfileStatus('no_profile');
      setDnaProfile(null);
    }
  };

  const handleTakeDNASurvey = async () => {
    // Check if user is authenticated
    if (!user || !session) {
      setIsAuthModalOpen(true);
      return;
    }

    setCurrentQuestion(0);
    setSurveyAnswers([]);
    setIsLoadingQuestions(true);
    setIsDNASurveyOpen(true); // Open modal first to show loading

    const success = await fetchSurveyQuestions();
    setIsLoadingQuestions(false);

    if (!success) {
      setIsDNASurveyOpen(false); // Close if failed to load
    }
  };

  // Survey navigation functions
  const handleSurveyAnswer = (value: string | string[]) => {
    const currentQ = surveyQuestions[currentQuestion];
    if (!currentQ) return;

    const newAnswers = surveyAnswers.filter(a => a.questionId !== currentQ.id);
    newAnswers.push({
      questionId: currentQ.id,
      answer: value
    });
    setSurveyAnswers(newAnswers);
  };

  const handleSurveyNext = async () => {
    if (currentQuestion < surveyQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Survey complete - submit to edge functions
      try {
        console.log('Survey completed with answers:', surveyAnswers);

        // Convert answers to the format expected by edge functions
        const formattedAnswers = surveyAnswers.map(answer => ({
          questionId: answer.questionId,
          answer: Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer
        }));

        console.log('Formatted answers for submission:', formattedAnswers);

        await submitSurveyResponses(formattedAnswers);
        setIsDNASurveyOpen(false);
        await handleGenerateDNAProfile();
      } catch (error) {
        console.error('Failed to complete survey:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Survey submission failed: ${error.message || 'Unknown error'}. Please try again.`);
      }
    }
  };

  const handleSurveyPrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const getCurrentSurveyAnswer = () => {
    const currentQ = surveyQuestions[currentQuestion];
    if (!currentQ) return undefined;
    return surveyAnswers.find(a => a.questionId === currentQ.id)?.answer;
  };

  const handleGenerateDNAProfile = async () => {
    // Check if user is authenticated
    if (!user || !session) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsGeneratingProfile(true);
    setDnaProfileStatus('generating');

    try {
      await generateDNAProfile();
      console.log("DNA Profile generated successfully");
      // Refresh the profile data from the database
      await fetchDNAProfile();
    } catch (error) {
      console.error("Failed to generate DNA profile:", error);
      setDnaProfileStatus('no_profile');
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleRetakeDNASurvey = () => {
    setDnaProfileStatus('no_profile');
  };

  const handleDownloadDNA = async () => {
    if (!dnaProfile) {
      toast({
        title: "Cannot Download",
        description: "Generate your Entertainment DNA first",
        variant: "destructive"
      });
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Instagram Story size (1080 x 1920)
      canvas.width = 1080;
      canvas.height = 1920;

      // Background: Blue to Purple gradient (matching Canva design)
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1e40af'); // blue-700
      gradient.addColorStop(1, '#a855f7'); // purple-500
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Function to complete the drawing
      const completeDrawing = () => {
        // Top text: "My Entertainment DNA"
        ctx.fillStyle = 'white';
        ctx.font = 'bold 52px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('My Entertainment DNA', canvas.width / 2, 90);

        // "by consumed" text
        ctx.font = 'italic 48px Poppins, sans-serif';
        ctx.fillText('by consumed', canvas.width / 2, 145);

        // White rounded rectangle content area (fits in Instagram story)
        ctx.fillStyle = 'white';
        ctx.roundRect(58, 188, canvas.width - 116, 1400, 30);
        ctx.fill();

        // DNA Label (use actual label from profile, centered in white box)
        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 50px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dnaProfile.label || 'Your DNA Profile', canvas.width / 2, 290);

        // Tagline (with more spacing below label)
        ctx.fillStyle = '#6b7280';
        ctx.font = 'italic 28px Poppins, sans-serif';
        const tagline = dnaProfile.tagline || '';
        const wrappedTagline = tagline.length > 50 ? tagline.substring(0, 47) + '...' : tagline;
        ctx.fillText(wrappedTagline, canvas.width / 2, 345);

        // Divider line
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(120, 390);
        ctx.lineTo(canvas.width - 120, 390);
        ctx.stroke();

        // Profile text (wrapped, left-aligned, more spacing from divider)
        ctx.fillStyle = '#374151';
        ctx.font = '30px Poppins, sans-serif';
        ctx.textAlign = 'left';
        const maxWidth = canvas.width - 200;
        const lineHeight = 46;
        const words = (dnaProfile.profile_text || '').split(' ');
        let line = '';
        let y = 450;
        const maxTextY = 1100; // Leave room for all sections below

        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, 100, y);
            line = words[i] + ' ';
            y += lineHeight;
            if (y > maxTextY) break;
          } else {
            line = testLine;
          }
        }
        // Always try to render the last line if we haven't exceeded the limit
        if (line.trim() && y <= maxTextY) {
          ctx.fillText(line, 100, y);
        }

        // Additional sections below profile text (generous spacing)
        let sectionY = y + 60;

        // Favorite Genres section
        if (dnaProfile.favorite_genres && dnaProfile.favorite_genres.length > 0) {
          ctx.fillStyle = '#374151';
          ctx.font = 'bold 28px Poppins, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Favorite Genres', 100, sectionY);
          sectionY += 35;

          // Genre badges (larger)
          const genres = dnaProfile.favorite_genres.slice(0, 9);
          let badgeX = 100;
          let badgeY = sectionY;
          genres.forEach((genre: string) => {
            ctx.font = 'bold 16px Poppins, sans-serif';
            const badgeWidth = ctx.measureText(genre).width + 36;
            if (badgeX + badgeWidth > canvas.width - 100) {
              badgeX = 100;
              badgeY += 50;
            }
            ctx.beginPath();
            ctx.fillStyle = '#ede9fe';
            ctx.roundRect(badgeX, badgeY, badgeWidth, 38, 18);
            ctx.fill();
            ctx.fillStyle = '#7c3aed';
            ctx.textAlign = 'center';
            ctx.fillText(genre, badgeX + badgeWidth / 2, badgeY + 24);
            badgeX += badgeWidth + 12;
          });
          sectionY = badgeY + 75;
        }

        // Favorite Media Types section
        if (dnaProfile.favorite_media_types && dnaProfile.favorite_media_types.length > 0) {
          ctx.fillStyle = '#374151';
          ctx.font = 'bold 28px Poppins, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Favorite Media Types', 100, sectionY);
          sectionY += 35;

          // Media type badges (larger)
          const mediaTypes = dnaProfile.favorite_media_types.slice(0, 6);
          let badgeX = 100;
          mediaTypes.forEach((type: string) => {
            ctx.font = 'bold 16px Poppins, sans-serif';
            const badgeWidth = ctx.measureText(type).width + 36;
            ctx.beginPath();
            ctx.fillStyle = '#dbeafe';
            ctx.roundRect(badgeX, sectionY, badgeWidth, 38, 18);
            ctx.fill();
            ctx.fillStyle = '#2563eb';
            ctx.textAlign = 'center';
            ctx.fillText(type, badgeX + badgeWidth / 2, sectionY + 24);
            badgeX += badgeWidth + 12;
          });
          sectionY += 75;
        }

        // Favorite Sports section
        if (dnaProfile.favorite_sports && dnaProfile.favorite_sports.length > 0) {
          ctx.fillStyle = '#374151';
          ctx.font = 'bold 28px Poppins, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Favorite Sports', 100, sectionY);
          sectionY += 35;

          // Sports badges (larger)
          const sports = dnaProfile.favorite_sports.slice(0, 4);
          let badgeX = 100;
          sports.forEach((sport: string) => {
            ctx.font = 'bold 16px Poppins, sans-serif';
            const badgeWidth = ctx.measureText(sport).width + 36;
            ctx.beginPath();
            ctx.fillStyle = '#dcfce7';
            ctx.roundRect(badgeX, sectionY, badgeWidth, 38, 18);
            ctx.fill();
            ctx.fillStyle = '#16a34a';
            ctx.textAlign = 'center';
            ctx.fillText(sport, badgeX + badgeWidth / 2, sectionY + 24);
            badgeX += badgeWidth + 12;
          });
          sectionY += 75;
        }

        // Entertainment Style (Flavor notes)
        if (dnaProfile.flavor_notes && dnaProfile.flavor_notes.length > 0) {
          ctx.fillStyle = '#374151';
          ctx.font = 'bold 28px Poppins, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Your Entertainment Style', 100, sectionY);
          sectionY += 35;

          // Style badges (larger)
          const notes = dnaProfile.flavor_notes.slice(0, 3);
          let badgeX = 100;
          notes.forEach((note: string) => {
            ctx.font = 'bold 16px Poppins, sans-serif';
            const badgeWidth = ctx.measureText(note).width + 36;
            ctx.beginPath();
            ctx.fillStyle = '#f3e8ff';
            ctx.roundRect(badgeX, sectionY, badgeWidth, 38, 18);
            ctx.fill();
            ctx.fillStyle = '#a855f7';
            ctx.textAlign = 'center';
            ctx.fillText(note, badgeX + badgeWidth / 2, sectionY + 24);
            badgeX += badgeWidth + 12;
          });
        }

        // Bottom text: "Discover yours" (BELOW the white box)
        ctx.fillStyle = 'white';
        ctx.font = 'italic 40px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Discover yours', canvas.width / 2, 1680);

        // Bottom text: "consumedapp.com" (BELOW the white box)
        ctx.font = 'bold 38px Poppins, sans-serif';
        ctx.fillText('consumedapp.com', canvas.width / 2, 1750);

        // Bottom text: "@consumedapp" 
        ctx.font = 'bold 38px Poppins, sans-serif';
        ctx.fillText('@consumedapp', canvas.width / 2, 1810);

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${userProfileData?.user_name || 'my'}-entertainment-dna.png`;
          a.click();
          URL.revokeObjectURL(url);

          toast({
            title: "DNA Downloaded!",
            description: "Share your Entertainment DNA on social media",
          });
        }, 'image/png');
      };

      // Execute drawing
      completeDrawing();

    } catch (error) {
      console.error('Error downloading DNA:', error);
      toast({
        title: "Download Failed",
        description: "Unable to create DNA image",
        variant: "destructive"
      });
    }
  };

  const handleShareDNAProfile = async () => {
    if (!dnaProfile?.id) {
      toast({
        title: "Cannot Share",
        description: "Generate your Entertainment DNA first",
        variant: "destructive"
      });
      return;
    }

    try {
      // Use the session user ID or profile user ID
      const userId = session?.user?.id || profileUser?.id;
      
      await copyLink({
        kind: 'edna',
        obj: {
          id: userId,
          user_id: userId
        }
      });

      toast({
        title: "DNA Profile Link Copied!",
        description: "Share your Entertainment DNA with friends",
      });
    } catch (error) {
      console.error('Error sharing DNA:', error);
      toast({
        title: "Share Failed",
        description: "Unable to create share link",
        variant: "destructive"
      });
    }
  };


  // Aggregate all media items from all lists for media history
  const getAllMediaItems = () => {
    const allItems: any[] = [];
    const seenItems = new Set<string>(); // Track unique items by media_id
    
    userLists.forEach(list => {
      if (list.items) {
        list.items.forEach((item: any) => {
          // Create a unique key based on media_id (which is unique per item)
          const uniqueKey = item.media_id || `${item.title}-${item.media_type}-${item.creator}`;
          
          // Only add if we haven't seen this item before
          if (!seenItems.has(uniqueKey)) {
            seenItems.add(uniqueKey);
            allItems.push({
              ...item,
              listName: list.title
            });
          }
        });
      }
    });
    // Sort by created_at descending (newest first)
    return allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Get currently consuming items from the "Currently" list
  const currentlyList = userLists.find(list => list.title === 'Currently');
  const currentlyConsuming = currentlyList?.items || [];

  // Filter media history based on search and filters
  const getFilteredMediaHistory = () => {
    const allItems = getAllMediaItems();

    return allItems.filter(item => {
      // Search filter
      if (mediaHistorySearch.trim()) {
        const searchLower = mediaHistorySearch.toLowerCase();
        const matchesSearch = 
          item.title?.toLowerCase().includes(searchLower) ||
          item.creator?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Media type filter
      if (mediaHistoryType !== 'all') {
        const typeMap: any = {
          'movies': 'movie',
          'tv': 'tv',
          'books': 'book',
          'music': 'music',
          'podcasts': 'podcast',
          'games': 'game'
        };
        if (item.media_type !== typeMap[mediaHistoryType]) return false;
      }

      // Year filter
      if (mediaHistoryYear !== 'all') {
        const itemYear = new Date(item.created_at).getFullYear();
        if (itemYear.toString() !== mediaHistoryYear) return false;
      }

      // Month filter
      if (mediaHistoryMonth !== 'all') {
        const itemMonth = new Date(item.created_at).getMonth();
        const monthNumber = parseInt(mediaHistoryMonth);
        if (itemMonth !== monthNumber) return false;
      }

      // Rating filter
      if (mediaHistoryRating !== 'all') {
        const ratingValue = parseFloat(mediaHistoryRating);
        const itemRating = item.rating || 0;
        // Match items with rating >= selected value and < next value
        if (itemRating < ratingValue || itemRating >= ratingValue + 1) return false;
      }

      return true;
    });
  };

  // Get media type counts for summary display
  const getMediaTypeCounts = () => {
    const allItems = getAllMediaItems();
    const counts: any = {
      movie: 0,
      tv: 0,
      book: 0,
      music: 0,
      podcast: 0,
      game: 0
    };

    allItems.forEach(item => {
      if (counts.hasOwnProperty(item.media_type)) {
        counts[item.media_type]++;
      }
    });

    return counts;
  };

  const mediaTypeCounts = getMediaTypeCounts();
  const filteredMediaHistory = getFilteredMediaHistory();

  // Filter label helpers
  const getTypeLabel = () => {
    const labels: any = { all: 'Media Type', movies: 'Movies', tv: 'TV', books: 'Books', music: 'Music', podcasts: 'Podcasts', games: 'Games' };
    return labels[mediaHistoryType] || 'Media Type';
  };
  
  const getYearLabel = () => mediaHistoryYear === 'all' ? 'Year' : mediaHistoryYear;
  
  const getRatingLabel = () => mediaHistoryRating === 'all' ? 'Rating' : `${mediaHistoryRating}★`;

  // Years array for filter dropdown
  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

  // Handle import file
  const handleFileImport = async () => {
    if (!importFile || !session?.access_token) return;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/import-media-history',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Import successful!",
          description: `Imported ${result.imported || 0} items.`,
        });
        setImportFile(null);
        setIsImportModalOpen(false);
        fetchUserLists();
      } else {
        throw new Error('Import failed');
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing your data.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Get media icon for history
  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film size={16} className="text-purple-600" />;
      case 'tv': return <Tv size={16} className="text-pink-600" />;
      case 'book': return <BookOpen size={16} className="text-cyan-600" />;
      case 'music': return <Music size={16} className="text-green-600" />;
      case 'podcast': return <Headphones size={16} className="text-blue-600" />;
      case 'game': return <Gamepad2 size={16} className="text-orange-600" />;
      default: return <Play size={16} className="text-gray-600" />;
    }
  };

  // Calculate "Mostly Into" - top 2 media types by count
  const getMostlyIntoTypes = () => {
    const typeLabels: Record<string, string> = {
      movie: 'Movies',
      tv: 'TV',
      book: 'Books',
      music: 'Music',
      podcast: 'Podcasts',
      game: 'Games'
    };
    
    const sortedTypes = Object.entries(mediaTypeCounts)
      .filter(([_, count]) => (count as number) > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 2)
      .map(([type]) => typeLabels[type] || type);
    
    return sortedTypes;
  };
  
  const mostlyIntoTypes = getMostlyIntoTypes();

  // Generate years and months for filter dropdowns
  const getAvailableYears = () => {
    const allItems = getAllMediaItems();
    const years = new Set(allItems.map(item => new Date(item.created_at).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  };

  const availableYears = getAvailableYears();

  // Calculate total items logged from the 'All' list (which contains all unique items)
  const totalItemsLogged = userLists.find(list => list.id === 'all')?.items?.length || 0;

  // Show loading screen while route is resolving to prevent flash of wrong profile
  if (isRouteResolving) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-purple-600 mx-auto mb-4" size={32} />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />

        <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="relative px-4 pb-6 pt-6">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 bg-gray-200 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <User size={48} className="text-gray-600" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="mt-4 md:mt-0 flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-black mb-1">
                    {userProfileData?.first_name && userProfileData?.last_name 
                      ? `${userProfileData.first_name} ${userProfileData.last_name}`.trim()
                      : userProfileData?.first_name || userProfileData?.user_name || user?.user_metadata?.user_name || user?.user_metadata?.first_name || 'User'}
                  </h1>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-gray-600">
                      @{userProfileData?.user_name || user?.user_metadata?.user_name || (user?.email?.split('@')[0]) || 'user'}
                    </span>
                  </div>

                  {/* Stats Grid - Consistent styling */}
                  <div className="flex flex-col gap-y-2 mt-1">
                    {/* Total Points - Clickable to see breakdown */}
                    {isLoadingPoints ? (
                      <div className="flex items-center space-x-2">
                        <Trophy className="text-amber-500" size={18} />
                        <span className="text-sm text-gray-500">Loading points...</span>
                      </div>
                    ) : userPoints ? (
                      <button
                        onClick={() => setLocation('/points')}
                        className="flex items-center space-x-2 hover:bg-gray-100 -ml-2 px-2 py-1 rounded-lg transition-colors group"
                        data-testid="points-breakdown-link"
                      >
                        <Trophy className="text-amber-500" size={18} />
                        <span className="text-base font-bold text-gray-800">{userPoints.all_time || 0}</span>
                        <span className="text-sm text-gray-600 group-hover:text-purple-600">total points →</span>
                      </button>
                    ) : null}

                    {/* Global Rank - Clickable to leaderboard */}
                    {isOwnProfile && (
                      <Link href="/leaderboard">
                        <div className="flex items-center space-x-2 hover:bg-gray-100 -ml-2 px-2 py-1 rounded-lg transition-colors group cursor-pointer">
                          <Medal className="text-purple-500" size={18} />
                          {userRank ? (
                            <>
                              <span className="text-base font-bold text-gray-800">#{userRank.global}</span>
                              <span className="text-sm text-gray-600 group-hover:text-purple-600">View Leaderboard →</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-600 group-hover:text-purple-600">View Leaderboard →</span>
                          )}
                        </div>
                      </Link>
                    )}
                    {!isOwnProfile && userRank && (
                      <div className="flex items-center space-x-2">
                        <Medal className="text-purple-500" size={18} />
                        <span className="text-base font-bold text-gray-800">#{userRank.global}</span>
                        <span className="text-sm text-gray-600">global rank</span>
                      </div>
                    )}

                    {/* Items Logged - WORKING */}
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="text-blue-500" size={18} />
                      <span className="text-base font-bold text-gray-800">{totalItemsLogged}</span>
                      <span className="text-sm text-gray-600">items logged</span>
                    </div>

                    {/* Mostly Into - Calculated from media type counts */}
                    {mostlyIntoTypes && mostlyIntoTypes.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="text-green-500" size={18} />
                        <span className="text-sm text-gray-600">Mostly Into:</span>
                        <span className="text-sm font-medium text-gray-800">{mostlyIntoTypes.join(', ')}</span>
                      </div>
                    )}

                    {/* Badges Link */}
                    <button
                      onClick={() => setActiveSection('badges')}
                      className="flex items-center space-x-2 hover:bg-gray-100 -ml-2 px-2 py-1 rounded-lg transition-colors group"
                      data-testid="badges-link"
                    >
                      <Medal className="text-rose-500" size={18} />
                      <span className="text-sm text-gray-600 group-hover:text-purple-600">badges →</span>
                    </button>

                    {/* Badges */}
                    {userBadges.length > 0 && (
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <Medal className="text-amber-500" size={18} />
                        <span className="text-sm text-gray-600">Badges:</span>
                        {userBadges.map((badge: any) => (
                          <span 
                            key={badge.id}
                            className="text-sm font-medium px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: `${badge.theme_color}15`,
                              color: badge.theme_color 
                            }}
                            title={badge.description}
                          >
                            {badge.emoji} {badge.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 mt-4 md:mt-0">
                  {isOwnProfile ? (
                    <Button 
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => {
                        setEditUsername(userProfileData?.user_name || '');
                        setEditFirstName(userProfileData?.first_name || '');
                        setEditLastName(userProfileData?.last_name || '');
                        setIsEditProfileOpen(true);
                      }}
                      data-testid="button-edit-profile"
                    >
                      <Settings size={16} className="mr-2" />
                      Edit Profile
                    </Button>
                  ) : null}
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={async () => {
                      const profileUserId = isOwnProfile ? user?.id : viewingUserId;
                      await copyLink({ 
                        kind: 'profile',
                        id: profileUserId
                      });
                      toast({
                        title: "Link Copied!",
                        description: "Share this profile with your friends",
                      });
                    }}
                    data-testid="button-share-profile"
                  >
                    <Share2 size={16} className="mr-2" />
                    Share Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          {userProfileData?.bio && (
            <div className="mt-6">
              <p className="text-gray-700 leading-relaxed">{userProfileData.bio}</p>
            </div>
          )}

          {/* Add Friend Button - Only shown when viewing other users */}
          {!isOwnProfile && (
            <div className="mt-6">
              {!user ? (
                <Button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                  data-testid="button-signin-to-connect"
                >
                  <Users size={20} className="mr-2" />
                  Sign In to Connect
                </Button>
              ) : friendshipStatus !== 'loading' && (
                <>
                  {friendshipStatus === 'friends' ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button 
                        disabled
                        className="bg-gray-300 text-gray-600 rounded-full px-8 py-3 text-base font-semibold cursor-not-allowed"
                        data-testid="button-already-friends"
                      >
                        <Users size={20} className="mr-2" />
                        Already Friends
                      </Button>
                      {viewingUserId && (
                        <FriendDNACompareButton
                          friendId={viewingUserId}
                          friendName={userProfileData?.display_name || userProfileData?.user_name || 'Friend'}
                          friendAvatar={userProfileData?.avatar_url}
                          userDnaLevel={dnaLevel}
                          userItemCount={dnaItemCount}
                          hasSurvey={dnaProfileStatus === 'has_profile'}
                        />
                      )}
                    </div>
                  ) : friendshipStatus === 'pending_sent' ? (
                    <Button 
                      disabled
                      className="bg-gray-300 text-gray-600 rounded-full px-8 py-3 text-base font-semibold cursor-not-allowed"
                      data-testid="button-request-pending"
                    >
                      <Clock size={20} className="mr-2" />
                      Request Pending
                    </Button>
                  ) : friendshipStatus === 'pending_received' ? (
                    <Button 
                      onClick={() => setLocation('/friends')}
                      className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-full px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                      data-testid="button-accept-request"
                    >
                      <Users size={20} className="mr-2" />
                      Accept Friend Request
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => viewingUserId && sendFriendRequest(viewingUserId)}
                      disabled={isSendingRequest || !viewingUserId}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-add-friend"
                    >
                      {isSendingRequest ? (
                        <>
                          <Loader2 size={20} className="mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Users size={20} className="mr-2" />
                          Add Friend
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Currently Consuming - With Full Progress Tracking */}
        {(() => {
          const currentlyList = userLists.find(list => list.title === 'Currently');
          const currentlyItems = currentlyList?.items?.slice(0, 10) || [];
          const firstName = userProfileData?.first_name || userProfileData?.user_name || 'User';
          
          return currentlyItems.length > 0 ? (
            <div className="px-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {firstName} is currently consuming...
              </p>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ width: 'max-content' }}>
                {currentlyItems.map((item: any) => (
                  isOwnProfile ? (
                    <CurrentlyConsumingCard 
                      key={item.id} 
                      item={item}
                      onUpdateProgress={(progress, total, mode, progressDisplay) => {
                        updateProgressMutation.mutate({
                          itemId: item.id,
                          progress,
                          total,
                          mode,
                          progressDisplay
                        });
                      }}
                      onMoveToList={(targetList, listName) => {
                        moveToListMutation.mutate({
                          itemId: item.id,
                          targetList,
                          listName
                        });
                      }}
                      isUpdating={updateProgressMutation.isPending || moveToListMutation.isPending}
                    />
                  ) : (
                    <div
                      key={item.id}
                      className="flex-shrink-0 w-28 cursor-pointer"
                      onClick={() => {
                        const mediaType = item.media_type || 'movie';
                        const source = item.external_source || 'tmdb';
                        const rawId = item.external_id || '';
                        const id = rawId.startsWith('/') ? rawId.substring(1) : rawId;
                        if (id) setLocation(`/media/${mediaType}/${source}/${id}`);
                      }}
                      data-testid={`currently-consuming-${item.id}`}
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 border border-gray-300 hover:border-purple-400 transition-colors">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Film size={24} />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 truncate mt-1 px-0.5">{item.title}</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Section Navigation Pills - Tab-like behavior */}
        <div className="sticky top-16 z-20 bg-gray-50 border-b border-gray-200 px-4 py-3 -mx-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveSection('stats')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === 'stats'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
              data-testid="nav-stats"
            >
              Stats
            </button>
            <button
              onClick={() => setActiveSection('dna')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === 'dna'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
              data-testid="nav-dna"
            >
              DNA
            </button>
            <button
              onClick={() => setActiveSection('badges')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === 'badges'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
              data-testid="nav-badges"
            >
              Badges
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveSection('friends')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === 'friends'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
                data-testid="nav-friends"
              >
                Friends
              </button>
            )}
            {(isOwnProfile || friendshipStatus === 'friends') && (
              <button
                onClick={() => setActiveSection('collections')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === 'collections'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
                data-testid="nav-collections"
              >
                Collections
              </button>
            )}
            {(isOwnProfile || friendshipStatus === 'friends') && (
              <button
                onClick={() => setActiveSection('activity')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === 'activity'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
                data-testid="nav-activity"
              >
                Activity
              </button>
            )}
          </div>
        </div>

        {/* Your Stats */}
        {activeSection === 'stats' && (
        <div ref={statsRef} className="px-4 mb-8">
          <div className="mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em', fontFamily: 'Poppins, sans-serif' }}>{isOwnProfile ? 'Your' : 'Their'} Stats</h3>
            {isLoadingStats ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                  <span className="ml-2 text-gray-600">Loading your stats...</span>
                </div>
              </div>
            ) : userStats ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-700">{userStats.moviesWatched}</div>
                    <div className="text-xs text-gray-600">Movies</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-pink-600">{userStats.tvShowsWatched}</div>
                    <div className="text-xs text-gray-600">TV Shows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-cyan-600">{userStats.booksRead}</div>
                    <div className="text-xs text-gray-600">Books</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{userStats.musicHours}h</div>
                    <div className="text-xs text-gray-600">Music</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{userStats.podcastHours}h</div>
                    <div className="text-xs text-gray-600">Podcasts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">{userStats.gamesPlayed}</div>
                    <div className="text-xs text-gray-600">Games</div>
                  </div>
                </div>

                <div className="flex justify-around border-t border-gray-200 pt-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{userStats.totalHours}h</div>
                    <div className="text-xs text-gray-600">Total Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{userStats.averageRating}</div>
                    <div className="text-xs text-gray-600">Avg Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{userStats.dayStreak}</div>
                    <div className="text-xs text-gray-600">Day Streak</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="text-center text-gray-600">
                  <p>No stats available yet. Start tracking media to see your stats!</p>
                </div>
              </div>
            )}
            
                      </div>
        </div>
        )}

        {/* My Entertainment DNA */}
        {activeSection === 'dna' && (
        <div ref={dnaRef} className="px-4 mb-8">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
            {/* Responsive Header: Stack on mobile, horizontal on larger screens */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="text-white" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-purple-800 to-indigo-900 bg-clip-text text-transparent">
                    {isOwnProfile ? 'Your' : 'Their'} Entertainment DNA
                  </h2>
                  {dnaProfileStatus === 'has_profile' && (
                    <p className="text-sm text-gray-600">{isOwnProfile ? 'Your' : 'Their'} Entertainment Personality</p>
                  )}
                  {dnaProfileStatus === 'no_profile' && isOwnProfile && (
                    <p className="text-sm text-gray-600">Discover your unique entertainment personality</p>
                  )}
                  {dnaProfileStatus === 'no_profile' && !isOwnProfile && (
                    <p className="text-sm text-gray-600">This user hasn't taken the DNA survey yet</p>
                  )}
                  {dnaProfileStatus === 'generating' && (
                    <p className="text-sm text-gray-600">Analyzing entertainment preferences...</p>
                  )}
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {dnaProfileStatus === 'no_profile' && isOwnProfile && (
                  <Button 
                    size="sm"
                    onClick={handleTakeDNASurvey}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                    data-testid="button-take-dna-survey"
                  >
                    <Brain size={14} className="mr-2" />
                    Take DNA Survey
                  </Button>
                )}

                {dnaProfileStatus === 'generating' && (
                  <Button 
                    size="sm"
                    disabled
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white opacity-75"
                  >
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Generating...
                  </Button>
                )}

                {dnaProfileStatus === 'has_profile' && (
                  <>
                    <button
                      onClick={handleRetakeDNASurvey}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors"
                      data-testid="button-retake-dna-survey"
                      aria-label="Retake DNA Survey"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <Button 
                      size="sm"
                      onClick={handleDownloadDNA}
                      className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white"
                      data-testid="button-download-dna"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleShareDNAProfile}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      data-testid="button-share-dna"
                    >
                      <Share2 size={14} className="mr-2" />
                      Share
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Conditional Content based on status */}
            {dnaProfileStatus === 'no_profile' && (
              <div className="bg-white rounded-xl p-6 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Brain className="text-white" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {isOwnProfile ? 'Complete the Survey to Get Your Entertainment DNA' : 'No Entertainment DNA Yet'}
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    {isOwnProfile 
                      ? 'Answer a few quick questions to unlock your unique entertainment personality profile and get personalized recommendations.'
                      : 'This user hasn\'t completed their Entertainment DNA survey yet.'}
                  </p>
                </div>
                {isOwnProfile && (
                  <>
                    <Button 
                      onClick={handleTakeDNASurvey}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8"
                      data-testid="button-start-dna-survey"
                    >
                      <Brain size={16} className="mr-2" />
                      Complete DNA Survey
                    </Button>
                    <p className="text-xs text-gray-500 mt-3">Takes about 2 minutes</p>
                  </>
                )}
              </div>
            )}

            {dnaProfileStatus === 'generating' && (
              <div className="bg-white rounded-xl p-6 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="text-white animate-spin" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Generating Your DNA Profile
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                    Our AI is analyzing your entertainment preferences and creating your unique personality profile...
                  </p>
                  <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">This usually takes 30-60 seconds</p>
                </div>
              </div>
            )}

            {dnaProfileStatus === 'has_profile' && dnaProfile && (
              <div className="bg-white rounded-xl p-6">
                {/* Entertainment DNA Label & Tagline - Always show if we have a profile */}
                <div className="mb-6 text-center">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-800 to-indigo-900 bg-clip-text text-transparent mb-2">
                    {dnaProfile.label || 'Your DNA Profile'}
                  </h3>
                  {dnaProfile.tagline && (
                    <p className="text-gray-600 italic text-lg">
                      {dnaProfile.tagline}
                    </p>
                  )}
                </div>

                {/* Full AI-Generated Description */}
                <div className="mb-6">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {dnaProfile.profile_text || "Your personalized Entertainment DNA profile will appear here."}
                  </p>
                </div>

                {/* DNA Level indicator - simple inline */}
                {isOwnProfile && (
                  <div className="mb-4 flex items-center justify-between">
                    <DNALevelBadge 
                      level={dnaLevel} 
                      itemCount={dnaItemCount} 
                      showProgress={true} 
                    />
                    {dnaLevel === 1 && (
                      <div className="text-right">
                        <span className="text-xs text-purple-600 font-semibold">{dnaItemCount}/30 items</span>
                        <Progress value={(dnaItemCount / 30) * 100} className="h-1.5 w-20 mt-1" />
                      </div>
                    )}
                  </div>
                )}

                {/* DNA-Based Recommendations - Inline */}
                {isOwnProfile && (isDnaRecsLoading || isDnaRecsGenerating || (Array.isArray(dnaRecommendations) && dnaRecommendations.length > 0)) && (
                  <div className="mb-6 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-xl p-4 border border-gray-800/50">
                    <div className="flex items-center mb-3">
                      <Sparkles className="text-purple-400 mr-2" size={18} />
                      <h4 className="text-lg font-bold text-white">For You</h4>
                      {isDnaRecsGenerating && (
                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full animate-pulse border border-blue-500/30">
                          Generating...
                        </span>
                      )}
                    </div>
                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                      {isDnaRecsLoading ? (
                        [...Array(4)].map((_, index) => (
                          <div key={`loading-${index}`} className="flex-shrink-0 w-24">
                            <div className="relative rounded-lg overflow-hidden bg-slate-700 aspect-[2/3] animate-pulse"></div>
                          </div>
                        ))
                      ) : (
                        dnaRecommendations.slice(0, 6).map((rec: any) => {
                          const uniqueId = `${rec.external_source}-${rec.external_id}`;
                          const showFallback = !rec.image_url || imageErrors[uniqueId];
                          return (
                            <div key={uniqueId} className="flex-shrink-0 w-24" data-testid={`dna-rec-inline-${uniqueId}`}>
                              <div className="relative rounded-lg overflow-hidden cursor-pointer aspect-[2/3] bg-slate-800">
                                {showFallback ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 p-2">
                                    <p className="text-white font-bold text-xs text-center line-clamp-2">{rec.title}</p>
                                  </div>
                                ) : (
                                  <img 
                                    src={rec.image_url} 
                                    alt={rec.title}
                                    className="w-full h-full object-cover"
                                    onError={() => setImageErrors(prev => ({ ...prev, [uniqueId]: true }))}
                                  />
                                )}
                              </div>
                              <p className="text-xs text-gray-300 mt-1 line-clamp-1">{rec.title}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Deep Dive Section - Collapsible */}
                <Collapsible>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-purple-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors mb-4">
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <ChevronDown className="h-4 w-4" />
                      Deep Dive: Your Entertainment Breakdown
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4">
                    {/* Media Types: What You Say vs What You Track */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-lg">📊</span> Your Media Breakdown
                      </h5>
                    
                    {/* Survey Preferences */}
                    {(dnaProfile?.favorite_media_types || []).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-2 font-medium">You said you love:</p>
                        <div className="flex flex-wrap gap-2">
                          {(dnaProfile?.favorite_media_types || []).map((type, index) => (
                            <Badge key={index} className="bg-purple-100 text-purple-700 text-xs border border-purple-200">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Actual Tracking Data - use userStats for reliable counts */}
                    {userStats && (
                      <div className={`${(dnaProfile?.favorite_media_types || []).length > 0 ? 'mt-3 pt-3 border-t border-purple-100' : ''}`}>
                        <p className="text-xs text-gray-500 mb-2 font-medium">What you actually track:</p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const trackedData = [
                              { key: 'movie', label: 'Movies', count: userStats.moviesWatched || 0 },
                              { key: 'tv', label: 'TV Shows', count: userStats.tvShowsWatched || 0 },
                              { key: 'book', label: 'Books', count: userStats.booksRead || 0 },
                              { key: 'music', label: 'Music', count: userStats.musicHours || 0, suffix: 'h' },
                              { key: 'podcast', label: 'Podcasts', count: userStats.podcastHours || 0, suffix: 'h' },
                              { key: 'game', label: 'Games', count: userStats.gamesPlayed || 0 },
                            ].filter(item => item.count > 0)
                             .sort((a, b) => b.count - a.count);
                            
                            const surveyTypes = (dnaProfile?.favorite_media_types || []).map(t => t.toLowerCase());
                            
                            return trackedData.map(item => {
                              const isMatch = surveyTypes.some(st => 
                                st.includes(item.key) || item.key.includes(st.replace(/s$/, '')) ||
                                st.includes(item.label.toLowerCase()) || item.label.toLowerCase().includes(st)
                              );
                              return (
                                <Badge 
                                  key={item.key} 
                                  className={`text-xs ${isMatch 
                                    ? 'bg-green-100 text-green-700 border border-green-200' 
                                    : surveyTypes.length > 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}
                                >
                                  {item.label}: {item.count}{item.suffix || ''}
                                  {!isMatch && surveyTypes.length > 0 && item.count > 5 && ' 👀'}
                                </Badge>
                              );
                            });
                          })()}
                        </div>
                        {(() => {
                          const trackedData = [
                            { key: 'movie', label: 'Movies', count: userStats.moviesWatched || 0 },
                            { key: 'tv', label: 'TV Shows', count: userStats.tvShowsWatched || 0 },
                            { key: 'book', label: 'Books', count: userStats.booksRead || 0 },
                            { key: 'game', label: 'Games', count: userStats.gamesPlayed || 0 },
                          ].filter(item => item.count > 0)
                           .sort((a, b) => b.count - a.count);
                          
                          const surveyTypes = (dnaProfile?.favorite_media_types || []).map(t => t.toLowerCase());
                          const topTracked = trackedData[0];
                          
                          if (topTracked && surveyTypes.length > 0) {
                            const isTopInSurvey = surveyTypes.some(st => 
                              st.includes(topTracked.key) || topTracked.key.includes(st.replace(/s$/, '')) ||
                              st.includes(topTracked.label.toLowerCase()) || topTracked.label.toLowerCase().includes(st)
                            );
                            if (!isTopInSurvey && topTracked.count >= 5) {
                              return (
                                <p className="text-xs text-amber-700 mt-2 italic">
                                  💡 You didn't mention {topTracked.label} in your survey, but you've logged {topTracked.count}!
                                </p>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    
                    {/* Loading state */}
                    {!userStats && (
                      <div className="mt-3 pt-3 border-t border-purple-100">
                        <p className="text-xs text-gray-400 italic">Loading your tracking data...</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Favorite Genres - Survey vs Tracked Comparison */}
                  {((dnaProfile?.favorite_genres || []).length > 0 || Object.keys(trackedGenres).length > 0) && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-lg">🎭</span> Your Genre Breakdown
                      </h5>
                      
                      {/* Survey Genres */}
                      {(dnaProfile?.favorite_genres || []).length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-2 font-medium">You said you love:</p>
                          <div className="flex flex-wrap gap-2">
                            {(dnaProfile?.favorite_genres || []).map((genre, index) => (
                              <Badge key={index} className="bg-indigo-100 text-indigo-700 text-xs border border-indigo-200">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Tracked Genres */}
                      {Object.keys(trackedGenres).length > 0 && (
                        <div className={`${(dnaProfile?.favorite_genres || []).length > 0 ? 'mt-3 pt-3 border-t border-indigo-100' : ''}`}>
                          <p className="text-xs text-gray-500 mb-2 font-medium">What you actually watch:</p>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              // Normalize genres for better matching (handle Sci-Fi vs Science Fiction, etc.)
                              const normalizeGenre = (g: string) => {
                                const lower = g.toLowerCase().trim();
                                // Map common variations
                                if (lower === 'sci-fi' || lower === 'science fiction') return 'science fiction';
                                if (lower === 'action & adventure') return 'action';
                                return lower;
                              };
                              const surveyGenres = (dnaProfile?.favorite_genres || []).map(normalizeGenre);
                              
                              return Object.entries(trackedGenres)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 10)
                                .map(([genre, count]) => {
                                  const normalizedTracked = normalizeGenre(genre);
                                  const isMatch = surveyGenres.some(sg => 
                                    sg === normalizedTracked || sg.includes(normalizedTracked) || normalizedTracked.includes(sg)
                                  );
                                  return (
                                    <Badge 
                                      key={genre} 
                                      className={`text-xs ${isMatch 
                                        ? 'bg-green-100 text-green-700 border border-green-200' 
                                        : surveyGenres.length > 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}
                                    >
                                      {genre}: {count}
                                      {!isMatch && surveyGenres.length > 0 && count >= 3 && ' 👀'}
                                    </Badge>
                                  );
                                });
                            })()}
                          </div>
                          {(() => {
                            // Use same normalization function for insight message
                            const normalizeGenre = (g: string) => {
                              const lower = g.toLowerCase().trim();
                              if (lower === 'sci-fi' || lower === 'science fiction') return 'science fiction';
                              if (lower === 'action & adventure') return 'action';
                              return lower;
                            };
                            const surveyGenres = (dnaProfile?.favorite_genres || []).map(normalizeGenre);
                            const topTracked = Object.entries(trackedGenres)
                              .sort((a, b) => b[1] - a[1])[0];
                            
                            if (topTracked && surveyGenres.length > 0) {
                              const normalizedTop = normalizeGenre(topTracked[0]);
                              const isTopInSurvey = surveyGenres.some(sg => 
                                sg === normalizedTop || sg.includes(normalizedTop) || normalizedTop.includes(sg)
                              );
                              if (!isTopInSurvey && topTracked[1] >= 3) {
                                return (
                                  <p className="text-xs text-amber-700 mt-2 italic">
                                    💡 You didn't mention {topTracked[0]} in your survey, but it shows up in {topTracked[1]} of your tracked items!
                                  </p>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      
                      {/* Loading state for tracked genres */}
                      {isLoadingTrackedGenres && (
                        <div className="mt-3 pt-3 border-t border-indigo-100">
                          <p className="text-xs text-gray-400 italic">Analyzing your tracked genres...</p>
                        </div>
                      )}
                      
                      {/* No tracked genres found - show regardless of survey presence */}
                      {!isLoadingTrackedGenres && trackedGenresLoaded && Object.keys(trackedGenres).length === 0 && (
                        <div className={`${(dnaProfile?.favorite_genres || []).length > 0 ? 'mt-3 pt-3 border-t border-indigo-100' : ''}`}>
                          <p className="text-xs text-gray-400 italic">Track some movies or TV shows to see your actual genre preferences!</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Entertainment Style */}
                  {dnaProfile?.flavor_notes && dnaProfile.flavor_notes.length > 0 && (
                    <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-100">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-lg">✨</span> Your Entertainment Style
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {dnaProfile.flavor_notes.map((note, index) => (
                          <Badge key={index} className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-xs border border-purple-200">
                            {note}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Favorite Sports */}
                  {dnaProfile?.favorite_sports && dnaProfile.favorite_sports.length > 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-lg">🏆</span> Favorite Sports
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {dnaProfile.favorite_sports.map((sport, index) => (
                          <Badge key={index} className="bg-green-100 text-green-700 text-xs border border-green-200">
                            {sport}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  </CollapsibleContent>
                </Collapsible>

              </div>
            )}

            {/* Friend DNA Comparison - Standalone section for more room */}
            {isOwnProfile && dnaProfileStatus === 'has_profile' && (
              <div className="mt-4">
                <FriendDNAComparison dnaLevel={dnaLevel} itemCount={dnaItemCount} hasSurvey={dnaProfileStatus === 'has_profile'} />
              </div>
            )}

          </div>
        </div>
        )}

        {/* Badges Section */}
        {activeSection === 'badges' && (
          <div className="px-4 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em', fontFamily: 'Poppins, sans-serif' }}>
              {isOwnProfile ? 'Your' : 'Their'} Badges
            </h3>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              {userBadges.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {userBadges.map((badge: any) => (
                    <div
                      key={badge.id}
                      className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors"
                      style={{ backgroundColor: `${badge.theme_color}08` }}
                    >
                      <span className="text-3xl mb-2">{badge.emoji}</span>
                      <span
                        className="font-semibold text-sm text-center"
                        style={{ color: badge.theme_color }}
                      >
                        {badge.name}
                      </span>
                      <p className="text-xs text-gray-500 text-center mt-1">{badge.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Medal size={28} className="text-gray-400" />
                  </div>
                  <h4 className="font-semibold text-gray-700 mb-2">No Badges Yet</h4>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Complete activities and reach milestones to earn badges!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Friends Manager - Only show on own profile */}
        {activeSection === 'friends' && isOwnProfile && user?.id && (
          <div ref={friendsRef} className="px-4 mb-8">
            <FriendsManager userId={user.id} />
          </div>
        )}

        {/* Collections Section (Lists only) - Show for own profile or friends */}
        {activeSection === 'collections' && (isOwnProfile || friendshipStatus === 'friends') && (
          <div ref={listsRef} className="px-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isOwnProfile ? 'Your Lists' : 'Lists'}
                </h2>
              </div>

              {/* Lists Content */}
                  {/* Create List Button - Only for own profile */}
                  {isOwnProfile && (
                    <div className="flex justify-end mb-4">
                      <Button
                        onClick={() => setShowCreateListDialog(true)}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full"
                        data-testid="button-create-list"
                      >
                        <Plus size={16} className="mr-2" />
                        Create List
                      </Button>
                    </div>
                  )}

                  {isLoadingLists ? (
                    <div className="text-center py-8">
                      <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
                      <p className="text-gray-500 mt-2">Loading your lists...</p>
                    </div>
                  ) : userLists && userLists.length > 0 ? (
                    <div className="space-y-2">
                      {userLists.map((list: any) => (
                    <div
                      key={list.id}
                      className="border border-gray-200 rounded-lg hover:border-purple-300 transition-colors cursor-pointer"
                      onClick={() => {
                        const listSlug = list.title.toLowerCase().replace(/\s+/g, '-');
                        const userParam = !isOwnProfile && viewingUserId ? `?user=${viewingUserId}` : '';
                        setLocation(`/list/${listSlug}${userParam}`);
                      }}
                    >
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                            {list.is_default ? (
                              list.title === 'Want to Watch' ? <Play className="text-purple-600" size={18} /> :
                              list.title === 'Currently' ? <Clock className="text-blue-600" size={18} /> :
                              list.title === 'Completed' ? <Trophy className="text-green-600" size={18} /> :
                              <List className="text-gray-600" size={18} />
                            ) : (
                              <List className="text-purple-600" size={18} />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{getDisplayTitle(list.title)}</h3>
                              {!list.is_default && list.visibility && (
                                <Badge variant="outline" className="text-xs">
                                  {list.visibility === 'private' ? <Lock size={10} className="mr-1" /> : <Users size={10} className="mr-1" />}
                                  {list.visibility}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {list.items?.length || 0} {list.items?.length === 1 ? 'item' : 'items'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              const listSlug = list.title.toLowerCase().replace(/\s+/g, '-');
                              handleShareListDirect(list.id, list.title);
                            }}
                            data-testid={`button-share-list-${list.id}`}
                          >
                            <Share2 size={16} />
                          </Button>
                          <ChevronRight className="text-gray-400" size={18} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  ) : (
                    <div className="text-center py-8">
                      <List className="text-gray-300 mx-auto mb-3" size={48} />
                      <p className="text-gray-500 mb-4">No lists yet</p>
                      <Button
                        onClick={() => setShowCreateListDialog(true)}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                        data-testid="button-get-started-lists"
                      >
                        <Plus size={16} className="mr-2" />
                        Create Your First List
                      </Button>
                    </div>
                  )}
            </div>
          </div>
        )}

        {/* Activity Section - Show for own profile or friends */}
        {activeSection === 'activity' && (isOwnProfile || friendshipStatus === 'friends') && (
          <div ref={historyRef} className="px-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isOwnProfile ? 'Your Activity' : 'Activity'}
                </h2>
              </div>

              {/* Sub-filter Pills */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto">
                {[
                  { id: 'all', label: 'All', icon: Activity },
                  { id: 'history', label: 'Media History', icon: Clock },
                  { id: 'ratings', label: 'Ratings', icon: Star },
                  { id: 'posts', label: 'Posts', icon: MessageCircle },
                  { id: 'games', label: 'Games', icon: Gamepad2 },
                  ...(isOwnProfile ? [{ id: 'bets', label: 'My Bets', icon: Target }] : []),
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActivitySubFilter(id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      activitySubFilter === id
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid={`activity-filter-${id}`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Import Button - Only for own profile, only in history filter */}
              {isOwnProfile && activitySubFilter === 'history' && (
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-full mb-4 px-4 py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-colors flex items-center justify-center gap-2 font-medium"
                  data-testid="button-import-history"
                >
                  <Upload size={18} />
                  Import Media History
                </button>
              )}

              {/* Activity Content - Media History */}
              {(activitySubFilter === 'all' || activitySubFilter === 'history') && (
                <>
                  {/* Filter buttons row for history */}
                  {activitySubFilter === 'history' && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <div className="relative">
                        <button
                          onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                            mediaHistoryType !== 'all'
                              ? 'bg-purple-600 text-white'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                          data-testid="filter-type-button"
                        >
                          <Film size={12} />
                          {getTypeLabel()}
                          <ChevronRight size={12} className={`transition-transform ${openFilter === 'type' ? 'rotate-90' : ''}`} />
                        </button>
                        {openFilter === 'type' && (
                          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[120px]">
                            {[
                              { value: 'all', label: 'All Types' },
                              { value: 'movies', label: 'Movies', icon: Film },
                              { value: 'tv', label: 'TV', icon: Tv },
                              { value: 'books', label: 'Books', icon: BookOpen },
                              { value: 'music', label: 'Music', icon: Music },
                            ].map(({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                onClick={() => { setMediaHistoryType(value); setOpenFilter(null); }}
                                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-100 ${
                                  mediaHistoryType === value ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                                }`}
                              >
                                {Icon && <Icon size={12} className="text-gray-600" />}
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search Bar */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      placeholder="Search activity..."
                      value={mediaHistorySearch}
                      onChange={(e) => setMediaHistorySearch(e.target.value)}
                      className="pl-10 bg-white text-gray-900 border-gray-300"
                      data-testid="input-activity-search"
                    />
                  </div>

                  {/* Activity Items */}
                  {isLoadingLists ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                          <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
                          <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredMediaHistory.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                      <Activity className="mx-auto mb-3 text-gray-300" size={48} />
                      <p className="text-gray-600">No activity yet</p>
                      <p className="text-sm text-gray-500">Start tracking media to see your activity here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredMediaHistory.map((item: any, index: number) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-3 hover:border-purple-300 transition-colors cursor-pointer"
                          onClick={() => {
                            if (item.external_id && item.external_source) {
                              setLocation(`/media/${item.media_type}/${item.external_source}/${item.external_id}`);
                            }
                          }}
                          data-testid={`activity-item-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getMediaIcon(item.media_type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {getMediaIcon(item.media_type)}
                                <span>{item.media_type}</span>
                                <span>•</span>
                                <span>{item.listName}</span>
                              </div>
                              <p className="text-xs text-gray-400">
                                {new Date(item.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Placeholder for other activity types */}
              {activitySubFilter === 'ratings' && (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                  <Star className="mx-auto mb-3 text-gray-300" size={48} />
                  <p className="text-gray-600">Ratings activity coming soon</p>
                </div>
              )}
              {activitySubFilter === 'posts' && (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                  <MessageCircle className="mx-auto mb-3 text-gray-300" size={48} />
                  <p className="text-gray-600">Posts activity coming soon</p>
                </div>
              )}
              {activitySubFilter === 'games' && (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                  <Gamepad2 className="mx-auto mb-3 text-gray-300" size={48} />
                  <p className="text-gray-600">Games activity coming soon</p>
                </div>
              )}

              {/* Bets Section - Only for own profile */}
              {activitySubFilter === 'bets' && isOwnProfile && (
                <div className="space-y-4">
                  {/* Bets Toggle - Placed vs Received */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => { setBetsTab('placed'); fetchBets('placed'); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        betsTab === 'placed' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      data-testid="bets-tab-placed"
                    >
                      Bets You Placed
                    </button>
                    <button
                      onClick={() => { setBetsTab('received'); fetchBets('received'); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        betsTab === 'received' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      data-testid="bets-tab-received"
                    >
                      Bets on You
                    </button>
                  </div>

                  {isLoadingBets ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                          <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
                          <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : userBets.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                      <Target className="mx-auto mb-3 text-gray-300" size={48} />
                      <p className="text-gray-600">
                        {betsTab === 'placed' ? 'No bets placed yet' : 'No one has bet on you yet'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {betsTab === 'placed' 
                          ? 'Predict if your friends will love or hate media they added!' 
                          : 'When friends bet on your reactions, they\'ll appear here'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userBets.map((bet) => (
                        <div 
                          key={bet.id} 
                          className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                          data-testid={`bet-item-${bet.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  bet.status === 'pending' 
                                    ? 'bg-yellow-100 text-yellow-700' 
                                    : bet.status === 'won' 
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {bet.status === 'pending' ? '⏳ Pending' : bet.status === 'won' ? '✅ Won' : '❌ Lost'}
                                </span>
                                {bet.points_won && (
                                  <span className="text-xs text-green-600 font-medium">+{bet.points_won} pts</span>
                                )}
                              </div>
                              <h4 className="font-medium text-gray-900">{bet.media_title}</h4>
                              <p className="text-sm text-gray-600">
                                {betsTab === 'placed' ? (
                                  <>
                                    You bet {bet.target_user?.display_name || bet.target_user?.user_name || 'someone'} will{' '}
                                    <span className={bet.prediction === 'will_like' ? 'text-green-600' : 'text-red-600'}>
                                      {bet.prediction === 'will_like' ? 'love it 💚' : 'not like it 👎'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {bet.bettor?.display_name || bet.bettor?.user_name || 'Someone'} thinks you'll{' '}
                                    <span className={bet.prediction === 'will_like' ? 'text-green-600' : 'text-red-600'}>
                                      {bet.prediction === 'will_like' ? 'love it 💚' : 'not like it 👎'}
                                    </span>
                                  </>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(bet.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logout Button - Only shown on own profile, at bottom */}
        {isOwnProfile && (
          <div className="px-4 pb-24 pt-12">
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                className="border-gray-300 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={async () => {
                  await queryClient.cancelQueries();
                  queryClient.clear();
                  const { error } = await signOut();
                  if (error) {
                    toast({
                      title: "Error",
                      description: "Failed to log out. Please try again.",
                      variant: "destructive"
                    });
                  } else {
                    setLocation('/login');
                  }
                }}
                data-testid="button-logout"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

      {/* Highlight Modal with Media Search */}
      {isHighlightModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Add a Highlight</h1>
                  <p className="text-gray-600 text-sm mt-1">Share something you're loving or have loved recently!</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsHighlightModalOpen(false)}
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Media Type Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Media Types to Search</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-6">
                  {categories.map((category) => {
                    const isChecked = selectedCategories.includes(category);
                    const isAllMedia = category === "All Media";

                    const handleToggle = (checked: boolean) => {
                      if (isAllMedia) {
                        if (checked) {
                          setSelectedCategories(categories);
                        } else {
                          setSelectedCategories([]);
                        }
                      } else {
                        if (checked) {
                          const newCategories = [...selectedCategories, category];
                          if (newCategories.length === categories.length - 1) {
                            setSelectedCategories(categories);
                          } else {
                            setSelectedCategories(newCategories);
                          }
                        } else {
                          setSelectedCategories(prev => 
                            prev.filter(cat => cat !== category && cat !== "All Media")
                          );
                        }
                      }
                    };

                    return (
                      <div key={category} className="flex items-center space-x-3">
                        <Checkbox
                          id={category}
                          checked={isChecked}
                          onCheckedChange={handleToggle}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-5 h-5"
                        />
                        <label
                          htmlFor={category}
                          className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                        >
                          {category === "All Media" ? "All Types" : category}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search for Media Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search for Media</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for movies, TV shows, books, podcasts, music..."
                    className="pl-10 py-3 text-base bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                    data-testid="input-highlight-search"
                  />
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Search Results</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          onClick={() => setSelectedMedia(result)}
                          className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            selectedMedia?.title === result.title && selectedMedia?.creator === result.creator
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            {result.image && (
                              <img
                                src={result.image}
                                alt={result.title}
                                className="w-16 h-20 object-cover rounded flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-gray-900 truncate">{result.title}</h5>
                              <p className="text-sm text-gray-600 truncate">
                                {result.type === 'tv' ? 'TV Show' : 
                                 result.type === 'movie' ? 'Movie' : 
                                 result.type === 'book' ? 'Book' : 
                                 result.type === 'music' ? 'Music' : 
                                 result.type === 'podcast' ? 'Podcast' : 
                                 result.type === 'game' ? 'Game' : 
                                 result.type === 'sports' ? 'Sports' : 
                                 result.type === 'youtube' ? 'YouTube' : result.type}
                              </p>
                              {result.creator && (
                                <p className="text-sm text-gray-500 truncate">by {result.creator}</p>
                              )}
                              {result.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{result.description}</p>
                              )}
                            </div>
                            {selectedMedia?.title === result.title && selectedMedia?.creator === result.creator && (
                              <div className="flex-shrink-0">
                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Media Preview */}
                {selectedMedia && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">Selected for Highlight</h4>
                    <div className="flex items-center space-x-4">
                      {selectedMedia.image && (
                        <img
                          src={selectedMedia.image}
                          alt={selectedMedia.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        <h5 className="font-medium text-gray-900">{selectedMedia.title}</h5>
                        <p className="text-sm text-gray-600">
                          {selectedMedia.type === 'tv' ? 'TV Show' : 
                           selectedMedia.type === 'movie' ? 'Movie' : 
                           selectedMedia.type === 'book' ? 'Book' : 
                           selectedMedia.type === 'music' ? 'Music' : 
                           selectedMedia.type === 'podcast' ? 'Podcast' : 
                           selectedMedia.type === 'game' ? 'Game' : 
                           selectedMedia.type === 'sports' ? 'Sports' : 
                           selectedMedia.type === 'youtube' ? 'YouTube' : selectedMedia.type}
                        </p>
                        {selectedMedia.creator && (
                          <p className="text-sm text-gray-500">by {selectedMedia.creator}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Add Highlight Button */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setIsHighlightModalOpen(false)}
                  variant="outline"
                  className="text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (selectedMedia) {
                      await addHighlight(selectedMedia);
                      setIsHighlightModalOpen(false);
                      setSelectedMedia(null);
                      setSearchResults([]);
                      setSearchQuery("");
                    }
                  }}
                  disabled={!selectedMedia}
                  className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  <Plus size={16} className="mr-2" />
                  Add Highlight
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


      {selectedListForShare && (
        <ListShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedListForShare(null);
          }}
          listName={selectedListForShare.name}
          listItems={selectedListForShare.items}
          listType="custom"
        />
      )}

      {/* Entertainment DNA Survey Modal */}
      {isDNASurveyOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-5">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Brain className="text-white" size={20} />
                </div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 mb-1">Entertainment DNA Survey</h1>
                <p className="text-gray-600 text-xs md:text-sm">
                  Let's understand how you consume entertainment
                </p>
              </div>

              {/* Progress */}
              {surveyQuestions.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                    <span>Question {currentQuestion + 1} of {surveyQuestions.length}</span>
                    <span>{Math.round(((currentQuestion + 1) / surveyQuestions.length) * 100)}%</span>
                  </div>
                  <Progress value={((currentQuestion + 1) / surveyQuestions.length) * 100} className="h-1.5" />
                </div>
              )}

              {/* Question */}
              <div className="mb-4">
                {!isLoadingQuestions && surveyQuestions.length > 0 && currentQuestion < surveyQuestions.length && (
                  <>
                    <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 leading-snug">
                      {surveyQuestions[currentQuestion].question_text}
                    </h2>

                    {/* Text Input */}
                    {surveyQuestions[currentQuestion].question_type === 'text' && (
                      <textarea
                        value={getCurrentSurveyAnswer() || ""}
                        onChange={(e) => handleSurveyAnswer(e.target.value)}
                        placeholder="Please share your thoughts..."
                        className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-purple-300 focus:ring-purple-300 min-h-[90px] resize-vertical text-sm text-black bg-white placeholder:text-gray-500"
                        data-testid="text-input"
                      />
                    )}

                    {/* Single Select */}
                    {surveyQuestions[currentQuestion].question_type === 'select' && (
                      <RadioGroup 
                        value={getCurrentSurveyAnswer() || ""} 
                        onValueChange={handleSurveyAnswer}
                        className="space-y-2"
                      >
                        {surveyQuestions[currentQuestion].options?.map((option, index) => {
                          const isSelected = getCurrentSurveyAnswer() === option;
                          return (
                            <div 
                              key={index} 
                              className={`flex items-center space-x-2 px-3 py-2.5 rounded-full border-2 transition-all cursor-pointer ${
                                isSelected 
                                  ? 'border-purple-500 bg-purple-100 shadow-sm' 
                                  : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                              }`}
                            >
                              <RadioGroupItem value={option} id={`option-${index}`} className="flex-shrink-0" />
                              <Label 
                                htmlFor={`option-${index}`} 
                                className="text-gray-900 text-sm leading-tight cursor-pointer flex-1 font-medium"
                                data-testid={`option-${option}`}
                              >
                                {option}
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    )}

                    {/* Multi-Select */}
                    {surveyQuestions[currentQuestion].question_type === 'multi-select' && (
                      <div className="space-y-2">
                        {surveyQuestions[currentQuestion].options?.map((option, index) => {
                          const currentAnswers = Array.isArray(getCurrentSurveyAnswer()) ? getCurrentSurveyAnswer() : [];
                          const isChecked = currentAnswers.includes(option);

                          return (
                            <div 
                              key={index} 
                              className={`flex items-center space-x-2 px-3 py-2.5 rounded-full border-2 transition-all cursor-pointer ${
                                isChecked 
                                  ? 'border-purple-500 bg-purple-100 shadow-sm' 
                                  : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                id={`multi-option-${index}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentAnswers = Array.isArray(getCurrentSurveyAnswer()) ? [...getCurrentSurveyAnswer()] : [];
                                  if (e.target.checked) {
                                    currentAnswers.push(option);
                                  } else {
                                    const optionIndex = currentAnswers.indexOf(option);
                                    if (optionIndex > -1) {
                                      currentAnswers.splice(optionIndex, 1);
                                    }
                                  }
                                  handleSurveyAnswer(currentAnswers);
                                }}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 flex-shrink-0"
                                data-testid={`multi-option-${option}`}
                              />
                              <Label 
                                htmlFor={`multi-option-${index}`} 
                                className="text-gray-900 text-sm leading-tight cursor-pointer flex-1 font-medium"
                              >
                                {option}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {isLoadingQuestions && (
                  <div className="text-center py-5">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-600 text-xs">Loading questions...</p>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center gap-1.5">
                <Button
                  onClick={handleSurveyPrevious}
                  disabled={currentQuestion === 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1 disabled:opacity-50 px-2.5 py-1.5 h-8"
                  data-testid="previous-question-button"
                >
                  <ChevronLeft size={14} />
                  <span className="text-xs">Prev</span>
                </Button>

                <Button
                  onClick={() => setIsDNASurveyOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1.5 h-8"
                  data-testid="close-survey-button"
                >
                  Close
                </Button>

                <Button
                  onClick={handleSurveyNext}
                  disabled={surveyQuestions.length === 0 || !getCurrentSurveyAnswer() || (Array.isArray(getCurrentSurveyAnswer()) && getCurrentSurveyAnswer().length === 0)}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center space-x-1 disabled:opacity-50 px-2.5 py-1.5 h-8"
                  data-testid="next-question-button"
                >
                  <span className="text-xs">{surveyQuestions.length > 0 && currentQuestion === surveyQuestions.length - 1 ? "Generate" : "Next"}</span>
                  {surveyQuestions.length > 0 && currentQuestion === surveyQuestions.length - 1 ? (
                    <Sparkles size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Friend</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddFriendModalOpen(false);
                  setFriendSearchQuery("");
                  setFriendSearchResults([]);
                }}
                className="h-8 w-8 p-0"
                data-testid="button-close-add-friend"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Search Input */}
              <div>
                <Label htmlFor="friend-search" className="text-sm font-medium text-gray-700 mb-2 block">
                  Search for users
                </Label>
                <div className="relative">
                  <Input
                    id="friend-search"
                    value={friendSearchQuery}
                    onChange={(e) => {
                      setFriendSearchQuery(e.target.value);
                      searchFriends(e.target.value);
                    }}
                    placeholder="Enter username or email..."
                    className="w-full pr-10"
                    data-testid="input-friend-search"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-500 mt-1">Search by username or email address</p>
              </div>

              {/* Search Results */}
              <div className="max-h-80 overflow-y-auto">
                {isSearchingFriends ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-purple-600 mr-2" size={20} />
                    <span className="text-gray-600">Searching...</span>
                  </div>
                ) : friendSearchResults.length > 0 ? (
                  <div className="space-y-2">
                    {friendSearchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <User size={20} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">@{result.user_name}</p>
                            <p className="text-xs text-gray-500">{result.email}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(result.id)}
                          disabled={isSendingRequest}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          data-testid={`button-add-${result.id}`}
                        >
                          {isSendingRequest ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <>
                              <Plus size={16} className="mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : friendSearchQuery.length >= 2 ? (
                  <div className="text-center py-8">
                    <Users size={48} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No users found</p>
                    <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Search size={48} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">Search for friends</p>
                    <p className="text-xs text-gray-500 mt-1">Enter at least 2 characters to search</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-black">Edit Profile</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditProfileOpen(false)}
                className="h-8 w-8 p-0"
                data-testid="button-close-edit-profile"
              >
                <X className="h-4 w-4 text-black" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* First Name */}
              <div>
                <Label htmlFor="first-name" className="text-sm font-medium text-black mb-2 block">
                  First Name
                </Label>
                <Input
                  id="first-name"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="Your first name"
                  className="w-full bg-white text-black border-gray-300 placeholder:text-gray-500"
                  data-testid="input-first-name"
                />
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="last-name" className="text-sm font-medium text-black mb-2 block">
                  Last Name <span className="text-black font-normal">(optional)</span>
                </Label>
                <Input
                  id="last-name"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Your last name"
                  className="w-full bg-white text-black border-gray-300 placeholder:text-gray-500"
                  data-testid="input-last-name"
                />
                <p className="text-xs text-black mt-1">
                  Your display name will be "{(editFirstName + ' ' + editLastName).trim() || editFirstName || editUsername}"
                </p>
              </div>

              {/* Username */}
              <div>
                <Label htmlFor="username" className="text-sm font-medium text-black mb-2 block">
                  Username
                </Label>
                <Input
                  id="username"
                  value={editUsername}
                  disabled
                  className="w-full bg-gray-100 text-gray-600 border-gray-300 cursor-not-allowed"
                  data-testid="input-username"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Usernames cannot be changed to prevent broken mentions
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="flex-1"
                  disabled={isSavingProfile}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                  disabled={isSavingProfile}
                  data-testid="button-save-profile"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          setIsAuthModalOpen(false);
        }}
      />

      {/* Import Media Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="text-purple-600" size={20} />
              Import Your Entertainment History
            </DialogTitle>
            <DialogDescription className="text-gray-600 space-y-3">
              <div>
                Import your entertainment history from Goodreads. Upload a CSV or ZIP file to get started.
                <button
                  onClick={() => setIsHelpModalOpen(true)}
                  className="inline-flex items-center ml-1 text-blue-600 hover:text-blue-700 underline"
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  How do I get my data?
                </button>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label
                htmlFor="file-upload-profile"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">CSV or ZIP files</p>
                </div>
                <input
                  id="file-upload-profile"
                  type="file"
                  className="hidden"
                  accept=".csv,.zip"
                  onChange={handleFileChange}
                  data-testid="input-file-upload"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Supported: Goodreads (CSV or ZIP)
              </p>
            </div>

            {uploadFile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{uploadFile.name}</span>
                  </div>
                  <button
                    onClick={() => setUploadFile(null)}
                    className="text-blue-600 hover:text-blue-800"
                    data-testid="button-remove-file"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            <Button
              onClick={handleFileUpload}
              disabled={!uploadFile || isUploading}
              className="w-full bg-purple-600 text-white hover:bg-purple-700"
              data-testid="button-upload-file"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import File
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Modal - How to get your data */}
      <Dialog open={isHelpModalOpen} onOpenChange={setIsHelpModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="text-purple-600" size={20} />
              How to Get Your Data
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-800">Goodreads:</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Visit your Import/Export page and click "Export Library".{' '}
                    <a
                      href="https://www.goodreads.com/review/import"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Export your Goodreads data →
                    </a>
                  </p>
                </div>
              </li>
            </ul>

            <Button
              onClick={() => setIsHelpModalOpen(false)}
              className="w-full bg-gray-100 text-gray-800 hover:bg-gray-200"
              data-testid="button-close-help"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateRankDialog
        open={showCreateRankDialog}
        onOpenChange={setShowCreateRankDialog}
      />

      <CreateListDialog
        open={showCreateListDialog}
        onOpenChange={setShowCreateListDialog}
      />

      {/* Import Modal for History Tab */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-gray-900">
              Import Goodreads
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImportHelpOpen(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <HelpCircle size={16} />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload your Goodreads export file to import your reading history.
            </p>
            <p className="text-sm text-gray-500 bg-purple-50 rounded-lg px-3 py-2">
              Want to import from other services? Email <a href="mailto:heidi@consumedapp.com" className="text-purple-600 font-medium hover:underline">heidi@consumedapp.com</a> and we'll do it for you!
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".csv,.zip"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="import-file-upload"
              />
              <label htmlFor="import-file-upload" className="cursor-pointer">
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-600">
                  {importFile ? importFile.name : 'Click to select a file'}
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV files supported</p>
              </label>
            </div>
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={handleFileImport}
              disabled={!importFile || isUploading}
              data-testid="button-submit-import"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Help Modal */}
      <Dialog open={isImportHelpOpen} onOpenChange={setIsImportHelpOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">How to Export Your Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1 text-gray-900">Netflix</h4>
              <p className="text-gray-600">Go to Account → Profile → Viewing Activity → Download all</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-900">Goodreads</h4>
              <p className="text-gray-600">Go to My Books → Import and export → Export Library</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-900">Spotify</h4>
              <p className="text-gray-600">Go to Privacy settings → Download your data</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}