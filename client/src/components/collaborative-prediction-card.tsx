import { useState } from "react";
import { TrendingUp, Heart, MessageCircle, Users, Trash2, ChevronRight as ChevronRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface PredictionOption {
  option: string;
  count: number;
  percentage: number;
}

interface UserVote {
  user: string;
  vote: string;
  userId: string;
}

interface PredictionCard {
  id: string;
  title: string;
  description?: string;
  creator: {
    id?: string;
    username: string;
  };
  mediaTitle?: string;
  userHasAnswered?: boolean;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  poolId?: string;
  voteCounts?: {
    yes: number;
    no: number;
    total: number;
  };
  origin_type?: 'consumed' | 'user';
  origin_user_id?: string;
  deadline?: string | null;
  status?: 'open' | 'locked' | 'completed';
  resolved_at?: string | null;
  winning_option?: string;
  options?: string[];
  optionVotes?: PredictionOption[];
  userVotes?: UserVote[];
  mediaItems?: Array<{
    title: string;
    mediaType?: string;
    externalId?: string;
    externalSource?: string;
    imageUrl?: string;
  }>;
  type?: string;
}

interface PredictionCardProps {
  prediction: PredictionCard;
}

export default function CollaborativePredictionCard({ 
  prediction
}: PredictionCardProps) {
  const { creator, title, mediaTitle, userHasAnswered, likesCount = 0, commentsCount = 0, isLiked = false, poolId, origin_type = 'user', origin_user_id, status = 'open', type, userVotes = [], options = [], optionVotes = [], mediaItems } = prediction;
  
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(isLiked);
  const [currentLikesCount, setCurrentLikesCount] = useState(likesCount);
  const [showParticipants, setShowParticipants] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Check if current user is the creator
  const appUserId = session?.user?.user_metadata?.id || session?.user?.id;
  const isCreator = origin_user_id && appUserId === origin_user_id;

  // Check if prediction is completed
  const isCompleted = status === 'completed';

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !poolId) return;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/delete-prediction`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pool_id: poolId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete prediction');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Prediction deleted",
        description: "Your prediction has been removed from the feed.",
      });
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
    onError: () => {
      toast({
        title: "Failed to delete",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

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
      setLiked(!liked);
      setCurrentLikesCount(liked ? currentLikesCount - 1 : currentLikesCount + 1);
    },
    onError: () => {
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

  const handleSelectOption = (option: string) => {
    if (userHasAnswered || voteMutation.isPending) return;
    setSelectedOption(option);
  };

  const handleSubmitVote = () => {
    if (!selectedOption || voteMutation.isPending) return;
    voteMutation.mutate(selectedOption);
  };

  const handlePostComment = () => {
    if (!commentText.trim() || commentMutation.isPending) return;
    commentMutation.mutate(commentText);
  };

  const isConsumedPrediction = origin_type === 'consumed';
  const totalVotes = optionVotes?.reduce((sum, ov) => sum + ov.count, 0) || 0;
  
  return (
    <Card className={`${isConsumedPrediction ? 'bg-gradient-to-br from-purple-50 via-white to-blue-50 border-2 border-purple-300' : 'bg-white border border-gray-200'} shadow-sm rounded-2xl p-4`}>
      {/* Header with creator and delete button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-700 flex-1">
          {isConsumedPrediction ? (
            <span className="font-bold text-purple-700">🏆 Consumed Prediction</span>
          ) : (
            <>
              <span className="font-semibold text-gray-900">@{creator.username}</span>
              <span className="text-gray-500"> predicts about </span>
              {mediaTitle && mediaItems?.[0] && (
                <button
                  onClick={() => {
                    const media = mediaItems[0];
                    if (media.externalId && media.externalSource) {
                      setLocation(`/media/${media.mediaType?.toLowerCase()}/${media.externalSource}/${media.externalId}`);
                    }
                  }}
                  className="font-semibold text-gray-900 hover:text-purple-600 transition-colors cursor-pointer underline"
                >
                  {mediaTitle}
                </button>
              )}
            </>
          )}
        </p>
        
        {/* Delete button */}
        {isCreator && origin_type === 'user' && (
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
            title="Delete prediction"
            data-testid="button-delete-prediction"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Prediction Question */}
      <p className="text-base font-semibold text-gray-900 mb-4">
        {title}
      </p>

      {/* Voting Options - Stacked vertically */}
      <div className="space-y-2 mb-3">
        {options && options.length > 0 ? (
          options.map((option, index) => {
            const optionData = optionVotes?.find(ov => ov.option === option);
            const percentage = optionData?.percentage || 0;
            const count = optionData?.count || 0;
            
            // Get voters for this specific option
            const votersForOption = (userVotes && Array.isArray(userVotes)) 
              ? userVotes.filter(uv => uv?.vote === option) 
              : [];
            
            return (
              <div key={index}>
                {votersForOption && votersForOption.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5 ml-1">
                    {votersForOption.map((voter, idx) => (
                      <span key={idx} className="text-xs font-semibold text-purple-600">
                        @{voter?.user}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleSelectOption(option)}
                  disabled={userHasAnswered || voteMutation.isPending}
                  className={`w-full rounded-full px-4 py-2.5 transition-all border-2 flex items-center justify-between ${
                    userHasAnswered 
                      ? "bg-white border-purple-300 opacity-60 cursor-default"
                      : selectedOption === option
                      ? "bg-purple-100 border-purple-500"
                      : "bg-white border-purple-300 hover:border-purple-400"
                  }`}
                  data-testid={`button-vote-option-${index}`}
                >
                  <p className={`text-sm font-medium text-left ${selectedOption === option ? "text-purple-700" : "text-black"}`}>
                    {option}
                  </p>
                  {userHasAnswered && totalVotes > 0 && (
                    <span className="text-sm font-semibold text-gray-700">
                      {percentage}% ({count})
                    </span>
                  )}
                </button>
              </div>
            );
          })
        ) : null}
      </div>

      {/* Submit Button */}
      {!userHasAnswered && selectedOption && (
        <div className="mb-3">
          <Button
            onClick={handleSubmitVote}
            disabled={voteMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full"
            data-testid="button-submit-vote"
          >
            {voteMutation.isPending ? "Submitting..." : "Cast Prediction"}
          </Button>
        </div>
      )}

      {/* Like, Comment, and Participant Count Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-4">
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
        
        {totalVotes > 0 && (
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-xs font-medium"
            data-testid="button-show-participants"
          >
            <Users size={12} />
            <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            <span className="text-[10px]">{showParticipants ? '▲' : '▼'}</span>
          </button>
        )}
      </div>
      
      {/* Participants Dropdown */}
      {showParticipants && userVotes?.length > 0 && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
          {(() => {
            const byVote: { [key: string]: typeof userVotes } = {};
            userVotes.forEach(uv => {
              if (!byVote[uv.vote]) byVote[uv.vote] = [];
              byVote[uv.vote].push(uv);
            });
            
            return (
              <div className="space-y-3">
                {Object.entries(byVote).map(([vote, voters]) => (
                  <div key={vote}>
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">
                      <strong>{vote}</strong> ({voters.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {voters.map((v, idx) => (
                        <span key={idx} className="inline-block px-2.5 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          @{v.user}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

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
              className="flex-1 text-sm bg-white text-black border-gray-300"
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
