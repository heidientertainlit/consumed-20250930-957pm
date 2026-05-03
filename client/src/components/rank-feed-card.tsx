import { useState, useEffect } from "react";
import { GripVertical, Heart, MessageCircle, Trash2, BarChart2, Users, Flag, Check, Loader2 } from "lucide-react";
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
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
const MAX_ITEMS = 10;

function PctBar({ upCount, downCount }: { upCount: number; downCount: number }) {
  const total = upCount + downCount;
  if (total === 0) {
    return (
      <div className="flex items-center gap-1 flex-shrink-0 min-w-[68px]">
        <span className="text-[10px] text-gray-300 font-semibold w-6 text-right">↑—</span>
        <div className="flex-1 h-1 bg-gray-100 rounded-full" />
        <span className="text-[10px] text-gray-300 font-semibold w-6">—↓</span>
      </div>
    );
  }
  const upPct = Math.round(upCount / total * 100);
  return (
    <div className="flex items-center gap-1 flex-shrink-0 min-w-[68px]">
      <span className="text-[10px] text-emerald-600 font-semibold w-6 text-right">↑{upPct}%</span>
      <div className="flex-1 h-1 bg-red-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${upPct}%` }} />
      </div>
      <span className="text-[10px] text-red-400 font-semibold w-6">{100 - upPct}%↓</span>
    </div>
  );
}

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
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const [localItems, setLocalItems] = useState<RankItemWithVotes[]>(rank.items || []);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportPostOpen, setReportPostOpen] = useState(false);
  const [myOrder, setMyOrder] = useState<RankItemWithVotes[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isOwner = user?.id === rank.user_id;
  const hasItems = !!(rank.items && rank.items.length > 0);

  useEffect(() => {
    const sorted = [...localItems]
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .slice(0, MAX_ITEMS);
    setMyOrder(sorted);
  }, [localItems]);

  useEffect(() => {
    const fetchItems = async () => {
      if (!hasItems && !hasFetched && rank.id && session?.access_token) {
        setHasFetched(true);
        setIsLoadingItems(true);
        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/get-user-ranks?user_id=${rank.user_id}`, {
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
  }, [rank.id, rank.user_id, hasItems, hasFetched, session?.access_token]);

  const submitOrderingMutation = useMutation({
    mutationFn: async (items: RankItemWithVotes[]) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const item_positions = items.map((item, index) => ({
        rank_item_id: item.id,
        position: index + 1
      }));
      const response = await fetch(`${SUPABASE_URL}/functions/v1/save-rank-ordering`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ rank_id: rank.id, item_positions }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save ranking');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.items) {
        setLocalItems(prev => prev.map(item => {
          const updated = data.items.find((i: any) => i.id === item.id);
          return updated
            ? { ...item, up_vote_count: updated.up_vote_count, down_vote_count: updated.down_vote_count }
            : item;
        }));
      }
      setHasSubmitted(true);
      toast({ title: 'Ranking saved!', description: 'Your personal ranking has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save ranking', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ranks').delete().eq('id', rank.id);
      if (error) throw new Error(error.message || 'Failed to delete rank');
      if (postId) await supabase.from('social_posts').delete().eq('id', postId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleDelete = () => { setShowDeleteDialog(false); deleteMutation.mutate(); };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(myOrder);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setMyOrder(items);
    setHasSubmitted(false);
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`rank-feed-card-${rank.id}`}>

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
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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
        ) : isOwner ? (
          /* Owner: read-only list with pct bars */
          <div className="space-y-1.5">
            {myOrder.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2.5 py-2 px-3 bg-gray-50 rounded-lg">
                <span className="w-5 h-5 flex items-center justify-center text-[11px] font-bold rounded bg-orange-100 text-orange-700 flex-shrink-0">
                  {item.position || idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  {item.creator && item.creator.toLowerCase() !== 'unknown' && (
                    <p className="text-xs text-gray-500 truncate">{item.creator}</p>
                  )}
                </div>
                <PctBar upCount={item.up_vote_count || 0} downCount={item.down_vote_count || 0} />
              </div>
            ))}
          </div>
        ) : (
          /* Everyone else: drag & drop, always shown, capped at 10 */
          <>
            <div className="mb-2 flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-1.5">
              <GripVertical size={12} />
              Drag to set your personal order
            </div>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`rank-drag-${rank.id}`}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5">
                    {myOrder.map((item, idx) => (
                      <Draggable key={item.id} draggableId={item.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                              snapshot.isDragging
                                ? 'bg-purple-50 border-purple-300 shadow-md'
                                : 'bg-gray-50 border-transparent'
                            }`}
                          >
                            <div {...provided.dragHandleProps} className="text-gray-300 hover:text-purple-400 cursor-grab active:cursor-grabbing flex-shrink-0">
                              <GripVertical size={16} />
                            </div>
                            <span className="w-5 h-5 flex items-center justify-center text-[11px] font-bold rounded bg-purple-100 text-purple-600 flex-shrink-0">
                              {idx + 1}
                            </span>
                            {item.image_url && (
                              <img src={item.image_url} alt={item.title} className="w-6 h-8 rounded object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                              {item.creator && item.creator.toLowerCase() !== 'unknown' && (
                                <p className="text-xs text-gray-400 truncate">{item.creator}</p>
                              )}
                            </div>
                            <PctBar upCount={item.up_vote_count || 0} downCount={item.down_vote_count || 0} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <div className="mt-2">
              <button
                onClick={() => submitOrderingMutation.mutate(myOrder)}
                disabled={submitOrderingMutation.isPending}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors font-medium disabled:opacity-60 ${
                  hasSubmitted
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {submitOrderingMutation.isPending ? (
                  <><Loader2 size={11} className="animate-spin" /> Saving...</>
                ) : hasSubmitted ? (
                  <><Check size={11} /> Submitted — Re-submit</>
                ) : (
                  <><Check size={11} /> Submit My Ranking</>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer: like & comment */}
      {postId && (
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4">
          <button
            onClick={() => {
              if (!session?.access_token) { toast({ title: 'Sign in to like', variant: 'destructive' }); return; }
              setLocalIsLiked(!localIsLiked);
              setLocalLikesCount(prev => localIsLiked ? prev - 1 : prev + 1);
              onLike?.(postId);
            }}
            className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors"
            data-testid={`like-rank-${postId}`}
          >
            <Heart size={16} className={localIsLiked ? 'text-red-400 fill-red-400' : ''} />
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
