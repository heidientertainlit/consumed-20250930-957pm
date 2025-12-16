import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { motion } from "framer-motion";
import { Trophy, Share2, ArrowLeft, Check, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BallotPick {
  categoryId: string;
  categoryName: string;
  nomineeId: string;
  nomineeName: string;
  movieTitle: string;
  isCorrect?: boolean;
  isWinner?: boolean;
}

interface SharedBallot {
  eventName: string;
  eventYear: number;
  userName: string;
  userAvatar?: string;
  picks: BallotPick[];
  createdAt: string;
  totalCorrect?: number;
  totalPicks?: number;
  status: 'open' | 'completed';
}

export default function AwardsBallotShare() {
  const [, params] = useRoute("/awards/:eventId/ballot");
  const { toast } = useToast();
  const [ballot, setBallot] = useState<SharedBallot | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user ID from query params
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('user');

  useEffect(() => {
    // Mock ballot data - would fetch from API based on eventId and userId
    const mockBallot: SharedBallot = {
      eventName: "2026 Golden Globe Predictions",
      eventYear: 2026,
      userName: "MovieFan123",
      picks: [
        { categoryId: "best-picture-drama", categoryName: "Best Picture (Drama)", nomineeId: "1", nomineeName: "Oppenheimer", movieTitle: "Oppenheimer", isWinner: true, isCorrect: true },
        { categoryId: "best-actress-drama", categoryName: "Best Actress (Drama)", nomineeId: "6", nomineeName: "Lily Gladstone", movieTitle: "Killers of the Flower Moon", isWinner: true, isCorrect: true },
        { categoryId: "best-actor-drama", categoryName: "Best Actor (Drama)", nomineeId: "11", nomineeName: "Cillian Murphy", movieTitle: "Oppenheimer", isWinner: true, isCorrect: true },
        { categoryId: "best-director", categoryName: "Best Director", nomineeId: "16", nomineeName: "Christopher Nolan", movieTitle: "Oppenheimer", isWinner: true, isCorrect: true },
        { categoryId: "best-picture-comedy", categoryName: "Best Picture (Comedy)", nomineeId: "21", nomineeName: "Barbie", movieTitle: "Barbie", isWinner: false, isCorrect: false },
      ],
      createdAt: new Date().toISOString(),
      totalCorrect: 4,
      totalPicks: 5,
      status: 'completed'
    };

    // Simulate loading
    setTimeout(() => {
      setBallot(mockBallot);
      setLoading(false);
    }, 500);
  }, [params?.eventId, userId]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = ballot ? `Check out my ${ballot.eventName} predictions! 🏆` : 'Check out my awards predictions!';
    
    if (navigator.share) {
      try {
        await navigator.share({ title: ballot?.eventName || 'Awards Predictions', text: shareText, url: shareUrl });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied!", description: "Share with your friends" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!ballot) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center text-white">
        <div className="text-center">
          <Trophy size={48} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-xl font-bold mb-2">Ballot Not Found</h1>
          <p className="text-gray-400">This prediction ballot doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const correctPercentage = ballot.totalPicks ? Math.round((ballot.totalCorrect || 0) / ballot.totalPicks * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-transparent to-purple-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        
        <div className="relative px-4 pt-8 pb-6">
          {/* Consumed Logo/Brand */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
                <Trophy size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg">consumed</span>
            </div>
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className="border-gray-600 text-white hover:bg-gray-800"
            >
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
          </div>

          {/* User Info */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              {ballot.userAvatar ? (
                <img src={ballot.userAvatar} alt={ballot.userName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={24} className="text-white" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{ballot.userName}'s Ballot</h2>
              <p className="text-gray-400 text-sm">{ballot.eventName}</p>
            </div>
          </div>

          {/* Results Summary (if completed) */}
          {ballot.status === 'completed' && (
            <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/30 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-400 text-sm font-medium">Final Score</p>
                  <p className="text-2xl font-bold text-white">
                    {ballot.totalCorrect} / {ballot.totalPicks} Correct
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">{correctPercentage}%</p>
                  <p className="text-gray-400 text-sm">Accuracy</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ballot Picks */}
      <div className="px-4 py-6">
        <h3 className="text-lg font-semibold mb-4">Predictions</h3>
        <div className="space-y-3">
          {ballot.picks.map((pick, index) => (
            <motion.div
              key={pick.categoryId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative rounded-xl p-4 ${
                ballot.status === 'completed'
                  ? pick.isCorrect
                    ? 'bg-green-900/20 border border-green-500/30'
                    : 'bg-red-900/20 border border-red-500/30'
                  : 'bg-gray-800/50 border border-gray-700'
              }`}
            >
              {/* Result Icon */}
              {ballot.status === 'completed' && (
                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                  pick.isCorrect ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {pick.isCorrect ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                </div>
              )}

              {/* Winner Badge */}
              {pick.isWinner && (
                <div className="absolute -top-2 left-4 bg-gradient-to-r from-amber-400 to-amber-500 text-black px-2 py-0.5 rounded text-xs font-bold flex items-center">
                  <Trophy size={10} className="mr-1" />
                  WINNER
                </div>
              )}

              <p className="text-gray-400 text-xs mb-1">{pick.categoryName}</p>
              <p className="font-semibold text-white">{pick.nomineeName}</p>
              <p className="text-gray-500 text-sm">{pick.movieTitle}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-950 to-transparent px-4 py-6">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-4 text-center">
          <p className="text-white font-semibold mb-2">Make Your Own Predictions!</p>
          <p className="text-purple-200 text-sm mb-3">Join consumed and compete with friends</p>
          <Button 
            onClick={() => window.location.href = '/login'}
            className="bg-white text-purple-700 hover:bg-gray-100 font-semibold"
          >
            Get Started Free
          </Button>
        </div>
      </div>
    </div>
  );
}
