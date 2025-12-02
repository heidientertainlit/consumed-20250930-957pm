import { Plus, Star, Film, Tv, Music, Book, Mic } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MediaItem {
  id: string;
  title: string;
  imageUrl: string;
  rating?: number;
  year?: string;
  mediaType?: string;
  platform?: string; // e.g., "netflix", "disney", "hulu", "prime", "max", "peacock", "apple"
  author?: string; // For books and podcasts
  externalId?: string; // For DNA recommendations
  externalSource?: string; // For DNA recommendations
}

interface MediaCarouselProps {
  title: string;
  mediaType: string;
  items: MediaItem[];
  onItemClick?: (item: MediaItem) => void;
  onAddToList?: (item: MediaItem) => void;
  onRate?: (item: MediaItem) => void;
}

export default function MediaCarousel({
  title,
  mediaType,
  items,
  onItemClick,
  onAddToList,
  onRate,
}: MediaCarouselProps) {
  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-2xl p-3 shadow-lg border border-gray-800/50 overflow-visible" data-testid={`carousel-${mediaType}`}>
      {/* Header */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-white">
          {title}
        </h3>
      </div>

      {/* Scrollable carousel - overflow only on horizontal */}
      <div className="overflow-x-auto overflow-y-visible scrollbar-hide">
        <div className="flex gap-2 w-max">
          {items.map((item) => {
            // Create a guaranteed unique key scoped to this carousel
            // Include the carousel title to ensure uniqueness across multiple carousels
            const itemKey = item.externalId && item.externalSource
              ? `${item.externalSource}-${item.externalId}`
              : `${item.mediaType || 'media'}-${item.platform || 'noplatform'}-${item.id}`;
            const uniqueKey = `${title}-${itemKey}`;
            
            return (
              <div key={uniqueKey} className="flex-shrink-0 w-20">
                <MediaCard
                  item={item}
                  onItemClick={onItemClick}
                  onAddToList={onAddToList}
                  onRate={onRate}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MediaCardProps {
  item: MediaItem;
  onItemClick?: (item: MediaItem) => void;
  onAddToList?: (item: MediaItem) => void;
  onRate?: (item: MediaItem) => void;
}

function MediaCard({ item, onItemClick, onAddToList, onRate }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showRatingStars, setShowRatingStars] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [showListMenu, setShowListMenu] = useState(false);
  const [listMenuPos, setListMenuPos] = useState({ top: 0, left: 0 });
  const [ratingMenuPos, setRatingMenuPos] = useState({ top: 0, left: 0 });
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const ratingButtonRef = useRef<HTMLButtonElement>(null);
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (addButtonRef.current && showListMenu) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setListMenuPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showListMenu]);

  useEffect(() => {
    if (ratingButtonRef.current && showRatingStars) {
      const rect = ratingButtonRef.current.getBoundingClientRect();
      setRatingMenuPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showRatingStars]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showListMenu && !addButtonRef.current?.contains(e.target as Node)) {
        setShowListMenu(false);
      }
      if (showRatingStars && !ratingButtonRef.current?.contains(e.target as Node)) {
        setShowRatingStars(false);
      }
    };

    if (showListMenu || showRatingStars) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showListMenu, showRatingStars]);
  
  const handlePointerDown = () => {
    setIsDragging(false);
  };
  
  const handlePointerMove = () => {
    setIsDragging(true);
  };
  
  const handlePosterClick = (e: React.MouseEvent) => {
    // Only navigate if clicking on the actual poster image/placeholder, not buttons
    const target = e.target as HTMLElement;
    
    // Don't navigate if clicking buttons area or any interactive element
    if (target.closest('button') || 
        target.closest('[role="menuitem"]') ||
        target.closest('[role="menu"]')) {
      return;
    }
    
    // Only trigger navigation on actual poster area (img or placeholder divs)
    if (target instanceof HTMLImageElement || 
        target.closest('.bg-gradient-to-br') ||
        target.closest('[role="img"]')) {
      if (!isDragging) {
        onItemClick?.(item);
      }
    }
  };
  
  // Fetch user's lists
  const { data: userListsData } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-lists-with-media`, {
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
    enabled: !!session?.access_token,
  });

  const lists = userListsData?.lists || [];
  
  // Add to list mutation
  const addToListMutation = useMutation({
    mutationFn: async ({ listType, isCustom }: { listType: string; isCustom?: boolean }) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Use explicit external source/ID if provided (DNA recommendations), otherwise infer from media type
      let externalSource = item.externalSource || 'tmdb';
      let externalId = item.externalId || item.id;
      
      if (!item.externalSource) {
        // Fallback: determine source based on media type for non-DNA recommendations
        if (item.mediaType === 'book') {
          externalSource = 'openlibrary';
        } else if (item.mediaType === 'podcast') {
          externalSource = 'spotify';
        }
      }

      const mediaData = {
        title: item.title,
        mediaType: item.mediaType || 'movie',
        creator: item.author || '',
        imageUrl: item.imageUrl,
        externalId,
        externalSource
      };

      console.log('🎯 MediaCarousel: Adding to list', {
        item,
        mediaData,
        listType,
        isCustom,
      });

      // Use different endpoints for custom vs default lists
      const url = isCustom 
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-to-custom-list`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-media`;

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
        console.error('❌ Failed to add to list:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          url,
          body,
        });
        throw new Error(errorData.error || errorData.message || 'Failed to add to list');
      }
      
      console.log('✅ Successfully added to list!');
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      // Check if this was a duplicate (already in list)
      const isDuplicate = result?.message === 'Item already in list';
      
      toast({
        title: isDuplicate ? "Already in list!" : "Added to list!",
        description: isDuplicate 
          ? `${item.title} is already in this list.`
          : `${item.title} has been added to your list.`,
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
  
  // Rate item mutation
  const rateMutation = useMutation({
    mutationFn: async (ratingValue: number) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Use explicit external source/ID if provided (DNA recommendations), otherwise infer from media type
      let externalSource = item.externalSource || 'tmdb';
      let externalId = item.externalId || item.id;
      
      if (!item.externalSource) {
        // Fallback: determine source based on media type for non-DNA recommendations
        if (item.mediaType === 'book') {
          externalSource = 'openlibrary';
        } else if (item.mediaType === 'podcast') {
          externalSource = 'spotify';
        }
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rate-media`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          media_external_id: externalId,
          media_external_source: externalSource,
          media_title: item.title,
          media_type: item.mediaType || 'movie',
          rating: ratingValue,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rate item');
      }
      return response.json();
    },
    onSuccess: (_, ratingValue) => {
      toast({
        title: "Rating submitted!",
        description: `You rated ${item.title} ${ratingValue} stars.`,
      });
      setShowRatingStars(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleAddToList = (listType: string, isCustom = false, e?: React.MouseEvent) => {
    e?.stopPropagation();
    addToListMutation.mutate({ listType, isCustom });
  };
  
  const handleRateClick = (stars: number) => {
    rateMutation.mutate(stars);
  };
  
  // Get icon based on media type
  const getMediaIcon = () => {
    const iconClass = "h-16 w-16 text-white/40";
    switch (item.mediaType?.toLowerCase()) {
      case 'movie':
        return <Film className={iconClass} />;
      case 'tv':
      case 'tv-show':
        return <Tv className={iconClass} />;
      case 'music':
      case 'album':
        return <Music className={iconClass} />;
      case 'book':
        return <Book className={iconClass} />;
      case 'podcast':
        return <Mic className={iconClass} />;
      default:
        return <Tv className={iconClass} />;
    }
  };

  // Get platform badge info
  const getPlatformBadge = () => {
    if (!item.platform) return null;
    
    const platforms: Record<string, { letter: string; bg: string; text: string }> = {
      netflix: { letter: 'N', bg: 'bg-red-600', text: 'text-white' },
      disney: { letter: 'D', bg: 'bg-blue-600', text: 'text-white' },
      hulu: { letter: 'H', bg: 'bg-green-500', text: 'text-white' },
      prime: { letter: 'P', bg: 'bg-sky-500', text: 'text-white' },
      max: { letter: 'M', bg: 'bg-purple-700', text: 'text-white' },
      peacock: { letter: 'P', bg: 'bg-yellow-400', text: 'text-black' },
      apple: { letter: 'A', bg: 'bg-black', text: 'text-white' },
      paramount: { letter: 'P', bg: 'bg-blue-500', text: 'text-white' },
    };
    
    return platforms[item.platform.toLowerCase()] || null;
  };

  const platformBadge = getPlatformBadge();

  return (
    <div className="group relative overflow-visible">
      {/* Poster */}
      <div
        className="relative aspect-[2/3] rounded-lg overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handlePosterClick}
        data-testid={`media-card-${item.id}`}
      >
        {imageError || !item.imageUrl ? (
          // Fallback placeholder - styled like a book cover for books, gradient for others
          item.mediaType?.toLowerCase() === 'book' ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-700 via-purple-600 to-purple-900 flex flex-col items-center justify-center p-4 border-2 border-purple-900/50 shadow-inner pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
              <Book className="h-14 w-14 text-purple-200/70 mb-4 relative z-10" />
              <p className="text-purple-50 text-sm font-serif text-center leading-tight line-clamp-3 relative z-10 font-semibold">
                {item.title}
              </p>
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 via-purple-900/30 to-gray-900 flex items-center justify-center pointer-events-none">
              {getMediaIcon()}
            </div>
          )
        ) : (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
            onLoad={(e) => {
              // Check if image is too small (Open Library returns tiny placeholders)
              const img = e.currentTarget;
              if (img.naturalWidth < 50 || img.naturalHeight < 50) {
                setImageError(true);
              }
            }}
          />
        )}
        
        {/* Action buttons - always visible, bottom right */}
        <div className="absolute bottom-1.5 right-1.5 flex gap-1 z-10 pointer-events-auto">
          {/* Add to List Button */}
          <button
            ref={addButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowListMenu(!showListMenu);
            }}
            className="h-6 w-6 rounded-full bg-black/80 hover:bg-black backdrop-blur-sm text-white shadow-md flex items-center justify-center transition-colors"
            data-testid={`add-to-list-${item.id}`}
            disabled={addToListMutation.isPending}
          >
            <Plus className="h-3 w-3" />
          </button>
          
          {/* List Menu - Portal */}
          {showListMenu && createPortal(
            <div 
              className="fixed bg-black/95 backdrop-blur-md rounded-lg p-1.5 shadow-2xl border border-white/20 flex flex-col gap-0 min-w-max text-sm z-50"
              style={{
                top: `${listMenuPos.top}px`,
                left: `${listMenuPos.left}px`,
                transform: 'translate(-50%, -100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
                {['Queue', 'Currently', 'Finished', 'Did Not Finish', 'Favorites'].map((listTitle) => (
                  <button
                    key={listTitle}
                    onClick={() => {
                      handleAddToList(listTitle, false);
                      setShowListMenu(false);
                    }}
                    disabled={addToListMutation.isPending}
                    className="px-2 py-1 text-white text-xs hover:bg-gray-700 rounded transition-colors text-left"
                  >
                    {listTitle}
                  </button>
                ))}
                
                {/* Custom Lists */}
                {lists.filter((list: any) => list.isCustom).length > 0 && (
                  <>
                    <div className="border-t border-gray-600 my-1" />
                    {lists
                      .filter((list: any) => list.isCustom)
                      .map((list: any) => (
                        <button
                          key={list.id}
                          onClick={() => {
                            handleAddToList(list.id, true);
                            setShowListMenu(false);
                          }}
                          disabled={addToListMutation.isPending}
                          className="px-2 py-1 text-white text-xs hover:bg-gray-700 rounded transition-colors text-left"
                        >
                          {list.title}
                        </button>
                      ))}
                  </>
                )}
              </div>
            , document.body)}
          
          {/* Rating Button */}
          <button
            ref={ratingButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowRatingStars(!showRatingStars);
            }}
            className="h-6 w-6 rounded-full bg-black/80 hover:bg-black backdrop-blur-sm text-white shadow-md flex items-center justify-center transition-colors"
            data-testid={`rate-${item.id}`}
          >
            <Star className="h-3 w-3" />
          </button>
          
          {/* Star Rating Menu - Portal */}
          {showRatingStars && createPortal(
            <div 
              className="fixed bg-black/95 backdrop-blur-md rounded-lg p-1.5 shadow-2xl border border-white/20 flex flex-col gap-0.5 z-50"
              style={{
                top: `${ratingMenuPos.top}px`,
                left: `${ratingMenuPos.left}px`,
                transform: 'translate(-50%, -100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
                {[5, 4, 3, 2, 1].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => {
                      handleRateClick(stars);
                      setShowRatingStars(false);
                    }}
                    onMouseEnter={() => setHoveredStar(stars)}
                    onMouseLeave={() => setHoveredStar(null)}
                    disabled={rateMutation.isPending}
                    className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-purple-600/50 transition-colors"
                    data-testid={`star-${stars}`}
                  >
                    <Star 
                      className={`h-4 w-4 transition-all ${
                        hoveredStar === stars
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-400'
                      }`}
                    />
                    <span className="text-white text-xs font-medium">{stars}</span>
                  </button>
                ))}
              </div>
            , document.body)}
        </div>

      </div>

      {/* Title */}
      <div className="mt-1.5">
        <h4
          className="text-xs font-medium text-white line-clamp-2 leading-tight"
          title={item.title}
        >
          {item.title}
        </h4>
        {item.author && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.author}</p>
        )}
      </div>
      
    </div>
  );
}
