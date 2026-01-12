import { useState, useEffect } from "react";
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
  Folder
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

type Stage = "search" | "details";

export function QuickAddModal({ isOpen, onClose, preSelectedMedia }: QuickAddModalProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  
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
  const [isRankDrawerOpen, setIsRankDrawerOpen] = useState(false);
  const [isDnfDrawerOpen, setIsDnfDrawerOpen] = useState(false);
  const [dnfReason, setDnfReason] = useState<{ reason: string; otherReason?: string } | null>(null);
  const [pendingDnfListId, setPendingDnfListId] = useState<string>("");
  const [rewatchCount, setRewatchCount] = useState<number>(1);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

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
      setStage("details");
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/media-search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
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
    setStage("details");
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
  };

  const handleSubmit = async () => {
    if (!selectedMedia || !session?.access_token) return;
    
    setIsSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      // Determine external source based on media type
      let externalSource = selectedMedia.source || selectedMedia.external_source || 'tmdb';
      const externalId = selectedMedia.external_id || selectedMedia.id;
      
      if (!selectedMedia.source && !selectedMedia.external_source) {
        if (selectedMedia.type === 'book') {
          externalSource = 'openlibrary';
        } else if (selectedMedia.type === 'podcast' || selectedMedia.type === 'music') {
          externalSource = 'spotify';
        }
      }
      
      const mediaData = {
        title: selectedMedia.title,
        mediaType: selectedMedia.type || 'movie',
        creator: selectedMedia.creator || selectedMedia.artist || '',
        imageUrl: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image,
        externalId: String(externalId),
        externalSource,
      };
      
      console.log('🎯 QuickAdd: Adding media', { mediaData, selectedListId, rating, selectedRankId });
      
      // Step 1: Track media to history (always happens)
      // Skip social post if: user chose private mode, OR if there's a rating (rate-media creates the post)
      const skipSocialPost = privateMode || rating > 0;
      
      // System/default list titles that should use track-media instead of add-to-custom-list
      const systemListTitles = ['finished', 'in progress', 'wishlist', 'paused', 'dropped', 'currently', 'favorites', 'queue', 'dnf'];
      
      // Check if selected list is a system list (by checking list properties OR if it's one of the pill IDs)
      const selectedList = selectedListId ? userLists.find((l: any) => l.id === selectedListId) : null;
      const isSystemListById = systemListTitles.includes(selectedListId?.toLowerCase());
      const isSystemList = isSystemListById || (selectedList && (
        selectedList.is_default === true || 
        selectedList.user_id === null ||
        systemListTitles.includes(selectedList.title?.toLowerCase())
      ));
      
      if (selectedListId && selectedListId !== "none" && !isSystemList) {
        // Add to custom list (user-created list with UUID)
        console.log('🎯 QuickAdd: Adding to custom list:', selectedListId);
        const response = await fetch(
          `${supabaseUrl}/functions/v1/add-to-custom-list`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              media: mediaData,
              customListId: selectedListId,
              skip_social_post: skipSocialPost,
              rewatchCount: rewatchCount > 1 ? rewatchCount : null,
              ...(dnfReason && { dnf_reason: dnfReason.reason, dnf_other_reason: dnfReason.otherReason }),
            }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to add to list:', errorData);
          // Don't throw - try to continue with rating/rank if list fails
        }
      } else {
        // System list or no list selected - use track-media with listType
        // Use the selectedListId directly if it's a system list ID, otherwise derive from list title
        let listType = 'finished';
        if (isSystemListById) {
          listType = selectedListId.toLowerCase();
        } else if (selectedList?.title) {
          listType = selectedList.title.toLowerCase().replace(/\s+/g, '_');
        }
        console.log('🎯 QuickAdd: Tracking to system list:', listType);
        const response = await fetch(
          `${supabaseUrl}/functions/v1/track-media`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              media: mediaData,
              listType: listType,
              skip_social_post: skipSocialPost,
              rewatchCount: rewatchCount > 1 ? rewatchCount : null,
              ...(dnfReason && { dnf_reason: dnfReason.reason, dnf_other_reason: dnfReason.otherReason }),
            }),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to track media:', errorData);
          // Don't throw - try to continue with rating if track fails
        }
      }
      
      // Track partial failures
      const failures: string[] = [];
      
      // Step 2: Add rating if provided (include review content so it's all in one post)
      if (rating > 0) {
        try {
          const rateResponse = await fetch(
            `${supabaseUrl}/functions/v1/rate-media`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                media_external_id: externalId,
                media_external_source: externalSource,
                media_title: selectedMedia.title,
                media_type: selectedMedia.type || 'movie',
                media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image,
                rating: rating,
                skip_social_post: privateMode,
                review_content: reviewText.trim() || null,
                contains_spoilers: containsSpoilers,
              }),
            }
          );
          if (!rateResponse.ok) {
            console.error('Rating failed:', await rateResponse.text().catch(() => 'unknown'));
            failures.push('rating');
          }
        } catch (err) {
          console.error('Rating error:', err);
          failures.push('rating');
        }
      }
      
      // Step 3: Add to rank if selected
      if (selectedRankId && selectedRankId !== "none") {
        try {
          const rankResponse = await fetch(
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
                  media_type: selectedMedia.type,
                  external_id: externalId,
                  external_source: externalSource,
                  image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image,
                },
              }),
            }
          );
          if (!rankResponse.ok) {
            console.error('Rank failed:', await rankResponse.text().catch(() => 'unknown'));
            failures.push('rank');
          }
        } catch (err) {
          console.error('Rank error:', err);
          failures.push('rank');
        }
      }
      
      // Step 4: Post standalone review (only if there's NO rating - reviews with ratings are handled in step 2)
      if (reviewText.trim() && rating === 0) {
        try {
          const reviewResponse = await fetch(
            `${supabaseUrl}/functions/v1/inline-post`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: reviewText.trim(),
                type: 'review',
                media_title: selectedMedia.title,
                media_type: selectedMedia.type,
                media_external_id: externalId,
                media_external_source: externalSource,
                media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.poster_path || selectedMedia.image,
                contains_spoilers: containsSpoilers,
              }),
            }
          );
          if (!reviewResponse.ok) {
            console.error('Review failed:', await reviewResponse.text().catch(() => 'unknown'));
            failures.push('review');
          }
        } catch (err) {
          console.error('Review error:', err);
          failures.push('review');
        }
      }
      
      // Build success message based on what was done
      let successMessage = `${selectedMedia.title} has been added`;
      if (rating > 0 && !failures.includes('rating')) successMessage += ` with ${rating}/5 rating`;
      if (selectedRankId && selectedRankId !== "none" && !failures.includes('rank')) successMessage += ` to your rank`;
      
      // Show appropriate toast based on failures
      if (failures.length > 0) {
        toast({
          title: "Partially added",
          description: `${selectedMedia.title} was added, but ${failures.join(', ')} couldn't be saved. Try again later.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Added!",
          description: successMessage,
        });
      }
      
      // Invalidate all relevant queries and refetch feed immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['user-ranks', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['media-ratings'] }),
      ]);
      
      // Force refetch social feed to show new post immediately
      await queryClient.refetchQueries({ queryKey: ['social-feed'] });
      
      onClose();
    } catch (error) {
      console.error("Error adding media:", error);
      toast({
        title: "Error",
        description: "There was a problem adding this media. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star === rating ? 0 : star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5 transition-transform hover:scale-110"
            data-testid={`star-${star}`}
          >
            <Star
              size={28}
              className={`transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
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
            
            {/* Search input */}
            <div className="p-4 pb-3">
              <div className="relative">
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
                    const posterImage = result.poster_url || result.image_url || result.poster_path;
                    return (
                    <button
                      key={`${result.external_id || result.id}-${index}`}
                      onClick={() => handleSelectMedia(result)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-purple-50 transition-colors text-left"
                      data-testid={`search-result-${index}`}
                    >
                      {posterImage ? (
                        <img
                          src={posterImage}
                          alt={result.title}
                          className="w-12 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center ${posterImage ? 'hidden' : ''}`}>
                        {getMediaIcon(result.type)}
                      </div>
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
                    </button>
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
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <button onClick={handleBack} className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Add Media</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search for a movie, show, book..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setStage("search");
                    }
                  }}
                  className="pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400"
                  data-testid="quick-add-search-details"
                />
              </div>

              {/* Selected media card */}
              {selectedMedia && (
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
                    onClick={() => {
                      setSelectedMedia(null);
                      setStage("search");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Rating */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Rating:</span>
                {renderStars()}
              </div>

              {/* Review textarea */}
              <Textarea
                placeholder="Add a review (optional)..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="bg-white border-gray-200 resize-none min-h-[80px]"
                rows={3}
                data-testid="quick-add-review"
              />

              {reviewText.trim() && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="spoilers"
                    checked={containsSpoilers}
                    onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                  />
                  <label htmlFor="spoilers" className="text-sm text-gray-600 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Contains spoilers
                  </label>
                </div>
              )}

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
                {/* Custom lists dropdown pill */}
                {userLists.filter((l: any) => !l.is_default).length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                          !['finished', 'currently', 'queue', 'dnf', ''].includes(selectedListId)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        data-testid="custom-list-dropdown"
                      >
                        {!['finished', 'currently', 'queue', 'dnf', ''].includes(selectedListId) 
                          ? userLists.find((l: any) => l.id === selectedListId)?.title || userLists.find((l: any) => l.id === selectedListId)?.name || 'Custom'
                          : 'Custom'
                        }
                        <ChevronDown size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-gray-900 text-white border-gray-800">
                      {userLists.filter((l: any) => !l.is_default).map((list: any) => (
                        <DropdownMenuItem
                          key={list.id}
                          onClick={() => setSelectedListId(list.id)}
                          className="cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
                        >
                          {list.title || list.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  {/* TV episode picker */}
                  {selectedMedia?.type === 'tv' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Episode</p>
                      <select
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                        data-testid="episode-select"
                      >
                        <option value="">All seasons</option>
                      </select>
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
            </div>
            
            <div className="p-4 border-t border-gray-100">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedMedia}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                data-testid="quick-add-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Adding...
                  </>
                ) : (
                  'Add Media'
                )}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>

    {/* List Selection Drawer */}
    <Drawer open={isListDrawerOpen} onOpenChange={setIsListDrawerOpen}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">Select a List</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          <button
            onClick={() => {
              setSelectedListId("none");
              setIsListDrawerOpen(false);
            }}
            className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
            data-testid="list-option-none"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <X className="text-gray-500" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">None</p>
              <p className="text-sm text-gray-500">Don't add to a list</p>
            </div>
            {(!selectedListId || selectedListId === "none") && (
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
                onClick={() => {
                  if (style.isDnf) {
                    setPendingDnfListId(list.id);
                    setIsListDrawerOpen(false);
                    setIsDnfDrawerOpen(true);
                  } else {
                    setSelectedListId(list.id);
                    setDnfReason(null);
                    setIsListDrawerOpen(false);
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