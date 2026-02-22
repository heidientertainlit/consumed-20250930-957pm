import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Share2, Download, X, Check } from "lucide-react";

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
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleSaveImage = async () => {
    if (!imageDataUrl) return;

    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (isMobile && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const link = document.createElement("a");
        link.download = fileName;
        link.href = imageDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {}
  };

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
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-3 bg-white border-0 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        
        <h3 className="text-center font-semibold text-gray-900 mb-4">{title}</h3>

        {imageDataUrl && (
          <div className="mx-auto mb-5 rounded-2xl overflow-hidden shadow-lg max-w-[280px]">
            <img
              src={imageDataUrl}
              alt="Preview"
              className="w-full h-auto"
            />
            {isMobile && (
              <p className="text-center text-[11px] text-gray-400 py-2 bg-gray-50">
                Hold image to save directly
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 max-w-[320px] mx-auto">
          <button
            onClick={handleSaveImage}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-purple-600 text-white font-medium text-sm active:scale-[0.98] transition-all"
          >
            {saved ? <Check size={20} /> : <Download size={20} />}
            <span className="flex-1 text-left">{saved ? "Saved!" : isMobile ? "Save Image" : "Download Image"}</span>
          </button>

          {navigator.share && (
            <button
              onClick={handleShareLink}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-100 text-gray-900 font-medium text-sm active:scale-[0.98] transition-all"
            >
              {shared ? <Check size={20} /> : <Share2 size={20} />}
              <span className="flex-1 text-left">{shared ? "Shared!" : "Share Link"}</span>
            </button>
          )}

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
