import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas";
import { X, Dna, Sparkles, Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareImageSheet } from "@/components/share-image-sheet";
import { supabase } from "@/lib/supabase";
import { APP_BASE } from "@/lib/share";

interface DnaShareExperienceProps {
  userId: string;
  onClose: () => void;
}

interface ProfileBits {
  title: string;
  description: string;
  superpowers: string[];
  meaning: string;
}

/**
 * The exact post-survey "share your DNA" experience, reusable anywhere.
 * Full-screen overlay with the Instagram-story style white card,
 * Save to Share + Share buttons, and the in-app share sheet fallback.
 */
export function DnaShareExperience({ userId, onClose }: DnaShareExperienceProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<ProfileBits | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("dna_profiles")
        .select("label, tagline, flavor_notes, profile_text")
        .eq("user_id", userId)
        .single();
      if (cancelled) return;
      if (data) {
        setProfile({
          title: data.label || "Entertainment Enthusiast",
          description: data.tagline || "",
          superpowers: data.flavor_notes || [],
          meaning: data.profile_text || "",
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement("a");
      link.download = "my-entertainment-dna.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (isSharing || !profile) return;
    setIsSharing(true);
    try {
      const shareText = `I'm a "${profile.title}" — ${profile.description} Check out my Entertainment DNA on Consumed!`;
      const shareUrl = `${APP_BASE}/edna/${userId}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "My Entertainment DNA", text: shareText, url: shareUrl });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    } catch (error) {
      console.error("Error sharing link:", error);
    } finally {
      setIsSharing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Small action sheet — just the two buttons */}
      <div
        className="w-full sm:w-[340px] rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5"
        style={{ background: "linear-gradient(155deg, #2c2150 0%, #181030 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-[15px]">Share your DNA</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {loading || !profile ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin text-white/80" size={24} />
          </div>
        ) : (
          <>
            {/* Hidden shareable card — rendered off-screen for image capture */}
            <div
              style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}
              aria-hidden="true"
            >
            <div
              ref={cardRef}
              className="w-[320px] bg-white rounded-3xl overflow-hidden shadow-2xl"
              style={{ minHeight: "568px" }}
            >
              <div className="p-5 flex flex-col h-full">
                <div className="text-center mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Dna className="text-white" size={24} />
                  </div>
                  <h1 className="text-base font-bold text-gray-900">Your Entertainment DNA</h1>
                  <div className="w-10 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full mt-1"></div>
                </div>

                <div className="text-center mb-3">
                  <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {profile.title}
                  </h2>
                  <p className="text-gray-600 text-sm">{profile.description}</p>
                </div>

                {profile.superpowers.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                      <Sparkles className="mr-1.5 text-purple-600" size={14} />
                      Your Flavor Notes:
                    </h3>
                    <ul>
                      {profile.superpowers.slice(0, 3).map((power, index) => (
                        <li key={index} className="text-gray-700 text-xs leading-tight">• {power}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {profile.meaning && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-3 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Your Entertainment DNA Profile:</h3>
                    <p className="text-gray-700 text-xs leading-relaxed">{profile.meaning}</p>
                  </div>
                )}

                <div className="text-center mt-3 pt-2 border-t border-gray-100">
                  <p className="text-purple-600 text-xs font-medium">@consumedapp</p>
                </div>
              </div>
            </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-6 py-2.5 rounded-full shadow-lg text-sm flex items-center justify-center gap-2"
                data-testid="download-dna-button"
              >
                <Download size={18} />
                {isDownloading ? "Saving..." : "Save to Photos"}
              </Button>

              <Button
                onClick={handleShare}
                disabled={isSharing}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-6 py-2.5 rounded-full shadow-lg text-sm flex items-center justify-center gap-2"
                data-testid="share-dna-button"
              >
                <Share2 size={18} />
                {isSharing ? "Preparing..." : "Share with a Friend"}
              </Button>
            </div>

            <ShareImageSheet
              open={shareSheetOpen}
              onOpenChange={setShareSheetOpen}
              imageDataUrl={shareImageUrl}
              fileName="my-entertainment-dna.png"
              title="Share Your Entertainment DNA"
              shareText={`I'm a "${profile.title}" — ${profile.description} Check out my Entertainment DNA on Consumed!`}
              shareUrl={`${APP_BASE}/edna/${userId}`}
            />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
