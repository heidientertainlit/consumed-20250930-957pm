import { useState } from "react";
import { CheckCircle2, TrendingUp, Calendar } from "lucide-react";
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
  const [showResults, setShowResults] = useState(hasVoted);

  const handleVote = async (optionId: number) => {
    if (showResults || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onVote(poll.id, optionId);
      setSelectedOption(optionId);
      setShowResults(true);
    } catch (error) {
      console.error("Failed to vote:", error);
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

  return (
    <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-lg" data-testid={`poll-${poll.id}`}>
      {/* Header with badge */}
      <div className="flex items-center justify-between mb-4">
        <div className={cn(
          "px-4 py-1.5 rounded-full text-white text-sm font-semibold bg-gradient-to-r",
          getBrandColor()
        )}>
          {poll.sponsor_logo_url ? (
            <div className="flex items-center space-x-2">
              <img src={poll.sponsor_logo_url} alt={poll.sponsor_name} className="h-4 w-4" />
              <span>{getBadgeText()}</span>
            </div>
          ) : (
            <span>{getBadgeText()}</span>
          )}
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <TrendingUp size={16} />
            <span>{poll.points_reward} pts</span>
          </div>
          {poll.total_votes > 0 && (
            <span className="text-gray-500">{poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}</span>
          )}
        </div>
      </div>

      {/* Question */}
      <h3 className="text-xl font-bold text-gray-900 mb-6" data-testid={`poll-${poll.id}-question`}>
        {poll.question}
      </h3>

      {/* Options */}
      <div className="space-y-3">
        {poll.options.map((option) => {
          const isSelected = selectedOption === option.id;
          const isWinning = showResults && option.percentage > 0 && option.percentage === Math.max(...poll.options.map(o => o.percentage));

          return (
            <button
              key={option.id}
              onClick={() => !showResults && handleVote(option.id)}
              disabled={showResults || isSubmitting}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 relative overflow-hidden",
                showResults
                  ? "cursor-default"
                  : "hover:border-purple-400 hover:bg-purple-50 cursor-pointer",
                isSelected && showResults
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200"
              )}
              data-testid={`poll-${poll.id}-option-${option.id}`}
            >
              {/* Results bar background */}
              {showResults && (
                <div
                  className={cn(
                    "absolute inset-0 transition-all duration-500",
                    isWinning ? "bg-purple-100" : "bg-gray-100"
                  )}
                  style={{ width: `${option.percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{option.label}</span>
                    {isSelected && showResults && (
                      <CheckCircle2 size={18} className="text-purple-600" />
                    )}
                  </div>
                  {option.description && (
                    <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                  )}
                </div>

                {showResults && (
                  <div className="ml-4 text-right">
                    <div className="font-bold text-lg text-gray-900">
                      {option.percentage}%
                    </div>
                    <div className="text-xs text-gray-600">
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
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button
            onClick={() => window.open(poll.sponsor_cta_url, '_blank')}
            className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white"
            data-testid={`poll-${poll.id}-cta`}
          >
            Learn More
          </Button>
        </div>
      )}

      {/* Footer with expiry */}
      {poll.expires_at && !showResults && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center space-x-2 text-sm text-gray-600">
          <Calendar size={16} />
          <span>Ends {new Date(poll.expires_at).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}
