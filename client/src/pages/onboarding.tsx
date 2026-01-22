import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { TriviaCarousel } from "@/components/trivia-carousel";
import { markOnboardingComplete } from "@/components/route-guards";

export default function OnboardingPage() {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showTrivia, setShowTrivia] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleSkipToFeed = () => {
    setIsCompleting(true);
    markOnboardingComplete();
    setLocation('/activity');
  };

  const handlePlayTrivia = () => {
    setShowTrivia(true);
  };

  const handleTriviaComplete = () => {
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

  if (showTrivia) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col px-4 pt-8 pb-8">
        <div className="mb-6 flex items-center justify-between">
          <img 
            src="/consumed-logo-new.png" 
            alt="consumed" 
            className="h-8"
          />
          <button
            onClick={handleTriviaComplete}
            className="text-white/60 hover:text-white text-sm"
          >
            Skip to feed →
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-purple-200 text-sm">Try a quick question!</p>
        </div>

        <div className="flex-1">
          <TriviaCarousel expanded={false} />
        </div>

        <div className="mt-6">
          <Button
            onClick={handleTriviaComplete}
            className="w-full bg-white hover:bg-gray-100 text-purple-900 font-semibold rounded-lg py-3"
          >
            I'm ready to explore →
          </Button>
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
        
        <div className="mb-2">
          <span className="text-4xl">🎮</span>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-3">
          Ready to play?
        </h1>
        
        <p className="text-purple-200 text-base mb-10 leading-relaxed">
          Test your entertainment knowledge with quick trivia, polls, and predictions.
        </p>

        <div className="space-y-3">
          <Button
            onClick={handlePlayTrivia}
            className="w-full bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 hover:from-cyan-300 hover:via-purple-400 hover:to-purple-600 text-white font-semibold rounded-xl py-4 text-base shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
          >
            <Play size={18} fill="white" />
            Start with a quick trivia
          </Button>
          
          <button
            onClick={handleSkipToFeed}
            disabled={isCompleting}
            className="w-full text-purple-300/80 hover:text-white text-sm py-2 transition-colors"
          >
            {isCompleting ? "Loading..." : "Skip to feed →"}
          </button>
        </div>
        
        <p className="text-purple-400/50 text-xs mt-8">
          No pressure. You can always take the full DNA survey later.
        </p>
      </div>
    </div>
  );
}
