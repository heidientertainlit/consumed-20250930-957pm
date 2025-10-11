
import { useQuery } from "@tanstack/react-query";
import { Send, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
}

interface CommentsSectionProps {
  postId: string;
  fetchComments: (postId: string) => Promise<Comment[]>;
  session: any;
  commentInput: string;
  onCommentInputChange: (value: string) => void;
  onSubmitComment: () => void;
  isSubmitting: boolean;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
}

export default function CommentsSection({
  postId,
  fetchComments,
  session,
  commentInput,
  onCommentInputChange,
  onSubmitComment,
  isSubmitting,
  currentUserId,
  onDeleteComment,
}: CommentsSectionProps) {
  const { data: comments, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: !!session?.access_token,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitComment();
  };

  const formatCommentDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <User size={16} className="text-gray-600" />
        </div>
        <div className="flex-1 flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Write a comment..."
            value={commentInput}
            onChange={(e) => onCommentInputChange(e.target.value)}
            className="flex-1 bg-white text-black placeholder:text-gray-500"
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!commentInput.trim() || isSubmitting}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1"
          >
            <Send size={16} />
          </Button>
        </div>
      </form>

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-start space-x-2 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-1/4 mb-1"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start space-x-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User size={16} className="text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">
                    {comment.user.displayName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatCommentDate(comment.createdAt)}
                  </span>
                  {currentUserId === comment.user.id && onDeleteComment && (
                    <button
                      onClick={() => onDeleteComment(comment.id, postId)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-auto"
                      data-testid={`button-delete-comment-${comment.id}`}
                      title="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-800">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 text-sm py-2">
          No comments yet. Be the first to comment!
        </div>
      )}
    </div>
  );
}
