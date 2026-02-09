import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch, useParams } from "wouter";
import { ArrowLeft, Heart, MessageCircle, Star, Trash2, Share } from "lucide-react";
import CommentsSection from "@/components/comments-section";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { renderMentions } from "@/lib/mentions";
import { useToast } from "@/hooks/use-toast";

interface PostUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface MediaItem {
  id?: string;
  title: string;
  imageUrl?: string;
  mediaType?: string;
  externalId?: string;
  externalSource?: string;
  rating?: number;
}

interface SocialPost {
  id: string;
  content: string;
  type: string;
  user: PostUser;
  timestamp: string;
  likes: number;
  comments: number;
  rating?: number;
  mediaItems?: MediaItem[];
  listData?: any;
  rankData?: any;
}

export default function PostDetail() {
  const { id: postId } = useParams<{ id: string }>();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const highlightCommentId = urlParams.get('comment');
  const [, setLocation] = useLocation();
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentVotes, setCommentVotes] = useState<Map<string, 'up' | 'down'>>(new Map());
  const scrollAttemptedRef = useRef(false);

  const { data: post, isLoading, error } = useQuery<SocialPost | null>({
    queryKey: ["post-detail", postId],
    queryFn: async () => {
      if (!postId || !session?.access_token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed?post_id=${postId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) return null;
      const data = await response.json();
      return data.posts?.[0] || null;
    },
    enabled: !!postId && !!session?.access_token,
  });

  const fetchComments = async (targetPostId: string) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments?post_id=${targetPostId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch comments');
    const result = await response.json();

    const transformComment = (comment: any): any => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      user: {
        id: comment.user_id,
        username: comment.username,
        displayName: comment.username,
        avatar: ''
      },
      upVoteCount: comment.upVoteCount || 0,
      downVoteCount: comment.downVoteCount || 0,
      currentUserVote: comment.currentUserVote || null,
      replies: (comment.replies || []).map(transformComment),
      media_metadata: comment.media_metadata || undefined,
    });

    return (result.comments || []).map(transformComment);
  };

  const commentMutation = useMutation({
    mutationFn: async ({ targetPostId, content, parentCommentId }: { targetPostId: string; content: string; parentCommentId?: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: targetPostId,
            content,
            parent_comment_id: parentCommentId || null,
          }),
        }
      );
      if (!response.ok) throw new Error('Failed to post comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
      if (postId) setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    },
  });

  const handleComment = (targetPostId: string, parentCommentId?: string, content?: string) => {
    const commentText = content || commentInputs[targetPostId]?.trim();
    if (!commentText) return;
    commentMutation.mutate({ targetPostId, content: commentText, parentCommentId });
  };

  const handleLike = async (targetPostId: string) => {
    if (!session?.access_token) return;
    const isLiked = likedPosts.has(targetPostId);
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(targetPostId); else next.add(targetPostId);
      return next;
    });

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-likes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ post_id: targetPostId, action: isLiked ? 'unlike' : 'like' }),
        }
      );
    } catch (err) {
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(targetPostId); else next.delete(targetPostId);
        return next;
      });
    }
  };

  const handleDeleteComment = async (commentId: string, targetPostId: string) => {
    if (!session?.access_token) return;
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment_id: commentId }),
        }
      );
      queryClient.invalidateQueries({ queryKey: ["post-comments", targetPostId] });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleVoteComment = async (commentId: string, direction: 'up' | 'down') => {
    if (!session?.access_token) return;
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/vote-comment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment_id: commentId, direction }),
        }
      );
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
    } catch (err) {
      console.error('Failed to vote on comment:', err);
    }
  };

  useEffect(() => {
    if (!highlightCommentId || scrollAttemptedRef.current) return;
    scrollAttemptedRef.current = true;

    let attempts = 0;
    const maxAttempts = 40;

    const interval = setInterval(() => {
      attempts++;
      const el = document.getElementById(`comment-${highlightCommentId}`);
      if (el) {
        clearInterval(interval);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background-color 0.5s ease-in-out';
        el.style.backgroundColor = 'rgba(147, 51, 234, 0.15)';
        el.style.borderRadius = '8px';
        setTimeout(() => { el.style.backgroundColor = 'transparent'; }, 2500);
        window.history.replaceState({}, '', `/post/${postId}`);
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [highlightCommentId, postId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-4">
          <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <p className="text-gray-500">Post not found</p>
          </div>
        </div>
      </div>
    );
  }

  const mediaItem = post.mediaItems?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" id={`post-${post.id}`}>
          <div className="p-4">
            {post.user && (
              <div className="flex items-center gap-3 mb-3">
                <Link href={`/user/${post.user.id}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer">
                    {post.user.avatar ? (
                      <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-sm">{post.user.displayName?.[0]?.toUpperCase() || post.user.username?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                </Link>
                <div className="flex-1">
                  <Link href={`/user/${post.user.id}`}>
                    <span className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer">
                      @{post.user.username}
                    </span>
                  </Link>
                  <p className="text-xs text-gray-400">{post.timestamp ? formatDate(post.timestamp) : ''}</p>
                </div>
              </div>
            )}

            {mediaItem && (
              <div className="flex gap-3 mb-3">
                {mediaItem.imageUrl && (
                  <Link href={`/media/${mediaItem.mediaType?.toLowerCase() || 'movie'}/${mediaItem.externalSource || 'tmdb'}/${mediaItem.externalId}`}>
                    <img
                      src={mediaItem.imageUrl}
                      alt={mediaItem.title}
                      className="w-16 h-24 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-90"
                    />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/media/${mediaItem.mediaType?.toLowerCase() || 'movie'}/${mediaItem.externalSource || 'tmdb'}/${mediaItem.externalId}`}>
                    <p className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer truncate">{mediaItem.title}</p>
                  </Link>
                  {post.rating && post.rating > 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= post.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {post.content && !post.content.toLowerCase().startsWith('rated ') && !post.content.toLowerCase().startsWith('added ') && (
              <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
                {renderMentions(post.content)}
              </div>
            )}

            <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-1.5 text-sm ${likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
              >
                <Heart size={16} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} />
                <span>{post.likes || 0}</span>
              </button>
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <MessageCircle size={16} />
                <span>{post.comments || 0}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 p-4">
            <CommentsSection
              postId={post.id}
              fetchComments={fetchComments}
              session={session}
              commentInput={commentInputs[post.id] || ''}
              onCommentInputChange={(value) => setCommentInputs(prev => ({ ...prev, [post.id]: value }))}
              onSubmitComment={(parentCommentId?: string, content?: string) => handleComment(post.id, parentCommentId, content)}
              isSubmitting={commentMutation.isPending}
              currentUserId={user?.id}
              onDeleteComment={(commentId) => handleDeleteComment(commentId, post.id)}
              onVoteComment={handleVoteComment}
              commentVotes={commentVotes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
