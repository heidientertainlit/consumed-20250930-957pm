import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Star, ChevronLeft, Trophy, Clock, Users, DollarSign } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import FeedbackFooter from '@/components/feedback-footer';

const highStakesGames = [
  {
    id: 'hs-dwts-weekly',
    title: 'Dancing with the Stars',
    category: 'Reality TV',
    icon: '💃',
    question: 'Who will be eliminated this week?',
    options: ['Joey Graziadei', 'Ilona Maher', 'Stephen Nedoroscik', 'Chandler Kinney'],
    deadline: 'Tuesday 11:59 PM ET',
    prize: '$500',
    entryFee: '$5',
    participants: 1834,
    pointsMultiplier: '2x'
  },
  {
    id: 'hs-lib-weekly',
    title: 'Love is Blind',
    category: 'Reality TV',
    icon: '💕',
    question: 'Which couple will make it to the finale?',
    options: ['Taylor & Garrett', 'Nick & Hannah', 'Tyler & Ashley', 'Marissa & Ramses'],
    deadline: 'Wednesday 11:59 PM ET',
    prize: '$300',
    entryFee: '$3',
    participants: 2156,
    pointsMultiplier: '2x'
  },
  {
    id: 'hs-nfl-weekly',
    title: 'NFL Sunday Showdown',
    category: 'Sports',
    icon: '🏅',
    question: 'Who wins the prime time game?',
    options: ['Chiefs', 'Bills', 'Ravens', 'Cowboys'],
    deadline: 'Sunday 8:00 PM ET',
    prize: '$1,000',
    entryFee: '$10',
    participants: 3421,
    pointsMultiplier: '2x'
  }
];

export default function PlayHighStakesPage() {
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<typeof highStakesGames[0] | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handlePredictClick = (game: typeof highStakesGames[0]) => {
    setSelectedGame(game);
  };

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  const handleSubmitPrediction = () => {
    if (selectedOption) {
      setShowPaymentModal(true);
    }
  };

  const handlePayment = () => {
    // Payment logic will go here
    setShowPaymentModal(false);
    setSelectedGame(null);
    setSelectedOption('');
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

        {/* High Stakes Games Grid */}
        <div className="space-y-4">
          {highStakesGames.map((game) => (
            <Card 
              key={game.id} 
              className="bg-gradient-to-br from-amber-900/40 to-yellow-900/30 border-2 border-amber-500/40 hover:border-amber-400/60 transition-all cursor-pointer"
              onClick={() => handlePredictClick(game)}
              data-testid={`high-stakes-card-${game.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{game.icon}</span>
                    <div>
                      <CardTitle className="text-xl text-white mb-1">{game.title}</CardTitle>
                      <p className="text-amber-300 text-sm font-medium">{game.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/30">
                      <Trophy className="inline mr-1" size={14} />
                      <span className="text-amber-300 font-bold text-sm">{game.prize}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-black/20 rounded-lg p-3 border border-amber-500/20">
                  <p className="text-white font-medium text-lg mb-3">{game.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {game.options.map((option) => (
                      <span 
                        key={option}
                        className="bg-amber-500/10 px-3 py-1 rounded-full text-amber-200 text-sm border border-amber-500/20"
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-300">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{game.deadline}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      <span>{game.participants.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">{game.pointsMultiplier} Points</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-white font-semibold">{game.entryFee}</span>
                  </div>
                </div>

                <Button 
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold"
                  data-testid={`predict-button-${game.id}`}
                >
                  Make Prediction • {game.entryFee}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Prediction Selection Modal */}
      <Dialog open={!!selectedGame && !showPaymentModal} onOpenChange={(open) => !open && setSelectedGame(null)}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-purple-900 border-amber-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <span className="text-3xl">{selectedGame?.icon}</span>
              {selectedGame?.title}
            </DialogTitle>
            <DialogDescription className="text-amber-300">
              {selectedGame?.question}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedGame?.options.map((option) => (
              <button
                key={option}
                onClick={() => handleOptionSelect(option)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedOption === option
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                }`}
                data-testid={`option-${option.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className="text-white font-medium">{option}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <div className="bg-black/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Entry Fee:</span>
                <span className="text-white font-bold">{selectedGame?.entryFee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Potential Prize:</span>
                <span className="text-amber-400 font-bold">{selectedGame?.prize}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Points Multiplier:</span>
                <span className="text-purple-400 font-bold">{selectedGame?.pointsMultiplier}</span>
              </div>
            </div>
            <Button
              onClick={handleSubmitPrediction}
              disabled={!selectedOption}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="submit-prediction-button"
            >
              Continue to Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="bg-gradient-to-br from-gray-900 to-purple-900 border-amber-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="text-amber-400" />
              Complete Payment
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Confirm your prediction and payment to enter the pool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-black/30 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">Game:</span>
                <span className="text-white font-medium">{selectedGame?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Your Prediction:</span>
                <span className="text-amber-400 font-bold">{selectedOption}</span>
              </div>
              <div className="border-t border-gray-700 pt-3 mt-3">
                <div className="flex justify-between text-lg">
                  <span className="text-white font-medium">Total:</span>
                  <span className="text-amber-400 font-bold">{selectedGame?.entryFee}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-amber-200 text-sm">
                💡 Payment integration coming soon! This will connect to Stripe for secure payments.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowPaymentModal(false)}
                variant="outline"
                className="flex-1 border-gray-600 text-white hover:bg-gray-800"
                data-testid="cancel-payment-button"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold"
                data-testid="confirm-payment-button"
              >
                Pay {selectedGame?.entryFee}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

      <FeedbackFooter />
    </div>
  );
}
