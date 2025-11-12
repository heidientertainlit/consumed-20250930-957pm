import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, useRoute } from "wouter";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ListShareModal from "@/components/list-share-modal";
import FriendsManager from "@/components/friends-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star, User, Users, MessageCircle, Share, Play, BookOpen, Music, Film, Tv, Trophy, Heart, Plus, Settings, Calendar, TrendingUp, Clock, Headphones, Gamepad2, Sparkles, Brain, Share2, ChevronDown, ChevronUp, CornerUpRight, RefreshCw, Loader2, ChevronLeft, ChevronRight, List, Search, X, LogOut } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { copyLink } from "@/lib/share";
import { AuthModal } from "@/components/auth";
import { queryClient } from "@/lib/queryClient";

export default function UserProfile() {
  const { user, session, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Get user ID from URL using wouter's useRoute
  const [match, params] = useRoute('/user/:id');
  // If params.id is "profile" or not set, use current user's ID (own profile)
  const viewingUserId = (params?.id && params.id !== 'profile') ? params.id : user?.id;
  const isOwnProfile = !params?.id || params.id === 'profile' || viewingUserId === user?.id;

  // Store return URL for redirect after login
  useEffect(() => {
    if (!user && !loading && params?.id) {
      // Store the profile URL they're trying to visit
      sessionStorage.setItem('returnUrl', `/user/${params.id}`);
    }
  }, [user, loading, params?.id]);
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

  // Survey states
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<{ questionId: string; answer: string | string[] }[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // User lists states
  const [userLists, setUserLists] = useState<any[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // User stats states
  const [userStats, setUserStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // User points states
  const [userPoints, setUserPoints] = useState<any>(null);
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
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'year' | 'month' | 'type' | null>(null);
  const [showAllMediaHistory, setShowAllMediaHistory] = useState(false);

  // Highlights state
  const [highlights, setHighlights] = useState<any[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);

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
  const listsRef = useRef<HTMLDivElement>(null);
  const friendsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>('stats');

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

  // Fetch profile data - accessible to everyone (public profiles)
  useEffect(() => {
    if (session?.access_token && viewingUserId) {
      fetchDnaProfile();
      fetchUserLists();
      fetchUserStats();
      fetchUserPoints();
      fetchUserPredictions();
      fetchHighlights();
      if (isOwnProfile) {
        fetchFollowedCreators();
      }
      if (!isOwnProfile) {
        checkFriendshipStatus();
      }
    }
  }, [session?.access_token, viewingUserId]);

  // Fetch DNA recommendations when DNA profile exists
  useEffect(() => {
    if (session?.access_token && dnaProfileStatus === 'has_profile' && isOwnProfile) {
      fetchDNARecommendations();
    }
  }, [session?.access_token, dnaProfileStatus, isOwnProfile]);

  // Track active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { ref: statsRef, id: 'stats' },
        { ref: dnaRef, id: 'dna' },
        { ref: listsRef, id: 'lists' },
        { ref: friendsRef, id: 'friends' }
      ];

      const scrollPosition = window.scrollY + 200; // Offset for sticky nav

      for (const section of sections) {
        if (section.ref.current) {
          const { offsetTop, offsetHeight } = section.ref.current;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to section function
  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    if (sectionRef.current) {
      const offsetTop = sectionRef.current.offsetTop - 120; // Offset for sticky elements
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  };

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
  const fetchUserLists = async () => {
    if (!session?.access_token || !viewingUserId) return;

    setIsLoadingLists(true);
    try {
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${viewingUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Keep all lists including "All" for accurate item count calculation
        // Filter is only for display purposes in some sections
        setUserLists(data.lists || []);
        console.log('User lists loaded:', data.lists?.length);
      } else {
        console.error('Failed to fetch user lists');
        setUserLists([]);
      }
    } catch (error) {
      console.error('Error fetching user lists:', error);
      setUserLists([]);
    } finally {
      setIsLoadingLists(false);
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
        console.log('User points loaded:', data.points);
      } else {
        console.error('Failed to fetch user points');
        setUserPoints(null);
      }
    } catch (error) {
      console.error('Error fetching user points:', error);
      setUserPoints(null);
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
    setLocation(`/list/${listId}`);
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

        // Bottom text: "app.consumedapp.com" (BELOW the white box)
        ctx.font = 'bold 38px Poppins, sans-serif';
        ctx.fillText('app.consumedapp.com', canvas.width / 2, 1750);

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

  // Generate years and months for filter dropdowns
  const getAvailableYears = () => {
    const allItems = getAllMediaItems();
    const years = new Set(allItems.map(item => new Date(item.created_at).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  };

  const availableYears = getAvailableYears();

  // Calculate total items logged from the 'All' list (which contains all unique items)
  const totalItemsLogged = userLists.find(list => list.id === 'all')?.items?.length || 0;


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

                  {/* Total Points Display */}
                  <div className="flex items-center space-x-2 mb-2">
                    {isLoadingPoints ? (
                      <div className="flex items-center space-x-2">
                        <Trophy className="text-amber-500" size={20} />
                        <span className="text-gray-600">Loading points...</span>
                      </div>
                    ) : userPoints ? (
                      <div className="flex items-center space-x-2">
                        <Trophy className="text-amber-500" size={20} />
                        <span className="text-lg font-bold text-amber-600">{userPoints.all_time || 0}</span>
                        <span className="text-gray-600">total points</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Quick Stats Matching Track Page */}
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <TrendingUp size={16} className="text-purple-600" />
                      <span className="font-medium">{totalItemsLogged}</span>
                      <span>items logged</span>
                    </div>
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
                    <Button 
                      disabled
                      className="bg-gray-300 text-gray-600 rounded-full px-8 py-3 text-base font-semibold cursor-not-allowed"
                      data-testid="button-already-friends"
                    >
                      <Users size={20} className="mr-2" />
                      Already Friends
                    </Button>
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

        {/* Currently Consuming - Compact */}
        {(() => {
          const currentlyList = userLists.find(list => list.title === 'Currently');
          const currentlyItems = currentlyList?.items?.slice(0, 5) || [];
          const firstName = userProfileData?.first_name || user?.user_metadata?.first_name || 'User';
          
          return currentlyItems.length > 0 ? (
            <div className="px-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {firstName} is currently consuming...
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {currentlyItems.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      const mediaType = item.media_type || 'movie';
                      const source = item.external_source || 'tmdb';
                      const id = item.external_id;
                      if (id) setLocation(`/media/${mediaType}/${source}/${id}`);
                    }}
                    className="flex-shrink-0 cursor-pointer group"
                  >
                    <div className="w-16 h-24 rounded-lg overflow-hidden bg-gray-200 border border-gray-300 group-hover:border-purple-400 transition-colors">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Film size={24} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Section Navigation Pills - Sticky */}
        <div className="sticky top-16 z-20 bg-gray-50 border-b border-gray-200 px-4 py-3 mb-6 -mx-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => scrollToSection(statsRef)}
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
              onClick={() => scrollToSection(dnaRef)}
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
              onClick={() => scrollToSection(listsRef)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === 'lists'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
              data-testid="nav-lists"
            >
              Lists
            </button>
            {isOwnProfile && (
              <button
                onClick={() => scrollToSection(friendsRef)}
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
          </div>
        </div>

        {/* Your Stats */}
        <div ref={statsRef} className="px-4 mb-8">
          <div className="mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em', fontFamily: 'Poppins, sans-serif' }}>Your Stats</h3>
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

        {/* My Entertainment DNA */}
        <div ref={dnaRef} className="px-4 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em', fontFamily: 'Poppins, sans-serif' }}>My Entertainment DNA</h3>
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
                    Discover Your Entertainment DNA
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    Unlock your unique entertainment personality profile. Get personalized recommendations and connect with others who share your taste.
                  </p>
                </div>
                <Button 
                  onClick={handleTakeDNASurvey}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8"
                  data-testid="button-start-dna-survey"
                >
                  <Brain size={16} className="mr-2" />
                  Start DNA Survey
                </Button>
                <p className="text-xs text-gray-500 mt-3">Takes about 5 minutes</p>
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

                {/* Favorite Genres */}
                <div className="mb-6">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Your Favorite Genres</h5>
                  <div className="flex flex-wrap gap-2">
                    {(dnaProfile?.favorite_genres || []).map((genre, index) => (
                      <Badge key={index} className="bg-purple-100 text-purple-700 text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Favorite Media Types */}
                <div className="mb-6">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Your Favorite Media Types</h5>
                  <div className="flex flex-wrap gap-2">
                    {(dnaProfile?.favorite_media_types || []).map((type, index) => (
                      <Badge key={index} className="bg-indigo-100 text-indigo-700 text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Flavor Notes */}
                {dnaProfile?.flavor_notes && dnaProfile.flavor_notes.length > 0 && (
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-900 mb-3">Your Entertainment Style</h5>
                    <div className="flex flex-wrap gap-2">
                      {dnaProfile.flavor_notes.map((note, index) => (
                        <Badge key={index} className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-xs">
                          {note}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expandable Details Section */}
                {isDNAExpanded && dnaProfile && (
                  <div className="border-t border-gray-200 pt-6 mt-6 space-y-4">
                    {/* Media Consumption Stats */}
                    {dnaProfile.media_consumption_stats && (
                      <div>
                        <h5 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                          <Brain className="mr-2 text-indigo-600" size={18} />
                          Your Entertainment Style
                        </h5>
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                          <div className="space-y-2">
                            {typeof dnaProfile.media_consumption_stats === 'string' ? (
                              (() => {
                                const stats = JSON.parse(dnaProfile.media_consumption_stats);
                                return (
                                  <>
                                    {stats.primaryMediaType && (
                                      <p className="text-sm text-indigo-800">
                                        <span className="font-medium">Primary Media:</span> {stats.primaryMediaType}
                                      </p>
                                    )}
                                    {stats.viewingStyle && (
                                      <p className="text-sm text-indigo-800">
                                        <span className="font-medium">Viewing Style:</span> {stats.viewingStyle}
                                      </p>
                                    )}
                                    {stats.discoveryMethod && (
                                      <p className="text-sm text-indigo-800">
                                        <span className="font-medium">Discovery Method:</span> {stats.discoveryMethod}
                                      </p>
                                    )}
                                    {stats.socialAspect && (
                                      <p className="text-sm text-indigo-800">
                                        <span className="font-medium">Social Aspect:</span> {stats.socialAspect}
                                      </p>
                                    )}
                                  </>
                                );
                              })()
                            ) : (
                              <>
                                {dnaProfile.media_consumption_stats.primaryMediaType && (
                                  <p className="text-sm text-indigo-800">
                                    <span className="font-medium">Primary Media:</span> {dnaProfile.media_consumption_stats.primaryMediaType}
                                  </p>
                                )}
                                {dnaProfile.media_consumption_stats.viewingStyle && (
                                  <p className="text-sm text-indigo-800">
                                    <span className="font-medium">Viewing Style:</span> {dnaProfile.media_consumption_stats.viewingStyle}
                                  </p>
                                )}
                                {dnaProfile.media_consumption_stats.discoveryMethod && (
                                  <p className="text-sm text-indigo-800">
                                    <span className="font-medium">Discovery Method:</span> {dnaProfile.media_consumption_stats.discoveryMethod}
                                  </p>
                                )}
                                {dnaProfile.media_consumption_stats.socialAspect && (
                                  <p className="text-sm text-indigo-800">
                                    <span className="font-medium">Social Aspect:</span> {dnaProfile.media_consumption_stats.socialAspect}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Favorite Sports */}
                    {dnaProfile.favorite_sports && dnaProfile.favorite_sports.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2">Favorite Sports</h5>
                        <div className="flex flex-wrap gap-2">
                          {dnaProfile.favorite_sports.map((sport, index) => (
                            <Badge key={index} className="bg-green-100 text-green-700 text-xs">
                              {sport}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show More/Less Button */}
                <button
                  onClick={() => setIsDNAExpanded(!isDNAExpanded)}
                  className="flex items-center justify-center space-x-2 w-full mt-4 py-3 text-sm text-purple-700 hover:text-purple-800 transition-colors border-t border-gray-200"
                  data-testid="button-expand-dna"
                >
                  <span>{isDNAExpanded ? 'Hide Details' : 'See What This Means For You'}</span>
                  {isDNAExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            )}

            {/* DNA-Based Recommendations Section */}
            {dnaProfileStatus === 'has_profile' && isOwnProfile && (isDnaRecsLoading || isDnaRecsGenerating || (Array.isArray(dnaRecommendations) && dnaRecommendations.length > 0)) && (
              <div className="w-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl p-6 shadow-lg border border-gray-800/50 mt-6">
                <div className="flex items-center mb-4">
                  <Sparkles className="text-purple-400 mr-2" size={20} />
                  <h3 className="text-xl font-bold text-white">Based on Your Entertainment DNA</h3>
                  {isDnaRecsGenerating && (
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full animate-pulse border border-blue-500/30" data-testid="generating-badge">
                      Generating...
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-4">Swipe to explore</p>

                <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide px-2">
                  {isDnaRecsLoading ? (
                    // Loading skeleton cards
                    [...Array(4)].map((_, index) => (
                      <div key={`loading-${index}`} className="flex-shrink-0 w-32 sm:w-36 md:w-40">
                        <div className="relative rounded-lg overflow-hidden bg-slate-700 aspect-[2/3] animate-pulse">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        </div>
                        <div className="mt-2">
                          <div className="h-4 bg-slate-700 rounded w-3/4 animate-pulse"></div>
                          <div className="h-3 bg-slate-700 rounded w-1/4 mt-1 animate-pulse"></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    dnaRecommendations.map((rec: any, index: number) => {
                      const uniqueId = `${rec.external_source}-${rec.external_id}`;
                      const showFallback = !rec.image_url || imageErrors[uniqueId];
                      
                      return (
                        <div key={uniqueId} className="flex-shrink-0 w-32 sm:w-36 md:w-40" data-testid={`dna-recommendation-card-${uniqueId}`}>
                          <div className="relative rounded-lg overflow-hidden cursor-pointer aspect-[2/3] bg-slate-800">
                            {/* Poster Image or Fallback */}
                            {showFallback ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 p-4">
                                <div className="text-center">
                                  <p className="text-white font-bold text-sm mb-2 line-clamp-3">{rec.title}</p>
                                  <p className="text-slate-300 text-xs uppercase tracking-wider">{rec.media_type || rec.type}</p>
                                </div>
                              </div>
                            ) : (
                              <img 
                                src={rec.image_url} 
                                alt={rec.title}
                                className="w-full h-full object-cover"
                                onError={() => setImageErrors(prev => ({ ...prev, [uniqueId]: true }))}
                              />
                            )}
                        
                            {/* Gradient Overlay - Always visible */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                            
                            {/* Action Buttons - Always visible at bottom */}
                            <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white border border-white/20 shadow-lg"
                                    data-testid={`add-to-list-${uniqueId}`}
                                    disabled={addDNARecommendationMutation.isPending}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent 
                                  align="end" 
                                  side="top" 
                                  sideOffset={8}
                                  alignOffset={-16}
                                  className="w-56 bg-gray-900 border-gray-700 max-h-[70vh] overflow-y-auto"
                                >
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addDNARecommendationMutation.mutate({ recommendation: rec, listType: 'queue' });
                                    }}
                                    className="cursor-pointer text-white hover:bg-gray-800"
                                    disabled={addDNARecommendationMutation.isPending}
                                  >
                                    Add to Queue
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addDNARecommendationMutation.mutate({ recommendation: rec, listType: 'currently' });
                                    }}
                                    className="cursor-pointer text-white hover:bg-gray-800"
                                    disabled={addDNARecommendationMutation.isPending}
                                  >
                                    Add to Currently
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addDNARecommendationMutation.mutate({ recommendation: rec, listType: 'finished' });
                                    }}
                                    className="cursor-pointer text-white hover:bg-gray-800"
                                    disabled={addDNARecommendationMutation.isPending}
                                  >
                                    Add to Finished
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addDNARecommendationMutation.mutate({ recommendation: rec, listType: 'dnf' });
                                    }}
                                    className="cursor-pointer text-white hover:bg-gray-800"
                                    disabled={addDNARecommendationMutation.isPending}
                                  >
                                    Add to Did Not Finish
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addDNARecommendationMutation.mutate({ recommendation: rec, listType: 'favorites' });
                                    }}
                                    className="cursor-pointer text-white hover:bg-gray-800"
                                    disabled={addDNARecommendationMutation.isPending}
                                  >
                                    Add to Favorites
                                  </DropdownMenuItem>
                                  
                                  {/* Custom Lists */}
                                  {userLists.filter((list: any) => list.isCustom).length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold border-t border-gray-700 mt-1 pt-2">
                                        MY CUSTOM LISTS
                                      </div>
                                      {userLists
                                        .filter((list: any) => list.isCustom)
                                        .map((list: any) => (
                                          <DropdownMenuItem
                                            key={list.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addDNARecommendationMutation.mutate({ recommendation: rec, listType: list.id });
                                            }}
                                            className="cursor-pointer text-white hover:bg-gray-800"
                                            disabled={addDNARecommendationMutation.isPending}
                                          >
                                            Add to {list.title}
                                          </DropdownMenuItem>
                                        ))}
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white border border-white/20 shadow-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRatingStars(prev => ({ ...prev, [uniqueId]: !prev[uniqueId] }));
                                }}
                                data-testid={`rate-${uniqueId}`}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                              
                              {/* Inline vertical star rating */}
                              {ratingStars[uniqueId] && (
                                <div 
                                  className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-lg p-1.5 shadow-2xl border border-white/20 flex flex-col gap-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {[5, 4, 3, 2, 1].map((stars) => (
                                    <button
                                      key={stars}
                                      type="button"
                                      onClick={() => rateDNARecommendationMutation.mutate({ recommendation: rec, rating: stars })}
                                      onMouseEnter={() => setHoveredStar(prev => ({ ...prev, [uniqueId]: stars }))}
                                      onMouseLeave={() => setHoveredStar(prev => ({ ...prev, [uniqueId]: null }))}
                                      disabled={rateDNARecommendationMutation.isPending}
                                      className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-purple-600/50 transition-colors"
                                      data-testid={`star-${stars}`}
                                    >
                                      <Star 
                                        className={`h-4 w-4 transition-all ${
                                          hoveredStar[uniqueId] === stars
                                            ? 'text-yellow-400 fill-yellow-400'
                                            : 'text-gray-400'
                                        }`}
                                      />
                                      <span className="text-white text-xs font-medium">{stars}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Title and Year */}
                          <div className="mt-2 px-1">
                            <h4 className="text-sm font-semibold text-white line-clamp-2 leading-tight" title={rec.title}>
                              {rec.title}
                            </h4>
                            {rec.year && (
                              <p className="text-xs text-gray-400 mt-0.5">{rec.year}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Currently Consuming */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Currently Consuming</h2>
          {isLoadingLists ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
              <p className="text-gray-600 mt-2">Loading your current media...</p>
            </div>
          ) : currentlyConsuming.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentlyConsuming.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start space-x-4">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.title} 
                        className="w-16 h-16 rounded-lg object-cover" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                        <span className="text-2xl">
                          {item.media_type === 'movie' ? '🎬' : 
                           item.media_type === 'tv' ? '📺' : 
                           item.media_type === 'book' ? '📚' : 
                           item.media_type === 'music' ? '🎵' : 
                           item.media_type === 'podcast' ? '🎧' : 
                           item.media_type === 'game' ? '🎮' : '🎭'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-600 mb-1">
                        {item.media_type === 'tv' ? 'TV Show' : 
                         item.media_type === 'movie' ? 'Movie' : 
                         item.media_type === 'book' ? 'Book' : 
                         item.media_type === 'music' ? 'Music' : 
                         item.media_type === 'podcast' ? 'Podcast' : 
                         item.media_type === 'game' ? 'Game' : item.type}
                      </p>
                      {item.creator && (
                        <p className="text-xs text-gray-500">by {item.creator}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-600 mt-2 italic">"{item.notes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📺</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nothing Currently Consuming</h3>
              <p className="text-gray-600 mb-4">Start tracking what you're watching, reading, or listening to</p>
              <Button 
                onClick={handleTrackConsumption}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-start-tracking"
              >
                <Plus size={16} className="mr-2" />
                Track Media
              </Button>
            </div>
          )}
        </div>

        {/* Media History */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Media History</h2>

          {/* Search Bar with Icon */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-900" size={18} />
              <Input
                value={mediaHistorySearch}
                onChange={(e) => setMediaHistorySearch(e.target.value)}
                placeholder="Search your media history..."
                className="w-full pl-10 bg-white text-gray-900 placeholder:text-gray-500"
                data-testid="input-media-history-search"
              />
            </div>

            {/* Search Results - Show when searching */}
            {mediaHistorySearch.trim() && filteredMediaHistory.length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-sm max-h-96 overflow-y-auto">
                <div className="divide-y divide-gray-100">
                  {filteredMediaHistory.slice(0, 10).map((item, index) => (
                    <div key={`${item.id}-${index}`} className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                      {item.image_url ? (
                        <img 
                          src={item.image_url}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          {item.media_type === "movie" && <Film size={24} className="text-gray-600" />}
                          {item.media_type === "tv" && <Film size={24} className="text-gray-600" />}
                          {item.media_type === "book" && <BookOpen size={24} className="text-gray-600" />}
                          {item.media_type === "music" && <Music size={24} className="text-gray-600" />}
                          {item.media_type === "podcast" && <Music size={24} className="text-gray-600" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.title}</div>
                        <div className="text-sm text-gray-600 truncate">{item.creator}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 capitalize">{item.media_type}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results Message */}
            {mediaHistorySearch.trim() && filteredMediaHistory.length === 0 && (
              <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                <p className="text-gray-600">No media found matching "{mediaHistorySearch}"</p>
              </div>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Year Filter */}
            <div className="relative filter-dropdown-container">
              <button
                onClick={() => setOpenFilterDropdown(openFilterDropdown === 'year' ? null : 'year')}
                className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                data-testid="button-year-filter"
              >
                {mediaHistoryYear === "all" ? "Year" : mediaHistoryYear}
              </button>
              {openFilterDropdown === 'year' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                  <button
                    onClick={() => {
                      setMediaHistoryYear("all");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    All Years
                  </button>
                  {availableYears.map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        setMediaHistoryYear(year.toString());
                        setOpenFilterDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Month Filter */}
            <div className="relative filter-dropdown-container">
              <button
                onClick={() => setOpenFilterDropdown(openFilterDropdown === 'month' ? null : 'month')}
                className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                data-testid="button-month-filter"
              >
                {mediaHistoryMonth === "all" ? "Month" : 
                  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][parseInt(mediaHistoryMonth)]}
              </button>
              {openFilterDropdown === 'month' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  <button
                    onClick={() => {
                      setMediaHistoryMonth("all");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    All Months
                  </button>
                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setMediaHistoryMonth(index.toString());
                        setOpenFilterDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type Filter */}
            <div className="relative filter-dropdown-container">
              <button
                onClick={() => setOpenFilterDropdown(openFilterDropdown === 'type' ? null : 'type')}
                className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                data-testid="button-type-filter"
              >
                {mediaHistoryType === "all" ? "Type" : 
                  mediaHistoryType === "movies" ? "Movies" :
                  mediaHistoryType === "tv" ? "TV Shows" :
                  mediaHistoryType === "books" ? "Books" :
                  mediaHistoryType === "music" ? "Music" :
                  mediaHistoryType === "podcasts" ? "Podcasts" :
                  "Games"}
              </button>
              {openFilterDropdown === 'type' && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  <button
                    onClick={() => {
                      setMediaHistoryType("all");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    All Types
                  </button>
                  <button
                    onClick={() => {
                      setMediaHistoryType("movies");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => {
                      setMediaHistoryType("tv");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    TV Shows
                  </button>
                  <button
                    onClick={() => {
                      setMediaHistoryType("books");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    Books
                  </button>
                  <button
                    onClick={() => {
                      setMediaHistoryType("music");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    Music
                  </button>
                  <button
                    onClick={() => {
                      setMediaHistoryType("podcasts");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    Podcasts
                  </button>
                  <button
                    onClick={() => {
                      setMediaHistoryType("games");
                      setOpenFilterDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  >
                    Games
                  </button>
                </div>
              )}
            </div>

            {(mediaHistoryYear !== "all" || mediaHistoryMonth !== "all" || mediaHistoryType !== "all") && (
              <button
                onClick={() => {
                  setMediaHistoryYear("all");
                  setMediaHistoryMonth("all");
                  setMediaHistoryType("all");
                }}
                className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                data-testid="button-clear-filters"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Active Filters */}
          {(mediaHistoryYear !== "all" || mediaHistoryMonth !== "all" || mediaHistoryType !== "all") && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">Active filters:</span>
              {mediaHistoryYear !== "all" && (
                <button
                  onClick={() => setMediaHistoryYear("all")}
                  className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium flex items-center gap-1"
                  data-testid="active-filter-year"
                >
                  {mediaHistoryYear}
                  <X size={14} />
                </button>
              )}
              {mediaHistoryMonth !== "all" && (
                <button
                  onClick={() => setMediaHistoryMonth("all")}
                  className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium flex items-center gap-1"
                  data-testid="active-filter-month"
                >
                  {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][parseInt(mediaHistoryMonth)]}
                  <X size={14} />
                </button>
              )}
              {mediaHistoryType !== "all" && (
                <button
                  onClick={() => setMediaHistoryType("all")}
                  className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium flex items-center gap-1"
                  data-testid="active-filter-type"
                >
                  {mediaHistoryType === "movies" ? "Movies" :
                   mediaHistoryType === "tv" ? "TV Shows" :
                   mediaHistoryType === "books" ? "Books" :
                   mediaHistoryType === "music" ? "Music" :
                   mediaHistoryType === "podcasts" ? "Podcasts" :
                   "Games"}
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Media Type Summary - Compact */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Overview</h3>
            <div className="flex flex-wrap gap-2">
              {mediaTypeCounts.music > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-full border border-purple-100">
                  <span className="text-sm">🎵</span>
                  <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.music}</span>
                  <span className="text-xs text-gray-600">songs</span>
                </div>
              )}
              {mediaTypeCounts.movie > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 rounded-full border border-teal-100">
                  <span className="text-sm">🎬</span>
                  <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.movie}</span>
                  <span className="text-xs text-gray-600">watched</span>
                </div>
              )}
              {mediaTypeCounts.tv > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                  <span className="text-sm">📺</span>
                  <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.tv}</span>
                  <span className="text-xs text-gray-600">series</span>
                </div>
              )}
              {mediaTypeCounts.book > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                  <span className="text-sm">📚</span>
                  <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.book}</span>
                  <span className="text-xs text-gray-600">completed</span>
                </div>
              )}
              {mediaTypeCounts.podcast > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                  <span className="text-sm">🎧</span>
                  <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.podcast}</span>
                  <span className="text-xs text-gray-600">podcasts</span>
                </div>
              )}
              {mediaTypeCounts.game > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                  <span className="text-sm">🎮</span>
                  <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.game}</span>
                  <span className="text-xs text-gray-600">games</span>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Media History */}
          {isLoadingLists ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
              <p className="text-gray-600 mt-2">Loading your media history...</p>
            </div>
          ) : filteredMediaHistory.length > 0 ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="divide-y divide-gray-100">
                  {(showAllMediaHistory ? filteredMediaHistory : filteredMediaHistory.slice(0, 10)).map((item, index) => (
                    <div key={`${item.id}-${index}`} className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                      {item.image_url ? (
                        <img 
                          src={item.image_url}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">
                            {item.media_type === 'movie' ? '🎬' : 
                             item.media_type === 'tv' ? '📺' : 
                             item.media_type === 'book' ? '📚' : 
                             item.media_type === 'music' ? '🎵' : 
                             item.media_type === 'podcast' ? '🎧' : 
                             item.media_type === 'game' ? '🎮' : '🎭'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{item.title}</h4>
                        <p className="text-sm text-gray-600 truncate">
                          {item.media_type === 'tv' ? 'TV Show' : 
                           item.media_type === 'movie' ? 'Movie' : 
                           item.media_type === 'book' ? 'Book' : 
                           item.media_type === 'music' ? 'Music' : 
                           item.media_type === 'podcast' ? 'Podcast' : 
                           item.media_type === 'game' ? 'Game' : item.type}
                          {item.creator && ` by ${item.creator}`}
                        </p>
                        <p className="text-xs text-purple-600">In {item.listName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show More/Less Button */}
              {filteredMediaHistory.length > 10 && (
                <button
                  onClick={() => setShowAllMediaHistory(!showAllMediaHistory)}
                  className="w-full mt-4 py-3 text-sm font-medium text-purple-700 hover:text-purple-800 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                  data-testid="button-show-more-media"
                >
                  {showAllMediaHistory ? 'Show Less' : `Show ${filteredMediaHistory.length - 10} More`}
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Media History</h3>
              <p className="text-gray-600">No media found matching your current filters</p>
            </div>
          )}
        </div>

        {/* My Lists */}
        <div ref={listsRef} className="px-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Lists</h2>
          </div>

          {isLoadingLists ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your lists...</p>
            </div>
          ) : userLists.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <List className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lists Yet</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Start tracking media to populate your lists.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {userLists.filter(list => list.id !== 'all').map((list, idx) => (
                <div
                  key={list.id}
                  onClick={() => handleListClick(list.title)}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    idx < userLists.filter(l => l.id !== 'all').length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                  data-testid={`list-${list.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <List className="text-purple-600" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-black truncate">{list.title}</h3>
                      <span className="text-xs text-gray-500">{list.items?.length || 0} items</span>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friends Manager - Only show on own profile */}
        {isOwnProfile && user?.id && (
          <div ref={friendsRef} className="px-4 mb-8">
            <FriendsManager userId={user.id} />
          </div>
        )}

        {/* Your Game Stats */}
        <div className="px-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <Gamepad2 className="text-purple-800" size={24} />
              <h2 className="text-xl font-bold text-gray-800">Your Game Stats</h2>
            </div>

            {isLoadingPredictions ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
                <p className="text-gray-600 mt-2">Loading game stats...</p>
              </div>
            ) : userPredictionsList.length > 0 ? (
              <>
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {userPredictionsList.reduce((sum, pred) => sum + (pred.points_earned || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-500">Total Points Earned</div>
                </div>

                <div className="space-y-3 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {showAllGameHistory ? 'All Games' : 'Recent Games (Last 5)'}
                  </h3>
                  {(showAllGameHistory ? userPredictionsList : userPredictionsList.slice(0, 5)).map((pred: any) => (
                    <div 
                      key={pred.pool_id} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`completed-game-${pred.pool_id}`}
                    >
                      <div className="flex items-center space-x-3">
                        {pred.prediction_pools?.type === 'trivia' && <Brain size={18} className="text-blue-600" />}
                        {pred.prediction_pools?.type === 'vote' && <Trophy size={18} className="text-green-600" />}
                        {pred.prediction_pools?.type === 'prediction' && <Trophy size={18} className="text-purple-600" />}
                        <div>
                          <div className="font-medium text-sm text-gray-900">{pred.prediction_pools?.title || 'Unknown Game'}</div>
                          <div className="text-xs text-gray-500 capitalize">{pred.prediction_pools?.type || 'game'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-purple-600">+{pred.points_earned || 0} pts</div>
                    </div>
                  ))}
                </div>

                {userPredictionsList.length > 5 && (
                  <Button
                    onClick={() => setShowAllGameHistory(!showAllGameHistory)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-view-all-game-history"
                  >
                    {showAllGameHistory 
                      ? 'Show Less' 
                      : `View All Game History (${userPredictionsList.length} total)`
                    }
                  </Button>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gamepad2 size={32} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Games Played Yet</h3>
                <p className="text-gray-600 mb-4">Start playing games to earn points and climb the leaderboard!</p>
                <Button 
                  onClick={() => setLocation('/play')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-start-playing"
                >
                  <Play size={16} className="mr-2" />
                  Go to Games
                </Button>
              </div>
            )}
          </div>
        </div>

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
                    toast({
                      title: "Logged out",
                      description: "You have been successfully logged out."
                    });
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
    </>
  );
}