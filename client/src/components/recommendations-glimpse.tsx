import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Star, Check, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface RecommendedItem {
  id: string;
  title: string;
  imageUrl?: string;
  type: string;
  externalSource?: string;
}

function RecommendationItemCard({ 
  item, 
  idx, 
  onAddClick 
}: { 
  item: RecommendedItem; 
  idx: number; 
  onAddClick: (item: RecommendedItem) => void;
}) {
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [submittedRating, setSubmittedRating] = useState<number | null>(null);
  const { session } = useAuth();
  const { toast } = useToast();

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/rate-media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            media_external_id: item.id,
            media_external_source: item.externalSource || 'tmdb',
            media_title: item.title,
            media_type: item.type || 'movie',
            rating: rating,
            skip_social_post: true,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to rate");
      return response.json();
    },
    onSuccess: (_, rating) => {
      setSubmittedRating(rating);
      toast({
        title: "Rated!",
        description: `You rated "${item.title}" ${rating} star${rating !== 1 ? "s" : ""}.`,
      });
    },
  });

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (submittedRating === null) {
      const newRating = parseFloat(e.target.value);
      setCurrentRating(newRating);
      if (newRating > 0) {
        rateMutation.mutate(newRating);
      }
    }
  };

  const displayRating = submittedRating !== null ? submittedRating : currentRating;

  return (
    <div className="flex-shrink-0 w-28">
      <Link href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 mb-1.5 cursor-pointer">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs bg-gradient-to-br from-purple-900 to-indigo-900">
              🎬
            </div>
          )}
        </div>
      </Link>
      <Link href={`/media/${item.type || 'movie'}/tmdb/${item.id}`}>
        <p className="text-xs font-medium text-white line-clamp-2 leading-tight cursor-pointer h-8 hover:text-purple-300">
          {item.title}
        </p>
      </Link>
      <div className="relative flex items-center mt-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <div key={star} className="relative" style={{ width: 14, height: 14 }}>
              <Star size={14} className="absolute inset-0 text-purple-400" />
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ 
                  width: displayRating >= star ? '100%' : displayRating >= star - 0.5 ? '50%' : '0%'
                }}
              >
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
              </div>
            </div>
          ))}
        </div>
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={displayRating}
          onChange={handleSliderChange}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          style={{ margin: 0 }}
          disabled={rateMutation.isPending || submittedRating !== null}
        />
        {submittedRating !== null && (
          <Check size={12} className="text-green-400 ml-1" />
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddClick(item);
        }}
        className="mt-1.5 w-full bg-white text-purple-800 text-xs py-1.5 rounded-full hover:bg-purple-100 transition-colors font-medium"
      >
        + Add
      </button>
    </div>
  );
}

export function RecommendationsGlimpse() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [quickAddItem, setQuickAddItem] = useState<RecommendedItem | null>(null);

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
        externalSource: item.external_source || 'tmdb'
      })) as RecommendedItem[];
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000
  });

  const handleAddToList = async (item: RecommendedItem) => {
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
        toast({ title: 'Added to Want to Watch!' });
      }
    } catch (err) {
      console.error('Failed to add:', err);
    }
  };

  if (!session || isLoading) return null;
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div 
      className="bg-gradient-to-r from-[#1a1a2e] via-[#2d1f4e] to-[#1a1a2e] rounded-2xl border border-purple-900/50 p-4 shadow-lg mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="font-semibold text-white">Recommended For You</h3>
        </div>
        <Link href="/discover">
          <div className="flex items-center gap-1 text-purple-300 hover:text-white cursor-pointer transition-colors">
            <span className="text-sm">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {recommendations.map((item, idx) => (
          <RecommendationItemCard
            key={item.id || idx}
            item={item}
            idx={idx}
            onAddClick={handleAddToList}
          />
        ))}
      </div>
    </div>
  );
}
