import { Brain, BarChart3, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HeroSection({ className, onTrackConsumption }: HeroSectionProps) {
  return (
    <section className="bg-gradient-to-br from-dark-secondary via-dark-primary to-dark-accent py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Track Your Entertainment. <span className="gradient-text">Earn Points.</span>
        </h1>
        <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
          Turn your binge-watching into a rewarding experience. Earn points for the entertainment you track — every show, book, song, game, and more you log helps you climb the ranks of the leaderboard.
        </p>

        {/* Track Consumption Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8">Start Your Entertainment Journey</h2>
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl p-8">
              <div className="text-6xl mb-6">📺</div>
              <h3 className="text-2xl font-bold mb-4 text-orange-300">Track Your Entertainment</h3>
              <p className="text-gray-300 mb-6 text-lg">
                Earn points for the entertainment you track — every show, book, song, game, and more you log helps you climb the ranks of the leaderboard. Rate your experiences, write reviews, and earn points for every entry.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-dark-primary/50 rounded-xl p-4">
                  <div className="text-2xl mb-2">🎬</div>
                  <div className="text-sm font-medium text-orange-300">Movies & TV Shows</div>
                  <div className="text-xs text-gray-400">Track episodes, seasons, films</div>
                </div>
                <div className="bg-dark-primary/50 rounded-xl p-4">
                  <div className="text-2xl mb-2">📚</div>
                  <div className="text-sm font-medium text-orange-300">Books & Comics</div>
                  <div className="text-xs text-gray-400">Log your reading journey</div>
                </div>
                <div className="bg-dark-primary/50 rounded-xl p-4">
                  <div className="text-2xl mb-2">🎮</div>
                  <div className="text-sm font-medium text-orange-300">Games & Music</div>
                  <div className="text-xs text-gray-400">Track gaming & listening</div>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold hover:from-orange-600 hover:to-orange-700 transition-all px-8 py-3"
                onClick={onTrackConsumption}
              >
                Start Tracking Now
              </Button>
            </div>
          </div>
        </div>

        {/* Points Section */}
        <div className="bg-gradient-to-r from-gold-accent/20 to-yellow-500/20 border border-gold-accent/30 rounded-2xl p-6 max-w-md mx-auto mt-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Coins className="text-gold-accent" size={24} />
            <h3 className="text-xl font-bold text-gold-accent">Earn Points</h3>
          </div>
          <p className="text-gray-300 mb-4 text-sm">
            Get 10+ points for every item you track. Add reviews and ratings for bonus points!
          </p>
          <div className="text-center">
            <span className="text-gold-accent font-bold text-lg">Up to 18 points per entry</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface HeroSectionProps {
  className?: string;
  onTrackConsumption?: () => void;
}