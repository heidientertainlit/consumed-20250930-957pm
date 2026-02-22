import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Share2, X, Check } from "lucide-react";

interface ShareImageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageDataUrl: string | null;
  fileName?: string;
  title?: string;
  shareText?: string;
  shareUrl?: string;
}

export function ShareImageSheet({
  open,
  onOpenChange,
  imageDataUrl,
  fileName = "consumed-share.png",
  title = "Your Image",
  shareText,
  shareUrl,
}: ShareImageSheetProps) {
  const [shared, setShared] = useState(false);

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: shareText || `Check this out on Consumed!`,
          url: shareUrl || window.location.href,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl || window.location.href);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {}
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-3 bg-white border-0 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        
        <h3 className="text-center font-semibold text-gray-900 mb-4">{title}</h3>

        {imageDataUrl && (
          <div className="mx-auto mb-1 rounded-2xl overflow-hidden shadow-lg max-w-[280px]">
            <img
              src={imageDataUrl}
              alt="Preview"
              className="w-full h-auto"
            />
          </div>
        )}

        <p className="text-center text-[12px] text-gray-400 mb-5">
          Hold image to save to your photos
        </p>

        <div className="space-y-2 max-w-[320px] mx-auto">
          <button
            onClick={handleShareLink}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-purple-600 text-white font-medium text-sm active:scale-[0.98] transition-all"
          >
            {shared ? <Check size={20} /> : <Share2 size={20} />}
            <span className="flex-1 text-left">{shared ? "Link Copied!" : "Share Link"}</span>
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-gray-400 text-sm"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
