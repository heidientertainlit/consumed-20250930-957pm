import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ChevronRight, Check, X, Plus, Star, Loader2, Sparkles, Search, BookOpen, Headphones, Gamepad2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/posthog";
import { Link } from "wouter";

interface SeenItItem {
  id: string;
  title: string;
  image_url: string;
  year?: string;
  external_id?: string;
  external_source?: string;
  media_type?: string;
}

interface SeenItSet {
  id: string;
  title: string;
  media_type: string;
  items: SeenItItem[];
}

const getMediaTypeConfig = (mediaType: string) => {
  switch (mediaType) {
    case 'book':
      return { icon: BookOpen, prompt: 'Read It?', actionYes: 'Read It', actionDone: 'Read', iconColor: 'text-emerald-400' };
    case 'music':
    case 'podcast':
      return { icon: Headphones, prompt: 'Listened to It?', actionYes: 'Heard It', actionDone: 'Heard', iconColor: 'text-pink-400' };
    case 'game':
      return { icon: Gamepad2, prompt: 'Played It?', actionYes: 'Played It', actionDone: 'Played', iconColor: 'text-blue-400' };
    default:
      return { icon: Eye, prompt: 'Seen It?', actionYes: 'Seen It', actionDone: 'Seen', iconColor: 'text-yellow-400' };
  }
};

interface SeenItGameProps {
  mediaTypeFilter?: string;
}

export default function SeenItGame({ mediaTypeFilter }: SeenItGameProps = {}) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localResponses, setLocalResponses] = useState<Record<string, boolean | 'want_to'>>(() => {
    try {
      const stored = localStorage.getItem('seen_it_responses');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [completedSetIds, setCompletedSetIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('seen_it_completed_sets');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [currentSetIndex, setCurrentSetIndex] = useState(0);

  const { data: supabaseCompletedSets } = useQuery({
    queryKey: ['seen-it-completions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const { data, error } = await supabase
          .from('seen_it_completions')
          .select('set_id')
          .eq('user_id', user.id);
        if (error) {
          console.warn('seen_it_completions query failed:', error);
          return [];
        }
        const ids = (data || []).map((r: any) => r.set_id);
        console.log('🎯 Supabase completed sets:', ids);
        if (ids.length > 0) {
          setCompletedSetIds(prev => {
            const next = new Set(prev);
            ids.forEach((id: string) => next.add(id));
            try { localStorage.setItem('seen_it_completed_sets', JSON.stringify([...next])); } catch {}
            return next;
          });
        }
        return ids;
      } catch (e) {
        console.warn('seen_it_completions query error:', e);
        return [];
      }
    },
    enabled: !!user?.id
  });

  const { data: trendingSets, isLoading: isLoadingTrending } = useQuery({
    queryKey: ['trending-sets'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('trending-sets', {
          body: {},
        });
        if (error) return [];
        return (data?.sets || []) as SeenItSet[];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
  });

  const { data: staticSets, isLoading: isLoadingStatic } = useQuery({
    queryKey: ['seen-it-sets'],
    queryFn: async () => {
      const { data: setsData, error } = await supabase
        .from('seen_it_sets')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const setsWithItems: SeenItSet[] = [];
      for (const set of setsData || []) {
        const { data: items } = await supabase
          .from('seen_it_items')
          .select('*')
          .eq('set_id', set.id)
          .order('position', { ascending: true });
        
        setsWithItems.push({
          id: set.id,
          title: set.title,
          media_type: set.media_type || 'movie',
          items: items || []
        });
      }
      
      return setsWithItems;
    }
  });

  const sets = useMemo(() => {
    const allSets = [...(trendingSets || []), ...(staticSets || [])];
    return mediaTypeFilter 
      ? allSets.filter(s => {
          if (mediaTypeFilter === 'movie') return s.media_type === 'movie' || s.media_type === 'tv';
          if (mediaTypeFilter === 'book') return s.media_type === 'book';
          if (mediaTypeFilter === 'music') return s.media_type === 'music' || s.media_type === 'podcast';
          return s.media_type === mediaTypeFilter;
        })
      : allSets;
  }, [trendingSets, staticSets, mediaTypeFilter]);
  const isLoading = sets.length === 0 && (isLoadingTrending || isLoadingStatic);

  const { data: existingResponses } = useQuery({
    queryKey: ['seen-it-responses', user?.id],
    queryFn: async () => {
      if (!user?.id) return { responseMap: {}, trackedExternalIds: {} };
      const responseMap: Record<string, boolean> = {};

      try {
        const { data } = await supabase
          .from('seen_it_responses')
          .select('item_id, seen')
          .eq('user_id', user.id);
        (data || []).forEach(r => {
          responseMap[r.item_id] = r.seen;
        });
      } catch (e) {
        console.warn('seen_it_responses query failed:', e);
      }

      const trackedExternalIds: Record<string, string> = {};
      try {
        const { data: userLists } = await supabase
          .from('lists')
          .select('id, title')
          .eq('user_id', user.id);

        const finishedListIds = (userLists || []).filter(l => l.title === 'Finished').map(l => l.id);
        const queueListIds = (userLists || []).filter(l => l.title === 'Want To').map(l => l.id);
        const allListIds = [...finishedListIds, ...queueListIds];

        if (allListIds.length > 0) {
          const { data: listItems } = await supabase
            .from('list_items')
            .select('external_id, list_id')
            .eq('user_id', user.id)
            .in('list_id', allListIds);

          (listItems || []).forEach((item: any) => {
            if (finishedListIds.includes(item.list_id)) {
              trackedExternalIds[item.external_id] = 'finished';
            } else if (queueListIds.includes(item.list_id) && !trackedExternalIds[item.external_id]) {
              trackedExternalIds[item.external_id] = 'queue';
            }
          });
        }
      } catch (e) {
        console.warn('list_items query failed:', e);
      }

      return { responseMap, trackedExternalIds };
    },
    enabled: !!user?.id
  });

  const responses = useMemo(() => {
    const merged: Record<string, boolean | 'want_to'> = {};
    if (existingResponses && 'responseMap' in existingResponses) {
      const { responseMap, trackedExternalIds } = existingResponses as { responseMap: Record<string, boolean>; trackedExternalIds: Record<string, string> };
      Object.entries(responseMap || {}).forEach(([id, val]) => { merged[id] = val; });
      sets.forEach(set => {
        set.items.forEach(item => {
          if (merged[item.id] !== undefined) return;
          const extId = item.external_id;
          if (extId && trackedExternalIds?.[extId]) {
            merged[item.id] = trackedExternalIds[extId] === 'finished' ? true : 'want_to';
          }
        });
      });
    }
    Object.entries(localResponses).forEach(([id, val]) => {
      if (id.startsWith('ext_')) return;
      merged[id] = val;
    });
    sets.forEach(set => {
      set.items.forEach(item => {
        if (merged[item.id] !== undefined) return;
        const extKey = item.external_id ? `ext_${item.external_id}` : null;
        if (extKey && localResponses[extKey] !== undefined) {
          merged[item.id] = localResponses[extKey];
        }
      });
    });
    return merged;
  }, [existingResponses, sets, localResponses]);

  const incompleteSets = useMemo(() => {
    const result = sets.filter(set => {
      if (completedSetIds.has(set.id)) return false;
      const answeredCount = set.items.filter(item => responses[item.id] !== undefined).length;
      return answeredCount < set.items.length;
    });
    return result;
  }, [sets, responses, completedSetIds]);

  useEffect(() => {
    sets.forEach(set => {
      if (completedSetIds.has(set.id)) return;
      const answeredCount = set.items.filter(item => responses[item.id] !== undefined).length;
      if (answeredCount >= set.items.length && set.items.length > 0) {
        const seenCount = set.items.filter(item => responses[item.id] === true).length;
        setCompletedSetIds(prev => {
          const next = new Set(prev);
          next.add(set.id);
          try { localStorage.setItem('seen_it_completed_sets', JSON.stringify([...next])); } catch {}
          return next;
        });
        if (user?.id) {
          supabase.from('seen_it_completions').upsert({
            id: `${user.id}-${set.id}`,
            set_id: set.id,
            user_id: user.id,
            seen_count: seenCount,
            total_count: set.items.length,
            percentage: Math.round((seenCount / set.items.length) * 100),
            completed_at: new Date().toISOString()
          }, { onConflict: 'id' }).then(({ error }) => {
            if (error) console.warn('Failed to save completion to Supabase:', error);
            else console.log('🎯 Saved completion to Supabase:', set.id);
          });
        }
      }
    });
  }, [responses, sets, completedSetIds, user?.id]);

  useEffect(() => {
    if (currentSetIndex >= incompleteSets.length && incompleteSets.length > 0) {
      setCurrentSetIndex(0);
    }
  }, [incompleteSets.length]);

  const responseMutation = useMutation({
    mutationFn: async ({ setId, itemId, response, item }: { setId: string; itemId: string; response: boolean | 'want_to'; item: SeenItItem }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const seenValue = response === true;
      
      const { data: existing } = await supabase
        .from('seen_it_responses')
        .select('id')
        .eq('item_id', itemId)
        .eq('user_id', user.id)
        .single();
      
      if (existing) {
        await supabase
          .from('seen_it_responses')
          .update({ seen: seenValue })
          .eq('id', existing.id);
      } else {
        await supabase.from('seen_it_responses').insert({
          set_id: setId,
          item_id: itemId,
          user_id: user.id,
          seen: seenValue
        });
      }
      
      if (item.external_id && item.external_source) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (response === true) {
            await supabase.functions.invoke('track-media', {
              body: {
                media: {
                  title: item.title,
                  mediaType: item.media_type || 'movie',
                  imageUrl: item.image_url,
                  externalId: item.external_id,
                  externalSource: item.external_source
                },
                listType: 'finished',
                skip_social_post: true
              }
            });
          } else if (response === 'want_to') {
            await supabase.functions.invoke('track-media', {
              body: {
                media: {
                  title: item.title,
                  mediaType: item.media_type || 'movie',
                  imageUrl: item.image_url,
                  externalId: item.external_id,
                  externalSource: item.external_source
                },
                listType: 'queue',
                skip_social_post: true
              }
            });
          }
        } catch (err) {
          console.error('Failed to add to list:', err);
        }
      }
      
      return { itemId, response };
    },
    onSuccess: ({ itemId, response }) => {
      trackEvent('seen_it_response', { item_id: itemId, response: String(response) });
      queryClient.invalidateQueries({ queryKey: ['seen-it-responses'] });
      if (response === true || response === 'want_to') {
        queryClient.invalidateQueries({ queryKey: ['/api/list-items'] });
      }
    }
  });

  const handleResponse = (setId: string, item: SeenItItem, response: boolean | 'want_to') => {
    const extKey = item.external_id ? `ext_${item.external_id}` : null;
    setLocalResponses(prev => {
      const next = { ...prev, [item.id]: response };
      if (extKey) next[extKey] = response;
      try { localStorage.setItem('seen_it_responses', JSON.stringify(next)); } catch {}
      return next;
    });
    if (session) {
      responseMutation.mutate({ setId, itemId: item.id, response, item });
    }
  };

  const markSetDone = (setId: string) => {
    setCompletedSetIds(prev => {
      const next = new Set(prev);
      next.add(setId);
      try { localStorage.setItem('seen_it_completed_sets', JSON.stringify([...next])); } catch {}
      return next;
    });
    if (user?.id) {
      supabase.from('seen_it_completions').upsert({
        id: `${user.id}-${setId}`,
        set_id: setId,
        user_id: user.id,
        seen_count: 0,
        total_count: 0,
        percentage: 0,
        completed_at: new Date().toISOString()
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('Failed to save dismissal:', error);
        else {
          console.log('🎯 Dismissed set saved to Supabase:', setId);
          queryClient.invalidateQueries({ queryKey: ['seen-it-completions'] });
        }
      });
    }
  };

  const currentSet = incompleteSets?.[currentSetIndex];

  if (isLoading && !mediaTypeFilter) {
    return (
      <Card className="bg-gradient-to-br from-[#2d1b4e] via-[#1a1035] to-[#0f0a1a] border-0 p-4 rounded-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      </Card>
    );
  }

  if (!incompleteSets || incompleteSets.length === 0 || !currentSet) {
    return null;
  }

  const seenCount = currentSet.items.filter(item => responses[item.id] === true).length;
  const wantToCount = currentSet.items.filter(item => responses[item.id] === 'want_to').length;
  const answeredCount = currentSet.items.filter(item => responses[item.id] !== null && responses[item.id] !== undefined).length;
  const isComplete = answeredCount === currentSet.items.length;
  
  const mediaConfig = getMediaTypeConfig(currentSet.media_type);
  const MediaIcon = mediaConfig.icon;

  return (
    <Card className="bg-gradient-to-br from-[#2d1b4e] via-[#1a1035] to-[#0f0a1a] border-0 p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MediaIcon className={`w-4 h-4 ${mediaConfig.iconColor}`} />
          <h3 className="text-white font-medium text-sm">{mediaConfig.prompt}</h3>
          <span className="text-purple-400 text-xs">• {currentSet.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {answeredCount > 0 && (
            <span className="text-purple-300 text-xs">{seenCount}/{answeredCount}</span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); markSetDone(currentSet.id); }}
            className="text-purple-400 hover:text-white text-xs px-2 py-0.5 rounded-full border border-purple-500/30 hover:border-purple-400/50 transition-all active:scale-95 touch-manipulation"
          >
            Done
          </button>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {currentSet.items.map((item) => {
          const response = responses[item.id];
          const answered = response !== null && response !== undefined;
          
          const mediaDetailLink = `/media/${item.media_type || currentSet.media_type || 'movie'}/${item.external_source || 'tmdb'}/${item.external_id || item.id}`;
          return (
            <div key={item.id} className="flex-shrink-0 w-32">
              <div className="relative">
                <Link href={mediaDetailLink}>
                  <img 
                    src={item.image_url} 
                    alt={item.title}
                    className={`w-32 h-48 rounded-lg object-cover transition-all cursor-pointer hover:opacity-80 ${
                      answered ? 'opacity-60' : ''
                    }`}
                  />
                </Link>
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  <button className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all">
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                  <button className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all">
                    <Star className="w-4 h-4 text-white" />
                  </button>
                </div>
                {answered && (
                  <div className={`absolute inset-0 flex items-center justify-center rounded-lg ${
                    response ? 'bg-green-500/30' : 'bg-red-500/30'
                  }`}>
                    {response ? (
                      <Check className="w-10 h-10 text-green-400" />
                    ) : (
                      <X className="w-10 h-10 text-red-400" />
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-white text-sm font-medium mt-2 truncate">{item.title}</p>
              
              {!answered ? (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleResponse(currentSet.id, item, false); }}
                      className="flex-1 py-1.5 rounded-full bg-black/60 border border-white/15 text-white text-xs font-medium hover:bg-black/80 active:scale-95 transition-all relative z-10 touch-manipulation"
                    >
                      Nope
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleResponse(currentSet.id, item, true); }}
                      className="flex-1 py-1.5 rounded-full bg-black/60 border border-white/15 text-white text-xs font-medium hover:bg-black/80 active:scale-95 transition-all relative z-10 touch-manipulation"
                    >
                      {mediaConfig.actionYes}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleResponse(currentSet.id, item, 'want_to'); }}
                    className="w-full py-1 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-[10px] font-medium hover:opacity-90 active:scale-95 transition-all relative z-10 touch-manipulation"
                  >
                    Want to
                  </button>
                </div>
              ) : (
                <div className={`mt-2 py-1.5 rounded-full text-center text-xs font-medium ${
                  response === true ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white' : response === 'want_to' ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white' : 'bg-black/60 border border-white/15 text-white/60'
                }`}>
                  {response === true ? `✓ ${mediaConfig.actionDone}` : response === 'want_to' ? '+ Want to' : '✗ Nope'}
                </div>
              )}
            </div>
          );
        })}
        
        {isComplete && (() => {
          const pct = Math.round((seenCount / currentSet.items.length) * 100);
          const comparisonPct = Math.min(95, Math.max(5, pct <= 25 ? 60 + Math.round(Math.random() * 15) : pct <= 50 ? 45 + Math.round(Math.random() * 15) : pct <= 75 ? 25 + Math.round(Math.random() * 15) : 5 + Math.round(Math.random() * 10)));
          return (
            <div className="flex-shrink-0 w-32">
              <div className="w-32 h-48 rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 flex flex-col items-center justify-center p-3">
                <span className="text-white font-bold text-xl">{pct}%</span>
                <span className="text-purple-200 text-[10px] text-center">{mediaConfig.actionDone}</span>
                <span className="text-purple-300 text-[9px] text-center mt-0.5">{seenCount} of {currentSet.items.length}</span>
                <div className="w-full h-px bg-white/20 my-1.5" />
                <span className="text-yellow-300 text-[10px] text-center leading-tight">More than {comparisonPct}% of users</span>
                {wantToCount > 0 && (
                  <span className="text-purple-300 text-[8px] mt-1.5">+{wantToCount} on your list</span>
                )}
              </div>

              <p className="text-white text-sm font-medium mt-2 text-center">Complete!</p>

              <div className="flex flex-col gap-1 mt-2">
                {incompleteSets.length > 1 && currentSetIndex < incompleteSets.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => { markSetDone(currentSet.id); setCurrentSetIndex(prev => Math.min(prev, incompleteSets.length - 2)); }}
                    className="w-full py-1.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-xs font-medium hover:opacity-90 active:scale-95 transition-all"
                  >
                    Next Set →
                  </button>
                ) : (
                  <Link href="/profile">
                    <button type="button" onClick={() => markSetDone(currentSet.id)} className="w-full py-1.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-xs font-medium hover:opacity-90 active:scale-95 transition-all">
                      View DNA
                    </button>
                  </Link>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      
      {incompleteSets.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {incompleteSets.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSetIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentSetIndex ? 'bg-purple-400' : 'bg-purple-700'
              }`}
            />
          ))}
        </div>
      )}

    </Card>
  );
}
