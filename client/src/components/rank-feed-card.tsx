import { useState, useEffect } from "react";
import { ArrowBigUp, ArrowBigDown, Film, Tv, Music, BookOpen, Gamepad2, Mic, Heart, MessageCircle, Trash2, Award, ChevronDown, ChevronUp, BarChart2 } from "lucide-react";
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
  onLikeComment?: (commentId: string) => void;
  likedComments?: Set<string>;
}

const getMediaIcon = (mediaType?: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'movie': return <Film size={11} className="text-purple-400" />;
    case 'tv':
    case 'show': return <Tv size={11} className="text-blue-400" />;
    case 'music':
    case 'album':
    case 'track': return <Music size={11} className="text-green-400" />;
    case 'book': return <BookOpen size={11} className="text-amber-500" />;
    case 'game': return <Gamepad2 size={11} className="text-red-400" />;
    case 'podcast': return <Mic size={11} className="text-orange-400" />;
    default: return null;
  }
};

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
  onLikeComment,
  likedComments = new Set()
}: RankFeedCardProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localItems, setLocalItems] = useState<RankItemWithVotes[]>(rank.items || []);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [localIsLiked, setLocalIsLiked] = useState(isLiked);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
    onError: (error: Error) => {
      toast({ title: "Vote Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleVote = (itemId: string, direction: 'up' | 'down') => {
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

  const previewItems = localItems.slice(0, 3);
  const hiddenCount = localItems.length - previewItems.length;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" data-testid={`rank-feed-card-${rank.id}`}>

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

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Link href={`/user/${author.id}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer flex-shrink-0 overflow-hidden">
              {author.profile_image_url
                ? <img src={author.profile_image_url} alt="" className="w-full h-full object-cover" />
                : author.user_name.charAt(0).toUpperCase()}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Link href={`/user/${author.id}`}>
                <span className="font-semibold text-sm text-gray-900 hover:text-purple-600 cursor-pointer leading-none">
                  {author.display_name || author.user_name}
                </span>
              </Link>
              {createdAt && <span className="text-gray-400 text-xs">· {formatTimeAgo(createdAt)}</span>}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">ranked a list</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 flex-shrink-0 flex items-center gap-1">
            <BarChart2 size={10} />
            Rank
          </span>
          {isOwner && (
            <button onClick={() => setShowDeleteDialog(true)} className="p-1 hover:bg-red-50 rounded-full transition-colors" data-testid={`delete-rank-${rank.id}`}>
              <Trash2 size={14} className="text-gray-300 hover:text-red-400 transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* Consumed badge */}
      {rank.user_id === '00000000-0000-0000-0000-000000000001' && (
        <div className="px-4 pb-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">
            <Award size={9} />Consumed
          </span>
        </div>
      )}

      {/* Rank title */}
      <div className="px-4 pb-1">
        <Link href={`/rank/${rank.id}`}>
          <h3 className="font-bold text-gray-900 text-base leading-snug hover:text-purple-700 cursor-pointer">{rank.title}</h3>
        </Link>
        {caption && caption.trim() && (
          <p className="text-sm text-gray-500 mt-0.5 leading-snug">{caption}</p>
        )}
      </div>

      {/* ── COLLAPSED GLIMPSE ── */}
      {!isExpanded && (
        <>
          {/* Loading skeleton */}
          {isLoadingItems && (
            <div className="px-4 pb-2 space-y-1.5">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex items-center gap-2.5 animate-pulse">
                  <div className="w-5 h-5 bg-gray-100 rounded flex-shrink-0" />
                  <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoadingItems && localItems.length === 0 && (
            <div className="mx-4 mb-3 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3">
              <BarChart2 size={14} className="text-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-400">No items added yet</span>
              {isOwner && (
                <Link href={`/rank/${rank.id}`}>
                  <span className="ml-auto text-xs text-purple-500 font-medium hover:text-purple-700">Add items →</span>
                </Link>
              )}
            </div>
          )}

          {/* Preview strip: top 3 items as compact rows */}
          {!isLoadingItems && localItems.length > 0 && (
            <button onClick={() => setIsExpanded(true)} className="w-full text-left">
              <div className="px-4 pb-2 space-y-1.5">
                {previewItems.map((item) => {
                  const mediaIcon = getMediaIcon(item.media_type);
                  return (
                    <div key={item.id} className="flex items-center gap-2.5">
                      <span className="w-5 h-5 flex items-center justify-center text-[11px] font-bold text-purple-600 bg-purple-50 rounded flex-shrink-0">
                        {item.position}
                      </span>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex items-center gap-1 min-w-0">
                        {mediaIcon && <span className="flex-shrink-0">{mediaIcon}</span>}
                        <span className="text-sm text-gray-800 font-medium truncate">{item.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Expand CTA */}
              <div className="mx-4 mb-3 flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-500">
                  {hiddenCount > 0 ? `+${hiddenCount} more · ` : ''}Vote to rank
                </span>
                <ChevronDown size={14} className="text-purple-500" />
              </div>
            </button>
          )}
        </>
      )}

      {/* ── EXPANDED FULL LIST ── */}
      {isExpanded && (
        <>
          <div className="divide-y divide-gray-50">
            {localItems.map((item) => {
              const isClickable = item.external_id && item.external_source;
              const mediaUrl = isClickable ? `/media/${item.media_type}/${item.external_source}/${item.external_id}` : null;
              const mediaIcon = getMediaIcon(item.media_type);
              const displayCreator = item.creator && item.creator.toLowerCase() !== 'unknown' ? item.creator : null;

              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors" data-testid={`rank-item-${item.id}`}>
                  <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-purple-600 bg-purple-50 rounded flex-shrink-0">
                    {item.position}
                  </span>
                  {item.image_url && (
                    isClickable
                      ? <Link href={mediaUrl!}><img src={item.image_url} alt={item.title} className="w-9 h-9 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" /></Link>
                      : <img src={item.image_url} alt={item.title} className="w-9 h-9 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {mediaIcon && <span className="flex-shrink-0">{mediaIcon}</span>}
                      {isClickable
                        ? <Link href={mediaUrl!}><p className="font-medium text-gray-900 text-sm truncate hover:text-purple-600 cursor-pointer">{item.title}</p></Link>
                        : <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>}
                    </div>
                    {displayCreator && <p className="text-[11px] text-gray-400 truncate">{displayCreator}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVote(item.id, 'up'); }}
                      disabled={voteMutation.isPending || isOwner}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${item.user_vote === 'up' ? 'text-green-500' : 'text-gray-300 hover:text-green-500'} ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                      data-testid={`vote-up-${item.id}`}
                    >
                      <ArrowBigUp size={17} fill={item.user_vote === 'up' ? 'currentColor' : 'none'} />
                      <span className="text-[11px] font-medium">{item.up_vote_count || 0}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVote(item.id, 'down'); }}
                      disabled={voteMutation.isPending || isOwner}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${item.user_vote === 'down' ? 'text-red-400' : 'text-gray-300 hover:text-red-400'} ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                      data-testid={`vote-down-${item.id}`}
                    >
                      <ArrowBigDown size={17} fill={item.user_vote === 'down' ? 'currentColor' : 'none'} />
                      <span className="text-[11px] font-medium">{item.down_vote_count || 0}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapse button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100 text-xs text-gray-400 hover:text-purple-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronUp size={13} />
            Show less
          </button>
        </>
      )}

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
            <Heart size={17} className={localIsLiked ? "text-red-400 fill-red-400" : ""} />
            <span className="text-sm font-medium text-gray-500">{localLikesCount}</span>
          </button>
          <button
            onClick={() => onToggleComments?.()}
            className="flex items-center gap-1.5 text-gray-400 hover:text-purple-500 transition-colors"
            data-testid={`comment-rank-${postId}`}
          >
            <MessageCircle size={17} />
            <span className="text-sm font-medium text-gray-500">{commentsCount}</span>
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
            onLikeComment={onLikeComment}
            likedComments={likedComments}
          />
        </div>
      )}
    </div>
  );
}
