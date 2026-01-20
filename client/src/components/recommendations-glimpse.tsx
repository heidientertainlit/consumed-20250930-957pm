import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { Sparkles, ChevronRight, Plus, Star, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface RecommendedItem {
  id: string;
  title: string;
  imageUrl?: string;
  type: string;
  reason?: string;
  externalSource?: string;
}

export function RecommendationsGlimpse() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [starredItems, setStarredItems] = useState<Set<string>>(new Set());

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['feed-recommendations'],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 6 })
      });
      
      if (!response.ok) return [];
      const data = await response.json();
      const recs = data.recommendations || data.items || [];
      return recs.slice(0, 6).map((item: any) => ({
        id: item.id || item.external_id,
        title: item.title,
        imageUrl: item.imageUrl || item.image_url || item.poster_url,
        type: item.type || item.media_type || 'movie',
        reason: item.reason,
        externalSource: item.external_source || 'tmdb'
      })) as RecommendedItem[];
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000
  });

  const handleAddToList = async (item: RecommendedItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (addedItems.has(item.id)) return;
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/add-to-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          list_name: 'Want to Watch',
          media_title: item.title,
          media_type: item.type,
          external_id: item.id,
          external_source: item.externalSource || 'tmdb',
          image_url: item.imageUrl
        })
      });
      
      if (response.ok) {
        setAddedItems(prev => new Set(prev).add(item.id));
        toast({ title: 'Added to Want to Watch!' });
      }
    } catch (err) {
      console.error('Failed to add:', err);
    }
  };

  const handleStar = (item: RecommendedItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setStarredItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
        toast({ title: 'Added to favorites!' });
      }
      return newSet;
    });
  };

  if (!session || isLoading) return null;
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 rounded-2xl p-5 shadow-lg mb-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">For You</p>
            <p className="text-xs text-purple-200">Based on your taste</p>
          </div>
        </div>
        <Link href="/discover">
          <div className="flex items-center gap-1 text-purple-200 hover:text-white cursor-pointer transition-colors">
            <span className="text-sm font-medium">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {recommendations.map((item, idx) => (
          <div key={item.id || idx} className="flex-shrink-0 w-32">
            <Link href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-purple-700/30 mb-2 group cursor-pointer">
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
                    <Sparkles className="w-8 h-8 text-white/50" />
                  </div>
                )}
                
                {/* Gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            </Link>
            
            {/* Title and actions */}
            <div className="flex items-start justify-between gap-1">
              <Link href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
                <p className="text-sm font-medium text-white line-clamp-2 leading-tight hover:text-purple-200 transition-colors cursor-pointer">
                  {item.title}
                </p>
              </Link>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => handleAddToList(item, e)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  addedItems.has(item.id)
                    ? 'bg-green-500 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {addedItems.has(item.id) ? (
                  <>
                    <Check className="w-3 h-3" />
                    Added
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    Add
                  </>
                )}
              </button>
              <button
                onClick={(e) => handleStar(item, e)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                  starredItems.has(item.id)
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Star className={`w-4 h-4 ${starredItems.has(item.id) ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
