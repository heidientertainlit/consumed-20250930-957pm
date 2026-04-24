import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TodaysPlayNudge() {
  const today = todayStr();

  const { data: pools = [] } = useQuery({
    queryKey: ['todays-play-nudge-pools', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('prediction_pools')
        .select('id')
        .eq('type', 'trivia')
        .eq('featured_date', today)
        .eq('status', 'open');
      return (data || []).map((r: any) => r.id as string);
    },
    staleTime: 60_000,
  });

  const { data: totalPlayers = 0 } = useQuery({
    queryKey: ['todays-play-nudge-count', pools],
    queryFn: async () => {
      if (pools.length === 0) return 0;
      const { data } = await supabase
        .from('user_predictions')
        .select('user_id')
        .in('pool_id', pools);
      if (!data || data.length === 0) return 0;
      return new Set(data.map((r: any) => r.user_id)).size;
    },
    enabled: pools.length > 0,
    staleTime: 60_000,
  });

  if (totalPlayers < 2) return null;

  return (
    <p className="mt-3 text-center text-[11px] text-white/40 font-medium">
      {totalPlayers + 50} people have played today's trivia so far
    </p>
  );
}
