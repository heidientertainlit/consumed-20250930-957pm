import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Play, Trophy, Brain, Gamepad2, Vote } from "lucide-react";
import { Link } from "wouter";

export default function PlayPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Play
          </h1>
          <p className="text-lg text-gray-600">
            Play games, earn points, and show off your fandom. Use the search bar above for personalized recommendations and group blends!
          </p>
        </div>

        {/* Game Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Trivia Option */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="text-white" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Trivia</h3>
            <p className="text-gray-600 mb-6">
              Test your knowledge about movies, TV shows, books, and pop culture. Earn points for correct answers!
            </p>
            <Button 
              className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3 text-lg"
              data-testid="play-trivia-button"
            >
              <Play size={20} className="mr-2" />
              Play Trivia
            </Button>
          </div>

          {/* Vote & Predict Option */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Vote className="text-white" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Vote & Predict</h3>
            <p className="text-gray-600 mb-6">
              Vote on fun entertainment topics like "Who would've been Rachel's soulmate on Friends?" and make predictions about awards and releases!
            </p>
            <Link href="/predictions">
              <Button 
                className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3 text-lg"
                data-testid="play-predictions-button"
              >
                <Vote size={20} className="mr-2" />
                Vote & Predict
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <Gamepad2 className="text-purple-800" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Your Game Stats</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-800 mb-1">0</div>
              <div className="text-sm text-gray-500">Trivia Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-800 mb-1">0%</div>
              <div className="text-sm text-gray-500">Trivia Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">0</div>
              <div className="text-sm text-gray-500">Predictions Made</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-1">0</div>
              <div className="text-sm text-gray-500">Points Earned</div>
            </div>
          </div>
        </div>
      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />
    </div>
  );
}