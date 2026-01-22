import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Dna } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { markOnboardingComplete } from "@/components/route-guards";

export default function OnboardingPage() {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleContinue = () => {
    setIsCompleting(true);
    markOnboardingComplete();
    setLocation('/activity');
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="mb-8">
          <img 
            src="/consumed-logo-new.png" 
            alt="consumed" 
            className="h-12 mx-auto"
          />
        </div>
        
        <div className="mb-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center">
            <Dna className="w-7 h-7 text-white" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-3">
          Everything here feeds your DNA
        </h1>
        
        <p className="text-purple-200 text-base mb-10 leading-relaxed">
          Every answer, vote, take, and media item added tells the story of your taste.
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleContinue}
            disabled={isCompleting}
            className="w-full bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 hover:from-cyan-300 hover:via-purple-400 hover:to-purple-600 text-white font-semibold rounded-xl py-4 text-base shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
          >
            {isCompleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play size={18} fill="white" />
                Start with a quick trivia
              </>
            )}
          </Button>
          
          <button
            onClick={handleContinue}
            disabled={isCompleting}
            className="w-full text-purple-300/80 hover:text-white text-sm py-2 transition-colors"
          >
            Skip to feed →
          </button>
        </div>
      </div>
    </div>
  );
}
