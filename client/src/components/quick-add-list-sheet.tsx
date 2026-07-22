import { useState, useRef, useEffect } from "react";
import { APP_BASE } from "@/lib/share";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, Check, Play, Clock, Ban, Heart, Folder, Star, MessageSquare, Share2, HelpCircle, Sparkles, TrendingUp, Minus, Plus, Search, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { JustTrackedSheet } from "./just-tracked-sheet";
import { ProgressUpdateSheet } from "./progress-update-sheet";

interface QuickAddListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    title: string;
    mediaType: string;
    imageUrl?: string;
    externalId?: string;
    externalSource?: string;
    creator?: string;
    seriesName?: string;
  } | null;
  onOpenHotTakeComposer?: (media: { title: string; mediaType: string; imageUrl?: string; externalId?: string; externalSource?: string }) => void;
  elevated?: boolean;
}

type SheetStep = 'select-list' | 'rate' | 'recommend' | 'just-tracked' | 'similar' | 'progress';

interface SimilarRec {
  id: string;
  title: string;
  imageUrl?: string;
  type: string;
  externalSource?: string;
}

export function QuickAddListSheet({ isOpen, onClose, media, onOpenHotTakeComposer, elevated }: QuickAddListSheetProps) {
  const zContent = elevated ? 'z-[100000]' : undefined;
  const zOverlay = elevated ? 'z-[100000]' : undefined;
  const { session } = useAuth();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [step, setStep] = useState<SheetStep>('select-list');
  const [addedListName, setAddedListName] = useState<string>('');
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const [inlineQuery, setInlineQuery] = useState('');
  const [inlineSelectedMedia, setInlineSelectedMedia] = useState<{ title: string; mediaType: string; imageUrl?: string; externalId?: string; externalSource?: string; creator?: string; seriesName?: string } | null>(null);
  const [showInlineResults, setShowInlineResults] = useState(false);
  const inlineSearchRef = useRef<HTMLInputElement>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [similarRecs, setSimilarRecs] = useState<SimilarRec[]>([]);
  const [addedListId, setAddedListId] = useState<string | null>(null);
  const [addingRecId, setAddingRecId] = useState<string | null>(null);
  const [addedRecIds, setAddedRecIds] = useState<Set<string>>(new Set());
  const [progressMode, setProgressMode] = useState<'percent' | 'episode' | 'page' | 'minutes'>('percent');
  const [progressValue, setProgressValue] = useState<number>(0);
  const [progressTotal, setProgressTotal] = useState<number>(0);
  const [progressSeason, setProgressSeason] = useState<number>(1);
  const [progressEpisode, setProgressEpisode] = useState<number>(1);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [progressLibraryId, setProgressLibraryId] = useState<string | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  const REQUIRED_SYSTEM_LISTS = ['Currently', 'Want To', 'Finished', 'Did Not Finish', 'Favorites'];

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
      const existingTitles = new Set(lists.map((l: any) => l.title));
      const missingSystemLists = REQUIRED_SYSTEM_LISTS.filter(t => !existingTitles.has(t));
      
      if (missingSystemLists.length > 0) {
        console.log('📋 Missing system lists, adding placeholders:', missingSystemLists);
        for (const title of missingSystemLists) {
          lists.push({ id: `__placeholder_${title}`, title, is_default: true, is_private: false });
        }
      }
      
      return { ...data, lists };
    },
    enabled: !!session?.access_token && isOpen,
  });

  const userLists = userListsData?.lists || [];

  const { data: inlineSearchResults = [] } = useQuery<any[]>({
    queryKey: ['quick-add-list-inline-search', inlineQuery],
    queryFn: async () => {
      if (!inlineQuery.trim() || !session?.access_token) return [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const res = await fetch(`${supabaseUrl}/functions/v1/media-search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: inlineQuery }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || []).slice(0, 6);
    },
    enabled: !!inlineQuery.trim() && !!session?.access_token && isOpen && !media,
    staleTime: 30_000,
  });

  const handleClose = () => {
    setStep('select-list');
    setAddedListName('');
    setAddedItemId(null);
    setSelectedRating(0);
    setHoveredRating(0);
    setSimilarRecs([]);
    setAddedListId(null);
    setAddingRecId(null);
    setAddedRecIds(new Set());
    setProgressLibraryId(null);
    setIsLoadingProgress(false);
    setInlineQuery('');
    setInlineSelectedMedia(null);
    setShowInlineResults(false);
    onClose();
  };

  const effectiveMedia = media || inlineSelectedMedia;

  const isWantToList = (listName: string) => {
    const lower = listName.toLowerCase();
    return lower.includes('want') || lower.includes('queue');
  };

  const fetchSimilarRecs = async (mediaType: string, excludeExternalId?: string) => {
    try {
      if (!session?.access_token) return false;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-recommendations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 12 }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const recs = (data.recommendations || data.items || []).map((item: any) => ({
        id: item.id || item.external_id,
        title: item.title,
        imageUrl: item.imageUrl || item.image_url || item.poster_url,
        type: (item.type || item.media_type || 'movie').toLowerCase(),
        externalSource: item.external_source || 'tmdb',
      })) as SimilarRec[];
      const typeLower = (mediaType || '').toLowerCase();
      const sameType = recs.filter(r => r.title && r.id && r.id !== excludeExternalId && r.type === typeLower);
      const pool = sameType.length >= 3 ? sameType : recs.filter(r => r.title && r.id && r.id !== excludeExternalId);
      if (pool.length === 0) return false;
      setSimilarRecs(pool.slice(0, 4));
      return true;
    } catch (err) {
      console.warn('Failed to fetch recommendations:', err);
      return false;
    }
  };

  const handleAddRecToList = async (rec: SimilarRec) => {
    if (!session?.access_token || !addedListId || addedListId.startsWith('__placeholder_')) return;
    setAddingRecId(rec.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: addedListId,
          media_title: rec.title,
          media_type: rec.type,
          media_creator: '',
          media_image_url: rec.imageUrl || '',
          media_external_id: rec.id,
          media_external_source: rec.externalSource || 'tmdb',
        }),
      });
      if (!response.ok) throw new Error('Failed to add');
      setAddedRecIds(prev => new Set(prev).add(rec.id));
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
    } catch (error: any) {
      toast({ title: error.message || 'Failed to add', variant: 'destructive' });
    } finally {
      setAddingRecId(null);
    }
  };

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

  const getDisplayName = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('queue') || lower.includes('want')) {
      return 'Want To (Read, Listen, etc)';
    }
    return title;
  };

  const isKnownDefaultList = (title: string) => {
    const lower = (title || '').toLowerCase();
    return lower.includes('currently') || lower.includes('want') ||
           lower.includes('finished') || lower.includes('not finish') ||
           lower.includes('favorite');
  };

  const sortedLists = [...userLists].filter((list: any) => list.is_default && isKnownDefaultList(list.title || list.name)).sort((a, b) => {
    const aStyle = getListStyle(a.title || a.name);
    const bStyle = getListStyle(b.title || b.name);
    return aStyle.priority - bStyle.priority;
  });

  const shouldShowFollowUp = (listName: string) => {
    const lower = listName.toLowerCase();
    return lower.includes('finished') || lower.includes('complete') || 
           lower.includes('favorite') || lower.includes('favorites');
  };

  const handleAddToList = async (listId: string, listName: string) => {
    if (!session?.access_token || !effectiveMedia) {
      if (!effectiveMedia) inlineSearchRef.current?.focus();
      return;
    }
    
    setIsAdding(listId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      let actualListId = listId;
      if (listId.startsWith('__placeholder_')) {
        console.log('📋 Creating missing system list:', listName);
        const createResponse = await fetch(`${supabaseUrl}/functions/v1/create-custom-list`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: listName,
            is_default: true,
            is_private: false,
          }),
        });
        const createData = await createResponse.json();
        if (createData?.list?.id) {
          actualListId = createData.list.id;
          console.log('📋 Created system list:', actualListId);
        } else if (createData?.id) {
          actualListId = createData.id;
        } else {
          throw new Error('Failed to create list');
        }
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: actualListId,
          media_title: effectiveMedia.title,
          media_type: effectiveMedia.mediaType,
          media_creator: effectiveMedia.creator || '',
          media_image_url: effectiveMedia.imageUrl || '',
          media_external_id: effectiveMedia.externalId,
          media_external_source: effectiveMedia.externalSource || 'tmdb',
          ...(effectiveMedia.seriesName ? { series_name: effectiveMedia.seriesName } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add to list');
      }

      const responseData = await response.json().catch(() => ({}));
      if (responseData?.data?.id) setAddedItemId(responseData.data.id);

      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      
      setAddedListName(listName);
      setAddedListId(actualListId);
      if (isWantToList(listName) && effectiveMedia?.mediaType) {
        const hasRecs = await fetchSimilarRecs(effectiveMedia.mediaType, effectiveMedia.externalId);
        if (hasRecs) {
          setStep('similar');
        } else {
          setStep('just-tracked');
        }
      } else if (shouldShowFollowUp(listName) && effectiveMedia?.externalId) {
        setStep('rate');
      } else {
        setStep('just-tracked');
      }
    } catch (error: any) {
      toast({ title: error.message || "Failed to add", variant: "destructive" });
    } finally {
      setIsAdding(null);
    }
  };

  const handleSubmitRating = async () => {
    if (!session?.access_token || !media || selectedRating === 0) return;
    if (!media.externalId) {
      setStep('recommend');
      return;
    }
    
    setIsSubmittingRating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_external_id: media.externalId,
          media_external_source: media.externalSource || 'tmdb',
          media_title: media.title,
          media_type: media.mediaType || 'movie',
          media_image_url: media.imageUrl || '',
          rating: selectedRating,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('Rate media failed:', response.status, errText);
        throw new Error('Failed to submit rating');
      }

      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      setStep('recommend');
    } catch (error: any) {
      toast({ title: error.message || "Failed to rate", variant: "destructive" });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleShare = async () => {
    if (!media) return;
    
    const shareText = `I just added "${media.title}" to my ${addedListName} on Consumed! Check it out.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${media.title} on Consumed`,
          text: shareText,
          url: APP_BASE,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Copied to clipboard!" });
    }
    handleClose();
  };

  if (step === 'rate') {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className={`bg-white rounded-t-2xl ${zContent || ''}`} overlayClassName={zOverlay}>
          <DrawerHeader className="text-center pb-2 border-b border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="text-green-600" size={18} />
              </div>
              <DrawerTitle className="text-lg font-semibold text-gray-900">
                Done!
              </DrawerTitle>
            </div>
            {media && (
              <p className="text-sm text-gray-500">
                Added <span className="font-medium text-gray-700">{media.title}</span> to {addedListName}
              </p>
            )}
          </DrawerHeader>
          
          <div className="px-4 py-6 space-y-6">
            <div className="text-center">
              <p className="text-gray-700 font-medium mb-4">How would you rate this?</p>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const activeRating = hoveredRating || selectedRating;
                  const isFullFilled = activeRating >= star;
                  const isHalfFilled = activeRating >= star - 0.5 && activeRating < star;
                  
                  return (
                    <div
                      key={star}
                      className="relative p-1 cursor-pointer transition-transform hover:scale-110"
                      data-testid={`followup-star-${star}`}
                    >
                      <Star
                        size={32}
                        className="text-gray-300"
                      />
                      {(isFullFilled || isHalfFilled) && (
                        <div 
                          className="absolute inset-0 p-1 overflow-hidden"
                          style={{ width: isHalfFilled ? '50%' : '100%' }}
                        >
                          <Star
                            size={32}
                            className="text-yellow-400 fill-yellow-400"
                          />
                        </div>
                      )}
                      <div
                        className="absolute inset-0 flex"
                        onMouseLeave={() => setHoveredRating(0)}
                      >
                        <div
                          className="w-1/2 h-full"
                          onMouseEnter={() => setHoveredRating(star - 0.5)}
                          onClick={() => setSelectedRating(star - 0.5)}
                        />
                        <div
                          className="w-1/2 h-full"
                          onMouseEnter={() => setHoveredRating(star)}
                          onClick={() => setSelectedRating(star)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedRating > 0 && (
                <p className="text-sm text-gray-500 mt-2">{selectedRating} stars</p>
              )}
              {selectedRating > 0 && (
                <button
                  onClick={handleSubmitRating}
                  disabled={isSubmittingRating}
                  className="mt-3 px-6 py-2 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                  data-testid="submit-rating-btn"
                >
                  {isSubmittingRating ? (
                    <Loader2 className="animate-spin inline" size={16} />
                  ) : (
                    "Submit Rating"
                  )}
                </button>
              )}
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              data-testid="skip-rating-btn"
            >
              Skip for now
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (step === 'similar' && similarRecs.length > 0) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className={`bg-white rounded-t-2xl ${zContent || ''}`} overlayClassName={zOverlay}>
          <DrawerHeader className="text-center pb-2 border-b border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="text-green-600" size={18} />
              </div>
              <DrawerTitle className="text-lg font-semibold text-gray-900">
                Added!
              </DrawerTitle>
            </div>
            {effectiveMedia && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">{effectiveMedia.title}</span> added to {addedListName}
              </p>
            )}
          </DrawerHeader>

          <div className="px-4 py-4 space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-purple-500" />
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">You might also like</span>
              </div>

              <div className="space-y-2">
                {similarRecs.map((rec) => {
                  const isAdded = addedRecIds.has(rec.id);
                  const isBusy = addingRecId === rec.id;
                  return (
                    <div key={rec.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-2">
                      {rec.imageUrl ? (
                        <img src={rec.imageUrl} alt={rec.title} className="w-10 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{rec.title}</p>
                        <p className="text-[11px] text-gray-400 capitalize">{rec.type}</p>
                      </div>
                      <button
                        onClick={() => !isAdded && !isBusy && handleAddRecToList(rec)}
                        disabled={isAdded || isBusy}
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isAdded ? 'bg-green-100' : 'bg-purple-600'}`}
                      >
                        {isBusy ? (
                          <Loader2 size={14} className="animate-spin text-white" />
                        ) : isAdded ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <Plus size={14} className="text-white" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              Done
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }


  const handleSaveProgress = async () => {
    if (!session?.access_token || !media?.externalId) { handleClose(); return; }
    setIsSavingProgress(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const { data: items } = await supabase
        .from('library_items')
        .select('id')
        .eq('external_id', media.externalId)
        .limit(1);
      if (items && items.length > 0) {
        let progress = progressValue;
        let total: number | undefined = progressTotal || undefined;
        if (progressMode === 'episode') {
          progress = progressEpisode;
          total = progressSeason;
        }
        await fetch(`${supabaseUrl}/functions/v1/update-item-progress`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: items[0].id, progress, progress_total: total, progress_mode: progressMode === 'minutes' ? 'percent' : progressMode }),
        });
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      }
    } catch (_) {}
    finally { setIsSavingProgress(false); }
    handleClose();
  };


  if (step === 'recommend') {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent className={`bg-white rounded-t-2xl ${zContent || ''}`} overlayClassName={zOverlay}>
          <DrawerHeader className="text-center pb-2 border-b border-gray-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    className={
                      selectedRating >= star
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
            </div>
            <DrawerTitle className="text-lg font-semibold text-gray-900">
              Recommend this?
            </DrawerTitle>
            {media && (
              <p className="text-sm text-gray-500 mt-1">
                Share <span className="font-medium text-gray-700">{media.title}</span> with others
              </p>
            )}
          </DrawerHeader>
          
          <div className="px-4 py-6 space-y-3">
            <button
              onClick={handleShare}
              className="w-full p-4 text-left rounded-lg bg-purple-50 hover:bg-purple-100 flex items-center gap-3 transition-colors"
              data-testid="share-link-btn"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Share2 className="text-purple-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Share with a friend</p>
                <p className="text-sm text-gray-500">Send a link to someone</p>
              </div>
            </button>

            <button
              onClick={handleClose}
              className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              data-testid="skip-recommend-btn"
            >
              Maybe later
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <>
      <Drawer open={isOpen && step === 'select-list'} onOpenChange={(open) => !open && step === 'select-list' && handleClose()}>
        <DrawerContent className={`bg-white rounded-t-2xl ${zContent || ''}`} overlayClassName={zOverlay}>
          <DrawerHeader className="pb-2 border-b border-gray-100">
            <DrawerTitle className="text-lg font-semibold text-gray-900 text-center">
              Add to List
            </DrawerTitle>
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
                      onChange={(e) => { setInlineQuery(e.target.value); setShowInlineResults(true); }}
                      onFocus={() => setShowInlineResults(true)}
                      placeholder="Select media..."
                      className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200"
                    />
                  </div>
                )}
                {showInlineResults && inlineSearchResults.length > 0 && !inlineSelectedMedia && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {inlineSearchResults.map((r: any, i: number) => {
                      const poster = r.poster_url || r.image || '';
                      return (
                        <button
                          key={`${r.external_id}-${i}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setInlineSelectedMedia({
                              title: r.title,
                              mediaType: r.type === 'book_series' ? 'book' : (r.type || 'movie'),
                              imageUrl: poster,
                              externalId: r.external_id,
                              externalSource: r.external_source === 'openai' ? 'openlibrary' : (r.external_source || 'tmdb'),
                              creator: r.creator,
                            });
                            setInlineQuery(r.title);
                            setShowInlineResults(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                        >
                          {poster && <img src={poster} alt="" className="w-7 h-9 object-cover rounded flex-shrink-0" onError={(e) => { e.currentTarget.style.display='none'; }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                            <p className="text-xs text-gray-400 capitalize">{r.type === 'tv' ? 'TV Show' : r.type}{r.year ? ` · ${r.year}` : ''}</p>
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
            {isLoadingLists ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-purple-500" size={24} />
              </div>
            ) : userLists.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No lists yet</p>
                <p className="text-sm mt-1">Create a list to start tracking</p>
              </div>
            ) : (
              sortedLists.map((list: any) => {
                const style = getListStyle(list.title || list.name);
                const listName = list.title || list.name;
                const displayName = getDisplayName(listName);
                const isAddingThis = isAdding === list.id;
                
                return (
                  <button
                    key={list.id}
                    onClick={() => handleAddToList(list.id, listName)}
                    disabled={isAdding !== null}
                    className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                    data-testid={`list-option-${list.id}`}
                  >
                    <div className={`w-10 h-10 ${style.bg} rounded-full flex items-center justify-center`}>
                      {isAddingThis ? (
                        <Loader2 className="animate-spin text-purple-600" size={20} />
                      ) : (
                        style.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{displayName}</p>
                      <p className="text-sm text-gray-500">{style.desc}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <JustTrackedSheet
        isOpen={step === 'just-tracked' && isOpen}
        elevated={elevated}
        onClose={handleClose}
        media={media ? {
          title: media.title,
          mediaType: media.mediaType,
          imageUrl: media.imageUrl,
          externalId: media.externalId,
          externalSource: media.externalSource,
          creator: media.creator,
        } : null}
        listName={addedListName}
        onDropHotTake={onOpenHotTakeComposer && media ? () => {
          const mediaData = {
            title: media.title,
            mediaType: media.mediaType,
            imageUrl: media.imageUrl,
            externalId: media.externalId,
            externalSource: media.externalSource,
          };
          handleClose();
          onOpenHotTakeComposer(mediaData);
        } : undefined}
        onRateIt={() => {
          const isCurrently = addedListName?.toLowerCase().includes('current');
          if (isCurrently) {
            const mt = media?.mediaType?.toLowerCase() || '';
            if (mt === 'tv' || mt.includes('series') || mt.includes('show')) setProgressMode('episode');
            else if (mt === 'book') setProgressMode('page');
            else if (mt === 'music' || mt === 'podcast') setProgressMode('minutes');
            else setProgressMode('percent');
            setProgressValue(0);
            setProgressTotal(0);
            setProgressSeason(1);
            setProgressEpisode(1);
            setStep('progress');
          } else {
            setStep('rate');
          }
        }}
        showRateOption={true}
      />

      {media && (
        <ProgressUpdateSheet
          isOpen={step === 'progress' && isOpen}
          elevated={elevated}
          onOpenChange={(open) => { if (!open) handleClose(); }}
          item={{
            id: addedItemId || undefined,
            title: media.title || '',
            image_url: media.imageUrl,
            media_type: media.mediaType || '',
            external_id: media.externalId,
            external_source: media.externalSource,
          }}
          onProgressSaved={handleClose}
        />
      )}
    </>
  );
}
