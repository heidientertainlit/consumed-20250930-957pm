import { useState } from "react";
import { CheckCircle2, TrendingUp, Calendar, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PollOption {
  id: number;
  label: string;
  description?: string;
  vote_count: number;
  percentage: number;
}

interface Poll {
  id: number;
  question: string;
  type: "consumed" | "entertainlit" | "sponsored";
  sponsor_name?: string;
  sponsor_logo_url?: string;
  sponsor_cta_url?: string;
  points_reward: number;
  total_votes: number;
  options: PollOption[];
  expires_at?: string;
  user_has_voted?: boolean;
}

interface PollCardProps {
  poll: Poll;
  onVote: (pollId: number, optionId: number) => Promise<void>;
  hasVoted?: boolean;
  userVote?: number;
}

export default function PollCard({ poll, onVote, hasVoted = false, userVote }: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(userVote || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(hasVoted || poll.user_has_voted);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVote = async (optionId: number) => {
    if (showResults || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onVote(poll.id, optionId);
      setSelectedOption(optionId);
      setJustSubmitted(true);
      // Show success message for 2 seconds before showing results
      setTimeout(() => {
        setJustSubmitted(false);
        setShowResults(true);
      }, 2000);
    } catch (error: any) {
      console.error("Failed to vote:", error);
      // Check if already voted
      if (error?.message?.includes('already voted') || error?.response?.status === 400) {
        setShowResults(true);
        setErrorMessage("You've already voted in this poll");
      } else {
        setErrorMessage("Failed to submit vote. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBrandColor = () => {
    switch (poll.type) {
      case "consumed":
        return "from-purple-600 to-blue-600";
      case "entertainlit":
        return "from-blue-600 to-cyan-600";
      case "sponsored":
        return "from-orange-600 to-pink-600";
      default:
        return "from-purple-600 to-blue-600";
    }
  };

  const getBadgeText = () => {
    switch (poll.type) {
      case "consumed":
        return "consumed Poll";
      case "entertainlit":
        return "entertainlit";
      case "sponsored":
        return poll.sponsor_name || "Sponsored";
      default:
        return "Poll";
    }
  };

  // Show success message immediately after submission
  if (justSubmitted) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 p-6 shadow-sm" data-testid={`poll-${poll.id}-success`}>
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <Trophy size={32} className="text-white" />
          </div>
          <div className="text-xl font-bold text-green-800">
            Submitted!
          </div>
          <div className="text-green-700">
            You earned <span className="font-bold text-2xl">{poll.points_reward}</span> points
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100 p-4 shadow-sm" data-testid={`poll-${poll.id}`}>
      {/* Header with badge */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "px-3 py-1 rounded-full text-white text-xs font-medium bg-gradient-to-r",
          getBrandColor()
        )}>
          {poll.sponsor_logo_url ? (
            <div className="flex items-center space-x-1.5">
              <img src={poll.sponsor_logo_url} alt={poll.sponsor_name} className="h-3 w-3" />
              <span>{getBadgeText()}</span>
            </div>
          ) : (
            <span>{getBadgeText()}</span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <TrendingUp size={14} />
            <span>{poll.points_reward} pts</span>
          </div>
          {poll.total_votes > 0 && (
            <span>{poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}</span>
          )}
        </div>
      </div>

      {/* Question */}
      <h3 className="text-base font-semibold text-gray-900 mb-3" data-testid={`poll-${poll.id}-question`}>
        {poll.question}
      </h3>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = selectedOption === option.id;
          const isWinning = showResults && option.percentage > 0 && option.percentage === Math.max(...poll.options.map(o => o.percentage));

          return (
            <button
              key={option.id}
              onClick={() => !showResults && handleVote(option.id)}
              disabled={showResults || isSubmitting}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all duration-200 relative overflow-hidden bg-white",
                showResults
                  ? "cursor-default"
                  : "hover:border-purple-300 hover:bg-purple-50 cursor-pointer",
                isSelected && showResults
                  ? "border-purple-400 bg-purple-50"
                  : "border-purple-100"
              )}
              data-testid={`poll-${poll.id}-option-${option.id}`}
            >
              {/* Results bar background */}
              {showResults && (
                <div
                  className={cn(
                    "absolute inset-0 transition-all duration-500",
                    isWinning ? "bg-purple-50" : "bg-gray-50"
                  )}
                  style={{ width: `${option.percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-800">{option.label}</span>
                    {isSelected && showResults && (
                      <CheckCircle2 size={14} className="text-purple-600" />
                    )}
                  </div>
                  {option.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  )}
                </div>

                {showResults && (
                  <div className="ml-3 text-right">
                    <div className="font-semibold text-sm text-gray-900">
                      {option.percentage}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.vote_count} {option.vote_count === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sponsor CTA */}
      {poll.type === "sponsored" && poll.sponsor_cta_url && showResults && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <Button
            onClick={() => window.open(poll.sponsor_cta_url, '_blank')}
            className="w-full text-sm bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white"
            data-testid={`poll-${poll.id}-cta`}
          >
            Learn More
          </Button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* Footer with expiry */}
      {poll.expires_at && !showResults && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center space-x-1.5 text-xs text-gray-500">
          <Calendar size={12} />
          <span>Ends {new Date(poll.expires_at).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}
