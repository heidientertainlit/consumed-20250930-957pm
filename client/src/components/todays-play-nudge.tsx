import { useQuery } from '@tanstack/react-query';
import { Trophy, Flame, Users, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface NudgeItem {
  id: string;
  icon: 'trophy' | 'flame' | 'users' | 'zap';
  text: string;
  color: string;
}

export function TodaysPlayNudge() {
  const today = todayStr();

  // Fetch today's trivia pools
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

  // Fetch who answered those pools
  const { data: activityData } = useQuery({
    queryKey: ['todays-play-nudge-activity', pools],
    queryFn: async () => {
      if (pools.length === 0) return null;
      const { data } = await supabase
        .from('user_predictions')
        .select('user_id, pool_id, points_earned')
        .in('pool_id', pools);
      if (!data || data.length === 0) return null;

      // Group by user
      const byUser: Record<string, { answered: number; correct: number }> = {};
      for (const row of data) {
        if (!byUser[row.user_id]) byUser[row.user_id] = { answered: 0, correct: 0 };
        byUser[row.user_id].answered++;
        if ((row.points_earned ?? 0) > 0) byUser[row.user_id].correct++;
      }

      const userEntries = Object.entries(byUser);
      const totalPlayers = userEntries.length;
      const maxQuestions = pools.length;
      const perfectScorers = userEntries.filter(([, v]) => v.answered >= maxQuestions && v.correct === maxQuestions);
      const allCorrectPct = data.length > 0
        ? Math.round((data.filter((r: any) => (r.points_earned ?? 0) > 0).length / data.length) * 100)
        : null;

      return { totalPlayers, perfectScorers: perfectScorers.length, allCorrectPct, maxQuestions };
    },
    enabled: pools.length > 0,
    staleTime: 60_000,
  });

  // Fetch display names of perfect scorers
  const { data: perfectNames = [] } = useQuery({
    queryKey: ['todays-play-nudge-names', pools, activityData?.perfectScorers],
    queryFn: async () => {
      if (!activityData || activityData.perfectScorers === 0 || pools.length === 0) return [];
      const { data: predictions } = await supabase
        .from('user_predictions')
        .select('user_id, pool_id, points_earned')
        .in('pool_id', pools);
      if (!predictions) return [];

      const byUser: Record<string, { answered: number; correct: number }> = {};
      for (const row of predictions) {
        if (!byUser[row.user_id]) byUser[row.user_id] = { answered: 0, correct: 0 };
        byUser[row.user_id].answered++;
        if ((row.points_earned ?? 0) > 0) byUser[row.user_id].correct++;
      }

      const perfectIds = Object.entries(byUser)
        .filter(([, v]) => v.answered >= pools.length && v.correct === pools.length)
        .map(([uid]) => uid);

      if (perfectIds.length === 0) return [];

      const { data: users } = await supabase
        .from('users')
        .select('id, display_name, user_name')
        .in('id', perfectIds.slice(0, 3));

      return (users || []).map((u: any) => u.display_name || u.user_name || 'Someone');
    },
    enabled: !!activityData && activityData.perfectScorers > 0 && pools.length > 0,
    staleTime: 60_000,
  });

  if (!activityData || activityData.totalPlayers === 0) return null;

  const nudges: NudgeItem[] = [];

  const { totalPlayers, perfectScorers, allCorrectPct, maxQuestions } = activityData;

  // Perfect score nudges
  if (perfectScorers > 0 && perfectNames.length > 0) {
    const firstName = perfectNames[0];
    const extra = perfectScorers > 1 ? ` +${perfectScorers - 1} more` : '';
    nudges.push({
      id: 'perfect',
      icon: 'trophy',
      text: `${firstName}${extra} got a perfect score — you have competition`,
      color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-200',
    });
  } else if (perfectScorers > 0) {
    nudges.push({
      id: 'perfect-anon',
      icon: 'trophy',
      text: `${perfectScorers} player${perfectScorers !== 1 ? 's' : ''} already aced Today's Play`,
      color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-200',
    });
  }

  // Players count nudge
  if (totalPlayers >= 2) {
    nudges.push({
      id: 'players',
      icon: 'users',
      text: `${totalPlayers} people have played today's trivia so far`,
      color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-200',
    });
  } else if (totalPlayers === 1 && perfectScorers === 0) {
    nudges.push({
      id: 'first',
      icon: 'zap',
      text: `Be one of the first to play today — no one's aced it yet`,
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-200',
    });
  }

  // Difficulty nudge
  if (allCorrectPct !== null && totalPlayers >= 3 && maxQuestions >= 2) {
    if (allCorrectPct < 40) {
      nudges.push({
        id: 'hard',
        icon: 'flame',
        text: `Only ${allCorrectPct}% of answers are correct — today's tough`,
        color: 'from-red-500/20 to-orange-500/10 border-red-500/30 text-red-200',
      });
    } else if (allCorrectPct >= 80) {
      nudges.push({
        id: 'easy',
        icon: 'zap',
        text: `${allCorrectPct}% accuracy today — the crowd's on a roll`,
        color: 'from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-200',
      });
    }
  }

  if (nudges.length === 0) return null;

  const iconMap = {
    trophy: Trophy,
    flame: Flame,
    users: Users,
    zap: Zap,
  };

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
      {nudges.map((nudge) => {
        const Icon = iconMap[nudge.icon];
        return (
          <div
            key={nudge.id}
            className={`flex-shrink-0 snap-start flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border bg-gradient-to-r ${nudge.color} backdrop-blur-sm`}
            style={{ minWidth: nudges.length === 1 ? '100%' : 'calc(85vw - 2rem)', maxWidth: 340 }}
          >
            <Icon size={14} className="shrink-0 opacity-80" />
            <p className="text-xs font-medium leading-snug">{nudge.text}</p>
          </div>
        );
      })}
    </div>
  );
}
