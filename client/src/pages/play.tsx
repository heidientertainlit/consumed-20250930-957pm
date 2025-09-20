import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Play, Trophy, Brain, Gamepad2, Users } from "lucide-react";

export default function PlayPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Play
          </h1>
          <p className="text-lg text-gray-600">
            Play games, earn points, and show off your fandom. Trivia, Predictions, and Blends help you prove what you know and discover what to enjoy together.
          </p>
        </div>

        {/* Game Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

          {/* Predictions Option */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-white" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Predictions</h3>
            <p className="text-gray-600 mb-6">
              Make predictions about upcoming entertainment releases, awards, and trends. Win points for accurate predictions!
            </p>
            <Button 
              className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3 text-lg"
              data-testid="play-predictions-button"
            >
              <Trophy size={20} className="mr-2" />
              Make Predictions
            </Button>
          </div>

          {/* Blends Option */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm hover:shadow-md transition-all">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-700 to-purple-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-white" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Blends</h3>
            <p className="text-gray-600 mb-6">
              Find media you and your partner, book club, or friends have in common so you know what to watch or read together!
            </p>
            <Button 
              className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3 text-lg"
              data-testid="play-blends-button"
            >
              <Users size={20} className="mr-2" />
              Create Blend
            </Button>
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
    </div>
  );
}