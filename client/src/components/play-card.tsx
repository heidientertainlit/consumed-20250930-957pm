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
}

export default function PlayCard({ game, onComplete }: PlayCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (answer: string) => {
      if (game.type === 'trivia') {
        return apiRequest('POST', '/api/predictions', {
          game_id: game.id,
          prediction: answer,
        });
      } else if (game.type === 'vote') {
        // Find the option ID for polls
        const option = game.options?.find((opt: any) => opt.label === answer);
        if (!option) throw new Error('Invalid option');
        return apiRequest('POST', `/api/polls/${game.id}/vote`, {
          optionId: option.id,
        });
      } else if (game.type === 'predict') {
        return apiRequest('POST', '/api/predictions', {
          game_id: game.id,
          prediction: answer,
        });
      }
    },
    onSuccess: (data) => {
      setIsSubmitted(true);
      setEarnedPoints(data?.pointsAwarded || game.points_reward || 10);
      queryClient.invalidateQueries({ queryKey: ['/api/predictions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/polls'] });
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
    if (game.type === 'trivia') {
      // Long-form trivia has array of question objects
      if (Array.isArray(game.options) && typeof game.options[0] === 'object') {
        return game.options[0]?.options || [];
      }
      // Quick trivia has array of strings
      if (Array.isArray(game.options)) {
        return game.options;
      }
    }
    if (game.type === 'vote' && game.options) {
      return game.options.map((opt: any) => opt.label || opt);
    }
    if (game.type === 'predict' && game.options) {
      return game.options;
    }
    return [];
  };

  const options = getOptions();

  if (isSubmitted) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 shadow-sm rounded-2xl mb-4">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <Trophy size={32} className="text-white" />
            </div>
            <div className="text-xl font-bold text-green-800">
              Challenge Complete!
            </div>
            <div className="text-green-700">
              You earned <span className="font-bold text-2xl">{earnedPoints}</span> points
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 shadow-md rounded-2xl mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            {getGameIcon()}
            <Badge className={`${getGameBadgeColor()} hover:${getGameBadgeColor()} text-xs font-medium uppercase`}>
              {getGameType()} Challenge
            </Badge>
          </div>
          <div className="flex items-center space-x-1">
            <Star size={14} className="text-purple-600" />
            <span className="font-bold text-purple-600">{game.points_reward || game.points || 10} pts</span>
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          {game.title || game.question}
        </h3>
        {game.description && (
          <p className="text-sm text-gray-600">{game.description}</p>
        )}
        
        {game.participants && (
          <div className="flex items-center space-x-1 text-sm text-gray-600 mt-2">
            <Users size={14} />
            <span>{game.participants} played</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-gray-700 text-sm font-medium mb-2">
          {game.type === 'trivia' ? 'Select your answer:' : game.type === 'vote' ? 'Cast your vote:' : 'Make your prediction:'}
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {options.map((option: string, index: number) => (
            <button
              key={`${game.id}-option-${index}`}
              onClick={() => setSelectedAnswer(option)}
              className={`p-4 text-left rounded-xl border-2 transition-all ${
                selectedAnswer === option
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              data-testid={`play-card-option-${index}`}
            >
              <div className="font-medium text-gray-900">{option}</div>
            </button>
          ))}
        </div>

        <Button 
          onClick={handleSubmit}
          disabled={!selectedAnswer || submitMutation.isPending}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 rounded-xl py-6 font-bold"
          data-testid="play-card-submit"
        >
          {submitMutation.isPending ? 'Submitting...' : `Submit & Earn ${game.points_reward || game.points || 10} Points`}
        </Button>
      </CardContent>
    </Card>
  );
}
