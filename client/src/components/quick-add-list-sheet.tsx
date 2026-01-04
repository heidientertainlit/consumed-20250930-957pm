import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { X, Loader2, Check, Play, Clock, Ban, Heart, Folder, Star, MessageSquare, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface QuickAddListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    title: string;
    mediaType: string;
    imageUrl?: string;
    externalId?: string;
    externalSource?: string;
    creator?: string;
  } | null;
}

type SheetStep = 'select-list' | 'follow-up';

export function QuickAddListSheet({ isOpen, onClose, media }: QuickAddListSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [step, setStep] = useState<SheetStep>('select-list');
  const [addedListName, setAddedListName] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const { data: userListsData, isLoading: isLoadingLists } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user lists');
      return response.json();
    },
    enabled: !!session?.access_token && isOpen,
  });

  const userLists = userListsData?.lists || [];

  const handleClose = () => {
    setStep('select-list');
    setAddedListName('');
    setSelectedRating(0);
    setHoveredRating(0);
    onClose();
  };

  const getListStyle = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('currently') || lower.includes('watching') || lower.includes('reading')) {
      return { bg: 'bg-purple-100', icon: <Play className="text-purple-600" size={20} />, desc: 'Currently consuming' };
    }
    if (lower.includes('queue') || lower.includes('want')) {
      return { bg: 'bg-blue-100', icon: <Clock className="text-blue-600" size={20} />, desc: 'Save for later' };
    }
    if (lower.includes('finished') || lower.includes('complete')) {
      return { bg: 'bg-green-100', icon: <Check className="text-green-600" size={20} />, desc: 'Completed media' };
    }
    if (lower.includes('dnf') || lower.includes('not finish')) {
      return { bg: 'bg-red-100', icon: <Ban className="text-red-600" size={20} />, desc: 'Stopped watching/reading' };
    }
    if (lower.includes('favorite')) {
      return { bg: 'bg-yellow-100', icon: <Heart className="text-yellow-600" size={20} />, desc: 'Your favorites' };
    }
    return { bg: 'bg-purple-100', icon: <Folder className="text-purple-600" size={20} />, desc: 'Custom list' };
  };

  const shouldShowFollowUp = (listName: string) => {
    const lower = listName.toLowerCase();
    return lower.includes('finished') || lower.includes('complete') || 
           lower.includes('favorite') || lower.includes('favorites');
  };

  const handleAddToList = async (listId: string, listName: string) => {
    if (!session?.access_token || !media) return;
    
    setIsAdding(listId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: listId,
          media_title: media.title,
          media_type: media.mediaType,
          media_creator: media.creator || '',
          media_image_url: media.imageUrl || '',
          media_external_id: media.externalId,
          media_external_source: media.externalSource || 'tmdb',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add to list');
      }

      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      
      if (shouldShowFollowUp(listName)) {
        setAddedListName(listName);
        setStep('follow-up');
      } else {
        toast({ title: `Added "${media.title}" to ${listName}!` });
        handleClose();
      }
    } catch (error: any) {
      toast({ title: error.message || "Failed to add", variant: "destructive" });
    } finally {
      setIsAdding(null);
    }
  };

  const handleSubmitRating = async () => {
    if (!session?.access_token || !media || selectedRating === 0) return;
    
    setIsSubmittingRating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_external_id: media.externalId,
          media_external_source: media.externalSource || 'tmdb',
          media_title: media.title,
          media_type: media.mediaType,
          rating: selectedRating,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      toast({ title: `Rated "${media.title}" ${selectedRating} stars!` });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      handleClose();
    } catch (error: any) {
      toast({ title: error.message || "Failed to rate", variant: "destructive" });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleShare = async () => {
    if (!media) return;
    
    const shareText = `I just added "${media.title}" to my ${addedListName} on Consumed! Check it out.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${media.title} on Consumed`,
          text: shareText,
          url: window.location.origin,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Copied to clipboard!" });
    }
    handleClose();
  };

  if (step === 'follow-up') {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className="bg-white rounded-t-2xl">
          <DrawerHeader className="text-center pb-2 border-b border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="text-green-600" size={18} />
              </div>
              <DrawerTitle className="text-lg font-semibold text-gray-900">
                Done!
              </DrawerTitle>
            </div>
            {media && (
              <p className="text-sm text-gray-500">
                Added <span className="font-medium text-gray-700">{media.title}</span> to {addedListName}
              </p>
            )}
          </DrawerHeader>
          
          <div className="px-4 py-6 space-y-6">
            <div className="text-center">
              <p className="text-gray-700 font-medium mb-4">How would you rate this?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                    data-testid={`followup-star-${star}`}
                  >
                    <Star
                      size={32}
                      className={
                        (hoveredRating || selectedRating) >= star
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300"
                      }
                    />
                  </button>
                ))}
              </div>
              {selectedRating > 0 && (
                <button
                  onClick={handleSubmitRating}
                  disabled={isSubmittingRating}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                  data-testid="submit-rating-btn"
                >
                  {isSubmittingRating ? (
                    <Loader2 className="animate-spin inline" size={16} />
                  ) : (
                    "Submit Rating"
                  )}
                </button>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-center text-gray-500 text-sm mb-4">Or share the love...</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium text-gray-700 transition-colors"
                  data-testid="share-btn"
                >
                  <Share2 size={16} />
                  Recommend to Friends
                </button>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              data-testid="skip-followup-btn"
            >
              Skip for now
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">
            Add to List
          </DrawerTitle>
          {media && (
            <p className="text-sm text-gray-500 mt-1">{media.title}</p>
          )}
        </DrawerHeader>
        
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          {isLoadingLists ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          ) : userLists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No lists yet</p>
              <p className="text-sm mt-1">Create a list to start tracking</p>
            </div>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
                data-testid="list-option-cancel"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <X className="text-gray-500" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Cancel</p>
                  <p className="text-sm text-gray-500">Go back</p>
                </div>
              </button>
              
              {userLists.map((list: any) => {
                const style = getListStyle(list.title || list.name);
                const listName = list.title || list.name;
                const isAddingThis = isAdding === list.id;
                
                return (
                  <button
                    key={list.id}
                    onClick={() => handleAddToList(list.id, listName)}
                    disabled={isAdding !== null}
                    className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                    data-testid={`list-option-${list.id}`}
                  >
                    <div className={`w-10 h-10 ${style.bg} rounded-full flex items-center justify-center`}>
                      {isAddingThis ? (
                        <Loader2 className="animate-spin text-purple-600" size={20} />
                      ) : (
                        style.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{listName}</p>
                      <p className="text-sm text-gray-500">{style.desc}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
