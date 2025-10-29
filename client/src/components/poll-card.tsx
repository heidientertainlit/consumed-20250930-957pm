import { useState } from "react";
import { TrendingUp, Calendar } from "lucide-react";
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
  id: string | number;
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
  onVote: (pollId: string | number, optionId: string | number) => Promise<void>;
  hasVoted?: boolean;
  userVote?: number;
}

export default function PollCard({ poll, onVote }: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectOption = (optionId: number) => {
    setSelectedOption(optionId);
    setErrorMessage(null);
  };

  const handleSubmitVote = async () => {
    if (!selectedOption || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onVote(poll.id, selectedOption);
      // Poll will disappear from feed after successful vote
    } catch (error: any) {
      if (error?.message?.includes('already voted')) {
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
        return "Consumed Poll";
      case "sponsored":
        return poll.sponsor_name || "Sponsored";
      default:
        return "Poll";
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100 p-4 shadow-sm mb-4" data-testid={`poll-${poll.id}`}>
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
        {poll.options && poll.options.length > 0 ? poll.options.map((option) => {
          const isSelected = selectedOption === option.id;

          return (
            <button
              key={option.id}
              onClick={() => handleSelectOption(option.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all duration-200 bg-white hover:border-purple-300 hover:bg-purple-50 cursor-pointer",
                isSelected
                  ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                  : "border-purple-100"
              )}
              data-testid={`poll-${poll.id}-option-${option.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">{option.label}</span>
                  {option.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  )}
                </div>
              </div>
            </button>
          );
        }) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            No options available for this poll
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmitVote}
        disabled={!selectedOption || isSubmitting}
        className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid={`poll-${poll.id}-submit`}
      >
        {isSubmitting ? "Submitting..." : "Submit Vote"}
      </Button>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* Footer with expiry */}
      {poll.expires_at && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center space-x-1.5 text-xs text-gray-500">
          <Calendar size={12} />
          <span>Ends {new Date(poll.expires_at).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}
