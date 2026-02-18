import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Star, Target, Vote, MessageCircle, Loader2, Search, ListPlus, Plus, User, ChevronDown, Flame } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MentionTextarea from "@/components/mention-textarea";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type ComposerStage = "open" | "media-search";
type PostType = "thought" | "review" | "prediction" | "hot_take";

interface InlineComposerProps {
  defaultType?: PostType;
  onPostSuccess?: () => void;
}

export default function InlineComposer({ defaultType, onPostSuccess }: InlineComposerProps = {}) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  // Stage management - start open for frictionless experience
  const [stage, setStage] = useState<ComposerStage>("open");
  const [isExpanded, setIsExpanded] = useState(!!defaultType); // Auto-expand when opened with a type
  const [isMediaSearchOpen, setIsMediaSearchOpen] = useState(false); // Inline media search
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [postType, setPostType] = useState<PostType>(defaultType || "thought");
  
  // Media search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Content state - unified text field
  const [contentText, setContentText] = useState("");
  
  // Rating-specific state
  const [ratingValue, setRatingValue] = useState(0);
  const [rewatchCount, setRewatchCount] = useState<number>(1);
  
  // Prediction-specific state  
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["", ""]);
  const [creatorPrediction, setCreatorPrediction] = useState<string>("");
  
  
  
  // Optional actions - Add to list / Add to rank
  const [addToList, setAddToList] = useState(false);
  const [addToRank, setAddToRank] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  const [postToFeed, setPostToFeed] = useState(true); // Toggle to skip feed post when adding to list
  
  // Common state
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  
  // Episode tracking state for TV shows
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [selectedEpisodeTitle, setSelectedEpisodeTitle] = useState<string>("");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  
  // Cache for episode data to avoid re-fetching
  const episodeCache = useRef<Record<string, any[]>>({});

  // Fetch user's lists (for optional add to list)
  const { data: userListsData } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user lists');
      }

      return response.json();
    },
    enabled: !!session?.access_token && stage === "open",
  });

  const userLists = userListsData?.lists || [];

  // Fetch user's ranks (for optional add to rank)
  const { data: userRanksData } = useQuery<any>({
    queryKey: ['user-ranks'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-ranks`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user ranks');
      }

      return response.json();
    },
    enabled: !!session?.access_token && stage === "open",
  });

  const userRanks = userRanksData?.ranks || [];

  // Auto-search when query changes
  useEffect(() => {
    if (!session?.access_token) {
      console.log("No session token yet, skipping search");
      return;
    }
    
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleMediaSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session?.access_token]);

  const resetComposer = () => {
    // Stay open but clear all fields
    setStage("open");
    setIsMediaSearchOpen(false);
    setSelectedMedia(null);
    setPostType("thought");
    setSearchQuery("");
    setSearchResults([]);
    setContentText("");
    setRatingValue(0);
    setRewatchCount(1);
    setPredictionOptions(["", ""]);
    setCreatorPrediction("");
    setAddToList(false);
    setAddToRank(false);
    setSelectedListId("");
    setSelectedRankId("");
    setPostToFeed(true);
    setContainsSpoilers(false);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSelectedEpisodeTitle("");
    setSeasons([]);
    setEpisodes([]);
  };
  
  // Fetch seasons when a TV show is selected
  useEffect(() => {
    if (selectedMedia && selectedMedia.type === 'tv' && selectedMedia.external_id) {
      fetchSeasons(selectedMedia.external_id);
    } else {
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason(null);
      setSelectedEpisode(null);
    }
  }, [selectedMedia]);
  
  // Fetch episodes when a season is selected
  useEffect(() => {
    if (selectedMedia && selectedMedia.type === 'tv' && selectedMedia.external_id && selectedSeason) {
      fetchEpisodes(selectedMedia.external_id, selectedSeason);
    } else {
      setEpisodes([]);
      setSelectedEpisode(null);
    }
  }, [selectedSeason]);
  
  const fetchSeasons = async (externalId: string) => {
    setIsLoadingSeasons(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-media-details?source=tmdb&external_id=${externalId}&media_type=tv`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.seasons && data.seasons.length > 0) {
          setSeasons(data.seasons);
        }
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    } finally {
      setIsLoadingSeasons(false);
    }
  };
  
  const fetchEpisodes = async (externalId: string, seasonNum: number) => {
    const cacheKey = `${externalId}-${seasonNum}`;
    
    // Check cache first (includes empty arrays for seasons with no episodes)
    if (cacheKey in episodeCache.current) {
      setEpisodes(episodeCache.current[cacheKey]);
      setIsLoadingEpisodes(false);
      return;
    }
    
    setIsLoadingEpisodes(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-media-details?source=tmdb&external_id=${externalId}&media_type=tv&season=${seasonNum}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const episodeList = data.episodes || [];
        // Cache the result (including empty arrays)
        episodeCache.current[cacheKey] = episodeList;
        setEpisodes(episodeList);
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  // PRESERVED: handleMediaSearch - calls media-search edge function
  const handleMediaSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (!session?.access_token) {
      console.error("No session token for media search");
      return;
    }

    setIsSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      console.log("Searching for:", query, "URL:", `${supabaseUrl}/functions/v1/media-search`);
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/media-search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );

      console.log("Media search response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Media search results:", data.results?.length || 0, "items");
        setSearchResults(data.results || []);
      } else {
        const errorText = await response.text();
        console.error("Media search failed:", response.status, errorText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Media search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // PRESERVED: handleSelectMedia - selects media and closes inline search
  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setIsMediaSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // PRESERVED: handleTrackToList - calls track-media or add-to-custom-list edge functions
  const handleTrackToList = async (media: any, listIdOrType: number | string) => {
    if (!session?.access_token) {
      toast({
        title: "Unable to Track",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const list = userLists.find((l: any) => l.id === listIdOrType);
      if (!list) throw new Error("List not found");

      const isCustom = list.isCustom === true;

      // Determine external source/ID
      let externalSource = media.external_source || media.source || 'tmdb';
      let externalId = media.external_id || media.id || '';

      // Infer from media type if needed
      if (!media.external_source) {
        if (media.type === 'book') {
          externalSource = 'openlibrary';
        } else if (media.type === 'podcast') {
          externalSource = 'spotify';
        }
      }

      const mediaData = {
        title: media.title || "",
        mediaType: media.type || "movie",
        creator: media.creator || media.author || media.artist || "",
        imageUrl: media.poster_url || media.image_url || media.image || media.thumbnail || "",
        externalId,
        externalSource
      };

      // Use different endpoints for custom vs default lists
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const url = isCustom 
        ? `${supabaseUrl}/functions/v1/add-to-custom-list`
        : `${supabaseUrl}/functions/v1/track-media`;

      // Extract list type from list object
      let listType = list.type;
      if (!listType) {
        const title = (list.title || list.name || '').toLowerCase();
        if (title.includes('queue')) listType = 'queue';
        else if (title.includes('currently')) listType = 'currently';
        else if (title.includes('finished')) listType = 'finished';
        else if (title.includes('did not')) listType = 'dnf';
        else if (title.includes('favorite')) listType = 'favorites';
        else listType = 'queue';
      }

      const body = isCustom
        ? { media: mediaData, customListId: listIdOrType, rewatchCount: rewatchCount > 1 ? rewatchCount : null }
        : { media: mediaData, listType, rewatchCount: rewatchCount > 1 ? rewatchCount : null };

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

      await response.json();
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
    } catch (error) {
      console.error("Track error:", error);
      toast({
        title: "Track Failed",
        description: "Unable to track item. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add to rank helper
  const handleAddToRank = async (media: any, rankId: string) => {
    if (!session?.access_token || !rankId) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/add-rank-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rank_id: rankId,
          title: media.title || "",
          media_type: media.type || "movie",
          creator: media.creator || media.author || media.artist || "",
          image_url: media.poster_url || media.image_url || media.image || media.thumbnail || "",
          external_id: media.external_id || media.id || "",
          external_source: media.external_source || media.source || "tmdb",
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add to rank');
      }

      queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
    } catch (error) {
      console.error("Add to rank error:", error);
      toast({
        title: "Failed to add to rank",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // PRESERVED: handlePost - calls inline-post edge function with action-specific payload
  const handlePost = async () => {
    console.log('🎯 handlePost called with postType:', postType);
    console.log('🎯 selectedMedia:', selectedMedia);
    
    if (!session?.access_token) {
      toast({
        title: "Not Authenticated",
        description: "Please log in first.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedMedia && postType === "review") {
      toast({
        title: "Media Required",
        description: "Please add what you're reviewing first.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      let payload: any = {};

      // Build payload based on post type - SAME LOGIC AS BEFORE
      if (postType === "thought") {
        // Either text or media is required (not both)
        if (!contentText.trim() && !selectedMedia) {
          toast({
            title: "Content Required",
            description: "Please write something or add media to share.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        // Use text if provided, otherwise empty (media will be displayed)
        const content = contentText.trim() || '';
        payload = {
          content: content,
          type: "thought",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          media_title: selectedMedia?.title,
          media_type: selectedMedia?.type,
          media_creator: selectedMedia?.creator || selectedMedia?.author || selectedMedia?.artist,
          media_image_url: selectedMedia?.poster_url || selectedMedia?.image_url || selectedMedia?.image || selectedMedia?.thumbnail,
          media_external_id: selectedMedia?.external_id || selectedMedia?.id,
          media_external_source: selectedMedia?.external_source || selectedMedia?.source || 'tmdb',
          list_id: addToList && selectedListId ? selectedListId : undefined,
        };
      } else if (postType === "review") {
        if (ratingValue === 0 && !contentText.trim()) {
          toast({
            title: "Review Required",
            description: "Please rate or write a review.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        
        let content = contentText.trim() || (ratingValue > 0 ? `Rated ${selectedMedia.title}` : `Reviewed ${selectedMedia.title}`);
        
        payload = {
          content: content,
          type: "rate-review",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          rating: ratingValue > 0 ? ratingValue : undefined,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
          list_id: addToList && selectedListId ? selectedListId : undefined,
        };
      } else if (postType === "prediction") {
        if (!contentText.trim()) {
          toast({
            title: "Question Required",
            description: "What's your prediction?",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        const filledOptions = predictionOptions.filter(opt => opt.trim());
        if (filledOptions.length < 2) {
          toast({
            title: "Incomplete Options",
            description: "Please fill in at least 2 options.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
        const predResponse = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: contentText.trim(),
            options: filledOptions,
            type: "predict",
            media_external_id: selectedMedia?.external_id || selectedMedia?.id || null,
            media_external_source: selectedMedia?.external_source || selectedMedia?.source || null,
          }),
        });

        if (!predResponse.ok) throw new Error("Failed to create prediction");

        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
        resetComposer();
        setIsPosting(false);
        toast({ title: "Prediction posted!" });
        return;
      } else if (postType === "hot_take") {
        if (!contentText.trim()) {
          toast({
            title: "Hot Take Required",
            description: "Please drop your spicy take.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        payload = {
          content: contentText.trim(),
          type: "hot_take",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          // Media is optional for hot takes
          ...(selectedMedia && {
            media_title: selectedMedia.title,
            media_type: selectedMedia.type,
            media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
            media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail,
            media_external_id: selectedMedia.external_id || selectedMedia.id,
            media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
          }),
        };
      }

      // Handle add to list (if selected)
      if (addToList && selectedListId && selectedMedia) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
          const listResponse = await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              list_id: selectedListId,
              media_title: selectedMedia.title || "",
              media_type: selectedMedia.type || "movie",
              media_subtype: selectedMedia.type === 'tv' && selectedEpisode ? 'episode' : (selectedMedia.type === 'tv' ? 'series' : null),
              media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
              media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
              media_external_id: selectedMedia.external_id || selectedMedia.id || "",
              media_external_source: selectedMedia.external_source || selectedMedia.source || "tmdb",
              season_number: selectedSeason || null,
              episode_number: selectedEpisode || null,
              episode_title: selectedEpisodeTitle || null,
              skip_social_post: true, // Always skip - inline-post handles all social posts to prevent duplicates
            }),
          });
          
          if (!listResponse.ok) {
            throw new Error('Failed to add to list');
          }
          
          // If user doesn't want to post to feed, we're done
          if (!postToFeed) {
            queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
            resetComposer();
            setIsPosting(false);
            return;
          }
        } catch (listError) {
          console.error('Error adding to list:', listError);
          toast({
            title: "Failed to add to list",
            description: "Please try again.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
      }

      // Post to feed (only if postToFeed is true or not adding to list)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inline-post`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to post");
      
      // Auto-track media to "All" list when rating (if not already adding to a specific list)
      if (postType === "review" && selectedMedia && !addToList) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
          await fetch(`${supabaseUrl}/functions/v1/track-media`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              media: {
                title: selectedMedia.title || "",
                mediaType: selectedMedia.type || "movie",
                creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
                imageUrl: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
                externalId: selectedMedia.external_id || selectedMedia.id || "",
                externalSource: selectedMedia.external_source || selectedMedia.source || "tmdb",
              },
              listType: "All",
            }),
          });
        } catch (trackError) {
          console.error('Error auto-tracking rated media:', trackError);
        }
      }

      // Handle optional add to rank (only if media is selected)
      if (addToRank && selectedRankId && selectedMedia) {
        await handleAddToRank(selectedMedia, selectedRankId);
      }

      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      resetComposer();
      onPostSuccess?.();
    } catch (error) {
      console.error("Post error:", error);
      toast({
        title: "Post Failed",
        description: "Unable to share your update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  // Get placeholder text based on post type
  const getPlaceholder = () => {
    switch (postType) {
      case "thought": return "What are you watching, reading, or listening to?";
      case "review": return "Write your review (optional)...";
      case "prediction": return "What do you predict will happen?";
      case "hot_take": return "Drop your spiciest take...";
      default: return "Share what you're consuming...";
    }
  };

  // Check if can post
  const canPost = () => {
    // Special case: adding to list without posting to feed requires only media + list selection
    if (addToList && selectedListId && selectedMedia && !postToFeed) {
      return true;
    }
    
    switch (postType) {
      case "thought":
        // If adding to list with feed post, allow just media selection
        if (addToList && selectedListId && selectedMedia) {
          return true;
        }
        // Allow posting with just media OR just text (either is sufficient)
        return contentText.trim().length > 0 || selectedMedia;
      case "review":
        return selectedMedia && (ratingValue > 0 || contentText.trim().length > 0);
      case "prediction":
        return contentText.trim().length > 0 && predictionOptions[0]?.trim() && predictionOptions[1]?.trim();
      case "hot_take":
        return contentText.trim().length > 0;
      default:
        return false;
    }
  };

  return (
    <div>
      {/* Main Composer */}
      {stage === "open" && (
        <div className="space-y-3">
          {/* White card */}
          <div className="bg-white rounded-2xl shadow-sm">
            {/* Text input area */}
            <div className="p-4" onClick={() => setIsExpanded(true)}>
              <MentionTextarea
                value={contentText}
                onChange={(val) => {
                  setContentText(val);
                  if (val.trim().length > 0 && !isExpanded) {
                    setIsExpanded(true);
                  }
                }}
                placeholder="What are you watching, reading, or listening to?"
                className="border-0 p-0 text-base resize-none ring-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none text-gray-900 bg-white placeholder:text-gray-400 w-full min-h-[40px] [&>textarea]:ring-0 [&>textarea]:outline-none [&>textarea]:border-0"
                minHeight={isExpanded ? "60px" : "40px"}
                session={session}
              />
              
              {/* Selected Media - inside card if attached */}
              {selectedMedia && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    {(selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image) && (
                      <img
                        src={selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image}
                        alt={selectedMedia.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{selectedMedia.title}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {selectedMedia.type}
                        {selectedSeason && selectedEpisode && ` • S${selectedSeason}E${selectedEpisode}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedMedia(null)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      data-testid="button-remove-media"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Episode Selector for TV Shows - Optional */}
                  {selectedMedia.type === 'tv' && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-600">Which episode are you on? <span className="text-gray-400 font-normal">(optional)</span></p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Season Selector */}
                        <select
                          value={selectedSeason || ''}
                          onChange={(e) => {
                            setSelectedSeason(e.target.value ? Number(e.target.value) : null);
                            setSelectedEpisode(null);
                            setSelectedEpisodeTitle("");
                          }}
                          className="w-full sm:flex-1 text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          data-testid="select-season"
                        >
                          <option value="">Select Season</option>
                          {isLoadingSeasons ? (
                            <option disabled>Loading...</option>
                          ) : (
                            seasons.map((season) => (
                              <option key={season.seasonNumber} value={season.seasonNumber}>
                                Season {season.seasonNumber} ({season.episodeCount} eps)
                              </option>
                            ))
                          )}
                        </select>
                        
                        {/* Episode Selector */}
                        <select
                          value={selectedEpisode || ''}
                          onChange={(e) => {
                            const epNum = e.target.value ? Number(e.target.value) : null;
                            setSelectedEpisode(epNum);
                            const ep = episodes.find(ep => ep.episodeNumber === epNum);
                            setSelectedEpisodeTitle(ep?.name || "");
                          }}
                          disabled={!selectedSeason}
                          className="w-full sm:flex-1 text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
                          data-testid="select-episode"
                        >
                          <option value="">Select Episode</option>
                          {isLoadingEpisodes ? (
                            <option disabled>Loading...</option>
                          ) : (
                            episodes.map((ep) => (
                              <option key={ep.episodeNumber} value={ep.episodeNumber}>
                                E{ep.episodeNumber}: {ep.name?.substring(0, 15)}{ep.name?.length > 15 ? '...' : ''}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>
                  )}
                  
                  {/* Rewatch/Reread Count - shown when media is selected */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Which time is this?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setRewatchCount(count)}
                          className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            rewatchCount === count
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          data-testid={`composer-rewatch-${count}`}
                        >
                          {count === 1 ? '1st' : count === 2 ? '2nd' : count === 3 ? '3rd' : `${count}th`}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="6"
                        max="99"
                        value={rewatchCount > 5 ? rewatchCount : ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 6) setRewatchCount(val);
                          else if (e.target.value === '') setRewatchCount(1);
                        }}
                        onFocus={() => { if (rewatchCount <= 5) setRewatchCount(6); }}
                        placeholder="6+"
                        className={`w-12 h-8 text-center rounded-full text-xs font-medium transition-colors ${
                          rewatchCount > 5
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        data-testid="composer-rewatch-custom"
                      />
                    </div>
                  </div>

                  {/* Add to List / Add to Rank Options - shown when media is selected */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Save to:</p>
                    <div className="flex flex-wrap gap-2">
                      {/* Add to List Toggle */}
                      <button
                        onClick={() => setAddToList(!addToList)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          addToList
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                        }`}
                        data-testid="button-toggle-add-to-list"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                        <span>Add to List</span>
                      </button>
                      
                      {/* Add to Rank Toggle */}
                      <button
                        onClick={() => setAddToRank(!addToRank)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          addToRank
                            ? "bg-orange-100 text-orange-700 border border-orange-300"
                            : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                        }`}
                        data-testid="button-toggle-add-to-rank"
                      >
                        <span className="text-xs">🔢</span>
                        <span>Add to Rank</span>
                      </button>
                    </div>
                    
                    {/* List Selector - shown when Add to List is enabled */}
                    {addToList && (
                      <div className="mt-2">
                        <select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          data-testid="select-list"
                        >
                          <option value="">Select a list...</option>
                          {userLists.map((list: any) => (
                            <option key={list.id} value={list.id}>
                              {list.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Rank Selector - shown when Add to Rank is enabled */}
                    {addToRank && (
                      <div className="mt-2">
                        <select
                          value={selectedRankId}
                          onChange={(e) => setSelectedRankId(e.target.value)}
                          className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          data-testid="select-rank"
                        >
                          <option value="">Select a rank...</option>
                          {userRanks.map((rank: any) => (
                            <option key={rank.id} value={rank.id}>
                              {rank.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Post to Feed Toggle - shown when adding to list/rank */}
                    {(addToList || addToRank) && (
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={postToFeed}
                          onChange={(e) => setPostToFeed(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs text-gray-600">Also post to feed</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Expanded Actions - only show when expanded */}
            {isExpanded && (
              <>
                {/* Divider */}
                <div className="border-t border-gray-200 mx-4" />

                {/* Action Buttons Grid */}
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {/* Add Media */}
                    <button
                      onClick={() => setIsMediaSearchOpen(!isMediaSearchOpen)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        selectedMedia || isMediaSearchOpen
                          ? "bg-purple-100 text-purple-700" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      data-testid="button-add-media"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add media</span>
                    </button>

                    {/* Review */}
                    <button
                      onClick={() => {
                        setPostType("review");
                        if (!selectedMedia) setIsMediaSearchOpen(true);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        postType === "review" && selectedMedia
                          ? "bg-yellow-100 text-yellow-700" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>

                    {/* Hot Take */}
                    <button
                      onClick={() => {
                        setPostType("hot_take");
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        postType === "hot_take"
                          ? "bg-orange-100 text-orange-700" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Hot Take</span>
                    </button>

                    {/* Prediction */}
                    <button
                      onClick={() => {
                        setPostType("prediction");
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        postType === "prediction"
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Vote className="w-3.5 h-3.5" />
                      <span>Prediction</span>
                    </button>
                  </div>

                  {/* Inline Media Search - expands below action pills */}
                  {isMediaSearchOpen && (
                    <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search movies, shows, books, music..."
                          className="w-full pl-9 pr-8 py-2.5 bg-transparent border-0 focus:outline-none text-sm text-gray-900 placeholder:text-gray-400"
                          autoFocus
                          data-testid="input-media-search"
                        />
                        <button
                          onClick={() => {
                            setIsMediaSearchOpen(false);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Search Results */}
                      {isSearching && (
                        <div className="flex justify-center py-4 border-t border-gray-200">
                          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                        </div>
                      )}

                      {!isSearching && searchResults.length > 0 && (
                        <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
                          {searchResults.slice(0, 10).map((media, index) => (
                            <button
                              key={index}
                              onClick={() => handleSelectMedia(media)}
                              className="w-full flex items-center gap-3 p-2.5 hover:bg-white transition-colors text-left border-b border-gray-100 last:border-b-0"
                              data-testid={`button-select-media-${index}`}
                            >
                              {(media.poster_url || media.image_url || media.image) && (
                                <img
                                  src={media.poster_url || media.image_url || media.image}
                                  alt={media.title}
                                  className="w-8 h-11 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">{media.title}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {media.type === 'music' && media.media_subtype ? media.media_subtype : media.type}
                                  {media.creator || media.author || media.artist ? ` • ${media.creator || media.author || media.artist}` : ''}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {!isSearching && searchQuery && searchResults.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm border-t border-gray-200">
                          No results for "{searchQuery}"
                        </div>
                      )}
                    </div>
                  )}

                  </div>

                {/* Rating stars when Track & Rate is selected */}
                {postType === "review" && selectedMedia && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-500">Rating:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const fillPercent = Math.min(Math.max(ratingValue - (star - 1), 0), 1) * 100;
                          return (
                            <button
                              key={star}
                              onClick={() => setRatingValue(ratingValue === star ? 0 : star)}
                              className="focus:outline-none relative"
                            >
                              <Star className="w-6 h-6 text-gray-300" />
                              <div 
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${fillPercent}%` }}
                              >
                                <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={ratingValue || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) setRatingValue(0);
                          else setRatingValue(Math.min(5, Math.max(0, val)));
                        }}
                        placeholder="0.0"
                        className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-center bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Prediction options when Prediction is selected */}
                {postType === "prediction" && (
                  <div className="px-4 pb-3">
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-500">Your prediction options:</span>
                      {predictionOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="radio"
                            id={`option-${index}`}
                            name="creator-prediction"
                            value={option || `Option ${index + 1}`}
                            checked={creatorPrediction === (option || `Option ${index + 1}`)}
                            onChange={(e) => setCreatorPrediction(e.target.value)}
                            className="w-3.5 h-3.5 text-purple-600"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...predictionOptions];
                              newOptions[index] = e.target.value;
                              setPredictionOptions(newOptions);
                              if (creatorPrediction === option && e.target.value) {
                                setCreatorPrediction(e.target.value);
                              }
                            }}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hot Take indicator when Hot Take is selected */}
                {postType === "hot_take" && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                      <Flame className="w-5 h-5 text-orange-500" />
                      <div>
                        <span className="text-sm font-medium text-orange-700">Hot Take Mode</span>
                        <p className="text-xs text-orange-600">Friends will vote 🔥 or 🧊 on your take</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Row - Spoilers left, Post right */}
                <div className="px-4 pb-4 flex items-center justify-between">
                  {/* Spoilers checkbox */}
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-400 hover:text-gray-600 transition-colors">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                      className="border-gray-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 h-3 w-3"
                    />
                    <span>Contains spoilers</span>
                  </label>
                  
                  {/* Post button */}
                  <Button
                    onClick={handlePost}
                    disabled={isPosting || !canPost()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 h-auto rounded-full font-medium disabled:opacity-50"
                    data-testid="button-post"
                  >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
