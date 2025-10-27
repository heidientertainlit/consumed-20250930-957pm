import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type ProgressMode = 'percent' | 'page' | 'episode' | 'track';

interface ProgressTrackerProps {
  itemId: string;
  mediaType: string; // 'movie', 'tv', 'book', 'music', 'podcast'
  currentProgress: number;
  currentTotal: number;
  currentMode: ProgressMode;
}

export function ProgressTracker({
  itemId,
  mediaType,
  currentProgress = 0,
  currentTotal = 0,
  currentMode = 'percent',
}: ProgressTrackerProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine default mode based on media type
  const getDefaultMode = (): ProgressMode => {
    if (mediaType === 'book') return currentMode || 'page';
    if (mediaType === 'tv' || mediaType === 'series') return 'episode';
    if (mediaType === 'music' || mediaType === 'album') return 'track';
    return 'percent';
  };

  // Local state for smooth UI updates
  const [progress, setProgress] = useState(currentProgress);
  const [total, setTotal] = useState(currentTotal);
  const [mode, setMode] = useState<ProgressMode>(currentMode || getDefaultMode());

  // Media type checks
  const isBook = mediaType === 'book';
  const isMusic = mediaType === 'music' || mediaType === 'album';
  const isTv = mediaType === 'tv' || mediaType === 'series';
  const isMovie = mediaType === 'movie' || mediaType === 'film';
  const isPodcast = mediaType === 'podcast';
  const canToggleMode = isBook || isTv;
  const showQuickActions = isMusic || isMovie || isPodcast;

  const updateProgressMutation = useMutation({
    mutationFn: async ({
      newProgress,
      newTotal,
      newMode,
    }: {
      newProgress: number;
      newTotal?: number;
      newMode: ProgressMode;
    }) => {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_id: itemId,
            progress: newProgress,
            total: newTotal,
            progress_mode: newMode,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update progress: ${errorText}`);
      }

      return { itemId, progress: newProgress, total: newTotal, mode: newMode };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      toast({
        title: "Progress Updated",
        description: "Your progress has been saved.",
      });
    },
    onError: (error) => {
      // Revert to server values on error
      setProgress(currentProgress);
      setTotal(currentTotal);
      setMode(currentMode || getDefaultMode());
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateProgress = () => {
    updateProgressMutation.mutate({
      newProgress: progress,
      newTotal: mode !== 'percent' ? total : undefined,
      newMode: mode,
    });
  };

  const getProgressDisplay = () => {
    if (mode === 'percent') {
      return `${progress}%`;
    } else if (mode === 'page') {
      return total > 0 ? `Page ${progress} of ${total}` : `Page ${progress}`;
    } else if (mode === 'episode') {
      // For TV shows, total = season, progress = episode
      if (isTv) {
        return total > 0 ? `Season ${total} Episode ${progress}` : `Episode ${progress}`;
      }
      return total > 0 ? `Episode ${progress} of ${total}` : `Episode ${progress}`;
    } else if (mode === 'track') {
      return total > 0 ? `Track ${progress} of ${total}` : `Track ${progress}`;
    }
    return `${progress}%`;
  };

  const getPercentComplete = () => {
    if (mode === 'percent') {
      return progress;
    } else if (total > 0) {
      return Math.round((progress / total) * 100);
    }
    return 0;
  };

  // Move item to different list mutation
  const moveToListMutation = useMutation({
    mutationFn: async (targetList: string) => {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/move-item-to-list",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_id: itemId,
            target_list: targetList,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to move item: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: async (data, targetList) => {
      await queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      const listNames: { [key: string]: string } = {
        'finished': 'Finished',
        'dnf': 'Did Not Finish',
        'favorites': 'Favorites'
      };
      toast({
        title: "Item Moved",
        description: `Moved to ${listNames[targetList] || targetList}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Move Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Movies, Music, and Podcasts show single button with dropdown
  if (showQuickActions) {
    return (
      <div className="mb-3 flex" data-testid={`progress-tracker-${itemId}`}>
        <Button
          onClick={() => moveToListMutation.mutate('finished')}
          disabled={moveToListMutation.isPending}
          className="flex-1 bg-white hover:bg-gray-50 text-purple-800 border-2 border-purple-800 text-xs py-1.5 h-8 rounded-r-none"
          data-testid={`button-mark-finished-${itemId}`}
        >
          Finished
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={moveToListMutation.isPending}
              className="px-2 bg-white hover:bg-gray-50 text-purple-800 border-2 border-purple-800 border-l-0 rounded-l-none h-8"
              data-testid={`button-dropdown-${itemId}`}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('currently')}
              className="cursor-pointer"
            >
              Currently
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('queue')}
              className="cursor-pointer"
            >
              Queue
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('favorites')}
              className="cursor-pointer"
            >
              Favorites
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('dnf')}
              className="cursor-pointer"
            >
              Did Not Finish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="mb-3" data-testid={`progress-tracker-${itemId}`}>
      {/* Mode toggle for books and TV shows */}
      {canToggleMode && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${mode !== 'percent' ? 'text-purple-600' : 'text-gray-400'}`}>
              {isBook ? 'Page #' : 'Episode'}
            </span>
            <Switch
              checked={mode === 'percent'}
              onCheckedChange={(checked) => {
                if (checked) {
                  setMode('percent');
                  setProgress(0);
                  setTotal(0);
                } else {
                  setMode(isBook ? 'page' : 'episode');
                  if (currentMode === 'percent') {
                    setProgress(0);
                  }
                }
              }}
              className="data-[state=checked]:bg-purple-600 scale-125"
              data-testid={`switch-mode-${itemId}`}
            />
            <span className={`text-sm font-semibold ${mode === 'percent' ? 'text-purple-600' : 'text-gray-400'}`}>
              Percent
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleUpdateProgress}
            disabled={updateProgressMutation.isPending}
            className="bg-black hover:bg-gray-800 text-white"
            data-testid={`button-update-progress-${itemId}`}
          >
            {updateProgressMutation.isPending ? 'Updating...' : 'Update Progress'}
          </Button>
        </div>
      )}

      {/* Progress display */}
      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
        <span className="font-medium">Progress</span>
        <span className="text-purple-600 font-semibold">{getProgressDisplay()}</span>
      </div>

      {/* Input controls based on mode */}
      {mode === 'percent' ? (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer progress-slider"
            style={{
              background: `linear-gradient(to right, rgb(147, 51, 234) 0%, rgb(147, 51, 234) ${progress}%, rgb(229, 231, 235) ${progress}%, rgb(229, 231, 235) 100%)`,
            }}
            data-testid={`progress-slider-${itemId}`}
          />
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setProgress(Math.min(progress + 10, 100))}
              className="h-6 w-6 p-0 text-purple-600 hover:bg-purple-50"
              data-testid={`button-progress-increment-${itemId}`}
            >
              +
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* TV shows have separate Season and Episode inputs */}
          {isTv && mode === 'episode' ? (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">
                  Season
                </label>
                <Input
                  type="number"
                  min="1"
                  value={total || 1}
                  onChange={(e) => setTotal(parseInt(e.target.value) || 1)}
                  className="h-9 bg-white text-black border-gray-300"
                  placeholder="1"
                  data-testid={`input-season-${itemId}`}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">
                  Episode
                </label>
                <Input
                  type="number"
                  min="1"
                  value={progress || 1}
                  onChange={(e) => setProgress(parseInt(e.target.value) || 1)}
                  className="h-9 bg-white text-black border-gray-300"
                  placeholder="1"
                  data-testid={`input-episode-${itemId}`}
                />
              </div>
            </div>
          ) : (
            /* Books and other media types */
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">
                  {mode === 'page' && "I'm on page"}
                  {mode === 'episode' && "I'm on episode"}
                  {mode === 'track' && "I'm on track"}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value) || 0)}
                  className="h-9 bg-white text-black border-gray-300"
                  placeholder="0"
                  data-testid={`input-progress-${itemId}`}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">
                  Total {mode === 'page' ? 'pages' : mode === 'episode' ? 'episodes' : 'tracks'} (optional)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={total}
                  onChange={(e) => setTotal(parseInt(e.target.value) || 0)}
                  className="h-9 bg-white text-black border-gray-300"
                  placeholder="0"
                  data-testid={`input-total-${itemId}`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action button with dropdown */}
      <div className="flex mt-3">
        <Button
          onClick={() => moveToListMutation.mutate('finished')}
          disabled={moveToListMutation.isPending}
          className="flex-1 bg-white hover:bg-gray-50 text-purple-800 border-2 border-purple-800 text-xs py-1.5 h-8 rounded-r-none"
          data-testid={`button-mark-finished-${itemId}`}
        >
          Finished
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={moveToListMutation.isPending}
              className="px-2 bg-white hover:bg-gray-50 text-purple-800 border-2 border-purple-800 border-l-0 rounded-l-none h-8"
              data-testid={`button-dropdown-${itemId}`}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('currently')}
              className="cursor-pointer"
            >
              Currently
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('queue')}
              className="cursor-pointer"
            >
              Queue
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('favorites')}
              className="cursor-pointer"
            >
              Favorites
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => moveToListMutation.mutate('dnf')}
              className="cursor-pointer"
            >
              Did Not Finish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
