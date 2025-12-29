import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";

interface DnfReasonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, otherReason?: string) => void;
  mediaTitle?: string;
}

const DNF_REASONS = [
  { id: "got_bored", label: "Got bored", emoji: "😴" },
  { id: "didnt_love_it", label: "Didn't love it", emoji: "😕" },
  { id: "too_long", label: "Too long", emoji: "⏰" },
  { id: "confusing", label: "Too confusing", emoji: "🤔" },
  { id: "lost_interest", label: "Lost interest", emoji: "🙄" },
  { id: "not_my_taste", label: "Not my taste", emoji: "🤷" },
  { id: "other", label: "Other", emoji: "✍️" },
];

export function DnfReasonDrawer({ isOpen, onClose, onSubmit, mediaTitle }: DnfReasonDrawerProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason, selectedReason === "other" ? otherText : undefined);
      setSelectedReason(null);
      setOtherText("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSubmit("skipped");
    setSelectedReason(null);
    setOtherText("");
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">
            Why didn't you finish?
          </DrawerTitle>
          {mediaTitle && (
            <p className="text-sm text-gray-500 mt-1 truncate px-4">{mediaTitle}</p>
          )}
        </DrawerHeader>
        
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          {DNF_REASONS.map((reason) => (
            <button
              key={reason.id}
              onClick={() => setSelectedReason(reason.id)}
              className={`w-full p-4 text-left rounded-lg flex items-center gap-3 transition-colors ${
                selectedReason === reason.id 
                  ? "bg-purple-50 border-2 border-purple-400" 
                  : "hover:bg-gray-50 border-2 border-transparent"
              }`}
              data-testid={`dnf-reason-${reason.id}`}
            >
              <span className="text-xl">{reason.emoji}</span>
              <span className="flex-1 font-medium text-gray-900">{reason.label}</span>
              {selectedReason === reason.id && (
                <Check size={20} className="text-purple-600" />
              )}
            </button>
          ))}
          
          {selectedReason === "other" && (
            <div className="mt-3 px-2">
              <Textarea
                placeholder="Tell us more (optional)..."
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                className="min-h-[80px] resize-none bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                data-testid="dnf-other-reason-input"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="dnf-submit-button"
          >
            {isSubmitting ? "Saving..." : "Done"}
          </Button>
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full text-gray-500"
            data-testid="dnf-skip-button"
          >
            Skip
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
