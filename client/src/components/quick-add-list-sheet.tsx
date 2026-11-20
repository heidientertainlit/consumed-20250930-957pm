import { useState, useRef, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { X, Loader2, Check, Play, Clock, Ban, Heart, Folder, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MEDIA_SEARCH_FILTERS, requestMediaSearch } from "@/components/media-search-panel";
import { loadSavedMediaListIds } from "@/lib/saved-media-lists";
import { showMediaAdded } from "@/lib/media-added-confirmation";

type MediaTypeFilter = (typeof MEDIA_SEARCH_FILTERS)[number]["value"];

interface QuickAddListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    title: string;
    mediaType: string;
    imageUrl?: string;
    externalId?: string;
    externalSource?: string;
    mediaSubtype?: string;
    creator?: string;
    seriesName?: string;
  } | null;
  onOpenHotTakeComposer?: (media: { title: string; mediaType: string; imageUrl?: string; externalId?: string; externalSource?: string }) => void;
  elevated?: boolean;
}

const REQUIRED_SYSTEM_LISTS = ['Currently', 'Want To', 'Finished', 'Did Not Finish', 'Favorites'];

export function QuickAddListSheet({ isOpen, onClose, media, elevated }: QuickAddListSheetProps) {
  const zContent = elevated ? 'z-[100000]' : undefined;
  const zOverlay = elevated ? 'z-[100000]' : undefined;
  const { session } = useAuth();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const submissionRef = useRef(false);
  const [inlineQuery, setInlineQuery] = useState('');
  const [inlineSelectedMedia, setInlineSelectedMedia] = useState<QuickAddListSheetProps["media"]>(null);
  const [showInlineResults, setShowInlineResults] = useState(false);
  const inlineSearchRef = useRef<HTMLInputElement>(null);
  const [inlineSearchResults, setInlineSearchResults] = useState<any[]>([]);
  const [isInlineSearching, setIsInlineSearching] = useState(false);
  const [inlineMediaTypeFilter, setInlineMediaTypeFilter] = useState<MediaTypeFilter>(undefined);
  const inlineSearchAbortRef = useRef<AbortController | null>(null);
  const inlineSearchRequestId = useRef(0);

  const { data: userListsData, isLoading: isLoadingLists } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user lists');
      const data = await response.json();
      const lists = data?.lists || [];
      const existingTitles = new Set(lists.map((list: any) => list.title));
      for (const title of REQUIRED_SYSTEM_LISTS.filter(title => !existingTitles.has(title))) {
        lists.push({ id: `__placeholder_${title}`, title, is_default: true, is_private: false });
      }
      return { ...data, lists };
    },
    enabled: !!session?.access_token && isOpen,
  });
  const userLists = userListsData?.lists || [];

  useEffect(() => {
    const query = inlineQuery.trim();
    inlineSearchAbortRef.current?.abort();
    const requestId = ++inlineSearchRequestId.current;
    if (query.length < 2 || !isOpen || media) {
      setInlineSearchResults([]);
      setIsInlineSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      const bearer = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!bearer) return;
      const controller = new AbortController();
      inlineSearchAbortRef.current = controller;
      setIsInlineSearching(true);
      try {
        const results = await requestMediaSearch({ query, type: inlineMediaTypeFilter, bearer, signal: controller.signal });
        if (requestId === inlineSearchRequestId.current) setInlineSearchResults(results.slice(0, 6));
      } catch (error) {
        if (!controller.signal.aborted) console.error("Media search error:", error);
      } finally {
        if (requestId === inlineSearchRequestId.current) setIsInlineSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [inlineQuery, inlineMediaTypeFilter, isOpen, media, session?.access_token]);

  useEffect(() => () => inlineSearchAbortRef.current?.abort(), []);

  const handleClose = () => {
    if (submissionRef.current) return;
    setInlineQuery('');
    setInlineSelectedMedia(null);
    setShowInlineResults(false);
    setInlineSearchResults([]);
    setInlineMediaTypeFilter(undefined);
    onClose();
  };

  const effectiveMedia = media || inlineSelectedMedia;
  const { data: savedListIds = [], isError: savedStatusError } = useQuery({
    queryKey: ['lists-containing-media', 'quick-add', session?.user?.id, effectiveMedia?.externalSource || 'tmdb', effectiveMedia?.externalId],
    queryFn: () => loadSavedMediaListIds(
      supabase, session!.user.id, effectiveMedia!.externalId!, effectiveMedia!.externalSource || 'tmdb',
    ),
    enabled: isOpen && !!session?.user?.id && !!effectiveMedia?.externalId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const getListStyle = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('queue') || lower.includes('want')) {
      return { bg: 'bg-blue-100', icon: <Clock className="text-blue-600" size={20} />, desc: 'Read, Listen, Watch later', priority: 0 };
    }
    if (lower.includes('currently') || lower.includes('watching') || lower.includes('reading')) {
      return { bg: 'bg-purple-100', icon: <Play className="text-purple-600" size={20} />, desc: 'Currently consuming', priority: 1 };
    }
    if (lower.includes('finished') || lower.includes('complete')) {
      return { bg: 'bg-green-100', icon: <Check className="text-green-600" size={20} />, desc: 'Completed media', priority: 2 };
    }
    if (lower.includes('dnf') || lower.includes('not finish')) {
      return { bg: 'bg-red-100', icon: <Ban className="text-red-600" size={20} />, desc: 'Stopped watching/reading', priority: 3 };
    }
    if (lower.includes('favorite')) {
      return { bg: 'bg-yellow-100', icon: <Heart className="text-yellow-600" size={20} />, desc: 'Your favorites', priority: 4 };
    }
    return { bg: 'bg-purple-100', icon: <Folder className="text-purple-600" size={20} />, desc: 'Custom list', priority: 5 };
  };
  const getDisplayName = (title: string) =>
    title.toLowerCase().includes('queue') || title.toLowerCase().includes('want') ? 'Want To (Read, Listen, etc)' : title;
  const isKnownDefaultList = (title: string) => {
    const lower = (title || '').toLowerCase();
    return lower.includes('currently') || lower.includes('want') ||
      lower.includes('finished') || lower.includes('not finish') || lower.includes('favorite');
  };
  const sortedLists = [...userLists]
    .filter((list: any) => list.is_default && isKnownDefaultList(list.title || list.name))
    .sort((a, b) => getListStyle(a.title || a.name).priority - getListStyle(b.title || b.name).priority);

  const handleAddToList = async (listId: string, listName: string) => {
    if (submissionRef.current) return;
    if (!session?.access_token || !effectiveMedia) {
      if (!effectiveMedia) inlineSearchRef.current?.focus();
      return;
    }
    submissionRef.current = true;
    setIsAdding(listId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      let actualListId = listId;
      if (listId.startsWith('__placeholder_')) {
        const createResponse = await fetch(`${supabaseUrl}/functions/v1/create-custom-list`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: listName, is_default: true, is_private: false }),
        });
        if (!createResponse.ok) throw new Error('Failed to create list');
        const createData = await createResponse.json();
        actualListId = createData?.list?.id || createData?.id;
        if (!actualListId) throw new Error('Failed to create list');
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
        queryClient.invalidateQueries({ queryKey: ['lists-containing-media'] });
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: actualListId,
          media_title: effectiveMedia.title,
          media_type: effectiveMedia.mediaType,
          media_creator: effectiveMedia.creator || '',
          media_image_url: effectiveMedia.imageUrl || '',
          media_external_id: effectiveMedia.externalId,
          media_external_source: effectiveMedia.externalSource || 'tmdb',
          ...(effectiveMedia.mediaSubtype ? { media_subtype: effectiveMedia.mediaSubtype } : {}),
          ...(effectiveMedia.seriesName ? { series_name: effectiveMedia.seriesName } : {}),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add to list');
      }

      // Preserve creator-following and status-list movement independently of feedback.
      if ((effectiveMedia.externalSource || '') === 'youtube' &&
          effectiveMedia.externalId && /^UC[\w-]{22}$/.test(effectiveMedia.externalId)) {
        fetch(`${supabaseUrl}/functions/v1/follow-creator`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'follow', creatorName: effectiveMedia.title, creatorRole: 'YouTuber',
            creatorImage: effectiveMedia.imageUrl || '', externalId: effectiveMedia.externalId, externalSource: 'youtube',
          }),
        }).catch(() => {});
      }
      try {
        const { data: authUser } = await supabase.auth.getUser();
        const uid = authUser?.user?.id;
        if (uid && effectiveMedia.externalId) {
          const { data: otherItems } = await supabase.from('list_items')
            .select('id, list_id, lists!inner ( id, title, is_default )')
            .eq('user_id', uid).eq('external_id', effectiveMedia.externalId)
            .eq('external_source', effectiveMedia.externalSource || 'tmdb').neq('list_id', actualListId);
          const staleStatusItems = (otherItems || []).filter((item: any) =>
            item.lists?.is_default && isKnownDefaultList(item.lists.title || ''));
          await Promise.all(staleStatusItems.map((item: any) =>
            fetch(`${supabaseUrl}/functions/v1/delete-list-item`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: item.id }),
            })));
        }
      } catch (error) {
        console.error('Failed to remove from previous status list:', error);
      }
      for (const key of ['user-lists-with-media', 'lists-containing-media', 'social-feed', 'feed']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      showMediaAdded({ title: effectiveMedia.title, listName });
      submissionRef.current = false;
      handleClose();
    } catch (error: any) {
      toast({ title: error.message || "Failed to add", variant: "destructive" });
    } finally {
      submissionRef.current = false;
      setIsAdding(null);
    }
  };

  return (
    <Drawer layered open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent className={`bg-white rounded-t-2xl ${zContent || ''}`} overlayClassName={zOverlay}>
        <DrawerHeader className="pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900 text-center">Add to List</DrawerTitle>
          {media ? (
            <p className="text-sm text-gray-500 mt-1 text-center">{media.title}</p>
          ) : (
            <div className="mt-2 relative">
              {inlineSelectedMedia ? (
                <button
                  onClick={() => { setInlineSelectedMedia(null); setInlineQuery(''); setShowInlineResults(false); setTimeout(() => inlineSearchRef.current?.focus(), 50); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-left"
                >
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{inlineSelectedMedia.title}</span>
                  <X size={14} className="text-gray-400 flex-shrink-0" />
                </button>
              ) : (
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={inlineSearchRef}
                    value={inlineQuery}
                    onChange={(event) => { setInlineQuery(event.target.value); setShowInlineResults(true); }}
                    onFocus={() => setShowInlineResults(true)}
                    placeholder="Select media..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200"
                  />
                </div>
              )}
              {!inlineSelectedMedia && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filter media type">
                  {MEDIA_SEARCH_FILTERS.map(({ value, label }) => (
                    <button key={value || "all"} type="button" aria-pressed={inlineMediaTypeFilter === value}
                      onClick={() => setInlineMediaTypeFilter(value)}
                      className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-medium ${inlineMediaTypeFilter === value ? "border-purple-600 bg-purple-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {isInlineSearching && !inlineSelectedMedia && (
                <Loader2 className="absolute right-3 top-3 animate-spin text-purple-600" size={15} />
              )}
              {showInlineResults && inlineSearchResults.length > 0 && !inlineSelectedMedia && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                  {inlineSearchResults.map((result: any, index: number) => {
                    const poster = result.poster_url || result.image || '';
                    return (
                      <button key={`${result.external_id}-${index}`} onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setInlineSelectedMedia({
                            title: result.title, mediaType: result.type === 'book_series' ? 'book' : (result.type || 'movie'),
                            imageUrl: poster, externalId: result.external_id,
                            externalSource: result.external_source === 'openai' ? 'openlibrary' : (result.external_source || 'tmdb'),
                            creator: result.creator,
                          });
                          setInlineQuery(result.title);
                          setShowInlineResults(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                        {poster && <img src={poster} alt="" className="w-7 h-9 object-cover rounded flex-shrink-0" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                          <p className="text-xs text-gray-400 capitalize">{result.type === 'tv' ? 'TV Show' : result.type}{result.year ? ` · ${result.year}` : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DrawerHeader>
        <div className="px-4 pt-4 max-h-[60vh] overflow-y-auto space-y-2" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
          {savedStatusError && <p role="status" className="px-4 text-xs text-gray-500">Saved status unavailable. You can still add to a list.</p>}
          {isLoadingLists ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-500" size={24} /></div>
          ) : userLists.length === 0 ? (
            <div className="text-center py-8 text-gray-500"><p>No lists yet</p><p className="text-sm mt-1">Create a list to start tracking</p></div>
          ) : sortedLists.map((list: any) => {
            const style = getListStyle(list.title || list.name);
            const listName = list.title || list.name;
            const isAlreadySaved = savedListIds.includes(list.id);
            return (
              <button key={list.id} onClick={() => handleAddToList(list.id, listName)} disabled={isAdding !== null}
                className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                data-testid={`list-option-${list.id}`}>
                <div className={`w-10 h-10 ${style.bg} rounded-full flex items-center justify-center`}>
                  {isAdding === list.id ? <Loader2 className="animate-spin text-purple-600" size={20} /> : style.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{getDisplayName(listName)}</p>
                  <p className="text-sm text-gray-500">{isAlreadySaved ? `Already in ${listName}` : style.desc}</p>
                </div>
                {isAlreadySaved && <Check aria-hidden="true" className="shrink-0 text-green-600" size={20} />}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
