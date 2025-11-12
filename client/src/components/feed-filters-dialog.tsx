import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Check } from "lucide-react";

export interface FeedFilters {
  mediaTypes: string[];
  engagementTypes: string[];
}

interface FeedFiltersDialogProps {
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
}

export default function FeedFiltersDialog({ filters, onFiltersChange }: FeedFiltersDialogProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FeedFilters>(filters);

  const mediaTypes = [
    { id: "all", label: "All Media", icon: "🎬" },
    { id: "movie", label: "Movies", icon: "🎥" },
    { id: "tv", label: "TV Shows", icon: "📺" },
    { id: "book", label: "Books", icon: "📚" },
    { id: "music", label: "Music", icon: "🎵" },
    { id: "game", label: "Games", icon: "🎮" },
    { id: "podcast", label: "Podcasts", icon: "🎙️" },
  ];

  const engagementTypes = [
    { id: "all", label: "All Types", icon: "✨" },
    { id: "consuming", label: "Consuming", icon: "➕" },
    { id: "prediction", label: "Predictions", icon: "🎯" },
    { id: "poll", label: "Polls", icon: "📊" },
    { id: "rate-review", label: "Rate/Review", icon: "⭐" },
    { id: "trivia", label: "Trivia", icon: "❓" },
  ];

  const handleMediaTypeToggle = (typeId: string) => {
    if (typeId === "all") {
      setLocalFilters({ ...localFilters, mediaTypes: [] });
    } else {
      const isSelected = localFilters.mediaTypes.includes(typeId);
      setLocalFilters({
        ...localFilters,
        mediaTypes: isSelected
          ? localFilters.mediaTypes.filter((t) => t !== typeId)
          : [...localFilters.mediaTypes, typeId],
      });
    }
  };

  const handleEngagementTypeToggle = (typeId: string) => {
    if (typeId === "all") {
      setLocalFilters({ ...localFilters, engagementTypes: [] });
    } else {
      const isSelected = localFilters.engagementTypes.includes(typeId);
      setLocalFilters({
        ...localFilters,
        engagementTypes: isSelected
          ? localFilters.engagementTypes.filter((t) => t !== typeId)
          : [...localFilters.engagementTypes, typeId],
      });
    }
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const clearedFilters = { mediaTypes: [], engagementTypes: [] };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const activeFilterCount = localFilters.mediaTypes.length + localFilters.engagementTypes.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-white text-gray-600 hover:bg-gray-100 border border-gray-300 relative"
          data-testid="button-open-filters"
        >
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-purple-600 text-white rounded-full text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Filter Feed</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Media Type Filter */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Media Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {mediaTypes.map((type) => {
                const isSelected =
                  type.id === "all"
                    ? localFilters.mediaTypes.length === 0
                    : localFilters.mediaTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    data-testid={`filter-media-${type.id}`}
                    onClick={() => handleMediaTypeToggle(type.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span className="flex-1 text-left">{type.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engagement Type Filter */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Engagement Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {engagementTypes.map((type) => {
                const isSelected =
                  type.id === "all"
                    ? localFilters.engagementTypes.length === 0
                    : localFilters.engagementTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    data-testid={`filter-engagement-${type.id}`}
                    onClick={() => handleEngagementTypeToggle(type.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span className="flex-1 text-left">{type.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClear}
            className="flex-1"
            data-testid="button-clear-filters"
          >
            Clear All
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-apply-filters"
          >
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
