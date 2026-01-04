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
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
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
            media: {
              title: item.title,
              mediaType: mediaType,
              imageUrl: item.imageUrl || item.posterPath,
              externalId: externalId,
              externalSource: externalSource,
            },
            rating: rating,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
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

  const handleStarClick = (starValue: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rateMutation.isPending && submittedRating === null) {
      rateMutation.mutate(starValue);
    }
  };

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
        className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight cursor-pointer h-8"
        onClick={() => onMediaClick(item)}
      >
        {item.title}
      </p>
      <div className="flex items-center gap-0.5 mt-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = submittedRating !== null ? star <= submittedRating : star <= (hoveredStar || 0);
          return (
            <button
              key={star}
              type="button"
              className="w-3.5 h-3.5 focus:outline-none disabled:cursor-not-allowed"
              onMouseEnter={() => !submittedRating && setHoveredStar(star)}
              onMouseLeave={() => !submittedRating && setHoveredStar(null)}
              onClick={(e) => handleStarClick(star, e)}
              disabled={rateMutation.isPending || submittedRating !== null}
              data-testid={`rec-star-${idx}-${star}`}
            >
              <Star
                size={14}
                className={`transition-colors ${
                  isFilled
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                }`}
              />
            </button>
          );
        })}
        {submittedRating !== null && (
          <Check size={12} className="text-green-500 ml-1" />
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddClick(item);
        }}
        className="mt-1.5 w-full bg-purple-700 text-white text-xs py-1 rounded-full hover:bg-purple-800 transition-colors"
        data-testid={`rec-add-${idx}`}
      >
        + Add
      </button>
    </div>
  );
}
