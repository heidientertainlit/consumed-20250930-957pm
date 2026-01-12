import { useState, useEffect } from "react";
import { Heart, Dna, Brain, Check } from "lucide-react";
import { useLocation } from "wouter";

interface FirstSessionHooksProps {
  onComplete?: () => void;
}

interface HookStatus {
  liked: boolean;
  dna: boolean;
  trivia: boolean;
}

export function FirstSessionHooks({ onComplete }: FirstSessionHooksProps) {
  const [, setLocation] = useLocation();
  const [hookStatus, setHookStatus] = useState<HookStatus>(() => {
    const saved = localStorage.getItem('firstSessionHooks');
    if (saved) {
      return JSON.parse(saved);
    }
    return { liked: false, dna: false, trivia: false };
  });
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('firstSessionHooksDismissed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('firstSessionHooks', JSON.stringify(hookStatus));
    
    if (hookStatus.liked && hookStatus.dna && hookStatus.trivia) {
      onComplete?.();
    }
  }, [hookStatus, onComplete]);

  const markLiked = () => {
    setHookStatus(prev => ({ ...prev, liked: true }));
  };

  const allComplete = hookStatus.liked && hookStatus.dna && hookStatus.trivia;
  
  if (dismissed || allComplete) {
    return null;
  }

  const completedCount = [hookStatus.liked, hookStatus.dna, hookStatus.trivia].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Get started</h3>
          <p className="text-xs text-gray-500">{completedCount}/3 complete</p>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('firstSessionHooksDismissed', 'true');
          }}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          Dismiss
        </button>
      </div>
      
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            if (!hookStatus.liked) {
              markLiked();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            hookStatus.liked
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
          }`}
        >
          {hookStatus.liked ? (
            <Check size={16} className="text-green-600" />
          ) : (
            <Heart size={16} className="text-pink-500" />
          )}
          <span>Like a post</span>
        </button>

        <button
          onClick={() => setLocation('/entertainment-dna')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            hookStatus.dna
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
          }`}
        >
          {hookStatus.dna ? (
            <Check size={16} className="text-green-600" />
          ) : (
            <Dna size={16} className="text-purple-500" />
          )}
          <span>Your DNA</span>
        </button>

        <button
          onClick={() => setLocation('/play/trivia')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            hookStatus.trivia
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
          }`}
        >
          {hookStatus.trivia ? (
            <Check size={16} className="text-green-600" />
          ) : (
            <Brain size={16} className="text-blue-500" />
          )}
          <span>Play</span>
        </button>
      </div>
    </div>
  );
}

export function useFirstSessionHooks() {
  const markLiked = () => {
    const saved = localStorage.getItem('firstSessionHooks');
    const current = saved ? JSON.parse(saved) : { liked: false, dna: false, trivia: false };
    current.liked = true;
    localStorage.setItem('firstSessionHooks', JSON.stringify(current));
  };

  const markDNA = () => {
    const saved = localStorage.getItem('firstSessionHooks');
    const current = saved ? JSON.parse(saved) : { liked: false, dna: false, trivia: false };
    current.dna = true;
    localStorage.setItem('firstSessionHooks', JSON.stringify(current));
  };

  const markTrivia = () => {
    const saved = localStorage.getItem('firstSessionHooks');
    const current = saved ? JSON.parse(saved) : { liked: false, dna: false, trivia: false };
    current.trivia = true;
    localStorage.setItem('firstSessionHooks', JSON.stringify(current));
  };

  return { markLiked, markDNA, markTrivia };
}
