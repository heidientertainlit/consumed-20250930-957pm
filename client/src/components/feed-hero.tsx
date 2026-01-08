import { useState } from "react";
import { Link } from "wouter";
import { Play, Zap, CheckCircle, Loader2, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

interface FeedHeroProps {
  onPlayChallenge?: () => void;
  variant?: "default" | "header";
}

export default function FeedHero({ onPlayChallenge, variant = "default" }: FeedHeroProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{ isCorrect?: boolean; correctAnswer?: string } | null>(null);

  const { data: dailyChallengeData } = useQuery<any>({
    queryKey: ['daily-challenge-pool'],
    queryFn: async () => {
      // Get any open challenge (trivia or poll)
      const { data, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('origin_type', 'consumed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      return data || null;
    },
  });

  const dailyChallenge = dailyChallengeData || {
    title: "Daily Challenge",
    category: "Play",
    icon: "🎯",
    options: [],
    type: 'vote',
  };

  // Parse options - handle both simple strings and nested trivia format
  const rawOptions = Array.isArray(dailyChallenge.options) ? dailyChallenge.options : [];
  
  // Check if this is a multi-question trivia (nested format)
  const isNestedTrivia = rawOptions.length > 0 && 
    typeof rawOptions[0] === 'object' && 
    rawOptions[0]?.question;
  
  // For nested trivia, use the first question's options
  // For simple format, use options directly
  let options: string[] = [];
  let currentQuestion = dailyChallenge.title;
  let correctAnswer = dailyChallenge.correct_answer;
  
  if (isNestedTrivia) {
    const firstQ = rawOptions[0];
    currentQuestion = firstQ.question || dailyChallenge.title;
    options = Array.isArray(firstQ.options) ? firstQ.options : [];
    correctAnswer = firstQ.answer || firstQ.correct;
  } else {
    options = rawOptions.filter((opt: any) => typeof opt === 'string');
  }

  const submitMutation = useMutation({
    mutationFn: async (answer: string) => {
      if (!dailyChallenge?.id || !user?.id) throw new Error('Missing data');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          pool_id: dailyChallenge.id,
          user_id: user.id,
          vote: answer
        })
      });
      
      const data = await response.json();
      
      const isTrivia = dailyChallenge.type === 'trivia';
      const isCorrect = isTrivia ? answer === correctAnswer : undefined;
      
      return { 
        isCorrect,
        correctAnswer: correctAnswer,
        pointsEarned: dailyChallenge.points_reward || 2
      };
    },
    onSuccess: (result) => {
      setHasSubmitted(true);
      setSubmissionResult(result);
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-pool'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      
      if (dailyChallenge.type === 'trivia') {
        if (result.isCorrect) {
          toast({
            title: "Correct! 🎉",
            description: `You earned ${result.pointsEarned} points!`
          });
        } else {
          toast({
            title: "Not quite!",
            description: `The correct answer was: ${result.correctAnswer}`
          });
        }
      } else {
        toast({
          title: "Vote submitted! 🎯",
          description: `You earned ${result.pointsEarned} points!`
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit. You may have already answered this.",
        variant: "destructive"
      });
    }
  });

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (options.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSubmit = () => {
    if (selectedOption) {
      submitMutation.mutate(selectedOption);
    }
  };

  if (variant === "header") {
    return (
      <div className="space-y-4">
        <div 
          className="bg-white/5 border border-white/10 rounded-xl p-4 text-white cursor-pointer hover:bg-white/10 transition-all" 
          data-testid="daily-challenge-card"
          onClick={handlePlayClick}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">Daily Challenge</span>
              <h3 className="text-base font-semibold mt-1">{dailyChallenge.icon} {dailyChallenge.title}</h3>
            </div>
            <div className="text-purple-300 hover:text-white transition-colors">
              {isExpanded ? <ChevronUp size={28} /> : <Play size={28} fill="currentColor" />}
            </div>
          </div>
          
          {isExpanded && options.length > 0 && (
            <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
              {isNestedTrivia && currentQuestion !== dailyChallenge.title && (
                <p className="text-sm text-purple-200 mb-2">{currentQuestion}</p>
              )}
              {hasSubmitted ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-300 font-medium">Submitted!</p>
                    {submissionResult?.isCorrect === false && (
                      <p className="text-xs text-gray-400">Correct: {submissionResult.correctAnswer}</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {options.map((option: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(option)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedOption === option
                          ? 'bg-purple-600 text-white border-2 border-purple-400'
                          : 'bg-white/10 text-gray-200 border-2 border-transparent hover:bg-white/20'
                      }`}
                      data-testid={`challenge-option-${idx}`}
                    >
                      {option}
                    </button>
                  ))}
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedOption || submitMutation.isPending}
                    className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
                    data-testid="submit-challenge"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Submit Answer
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div 
        className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:shadow-xl transition-shadow" 
        data-testid="daily-challenge-card"
        onClick={handlePlayClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-yellow-300" />
              <span className="text-xs font-medium text-purple-200 uppercase tracking-wide">Daily Challenge</span>
            </div>
            <h3 className="text-lg font-bold">{dailyChallenge.icon} {dailyChallenge.title}</h3>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-colors">
            {isExpanded ? <ChevronUp size={24} className="text-white" /> : <Play size={24} fill="white" className="text-white" />}
          </div>
        </div>
        
        {isExpanded && options.length > 0 && (
          <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            {isNestedTrivia && currentQuestion !== dailyChallenge.title && (
              <p className="text-sm text-purple-100 mb-2 font-medium">{currentQuestion}</p>
            )}
            {hasSubmitted ? (
              <div className="flex items-center gap-2 p-3 bg-white/20 rounded-lg border border-white/30">
                <CheckCircle className="w-5 h-5 text-green-300" />
                <div>
                  <p className="text-white font-medium">Submitted!</p>
                  {submissionResult?.isCorrect === false && (
                    <p className="text-xs text-purple-200">Correct: {submissionResult.correctAnswer}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedOption === option
                        ? 'bg-white text-purple-700 font-semibold'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    data-testid={`challenge-option-${idx}`}
                  >
                    {option}
                  </button>
                ))}
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedOption || submitMutation.isPending}
                  className="w-full mt-2 bg-white text-purple-700 hover:bg-purple-100 font-semibold"
                  data-testid="submit-challenge"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Submit Answer
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
