import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DnfReasonDrawer } from "./dnf-reason-drawer";
import { 
  Search, 
  Star, 
  Film, 
  Tv, 
  BookOpen, 
  Music, 
  Headphones, 
  Gamepad2,
  Loader2,
  ArrowLeft,
  List,
  Trophy,
  AlertTriangle,
  ChevronDown,
  Check,
  X,
  Play,
  Clock,
  Heart,
  Ban,
  Bookmark,
  Folder,
  Plus
} from "lucide-react";

interface PreSelectedMedia {
  title: string;
  mediaType: string;
  imageUrl?: string;
  externalId?: string;
  externalSource?: string;
}

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedMedia?: PreSelectedMedia | null;
}

type Stage = "search" | "composer";
type PostType = "thought" | "hot_take" | "ask" | "poll" | "rank";

export function QuickAddModal({ isOpen, onClose, preSelectedMedia }: QuickAddModalProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [stage, setStage] = useState<Stage>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedRankId, setSelectedRankId] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [privateMode, setPrivateMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListDrawerOpen, setIsListDrawerOpen] = useState(false);
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [isRankDrawerOpen, setIsRankDrawerOpen] = useState(false);
  const [isDnfDrawerOpen, setIsDnfDrawerOpen] = useState(false);
  const [dnfReason, setDnfReason] = useState<{ reason: string; otherReason?: string } | null>(null);
  const [pendingDnfListId, setPendingDnfListId] = useState<string>("");
  const [rewatchCount, setRewatchCount] = useState<number>(1);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  // TV-specific options
  const [tvSeason, setTvSeason] = useState<string>("");
  const [tvEpisode, setTvEpisode] = useState<string>("");
  
  // Music-specific options
  const [musicFormat, setMusicFormat] = useState<"album" | "single" | "track">("album");
  
  // Post type for composer
  const [postType, setPostType] = useState<PostType>("thought");
  
  // Poll-specific options
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const { data: listsData } = useQuery({
    queryKey: ['user-lists-metadata', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { lists: [] };
      
      // Try the fast metadata endpoint first
      try {
        const metadataResponse = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-metadata?user_id=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (metadataResponse.ok) {
          return metadataResponse.json();
        }
      } catch (e) {
        // Metadata endpoint not deployed yet, fall through to full endpoint
      }
      
      // Fallback to full endpoint if metadata endpoint fails
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Transform full data to metadata format
        return {
          lists: (data.lists || []).map((list: any) => ({
            ...list,
            item_count: list.items?.length || 0
          }))
        };
      }
      return { lists: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
  });

  const { data: ranksData } = useQuery({
    queryKey: ['user-ranks', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { ranks: [] };
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.ok) return response.json();
      return { ranks: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
  });

  const userLists = listsData?.lists || [];
  const userRanks = ranksData?.ranks || [];

  useEffect(() => {
    if (!session?.access_token) return;
    
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleMediaSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session?.access_token]);

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    } else if (preSelectedMedia) {
      // Pre-populate with provided media and skip to details
      setSelectedMedia({
        title: preSelectedMedia.title,
        type: preSelectedMedia.mediaType,
        image_url: preSelectedMedia.imageUrl,
        poster_url: preSelectedMedia.imageUrl,
        poster_path: preSelectedMedia.imageUrl,
        external_id: preSelectedMedia.externalId,
        external_source: preSelectedMedia.externalSource,
      });
      setStage("composer");
    }
  }, [isOpen, preSelectedMedia]);

  const resetModal = () => {
    setStage("search");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia(null);
    setRating(0);
    setHoverRating(0);
    setRewatchCount(1);
    setSelectedListId("");
    setSelectedRankId("");
    setReviewText("");
    setContainsSpoilers(false);
    setIsListDrawerOpen(false);
    setIsRankDrawerOpen(false);
    setIsDnfDrawerOpen(false);
    setDnfReason(null);
    setPendingDnfListId("");
    setTvSeason("");
    setTvEpisode("");
    setMusicFormat("album");
    setPostType("thought");
    setPollOptions(["", ""]);
  };
  
  const getSelectedListName = () => {
    if (!selectedListId || selectedListId === "none") return "Select a list...";
    const list = userLists.find((l: any) => l.id === selectedListId);
    return list?.title || "Select a list...";
  };
  
  const getSelectedRankName = () => {
    if (!selectedRankId || selectedRankId === "none") return "Select a rank...";
    const rank = userRanks.find((r: any) => r.id === selectedRankId);
    return rank?.title || "Select a rank...";
  };

  const handleMediaSearch = async (query: string) => {
    if (!session?.access_token) return;
    
    setIsSearching(true);
    try {
      // Use POST method like CollectionsPage does (this works correctly)
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim() }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Search results:', data.results?.slice(0, 3).map((r: any) => ({ title: r.title, poster_url: r.poster_url, image_url: r.image_url })));
        setSearchResults(data.results || []);
      } else {
        console.error('Search failed:', response.status);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Media search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setStage("composer");
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleBack = () => {
    setStage("search");
    setSelectedMedia(null);
    setRating(0);
    setRewatchCount(1);
    setSelectedListId("");
    setSelectedRankId("");
    setReviewText("");
    setContainsSpoilers(false);
    setTvSeason("");
    setTvEpisode("");
    setMusicFormat("album");
    setPostType("thought");
    setPollOptions(["", ""]);
  };
  
  const handleJustPost = () => {
    setSelectedMedia(null);
    setStage("composer");
  };

  const handleSubmit = async () => {
    if (!session?.access_token) return;
    
    // For rank posts, require media selection
    if (postType === 'rank' && !selectedMedia) {
      toast({
        title: "Select media",
        description: "Please attach media to add to your ranked list.",
        variant: "destructive",
      });
      return;
    }
    
    // For other posts, require text content OR a rating (when media is attached)
    if (postType !== 'rank' && !reviewText.trim() && !(selectedMedia && rating > 0)) {
      toast({
        title: "Add content",
        description: "Please write something or add a rating for your post.",
        variant: "destructive",
      });
      return;
    }
    
    // For polls, validate options
    if (postType === 'poll') {
      const validOptions = pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        toast({
          title: "Add poll options",
          description: "Please add at least 2 options for your poll.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      // Prepare media data if media is selected
      let mediaData: any = null;
      let externalSource: string | undefined;
      let externalId: string | undefined;
      
      if (selectedMedia) {
        externalSource = selectedMedia.source || selectedMedia.external_source || 'tmdb';
        externalId = String(selectedMedia.external_id || selectedMedia.id);
        
        if (!selectedMedia.source && !selectedMedia.external_source) {
          if (selectedMedia.type === 'book') {
            externalSource = 'openlibrary';
          } else if (selectedMedia.type === 'podcast' || selectedMedia.type === 'music') {
            externalSource = 'spotify';
          }
        }
        
        mediaData = {
          title: selectedMedia.title,
          mediaType: selectedMedia.type || 'movie',
          creator: selectedMedia.creator || selectedMedia.artist || '',
          imageUrl: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image || '',
          externalId,
          externalSource,
          ...(tvSeason && { season: parseInt(tvSeason) }),
          ...(tvEpisode && { episode: parseInt(tvEpisode) }),
          ...((selectedMedia.type === 'music' || selectedMedia.media_type === 'music') && { musicFormat }),
        };
      }
      
      console.log('🎯 Composer: Posting', { postType, hasMedia: !!selectedMedia, mediaData, reviewText: reviewText.substring(0, 50) });
      
      // Handle based on post type
      if (postType === 'thought' || postType === 'hot_take' || postType === 'ask') {
        // Map post types to API types
        const typeMap: Record<string, string> = {
          'thought': 'thought',
          'hot_take': 'hot_take',
          'ask': 'ask_for_rec',
        };
        
        // Create the social post (unless private mode is enabled)
        if (!privateMode) {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/inline-post`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: reviewText.trim(),
                type: typeMap[postType],
                ...(selectedMedia && {
                  media_title: selectedMedia.title,
                  media_type: selectedMedia.type,
                  media_external_id: externalId,
                  media_external_source: externalSource,
                  media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image,
                }),
                contains_spoilers: containsSpoilers,
              }),
            }
          );
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create post');
          }
        }
        
        // If media is attached AND user selected a list, track it
        if (selectedMedia && mediaData && selectedListId && selectedListId !== '' && selectedListId !== 'none') {
          await trackMediaToList(supabaseUrl, session.access_token, mediaData, selectedListId, privateMode, rewatchCount, dnfReason);
        }
        
        // If rating is provided, add it (with review content and spoiler flag)
        if (selectedMedia && rating > 0) {
          await addRating(supabaseUrl, session.access_token, selectedMedia, externalId!, externalSource!, reviewText.trim(), containsSpoilers, privateMode);
        }
        
      } else if (postType === 'poll') {
        // Create poll using existing poll endpoint
        const validOptions = pollOptions.filter(o => o.trim());
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/create-poll`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: reviewText.trim(),
              options: validOptions,
              is_private: privateMode,
              contains_spoilers: containsSpoilers,
              ...(selectedMedia && {
                media_title: selectedMedia.title,
                media_type: selectedMedia.type,
                media_external_id: externalId,
                media_external_source: externalSource,
                media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image,
              }),
            }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create poll');
        }
        
      } else if (postType === 'rank') {
        // Add to ranked list - requires media and a selected rank
        if (!selectedMedia) {
          toast({
            title: "Select media",
            description: "Please attach media to add to your ranked list.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        
        if (!selectedRankId) {
          toast({
            title: "Select a list",
            description: "Please select a ranked list to add this media to.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/manage-ranks`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'add_item',
              rank_id: selectedRankId,
              item: {
                title: selectedMedia.title,
                media_type: selectedMedia.type || 'movie',
                external_id: externalId,
                external_source: externalSource,
                image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image || '',
              },
            }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to add to ranked list');
        }
        
        // Track media to the user's selected list (or skip if no list selected)
        if (mediaData && selectedListId && selectedListId !== '' && selectedListId !== 'none') {
          await trackMediaToList(supabaseUrl, session.access_token, mediaData, selectedListId, true, rewatchCount, dnfReason);
        }
      }
      
      // Invalidate queries and refetch feed
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['user-ranks', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['media-ratings'] }),
      ]);
      
      await queryClient.refetchQueries({ queryKey: ['social-feed'] });
      
      onClose();
    } catch (error: any) {
      console.error("Error posting:", error);
      toast({
        title: "Error",
        description: error.message || "There was a problem creating your post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper function to track media to a list
  const trackMediaToList = async (
    supabaseUrl: string, 
    accessToken: string, 
    mediaData: any, 
    listId: string,
    skipSocialPost: boolean = true,
    rewatchNum: number = 1,
    dnfData?: { reason: string; otherReason?: string } | null
  ) => {
    const systemListTitles = ['finished', 'in progress', 'wishlist', 'paused', 'dropped', 'currently', 'favorites', 'queue', 'dnf'];
    const selectedList = userLists.find((l: any) => l.id === listId);
    const isSystemListById = systemListTitles.includes(listId?.toLowerCase());
    const isSystemList = isSystemListById || (selectedList && (
      selectedList.is_default === true || 
      selectedList.user_id === null ||
      systemListTitles.includes(selectedList.title?.toLowerCase())
    ));
    
    if (!isSystemList) {
      await fetch(`${supabaseUrl}/functions/v1/add-to-custom-list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          media: mediaData, 
          customListId: listId, 
          skip_social_post: skipSocialPost,
          rewatchCount: rewatchNum > 1 ? rewatchNum : null,
          ...(dnfData && { dnf_reason: dnfData.reason, dnf_other_reason: dnfData.otherReason }),
        }),
      });
    } else {
      let listType = isSystemListById ? listId.toLowerCase() : (selectedList?.title?.toLowerCase().replace(/\s+/g, '_') || 'finished');
      await fetch(`${supabaseUrl}/functions/v1/track-media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          media: mediaData, 
          listType, 
          skip_social_post: skipSocialPost,
          rewatchCount: rewatchNum > 1 ? rewatchNum : null,
          ...(dnfData && { dnf_reason: dnfData.reason, dnf_other_reason: dnfData.otherReason }),
        }),
      });
    }
  };
  
  // Helper function for quick add (directly adds media to list from "+" button)
  const quickAddToList = async (listId: string, media: any) => {
    if (!session?.access_token || !media) return;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    
    // Determine external source based on media type
    let externalSource = media.source || media.external_source || 'tmdb';
    const externalId = String(media.external_id || media.id);
    
    if (!media.source && !media.external_source) {
      if (media.type === 'book') {
        externalSource = 'openlibrary';
      } else if (media.type === 'podcast' || media.type === 'music') {
        externalSource = 'spotify';
      }
    }
    
    const mediaData = {
      title: media.title,
      mediaType: media.type || 'movie',
      creator: media.creator || media.artist || '',
      imageUrl: media.poster_url || media.image_url || media.poster_path || media.image || '',
      externalId,
      externalSource,
    };
    
    console.log('🚀 Quick add to list:', { listId, mediaData });
    
    // Track media to the selected list
    await trackMediaToList(supabaseUrl, session.access_token, mediaData, listId, false, 1, null);
    
    // Invalidate queries to refresh data
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] }),
    ]);
    await queryClient.refetchQueries({ queryKey: ['social-feed'] });
    
    toast({
      title: "Added!",
      description: `${media.title} added to your list.`,
    });
    
    // Close everything
    setIsListDrawerOpen(false);
    setIsQuickAddMode(false);
    setSelectedMedia(null);
    onClose();
  };

  // Helper function to add rating
  const addRating = async (
    supabaseUrl: string, 
    accessToken: string, 
    media: any, 
    externalId: string, 
    externalSource: string,
    reviewContent?: string,
    hasSpoilers: boolean = false,
    isPrivate: boolean = false
  ) => {
    await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_external_id: externalId,
        media_external_source: externalSource,
        media_title: media.title,
        media_type: media.type || 'movie',
        media_image_url: media.poster_url || media.image_url || media.poster_path || media.image,
        rating: rating,
        skip_social_post: isPrivate,
        review_content: reviewContent || null,
        contains_spoilers: hasSpoilers,
      }),
    });
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film size={16} className="text-purple-600" />;
      case 'tv': return <Tv size={16} className="text-pink-600" />;
      case 'book': return <BookOpen size={16} className="text-cyan-600" />;
      case 'music': return <Music size={16} className="text-green-600" />;
      case 'podcast': return <Headphones size={16} className="text-blue-600" />;
      case 'game': return <Gamepad2 size={16} className="text-orange-600" />;
      default: return <Film size={16} className="text-gray-600" />;
    }
  };

  const renderStars = () => {
    return (
      <div className="relative flex items-center gap-1">
        {/* Star display */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <div 
              key={star} 
              className="relative"
              style={{ width: 28, height: 28 }}
            >
              <Star size={28} className="absolute inset-0 text-gray-300" />
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ 
                  width: rating >= star ? '100%' : rating >= star - 0.5 ? '50%' : '0%'
                }}
              >
                <Star size={28} className="fill-yellow-400 text-yellow-400" />
              </div>
            </div>
          ))}
        </div>
        {/* Invisible slider overlay for half-star ratings */}
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={rating}
          onChange={(e) => setRating(parseFloat(e.target.value))}
          className="absolute left-0 w-[140px] h-7 opacity-0 cursor-pointer z-10"
          style={{ margin: 0 }}
          data-testid="rating-slider"
        />
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-600">{rating}/5</span>
        )}
      </div>
    );
  };

  return (
    <>
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-white rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col [&>div:first-child]:hidden">
        {stage === "search" ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Add Media</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Search input with Just post button */}
            <div className="p-4 pb-3">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for a movie, show, book..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none"
                    autoFocus
                    data-testid="quick-add-search"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleJustPost}
                  className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl whitespace-nowrap transition-colors"
                  data-testid="just-post-button"
                >
                  💭 Just post
                </button>
              </div>
            </div>
            
            {/* Search results */}
            <div className="flex-1 overflow-y-auto px-4">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result, index) => {
                    const posterImage = result.poster_url || result.image_url;
                    return (
                    <div
                      key={`${result.external_id || result.id}-${index}`}
                      onClick={() => {
                        console.log('🎯 Row clicked - navigating to media:', result.title);
                        onClose();
                        const mediaType = result.type || 'movie';
                        const externalId = result.external_id || result.id;
                        const externalSource = result.external_source || 'tmdb';
                        setLocation(`/media/${mediaType}/${externalSource}/${externalId}`);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onClose();
                          const mediaType = result.type || 'movie';
                          const externalId = result.external_id || result.id;
                          const externalSource = result.external_source || 'tmdb';
                          setLocation(`/media/${mediaType}/${externalSource}/${externalId}`);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-purple-50 transition-colors cursor-pointer select-none"
                      style={{ pointerEvents: 'auto' }}
                      data-testid={`search-result-${index}`}
                    >
                      {/* Media poster */}
                      {posterImage ? (
                        <img
                          src={posterImage}
                          alt={result.title}
                          className="w-12 h-16 object-cover rounded-lg shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center shrink-0 ${posterImage ? 'hidden' : ''}`}>
                        {getMediaIcon(result.type)}
                      </div>
                      
                      {/* Media info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{result.title}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {getMediaIcon(result.type)}
                          <span className="capitalize">{result.type}</span>
                          {result.year && <span>• {result.year}</span>}
                        </div>
                        {result.creator && (
                          <p className="text-xs text-gray-400 truncate">{result.creator}</p>
                        )}
                      </div>
                      
                      {/* Quick add "+" button - opens list drawer for immediate add */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMedia(result);
                          setIsQuickAddMode(true);
                          setIsListDrawerOpen(true);
                        }}
                        className="w-10 h-10 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-400 hover:bg-purple-100 hover:text-purple-600 hover:border-purple-400 transition-colors shrink-0"
                        data-testid={`quick-add-${index}`}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  );
                  })}
                </div>
              ) : searchQuery.trim() ? (
                <div className="text-center py-8 text-gray-500">
                  No results found for "{searchQuery}"
                </div>
              ) : null}
            </div>
            
            {/* Add button (disabled) */}
            <div className="p-4 border-t border-gray-100">
              <Button
                disabled
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 opacity-60 cursor-not-allowed"
                data-testid="quick-add-submit-disabled"
              >
                Add Media
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Composer Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <button onClick={handleBack} className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Say something</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Post type pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'thought', label: 'Thought' },
                  { id: 'hot_take', label: 'Hot Take' },
                  { id: 'ask', label: 'Ask' },
                  { id: 'poll', label: 'Poll' },
                  { id: 'rank', label: 'Rank' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setPostType(type.id as PostType)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      postType === type.id
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Attach media section (collapsed by default) */}
              {!selectedMedia ? (
                <button
                  onClick={() => setStage("search")}
                  className="w-full flex items-center gap-2 p-3 border border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
                >
                  <Search size={18} />
                  <span>Attach media (optional)</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                  {(selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path) ? (
                    <img
                      src={selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path}
                      alt={selectedMedia.title}
                      className="w-14 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-14 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                      {getMediaIcon(selectedMedia.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{selectedMedia.title}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <span className="capitalize">{selectedMedia.type}</span>
                      {selectedMedia.year && <span>• {selectedMedia.year}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMedia(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Dynamic content based on post type */}
              {postType === 'thought' && (
                <>
                  <Textarea
                    placeholder="What's on your mind?"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="bg-white border-gray-200 resize-none min-h-[100px]"
                    rows={4}
                    data-testid="thought-textarea"
                  />
                </>
              )}

              {postType === 'hot_take' && (
                <>
                  <Textarea
                    placeholder="Drop your hot take... 🔥"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="bg-white border-gray-200 resize-none min-h-[100px]"
                    rows={4}
                    data-testid="hot-take-textarea"
                  />
                  <p className="text-xs text-gray-500">Others will vote if your take is 🌶️ Spicy or ❄️ Cold</p>
                </>
              )}

              {postType === 'ask' && (
                <>
                  <Textarea
                    placeholder="What are you looking for? (e.g., 'Looking for a feel-good comedy...')"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="bg-white border-gray-200 resize-none min-h-[100px]"
                    rows={4}
                    data-testid="ask-textarea"
                  />
                  <p className="text-xs text-gray-500">Your friends will recommend media for you</p>
                </>
              )}

              {postType === 'poll' && (
                <>
                  <Input
                    placeholder="What's your poll question?"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="bg-white border-gray-200"
                    data-testid="poll-question"
                  />
                  <div className="space-y-2">
                    {pollOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...pollOptions];
                            newOptions[index] = e.target.value;
                            setPollOptions(newOptions);
                          }}
                          className="bg-white border-gray-200 flex-1"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <button
                        onClick={() => setPollOptions([...pollOptions, ""])}
                        className="text-sm text-purple-600 hover:text-purple-700"
                      >
                        + Add option
                      </button>
                    )}
                  </div>
                </>
              )}

              {postType === 'rank' && (
                <>
                  <p className="text-sm text-gray-600">Select a ranked list to add this media to:</p>
                  {userRanks.length > 0 ? (
                    <div className="space-y-2">
                      {userRanks.map((rank: any) => (
                        <button
                          key={rank.id}
                          onClick={() => setSelectedRankId(rank.id)}
                          className={`w-full p-3 rounded-xl text-left transition-colors ${
                            selectedRankId === rank.id
                              ? 'bg-purple-100 border-2 border-purple-500'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <p className="font-medium text-gray-900">{rank.title}</p>
                          <p className="text-sm text-gray-500">{rank.items_count || 0} items</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No ranked lists yet. Create one in Collections.</p>
                  )}
                </>
              )}

              {/* Show rating and list options when media is attached (for thought/hot_take) */}
              {selectedMedia && (postType === 'thought' || postType === 'hot_take') && (
                <>
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Rating:</span>
                    {renderStars()}
                  </div>

              {/* List selection - horizontal pills with custom list dropdown */}
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
                    type="button"
                    onClick={() => {
                      if (list.id === 'dnf') {
                        setPendingDnfListId(list.id);
                        setIsDnfDrawerOpen(true);
                      } else {
                        setSelectedListId(selectedListId === list.id ? "" : list.id);
                      }
                    }}
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
                {/* Custom lists pill - opens the main list drawer */}
                {userLists.filter((l: any) => !l.is_default).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsListDrawerOpen(true)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                      !['finished', 'currently', 'queue', 'favorites', 'dnf', ''].includes(selectedListId)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid="custom-list-dropdown"
                  >
                    {!['finished', 'currently', 'queue', 'favorites', 'dnf', ''].includes(selectedListId) 
                      ? userLists.find((l: any) => l.id === selectedListId)?.title || userLists.find((l: any) => l.id === selectedListId)?.name || 'Custom'
                      : 'Custom'
                    }
                    <ChevronDown size={14} />
                  </button>
                )}
              </div>

              {/* More options toggle */}
              <button
                type="button"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 py-1"
                data-testid="more-options-toggle"
              >
                <ChevronDown size={14} className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
                {showMoreOptions ? 'Less options' : 'More options'}
              </button>

              {/* Collapsible advanced options */}
              {showMoreOptions && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  {/* TV season/episode picker */}
                  {(selectedMedia?.type === 'tv' || selectedMedia?.media_type === 'tv') && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Season & Episode</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select
                            value={tvSeason}
                            onChange={(e) => {
                              setTvSeason(e.target.value);
                              if (!e.target.value) setTvEpisode("");
                            }}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                            data-testid="season-select"
                          >
                            <option value="">All Seasons</option>
                            {Array.from({ length: 20 }, (_, i) => (
                              <option key={i + 1} value={String(i + 1)}>Season {i + 1}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select
                            value={tvEpisode}
                            onChange={(e) => setTvEpisode(e.target.value)}
                            disabled={!tvSeason}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white disabled:opacity-50 disabled:bg-gray-50"
                            data-testid="episode-select"
                          >
                            <option value="">All Episodes</option>
                            {Array.from({ length: 30 }, (_, i) => (
                              <option key={i + 1} value={String(i + 1)}>Episode {i + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Music format picker */}
                  {(selectedMedia?.type === 'music' || selectedMedia?.media_type === 'music') && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Format</p>
                      <div className="flex gap-2">
                        {[
                          { value: 'album', label: 'Album' },
                          { value: 'single', label: 'Single' },
                          { value: 'track', label: 'Track' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMusicFormat(option.value as "album" | "single" | "track")}
                            className={`flex-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              musicFormat === option.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Checkboxes row */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-checkbox"
                        checked={rewatchCount > 1}
                        onCheckedChange={(checked) => setRewatchCount(checked ? 2 : 1)}
                        data-testid="checkbox-repeat"
                      />
                      <label htmlFor="repeat-checkbox" className="text-sm text-gray-600">
                        Repeat?
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="spoilers-checkbox"
                        checked={containsSpoilers}
                        onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                        data-testid="checkbox-spoilers"
                      />
                      <label htmlFor="spoilers-checkbox" className="text-sm text-gray-600">
                        Spoilers
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="private-mode"
                        checked={privateMode}
                        onCheckedChange={(checked) => setPrivateMode(checked as boolean)}
                        data-testid="checkbox-private-mode"
                      />
                      <label htmlFor="private-mode" className="text-sm text-gray-600">
                        Don't post to feed
                      </label>
                    </div>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (!reviewText.trim() && postType !== 'rank' && rating === 0)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                data-testid="quick-add-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Posting...
                  </>
                ) : (
                  'Post'
                )}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>

    {/* List Selection Drawer */}
    <Drawer open={isListDrawerOpen} onOpenChange={(open) => {
      setIsListDrawerOpen(open);
      if (!open) setIsQuickAddMode(false);
    }}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">
            {isQuickAddMode ? 'Add to List' : 'Select a List'}
          </DrawerTitle>
          {isQuickAddMode && selectedMedia && (
            <p className="text-sm text-gray-500 mt-1">{selectedMedia.title}</p>
          )}
        </DrawerHeader>
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          <button
            onClick={() => {
              setSelectedListId("none");
              setIsListDrawerOpen(false);
              if (isQuickAddMode) {
                setIsQuickAddMode(false);
                setSelectedMedia(null);
              }
            }}
            className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
            data-testid="list-option-none"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <X className="text-gray-500" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{isQuickAddMode ? 'Cancel' : 'None'}</p>
              <p className="text-sm text-gray-500">{isQuickAddMode ? 'Go back' : "Don't add to a list"}</p>
            </div>
            {!isQuickAddMode && (!selectedListId || selectedListId === "none") && (
              <Check size={20} className="text-purple-600" />
            )}
          </button>
          {userLists.map((list: any) => {
            const getListStyle = (title: string) => {
              const lower = title.toLowerCase();
              if (lower.includes('currently') || lower.includes('watching') || lower.includes('reading')) {
                return { bg: 'bg-purple-100', icon: <Play className="text-purple-600" size={20} />, desc: 'Currently consuming', isDnf: false };
              }
              if (lower.includes('queue') || lower.includes('want')) {
                return { bg: 'bg-blue-100', icon: <Clock className="text-blue-600" size={20} />, desc: 'Save for later', isDnf: false };
              }
              if (lower.includes('finished') || lower.includes('complete')) {
                return { bg: 'bg-green-100', icon: <Check className="text-green-600" size={20} />, desc: 'Completed media', isDnf: false };
              }
              if (lower.includes('dnf') || lower.includes('not finish')) {
                return { bg: 'bg-red-100', icon: <Ban className="text-red-600" size={20} />, desc: 'Stopped watching/reading', isDnf: true };
              }
              if (lower.includes('favorite')) {
                return { bg: 'bg-yellow-100', icon: <Heart className="text-yellow-600" size={20} />, desc: 'Your favorites', isDnf: false };
              }
              return { bg: 'bg-purple-100', icon: <Folder className="text-purple-600" size={20} />, desc: 'Custom list', isDnf: false };
            };
            const style = getListStyle(list.title);
            
            return (
              <button
                key={list.id}
                onClick={async () => {
                  if (isQuickAddMode && selectedMedia) {
                    // Quick add mode - immediately add to list
                    if (style.isDnf) {
                      setPendingDnfListId(list.id);
                      setIsListDrawerOpen(false);
                      setIsDnfDrawerOpen(true);
                    } else {
                      await quickAddToList(list.id, selectedMedia);
                    }
                  } else {
                    // Normal mode - just select the list
                    if (style.isDnf) {
                      setPendingDnfListId(list.id);
                      setIsListDrawerOpen(false);
                      setIsDnfDrawerOpen(true);
                    } else {
                      setSelectedListId(list.id);
                      setDnfReason(null);
                      setIsListDrawerOpen(false);
                    }
                  }
                }}
                className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
                data-testid={`list-option-${list.id}`}
              >
                <div className={`w-10 h-10 ${style.bg} rounded-full flex items-center justify-center`}>
                  {style.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{list.title}</p>
                  <p className="text-sm text-gray-500">{style.desc}</p>
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

    {/* Rank Selection Drawer */}
    <Drawer open={isRankDrawerOpen} onOpenChange={setIsRankDrawerOpen}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">Select a Rank</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          <button
            onClick={() => {
              setSelectedRankId("none");
              setIsRankDrawerOpen(false);
            }}
            className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
            data-testid="rank-option-none"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <X className="text-gray-500" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">None</p>
              <p className="text-sm text-gray-500">Don't add to a rank</p>
            </div>
            {(!selectedRankId || selectedRankId === "none") && (
              <Check size={20} className="text-purple-600" />
            )}
          </button>
          {userRanks.map((rank: any) => (
            <button
              key={rank.id}
              onClick={() => {
                setSelectedRankId(rank.id);
                setIsRankDrawerOpen(false);
              }}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`rank-option-${rank.id}`}
            >
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Trophy className="text-yellow-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{rank.title}</p>
                <p className="text-sm text-gray-500">Add to ranked list</p>
              </div>
              {selectedRankId === rank.id && (
                <Check size={20} className="text-purple-600" />
              )}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>

    {/* DNF Reason Drawer */}
    <DnfReasonDrawer
      isOpen={isDnfDrawerOpen}
      onClose={() => {
        setIsDnfDrawerOpen(false);
        setPendingDnfListId("");
      }}
      onSubmit={(reason, otherReason) => {
        setDnfReason({ reason, otherReason });
        setSelectedListId(pendingDnfListId);
        setPendingDnfListId("");
        setIsDnfDrawerOpen(false);
      }}
      mediaTitle={selectedMedia?.title}
    />
    </>
  );
}