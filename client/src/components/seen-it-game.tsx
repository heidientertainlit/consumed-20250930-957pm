import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, ChevronRight, Check, X, Plus, Star, Loader2, Sparkles, BookOpen, Headphones, Gamepad2, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/posthog";

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
      return { icon: BookOpen, pill: 'Books', actionYes: 'Read It', actionDone: 'Read', pillBg: 'bg-emerald-100 text-emerald-700' };
    case 'music':
    case 'podcast':
      return { icon: Headphones, pill: 'Music', actionYes: 'Heard It', actionDone: 'Heard', pillBg: 'bg-pink-100 text-pink-700' };
    case 'game':
      return { icon: Gamepad2, pill: 'Games', actionYes: 'Played It', actionDone: 'Played', pillBg: 'bg-blue-100 text-blue-700' };
    case 'tv':
      return { icon: Eye, pill: 'TV', actionYes: 'Seen It', actionDone: 'Seen', pillBg: 'bg-purple-100 text-purple-700' };
    default:
      return { icon: Eye, pill: 'Movies', actionYes: 'Seen It', actionDone: 'Seen', pillBg: 'bg-yellow-100 text-yellow-700' };
  }
};

interface SeenItGameProps {
  mediaTypeFilter?: string;
  onAddToList?: (media: { title: string; mediaType: string; externalId: string; externalSource: string; imageUrl: string }) => void;
}

const SWIPE_THRESHOLD = 80;

export default function SeenItGame({ mediaTypeFilter, onAddToList }: SeenItGameProps = {}) {
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();

  // ── Persisted state ───────────────────────────────────────────────────────
  const [localResponses, setLocalResponses] = useState<Record<string, boolean | 'want_to'>>(() => {
    try { return JSON.parse(localStorage.getItem('seen_it_responses') || '{}'); } catch { return {}; }
  });
  const [completedSetIds, setCompletedSetIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('seen_it_completed_sets') || '[]')); } catch { return new Set(); }
  });
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [ratingItem, setRatingItem] = useState<string | null>(null);
  const [ratingMap, setRatingMap] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('seen_it_ratings') || '{}'); } catch { return {}; }
  });

  // ── Swipe drag state ──────────────────────────────────────────────────────
  const [dragX, setDragX] = useState(0);
  const gestureRef = useRef<HTMLDivElement>(null);
  // Use refs for gesture tracking to avoid stale closures in event listeners
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const isDraggingRef = useRef(false);
  const isScrollingRef = useRef<boolean | null>(null);
  const currentDragX = useRef(0);
  // Trackpad wheel accumulation
  const wheelAccum = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching (unchanged from original) ───────────────────────────────
  const { data: supabaseCompletedSets } = useQuery({
    queryKey: ['seen-it-completions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const { data, error } = await supabase.from('seen_it_completions').select('set_id').eq('user_id', user.id);
        if (error) { console.warn('seen_it_completions query failed:', error); return []; }
        const ids = (data || []).map((r: any) => r.set_id);
        if (ids.length > 0) {
          setCompletedSetIds(prev => {
            const next = new Set(prev);
            ids.forEach((id: string) => next.add(id));
            try { localStorage.setItem('seen_it_completed_sets', JSON.stringify([...next])); } catch {}
            return next;
          });
        }
        return ids;
      } catch { return []; }
    },
    enabled: !!user?.id
  });

  const { data: trendingSets, isLoading: isLoadingTrending } = useQuery({
    queryKey: ['trending-sets'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('trending-sets', { body: {} });
        if (error) return [];
        return (data?.sets || []) as SeenItSet[];
      } catch { return []; }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
  });

  const { data: staticSets, isLoading: isLoadingStatic } = useQuery({
    queryKey: ['seen-it-sets'],
    queryFn: async () => {
      const { data: setsData, error } = await supabase
        .from('seen_it_sets').select('*').eq('visibility', 'public')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const setsWithItems: SeenItSet[] = [];
      for (const set of setsData || []) {
        const { data: items } = await supabase.from('seen_it_items').select('*')
          .eq('set_id', set.id).order('position', { ascending: true });
        setsWithItems.push({ id: set.id, title: set.title, media_type: set.media_type || 'movie', items: items || [] });
      }
      return setsWithItems;
    }
  });

  const sets = useMemo(() => {
    const allSets = [...(trendingSets || []), ...(staticSets || [])];
    const seen = new Set<string>();
    const deduped = allSets.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    return mediaTypeFilter
      ? deduped.filter(s => {
          if (mediaTypeFilter === 'movie') return s.media_type === 'movie';
          if (mediaTypeFilter === 'tv') return s.media_type === 'tv';
          if (mediaTypeFilter === 'book') return s.media_type === 'book';
          if (mediaTypeFilter === 'music') return s.media_type === 'music';
          if (mediaTypeFilter === 'podcast') return s.media_type === 'podcast';
          return s.media_type === mediaTypeFilter;
        })
      : deduped;
  }, [trendingSets, staticSets, mediaTypeFilter]);

  const isLoading = sets.length === 0 && (isLoadingTrending || isLoadingStatic);

  const { data: existingResponses } = useQuery({
    queryKey: ['seen-it-responses', user?.id],
    queryFn: async () => {
      if (!user?.id) return { responseMap: {}, trackedExternalIds: {} };
      const responseMap: Record<string, boolean> = {};
      try {
        const { data } = await supabase.from('seen_it_responses').select('item_id, seen').eq('user_id', user.id);
        (data || []).forEach((r: any) => { responseMap[r.item_id] = r.seen; });
      } catch {}
      const trackedExternalIds: Record<string, string> = {};
      try {
        const { data: userLists } = await supabase.from('lists').select('id, title').eq('user_id', user.id);
        const finishedListIds = (userLists || []).filter((l: any) => l.title === 'Finished').map((l: any) => l.id);
        const queueListIds = (userLists || []).filter((l: any) => l.title === 'Want To').map((l: any) => l.id);
        const allListIds = [...finishedListIds, ...queueListIds];
        if (allListIds.length > 0) {
          const { data: listItems } = await supabase.from('list_items')
            .select('external_id, list_id').eq('user_id', user.id).in('list_id', allListIds);
          (listItems || []).forEach((item: any) => {
            if (finishedListIds.includes(item.list_id)) trackedExternalIds[item.external_id] = 'finished';
            else if (queueListIds.includes(item.list_id) && !trackedExternalIds[item.external_id]) trackedExternalIds[item.external_id] = 'queue';
          });
        }
      } catch {}
      return { responseMap, trackedExternalIds };
    },
    enabled: !!user?.id
  });

  const responses = useMemo(() => {
    const merged: Record<string, boolean | 'want_to'> = {};
    if (existingResponses && 'responseMap' in existingResponses) {
      const { responseMap, trackedExternalIds } = existingResponses as any;
      Object.entries(responseMap || {}).forEach(([id, val]: any) => { merged[id] = val; });
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
        if (extKey && localResponses[extKey] !== undefined) merged[item.id] = localResponses[extKey];
      });
    });
    return merged;
  }, [existingResponses, sets, localResponses]);

  const incompleteSets = useMemo(() => sets.filter(set => !completedSetIds.has(set.id)), [sets, completedSetIds]);

  const autoDetectedRef = useRef(false);
  useEffect(() => {
    if (autoDetectedRef.current || !existingResponses || sets.length === 0) return;
    autoDetectedRef.current = true;
    sets.forEach(set => {
      if (completedSetIds.has(set.id)) return;
      const answeredCount = set.items.filter(item => responses[item.id] !== undefined).length;
      if (answeredCount >= set.items.length && set.items.length > 0) {
        const seenCount = set.items.filter(item => responses[item.id] === true).length;
        saveSetCompletion(set.id, seenCount, set.items.length);
      }
    });
  }, [existingResponses, sets]);

  useEffect(() => {
    if (currentSetIndex >= incompleteSets.length && incompleteSets.length > 0) setCurrentSetIndex(0);
  }, [incompleteSets.length]);

  // Reset item index when set changes
  useEffect(() => { setCurrentItemIndex(0); setRatingItem(null); }, [currentSetIndex]);

  const responseMutation = useMutation({
    mutationFn: async ({ setId, itemId, response, item }: { setId: string; itemId: string; response: boolean | 'want_to'; item: SeenItItem }) => {
      if (!user?.id) throw new Error('Must be logged in');
      const seenValue = response === true;
      const { data: existing } = await supabase.from('seen_it_responses').select('id')
        .eq('item_id', itemId).eq('user_id', user.id).single();
      if (existing) {
        await supabase.from('seen_it_responses').update({ seen: seenValue }).eq('id', (existing as any).id);
      } else {
        await supabase.from('seen_it_responses').insert({ set_id: setId, item_id: itemId, user_id: user.id, seen: seenValue });
      }
      if (item.external_id && item.external_source) {
        try {
          if (response === true) {
            await supabase.functions.invoke('track-media', { body: { media: { title: item.title, mediaType: item.media_type || 'movie', imageUrl: item.image_url, externalId: item.external_id, externalSource: item.external_source }, listType: 'finished', skip_social_post: true } });
          } else if (response === 'want_to') {
            await supabase.functions.invoke('track-media', { body: { media: { title: item.title, mediaType: item.media_type || 'movie', imageUrl: item.image_url, externalId: item.external_id, externalSource: item.external_source }, listType: 'queue', skip_social_post: true } });
          }
        } catch {}
      }
      return { itemId, response };
    },
    onSuccess: ({ itemId, response }) => {
      trackEvent('seen_it_response', { item_id: itemId, response: String(response) });
      queryClient.invalidateQueries({ queryKey: ['seen-it-responses'] });
      if (response === true || response === 'want_to') queryClient.invalidateQueries({ queryKey: ['/api/list-items'] });
    }
  });

  const saveSetCompletion = (setId: string, seenCount: number, totalCount: number) => {
    setCompletedSetIds(prev => {
      const next = new Set(prev);
      next.add(setId);
      try { localStorage.setItem('seen_it_completed_sets', JSON.stringify([...next])); } catch {}
      return next;
    });
    if (user?.id) {
      supabase.from('seen_it_completions').upsert({
        set_id: setId, user_id: user.id, seen_count: seenCount, total_count: totalCount,
        percentage: totalCount > 0 ? Math.round((seenCount / totalCount) * 100) : 0,
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id,set_id' });
    }
  };

  const handleResponse = (setId: string, item: SeenItItem, response: boolean | 'want_to' | 'skip') => {
    if (response !== 'skip') {
      const extKey = item.external_id ? `ext_${item.external_id}` : null;
      setLocalResponses(prev => {
        const next = { ...prev, [item.id]: response as boolean | 'want_to' };
        if (extKey) next[extKey] = response as boolean | 'want_to';
        try { localStorage.setItem('seen_it_responses', JSON.stringify(next)); } catch {}
        return next;
      });
      if (session) responseMutation.mutate({ setId, itemId: item.id, response: response as boolean | 'want_to', item });
    }
    // Advance to next unanswered item
    const currentSet = incompleteSets[currentSetIndex];
    if (!currentSet) return;
    const nextIndex = currentItemIndex + 1;
    if (nextIndex >= currentSet.items.length) {
      const seenCount = currentSet.items.filter(i => responses[i.id] === true || (response === true && i.id === item.id)).length;
      saveSetCompletion(currentSet.id, seenCount, currentSet.items.length);
    } else {
      setCurrentItemIndex(nextIndex);
    }
    setRatingItem(null);
    setDragX(0);
  };

  // ── Active item refs (kept current so event listeners aren't stale) ────────
  const activeItemRef = useRef<SeenItItem | null>(null);
  const activeSetIdRef = useRef<string>('');

  // ── Raw DOM gesture listeners (passive:false allows preventDefault) ────────
  useEffect(() => {
    const el = gestureRef.current;
    if (!el) return;

    const commit = (dx: number) => {
      const item = activeItemRef.current;
      const setId = activeSetIdRef.current;
      if (!item || !setId) { setDragX(0); currentDragX.current = 0; return; }
      if (dx > SWIPE_THRESHOLD) {
        // Fly card off-screen right, then record response
        setDragX(380); currentDragX.current = 380;
        setTimeout(() => { handleResponseRef.current(setId, item, true); }, 420);
      } else if (dx < -SWIPE_THRESHOLD) {
        // Fly card off-screen left, then record response
        setDragX(-380); currentDragX.current = -380;
        setTimeout(() => { handleResponseRef.current(setId, item, 'skip'); }, 420);
      } else {
        setDragX(0);
        currentDragX.current = 0;
      }
    };

    // ── Touch ──────────────────────────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      dragStartX.current = e.touches[0].clientX;
      dragStartY.current = e.touches[0].clientY;
      isDraggingRef.current = true;
      isScrollingRef.current = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.touches[0].clientX - dragStartX.current;
      const dy = e.touches[0].clientY - dragStartY.current;
      if (isScrollingRef.current === null) {
        isScrollingRef.current = Math.abs(dy) > Math.abs(dx) + 5;
      }
      if (isScrollingRef.current) return;
      e.preventDefault();
      currentDragX.current = dx;
      setDragX(dx);
    };
    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (!isScrollingRef.current) commit(currentDragX.current);
      else { setDragX(0); currentDragX.current = 0; }
    };

    // ── Mouse drag ─────────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragStartX.current = e.clientX;
      isDraggingRef.current = true;
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartX.current;
      currentDragX.current = dx;
      setDragX(dx);
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      commit(currentDragX.current);
    };

    // ── Trackpad two-finger horizontal swipe (wheel events) ───────────────
    const onWheel = (e: WheelEvent) => {
      // Only handle clear horizontal intent (deltaX dominant)
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) return;
      e.preventDefault();
      wheelAccum.current += e.deltaX;
      const clamped = Math.max(-SWIPE_THRESHOLD * 1.5, Math.min(SWIPE_THRESHOLD * 1.5, -wheelAccum.current));
      currentDragX.current = clamped;
      setDragX(clamped);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => {
        commit(currentDragX.current);
        wheelAccum.current = 0;
      }, 180);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    el.addEventListener('mousedown',  onMouseDown,  { passive: false });
    el.addEventListener('wheel',      onWheel,      { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('mousedown',  onMouseDown);
      el.removeEventListener('wheel',      onWheel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);

  // Keep a stable ref to handleResponse so event listeners don't go stale
  const handleResponseRef = useRef(handleResponse);
  useEffect(() => { handleResponseRef.current = handleResponse; });

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading && !mediaTypeFilter) {
    return (
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (!incompleteSets || incompleteSets.length === 0) return null;

  const currentSet = incompleteSets[currentSetIndex];
  if (!currentSet) return null;

  const mediaConfig = getMediaTypeConfig(currentSet.media_type);
  // Only show unanswered items as the swipe queue
  const unansweredItems = currentSet.items.filter(item => responses[item.id] === undefined);
  const totalItems = currentSet.items.length;
  const doneCount = totalItems - unansweredItems.length;

  if (unansweredItems.length === 0) {
    // All answered — advance to next set
    if (incompleteSets.length > 1) {
      setCurrentSetIndex(prev => (prev + 1) % incompleteSets.length);
    }
    return null;
  }

  const activeItem = unansweredItems[currentItemIndex] ?? unansweredItems[0];
  const activeIdx = unansweredItems.findIndex(i => i.id === activeItem.id);

  // Keep refs current so gesture event listeners always see fresh values
  activeItemRef.current = activeItem;
  activeSetIdRef.current = currentSet.id;

  const isSwipingRight = dragX > 20;
  const isSwipingLeft = dragX < -20;
  const isActiveDrag = isDraggingRef.current || Math.abs(dragX) > 2;

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-gray-900 font-semibold text-sm">Seen It?</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${mediaConfig.pillBg}`}>{mediaConfig.pill}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-500 text-xs font-medium">{doneCount + 1} of {totalItems}</span>
          {incompleteSets.length > 1 && (
            <button onClick={() => setCurrentSetIndex(prev => (prev + 1) % incompleteSets.length)}>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Card stack — gestureRef captures all touch/mouse/wheel events */}
      <div
        ref={gestureRef}
        className="relative flex items-center justify-center select-none"
        style={{ height: 310, overflow: 'visible', cursor: isActiveDrag ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      >
        {/* Left peek card */}
        {unansweredItems[activeIdx + 2] && (
          <div style={{
            position: 'absolute', width: 195, height: 282, borderRadius: 16, overflow: 'hidden',
            transform: 'translateX(-52px) rotate(-8deg) scale(0.88)',
            zIndex: 1, boxShadow: '0 4px 16px rgba(0,0,0,0.14)', pointerEvents: 'none',
          }}>
            <img src={unansweredItems[activeIdx + 2].image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Right peek card */}
        {unansweredItems[activeIdx + 1] && (
          <div style={{
            position: 'absolute', width: 195, height: 282, borderRadius: 16, overflow: 'hidden',
            transform: 'translateX(52px) rotate(8deg) scale(0.88)',
            zIndex: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.14)', pointerEvents: 'none',
          }}>
            <img src={unansweredItems[activeIdx + 1].image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Front card — follows drag; tap (no drag) navigates to media detail */}
        <div
          style={{
            position: 'absolute', width: 208, height: 282, borderRadius: 16, overflow: 'hidden',
            zIndex: 5, boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
            transform: `translateX(${dragX}px) rotate(${dragX * 0.06}deg)`,
            transition: isActiveDrag ? 'none' : Math.abs(dragX) > 300
              ? 'transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)'
              : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'auto',
            cursor: activeItem.external_id ? 'pointer' : 'grab',
          }}
          onClick={() => {
            // Only navigate on a genuine tap — not after a drag gesture
            if (Math.abs(dragX) < 10 && activeItem.external_id && activeItem.external_source) {
              const type = (activeItem.media_type || 'movie').toLowerCase();
              setLocation(`/media/${type}/${activeItem.external_source}/${activeItem.external_id}`);
            }
          }}
        >
          <img
            src={activeItem.image_url}
            alt={activeItem.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Gradient + title overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.25, margin: 0 }}>{activeItem.title}</p>
            {(activeItem as any).year && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '2px 0 0' }}>{(activeItem as any).year}</p>}
          </div>
          {/* SEEN overlay */}
          {isSwipingRight && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ border: '3px solid #22c55e', borderRadius: 8, padding: '4px 14px' }}>
                <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 22, letterSpacing: 2 }}>SEEN</span>
              </div>
            </div>
          )}
          {/* SKIP overlay */}
          {isSwipingLeft && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ border: '2px solid rgba(255,255,255,0.7)', borderRadius: 8, padding: '4px 14px' }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 22, letterSpacing: 2 }}>NEXT</span>
              </div>
            </div>
          )}
          {/* Rating stars overlay */}
          {ratingItem === activeItem.id && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.75)', padding: '12px 16px', display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'auto' }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onPointerDown={(e) => {
                  e.stopPropagation();
                  const newMap = { ...ratingMap, [activeItem.id]: star };
                  setRatingMap(newMap);
                  try { localStorage.setItem('seen_it_ratings', JSON.stringify(newMap)); } catch {}
                  handleResponse(currentSet.id, activeItem, true);
                }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', pointerEvents: 'auto' }}>
                  <Star size={28} className={star <= (ratingMap[activeItem.id] || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons: Next | Seen It | Add to list | Rate it */}
      <div className="flex items-center justify-around px-4 py-3">

        {/* Next — skip without recording */}
        <button
          onClick={() => handleResponse(currentSet.id, activeItem, 'skip')}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-active:scale-90 transition-all">
            <ChevronRight size={22} className="text-gray-500" />
          </div>
          <span className="text-[10px] text-gray-400">Next</span>
        </button>

        {/* Seen It — green, primary positive action */}
        <button
          onClick={() => handleResponse(currentSet.id, activeItem, true)}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center group-active:scale-90 transition-all shadow-md">
            <Check size={22} className="text-white" />
          </div>
          <span className="text-[10px] text-green-600 font-medium">{mediaConfig.actionYes}</span>
        </button>

        {/* Add to list — gray, secondary */}
        <button
          onClick={() => handleResponse(currentSet.id, activeItem, 'want_to')}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-active:scale-90 transition-all">
            <Plus size={20} className="text-gray-500" />
          </div>
          <span className="text-[10px] text-gray-400">Add to list</span>
        </button>

        {/* Rate it — gray, optional */}
        <button
          onClick={() => setRatingItem(prev => prev === activeItem.id ? null : activeItem.id)}
          className="flex flex-col items-center gap-1 group"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center group-active:scale-90 transition-all ${ratingItem === activeItem.id ? 'bg-yellow-400' : 'bg-gray-100'}`}>
            <Star size={20} className={ratingItem === activeItem.id ? 'text-white fill-white' : 'text-gray-500'} />
          </div>
          <span className={`text-[10px] font-medium ${ratingItem === activeItem.id ? 'text-yellow-500' : 'text-gray-400'}`}>Rate it</span>
        </button>

      </div>
    </div>
  );
}
