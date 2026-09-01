import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Dna, Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { shareImageBlob } from "@/lib/share-image-blob";
import { renderDnaShareCard } from "@/lib/render-dna-share-card";
import { useLocation } from "wouter";
import consumedPurpleLogo from "@/assets/consumed_logo_purple_trimmed.png";

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
  const [, setLocation] = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<ProfileBits | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("dna_profiles")
          .select("label, tagline, flavor_notes, profile_text")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("Error loading DNA share profile:", error);
          setLoadError(true);
        } else if (data?.label) {
          setProfile({
            title: data.label,
            description: data.tagline || "",
            superpowers: data.flavor_notes || [],
            meaning: data.profile_text || "",
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading DNA share profile:", error);
        setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleDownload = async () => {
    if (!profile) return;
    setIsDownloading(true);
    try {
      const blob = await renderDnaShareCard(profile);
      if (!blob) throw new Error("Could not generate DNA share image");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "my-entertainment-dna.png";
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
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
      const blob = await renderDnaShareCard(profile);
      if (!blob) throw new Error("Could not generate DNA share image");
      await shareImageBlob(blob, {
        fileName: "my-entertainment-dna.png",
        title: `I'm ${profile.title} — what's your Entertainment DNA? (via Consumed)`,
      });
    } catch (error) {
      console.error("Error sharing DNA image:", error);
    } finally {
      setIsSharing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] overflow-y-auto overscroll-contain bg-black/45 px-3 backdrop-blur-md" onClick={onClose}>
      <div
        className="mx-auto my-4 w-full max-w-sm pb-4 sm:my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-white font-semibold text-[15px]">Share your DNA</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin text-white/80" size={24} />
          </div>
        ) : !profile ? (
          <div className="py-3 text-center">
            <p className="text-white font-semibold">
              {loadError ? "We couldn’t load your Entertainment DNA." : "Finish your Entertainment DNA before sharing it."}
            </p>
            <p className="mt-1.5 text-sm text-white/65">
              {loadError ? "Close this sheet and try again." : "Complete setup to unlock your archetype and share card."}
            </p>
            {!loadError && (
              <Button
                onClick={() => {
                  onClose();
                  setLocation("/onboarding?resume=dna");
                }}
                className="mt-5 w-full rounded-full bg-white text-purple-900 hover:bg-white/90"
              >
                Continue setup
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mx-auto mb-5 flex justify-center">
            <div
              ref={cardRef}
              className="w-[320px] max-w-full shrink-0 bg-white rounded-3xl overflow-hidden shadow-2xl"
              style={{ minHeight: "568px" }}
            >
              <div className="p-5 flex flex-col h-full">
                <div className="text-center mb-3">
                  <img src={consumedPurpleLogo} alt="Consumed" className="mx-auto mb-3 h-auto w-28" />
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Dna className="text-white" size={24} />
                  </div>
                </div>

                <div className="text-center mb-3">
                  <p className="mb-1 text-[10px] font-normal uppercase tracking-[.18em] text-purple-700">
                    Your Entertainment DNA
                  </p>
                  <h2 className="bg-gradient-to-r from-purple-950 to-purple-700 bg-clip-text pb-1 font-serif text-[24px] font-medium leading-[1.2] tracking-[-.035em] text-transparent">
                    {profile.title}
                  </h2>
                </div>

                {profile.superpowers.length > 0 && (
                  <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                    {profile.superpowers.slice(0, 3).map((power, index) => (
                      <span
                        key={index}
                        className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[11px] font-medium leading-tight text-purple-800"
                      >
                        {power}
                      </span>
                    ))}
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
            <div className="flex flex-col gap-2.5 px-1">
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 flex items-center justify-center gap-2"
                data-testid="download-dna-button"
              >
                <Download size={18} />
                {isDownloading ? "Saving..." : "Save to Photos"}
              </Button>

              <Button
                onClick={handleShare}
                disabled={isSharing}
                className="w-full rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10 flex items-center justify-center gap-2"
                data-testid="share-dna-button"
              >
                <Share2 size={18} />
                {isSharing ? "Preparing..." : "Share with a Friend"}
              </Button>
            </div>

          </>
        )}
      </div>
    </div>,
    document.body
  );
}
