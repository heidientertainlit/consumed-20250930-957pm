import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star, Zap, Award, PartyPopper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CelebrationModalProps {
  points: number;
  onClose?: () => void;
  message?: string;
}

export default function CelebrationModal({ points, onClose, message = "Correct!" }: CelebrationModalProps) {
  useEffect(() => {
    // Trigger confetti
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Burst from two origins for better effect
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <Card className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-400 shadow-xl rounded-2xl max-w-sm mx-4 animate-in zoom-in-95 duration-500 pointer-events-auto">
        <CardContent className="p-5 text-center">
          <div className="flex flex-col items-center space-y-3">
            {/* Animated Trophy */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full blur-lg animate-pulse"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Trophy size={32} className="text-white drop-shadow-lg" />
              </div>
              {/* Sparkles */}
              <div className="absolute -top-1 -right-1 animate-ping">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
              </div>
              <div className="absolute -bottom-1 -left-1 animate-ping delay-150">
                <Zap size={14} className="text-amber-400 fill-amber-400" />
              </div>
            </div>

            {/* Success Message */}
            <div className="space-y-1">
              <h2 className="text-2xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent animate-in slide-in-from-bottom duration-700">
                {message}
              </h2>
              <p className="text-sm text-green-700 font-medium animate-in fade-in duration-1000">
                Nice work! 🎉
              </p>
            </div>

            {/* Points Display */}
            <div className="bg-white/80 rounded-xl px-6 py-3 border-2 border-green-300 shadow-md">
              <div className="flex items-center justify-center space-x-2">
                <Star size={20} className="text-amber-500 fill-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  +{points}
                </span>
                <span className="text-lg font-bold text-gray-700">pts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
