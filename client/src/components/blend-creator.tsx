import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Users, X, Sparkles, Heart, Loader2, Film, BookOpen, Music, Headphones, Gamepad2, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface BlendCreatorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BlendRecommendation {
  title: string;
  media_type: string;
  creator: string;
  reason: string;
  image_url: string;
  external_id: string;
  external_source: string;
}

interface BlendResult {
  participants: string[];
  recommendations: BlendRecommendation[];
  seeds: Array<{
    user_id: string;
    seeds: Array<{
      title: string;
      media_type: string;
      creator?: string;
    }>;
  }>;
}


export default function BlendCreator({ isOpen, onClose }: BlendCreatorProps) {
  const [blendInput, setBlendInput] = useState<string>("");
  const [excludeConsumed, setExcludeConsumed] = useState<boolean>(true);
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null);
  const [step, setStep] = useState<"setup" | "results">("setup");

  const { user, session } = useAuth();
  const { toast } = useToast();

  const resetForm = () => {
    setBlendInput("");
    setExcludeConsumed(true);
    setBlendResult(null);
    setStep("setup");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };


  const createBlendMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      console.log('Creating blend with input:', blendInput);

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/blends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          blend_input: blendInput,
          max_results: 10, // Fixed at 10 recommendations
          exclude_already_consumed: excludeConsumed,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Blend creation error response:', response.status, errorText);
        throw new Error(`Blend creation failed: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data: BlendResult) => {
      console.log('Blend created successfully:', data);
      setBlendResult(data);
      setStep("results");
      toast({
        title: "Blend Created! ✨",
        description: `Found ${data.recommendations.length} personalized recommendations for your group.`,
      });
    },
    onError: (error: any) => {
      console.error('Blend creation error:', error);
      toast({
        title: "Blend Creation Failed",
        description: error.message || "Failed to create blend. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType?.toLowerCase()) {
      case 'movie': return <Film className="w-4 h-4 text-red-600" />;
      case 'tv': return <Trophy className="w-4 h-4 text-purple-600" />;
      case 'book': return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'music': return <Music className="w-4 h-4 text-green-600" />;
      case 'podcast': return <Headphones className="w-4 h-4 text-orange-600" />;
      case 'game': return <Gamepad2 className="w-4 h-4 text-indigo-600" />;
      default: return <Heart className="w-4 h-4 text-gray-500" />;
    }
  };

  const canCreateBlend = blendInput.trim().length > 0;

  if (step === "results" && blendResult) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-white flex flex-col">
          <DialogHeader className="pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center">
                  <Sparkles className="text-white" size={20} />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    Your Blend Results
                  </DialogTitle>
                  <p className="text-gray-600">
                    {blendResult.recommendations.length} recommendations for {blendResult.participants.length} participants
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                data-testid="close-blend-results"
              >
                <X size={20} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {/* Participants Summary */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Blend Participants</h3>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">
                  {blendResult.participants.length} participants contributing their entertainment preferences
                </span>
              </div>
            </div>

            {/* Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blendResult.recommendations.map((rec, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start space-x-3">
                    {rec.image_url ? (
                      <img 
                        src={rec.image_url} 
                        alt={rec.title}
                        className="w-16 h-20 object-cover rounded-md flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-20 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                        {getMediaTypeIcon(rec.media_type)}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getMediaTypeIcon(rec.media_type)}
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {rec.media_type}
                        </span>
                      </div>
                      
                      <h4 className="font-semibold text-gray-900 mb-1 leading-tight">
                        {rec.title}
                      </h4>
                      
                      {rec.creator && (
                        <p className="text-sm text-gray-600 mb-2">
                          by {rec.creator}
                        </p>
                      )}
                      
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {blendResult.recommendations.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recommendations Found</h3>
                <p className="text-gray-600">
                  Try expanding your media types or adjusting your settings.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 flex justify-between flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setStep("setup")}
              data-testid="back-to-setup"
            >
              Create Another Blend
            </Button>
            <Button
              onClick={handleClose}
              className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white"
              data-testid="done-blend"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center">
                <Users className="text-white" size={20} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Create a Blend
                </DialogTitle>
                <p className="text-gray-600">
                  Find entertainment that everyone will love
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              data-testid="close-blend-creator"
            >
              <X size={20} />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main Input Area */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Blend Your Tastes
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Add a few titles you and a friend/group/partner already love (books, shows, movies, music, podcasts, or games) and we'll mix your tastes to recommend picks you'll both enjoy.
            </p>
            <Textarea
              placeholder="e.g., 'Recommend movies for me and my friends john, sarah. We like sci-fi and comedy.' or 'Find books similar to Harry Potter that I haven't read yet.'"
              value={blendInput}
              onChange={(e) => setBlendInput(e.target.value)}
              className="min-h-[120px] resize-none bg-white text-black border-gray-300"
              data-testid="input-blend-description"
            />
            <p className="text-xs text-gray-500 mt-1">
              Describe what you want recommendations for, who's involved, and any preferences you have.
            </p>
          </div>

          {/* Settings */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="exclude-consumed"
              checked={excludeConsumed}
              onCheckedChange={(checked) => setExcludeConsumed(checked as boolean)}
              data-testid="checkbox-exclude-consumed"
            />
            <label htmlFor="exclude-consumed" className="text-sm font-medium text-gray-700 cursor-pointer">
              Exclude already consumed
            </label>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="cancel-blend"
          >
            Cancel
          </Button>
          <div className="flex flex-col items-end space-y-2">
            <Button
              onClick={() => createBlendMutation.mutate()}
              disabled={!canCreateBlend || createBlendMutation.isPending}
              className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white min-w-[140px]"
              data-testid="create-blend-button"
            >
              {createBlendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Blend
                </>
              )}
            </Button>
            {createBlendMutation.isPending && (
              <p className="text-xs text-gray-500 text-right animate-pulse">
                Thanks for being patient, it takes a moment! ✨
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}