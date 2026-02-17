import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

interface AwardsCompletion {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  event_name: string;
  event_year: number;
  event_slug: string;
  picks_count: number;
  completed_at: string;
}

export function AwardsCompletionFeed() {
  const { session } = useAuth();
  const currentUserId = session?.user?.id;

  const { data: completions } = useQuery<AwardsCompletion[]>({
    queryKey: ['awards-completions-feed'],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('awards_events')
        .select('id, name, year, slug')
        .or("name.ilike.%academy%,name.ilike.%oscar%")
        .eq('status', 'open');

      if (!events || events.length === 0) return [];

      const results: AwardsCompletion[] = [];

      for (const event of events) {
        const { data: categories } = await supabase
          .from('awards_categories')
          .select('id')
          .eq('event_id', event.id);

        if (!categories) continue;
        const totalCategories = categories.length;
        const categoryIds = categories.map(c => c.id);

        const { data: picks } = await supabase
          .from('awards_picks')
          .select('user_id, category_id, created_at')
          .in('category_id', categoryIds);

        if (!picks) continue;

        const userPickCounts: Record<string, { count: number; latestPick: string }> = {};
        picks.forEach(pick => {
          if (!userPickCounts[pick.user_id]) {
            userPickCounts[pick.user_id] = { count: 0, latestPick: pick.created_at };
          }
          userPickCounts[pick.user_id].count++;
          if (pick.created_at > userPickCounts[pick.user_id].latestPick) {
            userPickCounts[pick.user_id].latestPick = pick.created_at;
          }
        });

        const completedUserIds = Object.entries(userPickCounts)
          .filter(([_, data]) => data.count >= totalCategories)
          .map(([userId, data]) => ({ userId, completedAt: data.latestPick }));

        if (completedUserIds.length === 0) continue;

        const { data: users } = await supabase
          .from('users')
          .select('id, user_name')
          .in('id', completedUserIds.map(u => u.userId));

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', completedUserIds.map(u => u.userId));

        completedUserIds.forEach(({ userId, completedAt }) => {
          const user = users?.find(u => u.id === userId);
          const profile = profiles?.find(p => p.id === userId);
          
          results.push({
            user_id: userId,
            display_name: profile?.display_name || user?.user_name || 'Player',
            username: profile?.username || user?.user_name || 'player',
            avatar_url: profile?.avatar_url || null,
            event_name: event.name,
            event_year: event.year,
            event_slug: event.slug,
            picks_count: totalCategories,
            completed_at: completedAt
          });
        });
      }

      return results.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      ).slice(0, 10);
    },
    staleTime: 60000,
  });

  const [expanded, setExpanded] = useState(false);

  if (!completions || completions.length === 0) return null;

  const INITIAL_SHOW = 3;
  const visibleCompletions = expanded ? completions : completions.slice(0, INITIAL_SHOW);
  const hasMore = completions.length > INITIAL_SHOW;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 overflow-hidden">
      <div className="p-4 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-500" size={20} />
          <h3 className="font-bold text-gray-900">Oscar Predictions</h3>
        </div>
      </div>
      
      <div className="divide-y divide-amber-100">
        {visibleCompletions.map((completion) => {
          const isCurrentUser = completion.user_id === currentUserId;
          const timeAgo = getTimeAgo(completion.completed_at);
          
          return (
            <div key={`${completion.user_id}-${completion.event_slug}`} className="p-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {completion.avatar_url ? (
                    <img src={completion.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    completion.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800">
                    <Link href={`/user/${completion.user_id}`} className="font-semibold text-gray-900 hover:text-amber-600">
                      {completion.display_name}
                    </Link>
                    {isCurrentUser && <span className="text-amber-600 ml-1">(You)</span>}
                    {' '}completed their ballot
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-amber-600 hover:text-amber-700 border-t border-amber-100 transition-colors"
        >
          {expanded ? (
            <>Show less <ChevronUp size={14} /></>
          ) : (
            <>See {completions.length - INITIAL_SHOW} more <ChevronDown size={14} /></>
          )}
        </button>
      )}
      
      <Link 
        href="/play/awards/oscars-2026"
        className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium text-sm hover:from-amber-600 hover:to-yellow-600 transition-colors"
      >
        Make Your Picks
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
