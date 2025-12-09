import { useState, useEffect } from "react";
import { ArrowBigUp, ArrowBigDown, Trophy, Film, Tv, Music, BookOpen, Gamepad2, Mic } from "lucide-react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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
}

const getMediaIcon = (mediaType?: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'movie':
      return <Film size={12} className="text-purple-500" />;
    case 'tv':
    case 'show':
      return <Tv size={12} className="text-blue-500" />;
    case 'music':
    case 'album':
    case 'track':
      return <Music size={12} className="text-green-500" />;
    case 'book':
      return <BookOpen size={12} className="text-amber-600" />;
    case 'game':
      return <Gamepad2 size={12} className="text-red-500" />;
    case 'podcast':
      return <Mic size={12} className="text-orange-500" />;
    default:
      return null;
  }
};

export default function RankFeedCard({ rank, author, caption, createdAt }: RankFeedCardProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localItems, setLocalItems] = useState<RankItemWithVotes[]>(rank.items || []);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  const isOwner = user?.id === rank.user_id;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Use stable boolean for dependency to prevent infinite loops
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
            if (foundRank?.items?.length > 0) {
              setLocalItems(foundRank.items);
            }
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
          ? { 
              ...item, 
              up_vote_count: data.data.upVoteCount, 
              down_vote_count: data.data.downVoteCount,
              user_vote: data.data.userVote
            }
          : item
      ));
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Vote Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleVote = (itemId: string, direction: 'up' | 'down') => {
    if (!session?.access_token) {
      toast({ title: "Sign in to vote", variant: "destructive" });
      return;
    }
    if (isOwner) {
      toast({ title: "Can't vote on your own rank", variant: "destructive" });
      return;
    }
    voteMutation.mutate({ rankItemId: itemId, direction });
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const displayItems = showAll ? localItems : localItems.slice(0, 3);
  const hasMoreItems = localItems.length > 3;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={`rank-feed-card-${rank.id}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${author.user_name}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer">
              {author.profile_image_url ? (
                <img src={author.profile_image_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                author.user_name.charAt(0).toUpperCase()
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/profile/${author.user_name}`}>
                <span className="font-semibold text-gray-900 hover:underline cursor-pointer">
                  @{author.user_name}
                </span>
              </Link>
              {createdAt && <span className="text-gray-400 text-sm">· {formatTimeAgo(createdAt)}</span>}
            </div>
            <p className="text-xs text-gray-500">shared a ranked list</p>
          </div>
          <Trophy className="text-purple-500" size={20} />
        </div>
      </div>

      {/* Rank Title */}
      <Link href={`/rank/${rank.id}`}>
        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100 cursor-pointer hover:from-purple-100 hover:to-blue-100 transition-colors">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Trophy size={16} className="text-purple-600" />
            {rank.title}
          </h3>
        </div>
      </Link>

      {/* Minimalist Rank List */}
      <div className="divide-y divide-gray-50">
        {displayItems.map((item) => {
          const isClickable = item.external_id && item.external_source;
          const mediaUrl = isClickable ? `/media/${item.media_type}/${item.external_source}/${item.external_id}` : null;
          const mediaIcon = getMediaIcon(item.media_type);
          const displayCreator = item.creator && item.creator.toLowerCase() !== 'unknown' ? item.creator : null;
          
          return (
            <div 
              key={item.id} 
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
              data-testid={`rank-item-${item.id}`}
            >
              {/* Position Number */}
              <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-purple-600 bg-purple-100 rounded">
                {item.position}
              </span>
              
              {/* Image */}
              {item.image_url && (
                isClickable ? (
                  <Link href={mediaUrl!}>
                    <img 
                      src={item.image_url} 
                      alt={item.title} 
                      className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                    />
                  </Link>
                ) : (
                  <img src={item.image_url} alt={item.title} className="w-10 h-10 rounded object-cover" />
                )
              )}
              
              {/* Title with Media Icon & Creator */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {mediaIcon}
                  {isClickable ? (
                    <Link href={mediaUrl!}>
                      <p className="font-medium text-gray-900 text-sm truncate hover:text-purple-600 cursor-pointer">{item.title}</p>
                    </Link>
                  ) : (
                    <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                  )}
                </div>
                {displayCreator && (
                  <p className="text-xs text-gray-500 truncate">{displayCreator}</p>
                )}
              </div>
              
              {/* Side-by-side Vote Arrows with separate counts */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleVote(item.id, 'up'); }}
                  disabled={voteMutation.isPending || isOwner}
                  className={`flex items-center gap-0.5 p-0.5 transition-colors ${
                    item.user_vote === 'up' 
                      ? 'text-green-500' 
                      : 'text-gray-300 hover:text-green-500'
                  } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid={`vote-up-${item.id}`}
                >
                  <ArrowBigUp size={18} fill={item.user_vote === 'up' ? 'currentColor' : 'none'} />
                  <span className="text-xs font-medium">{item.up_vote_count || 0}</span>
                </button>
                
                <button
                  onClick={(e) => { e.stopPropagation(); handleVote(item.id, 'down'); }}
                  disabled={voteMutation.isPending || isOwner}
                  className={`flex items-center gap-0.5 p-0.5 transition-colors ${
                    item.user_vote === 'down' 
                      ? 'text-red-500' 
                      : 'text-gray-300 hover:text-red-500'
                  } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid={`vote-down-${item.id}`}
                >
                  <ArrowBigDown size={18} fill={item.user_vote === 'down' ? 'currentColor' : 'none'} />
                  <span className="text-xs font-medium">{item.down_vote_count || 0}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show All / Show Less Button */}
      {hasMoreItems && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-4 py-2 text-center border-t border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
          data-testid="toggle-show-all"
        >
          <span className="text-sm text-purple-600 font-medium">
            {showAll ? 'Show less' : `Show all ${localItems.length} items`}
          </span>
        </button>
      )}
    </div>
  );
}
