import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
      <DialogContent className="sm:max-w-[600px] bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Rate & Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Selected Media Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              {mediaImage ? (
                <img
                  src={mediaImage}
                  alt={mediaTitle}
                  className="w-12 h-12 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                  <Star className="text-gray-400" size={20} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{mediaTitle}</p>
                {mediaCreator && (
                  <p className="text-sm text-gray-500 truncate">by {mediaCreator}</p>
                )}
                <p className="text-xs text-purple-600 capitalize">{mediaType}</p>
              </div>
            </div>
          </div>

          {/* Rating Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate this media (optional)</h3>
            <div className="flex items-center space-x-4">
              {/* Star Display */}
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star === rating ? 0 : star)}
                    className="p-1 hover:scale-110 transition-transform"
                    data-testid={`star-${star}`}
                  >
                    <Star
                      size={24}
                      className={`${
                        star <= Math.floor(rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : star <= rating
                          ? 'fill-yellow-200 text-yellow-200'
                          : 'fill-gray-200 text-gray-200'
                      } hover:fill-yellow-300 hover:text-yellow-300 transition-colors cursor-pointer`}
                    />
                  </button>
                ))}
              </div>

              {/* Rating Input */}
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={rating || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0 && value <= 5) {
                      setRating(value);
                    } else if (e.target.value === '') {
                      setRating(0);
                    }
                  }}
                  className="w-16 text-center bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="0"
                  data-testid="rating-input"
                />
                <span className="text-sm text-gray-500">(0-5)</span>
              </div>
            </div>
          </div>

          {/* Review Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Thoughts (Review)</h3>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your thoughts about this media..."
              className="min-h-[120px] resize-none bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500 placeholder:text-gray-500"
              data-testid="textarea-review"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={submitRatingMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitRatingMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-submit-rating"
          >
            {submitRatingMutation.isPending ? "Submitting..." : "Submit Rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
