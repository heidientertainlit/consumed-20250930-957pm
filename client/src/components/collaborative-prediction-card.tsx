import { useState } from "react";
import { TrendingUp, Users, Heart, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

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
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  poolId?: string;
}

interface CollaborativePredictionCardProps {
  prediction: CollaborativePrediction;
  onCastPrediction?: () => void;
}

export default function CollaborativePredictionCard({ 
  prediction, 
  onCastPrediction 
}: CollaborativePredictionCardProps) {
  const { creator, invitedFriend, question, creatorPrediction, friendPrediction, mediaTitle, participantCount, userHasAnswered, likesCount = 0, commentsCount = 0, isLiked = false, poolId } = prediction;
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(isLiked);
  const [currentLikesCount, setCurrentLikesCount] = useState(likesCount);

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (vote: string) => {
      if (!session?.access_token || !poolId) return;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/predictions/predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pool_id: poolId,
            prediction: vote,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cast vote');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vote cast!",
        description: "Your prediction has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
    onError: () => {
      toast({
        title: "Failed to vote",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !poolId) return;

      const method = liked ? 'DELETE' : 'POST';
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/prediction-like`,
        {
          method,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pool_id: poolId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to like prediction');
      }

      return response.json();
    },
    onMutate: async () => {
      // Optimistic update
      setLiked(!liked);
      setCurrentLikesCount(liked ? currentLikesCount - 1 : currentLikesCount + 1);
    },
    onError: () => {
      // Revert on error
      setLiked(liked);
      setCurrentLikesCount(currentLikesCount);
      toast({
        title: "Failed to like",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch comments
  const { data: commentsData } = useQuery({
    queryKey: ['prediction-comments', poolId],
    queryFn: async () => {
      if (!session?.access_token || !poolId) return { comments: [] };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/prediction-comments?pool_id=${poolId}&include=meta`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        return { comments: [] };
      }

      return response.json();
    },
    enabled: showComments && !!poolId,
  });

  // Post comment mutation
  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!session?.access_token || !poolId) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/prediction-comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pool_id: poolId,
            content,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      return response.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ['prediction-comments', poolId] });
      toast({
        title: "Comment posted!",
      });
    },
    onError: () => {
      toast({
        title: "Failed to comment",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (vote: string) => {
    if (voteMutation.isPending) return;
    voteMutation.mutate(vote);
  };

  const handlePostComment = () => {
    if (!commentText.trim() || commentMutation.isPending) return;
    commentMutation.mutate(commentText);
  };

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

      {/* Side by Side Predictions - Clickable for voting */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => handleVote("Yes")}
          disabled={userHasAnswered || voteMutation.isPending}
          className={`flex-1 rounded-lg p-2 border transition-all ${
            userHasAnswered
              ? "bg-purple-50 border-purple-200 cursor-default"
              : "bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300 cursor-pointer"
          }`}
          data-testid="button-vote-yes"
        >
          <p className="text-xs text-gray-600 mb-0.5">{creator.username}</p>
          <p className="text-sm font-semibold text-gray-900">{creatorPrediction}</p>
        </button>
        
        {friendPrediction ? (
          <button
            onClick={() => handleVote("No")}
            disabled={userHasAnswered || voteMutation.isPending}
            className={`flex-1 rounded-lg p-2 border transition-all ${
              userHasAnswered
                ? "bg-purple-50 border-purple-200 cursor-default"
                : "bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300 cursor-pointer"
            }`}
            data-testid="button-vote-no"
          >
            <p className="text-xs text-gray-600 mb-0.5">{invitedFriend.username}</p>
            <p className="text-sm font-semibold text-gray-900">{friendPrediction}</p>
          </button>
        ) : (
          <div className="flex-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
            <p className="text-xs text-gray-500 mb-0.5">{invitedFriend.username}</p>
            <p className="text-sm text-gray-400 italic">Pending...</p>
          </div>
        )}
      </div>

      {/* Participant count */}
      {participantCount && participantCount > 2 && (
        <p className="text-xs text-center text-gray-500 mb-3">
          <Users size={12} className="inline mr-1" />
          {participantCount} predictions
        </p>
      )}

      {/* Like and Comment Actions */}
      <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
        <button
          onClick={() => likeMutation.mutate()}
          disabled={likeMutation.isPending}
          className="flex items-center gap-1.5 text-gray-600 hover:text-purple-600 transition-colors"
          data-testid="button-like-prediction"
        >
          <Heart
            size={18}
            className={liked ? "fill-purple-600 text-purple-600" : ""}
          />
          <span className="text-sm">{currentLikesCount}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-purple-600 transition-colors"
          data-testid="button-comment-prediction"
        >
          <MessageCircle size={18} />
          <span className="text-sm">{commentsData?.comments?.length || commentsCount}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="space-y-3 mb-3">
            {commentsData?.comments?.map((comment: any) => (
              <div key={comment.id} className="text-sm">
                <p className="font-semibold text-gray-900">{comment.username}</p>
                <p className="text-gray-700">{comment.content}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePostComment();
                }
              }}
              data-testid="input-comment"
            />
            <Button
              onClick={handlePostComment}
              disabled={!commentText.trim() || commentMutation.isPending}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-post-comment"
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
