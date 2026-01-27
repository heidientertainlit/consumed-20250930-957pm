import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Share2, ArrowLeft, Check, X, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BallotPick {
  categoryId: string;
  categoryName: string;
  categoryShortName: string;
  pick: {
    id: string;
    name: string;
    title?: string;
    posterUrl?: string;
    isCorrect?: boolean;
    pointsEarned?: number;
  } | null;
  winner?: {
    id: string;
    name: string;
    title?: string;
    posterUrl?: string;
  } | null;
}

interface BallotData {
  event: {
    id: string;
    name: string;
    year: number;
    status: 'open' | 'locked' | 'completed';
  };
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
  } | null;
  ballot: BallotPick[];
  stats: {
    totalCategories: number;
    picksMade: number;
    correctPicks: number;
    totalPoints: number;
  };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function AwardsBallotShare() {
  const [, params] = useRoute("/awards/:eventId/ballot");
  const { toast } = useToast();

  // Get user ID from query params
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('user');
  const eventSlug = params?.eventId || 'golden-globes-2026';

  // Fetch ballot data from Supabase edge function
  const { data: ballotData, isLoading, error } = useQuery<BallotData>({
    queryKey: ['awards-ballot', eventSlug, userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/awards-ballot?event=${eventSlug}&user_id=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch ballot');
      }
      
      return response.json();
    },
    enabled: !!userId,
  });

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = ballotData 
      ? `Check out my ${ballotData.event.year} ${ballotData.event.name} predictions! 🏆` 
      : 'Check out my awards predictions!';
    
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: ballotData ? `${ballotData.event.year} ${ballotData.event.name}` : 'Awards Predictions', 
          text: shareText, 
          url: shareUrl 
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied!", description: "Share with your friends" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
          <p className="text-gray-400">Loading ballot...</p>
        </div>
      </div>
    );
  }

  if (error || !ballotData || !userId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center text-white">
        <div className="text-center px-4">
          <Trophy size={48} className="mx-auto mb-4 text-gray-600" />
          <h1 className="text-xl font-bold mb-2">Ballot Not Found</h1>
          <p className="text-gray-400 mb-6">This prediction ballot doesn't exist or has been removed.</p>
          <Button onClick={() => window.location.href = '/play/awards'} variant="outline">
            Make Your Own Predictions
          </Button>
        </div>
      </div>
    );
  }

  const { event, user, ballot, stats } = ballotData;
  const correctPercentage = stats.picksMade > 0 
    ? Math.round((stats.correctPicks / stats.picksMade) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white pb-32">
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
              data-testid="button-share"
            >
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
          </div>

          {/* User Info */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <User size={24} className="text-white" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{user?.displayName || user?.username || 'Anonymous'}'s Ballot</h2>
              <p className="text-gray-400 text-sm">{event.year} {event.name}{event.name.includes('Academy Awards') ? ' (Oscars)' : ''}</p>
            </div>
          </div>

          {/* Results Summary (if completed) */}
          {event.status === 'completed' && (
            <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/30 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-400 text-sm font-medium">Final Score</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.correctPicks} / {stats.picksMade} Correct
                  </p>
                  <p className="text-amber-400 text-sm">+{stats.totalPoints} points earned</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">{correctPercentage}%</p>
                  <p className="text-gray-400 text-sm">Accuracy</p>
                </div>
              </div>
            </div>
          )}

          {/* Progress (if open) */}
          {event.status === 'open' && (
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Predictions Made</p>
                  <p className="text-xl font-bold text-white">{stats.picksMade} / {stats.totalCategories}</p>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-gray-700"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(stats.picksMade / stats.totalCategories) * 176} 176`}
                      className="text-amber-500"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-amber-400">
                    {Math.round((stats.picksMade / stats.totalCategories) * 100)}%
                  </span>
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
          {ballot.filter(b => b.pick).map((item, index) => (
            <motion.div
              key={item.categoryId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative rounded-xl p-4 ${
                event.status === 'completed'
                  ? item.pick?.isCorrect
                    ? 'bg-green-900/20 border border-green-500/30'
                    : 'bg-red-900/20 border border-red-500/30'
                  : 'bg-gray-800/50 border border-gray-700'
              }`}
              data-testid={`ballot-pick-${item.categoryId}`}
            >
              {/* Result Icon */}
              {event.status === 'completed' && (
                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                  item.pick?.isCorrect ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {item.pick?.isCorrect ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                </div>
              )}

              {/* Winner Badge */}
              {item.winner && item.pick?.id === item.winner.id && (
                <div className="absolute -top-2 left-4 bg-gradient-to-r from-amber-400 to-amber-500 text-black px-2 py-0.5 rounded text-xs font-bold flex items-center">
                  <Trophy size={10} className="mr-1" />
                  WINNER
                </div>
              )}

              <div className="flex items-start">
                {/* Poster thumbnail */}
                {item.pick?.posterUrl && (
                  <div className="w-12 h-16 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                    <img 
                      src={item.pick.posterUrl} 
                      alt={item.pick.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs mb-1">{item.categoryShortName}</p>
                  <p className="font-semibold text-white">{item.pick?.name}</p>
                  {item.pick?.title && (
                    <p className="text-gray-500 text-sm truncate">{item.pick.title}</p>
                  )}
                  {event.status === 'completed' && item.pick?.pointsEarned && item.pick.pointsEarned > 0 && (
                    <p className="text-green-400 text-xs mt-1">+{item.pick.pointsEarned} points</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty picks message */}
        {ballot.filter(b => b.pick).length === 0 && (
          <div className="text-center py-8">
            <Trophy size={48} className="mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400">No predictions made yet</p>
          </div>
        )}
      </div>

      {/* CTA Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-950 to-transparent px-4 py-6">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-4 text-center">
          <p className="text-white font-semibold mb-2">Make Your Own Predictions!</p>
          <p className="text-purple-200 text-sm mb-3">Join consumed and compete with friends</p>
          <Button 
            onClick={() => window.location.href = '/play/awards'}
            className="bg-white text-purple-700 hover:bg-gray-100 font-semibold"
            data-testid="button-make-predictions"
          >
            Get Started Free
          </Button>
        </div>
      </div>
    </div>
  );
}
