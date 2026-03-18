import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Film, Tv, BookOpen, Music, Headphones, Gamepad2, Play } from 'lucide-react';

export interface ProgressItem {
  id: string;
  title: string;
  image_url?: string;
  media_type: string;
  progress?: number;
  progress_mode?: string;
  progress_total?: number;
  total?: number;
  external_id?: string;
  external_source?: string;
}

interface ProgressUpdateSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProgressItem;
  onProgressSaved?: () => void;
  onFinished?: () => void;
  showRemoveOption?: boolean;
  onRemove?: () => void;
}

const SUPABASE_URL = 'https://mahpgcogwpawvviapqza.supabase.co';

export function ProgressUpdateSheet({
  isOpen,
  onOpenChange,
  item,
  onProgressSaved,
  onFinished,
  showRemoveOption = false,
  onRemove,
}: ProgressUpdateSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mediaType = (item.media_type || 'movie').toLowerCase();
  const isBook = mediaType === 'book';
  const isTv = mediaType === 'tv' || mediaType === 'series' || mediaType === 'tv show';
  const isPodcast = mediaType === 'podcast';

  const getDefaultMode = (): 'percent' | 'page' | 'episode' | 'minutes' => {
    const pm = item.progress_mode;
    if (pm === 'episode') return 'episode';
    if (pm === 'page') return 'page';
    if (pm === 'minutes') return 'minutes';
    if (isTv) return 'episode';
    if (isBook) return 'page';
    if (isPodcast) return 'minutes';
    return 'percent';
  };

  const itemTotal = item.progress_total ?? item.total;

  const [editMode, setEditMode] = useState<'percent' | 'page' | 'episode' | 'minutes'>(getDefaultMode());
  const [editProgress, setEditProgress] = useState(item.progress || 0);
  const [editTotal, setEditTotal] = useState(itemTotal ?? (isTv ? 1 : 0));
  const [editSeason, setEditSeason] = useState(itemTotal ?? 1);
  const [editEpisode, setEditEpisode] = useState(item.progress || (isTv ? 1 : 0));

  useEffect(() => {
    if (isOpen) {
      const t = item.progress_total ?? item.total;
      setEditMode(getDefaultMode());
      setEditProgress(item.progress || 0);
      setEditTotal(t ?? (isTv ? 1 : 0));
      setEditSeason(t ?? 1);
      setEditEpisode(item.progress || (isTv ? 1 : 0));
    }
  }, [isOpen, item.id]);

  const { data: tvShowData, isLoading: isTvDataLoading } = useQuery({
    queryKey: ['tv-show-seasons', item.external_source, item.external_id],
    queryFn: async () => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-media-details?source=${item.external_source || 'tmdb'}&external_id=${item.external_id}&media_type=tv`,
        { headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isTv && isOpen && !!session?.access_token && !!item.external_id,
    staleTime: 1000 * 60 * 30,
  });

  const { data: bookPageCount } = useQuery({
    queryKey: ['book-page-count', item.external_source, item.external_id],
    queryFn: async () => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-media-details?source=${item.external_source || 'googlebooks'}&external_id=${item.external_id}`,
        { headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.pageCount || 0;
    },
    enabled: isBook && isOpen && !!item.external_id && !!session?.access_token && (itemTotal ?? 0) === 0,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (isBook && bookPageCount && bookPageCount > 0 && editTotal === 0) {
      setEditTotal(bookPageCount);
    }
  }, [bookPageCount]);

  const seasons = tvShowData?.seasons || [];
  const currentSeasonData = seasons.find((s: any) => s.seasonNumber === editSeason);
  const maxEpisodes = currentSeasonData?.episodeCount || 999;

  useEffect(() => {
    if (maxEpisodes < 999 && editEpisode > maxEpisodes) setEditEpisode(maxEpisodes);
  }, [maxEpisodes, editEpisode]);

  const updateMutation = useMutation({
    mutationFn: async ({ progress, total, mode }: { progress: number; total?: number; mode: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-item-progress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, progress, progress_total: total, progress_mode: mode }),
      });
      if (!res.ok) throw new Error('Failed to update progress');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      onProgressSaved?.();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Failed to update progress', variant: 'destructive' });
    },
  });

  const handleSaveProgress = () => {
    let progress = editProgress;
    let total: number | undefined;
    let mode = editMode as string;

    if (editMode === 'episode') {
      progress = editEpisode;
      total = editSeason;
    } else if (editMode === 'page') {
      total = editTotal || undefined;
    } else if (editMode === 'minutes') {
      total = editTotal || undefined;
      mode = 'percent';
    }

    updateMutation.mutate({ progress, total, mode });
  };

  const getModeOptions = () => {
    if (isTv) return [{ value: 'episode', label: 'Episode' }, { value: 'percent', label: 'Percent' }];
    if (isBook) return [{ value: 'page', label: 'Page' }, { value: 'percent', label: 'Percent' }];
    if (isPodcast) return [{ value: 'minutes', label: 'Minutes' }, { value: 'percent', label: 'Percent' }];
    return [];
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case 'movie': return <Film size={20} className="text-purple-400" />;
      case 'tv': return <Tv size={20} className="text-pink-400" />;
      case 'book': return <BookOpen size={20} className="text-cyan-400" />;
      case 'music': return <Music size={20} className="text-green-400" />;
      case 'podcast': return <Headphones size={20} className="text-blue-400" />;
      case 'game': return <Gamepad2 size={20} className="text-orange-400" />;
      default: return <Play size={20} className="text-gray-400" />;
    }
  };

  const modeOptions = getModeOptions();

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
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

          {modeOptions.length > 1 && (
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEditMode(opt.value as any)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    editMode === opt.value ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
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
                      editProgress === pct ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                          onChange={(e) => { setEditSeason(parseInt(e.target.value)); setEditEpisode(1); }}
                          className="w-full h-10 px-3 text-center text-lg font-semibold bg-white text-gray-900 border border-gray-200 rounded-md focus:border-purple-400 focus:ring-purple-400"
                        >
                          {seasons.map((s: any) => (
                            <option key={s.seasonNumber} value={s.seasonNumber}>S{s.seasonNumber}</option>
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
                        editEpisode >= maxEpisodes ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }`}
                    >
                      +1 Episode
                    </button>
                    <button
                      onClick={() => { setEditSeason(editSeason + 1); setEditEpisode(1); }}
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
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value.replace(/^0+/, '')) || 0))}
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
                    className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
            disabled={updateMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base font-medium"
          >
            {updateMutation.isPending ? 'Saving...' : 'Update Progress'}
          </Button>

          {onFinished && (
            <button
              onClick={onFinished}
              className="w-full text-center text-green-600 font-semibold text-sm hover:text-green-700 py-2"
            >
              I'm finished!
            </button>
          )}

          {showRemoveOption && onRemove && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full text-center text-gray-400 text-sm hover:text-red-500 py-2">
                  Remove from Library
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from library?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove "{item.title}" from all your lists.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove} className="bg-red-600 hover:bg-red-700">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
