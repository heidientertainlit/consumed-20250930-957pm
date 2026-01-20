import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { Sparkles, ChevronRight, Plus, Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface RecommendedItem {
  id: string;
  title: string;
  imageUrl?: string;
  type: string;
  reason?: string;
}

export function RecommendationsGlimpse() {
  const { session } = useAuth();

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
        reason: item.reason
      })) as RecommendedItem[];
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000
  });

  if (!session || isLoading) return null;
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">For You</p>
            <p className="text-[10px] text-purple-200">Based on your taste</p>
          </div>
        </div>
        <Link href="/discover">
          <div className="flex items-center gap-1 text-purple-200 hover:text-white cursor-pointer">
            <span className="text-xs font-medium">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {recommendations.map((item, idx) => (
          <Link key={item.id || idx} href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
            <div className="flex-shrink-0 w-24 cursor-pointer group">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-1.5">
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>
                )}
                <button className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <p className="text-xs font-medium text-white line-clamp-2 leading-tight">{item.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
