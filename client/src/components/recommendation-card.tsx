import { useState } from "react";
import { Star, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface RecommendationCardProps {
  item: {
    id: string;
    title: string;
    imageUrl?: string;
    posterPath?: string;
    type?: string;
    mediaType?: string;
    externalId?: string;
    externalSource?: string;
    creator?: string;
    author?: string;
  };
  idx: number;
  onMediaClick: (item: any) => void;
  onAddClick: (item: any) => void;
}

export default function RecommendationCard({
  item,
  idx,
  onMediaClick,
  onAddClick,
}: RecommendationCardProps) {
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [submittedRating, setSubmittedRating] = useState<number | null>(null);
  const { session } = useAuth();
  const { toast } = useToast();

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const mediaType = item.type || item.mediaType || "movie";
      let externalSource = item.externalSource || "tmdb";
      let externalId = item.externalId || item.id;

      if (!item.externalSource) {
        if (mediaType === "book") {
          externalSource = "openlibrary";
        } else if (mediaType === "podcast") {
          externalSource = "spotify";
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co"}/functions/v1/rate-media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            media_external_id: externalId,
            media_external_source: externalSource,
            media_title: item.title,
            media_type: mediaType,
            rating: rating,
            skip_social_post: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Rate-media error:', errorData, 'Request was:', {
          media_external_id: externalId,
          media_external_source: externalSource,
          media_title: item.title,
          media_type: mediaType,
          rating: rating,
        });
        throw new Error(errorData.error || "Failed to rate");
      }

      return response.json();
    },
    onSuccess: (_, rating) => {
      setSubmittedRating(rating);
      toast({
        title: "Rated!",
        description: `You rated "${item.title}" ${rating} star${rating !== 1 ? "s" : ""}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (submittedRating === null) {
      const newRating = parseFloat(e.target.value);
      setCurrentRating(newRating);
      if (newRating > 0) {
        rateMutation.mutate(newRating);
      }
    }
  };

  const displayRating = submittedRating !== null ? submittedRating : currentRating;

  return (
    <div className="flex-shrink-0 w-28">
      <div
        className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-1.5 cursor-pointer"
        onClick={() => onMediaClick(item)}
      >
        {item.imageUrl || item.posterPath ? (
          <img
            src={item.imageUrl || item.posterPath}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
      </div>
      <p
        className="text-xs font-medium text-white line-clamp-2 leading-tight cursor-pointer h-8"
        onClick={() => onMediaClick(item)}
      >
        {item.title}
      </p>
      <div className="relative flex items-center mt-1" onClick={(e) => e.stopPropagation()}>
        {/* Stars display */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <div 
              key={star} 
              className="relative"
              style={{ width: 14, height: 14 }}
            >
              <Star size={14} className="absolute inset-0 text-purple-300" />
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ 
                  width: displayRating >= star ? '100%' : displayRating >= star - 0.5 ? '50%' : '0%'
                }}
              >
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
              </div>
            </div>
          ))}
        </div>
        {/* Invisible slider overlay */}
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={displayRating}
          onChange={handleSliderChange}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          style={{ margin: 0 }}
          disabled={rateMutation.isPending || submittedRating !== null}
          data-testid={`rec-slider-${idx}`}
        />
        {submittedRating !== null && (
          <Check size={12} className="text-green-400 ml-1" />
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddClick(item);
        }}
        className="mt-1.5 w-full bg-white text-purple-800 text-xs py-1.5 rounded-full hover:bg-purple-100 transition-colors font-medium"
        data-testid={`rec-add-${idx}`}
      >
        + Add
      </button>
    </div>
  );
}
