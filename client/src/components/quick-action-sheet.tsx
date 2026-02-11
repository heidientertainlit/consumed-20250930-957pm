import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Star, Vote, Flame, HelpCircle, MessageSquare, Trophy, X, Search, Loader2, Plus, ChevronDown, ListPlus, ArrowLeft, Swords, Folder, Check, Play, Clock, Ban, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/posthog";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import MentionTextarea from "@/components/mention-textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IntentType = "capture" | "say" | "play" | null;
type ActionType = "track" | "post" | "hot_take" | "poll" | "ask_for_recs" | "rank" | "challenge" | null;

interface QuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMedia?: {
    title: string;
    mediaType: string;
    imageUrl?: string;
    externalId?: string;
    externalSource?: string;
    creator?: string;
  } | null;
}

export function QuickActionSheet({ isOpen, onClose, preselectedMedia }: QuickActionSheetProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  const [selectedIntent, setSelectedIntent] = useState<IntentType>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [sayMode, setSayMode] = useState<"thought" | "hot_take" | "ask">("thought");
  const [isPosting, setIsPosting] = useState(false);
  
  const [contentText, setContentText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  
  // Set preselected media and go to track form
  useEffect(() => {
    if (isOpen && preselectedMedia) {
      setSelectedMedia({
        title: preselectedMedia.title,
        type: preselectedMedia.mediaType,
        image_url: preselectedMedia.imageUrl,
        external_id: preselectedMedia.externalId,
        external_source: preselectedMedia.externalSource,
        creator: preselectedMedia.creator,
      });
      setSelectedIntent("capture");
      setSelectedAction("track");
      setAddToList(true);
    }
  }, [isOpen, preselectedMedia]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [ratingValue, setRatingValue] = useState(0);
  const [rewatchCount, setRewatchCount] = useState<number>(1);
  
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  const [recCategory, setRecCategory] = useState<string>("");
  
  const [addToList, setAddToList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("currently");
  const [privateMode, setPrivateMode] = useState(false);
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isListDrawerOpen, setIsListDrawerOpen] = useState(false);
  
  const episodeCache = useRef<Record<string, any[]>>({});

  const { data: userListsData } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user lists');
      return response.json();
    },
    enabled: !!session?.access_token && isOpen,
  });

  const userLists = userListsData?.lists || [];

  const { data: userRanksData } = useQuery<any>({
    queryKey: ['user-ranks'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-ranks`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user ranks');
      return response.json();
    },
    enabled: !!session?.access_token && isOpen && selectedAction === "rank",
  });

  const userRanks = userRanksData?.ranks || [];

  useEffect(() => {
    if (!session?.access_token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => handleMediaSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session?.access_token]);

  useEffect(() => {
    if (selectedMedia?.type === 'tv' && selectedMedia.external_id) {
      fetchSeasons(selectedMedia.external_id);
    } else {
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason(null);
      setSelectedEpisode(null);
    }
  }, [selectedMedia]);

  useEffect(() => {
    if (selectedMedia?.type === 'tv' && selectedMedia.external_id && selectedSeason) {
      fetchEpisodes(selectedMedia.external_id, selectedSeason);
    } else {
      setEpisodes([]);
      setSelectedEpisode(null);
    }
  }, [selectedSeason]);

  const handleMediaSearch = async (query: string) => {
    if (!session?.access_token) return;
    setIsSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/media-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchSeasons = async (externalId: string) => {
    setIsLoadingSeasons(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-media-details?source=tmdb&external_id=${externalId}&media_type=tv`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.seasons?.length > 0) setSeasons(data.seasons);
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    } finally {
      setIsLoadingSeasons(false);
    }
  };

  const fetchEpisodes = async (externalId: string, seasonNum: number) => {
    const cacheKey = `${externalId}-${seasonNum}`;
    if (cacheKey in episodeCache.current) {
      setEpisodes(episodeCache.current[cacheKey]);
      return;
    }
    
    setIsLoadingEpisodes(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-season-episodes?external_id=${externalId}&season=${seasonNum}`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } }
      );
      if (response.ok) {
        const data = await response.json();
        const eps = data.episodes || [];
        episodeCache.current[cacheKey] = eps;
        setEpisodes(eps);
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const resetAll = () => {
    setSelectedIntent(null);
    setSelectedAction(null);
    setSayMode("thought");
    setContentText("");
    setContainsSpoilers(false);
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    setRatingValue(0);
    setRewatchCount(1);
    setPollOptions(["", ""]);
    setRecCategory("");
    setAddToList(false);
    setSelectedListId("currently");
    setPrivateMode(false);
    setSelectedRankId("");
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSeasons([]);
    setEpisodes([]);
    setTrackPostType("thought");
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleIntentSelect = (intent: IntentType) => {
    setSelectedIntent(intent);
    if (intent === "capture") {
      setSelectedAction("track");
    } else if (intent === "say") {
      setSelectedAction("post");
      setSayMode("thought");
    } else if (intent === "play") {
      setSelectedAction(null);
    }
  };

  const handleActionSelect = (action: ActionType) => {
    setSelectedAction(action);
  };

  const handleBack = () => {
    if (selectedAction && selectedIntent === "play") {
      setSelectedAction(null);
    } else if (selectedIntent) {
      setSelectedIntent(null);
      setSelectedAction(null);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handlePost = async () => {
    if (!session?.access_token) return;
    
    setIsPosting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      if (selectedAction === "track") {
        if (!selectedMedia) {
          toast({ title: "Please select media to track", variant: "destructive" });
          return;
        }
        
        // First track the media
        const trackResponse = await fetch(`${supabaseUrl}/functions/v1/track-media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media: {
              title: selectedMedia.title,
              mediaType: selectedMedia.type,
              creator: selectedMedia.creator || '',
              imageUrl: selectedMedia.image || selectedMedia.image_url || '',
              externalId: selectedMedia.external_id,
              externalSource: selectedMedia.external_source || 'tmdb',
            },
            listType: selectedListId || 'currently',
            rating: ratingValue > 0 ? ratingValue : undefined,
            review: trackPostType === 'thought' ? contentText : undefined,
            containsSpoilers,
            privateMode,
            rewatchCount: rewatchCount > 1 ? rewatchCount : undefined,
            seasonNumber: selectedSeason || undefined,
            episodeNumber: selectedEpisode || undefined,
          }),
        });
        
        if (!trackResponse.ok) {
          const errorData = await trackResponse.json().catch(() => ({}));
          console.error('Track media error:', trackResponse.status, errorData);
          throw new Error(errorData.error || 'Failed to track media');
        }
        
        trackEvent('media_tracked', { 
          media_type: selectedMedia.type, 
          list_type: selectedListId || 'currently',
          has_rating: ratingValue > 0
        });
        
        if (trackPostType === 'hot_take' && contentText.trim()) {
          const { data: { user: trackUser } } = await supabase.auth.getUser();
          if (trackUser) {
            await supabase.from('social_posts').insert({
              user_id: trackUser.id,
              content: contentText,
              post_type: 'hot_take',
              visibility: 'public',
              media_title: selectedMedia.title,
              media_type: selectedMedia.type?.toLowerCase(),
              media_external_id: selectedMedia.external_id,
              media_external_source: selectedMedia.external_source || 'tmdb',
              image_url: selectedMedia.image || selectedMedia.image_url || '',
              contains_spoiler: containsSpoilers,
              fire_votes: 0,
              ice_votes: 0,
            });
          }
          } else if (trackPostType === 'poll' && contentText.trim()) {
          const validOptions = pollOptions.filter(o => o.trim());
          if (validOptions.length >= 2) {
            await fetch(`${supabaseUrl}/functions/v1/create-poll`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                question: contentText,
                options: validOptions,
                containsSpoilers,
                mediaId: selectedMedia.external_id,
                mediaType: selectedMedia.type,
                mediaTitle: selectedMedia.title,
              }),
            });
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "post" || selectedAction === "hot_take") {
        if (!contentText.trim()) {
          toast({ title: "Please add some text", variant: "destructive" });
          return;
        }
        
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error('Not authenticated');
        
        const postType = selectedAction === "hot_take" ? "hot_take" : sayMode || "thought";
        const { error } = await supabase.from('social_posts').insert({
          user_id: authUser.id,
          content: contentText,
          post_type: postType,
          visibility: 'public',
          media_title: selectedMedia?.title || null,
          media_type: selectedMedia?.type?.toLowerCase() || null,
          media_external_id: selectedMedia?.external_id || null,
          media_external_source: selectedMedia?.external_source || null,
          image_url: selectedMedia?.image || selectedMedia?.image_url || '',
          contains_spoiler: containsSpoilers,
          fire_votes: 0,
          ice_votes: 0,
        });
        
        if (error) throw error;
        
        toast({ title: selectedAction === "hot_take" ? "Hot Take posted! 🔥" : "Post created!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "poll") {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length < 2) {
          toast({ title: "Add at least 2 options", variant: "destructive" });
          return;
        }
        if (!contentText.trim()) {
          toast({ title: "Please add a question", variant: "destructive" });
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/create-poll`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: contentText,
            options: validOptions,
            containsSpoilers,
            mediaId: selectedMedia?.external_id,
            mediaType: selectedMedia?.type,
            mediaTitle: selectedMedia?.title,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to create poll');
        
        toast({ title: "Poll created!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "ask_for_recs") {
        if (!contentText.trim()) {
          toast({ title: "Please describe what you're looking for", variant: "destructive" });
          return;
        }
        
        const { data: { user: recUser } } = await supabase.auth.getUser();
        if (!recUser) throw new Error('Not authenticated');
        
        const { error: recError } = await supabase.from('social_posts').insert({
          user_id: recUser.id,
          content: contentText,
          post_type: 'ask_for_recs',
          visibility: 'public',
          media_title: selectedMedia?.title || null,
          media_type: selectedMedia?.type?.toLowerCase() || null,
          media_external_id: selectedMedia?.external_id || null,
          media_external_source: selectedMedia?.external_source || null,
          image_url: selectedMedia?.image || selectedMedia?.image_url || '',
          fire_votes: 0,
          ice_votes: 0,
        });
        
        if (recError) throw recError;
        
        toast({ title: "Rec request posted!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "rank") {
        if (!selectedMedia || !selectedRankId) {
          toast({ title: "Please select a rank and media", variant: "destructive" });
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/add-rank-item`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rank_id: selectedRankId,
            media: {
              title: selectedMedia.title,
              media_type: selectedMedia.type,
              creator: selectedMedia.creator || '',
              image_url: selectedMedia.image || selectedMedia.image_url || '',
              external_id: selectedMedia.external_id,
              external_source: selectedMedia.external_source || 'tmdb',
            },
          }),
        });
        
        if (!response.ok) throw new Error('Failed to add to rank');
        
        toast({ title: `Added ${selectedMedia.title} to rank!` });
        queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
      }
      
      handleClose();
    } catch (error) {
      console.error('Post error:', error);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const intents = [
    { 
      id: "capture" as IntentType, 
      label: "Add Media", 
      icon: Plus, 
      iconColor: "text-white", 
      bgColor: "bg-gradient-to-br from-violet-500 to-purple-700", 
      desc: "Track, rate, or review something" 
    },
    { 
      id: "say" as IntentType, 
      label: "Say something", 
      icon: MessageSquare, 
      iconColor: "text-white", 
      bgColor: "bg-gradient-to-br from-blue-500 to-indigo-700", 
      desc: "Share a thought, hot take, or ask for recs" 
    },
    { 
      id: "play" as IntentType, 
      label: "Play", 
      icon: Swords, 
      iconColor: "text-white", 
      bgColor: "bg-gradient-to-br from-fuchsia-500 to-purple-700", 
      desc: "Create a poll, add to rankings" 
    },
  ];

  const playActions = [
    { id: "poll" as ActionType, label: "Create a Poll", icon: Vote, desc: "Ask your friends" },
    { id: "rank" as ActionType, label: "Add to Ranking", icon: Trophy, desc: "Build a ranked list" },
    { id: "challenge" as ActionType, label: "Challenge a Friend", icon: Swords, desc: "Coming soon" },
  ];

  const actions = [
    { id: "track" as ActionType, label: "Track & Rate", icon: Star, iconColor: "text-yellow-500", bgColor: "bg-yellow-50", desc: "Log something you finished" },
    { id: "post" as ActionType, label: "Post", icon: MessageSquare, iconColor: "text-blue-500", bgColor: "bg-blue-50", desc: "Share a thought" },
    { id: "hot_take" as ActionType, label: "Hot Take", icon: Flame, iconColor: "text-orange-500", bgColor: "bg-orange-50", desc: "Drop a spicy opinion" },
    { id: "poll" as ActionType, label: "Poll", icon: Vote, iconColor: "text-purple-500", bgColor: "bg-purple-50", desc: "Ask your friends" },
    { id: "ask_for_recs" as ActionType, label: "Ask for Recs", icon: HelpCircle, iconColor: "text-green-500", bgColor: "bg-green-50", desc: "Get suggestions" },
    { id: "rank" as ActionType, label: "Rank", icon: Trophy, iconColor: "text-amber-500", bgColor: "bg-amber-50", desc: "Add to a ranked list" },
    { id: "challenge" as ActionType, label: "Challenge", icon: Swords, iconColor: "text-pink-500", bgColor: "bg-pink-50", desc: "Challenge a friend" },
  ];

  // Post type state for the inline toggle in track form
  const [trackPostType, setTrackPostType] = useState<"thought" | "hot_take" | "poll">("thought");

  const renderActionContent = () => {
    if (selectedAction === "track") {
      return (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a movie, show, book..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="quick-action-search"
            />
          </div>
          
          {isSearching && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          )}
          
          {!selectedMedia && searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {searchResults.slice(0, 6).map((result, idx) => (
                <button
                  key={`${result.external_id}-${idx}`}
                  onClick={() => {
                    setSelectedMedia(result);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg text-left"
                  data-testid={`search-result-${result.external_id}`}
                >
                  {result.image && (
                    <img src={result.image} alt={result.title} className="w-10 h-14 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{result.title}</p>
                    <p className="text-sm text-gray-500 truncate">{result.type} {result.year && `• ${result.year}`}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {selectedMedia && (
            <div className="space-y-3">
              {/* Selected media card - compact */}
              <div className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg">
                {selectedMedia.image && (
                  <img src={selectedMedia.image} alt={selectedMedia.title} className="w-10 h-14 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{selectedMedia.title}</p>
                  <p className="text-xs text-gray-600">{selectedMedia.type} {selectedMedia.year && `• ${selectedMedia.year}`}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-purple-100 rounded">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
              
              {/* Rating - slider-based with half-star support */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Rating:</span>
                <div className="relative flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div 
                      key={star} 
                      className="relative"
                      style={{ width: 24, height: 24 }}
                    >
                      <Star className="w-6 h-6 text-gray-300 absolute inset-0" />
                      <div 
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ 
                          width: ratingValue >= star ? '100%' : ratingValue >= star - 0.5 ? '50%' : '0%'
                        }}
                      >
                        <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                      </div>
                    </div>
                  ))}
                  {/* Invisible slider overlay for half-star ratings */}
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={ratingValue}
                    onChange={(e) => setRatingValue(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    style={{ margin: 0 }}
                    data-testid="rating-slider"
                  />
                </div>
                {ratingValue > 0 && (
                  <span className="text-sm font-medium text-gray-700">{ratingValue}/5</span>
                )}
              </div>
              
              {/* Post type toggle - Thought, Hot Take, Poll */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTrackPostType("thought")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    trackPostType === "thought"
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Thought
                </button>
                <button
                  onClick={() => setTrackPostType("hot_take")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    trackPostType === "hot_take"
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Flame size={14} className={trackPostType === "hot_take" ? 'text-white' : 'text-orange-500'} />
                  Hot Take
                </button>
                <button
                  onClick={() => setTrackPostType("poll")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    trackPostType === "poll"
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Vote size={14} className={trackPostType === "poll" ? 'text-white' : 'text-purple-500'} />
                  Poll
                </button>
              </div>
              
              {/* Review/Content - right under post type */}
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder={
                  trackPostType === 'thought' ? "Add a review (optional)..." :
                  trackPostType === 'hot_take' ? "Drop your hot take... 🔥" :
                  "Ask a question for your poll..."
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none text-sm"
                rows={2}
                data-testid="track-review-input"
              />
              
              {/* Poll options - only show when poll is selected */}
              {trackPostType === 'poll' && (
                <div className="space-y-2">
                  {pollOptions.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollOptions];
                          newOptions[idx] = e.target.value;
                          setPollOptions(newOptions);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add option
                    </button>
                  )}
                </div>
              )}
              
              {/* List selection - horizontal pills with custom list drawer */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'finished', label: 'Finished' },
                  { id: 'currently', label: 'Currently' },
                  { id: 'queue', label: 'Want To' },
                  { id: 'favorites', label: 'Favorites' },
                  { id: 'dnf', label: 'DNF' },
                ].map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedListId === list.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid={`list-pill-${list.id}`}
                  >
                    {list.label}
                  </button>
                ))}
                {/* Custom lists pill - opens bottom drawer */}
                {userLists.filter((l: any) => !l.is_default).length > 0 && (
                  <button
                    onClick={() => setIsListDrawerOpen(true)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                      !['finished', 'currently', 'queue', 'favorites', 'dnf', ''].includes(selectedListId)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid="custom-list-dropdown"
                  >
                    {!['finished', 'currently', 'queue', 'favorites', 'dnf', ''].includes(selectedListId) 
                      ? userLists.find((l: any) => l.id === selectedListId)?.title || 'Custom'
                      : 'Custom'
                    }
                    <ChevronDown size={14} />
                  </button>
                )}
              </div>
              
              {/* More options toggle */}
              <button
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 py-1"
                data-testid="more-options-toggle"
              >
                <ChevronDown 
                  size={16} 
                  className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} 
                />
                {showMoreOptions ? 'Less options' : 'More options'}
              </button>
              
              {/* Collapsible advanced options */}
              {showMoreOptions && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  {/* TV episode picker */}
                  {selectedMedia.type === 'tv' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Episode</p>
                      {isLoadingSeasons ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="animate-spin" size={14} />
                          Loading...
                        </div>
                      ) : seasons.length > 0 ? (
                        <div className="flex gap-2">
                          <select
                            value={selectedSeason || ""}
                            onChange={(e) => setSelectedSeason(Number(e.target.value) || null)}
                            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                          >
                            <option value="">All seasons</option>
                            {seasons.map((s) => (
                              <option key={s.seasonNumber || s.season_number} value={s.seasonNumber || s.season_number}>
                                S{s.seasonNumber || s.season_number}
                              </option>
                            ))}
                          </select>
                          {selectedSeason && (
                            <select
                              value={selectedEpisode || ""}
                              onChange={(e) => setSelectedEpisode(Number(e.target.value) || null)}
                              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                              disabled={isLoadingEpisodes}
                            >
                              <option value="">{isLoadingEpisodes ? "..." : "All eps"}</option>
                              {episodes.map((ep) => (
                                <option key={ep.episodeNumber || ep.episode_number} value={ep.episodeNumber || ep.episode_number}>
                                  E{ep.episodeNumber || ep.episode_number}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                  
                  {/* Repeat consumption */}
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={rewatchCount > 1} 
                      onCheckedChange={(c) => setRewatchCount(c ? 2 : 1)} 
                      data-testid="rewatch-toggle"
                    />
                    <span className="text-sm text-gray-600">Repeat?</span>
                    {rewatchCount > 1 && (
                      <input
                        type="number"
                        min="2"
                        max="99"
                        value={rewatchCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 2) setRewatchCount(Math.min(99, val));
                        }}
                        className="w-12 px-2 py-1 text-sm border border-gray-200 rounded text-center"
                        data-testid="rewatch-count-input"
                      />
                    )}
                  </div>
                  
                  {/* Privacy options - combined row */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <label className="flex items-center gap-1.5">
                      <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
                      Spoilers
                    </label>
                    <label className="flex items-center gap-1.5">
                      <Checkbox checked={privateMode} onCheckedChange={(c) => setPrivateMode(!!c)} />
                      Don't post to feed
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    
    if (selectedAction === "post" || selectedAction === "hot_take") {
      const isHotTake = selectedAction === "hot_take";
      return (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tag a movie, show, book... (optional)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.slice(0, 4).map((result, idx) => (
                <button
                  key={`${result.external_id}-${idx}`}
                  onClick={() => {
                    setSelectedMedia(result);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left text-sm"
                >
                  {result.image && (
                    <img src={result.image} alt={result.title} className="w-8 h-10 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    <p className="text-xs text-gray-500">{result.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {selectedMedia && (
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
              {selectedMedia.image && (
                <img src={selectedMedia.image} alt={selectedMedia.title} className="w-8 h-10 object-cover rounded" />
              )}
              <span className="flex-1 text-sm font-medium truncate">{selectedMedia.title}</span>
              <button onClick={() => setSelectedMedia(null)} className="p-1">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
          )}
          
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder={isHotTake ? "Drop your hottest take... 🔥" : "What's on your mind?"}
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={4}
            data-testid="post-content-input"
          />
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
            Contains spoilers
          </label>
        </div>
      );
    }
    
    if (selectedAction === "poll") {
      return (
        <div className="space-y-4">
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Ask a question..."
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={2}
            data-testid="poll-question-input"
          />
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Options</label>
            {pollOptions.map((option, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...pollOptions];
                    newOptions[idx] = e.target.value;
                    setPollOptions(newOptions);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  data-testid={`poll-option-${idx}`}
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <button
                onClick={() => setPollOptions([...pollOptions, ""])}
                className="text-sm text-purple-600 font-medium"
              >
                + Add option
              </button>
            )}
          </div>
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
            Contains spoilers
          </label>
        </div>
      );
    }
    
    if (selectedAction === "ask_for_recs") {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">What are you looking for?</label>
            <select
              value={recCategory}
              onChange={(e) => setRecCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Anything</option>
              <option value="movies">Movies</option>
              <option value="tv">TV Shows</option>
              <option value="books">Books</option>
              <option value="music">Music</option>
              <option value="podcasts">Podcasts</option>
              <option value="games">Games</option>
            </select>
          </div>
          
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Describe what you're in the mood for..."
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={4}
            data-testid="recs-content-input"
          />
        </div>
      );
    }
    
    if (selectedAction === "rank") {
      return (
        <div className="space-y-4">
          {userRanks.length === 0 ? (
            <div className="text-center py-8">
              <Trophy size={48} className="mx-auto text-amber-500" />
              <div className="mt-4">
                <h3 className="font-semibold text-lg">No Ranked Lists Yet</h3>
                <p className="text-gray-600 mt-2">
                  Create your first ranked list in Collections.
                </p>
              </div>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = "/collections?tab=ranks";
                }}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
              >
                Go to Collections
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Add to which rank?</label>
                <select
                  value={selectedRankId}
                  onChange={(e) => setSelectedRankId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="select-rank"
                >
                  <option value="">Select a ranked list...</option>
                  {userRanks.map((rank: any) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.title}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedRankId && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for media to add..."
                      className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      data-testid="rank-media-search"
                    />
                  </div>
                  
                  {isSearching && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="animate-spin text-purple-500" size={24} />
                    </div>
                  )}
                  
                  {!selectedMedia && searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {searchResults.slice(0, 6).map((result, idx) => (
                        <button
                          key={`${result.external_id}-${idx}`}
                          onClick={() => {
                            setSelectedMedia(result);
                            setSearchResults([]);
                            setSearchQuery("");
                          }}
                          className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg text-left"
                        >
                          {result.image && (
                            <img src={result.image} alt={result.title} className="w-10 h-14 object-cover rounded" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{result.title}</p>
                            <p className="text-sm text-gray-500 truncate">{result.type} {result.year && `• ${result.year}`}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedMedia && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                      {selectedMedia.image && (
                        <img src={selectedMedia.image} alt={selectedMedia.title} className="w-12 h-16 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{selectedMedia.title}</p>
                        <p className="text-sm text-gray-600">{selectedMedia.type} {selectedMedia.year && `• ${selectedMedia.year}`}</p>
                      </div>
                      <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-amber-100 rounded">
                        <X size={18} className="text-gray-500" />
                      </button>
                    </div>
                  )}
                </>
              )}
              
              <div className="pt-2 border-t">
                <button
                  onClick={() => {
                    handleClose();
                    window.location.href = "/collections?tab=ranks";
                  }}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create new ranked list instead →
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    
    if (selectedAction === "challenge") {
      return (
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 flex items-center justify-center">
              <Swords size={32} className="text-pink-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Challenge a Friend</h3>
            <p className="text-gray-500 text-sm">Create a custom challenge and invite friends to compete!</p>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Challenge title (e.g., 'Best 90s Movie')"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
              data-testid="challenge-title-input"
            />
            
            <textarea
              placeholder="Describe your challenge..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white resize-none"
              rows={3}
              data-testid="challenge-description-input"
            />
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search friends to challenge..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                data-testid="challenge-friend-search"
              />
            </div>
          </div>
          
          <p className="text-center text-xs text-gray-400 pt-2">
            Coming soon! Challenge functionality will be available shortly.
          </p>
        </div>
      );
    }
    
    return null;
  };

  const canPost = () => {
    if (selectedAction === "track") return !!selectedMedia;
    // Allow posting with just a rating OR just content (text is optional if rating is set)
    if (selectedAction === "post" || selectedAction === "hot_take") return !!contentText.trim() || ratingValue > 0;
    if (selectedAction === "poll") return !!contentText.trim() && pollOptions.filter(o => o.trim()).length >= 2;
    if (selectedAction === "ask_for_recs") return !!contentText.trim();
    if (selectedAction === "rank") return !!selectedMedia && !!selectedRankId;
    if (selectedAction === "challenge") return false;
    return false;
  };

  const getSheetTitle = () => {
    if (!selectedIntent) return null;
    if (selectedIntent === "capture") return "Add Media";
    if (selectedIntent === "say") return "Say something";
    if (selectedIntent === "play" && !selectedAction) return "Play";
    if (selectedAction) return actions.find(a => a.id === selectedAction)?.label;
    return null;
  };

  const renderPlayHub = () => {
    return (
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-1 gap-3">
          {playActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionSelect(action.id)}
              className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              data-testid={`play-action-${action.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <action.icon size={20} className="text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">{action.label}</p>
                <p className="text-sm text-gray-500">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
        
        <div className="pt-2 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400 py-2">
            Or explore the Play page for trivia, predictions & more
          </p>
        </div>
      </div>
    );
  };

  const renderSayContent = () => {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setSayMode("thought"); setSelectedAction("post"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "thought" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-thought"
          >
            Thought
          </button>
          <button
            onClick={() => { setSayMode("hot_take"); setSelectedAction("hot_take"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "hot_take" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-hot-take"
          >
            Hot Take
          </button>
          <button
            onClick={() => { setSayMode("ask"); setSelectedAction("ask_for_recs"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "ask" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-ask"
          >
            Ask
          </button>
        </div>
        
        <MentionTextarea
          value={contentText}
          onChange={setContentText}
          session={session}
          placeholder={
            sayMode === "thought" ? "What's on your mind?" :
            sayMode === "hot_take" ? "Drop your spicy take..." :
            "What are you looking for?"
          }
          className="min-h-[100px] bg-white text-gray-900 border border-gray-200 rounded-xl"
          testId="say-content-input"
        />
        
        {sayMode === "ask" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Category (optional)</p>
            <div className="flex flex-wrap gap-2">
              {["Movies", "TV Shows", "Books", "Music", "Podcasts", "Games"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setRecCategory(recCategory === cat ? "" : cat)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    recCategory === cat
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  data-testid={`rec-category-${cat.toLowerCase()}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tag Media Section */}
        {(sayMode === "thought" || sayMode === "hot_take") && (
          <div className="space-y-2">
            {!selectedMedia ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tag a movie, show, book... (optional)"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="say-media-search"
                />
              </div>
            ) : null}
            
            {isSearching && (
              <div className="flex justify-center py-2">
                <Loader2 className="animate-spin text-purple-500" size={20} />
              </div>
            )}
            
            {!selectedMedia && searchResults.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-2">
                {searchResults.slice(0, 4).map((result, idx) => (
                  <button
                    key={`${result.external_id}-${idx}`}
                    onClick={() => {
                      setSelectedMedia(result);
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left"
                    data-testid={`say-search-result-${result.external_id}`}
                  >
                    {result.image && (
                      <img src={result.image} alt={result.title} className="w-8 h-10 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {selectedMedia && (
              <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                {selectedMedia.image && (
                  <img src={selectedMedia.image} alt={selectedMedia.title} className="w-8 h-10 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedMedia.title}</p>
                  <p className="text-xs text-gray-500 truncate">{selectedMedia.type}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-purple-100 rounded">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="spoilers"
            checked={containsSpoilers}
            onCheckedChange={(checked) => setContainsSpoilers(!!checked)}
          />
          <label htmlFor="spoilers" className="text-sm text-gray-600">
            Contains spoilers
          </label>
        </div>
      </div>
    );
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto !bg-white border-t border-gray-100" style={{ backgroundColor: 'white' }}>
        {!selectedIntent ? (
          <>
            <SheetHeader className="pb-4">
              <SheetTitle className="text-center text-gray-900 text-xl font-semibold">What's on your mind?</SheetTitle>
            </SheetHeader>
            
            <div className="flex flex-col gap-3 pb-6 px-4">
              {intents.map((intent) => (
                <button
                  key={intent.id}
                  onClick={() => handleIntentSelect(intent.id)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  data-testid={`intent-${intent.id}`}
                >
                  <div className={`w-14 h-14 rounded-xl ${intent.bgColor} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <intent.icon size={24} className="text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-gray-900 text-base">{intent.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{intent.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="relative flex items-center justify-center">
                <button onClick={handleBack} className="absolute left-0 p-2 hover:bg-gray-100 rounded-full" data-testid="back-button">
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <SheetTitle className="text-gray-900 text-lg font-semibold">
                  {getSheetTitle()}
                </SheetTitle>
              </div>
            </SheetHeader>
            
            {selectedIntent === "play" && !selectedAction ? (
              renderPlayHub()
            ) : selectedIntent === "say" && selectedAction !== "poll" && selectedAction !== "rank" ? (
              renderSayContent()
            ) : (
              renderActionContent()
            )}
            
            {selectedAction && selectedAction !== "challenge" && (selectedAction !== "rank" || (selectedAction === "rank" && userRanks.length > 0)) && (
              <div className="pt-4 pb-2">
                <Button
                  onClick={handlePost}
                  disabled={!canPost() || isPosting}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6"
                  data-testid="submit-action"
                >
                  {isPosting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    selectedAction === "track" ? "Add Media" : 
                    selectedAction === "rank" ? "Add to Rank" : 
                    sayMode === "hot_take" ? "Drop It 🔥" :
                    sayMode === "ask" ? "Ask" :
                    "Share"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>

    {/* List Selection Drawer */}
    <Drawer open={isListDrawerOpen} onOpenChange={setIsListDrawerOpen}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">Add to List</DrawerTitle>
          {selectedMedia && (
            <p className="text-sm text-gray-500 mt-1">{selectedMedia.title}</p>
          )}
        </DrawerHeader>
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          <button
            onClick={() => setIsListDrawerOpen(false)}
            className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <X className="text-gray-500" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Cancel</p>
              <p className="text-sm text-gray-500">Go back</p>
            </div>
          </button>
          {userLists.map((list: any) => {
            const getListStyle = (title: string) => {
              const lower = title.toLowerCase();
              if (lower.includes('currently') || lower.includes('watching') || lower.includes('reading')) {
                return { bg: 'bg-purple-100', icon: <Play className="text-purple-600" size={20} /> };
              }
              if (lower.includes('queue') || lower.includes('want')) {
                return { bg: 'bg-blue-100', icon: <Clock className="text-blue-600" size={20} /> };
              }
              if (lower.includes('finished') || lower.includes('complete')) {
                return { bg: 'bg-green-100', icon: <Check className="text-green-600" size={20} /> };
              }
              if (lower.includes('dnf') || lower.includes('not finish')) {
                return { bg: 'bg-red-100', icon: <Ban className="text-red-600" size={20} /> };
              }
              if (lower.includes('favorite')) {
                return { bg: 'bg-yellow-100', icon: <Heart className="text-yellow-600" size={20} /> };
              }
              return { bg: 'bg-purple-100', icon: <Folder className="text-purple-600" size={20} /> };
            };
            const style = getListStyle(list.title);
            const desc = list.title.toLowerCase().includes('currently') ? 'Currently consuming' :
                         list.title.toLowerCase().includes('queue') || list.title.toLowerCase().includes('want') ? 'Save for later' :
                         list.title.toLowerCase().includes('finished') ? 'Completed media' :
                         list.title.toLowerCase().includes('dnf') ? 'Stopped watching/reading' :
                         list.title.toLowerCase().includes('favorite') ? 'Your favorites' : 'Custom list';
            
            return (
              <button
                key={list.id}
                onClick={() => {
                  setSelectedListId(list.id);
                  setIsListDrawerOpen(false);
                }}
                className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <div className={`w-10 h-10 ${style.bg} rounded-full flex items-center justify-center`}>
                  {style.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{list.title}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
                {selectedListId === list.id && (
                  <Check size={20} className="text-purple-600" />
                )}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
}
