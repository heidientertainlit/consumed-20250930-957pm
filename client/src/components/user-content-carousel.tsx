import { useRef } from 'react';
import { Link } from 'wouter';
import { 
  Flame, Snowflake, MessageCircle, Heart, Star, 
  HelpCircle, BarChart3, Users, CheckCircle2, Trophy,
  Film, Music, Tv2, Book, Headphones, Gamepad2
} from 'lucide-react';

export interface UGCPost {
  id: string;
  type: 'hot_take' | 'ask_for_rec' | 'ask_for_recs' | 'poll' | 'rating' | 'review' | 'thought' | 'cast_approved' | 'rank' | 'finished' | 'general';
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
  rating?: number;
  likes?: number;
  comments?: number;
  fire_votes?: number;
  ice_votes?: number;
  options?: string[];
  optionVotes?: Array<{ option: string; count: number }>;
  timestamp?: string;
  pollId?: string;
}

interface UserContentCarouselProps {
  posts: UGCPost[];
  title?: string;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  likedPosts?: Set<string>;
  currentUserId?: string;
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
    case 'rating':
    case 'review':
      return { label: 'Review', iconColor: 'text-purple-500', icon: Star };
    case 'thought':
    case 'general':
      return { label: 'Thought', iconColor: 'text-gray-500', icon: MessageCircle };
    case 'cast_approved':
      return { label: 'Cast', iconColor: 'text-purple-500', icon: Users };
    case 'rank':
      return { label: 'Rank', iconColor: 'text-blue-500', icon: Trophy };
    case 'finished':
      return { label: 'Finished', iconColor: 'text-indigo-500', icon: CheckCircle2 };
    default:
      return { label: 'Post', iconColor: 'text-gray-500', icon: MessageCircle };
  }
}

function getMediaIcon(mediaType?: string) {
  switch (mediaType?.toLowerCase()) {
    case 'movie': return Film;
    case 'tv': case 'tv_show': case 'series': return Tv2;
    case 'music': case 'album': case 'song': case 'track': return Music;
    case 'book': return Book;
    case 'podcast': return Headphones;
    case 'game': case 'gaming': return Gamepad2;
    default: return Film;
  }
}

function UserContentCard({ post, onLike, onComment, isLiked }: { post: UGCPost; onLike?: (id: string) => void; onComment?: (id: string) => void; isLiked?: boolean }) {
  const typeInfo = getTypeLabel(post.type);
  const TypeIcon = typeInfo.icon;
  const MediaIcon = getMediaIcon(post.mediaType);
  const username = post.user?.displayName || post.user?.username || 'Someone';
  const avatarLetter = username[0]?.toUpperCase() || '?';

  const handleCardTap = () => {
    const postEl = document.getElementById(`post-${post.id}`);
    if (postEl) {
      postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postEl.classList.add('ring-2', 'ring-purple-300');
      setTimeout(() => postEl.classList.remove('ring-2', 'ring-purple-300'), 2000);
    }
    onComment?.(post.id);
  };

  return (
    <div
      className="flex-shrink-0 w-[260px] h-[240px] rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm cursor-pointer flex flex-col"
      onClick={handleCardTap}
    >
      <div className="p-4 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2.5 mb-3 flex-shrink-0">
          <Link href={`/user/${post.user?.id || ''}`} onClick={(e: any) => e.stopPropagation()}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold cursor-pointer flex-shrink-0">
              {post.user?.avatar ? (
                <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                avatarLetter
              )}
            </div>
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/user/${post.user?.id || ''}`} onClick={(e: any) => e.stopPropagation()}>
              <span className="text-sm font-semibold text-gray-900 hover:text-purple-600 cursor-pointer truncate block">
                {username}
              </span>
            </Link>
            <span className={`text-[11px] font-medium ${typeInfo.iconColor} flex items-center gap-1`}>
              <TypeIcon size={11} />
              {typeInfo.label}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {post.type === 'poll' ? (
            <div>
              {post.mediaTitle && (
                <p className="text-[10px] text-gray-500 mb-0.5 truncate">{post.mediaTitle}</p>
              )}
              <p className="text-sm font-bold text-gray-900 line-clamp-2 mb-2">{post.content}</p>
              {post.options && post.options.length > 0 && (
                <div className="flex gap-2">
                  {post.mediaImage && post.mediaImage.startsWith('http') && (
                    <img
                      src={post.mediaImage}
                      alt={post.mediaTitle || ''}
                      className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 space-y-1">
                    {post.options.slice(0, 3).map((opt, i) => (
                      <div key={i} className="bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-800 truncate">
                        {opt}
                      </div>
                    ))}
                    {post.options.length > 3 && (
                      <p className="text-[10px] text-gray-400 pl-1">+{post.options.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}
              {post.optionVotes && post.optionVotes.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
                  <Users size={11} />
                  <span>{post.optionVotes.reduce((sum, v) => sum + (v.count || 0), 0)} votes</span>
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

        <div className="flex items-center gap-3 pt-2.5 mt-auto border-t border-gray-50 flex-shrink-0">
          {post.type === 'hot_take' ? (
            <>
              <button
                className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600"
              >
                <Flame size={12} /> {post.fire_votes || 0}
              </button>
              <button
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-500"
              >
                <Snowflake size={12} /> {post.ice_votes || 0}
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onLike?.(post.id); }}
              className={`flex items-center gap-1 text-xs ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
            >
              <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
              <span>{post.likes || 0}</span>
            </button>
          )}
          <button
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-500"
          >
            <MessageCircle size={12} />
            <span>{post.comments || 0}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserContentCarousel({ posts, title, onLike, onComment, likedPosts, currentUserId }: UserContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!posts || posts.length === 0) return null;

  if (posts.length === 1) {
    return (
      <div className="mb-4">
        <UserContentCard 
          post={posts[0]} 
          onLike={onLike}
          onComment={onComment}
          isLiked={likedPosts?.has(posts[0].id)}
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
              onLike={onLike}
              onComment={onComment}
              isLiked={likedPosts?.has(post.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
