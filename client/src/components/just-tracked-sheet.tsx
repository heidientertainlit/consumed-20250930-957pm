import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, Flame, Star, Users, Sparkles, ChevronRight } from "lucide-react";

interface JustTrackedMedia {
  title: string;
  mediaType: string;
  imageUrl?: string;
  externalId?: string;
  externalSource?: string;
  creator?: string;
}

interface JustTrackedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  media: JustTrackedMedia | null;
  listName?: string;
  onDropHotTake?: () => void;
  onRateIt?: () => void;
  onChallengeFriend?: () => void;
  showRateOption?: boolean;
}

export function JustTrackedSheet({ 
  isOpen, 
  onClose, 
  media, 
  listName,
  onDropHotTake,
  onRateIt,
  onChallengeFriend,
  showRateOption = true,
}: JustTrackedSheetProps) {
  if (!media) return null;

  const getMediaVerb = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'book': return 'read';
      case 'music':
      case 'podcast': return 'listened to';
      case 'game': return 'played';
      default: return 'watched';
    }
  };

  const handleChallenge = async () => {
    if (onChallengeFriend) {
      onChallengeFriend();
      return;
    }
    const verb = getMediaVerb(media.mediaType);
    const shareText = `Have you ${verb} "${media.title}"? Let me know on Consumed!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${media.title} on Consumed`,
          text: shareText,
          url: window.location.origin,
        });
      } catch (err) {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText);
    }
    onClose();
  };

  const verb = getMediaVerb(media.mediaType);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="text-green-600" size={22} />
            </div>
          </div>
          <DrawerTitle className="text-lg font-semibold text-gray-900">
            Nice! You {verb} it.
          </DrawerTitle>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{media.title}</span>
            {listName && <> added to {listName}</>}
          </p>
        </DrawerHeader>
        
        <div className="px-4 py-4 space-y-2">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-3 text-center">
            What's next?
          </p>

          {onDropHotTake && (
            <button
              onClick={onDropHotTake}
              className="w-full p-4 text-left rounded-xl bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 flex items-center gap-3 transition-colors border border-orange-100"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Flame className="text-white" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Drop a Hot Take</p>
                <p className="text-sm text-gray-500">Share your bold opinion</p>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>
          )}

          {showRateOption && onRateIt && (
            <button
              onClick={onRateIt}
              className="w-full p-4 text-left rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 flex items-center gap-3 transition-colors border border-yellow-100"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="text-white fill-white" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Rate It</p>
                <p className="text-sm text-gray-500">How many stars does it deserve?</p>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>
          )}

          <button
            onClick={handleChallenge}
            className="w-full p-4 text-left rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 flex items-center gap-3 transition-colors border border-purple-100"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="text-white" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Challenge a Friend</p>
              <p className="text-sm text-gray-500">Have they {verb} it too?</p>
            </div>
            <ChevronRight className="text-gray-400" size={18} />
          </button>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
