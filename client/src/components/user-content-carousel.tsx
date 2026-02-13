import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { 
  Flame, Snowflake, MessageCircle, Heart, Star, ChevronRight, 
  HelpCircle, BarChart3, Users, BookOpen, CheckCircle2, Trophy,
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
  likedPosts?: Set<string>;
  currentUserId?: string;
}

function getTypeLabel(type: string): { label: string; color: string; icon: any } {
  switch (type) {
    case 'hot_take':
      return { label: 'Hot Take', color: 'from-orange-500 to-red-500', icon: Flame };
    case 'ask_for_rec':
    case 'ask_for_recs':
      return { label: 'Asking for Recs', color: 'from-purple-600 to-indigo-600', icon: HelpCircle };
    case 'poll':
      return { label: 'Poll', color: 'from-blue-500 to-cyan-500', icon: BarChart3 };
    case 'rating':
    case 'review':
      return { label: 'Review', color: 'from-amber-500 to-yellow-500', icon: Star };
    case 'thought':
    case 'general':
      return { label: 'Thought', color: 'from-gray-600 to-gray-700', icon: MessageCircle };
    case 'cast_approved':
      return { label: 'Cast', color: 'from-purple-500 to-amber-500', icon: Users };
    case 'rank':
      return { label: 'Rank', color: 'from-emerald-500 to-teal-500', icon: Trophy };
    case 'finished':
      return { label: 'Finished', color: 'from-green-500 to-emerald-500', icon: CheckCircle2 };
    default:
      return { label: 'Post', color: 'from-gray-500 to-gray-600', icon: MessageCircle };
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

function UserContentCard({ post, onLike, isLiked }: { post: UGCPost; onLike?: (id: string) => void; isLiked?: boolean }) {
  const typeInfo = getTypeLabel(post.type);
  const TypeIcon = typeInfo.icon;
  const MediaIcon = getMediaIcon(post.mediaType);
  const username = post.user?.displayName || post.user?.username || 'Someone';
  const avatarLetter = username[0]?.toUpperCase() || '?';

  return (
    <div className="flex-shrink-0 w-[280px] rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className={`bg-gradient-to-r ${typeInfo.color} px-3 py-1.5 flex items-center gap-1.5`}>
        <TypeIcon size={12} className="text-white" />
        <span className="text-xs font-medium text-white">{typeInfo.label}</span>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/user/${post.user?.id || ''}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold cursor-pointer flex-shrink-0">
              {post.user?.avatar ? (
                <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                avatarLetter
              )}
            </div>
          </Link>
          <Link href={`/user/${post.user?.id || ''}`}>
            <span className="text-xs font-medium text-gray-700 hover:text-purple-600 cursor-pointer truncate">
              @{post.user?.username || 'unknown'}
            </span>
          </Link>
        </div>

        {post.type === 'poll' ? (
          <div className="mb-2">
            {post.mediaTitle && (
              <p className="text-[10px] text-gray-500 mb-0.5">{post.mediaTitle}</p>
            )}
            <p className="text-sm font-bold text-gray-900 line-clamp-2">{post.content}</p>
          </div>
        ) : post.mediaImage && post.mediaImage.startsWith('http') ? (
          <div className="flex gap-2.5 mb-2">
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
              <p className="text-xs text-gray-600 line-clamp-2">{post.content}</p>
            </div>
          </div>
        ) : (
          <div className="mb-2">
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
            <p className="text-sm text-gray-800 line-clamp-3">{post.content}</p>
          </div>
        )}

        {post.type === 'poll' && post.options && post.options.length > 0 && (
          <div className="mb-2">
            <div className="flex gap-2">
              {post.mediaImage && post.mediaImage.startsWith('http') && (
                <img
                  src={post.mediaImage}
                  alt={post.mediaTitle || ''}
                  className="w-16 h-20 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-1 space-y-1.5">
                {post.options.map((opt, i) => (
                  <div key={i} className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-full px-3 py-1.5 text-xs font-medium text-white truncate">
                    {opt}
                  </div>
                ))}
              </div>
            </div>
            {post.optionVotes && post.optionVotes.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <Users size={11} />
                <span>{post.optionVotes.reduce((sum, v) => sum + (v.count || 0), 0)} votes</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          {post.type === 'hot_take' ? (
            <>
              <span className="flex items-center gap-1 text-xs text-orange-500">
                <Flame size={12} /> {post.fire_votes || 0}
              </span>
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <Snowflake size={12} /> {post.ice_votes || 0}
              </span>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onLike?.(post.id); }}
              className={`flex items-center gap-1 text-xs ${isLiked ? 'text-red-500' : 'text-gray-400'}`}
            >
              <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
              <span>{post.likes || 0}</span>
            </button>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MessageCircle size={12} />
            <span>{post.comments || 0}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function UserContentCarousel({ posts, title, onLike, likedPosts, currentUserId }: UserContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!posts || posts.length === 0) return null;

  if (posts.length === 1) {
    return (
      <div className="mb-4">
        <UserContentCard 
          post={posts[0]} 
          onLike={onLike}
          isLiked={likedPosts?.has(posts[0].id)}
        />
      </div>
    );
  }

  return (
    <div className="mb-4">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
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
              isLiked={likedPosts?.has(post.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
