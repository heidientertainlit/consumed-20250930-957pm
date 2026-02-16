import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Film, Tv, BookOpen, Music, Headphones, Gamepad2, Play, MoreHorizontal, Check, X, Clock, Trophy, Star, Trash2 } from 'lucide-react';
import { DnfReasonDrawer } from '@/components/dnf-reason-drawer';

interface CurrentlyConsumingCardProps {
  item: any;
  onUpdateProgress: (progress: number, total: number | undefined, mode: string, progressDisplay: string) => void;
  onMoveToList: (targetList: string, listName: string) => void;
  isUpdating: boolean;
}

export function CurrentlyConsumingCard({ item, onUpdateProgress, onMoveToList, isUpdating }: CurrentlyConsumingCardProps) {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProgressSheetOpen, setIsProgressSheetOpen] = useState(false);
  const [isMoveSheetOpen, setIsMoveSheetOpen] = useState(false);
  const [isDnfDrawerOpen, setIsDnfDrawerOpen] = useState(false);
  const [isRatingSheetOpen, setIsRatingSheetOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [thoughts, setThoughts] = useState('');
  const [doNotShare, setDoNotShare] = useState(false);
  
  const mediaType = (item.media_type || 'movie').toLowerCase();
  const isBook = mediaType === 'book';
  const isTv = mediaType === 'tv' || mediaType === 'series' || mediaType === 'tv show';
  const isPodcast = mediaType === 'podcast';
  const isMusic = mediaType === 'music';
  const progressMode = item.progress_mode || (isBook ? 'page' : isTv ? 'episode' : 'percent');

  const getDefaultTotal = () => {
    if (isTv) return 1;
    if (isBook || isPodcast) return 0;
    return 100;
  };

  const itemTotal = item.progress_total ?? item.total;
  const [localProgress, setLocalProgress] = useState(item.progress || 0);
  const [localTotal, setLocalTotal] = useState(itemTotal ?? getDefaultTotal());
  const [editProgress, setEditProgress] = useState(item.progress || 0);
  const [editTotal, setEditTotal] = useState(itemTotal ?? getDefaultTotal());
  const [editSeason, setEditSeason] = useState(itemTotal ?? 1);
  const [editEpisode, setEditEpisode] = useState(item.progress || 1);

  useEffect(() => {
    const t = item.progress_total ?? item.total;
    setLocalProgress(item.progress || 0);
    setLocalTotal(t ?? getDefaultTotal());
    setEditProgress(item.progress || 0);
    setEditTotal(t ?? getDefaultTotal());
    setEditSeason(t ?? 1);
    setEditEpisode(item.progress || (isTv ? 1 : 0));
  }, [item.progress, item.progress_total, item.total, item.progress_mode]);

  const { data: tvShowData, isLoading: isTvDataLoading } = useQuery({
    queryKey: ['tv-show-seasons', item.external_source, item.external_id],
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${item.external_source || 'tmdb'}&external_id=${item.external_id}&media_type=tv`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isTv && isProgressSheetOpen && !!session?.access_token,
    staleTime: 1000 * 60 * 30,
  });

  const seasons = tvShowData?.seasons || [];
  const currentSeasonData = seasons.find((s: any) => s.seasonNumber === editSeason);
  const maxEpisodes = currentSeasonData?.episodeCount || 999;

  useEffect(() => {
    if (maxEpisodes < 999 && editEpisode > maxEpisodes) {
      setEditEpisode(maxEpisodes);
    }
  }, [maxEpisodes, editEpisode]);

  const getDefaultMode = () => {
    if (progressMode === 'episode') return 'episode';
    if (progressMode === 'page') return 'page';
    if (isTv) return 'episode';
    if (isBook) return 'page';
    if (isPodcast) return 'minutes';
    return 'percent';
  };
  
  const [editMode, setEditMode] = useState<'percent' | 'page' | 'episode' | 'minutes'>(getDefaultMode());

  // Delete/remove from library mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/delete-list-item',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ itemId }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to remove item: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      toast({
        title: "Removed from library",
        description: "Item has been removed from your library",
      });
      setIsMoveSheetOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to remove",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveFromLibrary = () => {
    if (confirm(`Are you sure you want to remove "${item.title}" from your library?`)) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const dnfReasonMutation = useMutation({
    mutationFn: async ({ listItemId, reasons, otherReason }: { listItemId: string; reasons: string[]; otherReason?: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/save-dnf-reason',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            list_item_id: listItemId,
            reasons,
            other_reason: otherReason,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save DNF reason');
      }
      return response.json();
    },
    onError: (error) => {
      console.error('DNF reason error:', error);
    },
  });

  const handleDnfWithReason = async (reason: string, otherReason?: string) => {
    onMoveToList('dnf', 'Did Not Finish');
    setIsDnfDrawerOpen(false);
    setIsMoveSheetOpen(false);
    
    try {
      await dnfReasonMutation.mutateAsync({
        listItemId: item.id,
        reasons: [reason],
        otherReason,
      });
    } catch (error) {
      console.error('Failed to save DNF reason:', error);
    }
  };

  const ratingMutation = useMutation({
    mutationFn: async ({ rating, thoughts, isPrivate }: { rating: number; thoughts?: string; isPrivate: boolean }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/share-update',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: thoughts || '',
            media_title: item.title,
            media_type: item.media_type,
            media_image_url: item.image_url,
            media_external_id: item.external_id,
            media_external_source: item.external_source || 'tmdb',
            rating: rating > 0 ? rating : null,
            is_private: isPrivate,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit rating');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      if (!variables.isPrivate) {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      }
      queryClient.invalidateQueries({ queryKey: ['media-reviews'] });
      toast({
        title: !variables.isPrivate ? "Shared to feed!" : "Rating saved!",
        description: !variables.isPrivate 
          ? "Your rating and thoughts have been shared with friends." 
          : "Your rating has been saved privately.",
      });
    },
    onError: (error) => {
      console.error('Rating error:', error);
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFinishWithRating = () => {
    setIsProgressSheetOpen(false);
    setIsMoveSheetOpen(false);
    setRating(0);
    setThoughts('');
    setDoNotShare(false);
    setIsRatingSheetOpen(true);
  };

  const handleSubmitRating = async () => {
    onMoveToList('finished', 'Finished');
    setIsRatingSheetOpen(false);
    
    if (!doNotShare && (rating > 0 || thoughts.trim())) {
      try {
        await ratingMutation.mutateAsync({
          rating,
          thoughts: thoughts.trim() || undefined,
          isPrivate: false,
        });
      } catch (error) {
        console.error('Failed to save rating:', error);
      }
    } else if (doNotShare && (rating > 0 || thoughts.trim())) {
      try {
        await ratingMutation.mutateAsync({
          rating,
          thoughts: thoughts.trim() || undefined,
          isPrivate: true,
        });
      } catch (error) {
        console.error('Failed to save rating:', error);
      }
    } else if (rating > 0) {
      toast({
        title: "Finished!",
        description: `You rated "${item.title}" ${rating} stars.`,
      });
    }
  };

  const handleSkipRating = () => {
    onMoveToList('finished', 'Finished');
    setIsRatingSheetOpen(false);
  };
  
  const getProgressDisplay = () => {
    if (isTv && localTotal > 0) {
      return `S${localTotal}E${localProgress}`;
    }
    if (progressMode === 'percent') {
      return `${localProgress}%`;
    } else if (progressMode === 'page') {
      return localTotal > 0 ? `p${localProgress}/${localTotal}` : `p${localProgress}`;
    } else if (progressMode === 'episode') {
      return localTotal > 0 ? `S${localTotal}E${localProgress}` : `E${localProgress}`;
    }
    return `${localProgress}%`;
  };

  const getProgressPercent = () => {
    if (progressMode === 'percent') {
      return localProgress;
    } else if (progressMode === 'episode') {
      return Math.min(localProgress * 10, 100);
    } else if (localTotal > 0) {
      return Math.min(Math.round((localProgress / localTotal) * 100), 100);
    }
    return 0;
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case 'movie': return <Film size={12} className="text-purple-400" />;
      case 'tv': return <Tv size={12} className="text-pink-400" />;
      case 'book': return <BookOpen size={12} className="text-cyan-400" />;
      case 'music': return <Music size={12} className="text-green-400" />;
      case 'podcast': return <Headphones size={12} className="text-blue-400" />;
      case 'game': return <Gamepad2 size={12} className="text-orange-400" />;
      default: return <Play size={12} className="text-gray-400" />;
    }
  };

  const handleSaveProgress = () => {
    let newProgress = editProgress;
    let newTotal = editTotal;
    let mode = editMode;
    let displayText = '';
    
    if (editMode === 'episode') {
      newProgress = editEpisode;
      newTotal = editSeason;
      mode = 'episode';
      displayText = `S${newTotal}E${newProgress}`;
    } else if (editMode === 'page') {
      displayText = newTotal > 0 ? `page ${newProgress}/${newTotal}` : `page ${newProgress}`;
    } else if (editMode === 'minutes') {
      displayText = newTotal > 0 ? `${newProgress}/${newTotal} min` : `${newProgress} min`;
      mode = 'percent';
    } else {
      displayText = `${newProgress}%`;
    }
    
    setLocalProgress(newProgress);
    setLocalTotal(newTotal);
    onUpdateProgress(newProgress, mode !== 'percent' ? newTotal : undefined, mode, displayText);
    setIsProgressSheetOpen(false);
  };

  const getModeOptions = () => {
    if (isTv) return [{ value: 'episode', label: 'Episode' }, { value: 'percent', label: 'Percent' }];
    if (isBook) return [{ value: 'page', label: 'Page' }, { value: 'percent', label: 'Percent' }];
    if (isPodcast) return [{ value: 'minutes', label: 'Minutes' }, { value: 'percent', label: 'Percent' }];
    return [{ value: 'percent', label: 'Percent' }];
  };

  return (
    <>
      <div 
        className="w-20 flex-shrink-0"
        data-testid={`currently-card-${item.id}`}
      >
        <div 
          className="relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer mb-1"
          onClick={() => setLocation(`/media/${item.media_type}/${item.external_source || 'tmdb'}/${item.external_id || item.id}`)}
        >
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement; if (fallback) fallback.style.display = 'flex'; }}
            />
          ) : null}
          <div className={`w-full h-full bg-gradient-to-br from-purple-800 to-blue-900 flex flex-col items-center justify-center p-1.5 ${item.image_url ? 'hidden absolute inset-0' : ''}`}>
            {getMediaIcon()}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-6 pb-1.5 px-1.5">
            <div className="h-0.5 bg-gray-700/50 rounded-full mb-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all rounded-full"
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsProgressSheetOpen(true); }}
                disabled={isUpdating}
                className="flex-1 h-5 text-[9px] bg-purple-600/50 hover:bg-purple-600/70 text-white font-medium rounded px-1.5 transition-colors"
                data-testid={`button-edit-progress-${item.id}`}
              >
                {getProgressDisplay()}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMoveSheetOpen(true); }}
                disabled={isUpdating}
                className="h-5 w-5 bg-white/20 hover:bg-white/30 text-white rounded flex items-center justify-center"
                data-testid={`button-more-${item.id}`}
              >
                <MoreHorizontal size={10} />
              </button>
            </div>
          </div>
        </div>

        <h4 className="text-xs font-medium text-white truncate px-0.5">{item.title}</h4>
      </div>

      <Sheet open={isProgressSheetOpen} onOpenChange={setIsProgressSheetOpen}>
        <SheetContent side="bottom" className="bg-white rounded-t-2xl p-0">
          <div className="flex items-center justify-center px-4 py-4 border-b border-gray-100">
            <SheetTitle className="text-lg font-semibold text-gray-900">Update Progress</SheetTitle>
          </div>
          
          <div className="px-4 py-4 space-y-4 pb-8">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="w-12 h-16 object-cover rounded-lg" />
              ) : (
                <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                  {getMediaIcon()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                <p className="text-sm text-gray-500 capitalize">{mediaType}</p>
              </div>
            </div>

            {getModeOptions().length > 1 && (
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                {getModeOptions().map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditMode(opt.value as any)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      editMode === opt.value 
                        ? 'bg-white text-purple-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {editMode === 'percent' && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Percentage Complete</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="text-center text-lg font-semibold pr-8 bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setEditProgress(pct)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editProgress === pct 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editMode === 'episode' && (
              <div className="space-y-3">
                {isTvDataLoading ? (
                  <div className="text-center py-4 text-gray-500">Loading season data...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Season</label>
                        {seasons.length > 0 ? (
                          <select
                            value={editSeason}
                            onChange={(e) => {
                              const newSeason = parseInt(e.target.value);
                              setEditSeason(newSeason);
                              setEditEpisode(1);
                            }}
                            className="w-full h-10 px-3 text-center text-lg font-semibold bg-white text-gray-900 border border-gray-200 rounded-md focus:border-purple-400 focus:ring-purple-400"
                          >
                            {seasons.map((s: any) => (
                              <option key={s.seasonNumber} value={s.seasonNumber}>
                                S{s.seasonNumber}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            value={editSeason}
                            onChange={(e) => setEditSeason(Math.max(1, parseInt(e.target.value) || 1))}
                            className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Episode {maxEpisodes < 999 && <span className="text-gray-400 font-normal">/ {maxEpisodes}</span>}
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={maxEpisodes}
                          value={editEpisode}
                          onChange={(e) => setEditEpisode(Math.min(maxEpisodes, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditEpisode(Math.min(editEpisode + 1, maxEpisodes))}
                        disabled={editEpisode >= maxEpisodes}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          editEpisode >= maxEpisodes
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        +1 Episode
                      </button>
                      <button
                        onClick={() => {
                          const nextSeasonNum = editSeason + 1;
                          const nextSeason = seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
                          if (nextSeason || seasons.length === 0) {
                            setEditSeason(nextSeasonNum);
                            setEditEpisode(1);
                          }
                        }}
                        disabled={seasons.length > 0 && !seasons.find((s: any) => s.seasonNumber === editSeason + 1)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          seasons.length > 0 && !seasons.find((s: any) => s.seasonNumber === editSeason + 1)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Next Season
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {editMode === 'page' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Current Page</label>
                    <Input
                      type="number"
                      min={0}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Total Pages</label>
                    <Input
                      type="number"
                      min={0}
                      value={editTotal}
                      onChange={(e) => setEditTotal(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[10, 25, 50].map((pages) => (
                    <button
                      key={pages}
                      onClick={() => setEditProgress(Math.min(editProgress + pages, editTotal || 9999))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      +{pages} pages
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editMode === 'minutes' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Minutes Listened</label>
                    <Input
                      type="number"
                      min={0}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Total Minutes</label>
                    <Input
                      type="number"
                      min={0}
                      value={editTotal}
                      onChange={(e) => setEditTotal(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setEditProgress(Math.min(editProgress + mins, editTotal || 9999))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      +{mins} min
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleSaveProgress}
              disabled={isUpdating}
              className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base font-medium"
            >
              Update Progress
            </Button>
            
            <button 
              onClick={handleFinishWithRating}
              disabled={isUpdating}
              className="w-full text-center text-green-600 font-semibold text-sm hover:text-green-700 py-2"
            >
              I'm finished!
            </button>
            
            <button
              onClick={handleRemoveFromLibrary}
              disabled={isUpdating || deleteItemMutation.isPending}
              className="w-full text-center text-gray-400 text-sm hover:text-red-500 py-2"
            >
              Remove from Library
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isMoveSheetOpen} onOpenChange={setIsMoveSheetOpen}>
        <SheetContent side="bottom" className="bg-white rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-lg font-semibold text-gray-900">Move to List</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-2 pb-6">
            <button
              onClick={handleFinishWithRating}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-finished-${item.id}`}
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="text-green-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Finished</p>
                <p className="text-sm text-gray-500">Mark as completed</p>
              </div>
            </button>
            
            <button
              onClick={() => { setIsDnfDrawerOpen(true); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-dnf-${item.id}`}
            >
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <X className="text-red-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Did Not Finish</p>
                <p className="text-sm text-gray-500">Stopped watching/reading</p>
              </div>
            </button>
            
            <button
              onClick={() => { onMoveToList('queue', 'Want To'); setIsMoveSheetOpen(false); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-queue-${item.id}`}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Want To</p>
                <p className="text-sm text-gray-500">Save for later</p>
              </div>
            </button>
            
            <button
              onClick={() => { onMoveToList('favorites', 'Favorites'); setIsMoveSheetOpen(false); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-favorites-${item.id}`}
            >
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Trophy className="text-yellow-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Favorites</p>
                <p className="text-sm text-gray-500">Add to your favorites</p>
              </div>
            </button>

            <div className="border-t border-gray-100 my-2 pt-2">
              <button
                onClick={handleRemoveFromLibrary}
                disabled={isUpdating || deleteItemMutation.isPending}
                className="w-full p-4 text-left rounded-lg hover:bg-red-50 flex items-center gap-3 transition-colors"
                data-testid={`remove-item-${item.id}`}
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Trash2 className="text-gray-500" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Remove from Library</p>
                  <p className="text-sm text-gray-500">Delete from all your lists</p>
                </div>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isRatingSheetOpen} onOpenChange={setIsRatingSheetOpen}>
        <SheetContent side="bottom" className="bg-white rounded-t-2xl p-0">
          <div className="flex items-center justify-center px-4 py-4 border-b border-gray-100">
            <SheetTitle className="text-lg font-semibold text-gray-900">You finished it!</SheetTitle>
          </div>
          
          <div className="px-4 py-4 space-y-5 pb-8">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="w-12 h-16 object-cover rounded-lg" />
              ) : (
                <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                  {getMediaIcon()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                <p className="text-sm text-gray-500 capitalize">{mediaType}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">What would you rate this?</label>
              <div className="relative flex justify-center px-4">
                <div className="relative">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className="relative"
                        style={{ width: 36, height: 36 }}
                      >
                        <Star 
                          size={36} 
                          className="absolute inset-0 text-gray-300"
                        />
                        <div 
                          className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ 
                            width: rating >= star ? '100%' : rating >= star - 0.5 ? '50%' : '0%'
                          }}
                        >
                          <Star 
                            size={36} 
                            className="fill-yellow-400 text-yellow-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={rating}
                    onChange={(e) => setRating(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    style={{ margin: 0 }}
                  />
                </div>
              </div>
              <p className="text-center text-sm text-gray-500">
                {rating === 0 && "Tap a star to rate"}
                {rating === 0.5 && "Not for me (0.5)"}
                {rating === 1 && "Not for me (1)"}
                {rating === 1.5 && "Meh (1.5)"}
                {rating === 2 && "It was okay (2)"}
                {rating === 2.5 && "Decent (2.5)"}
                {rating === 3 && "Pretty good (3)"}
                {rating === 3.5 && "Enjoyed it (3.5)"}
                {rating === 4 && "Really enjoyed it (4)"}
                {rating === 4.5 && "Almost perfect (4.5)"}
                {rating === 5 && "Loved it! (5)"}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Want to share your thoughts? (optional)</label>
              <Textarea
                placeholder="What did you think? Any highlights, favorite moments, or recommendations?"
                value={thoughts}
                onChange={(e) => setThoughts(e.target.value)}
                className="min-h-[80px] bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400 resize-none"
                data-testid="input-thoughts"
              />
            </div>

            {(rating > 0 || thoughts.trim()) && (
              <button
                onClick={() => setDoNotShare(!doNotShare)}
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                data-testid="toggle-share-feed"
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  doNotShare 
                    ? 'bg-purple-600 border-purple-600' 
                    : 'border-gray-300 bg-white'
                }`}>
                  {doNotShare && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">Do NOT share to feed</p>
                  <p className="text-xs text-gray-500">Keep this rating private</p>
                </div>
              </button>
            )}

            <div className="space-y-2">
              <Button 
                onClick={handleSubmitRating}
                disabled={ratingMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base font-medium"
                data-testid="button-submit-rating"
              >
                {ratingMutation.isPending ? 'Saving...' : 
                  doNotShare ? 'Save Privately' : 
                  'Share & Finish'}
              </Button>
              
              <button 
                onClick={handleSkipRating}
                disabled={ratingMutation.isPending}
                className="w-full text-center text-gray-500 text-sm hover:text-gray-700 py-2"
                data-testid="button-skip-rating"
              >
                Skip for now
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DnfReasonDrawer
        isOpen={isDnfDrawerOpen}
        onClose={() => setIsDnfDrawerOpen(false)}
        onSubmit={handleDnfWithReason}
        mediaTitle={item.title}
      />
    </>
  );
}
