import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useLocation } from 'wouter';

const ACTIVITIES_KEY = 'consumed_activity_count';
const NUDGE_DISMISSED_KEY = 'consumed_dna_nudge_dismissed';
const ACTIVITIES_THRESHOLD = 5;

export function incrementActivityCount(): void {
  const current = parseInt(localStorage.getItem(ACTIVITIES_KEY) || '0', 10);
  localStorage.setItem(ACTIVITIES_KEY, String(current + 1));
}

export function getActivityCount(): number {
  return parseInt(localStorage.getItem(ACTIVITIES_KEY) || '0', 10);
}

export function isDnaNudgeDismissed(): boolean {
  return localStorage.getItem(NUDGE_DISMISSED_KEY) === 'true';
}

export function dismissDnaNudge(): void {
  localStorage.setItem(NUDGE_DISMISSED_KEY, 'true');
}

interface DnaSurveyNudgeProps {
  className?: string;
}

export function DnaSurveyNudge({ className = '' }: DnaSurveyNudgeProps) {
  const [, setLocation] = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const activityCount = getActivityCount();
    const dismissed = isDnaNudgeDismissed();
    
    if (activityCount >= ACTIVITIES_THRESHOLD && !dismissed) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    dismissDnaNudge();
    setShow(false);
  };

  const handleTakeSurvey = () => {
    dismissDnaNudge();
    setLocation('/entertainment-dna');
  };

  if (!show) return null;

  return (
    <Card className={`bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-purple-400/30 rounded-2xl p-4 relative ${className}`}>
      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
      >
        <X size={18} />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="text-3xl">🧬</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            Ready to supercharge your DNA?
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            You've been playing! Take a quick survey to unlock personalized insights and see how your taste compares to friends.
          </p>
          <Button
            onClick={handleTakeSurvey}
            className="bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 hover:from-blue-600 hover:via-purple-600 hover:to-purple-700 text-white text-sm py-2 px-4 rounded-lg"
          >
            Take the DNA Survey
          </Button>
        </div>
      </div>
    </Card>
  );
}
