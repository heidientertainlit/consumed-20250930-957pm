import { useState } from 'react';
import { Flame, Snowflake, MessageCircle, Trash2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { QuickAddModal } from './quick-add-modal';

interface HotTakeFeedCardProps {
  post: {
    id: string;
    user?: {
      id: string;
      username: string;
      displayName?: string;
      avatar_url?: string;
    };
    content: string;
    media_title?: string;
    media_type?: string;
    image_url?: string;
    fire_votes?: number;
    ice_votes?: number;
    comments_count?: number;
    created_at?: string;
  };
  onComment?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  currentUserId?: string;
}

export function HotTakeFeedCard({ post, onComment, onDelete, currentUserId }: HotTakeFeedCardProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [fireVotes, setFireVotes] = useState(post.fire_votes || 0);
  const [iceVotes, setIceVotes] = useState(post.ice_votes || 0);
  const [userVote, setUserVote] = useState<'fire' | 'ice' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const handleVote = async (voteType: 'fire' | 'ice') => {
    if (!session || isVoting) return;
    setIsVoting(true);

    try {
      if (userVote === voteType) {
        if (voteType === 'fire') {
          setFireVotes(prev => Math.max(0, prev - 1));
        } else {
          setIceVotes(prev => Math.max(0, prev - 1));
        }
        setUserVote(null);
      } else {
        if (userVote === 'fire') {
          setFireVotes(prev => Math.max(0, prev - 1));
        } else if (userVote === 'ice') {
          setIceVotes(prev => Math.max(0, prev - 1));
        }
        
        if (voteType === 'fire') {
          setFireVotes(prev => prev + 1);
        } else {
          setIceVotes(prev => prev + 1);
        }
        setUserVote(voteType);
      }

      const updateData = voteType === 'fire' 
        ? { fire_votes: userVote === 'fire' ? fireVotes - 1 : fireVotes + 1 }
        : { ice_votes: userVote === 'ice' ? iceVotes - 1 : iceVotes + 1 };

      await supabase
        .from('social_posts')
        .update(updateData)
        .eq('id', post.id);

    } catch (error) {
      console.error('Vote error:', error);
      toast({
        title: "Couldn't vote",
        description: "Please try again.",
        variant: "destructive",
      });
    }
    setIsVoting(false);
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  return (
    <Card className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center overflow-hidden">
            {post.user?.avatar_url ? (
              <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Flame className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                {post.user?.displayName || post.user?.username || 'Anonymous'}
              </span>
              <span className="text-xs text-gray-400">{formatTime(post.created_at)}</span>
            </div>
            {post.media_title && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-purple-600 font-medium">🎬 {post.media_title}</span>
              </div>
            )}
          </div>
          {currentUserId && post.user?.id === currentUserId && onDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              aria-label="Delete hot take"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <p className="text-gray-900 text-sm mb-4 leading-relaxed">{post.content}</p>

        {post.image_url && (
          <div className="mb-4 flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <img 
              src={post.image_url} 
              alt={post.media_title || ''} 
              className="w-16 h-20 rounded-lg object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              {post.media_title && (
                <p className="font-medium text-gray-900 text-sm line-clamp-2">{post.media_title}</p>
              )}
              {post.media_type && (
                <p className="text-xs text-purple-600 capitalize">{post.media_type}</p>
              )}
            </div>
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Add to list"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleVote('fire')}
              disabled={isVoting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                userVote === 'fire'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-orange-100'
              }`}
            >
              <Flame size={16} className={userVote === 'fire' ? 'text-white' : 'text-orange-500'} />
              <span>{fireVotes}</span>
            </button>

            <button
              onClick={() => handleVote('ice')}
              disabled={isVoting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                userVote === 'ice'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-blue-100'
              }`}
            >
              <Snowflake size={16} className={userVote === 'ice' ? 'text-white' : 'text-blue-500'} />
              <span>{iceVotes}</span>
            </button>
          </div>

          <button
            onClick={() => onComment?.(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 active:bg-gray-200"
          >
            <MessageCircle size={16} />
            <span>{post.comments_count || 0}</span>
          </button>
        </div>
      </div>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        preSelectedMedia={post.image_url ? {
          title: post.media_title || '',
          mediaType: post.media_type || 'movie',
          imageUrl: post.image_url,
        } : null}
      />
    </Card>
  );
}
