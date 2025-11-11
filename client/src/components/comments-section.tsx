import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Send, User, Trash2, Heart, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderMentions } from "@/lib/mentions";
import MentionInput from "@/components/mention-input";

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
  likesCount?: number;
  likedByCurrentUser?: boolean;
  replies?: Comment[]; // Nested replies
}

interface CommentsSectionProps {
  postId: string;
  fetchComments: (postId: string) => Promise<Comment[]>;
  session: any;
  commentInput: string;
  onCommentInputChange: (value: string) => void;
  onSubmitComment: (parentCommentId?: string, content?: string) => void;
  isSubmitting: boolean;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onLikeComment?: (commentId: string) => void;
  likedComments?: Set<string>;
  showRatingControls?: boolean; // Show rating controls for posts with ratings
  commentRating?: string; // Current rating value
  onRatingChange?: (rating: string) => void; // Callback for rating changes
}

interface CommentItemProps {
  comment: Comment;
  depth: number;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onLikeComment?: (commentId: string) => void;
  likedComments: Set<string>;
  commentLikesEnabled: boolean;
  postId: string;
  onSubmitReply: (parentCommentId: string, content: string) => void;
  isSubmitting: boolean;
  session: any;
}

function CommentItem({
  comment,
  depth,
  currentUserId,
  onDeleteComment,
  onLikeComment,
  likedComments,
  commentLikesEnabled,
  postId,
  onSubmitReply,
  isSubmitting,
  session,
}: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;

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

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyContent.trim()) {
      onSubmitReply(comment.id, replyContent);
      setReplyContent("");
      setShowReplyInput(false);
    }
  };

  // Calculate indentation using inline styles to support unlimited nesting depth
  const indentPx = depth * 16; // 16px per depth level
  const shouldShowVerticalLine = depth > 0;

  return (
    <div className="relative" id={`comment-${comment.id}`}>
      {/* Vertical threading line */}
      {shouldShowVerticalLine && (
        <div 
          className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"
          style={{ marginLeft: `${(depth - 1) * 16}px` }}
        />
      )}
      
      <div 
        className="flex items-start space-x-2"
        style={{ marginLeft: depth > 0 ? `${indentPx}px` : '0' }}
      >
        <Link href={`/user/${comment.user.id}`}>
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 cursor-pointer hover:bg-gray-300 transition-colors">
            <User size={16} className="text-gray-600" />
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1 flex-wrap">
            <Link 
              href={`/user/${comment.user.id}`}
              className="font-medium text-sm text-gray-900 hover:text-purple-600 cursor-pointer transition-colors"
              data-testid={`link-commenter-${comment.user.id}`}
            >
              {comment.user.displayName}
            </Link>
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
          <p className="text-sm text-gray-800 mb-2 break-words">{renderMentions(comment.content)}</p>
          
          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            {/* Comment Like Button */}
            {commentLikesEnabled && onLikeComment && (
              <button
                onClick={() => onLikeComment(comment.id)}
                className={`flex items-center space-x-1 transition-colors ${
                  comment.likedByCurrentUser || likedComments.has(comment.id)
                    ? 'text-red-500' 
                    : 'text-gray-400 hover:text-red-400'
                }`}
                data-testid={`button-like-comment-${comment.id}`}
                title="Like comment"
              >
                <Heart 
                  size={14} 
                  className={comment.likedByCurrentUser || likedComments.has(comment.id) ? 'fill-current' : ''} 
                />
                {(comment.likesCount || 0) > 0 && (
                  <span className="text-xs">{comment.likesCount}</span>
                )}
              </button>
            )}
            
            {/* Reply Button */}
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="flex items-center space-x-1 text-gray-400 hover:text-purple-500 transition-colors"
              data-testid={`button-reply-comment-${comment.id}`}
              title="Reply to comment"
            >
              <MessageCircle size={14} />
              <span className="text-xs">Reply</span>
            </button>

            {/* Collapse/Expand Button (only show if there are replies) */}
            {hasReplies && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center space-x-1 text-gray-400 hover:text-gray-600 transition-colors"
                data-testid={`button-toggle-replies-${comment.id}`}
                title={isCollapsed ? 'Show replies' : 'Hide replies'}
              >
                <span className="text-xs">
                  {isCollapsed ? `Show ${comment.replies?.length || 0} ${(comment.replies?.length || 0) === 1 ? 'reply' : 'replies'}` : 'Hide replies'}
                </span>
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <form onSubmit={handleSubmitReply} className="mt-2 flex items-center space-x-2">
              <MentionInput
                placeholder="Write a reply..."
                value={replyContent}
                onChange={setReplyContent}
                className="bg-white text-black placeholder:text-gray-500 text-sm"
                disabled={isSubmitting}
                autoFocus
                session={session}
                testId={`input-reply-${comment.id}`}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!replyContent.trim() || isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1"
                data-testid={`button-submit-reply-${comment.id}`}
              >
                <Send size={14} />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyContent("");
                }}
                className="px-3 py-1"
                data-testid={`button-cancel-reply-${comment.id}`}
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Nested Replies (hidden when collapsed) */}
      {!isCollapsed && comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              currentUserId={currentUserId}
              onDeleteComment={onDeleteComment}
              onLikeComment={onLikeComment}
              likedComments={likedComments}
              commentLikesEnabled={commentLikesEnabled}
              postId={postId}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
              session={session}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  onLikeComment,
  likedComments = new Set(),
  showRatingControls = false,
  commentRating = '',
  onRatingChange,
}: CommentsSectionProps) {
  // Feature flag for comment likes (defaults to OFF for safety)
  const commentLikesEnabled = import.meta.env.VITE_FEED_COMMENT_LIKES === 'true';
  
  const { data: comments, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: !!session?.access_token,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasRatingValue = showRatingControls && commentRating && parseFloat(commentRating) > 0;
    const hasCommentText = commentInput.trim().length > 0;
    
    // Must have either rating or comment to submit
    if (!hasRatingValue && !hasCommentText) return;
    
    let finalComment = '';
    
    if (hasRatingValue && hasCommentText) {
      // Both rating and comment
      finalComment = `${commentRating}. ${commentInput.trim()}`;
    } else if (hasRatingValue) {
      // Rating only - just the rating with a period
      finalComment = `${commentRating}.`;
    } else {
      // Comment only
      finalComment = commentInput.trim();
    }
    
    // Submit with formatted content
    onSubmitComment(undefined, finalComment);
    
    // Clear both rating and comment input after submit
    if (onRatingChange) {
      onRatingChange('');
    }
    onCommentInputChange('');
  };

  const handleSubmitReply = (parentCommentId: string, content: string) => {
    onSubmitComment(parentCommentId, content);
  };

  const currentRating = parseFloat(commentRating || '0');
  const hasRatingValue = showRatingControls && commentRating && parseFloat(commentRating) > 0;
  const hasCommentText = commentInput.trim().length > 0;
  const canSubmit = hasRatingValue || hasCommentText;

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      {/* Rating Controls (shown for posts with ratings) */}
      {showRatingControls && (
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-3">
            <Star size={20} className="text-gray-400" />
            <span className="text-gray-600 font-medium">Rate</span>
            <input
              type="text"
              value={commentRating || ''}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty, numbers, and one decimal point
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  const num = parseFloat(value);
                  // Validate range 0-5
                  if (value === '' || (num >= 0 && num <= 5)) {
                    onRatingChange?.(value);
                  }
                }
              }}
              placeholder="0"
              className="w-20 text-base text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="rating-input"
            />
            <span className="text-base text-gray-700">/5</span>
          </div>
        </div>
      )}

      {/* Top-level Comment Input */}
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <User size={16} className="text-gray-600" />
        </div>
        <MentionInput
          placeholder="Add a comment"
          value={commentInput}
          onChange={onCommentInputChange}
          className="bg-white text-black placeholder:text-gray-500"
          disabled={isSubmitting}
          session={session}
          testId="input-new-comment"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit || isSubmitting}
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1"
          data-testid="button-submit-comment"
        >
          <Send size={16} />
        </Button>
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
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              currentUserId={currentUserId}
              onDeleteComment={onDeleteComment}
              onLikeComment={onLikeComment}
              likedComments={likedComments}
              commentLikesEnabled={commentLikesEnabled}
              postId={postId}
              onSubmitReply={handleSubmitReply}
              isSubmitting={isSubmitting}
              session={session}
            />
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
