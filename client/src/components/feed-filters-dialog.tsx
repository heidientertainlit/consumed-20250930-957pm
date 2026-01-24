import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

export interface FeedFilters {
  audience: string;
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

  // Sync local filters with incoming props when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const audiences = [
    { id: "everyone", label: "Everyone" },
    { id: "friends", label: "Friends" },
  ];

  const mediaTypes = [
    { id: "any", label: "Any" },
    { id: "movie", label: "Movies" },
    { id: "tv", label: "TV" },
    { id: "book", label: "Books" },
    { id: "music", label: "Music" },
    { id: "game", label: "Games" },
    { id: "podcast", label: "Podcasts" },
  ];

  const engagementTypes = [
    { id: "any", label: "Any" },
    { id: "conversations", label: "Conversations" },
    { id: "consuming", label: "Consuming" },
    { id: "prediction", label: "Predictions" },
    { id: "poll", label: "Polls" },
    { id: "rate-review", label: "Rate/Review" },
    { id: "trivia", label: "Trivia" },
    { id: "pools", label: "Pools" },
  ];

  const handleAudienceSelect = (audienceId: string) => {
    setLocalFilters({ ...localFilters, audience: audienceId });
  };

  const handleMediaTypeToggle = (typeId: string) => {
    if (typeId === "any") {
      setLocalFilters({ ...localFilters, mediaTypes: [] });
    } else {
      setLocalFilters({ ...localFilters, mediaTypes: [typeId] });
    }
  };

  const handleEngagementTypeToggle = (typeId: string) => {
    if (typeId === "any") {
      setLocalFilters({ ...localFilters, engagementTypes: [] });
    } else {
      setLocalFilters({ ...localFilters, engagementTypes: [typeId] });
    }
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const clearedFilters = { audience: "everyone", mediaTypes: [], engagementTypes: [] };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const activeFilterCount = 
    (localFilters.audience !== "everyone" ? 1 : 0) +
    localFilters.mediaTypes.length + 
    localFilters.engagementTypes.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="px-4 py-2 rounded-full text-sm font-medium transition-all bg-white text-gray-600 hover:bg-gray-100 border border-gray-300 relative"
          data-testid="button-open-filters"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filter Feed</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-purple-600 text-white rounded-full text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">Filters</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Audience */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Audience</h3>
            <div className="flex gap-2 flex-wrap">
              {audiences.map((audience) => {
                const isSelected = localFilters.audience === audience.id;
                return (
                  <button
                    key={audience.id}
                    data-testid={`filter-audience-${audience.id}`}
                    onClick={() => handleAudienceSelect(audience.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {audience.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media Type */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Media Type</h3>
            <div className="flex gap-2 flex-wrap">
              {mediaTypes.map((type) => {
                const isSelected =
                  type.id === "any"
                    ? localFilters.mediaTypes.length === 0
                    : localFilters.mediaTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    data-testid={`filter-media-${type.id}`}
                    onClick={() => handleMediaTypeToggle(type.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engagement Type */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Engagement Type</h3>
            <div className="flex gap-2 flex-wrap">
              {engagementTypes.map((type) => {
                const isSelected =
                  type.id === "any"
                    ? localFilters.engagementTypes.length === 0
                    : localFilters.engagementTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    data-testid={`filter-engagement-${type.id}`}
                    onClick={() => handleEngagementTypeToggle(type.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleClear}
            className="flex-1 border-gray-300"
            data-testid="button-clear-filters"
          >
            Clear All
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-apply-filters"
          >
            Show Results
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
