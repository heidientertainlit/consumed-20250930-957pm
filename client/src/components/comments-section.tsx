import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Send, User, Trash2, MessageCircle, ArrowBigUp, ArrowBigDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderMentions } from "@/lib/mentions";
import MentionInput from "@/components/mention-input";
import MediaRecInput from "@/components/media-rec-input";

interface MediaMetadata {
  title: string;
  type: string;
  creator?: string;
  poster_url?: string;
  external_id?: string;
  external_source?: string;
}

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
  voteScore?: number; // upvotes - downvotes (legacy)
  upVoteCount?: number; // separate upvote count
  downVoteCount?: number; // separate downvote count
  currentUserVote?: 'up' | 'down' | null; // user's current vote
  replies?: Comment[]; // Nested replies
  media_metadata?: MediaMetadata; // For recommendation comments
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
  onVoteComment?: (commentId: string, direction: 'up' | 'down') => void;
  likedComments?: Set<string>;
  commentVotes?: Map<string, 'up' | 'down'>; // Track user's votes per comment
  // Ask for Recs mode
  isRecsMode?: boolean;
  recCategory?: string;
}

interface CommentItemProps {
  comment: Comment;
  depth: number;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onLikeComment?: (commentId: string) => void;
  onVoteComment?: (commentId: string, direction: 'up' | 'down') => void;
  likedComments: Set<string>;
  commentVotes: Map<string, 'up' | 'down'>;
  commentLikesEnabled: boolean;
  postId: string;
  onSubmitReply: (parentCommentId: string, content: string) => void;
  isSubmitting: boolean;
  session: any;
  isRecsMode?: boolean;
  recCategory?: string;
}

function CommentItem({
  comment,
  depth,
  currentUserId,
  onDeleteComment,
  onLikeComment,
  onVoteComment,
  likedComments,
  commentVotes,
  commentLikesEnabled,
  postId,
  onSubmitReply,
  isSubmitting,
  session,
  isRecsMode = false,
  recCategory,
}: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;

  // Category emoji mapping for recs mode
  const categoryEmoji: Record<string, string> = {
    movies: '🎬', tv: '📺', books: '📚', music: '🎵', 
    podcasts: '🎙️', games: '🎮', '': '💡'
  };
  const recEmoji = categoryEmoji[recCategory || ''] || '💡';

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

  // Try to parse media metadata from content (JSON format) or use existing media_metadata
  const parseMediaMetadata = (): MediaMetadata | null => {
    if (comment.media_metadata) return comment.media_metadata;
    try {
      const parsed = JSON.parse(comment.content);
      if (parsed && parsed.title) return parsed as MediaMetadata;
    } catch {
      // Not JSON, use content as title
    }
    return null;
  };
  
  const mediaData = isRecsMode ? parseMediaMetadata() : null;
  const displayTitle = mediaData?.title || comment.content;
  const displayCreator = mediaData?.creator;
  const displayPoster = mediaData?.poster_url;
  const displayType = mediaData?.type;

  // Recs mode: Render as recommendation card - compact style matching search results
  if (isRecsMode && depth === 0) {
    return (
      <div className="relative" id={`comment-${comment.id}`}>
        <div className="bg-white border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-colors">
          {/* Compact recommendation row */}
          <div className="flex items-center gap-3">
            {displayPoster ? (
              <img 
                src={displayPoster} 
                alt={displayTitle}
                className="w-10 h-14 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-14 bg-purple-100 rounded flex items-center justify-center flex-shrink-0 text-lg">
                {recEmoji}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <p className="font-medium text-gray-900 text-sm truncate">{renderMentions(displayTitle)}</p>
              {/* Type and creator */}
              <p className="text-xs text-gray-500 truncate">
                {displayType && <span className="capitalize">{displayType}</span>}
                {displayType && displayCreator && ' • '}
                {displayCreator}
              </p>
            </div>
            {/* Compact vote buttons */}
            {onVoteComment && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onVoteComment(comment.id, 'up')}
                  className="p-1 transition-colors"
                  data-testid={`button-upvote-comment-${comment.id}`}
                >
                  <ArrowBigUp 
                    size={16} 
                    className={(comment.currentUserVote === 'up' || commentVotes.get(comment.id) === 'up') ? 'text-green-500 fill-green-500' : 'text-gray-400 hover:text-green-500'}
                  />
                </button>
                <span className="text-xs text-gray-500 min-w-[20px] text-center">
                  {(comment.upVoteCount || 0) - (comment.downVoteCount || 0)}
                </span>
                <button
                  onClick={() => onVoteComment(comment.id, 'down')}
                  className="p-1 transition-colors"
                  data-testid={`button-downvote-comment-${comment.id}`}
                >
                  <ArrowBigDown 
                    size={16} 
                    className={(comment.currentUserVote === 'down' || commentVotes.get(comment.id) === 'down') ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-500'}
                  />
                </button>
              </div>
            )}
            {/* Reply button */}
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-gray-300 hover:text-purple-500 transition-colors p-1"
              data-testid={`button-reply-comment-${comment.id}`}
              title="Reply"
            >
              <MessageCircle size={14} />
            </button>
            {currentUserId === comment.user.id && onDeleteComment && (
              <button
                onClick={() => onDeleteComment(comment.id, postId)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                data-testid={`button-delete-comment-${comment.id}`}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          
          {/* Reply Input */}
          {showReplyInput && (
            <form onSubmit={handleSubmitReply} className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
              <MentionInput
                placeholder="Add a comment..."
                value={replyContent}
                onChange={setReplyContent}
                className="bg-gray-50 text-black placeholder:text-gray-400 text-sm"
                disabled={isSubmitting}
                autoFocus
                session={session}
                testId={`input-reply-${comment.id}`}
              />
              <Button type="submit" size="sm" disabled={!replyContent.trim() || isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 text-xs">
                <Send size={12} />
              </Button>
            </form>
          )}
        </div>

        {/* Nested Replies */}
        {!isCollapsed && comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 ml-6 space-y-2 border-l-2 border-purple-100 pl-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                depth={depth + 1}
                currentUserId={currentUserId}
                onDeleteComment={onDeleteComment}
                onLikeComment={onLikeComment}
                onVoteComment={onVoteComment}
                likedComments={likedComments}
                commentVotes={commentVotes}
                commentLikesEnabled={commentLikesEnabled}
                postId={postId}
                onSubmitReply={onSubmitReply}
                isSubmitting={isSubmitting}
                session={session}
                isRecsMode={false}
                recCategory={recCategory}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Standard comment rendering
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
            {/* Upvote/Downvote Buttons - Rank style with separate counts */}
            {onVoteComment && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onVoteComment(comment.id, 'up')}
                  className={`flex items-center space-x-0.5 p-0.5 rounded transition-colors ${
                    (comment.currentUserVote === 'up' || commentVotes.get(comment.id) === 'up')
                      ? 'text-green-500' 
                      : 'text-gray-400 hover:text-green-500'
                  }`}
                  data-testid={`button-upvote-comment-${comment.id}`}
                  title="Upvote"
                >
                  <ArrowBigUp 
                    size={18} 
                    fill={(comment.currentUserVote === 'up' || commentVotes.get(comment.id) === 'up') ? 'currentColor' : 'none'} 
                  />
                  <span className="text-xs font-medium">+{comment.upVoteCount || 0}</span>
                </button>
                <button
                  onClick={() => onVoteComment(comment.id, 'down')}
                  className={`flex items-center space-x-0.5 p-0.5 rounded transition-colors ${
                    (comment.currentUserVote === 'down' || commentVotes.get(comment.id) === 'down')
                      ? 'text-red-500' 
                      : 'text-gray-400 hover:text-red-500'
                  }`}
                  data-testid={`button-downvote-comment-${comment.id}`}
                  title="Downvote"
                >
                  <ArrowBigDown 
                    size={18} 
                    fill={(comment.currentUserVote === 'down' || commentVotes.get(comment.id) === 'down') ? 'currentColor' : 'none'} 
                  />
                  <span className="text-xs font-medium">-{comment.downVoteCount || 0}</span>
                </button>
              </div>
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
              onVoteComment={onVoteComment}
              likedComments={likedComments}
              commentVotes={commentVotes}
              commentLikesEnabled={commentLikesEnabled}
              postId={postId}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
              session={session}
              isRecsMode={isRecsMode}
              recCategory={recCategory}
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
  onVoteComment,
  likedComments = new Set(),
  commentVotes = new Map(),
  isRecsMode = false,
  recCategory,
}: CommentsSectionProps) {
  // Feature flag for comment likes (defaults to OFF for safety)
  const commentLikesEnabled = import.meta.env.VITE_FEED_COMMENT_LIKES === 'true';
  
  // For recs mode: collapse the add input by default
  const [showAddRecInput, setShowAddRecInput] = useState(false);
  
  const { data: comments, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: !!session?.access_token,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitComment();
  };

  const handleSubmitReply = (parentCommentId: string, content: string) => {
    onSubmitComment(parentCommentId, content);
  };

  // Category emoji and label for recs mode
  const categoryLabels: Record<string, string> = {
    movies: 'movie', tv: 'show', books: 'book', music: 'song', 
    podcasts: 'podcast', games: 'game', '': 'recommendation'
  };
  const categoryLabel = categoryLabels[recCategory || ''] || 'recommendation';
  const placeholder = isRecsMode 
    ? `Recommend a ${categoryLabel} 👇` 
    : 'Add a comment';

  // Count for social proof
  const commentCount = comments?.length || 0;

  // Handle media rec submission - store full metadata as JSON
  const handleMediaRecSubmit = (media: { title: string; type: string; creator: string; poster_url: string; external_id?: string; external_source?: string }) => {
    // Store media metadata as JSON for poster display
    const mediaJson = JSON.stringify({
      title: media.title,
      type: media.type,
      creator: media.creator,
      poster_url: media.poster_url,
      external_id: media.external_id,
      external_source: media.external_source
    });
    onSubmitComment(undefined, mediaJson);
    setShowAddRecInput(false); // Collapse after adding
  };

  return (
    <div className={`rounded-lg p-4 space-y-3 ${isRecsMode ? 'bg-gray-50' : 'bg-gray-50'}`}>
      {/* Top-level Comment Input */}
      {isRecsMode ? (
        showAddRecInput ? (
          <div className="space-y-2">
            <MediaRecInput
              placeholder={`Search for a ${categoryLabel}...`}
              onSubmit={handleMediaRecSubmit}
              isSubmitting={isSubmitting}
              recCategory={recCategory}
            />
            <button
              onClick={() => setShowAddRecInput(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
              data-testid="button-cancel-add-rec"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddRecInput(true)}
            className="w-full py-2 px-3 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-dashed border-purple-300 transition-colors flex items-center justify-center gap-2"
            data-testid="button-add-rec"
          >
            <span>+ Add a {categoryLabel}</span>
          </button>
        )
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <User size={16} className="text-gray-600" />
          </div>
          <MentionInput
            placeholder={placeholder}
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
            disabled={!commentInput.trim() || isSubmitting}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1"
            data-testid="button-submit-comment"
          >
            <Send size={16} />
          </Button>
        </form>
      )}

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
        <>
          <div className={isRecsMode ? "space-y-2" : "space-y-3"}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                currentUserId={currentUserId}
                onDeleteComment={onDeleteComment}
                onLikeComment={onLikeComment}
                onVoteComment={onVoteComment}
                likedComments={likedComments}
                commentVotes={commentVotes}
                commentLikesEnabled={commentLikesEnabled}
                postId={postId}
                onSubmitReply={handleSubmitReply}
                isSubmitting={isSubmitting}
                session={session}
                isRecsMode={isRecsMode}
                recCategory={recCategory}
              />
            ))}
          </div>
          {/* Social proof CTA for recs mode */}
          {isRecsMode && (
            <div 
              className="text-center text-sm text-purple-600 pt-2 border-t border-purple-200 mt-3"
              data-testid="status-recs-social-proof"
            >
              {commentCount === 1 
                ? "1 friend replied • Be the next one →" 
                : `${commentCount} friends replied • Add yours →`}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 text-sm py-2">
          {isRecsMode 
            ? "No recs yet • Be the first →" 
            : "No comments yet. Be the first to comment!"}
        </div>
      )}
    </div>
  );
}
