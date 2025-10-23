import { Plus, Star, Film, Tv, Music, Book, Mic, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
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
      // This would be implemented with your backend
      console.log('Rating item:', item.title, 'with', ratingValue);
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Rated!",
        description: `You rated ${item.title} ${rating} stars.`,
      });
      setShowRateDialog(false);
      setRating(0);
    },
  });
  
  const handleAddToList = (listType: string, isCustom = false) => {
    addToListMutation.mutate({ listType, isCustom });
  };
  
  const handleSubmitRating = () => {
    if (rating > 0) {
      rateMutation.mutate(rating);
    }
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
              setShowRateDialog(true);
            }}
            data-testid={`rate-${item.id}`}
          >
            <Star className="h-4 w-4" />
          </Button>
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
      
      {/* Rating Drawer - slides up from bottom on mobile */}
      <Drawer open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DrawerContent className="bg-gray-900 border-gray-700 text-white">
          <DrawerHeader>
            <DrawerTitle className="text-center">Rate {item.title}</DrawerTitle>
            <DrawerDescription className="text-gray-400 text-center">
              How would you rate this {item.mediaType || 'item'}?
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="space-y-6 py-6 px-4">
            {/* Star Rating */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                  data-testid={`star-${star}`}
                >
                  <Star
                    className={`h-12 w-12 ${
                      star <= (hoverRating || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            
            {/* Number Input */}
            <div className="flex items-center justify-center gap-3">
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={rating || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val >= 0 && val <= 5) {
                    setRating(val);
                  }
                }}
                className="w-28 text-center bg-gray-800 border-gray-700 text-white text-lg"
                placeholder="0"
                data-testid="input-rating"
              />
              <span className="text-gray-400">(0-5)</span>
            </div>
          </div>
          
          <DrawerFooter className="px-4 pb-6">
            <Button
              onClick={handleSubmitRating}
              disabled={rating === 0 || rateMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg"
              data-testid="button-submit-rating"
            >
              {rateMutation.isPending ? 'Submitting...' : 'Submit Rating'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 py-6">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
