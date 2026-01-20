import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Plus, Star, ChevronRight } from 'lucide-react';
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
        body: JSON.stringify({ limit: 8 })
      });
      
      if (!response.ok) return [];
      const data = await response.json();
      const recs = data.recommendations || data.items || [];
      return recs.slice(0, 8).map((item: any) => ({
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
    <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-2xl p-5 shadow-xl mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Recommended For You</h2>
        <Link href="/discover">
          <div className="flex items-center gap-1 text-gray-400 hover:text-white cursor-pointer transition-colors">
            <span className="text-sm">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* Scrolling cards */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {recommendations.map((item, idx) => (
          <div key={item.id || idx} className="flex-shrink-0 w-28">
            {/* Poster with overlay buttons */}
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 mb-2 group">
              <Link href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.title}
                    className="w-full h-full object-cover cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600 cursor-pointer">
                    <span className="text-2xl">🎬</span>
                  </div>
                )}
              </Link>
              
              {/* Bottom gradient overlay */}
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
              
              {/* Action buttons on poster */}
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2">
                <button
                  onClick={(e) => handleAddToList(item, e)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    addedItems.has(item.id)
                      ? 'bg-green-500 text-white'
                      : 'bg-white/30 backdrop-blur-sm text-white hover:bg-white/50'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleStar(item, e)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    starredItems.has(item.id)
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white/30 backdrop-blur-sm text-white hover:bg-white/50'
                  }`}
                >
                  <Star className={`w-4 h-4 ${starredItems.has(item.id) ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
            
            {/* Title below poster */}
            <Link href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
              <p className="text-sm font-medium text-white line-clamp-2 leading-tight cursor-pointer hover:text-purple-300 transition-colors">
                {item.title}
              </p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
