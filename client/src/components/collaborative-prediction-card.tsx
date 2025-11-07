import { TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CollaborativePrediction {
  id: string;
  question: string;
  creator: {
    username: string;
  };
  invitedFriend: {
    username: string;
  };
  creatorPrediction: string;
  friendPrediction?: string;
  mediaTitle?: string;
  participantCount?: number;
  userHasAnswered?: boolean;
}

interface CollaborativePredictionCardProps {
  prediction: CollaborativePrediction;
  onCastPrediction?: () => void;
}

export default function CollaborativePredictionCard({ 
  prediction, 
  onCastPrediction 
}: CollaborativePredictionCardProps) {
  const { creator, invitedFriend, question, creatorPrediction, friendPrediction, mediaTitle, participantCount, userHasAnswered } = prediction;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-3">
        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
          <TrendingUp size={16} className="text-purple-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-purple-600">{creator.username}</span>
            {" & "}
            <span className="font-semibold text-purple-600">{invitedFriend.username}</span>
            {" predict"}
          </p>
          {mediaTitle && (
            <p className="text-xs text-gray-500">about {mediaTitle}</p>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="text-sm font-medium text-gray-900 mb-3">
        {question}
      </p>

      {/* Side by Side Predictions */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-purple-50 rounded-lg p-2 border border-purple-200">
          <p className="text-xs text-gray-600 mb-0.5">{creator.username}</p>
          <p className="text-sm font-semibold text-gray-900">{creatorPrediction}</p>
        </div>
        
        {friendPrediction ? (
          <div className="flex-1 bg-purple-50 rounded-lg p-2 border border-purple-200">
            <p className="text-xs text-gray-600 mb-0.5">{invitedFriend.username}</p>
            <p className="text-sm font-semibold text-gray-900">{friendPrediction}</p>
          </div>
        ) : (
          <div className="flex-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
            <p className="text-xs text-gray-500 mb-0.5">{invitedFriend.username}</p>
            <p className="text-sm text-gray-400 italic">Pending...</p>
          </div>
        )}
      </div>

      {/* Action */}
      {!userHasAnswered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCastPrediction}
          className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-sm font-medium"
          data-testid="button-cast-prediction"
        >
          {participantCount && participantCount > 2 ? (
            <span className="flex items-center gap-1">
              <Users size={14} />
              {participantCount} predictions · Add yours
            </span>
          ) : (
            "→ Cast your prediction too"
          )}
        </Button>
      )}
      
      {userHasAnswered && (
        <p className="text-xs text-center text-gray-500">
          You predicted · {participantCount && participantCount > 2 && `${participantCount} total predictions`}
        </p>
      )}
    </Card>
  );
}
