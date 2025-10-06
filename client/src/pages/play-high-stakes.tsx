import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ChevronLeft } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import FeedbackFooter from '@/components/feedback-footer';

export default function PlayHighStakesPage() {
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pb-24">
      <Navigation onTrackClick={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto px-4 pt-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => setLocation('/play')}
            variant="ghost"
            className="mb-4 text-white hover:bg-white/10"
            data-testid="back-to-play"
          >
            <ChevronLeft className="mr-2" size={20} />
            Back to Play
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Star size={32} className="text-amber-400" />
            <h1 className="text-3xl font-bold text-white">High Stakes Predictions</h1>
          </div>
          <p className="text-gray-300 text-sm">
            Premium prediction pools with real prizes and 2x point payouts
          </p>
        </div>

        {/* Coming Soon Message */}
        <div className="text-center py-20">
          <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-2xl p-12 border-2 border-amber-500/30">
            <Star size={64} className="mx-auto mb-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white mb-4">
              High Stakes Games Coming Soon!
            </h2>
            <p className="text-gray-300 text-lg mb-2">
              Get ready for premium prediction pools with real prizes.
            </p>
            <p className="text-gray-400">
              Check back soon for exciting high stakes games with 2x point payouts.
            </p>
          </div>
        </div>

        {/* Future High Stakes Games will appear here */}
        {/* This section will be populated when high stakes content is added */}
      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

      <FeedbackFooter />

    </div>
  );
}
