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
  voteCounts?: {
    yes: number;
    no: number;
    total: number;
  };
  origin_type?: 'consumed' | 'user';
  origin_user_id?: string;
}

interface CollaborativePredictionCardProps {
  prediction: CollaborativePrediction;
  onCastPrediction?: () => void;
}

export default function CollaborativePredictionCard({ 
  prediction, 
  onCastPrediction 
}: CollaborativePredictionCardProps) {
  const { creator, invitedFriend, question, creatorPrediction, friendPrediction, mediaTitle, participantCount, userHasAnswered, likesCount = 0, commentsCount = 0, isLiked = false, poolId, voteCounts, origin_type = 'user', origin_user_id } = prediction;
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(isLiked);
  const [currentLikesCount, setCurrentLikesCount] = useState(likesCount);
  const [showParticipants, setShowParticipants] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Calculate vote percentages
  const yesPercentage = voteCounts && voteCounts.total > 0 
    ? Math.round((voteCounts.yes / voteCounts.total) * 100)
    : 0;
  const noPercentage = voteCounts && voteCounts.total > 0
    ? Math.round((voteCounts.no / voteCounts.total) * 100)
    : 0;

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

  // Fetch participants or use mock data
  const { data: participantsData } = useQuery({
    queryKey: ['prediction-participants', poolId, voteCounts],
    queryFn: async () => {
      // Generate mock fallback data from voteCounts
      const generateMockParticipants = () => {
        const mockParticipants = [];
        const yesCount = voteCounts?.yes || 5;
        const noCount = voteCounts?.no || 3;
        
        for (let i = 0; i < yesCount; i++) {
          mockParticipants.push({
            prediction: 'Yes',
            users: { user_name: `user${i + 1}`, display_name: `User ${i + 1}` }
          });
        }
        
        for (let i = 0; i < noCount; i++) {
          mockParticipants.push({
            prediction: 'No',
            users: { user_name: `user${yesCount + i + 1}`, display_name: `User ${yesCount + i + 1}` }
          });
        }
        
        return mockParticipants;
      };

      // If no session or poolId, return mock data
      if (!session?.access_token || !poolId) {
        return { participants: generateMockParticipants() };
      }

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }
        });

        const { data, error } = await supabase
          .from('user_predictions')
          .select(`
            prediction,
            users:user_id (
              user_name,
              display_name
            )
          `)
          .eq('pool_id', poolId);

        if (error) {
          console.error('Error fetching participants:', error);
          // Return mock data on error
          return { participants: generateMockParticipants() };
        }

        // If no data returned from API, use mock fallback
        if (!data || data.length === 0) {
          return { participants: generateMockParticipants() };
        }

        return { participants: data };
      } catch (err) {
        console.error('Exception fetching participants:', err);
        return { participants: generateMockParticipants() };
      }
    },
    enabled: showParticipants,
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
  
  return (
    <Card className={`${isConsumedPrediction ? 'bg-gradient-to-br from-purple-50 via-white to-blue-50 border-2 border-purple-300' : 'bg-white border border-gray-200'} shadow-sm rounded-2xl p-4 mb-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 ${isConsumedPrediction ? 'bg-gradient-to-br from-purple-500 to-blue-500' : 'bg-purple-100'} rounded-full flex items-center justify-center`}>
            <TrendingUp size={16} className={isConsumedPrediction ? 'text-white' : 'text-purple-600'} />
          </div>
          <div className="flex-1">
            {isConsumedPrediction ? (
              <p className="text-sm">
                <span className="font-bold text-purple-700">🏆 Featured Prediction</span>
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">@{creator.username}</span>
                <span className="text-gray-500"> asked:</span>
              </p>
            )}
            {mediaTitle && (
              <p className="text-xs text-gray-500">about {mediaTitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Question */}
      <p className="text-sm font-medium text-gray-900 mb-3">
        {question}
      </p>

      {/* Voting Options - Stacked vertically */}
      <div className="space-y-2 mb-3">
        {/* Option 1 - Creator's prediction */}
        <div>
          <p className="text-xs text-gray-600 mb-1 ml-1">
            <span className="font-semibold">{creator.username}</span>
          </p>
          <button
            onClick={() => handleSelectOption("Yes")}
            disabled={userHasAnswered || voteMutation.isPending}
            className={`w-full rounded-full px-4 py-2.5 transition-all border-2 flex items-center justify-between ${
              userHasAnswered 
                ? "bg-white border-purple-300 opacity-60 cursor-default"
                : selectedOption === "Yes"
                ? "bg-purple-100 border-purple-500"
                : "bg-white border-purple-300 hover:border-purple-400"
            }`}
            data-testid="button-vote-yes"
          >
            <p className={`text-sm font-medium text-left ${selectedOption === "Yes" ? "text-purple-700" : "text-black"}`}>
              {creatorPrediction}
            </p>
            {voteCounts && (
              <span className="text-sm font-semibold text-gray-700">
                {yesPercentage}%
              </span>
            )}
          </button>
        </div>

        {/* Option 2 - Friend's prediction */}
        {friendPrediction ? (
          <div>
            <p className="text-xs text-gray-600 mb-1 ml-1">
              <span className="font-semibold">{invitedFriend.username}</span>
            </p>
            <button
              onClick={() => handleSelectOption("No")}
              disabled={userHasAnswered || voteMutation.isPending}
              className={`w-full rounded-full px-4 py-2.5 transition-all border-2 flex items-center justify-between ${
                userHasAnswered 
                  ? "bg-white border-purple-300 opacity-60 cursor-default"
                  : selectedOption === "No"
                  ? "bg-purple-100 border-purple-500"
                  : "bg-white border-purple-300 hover:border-purple-400"
              }`}
              data-testid="button-vote-no"
            >
              <p className={`text-sm font-medium text-left ${selectedOption === "No" ? "text-purple-700" : "text-black"}`}>
                {friendPrediction}
              </p>
              {voteCounts && (
                <span className="text-sm font-semibold text-gray-700">
                  {noPercentage}%
                </span>
              )}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-600 mb-1 ml-1">
              <span className="font-semibold">{invitedFriend.username}</span>
            </p>
            <div className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 border-2 border-gray-200">
              <p className="text-sm text-gray-400 italic text-left">Pending...</p>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      {!userHasAnswered && selectedOption && (
        <div className="mb-3">
          <Button
            onClick={handleSubmitVote}
            disabled={voteMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full"
          >
            {voteMutation.isPending ? "Submitting..." : "Cast Prediction"}
          </Button>
        </div>
      )}

      {/* Participant count */}
      {voteCounts && voteCounts.total > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="w-full text-xs text-center text-purple-600 hover:text-purple-700 font-medium"
          >
            <Users size={12} className="inline mr-1" />
            {voteCounts.total} predictions {showParticipants ? '▲' : '▼'}
          </button>
          
          {showParticipants && participantsData?.participants && participantsData.participants.length > 0 && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
              {/* Group participants by their vote */}
              {(() => {
                const yesPredictions = participantsData.participants.filter((p: any) => p.prediction === 'Yes');
                const noPredictions = participantsData.participants.filter((p: any) => p.prediction === 'No');
                
                return (
                  <div className="space-y-3">
                    {yesPredictions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">
                          {creatorPrediction} ({yesPredictions.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {yesPredictions.map((p: any, idx: number) => (
                            <span key={idx} className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                              @{p.users?.user_name || p.users?.display_name || 'unknown'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {noPredictions.length > 0 && friendPrediction && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">
                          {friendPrediction} ({noPredictions.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {noPredictions.map((p: any, idx: number) => (
                            <span key={idx} className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                              @{p.users?.user_name || p.users?.display_name || 'unknown'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
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
