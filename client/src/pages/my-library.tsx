import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search as SearchIcon, Loader2, Film, Music, BookOpen, Tv, Mic, Gamepad2, Clock, Plus, Download, Share2, Lock, List, ChevronRight, Calendar, Play, Trophy, LayoutGrid, Activity, MessageSquarePlus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import CreateListDialog from "@/components/create-list-dialog";
import { supabase } from "@/lib/supabase";
import { CurrentlyConsumingCard } from "@/components/currently-consuming-card";
import { QuickAddModal } from "@/components/quick-add-modal";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";

export default function MyLibrary() {
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [librarySearchFocused, setLibrarySearchFocused] = useState(false);
  const [listSheetMedia, setListSheetMedia] = useState<any>(null);
  const [isListSheetOpen, setIsListSheetOpen] = useState(false);
  const [composerMedia, setComposerMedia] = useState<any>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'in-progress' | 'lists' | 'all-media'>('in-progress');
  const [listSearch, setListSearch] = useState('');
  const [mediaHistorySearch, setMediaHistorySearch] = useState('');
  const [mediaHistoryType, setMediaHistoryType] = useState('all');
  const [mediaHistoryYear, setMediaHistoryYear] = useState('all');
  const [mediaHistoryRating, setMediaHistoryRating] = useState('all');
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [historyViewMode, setHistoryViewMode] = useState<'list' | 'grid'>('list');
  const [isGeneratingHistoryImage, setIsGeneratingHistoryImage] = useState(false);
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const { data: librarySearchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['library-media-search', librarySearchQuery],
    queryFn: async () => {
      if (!librarySearchQuery.trim() || !session?.access_token) return [];
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query: librarySearchQuery }),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!librarySearchQuery.trim() && !!session?.access_token,
    staleTime: 1000 * 60 * 5,
  });

  const { data: userStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['user-stats-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return null;
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-stats?user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.stats;
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

  const { data: userLists = [], isLoading: isLoadingLists } = useQuery({
    queryKey: ['user-lists-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      const { data, error } = await supabase
        .from('lists')
        .select(`
          id,
          title,
          is_default,
          visibility,
          list_items(id)
        `)
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (error) return [];
      return (data || []).map((list: any) => ({
        ...list,
        items: list.list_items || [],
      }));
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

  const { data: fullMediaHistory = [], isLoading: isLoadingFullHistory } = useQuery({
    queryKey: ['full-media-history-dna', user?.email],
    queryFn: async () => {
      if (!session?.access_token || !user?.email) {
        return [];
      }
      
      const { data: appUser, error: appUserError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (appUserError || !appUser) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          *,
          lists!inner(user_id, title)
        `)
        .eq('lists.user_id', appUser.id)
        .order('id', { ascending: false })
        .limit(100);
      if (error) {
        return [];
      }
      return (data || []).map((item: any) => ({
        ...item,
        listName: item.lists?.title || 'Unknown'
      }));
    },
    enabled: !!session?.access_token && !!user?.email,
    staleTime: 60000,
  });

  const [currentlyItems, setCurrentlyItems] = useState<any[]>([]);
  const [isLoadingCurrently, setIsLoadingCurrently] = useState(false);

  const fetchCurrentlyItems = async () => {
    if (!session?.access_token || !user?.id) return;
    setIsLoadingCurrently(true);
    try {
      const url = `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const currentlyList = (data.lists || []).find((list: any) => list.title === 'Currently');
        setCurrentlyItems(currentlyList?.items?.slice(0, 10) || []);
      }
    } catch (error) {
      console.error('Error fetching currently items:', error);
    } finally {
      setIsLoadingCurrently(false);
    }
  };

  useEffect(() => {
    if (session?.access_token && user?.id) {
      fetchCurrentlyItems();
    }
  }, [session?.access_token, user?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.access_token && user?.id) {
        fetchCurrentlyItems();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session?.access_token, user?.id]);

  const updateProgressMutation = useMutation({
    mutationFn: async ({ itemId, progress, total, mode, progressDisplay }: { itemId: string; progress: number; total?: number; mode: string; progressDisplay: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const payload = {
        item_id: itemId,
        progress,
        progress_total: total,
        progress_mode: mode,
      };
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData?.error || 'Failed to update progress');
      return { ...responseData, progressDisplay };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchCurrentlyItems();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    },
  });

  const moveToListMutation = useMutation({
    mutationFn: async ({ itemId, targetList, listName }: { itemId: string; targetList: string; listName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/move-item-to-list',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            target_list: targetList,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to move item');
      }
      return { ...await response.json(), listName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchCurrentlyItems();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move item", variant: "destructive" });
    },
  });

  const filteredMediaHistory = fullMediaHistory.filter((item: any) => {
    const matchesSearch = !mediaHistorySearch || item.title?.toLowerCase().includes(mediaHistorySearch.toLowerCase());
    const matchesType = mediaHistoryType === 'all' || item.media_type?.toLowerCase() === mediaHistoryType.toLowerCase();
    const itemYear = item.created_at ? new Date(item.created_at).getFullYear().toString() : null;
    const matchesYear = mediaHistoryYear === 'all' || itemYear === mediaHistoryYear;
    const matchesRating = mediaHistoryRating === 'all' || item.rating?.toString() === mediaHistoryRating;
    return matchesSearch && matchesType && matchesYear && matchesRating;
  });

  const getHistoryTitle = () => {
    const parts: string[] = [];
    if (mediaHistoryType !== 'all') parts.push(mediaHistoryType.charAt(0).toUpperCase() + mediaHistoryType.slice(1) + 's');
    if (mediaHistoryYear !== 'all') parts.push(mediaHistoryYear);
    if (mediaHistoryRating !== 'all') parts.push(`${mediaHistoryRating}★+`);
    return parts.length > 0 ? parts.join(' · ') : 'My History';
  };

  const handleDownloadHistoryImage = useCallback(async () => {
    if (!filteredMediaHistory.length || isGeneratingHistoryImage) return;
    setIsGeneratingHistoryImage(true);

    try {
      const items = filteredMediaHistory;
      const cols = 4;
      const canvasWidth = 1080;
      const padding = 60;
      const gap = 12;
      const cellWidth = Math.floor((canvasWidth - padding * 2 - gap * (cols - 1)) / cols);
      const cellHeight = Math.floor(cellWidth * 1.5);
      const rows = Math.ceil(items.length / cols);
      const titleHeight = 100;
      const footerHeight = 80;
      const canvasHeight = padding + titleHeight + rows * cellHeight + (rows - 1) * gap + footerHeight + padding;

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * scale;
      canvas.height = canvasHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      const grad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      grad.addColorStop(0, '#1a1025');
      grad.addColorStop(0.5, '#2d1b4e');
      grad.addColorStop(1, '#1a1025');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const historyTitle = getHistoryTitle();
      ctx.fillStyle = 'white';
      ctx.font = '800 48px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(historyTitle, canvasWidth / 2, padding + 48);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${items.length} items`, canvasWidth / 2, padding + 78);

      const loadImage = (url: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = proxyUrl;
        });
      };

      const images = await Promise.all(
        items.map((item: any) => {
          const imgUrl = item.image_url || item.poster_url;
          return imgUrl ? loadImage(imgUrl) : Promise.resolve(null);
        })
      );

      const gridTop = padding + titleHeight;
      items.forEach((item: any, idx: number) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = padding + col * (cellWidth + gap);
        const y = gridTop + row * (cellHeight + gap);

        ctx.save();
        ctx.beginPath();
        const r = 12;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + cellWidth - r, y);
        ctx.quadraticCurveTo(x + cellWidth, y, x + cellWidth, y + r);
        ctx.lineTo(x + cellWidth, y + cellHeight - r);
        ctx.quadraticCurveTo(x + cellWidth, y + cellHeight, x + cellWidth - r, y + cellHeight);
        ctx.lineTo(x + r, y + cellHeight);
        ctx.quadraticCurveTo(x, y + cellHeight, x, y + cellHeight - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(x, y, cellWidth, cellHeight);

        const img = images[idx];
        if (img) {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const cellAspect = cellWidth / cellHeight;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (imgAspect > cellAspect) {
            sw = img.naturalHeight * cellAspect;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / cellAspect;
            sy = (img.naturalHeight - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, cellWidth, cellHeight);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = '400 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.title || '', x + cellWidth / 2, y + cellHeight / 2, cellWidth - 16);
        }
        ctx.restore();
      });

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '700 40px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('@consumedapp', canvasWidth / 2, canvasHeight - padding + 10);

      const fileName = historyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );

      if (!blob) {
        throw new Error('Failed to generate image');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fileName}-consumedapp.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "Image Downloaded", description: "Share it on social media!" });
    } catch (error) {
      console.error('Error generating history image:', error);
      toast({ title: "Download Failed", description: "Could not generate image", variant: "destructive" });
    } finally {
      setIsGeneratingHistoryImage(false);
    }
  }, [filteredMediaHistory, isGeneratingHistoryImage, toast, mediaHistoryType, mediaHistoryYear, mediaHistoryRating]);

  const handleShareList = async (listId: string, listTitle: string) => {
    const url = `${window.location.origin}/list/${listTitle.toLowerCase().replace(/\s+/g, '-')}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: listTitle, url });
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: "Copied!", description: "List link copied to clipboard" });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied!", description: "List link copied to clipboard" });
    }
  };

  const getDisplayTitle = (title: string) => {
    if (title === 'All') return 'All';
    return title;
  };

  const getMediaIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'movie': return <Film size={14} className="text-pink-400" />;
      case 'tv': return <Tv size={14} className="text-blue-400" />;
      case 'music': return <Music size={14} className="text-green-400" />;
      case 'book': return <BookOpen size={14} className="text-orange-400" />;
      case 'podcast': return <Mic size={14} className="text-purple-400" />;
      case 'game': return <Gamepad2 size={14} className="text-red-400" />;
      default: return <Film size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] -mt-px">
        <div className="pt-8 pb-8 px-4 flex flex-col items-center gap-7">
          <h2 className="text-white text-2xl font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>My Library</h2>
          <div className="relative w-full max-w-sm">
            <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-white/10 border border-white/20 focus-within:bg-white/15 focus-within:border-white/30 transition-all">
              <SearchIcon size={16} className="text-white/50 flex-shrink-0" />
              <input
                ref={librarySearchRef}
                type="text"
                placeholder="Search to add media..."
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                onFocus={() => setLibrarySearchFocused(true)}
                onBlur={() => setTimeout(() => setLibrarySearchFocused(false), 150)}
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/50 outline-none"
              />
              {librarySearchQuery && (
                <button onClick={() => { setLibrarySearchQuery(''); librarySearchRef.current?.focus(); }}>
                  <X size={14} className="text-white/40 hover:text-white/70" />
                </button>
              )}
            </div>

            {/* Inline results dropdown */}
            {librarySearchQuery.trim() && (librarySearchFocused || librarySearchQuery.trim()) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl max-h-80 overflow-y-auto z-50 shadow-xl">
                {isSearching && (
                  <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
                )}
                {!isSearching && librarySearchResults.length === 0 && librarySearchQuery.length > 1 && (
                  <div className="p-4 text-center text-gray-400 text-sm">No results found</div>
                )}
                {librarySearchResults.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
                      Media
                    </div>
                    {librarySearchResults.slice(0, 8).map((media: any, idx: number) => (
                      <div
                        key={`${media.external_id}-${idx}`}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-white/5"
                      >
                        <div
                          onClick={() => { setLibrarySearchQuery(''); setLocation(`/media/${media.type || 'movie'}/${media.external_source || 'tmdb'}/${media.external_id}`); }}
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        >
                          {media.image ? (
                            <img src={media.image} alt={media.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <Activity size={16} className="text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{media.title}</p>
                            <p className="text-gray-400 text-xs">{media.type}{media.year && ` • ${media.year}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setListSheetMedia({
                                title: media.title,
                                mediaType: media.type || 'movie',
                                imageUrl: media.image,
                                externalId: media.external_id,
                                externalSource: media.external_source || 'tmdb',
                                creator: media.creator,
                              });
                              setIsListSheetOpen(true);
                            }}
                            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors"
                          >
                            <Plus size={16} className="text-white" />
                          </button>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setComposerMedia({
                                title: media.title,
                                mediaType: media.type || 'movie',
                                imageUrl: media.image,
                                externalId: media.external_id,
                                externalSource: media.external_source || 'tmdb',
                                creator: media.creator,
                              });
                              setIsComposerOpen(true);
                            }}
                            className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex items-center justify-center transition-colors relative"
                          >
                            <MessageSquarePlus size={14} className="text-white" />
                            <Star size={8} className="absolute -top-0.5 -right-0.5 fill-yellow-300 text-yellow-300" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


        <div className="pb-2" />
      </div>

      <div className="bg-white max-w-7xl mx-auto pb-6 space-y-4">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'in-progress', label: 'In Progress', icon: Play },
              { key: 'lists',       label: 'Lists',       icon: List },
              { key: 'all-media',   label: 'All My Media', icon: Clock },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'in-progress' && (
            <div className="px-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 mx-4">
              {currentlyItems.length > 0 ? (
                <div
                  className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {currentlyItems.map((item: any) => (
                    <CurrentlyConsumingCard
                      key={item.id}
                      item={item}
                      onUpdateProgress={(progress, total, mode, progressDisplay) => {
                        updateProgressMutation.mutate({
                          itemId: item.id,
                          progress,
                          total,
                          mode,
                          progressDisplay
                        });
                      }}
                      onMoveToList={(targetList, listName) => {
                        moveToListMutation.mutate({
                          itemId: item.id,
                          targetList,
                          listName
                        });
                      }}
                      isUpdating={updateProgressMutation.isPending || moveToListMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="mx-auto mb-2 text-gray-300" size={28} />
                  <p className="text-sm text-gray-600 mb-1">Nothing in progress yet</p>
                  <p className="text-xs text-gray-400">Add media and mark it as "Currently" to track your progress here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lists' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mx-4">

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search lists..."
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <button
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-[34px] px-3 rounded-lg flex items-center gap-1 font-medium flex-shrink-0"
                  onClick={() => setIsCreateListOpen(true)}
                >
                  <Plus size={12} />
                  New
                </button>
              </div>

              {isLoadingLists ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="bg-gray-50 rounded-lg p-3 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              ) : userLists.length === 0 ? (
                <div className="text-center py-6">
                  <List className="mx-auto mb-2 text-gray-300" size={28} />
                  <p className="text-sm text-gray-600">No lists yet</p>
                  <p className="text-xs text-gray-500">Create your first list to start tracking</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userLists
                    .filter((list: any) => list.title.toLowerCase().includes(listSearch.toLowerCase()))
                    .map((list: any) => (
                    <div
                      key={list.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors cursor-pointer"
                      onClick={() => {
                        const listSlug = list.title.toLowerCase().replace(/\s+/g, '-');
                        setLocation(`/list/${listSlug}`);
                      }}
                    >
                      <div className="px-3 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                            {list.is_default ? (
                              list.title === 'Want to Watch' ? <Play className="text-purple-600" size={14} /> :
                              list.title === 'Currently' ? <Clock className="text-blue-600" size={14} /> :
                              list.title === 'Completed' ? <Trophy className="text-green-600" size={14} /> :
                              <List className="text-gray-600" size={14} />
                            ) : (
                              <List className="text-purple-600" size={14} />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-medium text-gray-900 text-sm">{getDisplayTitle(list.title)}</h4>
                              {!list.is_default && list.visibility === 'private' && (
                                <Lock size={10} className="text-gray-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{list.items?.length || 0} items</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Share2 
                            className="text-gray-400 hover:text-purple-600" 
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareList(list.id, list.title);
                            }}
                          />
                          <ChevronRight className="text-gray-400" size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'all-media' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mx-4">
                  <div className="flex items-center gap-1 mb-3">
                    <div className="flex items-center bg-gray-100 rounded p-0.5">
                      <button
                        onClick={() => setHistoryViewMode('list')}
                        className={`p-1.5 rounded transition-colors ${historyViewMode === 'list' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                      >
                        <List size={14} />
                      </button>
                      <button
                        onClick={() => setHistoryViewMode('grid')}
                        className={`p-1.5 rounded transition-colors ${historyViewMode === 'grid' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                    </div>
                    <button
                      onClick={handleDownloadHistoryImage}
                      disabled={isGeneratingHistoryImage || !filteredMediaHistory.length}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-40"
                      aria-label="Download as image"
                    >
                      <Download size={16} className={isGeneratingHistoryImage ? 'animate-pulse' : ''} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          mediaHistoryType !== 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        <Film size={10} />
                        {mediaHistoryType === 'all' ? 'Type' : mediaHistoryType}
                        <ChevronRight size={10} className={`transition-transform ${openFilter === 'type' ? 'rotate-90' : ''}`} />
                      </button>
                      {openFilter === 'type' && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[100px]">
                          {[
                            { value: 'all', label: 'All Types' },
                            { value: 'movie', label: 'Movies' },
                            { value: 'tv', label: 'TV' },
                            { value: 'book', label: 'Books' },
                            { value: 'music', label: 'Music' },
                          ].map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => { setMediaHistoryType(value); setOpenFilter(null); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                                mediaHistoryType === value ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(openFilter === 'year' ? null : 'year')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          mediaHistoryYear !== 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        <Calendar size={10} />
                        {mediaHistoryYear === 'all' ? 'Year' : mediaHistoryYear}
                        <ChevronRight size={10} className={`transition-transform ${openFilter === 'year' ? 'rotate-90' : ''}`} />
                      </button>
                      {openFilter === 'year' && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[80px] max-h-40 overflow-y-auto">
                          <button
                            onClick={() => { setMediaHistoryYear('all'); setOpenFilter(null); }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                              mediaHistoryYear === 'all' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                            }`}
                          >
                            All Years
                          </button>
                          {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString()).map((year) => (
                            <button
                              key={year}
                              onClick={() => { setMediaHistoryYear(year); setOpenFilter(null); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                                mediaHistoryYear === year ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(openFilter === 'rating' ? null : 'rating')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          mediaHistoryRating !== 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        ⭐
                        {mediaHistoryRating === 'all' ? 'Rating' : `${mediaHistoryRating}★`}
                        <ChevronRight size={10} className={`transition-transform ${openFilter === 'rating' ? 'rotate-90' : ''}`} />
                      </button>
                      {openFilter === 'rating' && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[80px]">
                          <button
                            onClick={() => { setMediaHistoryRating('all'); setOpenFilter(null); }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                              mediaHistoryRating === 'all' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                            }`}
                          >
                            All
                          </button>
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => { setMediaHistoryRating(rating.toString()); setOpenFilter(null); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                                mediaHistoryRating === rating.toString() ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                              }`}
                            >
                              {'⭐'.repeat(rating)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative mb-3">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Filter media history..."
                      value={mediaHistorySearch}
                      onChange={(e) => setMediaHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  {isLoadingFullHistory ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-gray-50 rounded-lg p-3 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                          <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredMediaHistory.length === 0 ? (
                    <div className="text-center py-6">
                      <Clock className="mx-auto mb-2 text-gray-300" size={28} />
                      <p className="text-sm text-gray-600">No media history yet</p>
                      <p className="text-xs text-gray-500">Start tracking to see your history</p>
                    </div>
                  ) : historyViewMode === 'list' ? (
                    <div className="space-y-2">
                      {filteredMediaHistory.map((item: any, index: number) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 hover:border-purple-300 transition-colors cursor-pointer"
                          onClick={() => {
                            if (item.external_id && item.external_source) {
                              setLocation(`/media/${item.media_type}/${item.external_source}/${item.external_id}`);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getMediaIcon(item.media_type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">{item.title}</h4>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                {getMediaIcon(item.media_type)}
                                <span className="capitalize">{item.media_type}</span>
                                <span>•</span>
                                <span>{item.listName}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {filteredMediaHistory.map((item: any, index: number) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all overflow-hidden cursor-pointer"
                          onClick={() => {
                            if (item.external_id && item.external_source) {
                              setLocation(`/media/${item.media_type}/${item.external_source}/${item.external_id}`);
                            }
                          }}
                        >
                          <div className="aspect-[2/3] relative">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center p-1">
                                <span className="text-[10px] text-gray-400 text-center leading-tight">{item.title}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          )}
        </div>

      <CreateListDialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen} />
      {listSheetMedia && (
        <QuickAddListSheet
          isOpen={isListSheetOpen}
          onClose={() => {
            setIsListSheetOpen(false);
            setTimeout(() => fetchCurrentlyItems(), 800);
          }}
          media={listSheetMedia}
        />
      )}
      <QuickAddModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        preSelectedMedia={composerMedia}
        skipToComposer={true}
      />
    </div>
  );
}