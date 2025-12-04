import { useState } from "react";
import { TrendingUp, Heart, MessageCircle, Users, Trash2, ChevronRight as ChevronRightIcon, Target, ArrowBigUp, ArrowBigDown, User } from "lucide-react";
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
      // Save original values for rollback
      const wasLiked = liked;
      const prevCount = currentLikesCount;
      
      // Optimistic update
      setLiked(!wasLiked);
      setCurrentLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);
      
      // Return context for rollback
      return { wasLiked, prevCount };
    },
    onError: (_error, _variables, context) => {
      // Rollback to original values
      if (context) {
        setLiked(context.wasLiked);
        setCurrentLikesCount(context.prevCount);
      }
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

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/prediction-comments?comment_id=${String(commentId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-comments', poolId] });
      toast({
        title: "Comment deleted",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete comment",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Vote on comment mutation
  const voteCommentMutation = useMutation({
    mutationFn: async ({ commentId, voteType }: { commentId: string; voteType: 1 | -1 }) => {
      if (!session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/prediction-comment-vote`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comment_id: String(commentId),
            vote_type: voteType,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to vote on comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-comments', poolId] });
    },
    onError: () => {
      toast({
        title: "Failed to vote",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove vote mutation
  const removeVoteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/prediction-comment-vote?comment_id=${String(commentId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove vote');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prediction-comments', poolId] });
    },
  });

  const handleVoteComment = (commentId: string, voteType: 1 | -1, currentUserVote: number | null) => {
    if (currentUserVote === voteType) {
      // User is clicking the same vote type - remove the vote
      removeVoteMutation.mutate(commentId);
    } else {
      // User is voting or changing vote
      voteCommentMutation.mutate({ commentId, voteType });
    }
  };

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
      {/* Header: Poster + Media Title + Username */}
      <div className="flex items-start gap-3 mb-4">
        {/* Media Poster - show if available */}
        {mediaItems?.[0]?.imageUrl && (
          <button
            onClick={() => {
              const media = mediaItems?.[0];
              if (media?.externalId && media?.externalSource) {
                setLocation(`/media/${media.mediaType?.toLowerCase() || 'movie'}/${media.externalSource}/${media.externalId}`);
              }
            }}
            className="flex-shrink-0"
            data-testid="button-prediction-poster"
          >
            <img 
              src={mediaItems[0].imageUrl} 
              alt={mediaTitle || 'Media poster'}
              className="w-14 h-20 object-cover rounded-md shadow-sm"
            />
          </button>
        )}
        
        <div className="flex-1 min-w-0">
          {/* Media Title - Clickable */}
          {mediaTitle && (
            <button
              onClick={() => {
                const media = mediaItems?.[0];
                if (media?.externalId && media?.externalSource) {
                  setLocation(`/media/${media.mediaType?.toLowerCase() || 'movie'}/${media.externalSource}/${media.externalId}`);
                }
              }}
              className="text-base font-semibold text-gray-900 mb-1 hover:text-purple-700 transition-colors text-left"
              data-testid="link-prediction-media-title"
            >
              {mediaTitle}
            </button>
          )}
          
          {/* Prediction/Poll by username */}
          <p className="text-sm text-gray-500">
            {isConsumedPrediction ? (
              <span className="font-bold text-purple-700">🏆 Consumed {type === 'vote' ? 'Poll' : 'Prediction'}</span>
            ) : (
              <>
                <span className="text-purple-600">{type === 'vote' ? 'Poll' : 'Prediction'}</span>
                <span> by </span>
                <button
                  onClick={() => setLocation(`/profile/${creator.username}`)}
                  className="text-purple-600 font-medium hover:text-purple-800 transition-colors"
                  data-testid="link-prediction-creator"
                >
                  @{creator.username}
                </button>
              </>
            )}
          </p>
        </div>
        
        {/* Delete button - Show for creators of user-generated predictions */}
        {origin_type === 'user' && isCreator && (
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center p-1.5 rounded-full transition-colors flex-shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
            title="Delete prediction"
            data-testid="button-delete-prediction"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Prediction Question */}
      <p className="text-base font-medium text-gray-900 mb-4">
        {title}
      </p>

      {/* Voting Options - Purple gradient buttons */}
      <div className="space-y-2 mb-3">
        {options && options.length > 0 ? (
          options.map((option, index) => {
            const optionData = optionVotes?.find(ov => ov.option === option);
            const percentage = optionData?.percentage || 0;
            
            return (
              <button
                key={index}
                onClick={() => handleSelectOption(option)}
                disabled={userHasAnswered || voteMutation.isPending}
                className={`w-full rounded-full px-4 py-3 transition-all flex items-center justify-between ${
                  userHasAnswered 
                    ? "bg-gradient-to-r from-purple-950 via-purple-800 to-violet-500 cursor-not-allowed"
                    : selectedOption === option
                    ? "bg-gradient-to-r from-purple-950 via-purple-800 to-violet-500 ring-2 ring-purple-300 cursor-pointer"
                    : "bg-gradient-to-r from-purple-950 via-purple-800 to-violet-500 hover:from-purple-900 hover:via-purple-700 hover:to-violet-400 cursor-pointer"
                }`}
                data-testid={`button-vote-option-${index}`}
              >
                <span className="text-sm font-medium text-white">
                  {option}
                </span>
                {userHasAnswered && totalVotes > 0 && (
                  <span className="text-sm font-semibold text-white">
                    {percentage}%
                  </span>
                )}
              </button>
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
            className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
            data-testid="button-submit-vote"
          >
            {voteMutation.isPending ? "Submitting..." : "Cast Prediction"}
          </Button>
        </div>
      )}

      {/* Vote count */}
      {totalVotes > 0 && (
        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className="flex items-center gap-1.5 text-gray-600 mb-3"
          data-testid="button-show-participants"
        >
          <User size={14} />
          <span className="text-sm">{totalVotes} votes</span>
        </button>
      )}

      {/* Like and Comment Actions */}
      <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
        <button
          onClick={() => likeMutation.mutate()}
          disabled={likeMutation.isPending}
          className="flex items-center gap-1.5 text-gray-600 hover:text-red-500 transition-colors"
          data-testid="button-like-prediction"
        >
          <Heart
            size={18}
            className={liked ? "fill-red-500 text-red-500" : ""}
          />
          <span className="text-sm">{currentLikesCount}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 transition-colors"
          data-testid="button-comment-prediction"
        >
          <MessageCircle size={18} />
          <span className="text-sm">{commentsData?.comments?.length || commentsCount}</span>
        </button>
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
              <div key={comment.id} className="text-sm group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{comment.username}</p>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                  {comment.user_id === session?.user?.id && (
                    <button
                      onClick={() => deleteCommentMutation.mutate(String(comment.id))}
                      disabled={deleteCommentMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete comment"
                      data-testid={`button-delete-comment-${comment.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {/* Upvote/Downvote buttons - Reddit style */}
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    onClick={() => handleVoteComment(String(comment.id), 1, comment.userVote)}
                    disabled={voteCommentMutation.isPending || removeVoteMutation.isPending}
                    className={`p-0.5 rounded transition-colors ${
                      comment.userVote === 1 
                        ? 'text-orange-500' 
                        : 'text-gray-400 hover:text-orange-500 hover:bg-gray-100'
                    }`}
                    title="Upvote"
                    aria-label="Upvote comment"
                    data-testid={`button-upvote-comment-${comment.id}`}
                  >
                    <ArrowBigUp size={18} className={comment.userVote === 1 ? 'fill-current' : ''} />
                  </button>
                  <span className={`text-xs font-medium min-w-[16px] text-center ${
                    comment.userVote === 1 ? 'text-orange-500' : 
                    comment.userVote === -1 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {(comment.upvotes || 0) - (comment.downvotes || 0)}
                  </span>
                  <button
                    onClick={() => handleVoteComment(String(comment.id), -1, comment.userVote)}
                    disabled={voteCommentMutation.isPending || removeVoteMutation.isPending}
                    className={`p-0.5 rounded transition-colors ${
                      comment.userVote === -1 
                        ? 'text-blue-600' 
                        : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'
                    }`}
                    title="Downvote"
                    aria-label="Downvote comment"
                    data-testid={`button-downvote-comment-${comment.id}`}
                  >
                    <ArrowBigDown size={18} className={comment.userVote === -1 ? 'fill-current' : ''} />
                  </button>
                </div>
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
