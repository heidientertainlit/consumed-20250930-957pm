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
type ActionType = "track" | "post" | "prediction" | "rank" | "challenge" | null;

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
  roomId?: string | null;
  onPosted?: () => void;
  preselectedIntent?: "capture" | null;
}

export function QuickActionSheet({ isOpen, onClose, preselectedMedia, roomId, onPosted, preselectedIntent }: QuickActionSheetProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  const [selectedIntent, setSelectedIntent] = useState<IntentType>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [sayMode, setSayMode] = useState<"review" | "ask">("review");
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
    } else if (isOpen && roomId && !preselectedMedia) {
      // Room discussion: open Add Media flow so users can search + post media to the room
      setSelectedIntent("capture");
      setSelectedAction("track");
      setShareToFeed(false);
    } else if (isOpen && preselectedIntent === "capture" && !preselectedMedia && !roomId) {
      // Direct Add Media flow (e.g. from "Have a Take?" score card button)
      setSelectedIntent("capture");
      setSelectedAction("track");
    }
    if (isOpen && !roomId) {
      setShareToFeed(true);
    }
  }, [isOpen, preselectedMedia, roomId, preselectedIntent]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [ratingValue, setRatingValue] = useState(0);
  const [rewatchCount, setRewatchCount] = useState<number>(1);
  
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  const [recCategory, setRecCategory] = useState<string>("");
  
  const [addToList, setAddToList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [privateMode, setPrivateMode] = useState(false);
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  const [trackPostType, setTrackPostType] = useState<"review" | "prediction" | "hot_take" | "question" | "rank">("review");

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isListDrawerOpen, setIsListDrawerOpen] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  
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
    enabled: !!session?.access_token && isOpen && (selectedAction === "rank" || trackPostType === "rank"),
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
    setTrackPostType("review");
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
      setSayMode("review");
    } else if (intent === "play") {
      setSelectedAction(null);
    }
  };

  const handleActionSelect = (action: ActionType) => {
    setSelectedAction(action);
  };

  const handleBack = () => {
    // If opened directly into the room composer, back = close
    if (roomId && (selectedIntent === "say" || selectedIntent === "capture")) {
      handleClose();
      return;
    }
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
        if (!selectedMedia && !roomId) {
          toast({ title: "Please select media to track", variant: "destructive" });
          return;
        }
        
        // Room mode: post to social_posts directly, optionally also track media
        if (roomId) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error('Not authenticated');
          const postType = trackPostType === 'review' ? 'rate_review' : 'predict';
          const { error: postError } = await supabase.from('social_posts').insert({
            user_id: authUser.id,
            content: contentText || null,
            post_type: postType,
            // Room posts must be 'public' so the RLS policy lets all members read them.
            // They are kept out of the main feed by the room_id IS NULL filter in social-feed.
            visibility: 'public',
            media_title: selectedMedia?.title || null,
            media_type: selectedMedia?.type?.toLowerCase() || null,
            media_external_id: selectedMedia?.external_id || null,
            media_external_source: selectedMedia?.external_source || null,
            image_url: selectedMedia?.image || selectedMedia?.image_url || '',
            rating: ratingValue > 0 ? ratingValue : null,
            contains_spoilers: containsSpoilers,
            fire_votes: 0,
            ice_votes: 0,
            room_id: roomId,
          });
          if (postError) throw postError;
          // Also track to list if media selected and a list is chosen
          if (selectedMedia && addToList) {
            await fetch(`${supabaseUrl}/functions/v1/track-media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
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
                privateMode: true, // don't double-post to feed
              }),
            });
          }
          queryClient.invalidateQueries({ queryKey: ['room-posts', roomId] });
          queryClient.invalidateQueries({ queryKey: ['social-feed'] });
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          onPosted?.();
          handleClose();
          return;
        }
        
        // ── Hot Take ──────────────────────────────────────────────────────────
        if (trackPostType === 'hot_take') {
          if (!contentText.trim()) {
            toast({ title: "Please write your hot take", variant: "destructive" });
            return;
          }
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error('Not authenticated');
          if (selectedMedia && addToList) {
            await fetch(`${supabaseUrl}/functions/v1/track-media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
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
                privateMode: true,
              }),
            });
          }
          const { error: htErr } = await supabase.from('social_posts').insert({
            user_id: authUser.id,
            content: contentText,
            post_type: 'hot_take',
            visibility: 'public',
            media_title: selectedMedia?.title || null,
            media_type: selectedMedia?.type?.toLowerCase() || null,
            media_external_id: selectedMedia?.external_id || null,
            media_external_source: selectedMedia?.external_source || null,
            image_url: selectedMedia?.image || selectedMedia?.image_url || '',
            contains_spoilers: containsSpoilers,
            fire_votes: 0,
            ice_votes: 0,
          });
          if (htErr) throw htErr;
          queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
          queryClient.invalidateQueries({ queryKey: ['social-feed'] });
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          
          handleClose();
          return;
        }

        // ── Question ───────────────────────────────────────────────────────────
        if (trackPostType === 'question') {
          if (!contentText.trim()) {
            toast({ title: "Please write your question", variant: "destructive" });
            return;
          }
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error('Not authenticated');
          if (selectedMedia && addToList) {
            await fetch(`${supabaseUrl}/functions/v1/track-media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
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
                privateMode: true,
              }),
            });
          }
          const { error: qErr } = await supabase.from('social_posts').insert({
            user_id: authUser.id,
            content: contentText,
            post_type: 'question',
            visibility: 'public',
            media_title: selectedMedia?.title || null,
            media_type: selectedMedia?.type?.toLowerCase() || null,
            media_external_id: selectedMedia?.external_id || null,
            media_external_source: selectedMedia?.external_source || null,
            image_url: selectedMedia?.image || selectedMedia?.image_url || '',
            contains_spoilers: false,
            fire_votes: 0,
            ice_votes: 0,
          });
          if (qErr) throw qErr;
          queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
          queryClient.invalidateQueries({ queryKey: ['social-feed'] });
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          toast({ title: "Question posted!" });
          handleClose();
          return;
        }

        // ── Rank (add media to an existing rank) ───────────────────────────────
        if (trackPostType === 'rank') {
          if (!selectedRankId) {
            toast({ title: "Please select a rank", variant: "destructive" });
            return;
          }
          if (!selectedMedia) {
            toast({ title: "Please select media to rank", variant: "destructive" });
            return;
          }
          const rankResp = await fetch(`${supabaseUrl}/functions/v1/add-rank-item`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
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
          if (!rankResp.ok) throw new Error('Failed to add to rank');
          const rankName = userRanks.find((r: any) => r.id === selectedRankId)?.title || 'rank';
          toast({ title: `Added ${selectedMedia.title} to ${rankName}!` });
          queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
          queryClient.invalidateQueries({ queryKey: ['social-feed'] });
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          handleClose();
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
            review: trackPostType === 'review' ? contentText : undefined,
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
        
        if (trackPostType === 'prediction' && contentText.trim()) {
          const validPredOptions = pollOptions.filter(o => o.trim());
          if (validPredOptions.length >= 2) {
            await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                question: contentText,
                options: validPredOptions,
                type: "predict",
                media_external_id: selectedMedia.external_id || null,
                media_external_source: selectedMedia.external_source || null,
                media_title: selectedMedia.title || null,
                media_type: selectedMedia.media_type || selectedMedia.type || null,
              }),
            });
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "post") {
        if (!contentText.trim()) {
          toast({ title: "Please add some text", variant: "destructive" });
          return;
        }
        
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error('Not authenticated');
        
        const postType = sayMode || "review";
        const { error } = await supabase.from('social_posts').insert({
          user_id: authUser.id,
          content: contentText,
          post_type: postType,
          visibility: roomId && !shareToFeed ? 'private' : 'public',
          media_title: selectedMedia?.title || null,
          media_type: selectedMedia?.type?.toLowerCase() || null,
          media_external_id: selectedMedia?.external_id || null,
          media_external_source: selectedMedia?.external_source || null,
          image_url: selectedMedia?.image || selectedMedia?.image_url || '',
          contains_spoilers: containsSpoilers,
          fire_votes: 0,
          ice_votes: 0,
          room_id: roomId || null,
        });
        
        if (error) throw error;
        
        if (roomId) {
          queryClient.invalidateQueries({ queryKey: ['room-posts', roomId] });
          onPosted?.();
        }
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "prediction") {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length < 2) {
          toast({ title: "Add at least 2 options", variant: "destructive" });
          return;
        }
        if (!contentText.trim()) {
          toast({ title: "Please add your prediction question", variant: "destructive" });
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: contentText,
            options: validOptions,
            type: "predict",
            media_external_id: selectedMedia?.external_id || null,
            media_external_source: selectedMedia?.external_source || null,
            media_title: selectedMedia?.title || null,
            media_type: selectedMedia?.media_type || selectedMedia?.type || null,
          }),
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error('Create prediction error:', errData);
          throw new Error('Failed to create prediction');
        }
        
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
    { id: "prediction" as ActionType, label: "Create a Prediction", icon: Vote, desc: "Predict what happens next" },
    { id: "challenge" as ActionType, label: "Challenge a Friend", icon: Swords, desc: "Coming soon" },
  ];

  const actions = [
    { id: "track" as ActionType, label: "Track & Rate", icon: Star, iconColor: "text-yellow-500", bgColor: "bg-yellow-50", desc: "Log something you finished" },
    { id: "post" as ActionType, label: "Post", icon: MessageSquare, iconColor: "text-blue-500", bgColor: "bg-blue-50", desc: "Share a thought" },
    { id: "prediction" as ActionType, label: "Prediction", icon: Vote, iconColor: "text-purple-500", bgColor: "bg-purple-50", desc: "Predict what happens next" },
    { id: "challenge" as ActionType, label: "Challenge", icon: Swords, iconColor: "text-pink-500", bgColor: "bg-pink-50", desc: "Challenge a friend" },
  ];

  const renderActionContent = () => {
    if (selectedAction === "track") {
      const isRoomMode = !!roomId;
      return (
        <div className="space-y-4">
          {/* Media search — required normally, optional in room mode */}
          {!selectedMedia && (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRoomMode ? "Tag a movie, show, book... (optional)" : "Search for a movie, show, book..."}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="quick-action-search"
                />
              </div>

              {isSearching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-purple-500" size={24} />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2 mt-2">
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
            </div>
          )}

          {/* Show full form: media selected normally, OR always in room mode, OR direct capture (so user sees form before searching) */}
          {(selectedMedia || isRoomMode || preselectedIntent === "capture") && (
            <div className="space-y-3">
              {/* Media card — shown when media is selected */}
              {selectedMedia && (
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
              )}

              {/* Rating - only for review / prediction */}
              {(trackPostType === 'review' || trackPostType === 'prediction') && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Rating:</span>
                  <div className="relative flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div key={star} className="relative" style={{ width: 24, height: 24 }}>
                        <Star className="w-6 h-6 text-gray-300 absolute inset-0" />
                        <div
                          className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ width: ratingValue >= star ? '100%' : ratingValue >= star - 0.5 ? '50%' : '0%' }}
                        >
                          <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                        </div>
                      </div>
                    ))}
                    <input
                      type="range" min="0" max="5" step="0.5"
                      value={ratingValue}
                      onChange={(e) => setRatingValue(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      style={{ margin: 0 }}
                      data-testid="rating-slider"
                    />
                  </div>
                  {ratingValue > 0 && <span className="text-sm font-medium text-gray-700">{ratingValue}/5</span>}
                </div>
              )}

              {/* Post type toggle - all 5 types */}
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { key: 'review'     as const, label: 'Rate / Review' },
                  { key: 'prediction' as const, label: 'Prediction'    },
                  { key: 'hot_take'   as const, label: 'Hot Take'      },
                  { key: 'question'   as const, label: 'Question'      },
                  { key: 'rank'       as const, label: 'Rank'          },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTrackPostType(key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      trackPostType === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Text area — hidden for Rank tab */}
              {trackPostType !== 'rank' && (
                <textarea
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder={
                    trackPostType === 'review'     ? "Write your review..." :
                    trackPostType === 'prediction' ? "What do you predict?" :
                    trackPostType === 'hot_take'   ? "Drop your hot take — don't hold back…" :
                    trackPostType === 'question'   ? "Ask the room a question…" :
                    ""
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none text-sm"
                  rows={trackPostType === 'hot_take' ? 4 : 3}
                />
              )}

              {/* Prediction poll options */}
              {trackPostType === 'prediction' && (
                <div className="space-y-2">
                  {pollOptions.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text" value={option}
                        onChange={(e) => { const n = [...pollOptions]; n[idx] = e.target.value; setPollOptions(n); }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} className="p-1 text-gray-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                      + Add option
                    </button>
                  )}
                </div>
              )}

              {/* Hot Take — spoiler toggle */}
              {trackPostType === 'hot_take' && (
                <button
                  type="button"
                  onClick={() => setContainsSpoilers(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    containsSpoilers ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2"><span>⚠️</span> Contains spoilers</span>
                  <div className="w-8 h-4 rounded-full relative transition-colors" style={{ background: containsSpoilers ? '#fbbf24' : '#d1d5db' }}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${containsSpoilers ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              )}

              {/* Rank — rank selector */}
              {trackPostType === 'rank' && (
                <div className="space-y-3">
                  {userRanks.length === 0 ? (
                    <div className="text-center py-4">
                      <Trophy size={28} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-1">No ranked lists yet</p>
                      <button
                        type="button"
                        onClick={() => { handleClose(); window.location.href = "/collections?tab=ranks"; }}
                        className="text-sm text-purple-600 font-medium"
                      >
                        Create a ranked list →
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add to which rank?</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {userRanks.map((rank: any) => (
                          <button
                            key={rank.id}
                            type="button"
                            onClick={() => setSelectedRankId(rank.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                              selectedRankId === rank.id
                                ? 'bg-purple-50 border-purple-300 text-purple-800'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <Trophy size={14} className={selectedRankId === rank.id ? 'text-purple-500' : 'text-gray-400'} />
                            <span className="flex-1 truncate">{rank.title}</span>
                            {selectedRankId === rank.id && <Check size={14} className="text-purple-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => { handleClose(); window.location.href = "/collections?tab=ranks"; }}
                        className="text-xs text-purple-600 font-medium"
                      >
                        + Create new ranked list
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Status pills + advanced options — only shown when media is selected */}
              {selectedMedia && (
                <>
                  {/* Add to list — compact dropdown row */}
                  <div className="flex items-center gap-2">
                    {selectedListId ? (
                      <>
                        <ListPlus size={18} className="text-purple-500 shrink-0" />
                        <select
                          value={selectedListId}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              setSelectedListId(null);
                              setAddToList(false);
                            } else {
                              setSelectedListId(e.target.value);
                              setAddToList(true);
                            }
                          }}
                          className="flex-1 text-base border border-purple-300 bg-purple-50 text-purple-800 rounded-xl px-3 py-4 font-medium focus:outline-none"
                          data-testid="list-dropdown"
                        >
                          <option value="finished">Finished</option>
                          <option value="currently">Currently</option>
                          <option value="queue">Want To</option>
                          <option value="favorites">Favorites</option>
                          <option value="dnf">DNF</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => { setSelectedListId(null); setAddToList(false); }}
                          className="p-2 text-gray-400 hover:text-gray-600 shrink-0"
                          aria-label="Remove from list"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSelectedListId('currently'); setAddToList(true); }}
                        className="flex items-center gap-2 text-base text-gray-500 hover:text-purple-600 transition-colors py-2"
                        data-testid="add-to-list-btn"
                      >
                        <ListPlus size={18} />
                        Add to a list
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 py-1"
                    data-testid="more-options-toggle"
                  >
                    <ChevronDown size={16} className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
                    {showMoreOptions ? 'Less options' : 'More options'}
                  </button>

                  {showMoreOptions && (
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={rewatchCount > 1} onCheckedChange={(c) => setRewatchCount(c ? 2 : 1)} data-testid="rewatch-toggle" />
                        <span className="text-sm text-gray-600">Repeat?</span>
                        {rewatchCount > 1 && (
                          <input type="number" min="2" max="99" value={rewatchCount}
                            onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 2) setRewatchCount(Math.min(99, val)); }}
                            className="w-12 px-2 py-1 text-sm border border-gray-200 rounded text-center"
                            data-testid="rewatch-count-input"
                          />
                        )}
                      </div>
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

                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      );
    }
    
    if (selectedAction === "post") {
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
            placeholder="What's on your mind?"
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
    
    if (selectedAction === "prediction") {
      return (
        <div className="space-y-4">
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="What do you predict?"
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={2}
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
          </div>
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
            Contains spoilers
          </label>
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
    if (selectedAction === "track") {
      if (roomId) return !!contentText.trim() || ratingValue > 0 || !!selectedMedia;
      if (trackPostType === 'hot_take') return !!contentText.trim() && !!selectedMedia;
      if (trackPostType === 'question')  return !!contentText.trim();
      if (trackPostType === 'rank')      return !!selectedMedia && !!selectedRankId;
      return !!selectedMedia; // review / prediction
    }
    // Allow posting with just a rating OR just content (text is optional if rating is set)
    if (selectedAction === "post") return !!contentText.trim() || ratingValue > 0;
    if (selectedAction === "prediction") return !!contentText.trim() && pollOptions.filter(o => o.trim()).length >= 2;
    if (selectedAction === "rank") return !!selectedMedia && !!selectedRankId;
    if (selectedAction === "challenge") return false;
    return false;
  };

  const getSheetTitle = () => {
    if (!selectedIntent) return null;
    if (selectedIntent === "capture") return roomId ? "Share to Room" : "Add Media";
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
            onClick={() => { setSayMode("review"); setSelectedAction("post"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "review" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-thought"
          >
            Thought
          </button>
        </div>
        
        <MentionTextarea
          value={contentText}
          onChange={setContentText}
          session={session}
          placeholder={
            "What's on your mind?"
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
        {sayMode === "review" && (
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
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85svh] overflow-y-auto !bg-white border-t border-gray-100 pb-safe" style={{ backgroundColor: 'white', maxHeight: '85svh' }}>
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
            ) : selectedIntent === "say" && selectedAction !== "prediction" && selectedAction !== "rank" ? (
              renderSayContent()
            ) : (
              renderActionContent()
            )}
            
            {selectedAction && selectedAction !== "challenge" && (selectedAction !== "rank" || (selectedAction === "rank" && userRanks.length > 0)) && (
              <div className="pt-4 pb-20 space-y-3">
                {roomId && (selectedAction === "post" || selectedAction === "track") && (
                  <button
                    onClick={() => setShareToFeed(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-gray-800">Also share to main feed</span>
                      <span className="text-xs text-gray-400">Your followers will see this too</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${shareToFeed ? 'bg-purple-600' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${shareToFeed ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </button>
                )}
                <Button
                  onClick={handlePost}
                  disabled={!canPost() || isPosting}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6"
                  data-testid="submit-action"
                >
                  {isPosting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    selectedAction === "track" ? (
                      roomId ? "Share" :
                      (trackPostType === 'hot_take' || trackPostType === 'question') ? "Post" :
                      "Add Media"
                    ) : 
                    selectedAction === "rank" ? "Add to Rank" : 
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
          {userLists.filter((list: any) => {
            const lower = (list.title || '').toLowerCase();
            return list.is_default && (lower.includes('currently') || lower.includes('want') ||
              lower.includes('finished') || lower.includes('not finish') || lower.includes('favorite'));
          }).map((list: any) => {
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
