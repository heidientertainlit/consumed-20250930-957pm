import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CelebrationModalProps {
  points: number;
  onClose?: () => void;
  message?: string;
}

export default function CelebrationModal({ points, onClose, message = "Correct!" }: CelebrationModalProps) {
  useEffect(() => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.5, y: 0.6 },
      startVelocity: 28,
      ticks: 50,
      zIndex: 9999,
    });
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <Card className="bg-white border border-green-200 shadow-2xl rounded-2xl max-w-xs mx-4 animate-in zoom-in-95 duration-200 pointer-events-auto">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-md">
              <Trophy size={26} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{message}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Nice work</p>
            </div>
            <div className="bg-purple-50 rounded-xl px-5 py-2.5 border border-purple-100">
              <div className="flex items-center gap-1.5">
                <Star size={16} className="text-amber-500 fill-amber-400" />
                <span className="text-2xl font-bold text-purple-700">+{points}</span>
                <span className="text-sm font-medium text-gray-500">pts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
