import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, Star, Heart, MessageCircle, Plus, User, Send, Loader2, X } from "lucide-react";
import { Link } from "wouter";
import { QuickAddListSheet } from "./quick-add-list-sheet";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

function getFallbackImageUrl(externalId?: string, externalSource?: string): string | null {
  if (!externalId || !externalSource) return null;
  
  if (externalSource === 'googlebooks') {
    return `https://books.google.com/books/content?id=${externalId}&printsec=frontcover&img=1&zoom=1`;
  }
  return null;
}

function getImageUrl(imageUrl?: string, externalId?: string, externalSource?: string): string | null {
  // Return existing valid image
  if (imageUrl && imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // Fallback for Google Books if we have the ID
  if (externalSource === 'googlebooks' && externalId) {
    return `https://books.google.com/books/content?id=${externalId}&printsec=frontcover&img=1&zoom=1`;
  }
  
  return null;
}

interface RatingPost {
  id: string;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  mediaItems?: Array<{
    id: string;
    title: string;
    creator?: string;
    imageUrl?: string;
    mediaType?: string;
    externalId?: string;
    externalSource?: string;
  }>;
  rating?: number;
  content?: string;
  timestamp?: string;
  type?: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  created_at?: string;
  username?: string;
  user_id?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
}

interface SwipeableRatingCardsProps {
  posts: RatingPost[];
  onLike?: (postId: string) => void;
  likedPosts?: Set<string>;
}

export default function SwipeableRatingCards({ posts, onLike, likedPosts }: SwipeableRatingCardsProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showQuickRate, setShowQuickRate] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [fetchedData, setFetchedData] = useState<Record<string, { image?: string; creator?: string }>>({});
  
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const fetchedPostIds = useRef<Set<string>>(new Set());
  
  // Fetch missing images and creator info dynamically via media-search
  useEffect(() => {
    const fetchMissingData = async () => {
      for (const post of posts) {
        const media = post.mediaItems?.[0];
        if (!media) continue;
        
        if (fetchedPostIds.current.has(post.id)) continue;
        
        // Skip if already fetched WITH creator info
        const existingData = fetchedData[post.id];
        if (existingData?.image && existingData?.creator) continue;
        
        const isSpotify = media.externalSource === 'spotify';
        const isBook = media.externalSource === 'open_library' || media.externalSource === 'googlebooks';
        const isTmdb = media.externalSource === 'tmdb';
        
        const hasValidImage = media.imageUrl && media.imageUrl.startsWith('http');
        const hasValidCreator = media.creator && !media.creator.includes('Unknown');
        
        if (!isSpotify && hasValidImage && hasValidCreator) continue;
        if (!media.title) continue;
        
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          const searchTitle = media.title.split(':')[0].trim().slice(0, 30);
          
          const searchType = isBook ? 'book' : isTmdb ? (media.mediaType === 'tv' ? 'tv' : 'movie') : isSpotify ? 'podcast' : null;
          
          const response = await fetch(
            `${supabaseUrl}/functions/v1/media-search`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ query: searchTitle, ...(searchType ? { type: searchType } : {}) })
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            const results = data.results || [];
            
            let imageUrl: string | undefined;
            let creatorName: string | undefined;
            
            if (isSpotify) {
              const showWithCreator = results.find((r: any) => 
                r.type === 'podcast' && r.media_subtype === 'show' && 
                r.creator && !r.creator.includes('Unknown')
              );
              if (showWithCreator) {
                creatorName = showWithCreator.creator;
                imageUrl = showWithCreator.poster_url || showWithCreator.image;
              }
              if (!imageUrl) {
                const firstShow = results.find((r: any) => r.type === 'podcast' && r.media_subtype === 'show');
                imageUrl = firstShow?.poster_url || firstShow?.image || results[0]?.poster_url || results[0]?.image;
              }
              
              if (!creatorName && media.title.includes('Playbook')) {
                const showResponse = await fetch(
                  `${supabaseUrl}/functions/v1/media-search`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${anonKey}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: 'Aspire with Emma Grede' })
                  }
                );
                if (showResponse.ok) {
                  const showData = await showResponse.json();
                  const show = showData.results?.find((r: any) => 
                    r.type === 'podcast' && r.media_subtype === 'show' &&
                    r.creator && !r.creator.includes('Unknown')
                  );
                  if (show) creatorName = show.creator;
                }
              }
            } else {
              const mediaType = media.externalSource === 'open_library' ? 'book' : 
                                media.externalSource === 'tmdb' ? (media.mediaType || 'movie') :
                                media.externalSource === 'youtube' ? 'video' : null;
              const normalizedTitle = media.title.toLowerCase().trim();
              
              const titleMatch = results.find((r: any) => 
                r.title?.toLowerCase().trim() === normalizedTitle
              );
              if (titleMatch) {
                creatorName = titleMatch.creator && !titleMatch.creator.includes('Unknown') ? titleMatch.creator : undefined;
                imageUrl = titleMatch.poster_url || titleMatch.image;
              } else if (mediaType) {
                const typeMatch = results.find((r: any) => r.type === mediaType);
                if (typeMatch) {
                  creatorName = typeMatch.creator && !typeMatch.creator.includes('Unknown') ? typeMatch.creator : undefined;
                  imageUrl = typeMatch.poster_url || typeMatch.image;
                }
              }
              if (!imageUrl && !creatorName) {
                const closeMatch = results.find((r: any) => 
                  r.title?.toLowerCase().includes(normalizedTitle.split(':')[0].trim())
                );
                if (closeMatch) {
                  creatorName = closeMatch.creator && !closeMatch.creator.includes('Unknown') ? closeMatch.creator : undefined;
                  imageUrl = closeMatch.poster_url || closeMatch.image;
                }
              }
              if (!imageUrl) {
                const fallback = mediaType ? results.find((r: any) => r.type === mediaType) : results[0];
                imageUrl = fallback?.poster_url || fallback?.image || results[0]?.poster_url || results[0]?.image;
              }
            }
            
            fetchedPostIds.current.add(post.id);
            if (imageUrl || creatorName) {
              setFetchedData(prev => ({
                ...prev,
                [post.id]: {
                  image: imageUrl,
                  creator: creatorName
                }
              }));
            }
          }
        } catch (e) {
          fetchedPostIds.current.add(post.id);
        }
      }
    };
    
    fetchMissingData();
  }, [posts]);

  useEffect(() => {
    setImageLoaded(false);
    setShowComments(false);
    setComments([]);
    setShowQuickRate(false);
    setUserRating(null);
  }, [currentIndex]);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];
  const mediaItem = currentPost?.mediaItems?.[0];
  
  // Debug: log what data we're receiving
  if (mediaItem && !mediaItem.imageUrl) {
    console.log('📷 Rating card media item missing imageUrl:', {
      title: mediaItem.title,
      externalId: mediaItem.externalId,
      externalSource: mediaItem.externalSource,
      allFields: Object.keys(mediaItem)
    });
  }
  
  const dynamicData = fetchedData[currentPost?.id || ''];
  
  const originalImageValid = mediaItem?.imageUrl && mediaItem.imageUrl.startsWith('http');
  const originalCreatorValid = mediaItem?.creator && !mediaItem.creator.includes('Unknown') && mediaItem.creator.length > 0;
  
  const resolvedImageUrl = originalImageValid 
    ? mediaItem.imageUrl 
    : (dynamicData?.image || getImageUrl(mediaItem?.imageUrl, mediaItem?.externalId, mediaItem?.externalSource));
  
  const resolvedCreator = originalCreatorValid
    ? mediaItem.creator
    : (dynamicData?.creator || undefined);
  
  const media = mediaItem ? {
    ...mediaItem,
    imageUrl: resolvedImageUrl || mediaItem.imageUrl,
    creator: resolvedCreator || mediaItem.creator
  } : undefined;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    // Limit the offset for visual feedback
    setSwipeOffset(Math.max(-80, Math.min(80, diff)));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  const handleSwipe = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40; // Lower threshold for easier swiping

    if (diff > threshold && currentIndex < posts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (diff < -threshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const fillPercent = Math.min(100, Math.max(0, (rating - star + 1) * 100));
          return (
            <div key={star} className="relative">
              <Star size={16} className="text-gray-300" />
              <div 
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillPercent}%` }}
              >
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getMediaLink = () => {
    if (!media?.externalId || !media?.externalSource) return null;
    const mediaType = media.mediaType || 'movie';
    return `/media/${mediaType}/${media.externalSource}/${media.externalId}`;
  };

  const isPostLiked = likedPosts?.has(currentPost.id) || currentPost.isLiked;
  
  const getDisplayContent = () => {
    const content = currentPost.content?.trim() || '';
    if (!content) return null;
    if (content.startsWith('Added ') || content.startsWith('"Added ')) return null;
    if (content.match(/^"?Added .+ to .+"?$/i)) return null;
    return content;
  };

  const displayContent = getDisplayContent();

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (media) {
      setSelectedMedia({
        title: media.title || 'Unknown',
        mediaType: media.mediaType || 'movie',
        imageUrl: media.imageUrl,
        externalId: media.externalId,
        externalSource: media.externalSource,
      });
      setAddSheetOpen(true);
    }
  };

  const fetchComments = async () => {
    if (!session?.access_token) return;
    setLoadingComments(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/social-feed-comments?post_id=${currentPost.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!showComments) {
      setShowComments(true);
      await fetchComments();
    } else {
      setShowComments(false);
    }
  };

  const submitComment = async () => {
    if (!session?.access_token || !commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/social-feed-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_id: currentPost.id,
          content: commentInput.trim()
        })
      });
      if (response.ok) {
        setCommentInput("");
        await fetchComments();
        toast({ title: "Comment added!" });
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      toast({ title: "Failed to add comment", variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  const submitQuickRating = async (rating: number) => {
    if (!session?.access_token || !media) return;
    setSubmittingRating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      // First, add to Finished list (marks as consumed)
      try {
        // Get user's Finished list
        const listsResponse = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (listsResponse.ok) {
          const listsData = await listsResponse.json();
          const finishedList = listsData.lists?.find((l: any) => 
            l.title?.toLowerCase().includes('finished') || l.name?.toLowerCase().includes('finished')
          );
          if (finishedList) {
            await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                list_id: finishedList.id,
                media_title: media.title,
                media_type: media.mediaType || 'movie',
                media_image_url: media.imageUrl || '',
                media_external_id: media.externalId,
                media_external_source: media.externalSource || 'tmdb',
              })
            });
          }
        }
      } catch (listErr) {
        console.log('Could not add to finished list:', listErr);
      }

      // Then submit the rating
      const response = await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          media_external_id: media.externalId,
          media_external_source: media.externalSource || 'tmdb',
          media_title: media.title,
          media_type: media.mediaType || 'movie',
          rating: rating,
        })
      });
      if (response.ok) {
        setUserRating(rating);
        setShowQuickRate(false);
        setHoveredStar(0);
      }
    } catch (err) {
      console.error('Failed to submit rating:', err);
      toast({ title: "Failed to submit rating", variant: "destructive" });
    } finally {
      setSubmittingRating(false);
    }
  };

  const hasValidImage = media?.imageUrl && media.imageUrl.startsWith('http');

  return (
    <>
      <div className="mb-4">
        <div 
          className="relative bg-white rounded-2xl border border-gray-100 shadow-sm transition-transform duration-100"
          style={{ transform: `translateX(${swipeOffset}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex">
            {/* Left column: Poster + Actions */}
            <div className="shrink-0 flex flex-col">
              <Link href={getMediaLink() || '#'}>
                {hasValidImage ? (
                  <div className="relative w-28 min-h-[120px] rounded-l-2xl overflow-hidden flex-shrink-0">
                    {!imageLoaded && (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-purple-100 animate-pulse" />
                    )}
                    <img 
                      src={media.imageUrl} 
                      alt={media.title || ''} 
                      className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() => setImageLoaded(true)}
                      loading="eager"
                    />
                  </div>
                ) : getFallbackImageUrl(media.externalId, media.externalSource) ? (
                  <div className="relative w-28 min-h-[120px] rounded-l-2xl overflow-hidden flex-shrink-0">
                    {!imageLoaded && (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-purple-100 animate-pulse" />
                    )}
                    <img 
                      src={getFallbackImageUrl(media.externalId, media.externalSource)!} 
                      alt={media.title || ''} 
                      className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      loading="eager"
                    />
                  </div>
                ) : (
                  <div className="w-28 min-h-[120px] bg-gradient-to-br from-purple-200 to-purple-100 flex items-center justify-center rounded-l-2xl flex-shrink-0">
                    <span className="text-gray-500 text-xs text-center px-2">No image</span>
                  </div>
                )}
              </Link>
              {/* Actions under poster */}
              <div className="relative flex items-center justify-start gap-3 py-2 px-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onLike?.(currentPost.id);
                  }}
                  className="flex items-center gap-0.5 group"
                >
                  <Heart 
                    size={16} 
                    className={`transition-colors ${isPostLiked ? 'text-red-500 fill-red-500' : 'text-gray-400 group-hover:text-red-400'}`}
                  />
                  <span className="text-xs text-gray-500">{currentPost.likesCount || 0}</span>
                </button>
                <button 
                  onClick={handleCommentClick}
                  className="flex items-center gap-0.5 group"
                >
                  <MessageCircle 
                    size={16} 
                    className={`transition-colors ${showComments ? 'text-purple-600 fill-purple-100' : 'text-gray-400 group-hover:text-purple-500'}`}
                  />
                  <span className="text-xs text-gray-500">{currentPost.commentsCount || comments.length || 0}</span>
                </button>
                <button 
                  onClick={handleAddClick}
                  className="group"
                >
                  <Plus size={16} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                </button>
                {session && (
                  userRating ? (
                    <div className="flex items-center gap-0.5">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-yellow-600 font-medium">{userRating}</span>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickRate(!showQuickRate);
                      }}
                      className="group"
                      title="Rate this"
                    >
                      <Star size={16} className={showQuickRate ? "text-yellow-400" : "text-gray-400 group-hover:text-yellow-400 transition-colors"} />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Right column: Content */}
            <div className="flex-1 py-3 pr-3 pl-0 flex flex-col min-w-0">
              {/* User info */}
              <div className="flex items-center gap-1.5 mb-1">
                <Link href={`/profile/${currentPost.user?.id}`} className="shrink-0">
                  {currentPost.user?.avatar ? (
                    <img 
                      src={currentPost.user.avatar} 
                      alt="" 
                      className="w-6 h-6 rounded-full object-cover border border-purple-100"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                      <User size={12} className="text-purple-600" />
                    </div>
                  )}
                </Link>
                <div className="flex items-baseline gap-1 min-w-0">
                  <Link href={`/profile/${currentPost.user?.id}`}>
                    <span className="text-sm font-medium text-purple-600 truncate">
                      {currentPost.user?.displayName || currentPost.user?.username || 'User'}
                    </span>
                  </Link>
                  <span className="text-xs text-gray-400 shrink-0">
                    {currentPost.rating ? 'rated' : 'reviewed'}
                  </span>
                </div>
              </div>

              {/* Media title */}
              <Link href={getMediaLink() || '#'}>
                <h3 className="font-medium text-gray-900 text-sm line-clamp-2 hover:text-purple-600 leading-tight">
                  {media?.title || 'Unknown'}
                </h3>
              </Link>
              
              {/* Creator/Author + Media Type */}
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                {media?.creator && (
                  <span className="text-xs text-gray-500 truncate">
                    {media.creator.split('|')[0].trim()}
                  </span>
                )}
                {media?.mediaType && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 whitespace-nowrap">
                    {media.mediaType === 'tv' ? 'TV' : 
                     media.mediaType === 'movie' ? 'Movie' :
                     media.mediaType === 'Book' || media.externalSource === 'googlebooks' || media.externalSource === 'open_library' ? 'Book' :
                     media.externalSource === 'spotify' ? 'Podcast' :
                     media.mediaType.charAt(0).toUpperCase() + media.mediaType.slice(1)}
                  </span>
                )}
                {!media?.mediaType && media?.externalSource && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 whitespace-nowrap">
                    {media.externalSource === 'googlebooks' || media.externalSource === 'open_library' ? 'Book' :
                     media.externalSource === 'tmdb' ? 'Movie' :
                     media.externalSource === 'spotify' ? 'Podcast' :
                     media.externalSource === 'youtube' ? 'Video' : ''}
                  </span>
                )}
              </div>
              
              {/* Rating stars */}
              {currentPost.rating && (
                <div className="mb-1">
                  {renderStars(currentPost.rating)}
                </div>
              )}

              {/* Review/thought content */}
              {displayContent && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  "{displayContent}"
                </p>
              )}

              {/* Navigation arrows */}
              <div className="flex items-center justify-end gap-1 mt-auto">
                  {currentIndex > 0 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrev();
                      }}
                      className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft size={14} className="text-gray-500" />
                    </button>
                  )}
                  <span className="text-xs text-gray-400 px-1">
                    {currentIndex + 1}/{posts.length}
                  </span>
                  {currentIndex < posts.length - 1 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNext();
                      }}
                      className="p-1.5 rounded-full bg-purple-50 hover:bg-purple-100 transition-colors"
                    >
                      <ChevronRight size={14} className="text-purple-600" />
                    </button>
                  )}
                </div>
              </div>
          </div>

          {/* Rating stars overlay - positioned at card level for full visibility */}
          {showQuickRate && !userRating && session && (
            <div className="absolute bottom-12 left-4 z-50">
              <div className="flex items-center bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-2">
                {submittingRating ? (
                  <Loader2 className="animate-spin text-purple-500" size={18} />
                ) : (
                  <>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className="relative w-10 h-10 flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                          const rating = isLeftHalf ? star - 0.5 : star;
                          submitQuickRating(rating);
                        }}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                          setHoveredStar(isLeftHalf ? star - 0.5 : star);
                        }}
                        onMouseLeave={() => setHoveredStar(0)}
                      >
                        <div className="relative">
                          <Star size={28} className="text-gray-300" />
                          <div 
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: `${Math.min(100, Math.max(0, (hoveredStar - star + 1) * 100))}%` }}
                          >
                            <Star size={28} className="text-yellow-400 fill-yellow-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickRate(false);
                      }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Inline Comments Section - Full width */}
          {showComments && (
            <div className="border-t border-gray-100 p-4 bg-gray-50/50">
              {loadingComments ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="animate-spin text-purple-500" size={20} />
                </div>
              ) : (
                <>
                  {/* Existing comments */}
                  {comments.length > 0 ? (
                    <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                      {comments.slice(0, 5).map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                            <User size={14} className="text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-purple-600 mr-1">
                              {comment.username || comment.user?.displayName || comment.user?.username || 'User'}
                            </span>
                            <span className="text-sm text-gray-700">{comment.content}</span>
                          </div>
                        </div>
                      ))}
                      {comments.length > 5 && (
                        <p className="text-xs text-gray-400 text-center">+ {comments.length - 5} more comments</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center mb-3">No comments yet. Be the first!</p>
                  )}

                  {/* Comment input */}
                  {session ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:border-purple-400"
                        onKeyPress={(e) => e.key === 'Enter' && submitComment()}
                      />
                      <button
                        onClick={submitComment}
                        disabled={!commentInput.trim() || submittingComment}
                        className="p-2 rounded-full bg-purple-600 text-white disabled:opacity-50"
                      >
                        {submittingComment ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center">Sign in to comment</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Dots indicator */}
          {posts.length > 1 && (
            <div className="flex justify-center gap-1.5 py-2 bg-gray-50/50">
              {posts.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-purple-600 w-4' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add to list sheet */}
      <QuickAddListSheet 
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        media={selectedMedia}
      />
    </>
  );
}
