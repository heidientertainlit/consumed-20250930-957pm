import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaTitle: string;
  mediaType: string;
  mediaCreator?: string;
  mediaImage?: string;
  mediaExternalId?: string;
  mediaExternalSource?: string;
}

export default function RatingModal({
  isOpen,
  onClose,
  mediaTitle,
  mediaType,
  mediaCreator,
  mediaImage,
  mediaExternalId,
  mediaExternalSource
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('No session token');
      }

      const response = await fetch(
        "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/share-update",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: review,
            media_title: mediaTitle,
            media_type: mediaType,
            media_creator: mediaCreator,
            media_image_url: mediaImage,
            rating: rating > 0 ? rating : null,
            media_external_id: mediaExternalId,
            media_external_source: mediaExternalSource
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to submit rating:', errorText);
        throw new Error('Failed to submit rating');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rating submitted!",
        description: "Your rating has been shared with your friends",
      });
      // Invalidate feed queries to show the new post
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      // Invalidate media reviews so it shows on the media detail page
      queryClient.invalidateQueries({ queryKey: ['media-reviews'] });
      // Reset form
      setRating(0);
      setReview("");
      onClose();
    },
    onError: (error) => {
      console.error('Rating submission error:', error);
      toast({
        title: "Failed to submit rating",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0 && !review.trim()) {
      toast({
        title: "Add a rating or review",
        description: "Please add at least a star rating or write a review",
        variant: "destructive",
      });
      return;
    }
    submitRatingMutation.mutate();
  };

  const handleClose = () => {
    setRating(0);
    setReview("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[600px] mx-4 bg-white max-h-[85vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            Rate & Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          {/* Selected Media Display */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center space-x-3">
              {mediaImage ? (
                <img
                  src={mediaImage}
                  alt={mediaTitle}
                  className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                  <Star className="text-gray-400" size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{mediaTitle}</p>
                {mediaCreator && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate">by {mediaCreator}</p>
                )}
                <p className="text-xs text-purple-600 capitalize">{mediaType}</p>
              </div>
            </div>
          </div>

          {/* Rating Section */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Rate this media (optional)</h3>
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="relative flex items-center gap-1">
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
            </div>
          </div>

          {/* Review Section */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Your Thoughts (Review)</h3>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your thoughts about this media..."
              className="min-h-[100px] sm:min-h-[120px] resize-none bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500 placeholder:text-gray-500"
              data-testid="textarea-review"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 sm:pt-4 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={submitRatingMutation.isPending}
            className="text-sm px-3 sm:px-4"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitRatingMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 sm:px-4"
            data-testid="button-submit-rating"
          >
            {submitRatingMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
