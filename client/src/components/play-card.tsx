import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Brain, Vote, TrendingUp, Users, Trophy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PlayCardProps {
  game: any;
  onComplete?: () => void;
  compact?: boolean;
}

export default function PlayCard({ game, onComplete, compact = false }: PlayCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (answer: string) => {
      // Import Supabase client for direct DB access
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Submit prediction to user_predictions table
      const { data, error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: game.id,
          prediction: answer,
          points_earned: game.points_reward || 10,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error submitting prediction:', error);
        throw error;
      }
      
      return { pointsAwarded: game.points_reward || 10 };
    },
    onSuccess: (data: any) => {
      setIsSubmitted(true);
      setEarnedPoints(data?.pointsAwarded || game.points_reward || 10);
      queryClient.invalidateQueries({ queryKey: ['/api/predictions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/play-games'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      onComplete?.();
    },
  });

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    submitMutation.mutate(selectedAnswer);
  };

  const getGameIcon = () => {
    if (game.type === 'trivia') return <Brain size={20} className="text-purple-600" />;
    if (game.type === 'vote') return <Vote size={20} className="text-blue-600" />;
    if (game.type === 'predict') return <TrendingUp size={20} className="text-green-600" />;
    return <Trophy size={20} className="text-amber-600" />;
  };

  const getGameType = () => {
    if (game.type === 'trivia') return 'Trivia';
    if (game.type === 'vote') return 'Poll';
    if (game.type === 'predict') return 'Prediction';
    return 'Challenge';
  };

  const getGameBadgeColor = () => {
    if (game.type === 'trivia') return 'bg-purple-100 text-purple-700';
    if (game.type === 'vote') return 'bg-blue-100 text-blue-700';
    if (game.type === 'predict') return 'bg-green-100 text-green-700';
    return 'bg-amber-100 text-amber-700';
  };

  // Extract options based on game type
  const getOptions = () => {
    if (!game.options || !Array.isArray(game.options)) return [];
    
    // If options are objects with labels, extract the labels
    if (typeof game.options[0] === 'object' && game.options[0]?.label) {
      return game.options.map((opt: any) => opt.label);
    }
    
    // If options are question objects (long-form trivia), get first question's options
    if (typeof game.options[0] === 'object' && game.options[0]?.options) {
      return game.options[0].options;
    }
    
    // Otherwise, options are simple strings
    return game.options;
  };

  const options = getOptions();

  // Compact version for friendsupdate page
  if (compact) {
    if (isSubmitted) {
      return (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Trophy size={16} className="text-white" />
              </div>
              <div className="text-sm font-medium text-gray-700">
                Submitted! You'll see results when it ends.
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl mb-4">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              {getGameIcon()}
            </div>
            <div>
              <span className="text-xs font-semibold text-purple-600">{getGameType()}</span>
              {game.title && <span className="text-xs text-gray-500 ml-2">{game.title}</span>}
            </div>
          </div>

          {/* Question */}
          <p className="text-sm font-medium text-gray-900 mb-3">
            {game.question || game.title}
          </p>

          {/* Options */}
          <div className="space-y-2 mb-3">
            {options.map((option: string, index: number) => (
              <button
                key={`${game.id}-option-${index}`}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full p-2.5 text-left rounded-lg border text-sm transition-all ${
                  selectedAnswer === option
                    ? 'border-purple-500 bg-purple-50 font-medium'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                data-testid={`play-card-option-${index}`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Predict with Friends Button */}
          <Button 
            onClick={handleSubmit}
            disabled={!selectedAnswer || submitMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 rounded-lg"
            data-testid="play-card-predict-with-friends"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Predict with Friends'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Regular version
  if (isSubmitted) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-300 shadow-sm rounded-lg mb-3">
        <CardContent className="p-3 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <Trophy size={16} className="text-white" />
            </div>
            <div className="text-sm font-semibold text-green-800">
              +{earnedPoints} points earned!
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 shadow-sm rounded-lg mb-3">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-1.5">
            {getGameIcon()}
            <Badge className={`${getGameBadgeColor()} hover:${getGameBadgeColor()} text-xs font-medium`}>
              {getGameType()}
            </Badge>
          </div>
          <div className="flex items-center space-x-1">
            <Star size={12} className="text-purple-600" />
            <span className="text-xs font-semibold text-purple-600">{game.points_reward || game.points || 10}pts</span>
          </div>
        </div>
        
        <h3 className="text-sm font-semibold text-gray-900">
          {game.title || game.question}
        </h3>
        {game.description && (
          <p className="text-xs text-gray-600 mt-0.5">{game.description}</p>
        )}
        
        {game.participants && (
          <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
            <Users size={12} />
            <span>{game.participants} played</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2 px-3 pb-3">
        <div className="grid grid-cols-1 gap-1.5">
          {options.map((option: string, index: number) => (
            <button
              key={`${game.id}-option-${index}`}
              onClick={() => setSelectedAnswer(option)}
              className={`p-2 text-left rounded-lg border transition-all ${
                selectedAnswer === option
                  ? 'border-purple-500 bg-purple-100'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              data-testid={`play-card-option-${index}`}
            >
              <div className="text-xs font-medium text-gray-900">{option}</div>
            </button>
          ))}
        </div>

        <Button 
          onClick={handleSubmit}
          disabled={!selectedAnswer || submitMutation.isPending}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 rounded-lg py-2 text-xs font-semibold"
          data-testid="play-card-submit"
        >
          {submitMutation.isPending ? 'Submitting...' : `Submit for ${game.points_reward || game.points || 10} pts`}
        </Button>
      </CardContent>
    </Card>
  );
}
