import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Crown, ChevronRight, Trophy } from 'lucide-react';

interface RankItem {
  id: string;
  title: string;
  description?: string;
  items_count?: number;
  cover_image_url?: string;
  origin_type?: string;
}

export function RanksGlimpse() {
  const { session } = useAuth();

  const { data: ranks, isLoading } = useQuery({
    queryKey: ['ranks-glimpse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ranked_lists')
        .select('id, title, description, items_count, cover_image_url, origin_type')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return (data || []) as RankItem[];
    },
    enabled: !!session?.access_token
  });

  if (!session || isLoading || !ranks || ranks.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Top Ranks</p>
            <p className="text-[10px] text-white/70">Community rankings</p>
          </div>
        </div>
        <Link href="/collections">
          <div className="flex items-center gap-1 text-white/80 hover:text-white cursor-pointer">
            <span className="text-xs font-medium">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ranks.slice(0, 2).map((rank, idx) => (
          <Link key={rank.id} href={`/rank/${rank.id}`}>
            <div className="bg-white/15 rounded-xl p-3 cursor-pointer hover:bg-white/25 transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-yellow-400' : 'bg-gray-300'}`}>
                  <Trophy className={`w-3 h-3 ${idx === 0 ? 'text-yellow-800' : 'text-gray-600'}`} />
                </div>
                {rank.origin_type === 'consumed' && (
                  <span className="text-[9px] bg-yellow-400/30 text-yellow-200 px-1 rounded">Consumed</span>
                )}
              </div>
              <p className="text-sm text-white font-medium line-clamp-2">{rank.title}</p>
              {rank.items_count && (
                <p className="text-[10px] text-white/60 mt-1">{rank.items_count} items ranked</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
