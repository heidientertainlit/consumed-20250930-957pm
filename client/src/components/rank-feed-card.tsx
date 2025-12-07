import { useState } from "react";
import { ChevronUp, ChevronDown, Trophy, User } from "lucide-react";
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

export default function RankFeedCard({ rank, author, caption, createdAt }: RankFeedCardProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localItems, setLocalItems] = useState<RankItemWithVotes[]>(rank.items || []);
  
  const isOwner = user?.id === rank.user_id;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

  const voteMutation = useMutation({
    mutationFn: async ({ rankItemId, direction }: { rankItemId: string; direction: 'up' | 'down' }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/vote-rank-item`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
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

  const displayItems = localItems.slice(0, 10);

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
                author.display_name?.charAt(0) || author.user_name.charAt(0).toUpperCase()
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/profile/${author.user_name}`}>
                <span className="font-semibold text-gray-900 hover:underline cursor-pointer">
                  {author.display_name || author.user_name}
                </span>
              </Link>
              <span className="text-gray-500 text-sm">@{author.user_name}</span>
              {createdAt && <span className="text-gray-400 text-sm">· {formatTimeAgo(createdAt)}</span>}
            </div>
            <p className="text-xs text-gray-500">shared a ranked list</p>
          </div>
          <Trophy className="text-purple-500" size={20} />
        </div>
        
        {caption && (
          <p className="mt-2 text-gray-800 text-sm">{caption}</p>
        )}
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
        {displayItems.map((item, index) => {
          const netScore = (item.up_vote_count || 0) - (item.down_vote_count || 0);
          const isClickable = item.external_id && item.external_source;
          const mediaUrl = isClickable ? `/media/${item.media_type}/${item.external_source}/${item.external_id}` : null;
          
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
                      className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity pointer-events-none" 
                    />
                  </Link>
                ) : (
                  <img src={item.image_url} alt={item.title} className="w-10 h-10 rounded object-cover" />
                )
              )}
              
              {/* Title & Creator */}
              <div className="flex-1 min-w-0">
                {isClickable ? (
                  <Link href={mediaUrl!}>
                    <p className="font-medium text-gray-900 text-sm truncate hover:text-purple-600 cursor-pointer">{item.title}</p>
                  </Link>
                ) : (
                  <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                )}
                {item.creator && (
                  <p className="text-xs text-gray-500 truncate">{item.creator}</p>
                )}
              </div>
              
              {/* Net Score (optional display) */}
              {netScore !== 0 && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${netScore > 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                  {netScore > 0 ? '+' : ''}{netScore}
                </span>
              )}
              
              {/* Vote Arrows */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); handleVote(item.id, 'up'); }}
                  disabled={voteMutation.isPending || isOwner}
                  className={`p-1 rounded transition-colors ${
                    item.user_vote === 'up' 
                      ? 'text-green-600 bg-green-100' 
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid={`vote-up-${item.id}`}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleVote(item.id, 'down'); }}
                  disabled={voteMutation.isPending || isOwner}
                  className={`p-1 rounded transition-colors ${
                    item.user_vote === 'down' 
                      ? 'text-red-600 bg-red-100' 
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid={`vote-down-${item.id}`}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Full Rank Link */}
      {rank.items.length > 10 && (
        <Link href={`/rank/${rank.id}`}>
          <div className="px-4 py-2 text-center border-t border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
            <span className="text-sm text-purple-600 font-medium">View all {rank.items.length} items →</span>
          </div>
        </Link>
      )}
    </div>
  );
}
