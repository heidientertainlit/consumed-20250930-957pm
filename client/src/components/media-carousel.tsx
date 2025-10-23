import { Plus, Star, Film, Tv, Music, Book, Mic } from "lucide-react";
import { useState } from "react";
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
    <div className="w-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl p-6 shadow-lg border border-gray-800/50" data-testid={`carousel-${mediaType}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-gray-400 mt-1">Swipe to explore</p>
      </div>

      {/* Scrollable carousel */}
      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide px-2">
        {items.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-32 sm:w-36 md:w-40">
            <MediaCard
              item={item}
              onItemClick={onItemClick}
              onAddToList={onAddToList}
              onRate={onRate}
            />
          </div>
        ))}
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
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handlePointerDown = () => {
    setIsDragging(false);
  };
  
  const handlePointerMove = () => {
    setIsDragging(true);
  };
  
  const handleClick = () => {
    if (!isDragging) {
      onItemClick?.(item);
    }
  };
  
  // Fetch user's lists
  const { data: lists = [] } = useQuery<any[]>({
    queryKey: ['/api/user-lists'],
    enabled: !!session?.access_token,
  });
  
  // Add to list mutation
  const addToListMutation = useMutation({
    mutationFn: async ({ listType, isCustom }: { listType: string; isCustom?: boolean }) => {
      const response = await fetch('/api/list-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listType,
          isCustomList: isCustom || false,
          title: item.title,
          type: item.mediaType || 'movie',
          creator: '',
          imageUrl: item.imageUrl,
        }),
      });
      if (!response.ok) throw new Error('Failed to add to list');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to list!",
        description: `${item.title} has been added to your list.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-lists'] });
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
      const response = await fetch('/api/rate-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          rating: ratingValue,
          type: item.mediaType || 'movie',
        }),
      });
      if (!response.ok) throw new Error('Failed to rate item');
      return response.json();
    },
    onSuccess: (_, ratingValue) => {
      toast({
        title: "Rating submitted!",
        description: `You rated ${item.title} ${ratingValue} stars.`,
      });
      setShowRatingStars(false);
    },
  });
  
  const handleAddToList = (listType: string, isCustom = false) => {
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

  return (
    <div className="group relative">
      {/* Poster */}
      <div
        className="relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:ring-2 group-hover:ring-purple-500"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        data-testid={`media-card-${item.id}`}
      >
        {imageError || !item.imageUrl ? (
          // Fallback gradient placeholder
          <div className="w-full h-full bg-gradient-to-br from-gray-800 via-purple-900/30 to-gray-900 flex items-center justify-center">
            {getMediaIcon()}
          </div>
        ) : (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        )}
        
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Mobile-friendly action buttons - bottom right */}
        <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white border border-white/20 shadow-lg"
                data-testid={`add-to-list-${item.id}`}
                disabled={addToListMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-700">
              <DropdownMenuItem
                onClick={() => handleAddToList('queue')}
                className="cursor-pointer text-white hover:bg-gray-800"
                disabled={addToListMutation.isPending}
              >
                Add to Queue
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAddToList('currently')}
                className="cursor-pointer text-white hover:bg-gray-800"
                disabled={addToListMutation.isPending}
              >
                Add to Currently
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAddToList('finished')}
                className="cursor-pointer text-white hover:bg-gray-800"
                disabled={addToListMutation.isPending}
              >
                Add to Finished
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAddToList('dnf')}
                className="cursor-pointer text-white hover:bg-gray-800"
                disabled={addToListMutation.isPending}
              >
                Add to Did Not Finish
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAddToList('favorites')}
                className="cursor-pointer text-white hover:bg-gray-800"
                disabled={addToListMutation.isPending}
              >
                Add to Favorites
              </DropdownMenuItem>
              
              {/* Custom Lists */}
              {lists.filter((list: any) => !list.is_default).length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold border-t border-gray-700 mt-1 pt-2">
                    MY CUSTOM LISTS
                  </div>
                  {lists
                    .filter((list: any) => !list.is_default)
                    .map((list: any) => (
                      <DropdownMenuItem
                        key={list.id}
                        onClick={() => handleAddToList(list.id, true)}
                        className="cursor-pointer text-white hover:bg-gray-800"
                        disabled={addToListMutation.isPending}
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
              setShowRatingStars(!showRatingStars);
            }}
            data-testid={`rate-${item.id}`}
          >
            <Star className="h-4 w-4" />
          </Button>
          
          {/* Inline vertical star rating */}
          {showRatingStars && (
            <div 
              className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-lg p-2 shadow-2xl border border-white/20 flex flex-col gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {[5, 4, 3, 2, 1].map((stars) => (
                <button
                  key={stars}
                  type="button"
                  onClick={() => handleRateClick(stars)}
                  disabled={rateMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-purple-600/50 transition-colors"
                  data-testid={`star-${stars}`}
                >
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-white text-sm font-medium">{stars}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rating badge (if exists) */}
        {item.rating && (
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold text-white">{item.rating}</span>
          </div>
        )}
      </div>

      {/* Title & Year */}
      <div className="mt-2 px-1">
        <h4
          className="text-sm font-semibold text-white line-clamp-2 leading-tight cursor-pointer hover:text-purple-400 transition-colors"
          onClick={() => onItemClick?.(item)}
          title={item.title}
        >
          {item.title}
        </h4>
        {item.year && (
          <p className="text-xs text-gray-400 mt-0.5">{item.year}</p>
        )}
      </div>
      
    </div>
  );
}
