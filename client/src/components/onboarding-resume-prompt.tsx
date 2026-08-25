import { useEffect, useState } from "react";
import { ArrowRight, Dna, X } from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import {
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  markOnboardingComplete,
} from "@/components/route-guards";

export function OnboardingResumePrompt({ userId }: { userId?: string | null }) {
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId || isOnboardingPromptDismissed(userId)) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("dna_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[onboarding prompt profile check]", error);
          return;
        }
        if (data) {
          markOnboardingComplete(userId);
          setVisible(false);
        } else {
          setVisible(true);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (!visible || !userId) return null;

  return (
    <div className="mb-5 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 p-4 shadow-sm" data-testid="onboarding-resume-prompt">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
          <Dna size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900">Finish setting up your Entertainment DNA</p>
          <p className="mt-1 text-sm leading-snug text-gray-600">
            Pick up where you left off. Your ratings and follows already count.
          </p>
          <button
            onClick={() => setLocation("/onboarding?resume=1")}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700"
          >
            Continue setup <ArrowRight size={15} />
          </button>
        </div>
        <button
          onClick={() => {
            dismissOnboardingPrompt(userId);
            setVisible(false);
          }}
          className="rounded-full p-1 text-gray-400 hover:bg-white/70 hover:text-gray-600"
          aria-label="Dismiss finish setup prompt"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}