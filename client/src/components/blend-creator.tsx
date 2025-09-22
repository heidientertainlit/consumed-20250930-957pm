import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, X, Sparkles, Film, BookOpen, Music, Headphones, Gamepad2, Trophy, Heart, Loader2, CheckCircle } from "lucide-react";
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

const mediaTypes = [
  { id: "movie", label: "Movies", icon: <Film className="w-4 h-4 text-red-600" /> },
  { id: "tv", label: "TV Shows", icon: <Trophy className="w-4 h-4 text-purple-600" /> },
  { id: "book", label: "Books", icon: <BookOpen className="w-4 h-4 text-blue-600" /> },
  { id: "music", label: "Music", icon: <Music className="w-4 h-4 text-green-600" /> },
  { id: "podcast", label: "Podcasts", icon: <Headphones className="w-4 h-4 text-orange-600" /> },
  { id: "game", label: "Games", icon: <Gamepad2 className="w-4 h-4 text-indigo-600" /> }
];

export default function BlendCreator({ isOpen, onClose }: BlendCreatorProps) {
  const [participantUsernames, setParticipantUsernames] = useState<string>("");
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<string[]>([]);
  const [maxResults, setMaxResults] = useState<string>("10");
  const [excludeConsumed, setExcludeConsumed] = useState<boolean>(true);
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null);
  const [step, setStep] = useState<"setup" | "results">("setup");

  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const resetForm = () => {
    setParticipantUsernames("");
    setSelectedMediaTypes([]);
    setMaxResults("10");
    setExcludeConsumed(true);
    setBlendResult(null);
    setStep("setup");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleMediaTypeToggle = (mediaTypeId: string) => {
    setSelectedMediaTypes(prev => 
      prev.includes(mediaTypeId) 
        ? prev.filter(id => id !== mediaTypeId)
        : [...prev, mediaTypeId]
    );
  };

  const createBlendMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Parse participant usernames - split by comma, newline, or semicolon
      const participants = participantUsernames
        .split(/[,;\n]+/)
        .map(name => name.trim())
        .filter(name => name.length > 0);

      console.log('Creating blend with participants:', participants);

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/blends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          participant_user_ids: participants, // Let backend resolve usernames to user IDs
          max_results: parseInt(maxResults),
          media_types: selectedMediaTypes.length > 0 ? selectedMediaTypes : undefined,
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
    const type = mediaTypes.find(mt => mt.id === mediaType);
    return type?.icon || <Heart className="w-4 h-4 text-gray-500" />;
  };

  const canCreateBlend = participantUsernames.trim().length > 0;

  if (step === "results" && blendResult) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white">
          <DialogHeader className="pb-4 border-b border-gray-100">
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

          <div className="flex-1 overflow-y-auto p-1">
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

          <div className="border-t border-gray-100 pt-4 flex justify-between">
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
          {/* Participants Input */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Participants
            </label>
            <Input
              placeholder="Enter usernames (separated by commas)"
              value={participantUsernames}
              onChange={(e) => setParticipantUsernames(e.target.value)}
              className="w-full"
              data-testid="input-participants"
            />
            <p className="text-xs text-gray-500 mt-1">
              Add friends' usernames separated by commas. Leave empty to create a blend for just yourself.
            </p>
          </div>

          {/* Media Types Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Media Types (optional)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {mediaTypes.map((mediaType) => (
                <div
                  key={mediaType.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedMediaTypes.includes(mediaType.id)
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleMediaTypeToggle(mediaType.id)}
                >
                  <Checkbox
                    checked={selectedMediaTypes.includes(mediaType.id)}
                    onChange={() => handleMediaTypeToggle(mediaType.id)}
                    data-testid={`checkbox-${mediaType.id}`}
                  />
                  <div className="flex items-center space-x-2">
                    {mediaType.icon}
                    <span className="text-sm font-medium text-gray-700">
                      {mediaType.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Leave unselected to include all media types
            </p>
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Max Results
              </label>
              <Select value={maxResults} onValueChange={setMaxResults}>
                <SelectTrigger data-testid="select-max-results">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 recommendations</SelectItem>
                  <SelectItem value="10">10 recommendations</SelectItem>
                  <SelectItem value="15">15 recommendations</SelectItem>
                  <SelectItem value="20">20 recommendations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 mt-6">
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
        </div>

        <div className="border-t border-gray-100 pt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="cancel-blend"
          >
            Cancel
          </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}