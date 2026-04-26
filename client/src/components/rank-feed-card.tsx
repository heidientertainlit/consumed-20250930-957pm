import { useState, useEffect } from "react";
import { ArrowBigUp, ArrowBigDown, Heart, MessageCircle, Trash2, BarChart2, Users, Flag } from "lucide-react";
import { ReportSheet } from "@/components/report-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import CommentsSection from "@/components/comments-section";

interface RankItemWithVotes {
  id: string;
  position: number;
  title: string;
  media_type?: string;
  creator?: string;
  image_url?: string;
  external_id?: string;
  external_source?: string;
  up_vote_count?: number;
  down_vote_count?: number;
  user_vote?: 'up' | 'down' | null;
}

interface RankData {
  id: string;
  title: string;
  user_id: string;
  visibility: string;
  items: RankItemWithVotes[];
}

interface RankFeedCardProps {
  rank: RankData;
  author: {
    id: string;
    user_name: string;
    display_name?: string;
    profile_image_url?: string;
  };
  caption?: string;
  createdAt?: string;
  postId?: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  onLike?: (postId: string) => void;
  expandedComments?: boolean;
  onToggleComments?: () => void;
  fetchComments?: (postId: string) => Promise<any[]>;
  commentInput?: string;
  onCommentInputChange?: (value: string) => void;
  onSubmitComment?: (parentCommentId?: string, content?: string) => void;
  isSubmitting?: boolean;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onReportComment?: (commentId: string, userId: string, userName: string) => void;
  onLikeComment?: (commentId: string) => void;
  onVoteComment?: (commentId: string, direction: 'up' | 'down') => void;
  likedComments?: Set<string>;
  commentVotes?: Map<string, 'up' | 'down'>;
}

const PREVIEW_COUNT = 3;

export default function RankFeedCard({
  rank,
  author,
  caption,
  createdAt,
  postId,
  likesCount = 0,
  commentsCount = 0,
  isLiked = false,
  onLike,
  expandedComments,
  onToggleComments,
  fetchComments,
  commentInput = '',
  onCommentInputChange,
  onSubmitComment,
  isSubmitting = false,
  currentUserId,
  onDeleteComment,
  onReportComment,
  onLikeComment,
  onVoteComment,
  likedComments = new Set(),
  commentVotes = new Map()
}: RankFeedCardProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localItems, setLocalItems] = useState<RankItemWithVotes[]>(rank.items || []);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportPostOpen, setReportPostOpen] = useState(false);

  const isOwner = user?.id === rank.user_id;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasItems = !!(rank.items && rank.items.length > 0);

  useEffect(() => {
    const fetchItems = async () => {
      if (!hasItems && !hasFetched && rank.id && session?.access_token) {
        setHasFetched(true);
        setIsLoadingItems(true);
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/get-user-ranks?user_id=${rank.user_id}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': supabaseAnonKey,
            },
          });
          if (response.ok) {
            const data = await response.json();
            const foundRank = data.ranks?.find((r: any) => r.id === rank.id);
            if (foundRank?.items?.length > 0) setLocalItems(foundRank.items);
          }
        } catch (error) {
          console.error('Failed to fetch rank items:', error);
        } finally {
          setIsLoadingItems(false);
        }
      }
    };
    fetchItems();
  }, [rank.id, rank.user_id, hasItems, hasFetched, session?.access_token, supabaseUrl, supabaseAnonKey]);

  const voteMutation = useMutation({
    mutationFn: async ({ rankItemId, direction }: { rankItemId: string; direction: 'up' | 'down' }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/vote-rank-item`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ rankItemId, direction }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setLocalItems(prev => prev.map(item =>
        item.id === data.data.rankItemId
          ? { ...item, up_vote_count: data.data.upVoteCount, down_vote_count: data.data.downVoteCount, user_vote: data.data.userVote }
          : item
      ));
    },
    onError: (error: Error) => {
      toast({ title: "Vote Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleVote = (e: React.MouseEvent, itemId: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    if (!session?.access_token) { toast({ title: "Sign in to vote", variant: "destructive" }); return; }
    if (isOwner) { toast({ title: "Can't vote on your own rank", variant: "destructive" }); return; }
    voteMutation.mutate({ rankItemId: itemId, direction });
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ranks').delete().eq('id', rank.id);
      if (error) throw new Error(error.message || 'Failed to delete rank');
      if (postId) {
        await supabase.from('social_posts').delete().eq('id', postId);
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDelete = () => { setShowDeleteDialog(false); deleteMutation.mutate(); };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const displayItems = showAll ? localItems : localItems.slice(0, PREVIEW_COUNT);
  const hiddenCount = localItems.length - PREVIEW_COUNT;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`rank-feed-card-${rank.id}`}>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rank?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{rank.title}" and all its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-rank">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-4">
        {/* Type pills */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-full uppercase tracking-wide">
            <BarChart2 size={9} />
            RANK
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            <Users size={10} />
            Community
          </span>
          {createdAt && (
            <span className="text-xs text-gray-400 ml-auto">{formatTimeAgo(createdAt)}</span>
          )}
          {isOwner && (
            <button onClick={() => setShowDeleteDialog(true)} className="p-1 hover:bg-red-50 rounded-full transition-colors ml-1" data-testid={`delete-rank-${rank.id}`}>
              <Trash2 size={14} className="text-gray-300 hover:text-red-400 transition-colors" />
            </button>
          )}
          {!isOwner && (
            <button onClick={() => setReportPostOpen(true)} className="p-1 hover:bg-red-50 rounded-full transition-colors ml-1" title="Report">
              <Flag size={13} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Author */}
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/user/${author.id}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer flex-shrink-0 overflow-hidden">
              {author.profile_image_url
                ? <img src={author.profile_image_url} alt="" className="w-full h-full object-cover" />
                : (author.display_name || author.user_name || 'U')[0].toUpperCase()}
            </div>
          </Link>
          <div>
            <Link href={`/user/${author.id}`}>
              <span className="text-sm font-medium text-gray-900 hover:text-purple-600 cursor-pointer">
                {author.display_name ? author.display_name : `@${author.user_name}`}
              </span>
            </Link>
            <span className="text-xs text-gray-500 ml-2">shared a ranked list</span>
          </div>
        </div>

        {/* Rank title */}
        <div className="mb-3">
          <Link href={`/rank/${rank.id}`}>
            <h3 className="font-semibold text-gray-900 hover:text-purple-700 cursor-pointer leading-snug">{rank.title}</h3>
          </Link>
          {caption && caption.trim() && (
            <p className="text-xs text-gray-500 mt-0.5">{caption}</p>
          )}
        </div>

        {/* Items */}
        {isLoadingItems ? (
          <div className="space-y-2">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg animate-pulse">
                <div className="w-6 h-6 bg-gray-200 rounded flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : localItems.length === 0 ? (
          <div className="flex items-center gap-2 py-3 px-3 bg-gray-50 rounded-lg">
            <BarChart2 size={14} className="text-gray-300 flex-shrink-0" />
            <span className="text-xs text-gray-400">No items added yet</span>
            {isOwner && (
              <Link href={`/rank/${rank.id}`}>
                <span className="ml-auto text-xs text-purple-500 font-medium hover:text-purple-700">Add items →</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                <span className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded bg-orange-100 text-orange-700 flex-shrink-0">
                  {item.position || idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  {item.creator && item.creator.toLowerCase() !== 'unknown' && (
                    <p className="text-xs text-gray-500 truncate">{item.creator}</p>
                  )}
                </div>
                {item.id && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => handleVote(e, item.id, 'up')}
                      disabled={voteMutation.isPending || isOwner}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${item.user_vote === 'up' ? 'text-green-500' : 'text-gray-400 hover:text-green-500'} ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                      data-testid={`vote-up-${item.id}`}
                    >
                      <ArrowBigUp size={14} fill={item.user_vote === 'up' ? 'currentColor' : 'none'} />
                      <span className="text-[10px] font-medium">{item.up_vote_count || 0}</span>
                    </button>
                    <button
                      onClick={(e) => handleVote(e, item.id, 'down')}
                      disabled={voteMutation.isPending || isOwner}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${item.user_vote === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-red-500'} ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                      data-testid={`vote-down-${item.id}`}
                    >
                      <ArrowBigDown size={14} fill={item.user_vote === 'down' ? 'currentColor' : 'none'} />
                      <span className="text-[10px] font-medium">{item.down_vote_count || 0}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full text-xs text-purple-600 text-center py-1 hover:text-purple-800 transition-colors"
              >
                +{hiddenCount} more items
              </button>
            )}
            {showAll && localItems.length > PREVIEW_COUNT && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full text-xs text-gray-400 text-center py-1 hover:text-gray-600 transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer: like & comment */}
      {postId && (
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4">
          <button
            onClick={() => {
              if (!session?.access_token) { toast({ title: "Sign in to like", variant: "destructive" }); return; }
              setLocalIsLiked(!localIsLiked);
              setLocalLikesCount(prev => localIsLiked ? prev - 1 : prev + 1);
              onLike?.(postId);
            }}
            className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors"
            data-testid={`like-rank-${postId}`}
          >
            <Heart size={16} className={localIsLiked ? "text-red-400 fill-red-400" : ""} />
            <span className="text-xs font-medium text-gray-500">{localLikesCount}</span>
          </button>
          <button
            onClick={() => onToggleComments?.()}
            className="flex items-center gap-1.5 text-gray-400 hover:text-purple-500 transition-colors"
            data-testid={`comment-rank-${postId}`}
          >
            <MessageCircle size={16} />
            <span className="text-xs font-medium text-gray-500">{commentsCount}</span>
          </button>
        </div>
      )}

      {/* Comments section */}
      {expandedComments && fetchComments && onCommentInputChange && onSubmitComment && (
        <div className="px-4 pb-3 pt-2 border-t border-gray-100">
          <CommentsSection
            postId={postId!}
            fetchComments={fetchComments}
            session={session}
            commentInput={commentInput}
            onCommentInputChange={onCommentInputChange}
            onSubmitComment={onSubmitComment}
            isSubmitting={isSubmitting}
            currentUserId={currentUserId}
            onDeleteComment={onDeleteComment}
            onReportComment={onReportComment}
            onLikeComment={onLikeComment}
            onVoteComment={onVoteComment}
            likedComments={likedComments}
            commentVotes={commentVotes}
          />
        </div>
      )}

      <ReportSheet
        isOpen={reportPostOpen}
        onClose={() => setReportPostOpen(false)}
        contentType="post"
        contentId={postId || rank.id}
        reportedUserId={author.id}
        reportedUserName={author.user_name}
      />
    </div>
  );
}
