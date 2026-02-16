import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { 
  Flame, Snowflake, MessageCircle, Heart, Star, 
  HelpCircle, BarChart3, Users, CheckCircle2, Trophy,
  Film, Music, Tv2, Book, Headphones, Gamepad2, X, Send, User, Trash2
} from 'lucide-react';

export interface UGCPost {
  id: string;
  type: 'hot_take' | 'ask_for_rec' | 'ask_for_recs' | 'poll' | 'predict' | 'rating' | 'review' | 'thought' | 'cast_approved' | 'rank' | 'finished' | 'general';
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  content: string;
  mediaTitle?: string;
  mediaType?: string;
  mediaImage?: string;
  externalId?: string;
  externalSource?: string;
  rating?: number;
  likes?: number;
  comments?: number;
  fire_votes?: number;
  ice_votes?: number;
  options?: string[];
  optionVotes?: Array<{ option: string; count: number; percentage?: number }>;
  timestamp?: string;
  pollId?: string;
  userHasVoted?: boolean;
  userVotedOption?: string;
}

interface UserContentCarouselProps {
  posts: UGCPost[];
  title?: string;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onFireVote?: (postId: string) => void;
  onIceVote?: (postId: string) => void;
  onVotePrediction?: (poolId: string, option: string) => void;
  likedPosts?: Set<string>;
  currentUserId?: string;
  activeCommentPostId?: string | null;
  onCloseComments?: () => void;
  fetchComments?: (postId: string) => Promise<any[]>;
  onSubmitComment?: (postId: string, content: string) => void;
  isSubmitting?: boolean;
  session?: any;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onDeletePost?: (postId: string) => void;
}

function getTypeLabel(type: string): { label: string; iconColor: string; icon: any } {
  switch (type) {
    case 'hot_take':
      return { label: 'Hot Take', iconColor: 'text-orange-500', icon: Flame };
    case 'ask_for_rec':
    case 'ask_for_recs':
      return { label: 'Asking for Recs', iconColor: 'text-purple-500', icon: HelpCircle };
    case 'poll':
      return { label: 'Poll', iconColor: 'text-blue-500', icon: BarChart3 };
    case 'predict':
      return { label: 'Prediction', iconColor: 'text-indigo-500', icon: BarChart3 };
    case 'cast_approved':
      return { label: 'Cast', iconColor: 'text-amber-500', icon: Trophy };
    case 'rank':
      return { label: 'Ranked', iconColor: 'text-emerald-500', icon: Trophy };
    case 'finished':
      return { label: 'Finished', iconColor: 'text-green-500', icon: CheckCircle2 };
    case 'review':
      return { label: 'Review', iconColor: 'text-yellow-500', icon: Star };
    case 'rating':
      return { label: 'Rating', iconColor: 'text-yellow-500', icon: Star };
    case 'thought':
      return { label: 'Thought', iconColor: 'text-blue-400', icon: MessageCircle };
    default:
      return { label: 'Post', iconColor: 'text-gray-400', icon: MessageCircle };
  }
}

function getMediaIcon(mediaType?: string) {
  switch (mediaType?.toLowerCase()) {
    case 'movie': return Film;
    case 'tv': case 'show': return Tv2;
    case 'music': case 'song': case 'album': return Music;
    case 'book': return Book;
    case 'podcast': return Headphones;
    case 'game': return Gamepad2;
    default: return Film;
  }
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

function InlineComments({ postId, fetchComments, onSubmitComment, isSubmitting, session, currentUserId, onDeleteComment }: {
  postId: string;
  fetchComments?: (postId: string) => Promise<any[]>;
  onSubmitComment?: (postId: string, content: string) => void;
  isSubmitting?: boolean;
  session?: any;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
}) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const hasFetched = useRef(false);
  const fetchRef = useRef(fetchComments);
  fetchRef.current = fetchComments;

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    if (fetchRef.current) {
      setLoading(true);
      fetchRef.current(postId).then(data => {
        setComments(data || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [postId]);

  const handleSubmit = () => {
    if (!inputValue.trim() || !onSubmitComment) return;
    onSubmitComment(postId, inputValue.trim());
    setInputValue('');
    setTimeout(() => {
      if (fetchComments) {
        fetchComments(postId).then(data => setComments(data || []));
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-2">
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
          {comments.slice(0, 5).map((comment: any) => {
            const username = comment.user?.username || comment.user?.displayName || 'User';
            const content = comment.content || '';
            let displayContent = content;
            try {
              const parsed = JSON.parse(content);
              if (parsed.title) {
                displayContent = `Recommends: ${parsed.title}`;
              }
            } catch { }

            return (
              <div key={comment.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={12} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-800">{username}</span>
                    <span className="text-[10px] text-gray-400">{formatTimeAgo(comment.createdAt)}</span>
                    {currentUserId && comment.user?.id === currentUserId && onDeleteComment && (
                      <button
                        onClick={() => {
                          onDeleteComment(String(comment.id), postId);
                          setComments(prev => prev.filter(c => c.id !== comment.id));
                        }}
                        className="text-gray-400 hover:text-red-500 ml-auto p-1 min-h-[24px] min-w-[24px] flex items-center justify-center"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-tight">{displayContent}</p>
                </div>
              </div>
            );
          })}
          {comments.length > 5 && (
            <p className="text-[10px] text-gray-400 text-center">+{comments.length - 5} more</p>
          )}
        </div>
      )}

      {session && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Add comment..."
            className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-purple-300 placeholder-gray-400"
          />
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isSubmitting}
            className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function UserContentCard({ post, onLike, onComment, onFireVote, onIceVote, onVotePrediction, isLiked, isCommentsActive, onCloseComments, fetchComments, onSubmitComment, isSubmitting, session, currentUserId, onDeleteComment, onDeletePost }: { 
  post: UGCPost; 
  onLike?: (id: string) => void; 
  onComment?: (id: string) => void; 
  onFireVote?: (id: string) => void;
  onIceVote?: (id: string) => void;
  onVotePrediction?: (poolId: string, option: string) => void;
  isLiked?: boolean;
  isCommentsActive?: boolean;
  onCloseComments?: () => void;
  fetchComments?: (postId: string) => Promise<any[]>;
  onSubmitComment?: (postId: string, content: string) => void;
  isSubmitting?: boolean;
  session?: any;
  currentUserId?: string;
  onDeleteComment?: (commentId: string, postId: string) => void;
  onDeletePost?: (postId: string) => void;
}) {
  const [localVoted, setLocalVoted] = useState<string | null>(null);
  const typeInfo = getTypeLabel(post.type);
  const TypeIcon = typeInfo.icon;
  const MediaIcon = getMediaIcon(post.mediaType);
  const username = post.user?.displayName || post.user?.username || 'Someone';
  const avatarLetter = username[0]?.toUpperCase() || '?';

  return (
    <div className={`flex-shrink-0 rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col ${isCommentsActive ? 'w-[300px]' : (post.type === 'poll' || post.type === 'predict') && post.options?.length ? 'w-[260px] min-h-[240px]' : 'w-[260px] h-[240px]'}`}>
      <div className="p-4 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2.5 mb-3 flex-shrink-0">
          <Link href={`/user/${post.user?.id || ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold cursor-pointer flex-shrink-0">
              {post.user?.avatar ? (
                <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                avatarLetter
              )}
            </div>
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/user/${post.user?.id || ''}`}>
              <span className="text-sm font-semibold text-gray-900 hover:text-purple-600 cursor-pointer truncate block">
                {username}
              </span>
            </Link>
            <span className={`text-[11px] font-medium ${typeInfo.iconColor} flex items-center gap-1`}>
              <TypeIcon size={11} />
              {typeInfo.label}
            </span>
          </div>
          {currentUserId && post.user?.id === currentUserId && onDeletePost && !isCommentsActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeletePost(post.id); }}
              className="text-gray-300 hover:text-red-500 p-1"
            >
              <Trash2 size={14} />
            </button>
          )}
          {isCommentsActive && onCloseComments && (
            <button onClick={onCloseComments} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={16} />
            </button>
          )}
        </div>

        <div className={`${isCommentsActive ? '' : 'flex-1'} min-h-0 overflow-hidden`}>
            {(post.type === 'poll' || post.type === 'predict') ? (
              <div>
                {post.mediaTitle && (
                  <p className="text-[10px] text-gray-500 mb-0.5 truncate">{post.mediaTitle}</p>
                )}
                <p className="text-sm font-bold text-gray-900 line-clamp-2 mb-2">{post.content}</p>
                {post.options && post.options.length > 0 && (() => {
                  const hasVoted = localVoted !== null || post.userHasVoted;
                  const votedOption = localVoted || post.userVotedOption;
                  const totalVotes = post.optionVotes?.reduce((sum, v) => sum + (v.count || 0), 0) || 0;
                  const adjustedTotal = localVoted && !post.userHasVoted ? totalVotes + 1 : totalVotes;

                  return (
                    <div className="flex gap-2">
                      {post.mediaImage && post.mediaImage.startsWith('http') && (
                        <img
                          src={post.mediaImage}
                          alt={post.mediaTitle || ''}
                          className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 space-y-1.5">
                        {post.options.slice(0, 4).map((opt, i) => {
                          const voteData = post.optionVotes?.find(v => v.option === opt);
                          const rawCount = voteData?.count || 0;
                          const count = localVoted === opt && !post.userHasVoted ? rawCount + 1 : rawCount;
                          const pct = adjustedTotal > 0 ? Math.round((count / adjustedTotal) * 100) : 0;
                          const isSelected = votedOption === opt;

                          if (hasVoted) {
                            return (
                              <div key={i} className="relative rounded-full overflow-hidden h-7">
                                <div
                                  className={`absolute inset-0 rounded-full ${isSelected ? 'bg-purple-100' : 'bg-gray-100'}`}
                                />
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between px-3 h-full">
                                  <span className={`text-xs font-medium truncate ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                                    {isSelected && <CheckCircle2 size={10} className="inline mr-1" />}
                                    {opt}
                                  </span>
                                  <span className={`text-xs font-semibold ml-1 flex-shrink-0 ${isSelected ? 'text-purple-700' : 'text-gray-500'}`}>{pct}%</span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocalVoted(opt);
                                onVotePrediction?.(post.pollId || post.id, opt);
                              }}
                              className="w-full bg-gray-100 hover:bg-purple-50 hover:border-purple-300 border border-transparent rounded-full px-3 py-1.5 text-xs font-medium text-gray-800 truncate text-left transition-colors active:bg-purple-100"
                            >
                              {opt}
                            </button>
                          );
                        })}
                        {post.options.length > 4 && (
                          <p className="text-[10px] text-gray-400 pl-1">+{post.options.length - 4} more</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {(localVoted || post.userHasVoted) && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
                    <Users size={11} />
                    <span>{(post.optionVotes?.reduce((sum, v) => sum + (v.count || 0), 0) || 0) + (localVoted && !post.userHasVoted ? 1 : 0)} votes</span>
                  </div>
                )}
              </div>
            ) : post.mediaImage && post.mediaImage.startsWith('http') ? (
              <div className="flex gap-2.5">
                <img
                  src={post.mediaImage}
                  alt={post.mediaTitle || ''}
                  className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  {post.mediaTitle && (
                    <p className="text-xs font-semibold text-gray-900 line-clamp-1 mb-0.5">{post.mediaTitle}</p>
                  )}
                  {post.rating && post.rating > 0 && (
                    <div className="flex items-center gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={10} className={s <= post.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-600 line-clamp-3">{post.content}</p>
                </div>
              </div>
            ) : (
              <div>
                {post.mediaTitle && (
                  <p className="text-xs font-semibold text-gray-900 line-clamp-1 mb-1">
                    <MediaIcon size={11} className="inline mr-1 text-gray-400" />
                    {post.mediaTitle}
                  </p>
                )}
                {post.rating && post.rating > 0 && (
                  <div className="flex items-center gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={10} className={s <= post.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-800 line-clamp-4">{post.content}</p>
              </div>
            )}
          </div>

        {isCommentsActive && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <InlineComments
              postId={post.id}
              fetchComments={fetchComments}
              onSubmitComment={onSubmitComment}
              isSubmitting={isSubmitting}
              session={session}
              currentUserId={currentUserId}
              onDeleteComment={onDeleteComment}
            />
          </div>
        )}

        {!isCommentsActive && (
          <div className="flex items-center gap-3 pt-2.5 mt-auto border-t border-gray-50 flex-shrink-0" style={{ touchAction: 'manipulation' }}>
            {post.type === 'hot_take' ? (
              <>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFireVote?.(post.id); }}
                  onTouchEnd={(e) => { e.stopPropagation(); }}
                  className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 active:scale-110 transition-transform py-1 px-1 -ml-1 min-h-[32px]"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Flame size={14} /> {post.fire_votes || 0}
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIceVote?.(post.id); }}
                  onTouchEnd={(e) => { e.stopPropagation(); }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-500 active:scale-110 transition-transform py-1 px-1 min-h-[32px]"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Snowflake size={14} /> {post.ice_votes || 0}
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLike?.(post.id); }}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                className={`flex items-center gap-1 text-xs ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'} active:scale-110 transition-transform py-1 px-1 -ml-1 min-h-[32px]`}
                style={{ touchAction: 'manipulation' }}
              >
                <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                <span>{post.likes || 0}</span>
              </button>
            )}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onComment?.(post.id); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onComment?.(post.id); }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-500 active:scale-110 transition-transform py-1 px-1 min-h-[32px]"
              style={{ touchAction: 'manipulation' }}
            >
              <MessageCircle size={14} />
              <span>{post.comments || 0}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function UserContentCarousel({ posts, title, onLike, onComment, onFireVote, onIceVote, onVotePrediction, likedPosts, currentUserId, activeCommentPostId, onCloseComments, fetchComments, onSubmitComment, isSubmitting, session, onDeleteComment, onDeletePost }: UserContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!posts || posts.length === 0) return null;

  const cardProps = {
    onLike,
    onComment,
    onFireVote,
    onIceVote,
    onVotePrediction,
    onCloseComments,
    fetchComments,
    onSubmitComment,
    isSubmitting,
    session,
    currentUserId,
    onDeleteComment,
    onDeletePost,
  };

  if (posts.length === 1) {
    return (
      <div className="mb-4">
        <UserContentCard 
          post={posts[0]} 
          isLiked={likedPosts?.has(posts[0].id)}
          isCommentsActive={activeCommentPostId === posts[0].id}
          {...cardProps}
        />
      </div>
    );
  }

  return (
    <div className="mb-4">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <span className="text-xs text-gray-400">{posts.length} posts</span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {posts.map((post) => (
          <div key={`ugc-${post.id}`} className="snap-start">
            <UserContentCard
              post={post}
              isLiked={likedPosts?.has(post.id)}
              isCommentsActive={activeCommentPostId === post.id}
              {...cardProps}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
