import { useState } from "react";
import { createPortal } from "react-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Share2, X, Check, Download } from "lucide-react";
import { APP_BASE } from "@/lib/share";

interface ShareImageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageDataUrl: string | null;
  fileName?: string;
  title?: string;
  shareText?: string;
  shareUrl?: string;
  variant?: "sheet" | "dark-preview";
}

export function ShareImageSheet({
  open,
  onOpenChange,
  imageDataUrl,
  fileName = "consumed-share.png",
  title = "Your Image",
  shareText,
  shareUrl,
  variant = "sheet",
}: ShareImageSheetProps) {
  const [shared, setShared] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const imageFile = async () => {
    if (!imageDataUrl) return null;
    const blob = await (await fetch(imageDataUrl)).blob();
    return new File([blob], fileName, { type: blob.type || "image/png" });
  };

  const handleSaveImage = async () => {
    const file = await imageFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setNotice("Image saved");
  };

  const handleShareImage = async () => {
    const file = await imageFile();
    try {
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title,
          text: shareText || "Check out my Entertainment DNA on Consumed!",
          files: [file],
        });
      } else {
        await handleShareLink();
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") setNotice("Could not share — try saving the image instead");
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: shareText || `Check this out on Consumed!`,
          url: shareUrl || `${APP_BASE}${window.location.pathname}`,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl || `${APP_BASE}${window.location.pathname}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {}
    }
  };

  if (variant === "dark-preview") {
    if (!open) return null;
    return createPortal(
      <div className="fixed inset-0 z-[100000] flex items-center justify-center px-3" onClick={() => onOpenChange(false)}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative -mt-4 flex max-h-[92vh] w-full flex-col rounded-3xl bg-gray-950 p-4 pb-6 sm:max-w-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[15px] font-semibold text-white">Share your DNA</p>
            <button onClick={() => onOpenChange(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-gray-900" style={{ maxHeight: "58vh" }}>
            {imageDataUrl && <img src={imageDataUrl} alt="Entertainment DNA card preview" className="h-full w-full object-contain" />}
          </div>
          {notice && <p className="mt-3 text-center text-[12px] text-violet-300">{notice}</p>}
          <div className="mt-4 flex flex-col gap-2.5">
            <button
              onClick={handleSaveImage}
              disabled={!imageDataUrl}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-3 text-[15px] font-medium text-white/90 transition-transform hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
            >
              <Download size={17} />
              Save to Photos
            </button>
            <button
              onClick={handleShareImage}
              disabled={!imageDataUrl}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-3 text-[15px] font-medium text-white/90 transition-transform hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
            >
              <Share2 size={17} />
              Share with a Friend
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

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
