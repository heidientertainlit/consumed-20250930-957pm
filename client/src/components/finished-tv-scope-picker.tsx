import { Loader2 } from "lucide-react";

export interface FinishedTvScopePickerProps {
  seasons: { seasonNumber: number }[];
  episodes: { episodeNumber: number; name?: string }[];
  selectedSeason: number | null;
  selectedEpisode: number | null;
  loadingSeasons: boolean;
  loadingEpisodes: boolean;
  error: string | null;
  disabled: boolean;
  onSeasonChange: (number: number | null) => void;
  onEpisodeChange: (number: number | null) => void;
  onRetry: () => void;
}

export function FinishedTvScopePicker({
  seasons,
  episodes,
  selectedSeason,
  selectedEpisode,
  loadingSeasons,
  loadingEpisodes,
  error,
  disabled,
  onSeasonChange,
  onEpisodeChange,
  onRetry,
}: FinishedTvScopePickerProps) {
  const selectedEpisodeName = episodes.find((episode) => episode.episodeNumber === selectedEpisode)?.name;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-700">
        Season &amp; episode <span className="font-normal text-gray-400">(optional)</span>
      </p>

      {loadingSeasons ? (
        <div className="flex items-center gap-2 py-1 text-sm text-gray-400" role="status" aria-live="polite">
          <Loader2 className="animate-spin" size={14} aria-hidden="true" /> Loading seasons…
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <p className="text-rose-700" role="alert">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={disabled}
            className="font-semibold text-purple-700 underline underline-offset-2 transition-colors hover:text-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      ) : seasons.length > 0 ? (
        <div className="space-y-2">
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1"
            role="group"
            aria-label="Select a season"
          >
            <button
              type="button"
              onClick={() => onSeasonChange(null)}
              disabled={disabled}
              aria-label="Whole series"
              aria-pressed={selectedSeason === null}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selectedSeason === null
                  ? "border-purple-600 bg-purple-600 text-white"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
              data-testid="quick-track-season-all"
            >
              Whole series
            </button>
            {seasons.map(({ seasonNumber }) => (
              <button
                key={seasonNumber}
                type="button"
                onClick={() => onSeasonChange(selectedSeason === seasonNumber ? null : seasonNumber)}
                disabled={disabled}
                aria-label={`Season ${seasonNumber}`}
                aria-pressed={selectedSeason === seasonNumber}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selectedSeason === seasonNumber
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
                data-testid={`quick-track-season-${seasonNumber}`}
              >
                Season {seasonNumber}
              </button>
            ))}
          </div>

          {selectedSeason !== null && (
            <div
              className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1"
              role="group"
              aria-label={`Select an episode in season ${selectedSeason}`}
            >
              {loadingEpisodes ? (
                <div className="flex items-center gap-2 py-1 text-sm text-gray-400" role="status" aria-live="polite">
                  <Loader2 className="animate-spin" size={14} aria-hidden="true" /> Loading episodes…
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onEpisodeChange(null)}
                    disabled={disabled}
                    aria-label="All episodes"
                    aria-pressed={selectedEpisode === null}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedEpisode === null
                        ? "border-purple-300 bg-purple-100 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                    data-testid="quick-track-episode-all"
                  >
                    All episodes
                  </button>
                  {episodes.map(({ episodeNumber, name }) => (
                    <button
                      key={episodeNumber}
                      type="button"
                      onClick={() => onEpisodeChange(selectedEpisode === episodeNumber ? null : episodeNumber)}
                      disabled={disabled}
                      aria-label={`Episode ${episodeNumber}${name ? `: ${name}` : ""}`}
                      aria-pressed={selectedEpisode === episodeNumber}
                      title={name || undefined}
                      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedEpisode === episodeNumber
                          ? "border-purple-300 bg-purple-100 text-purple-700"
                          : "border-gray-200 bg-white text-gray-600"
                      }`}
                      data-testid={`quick-track-episode-${episodeNumber}`}
                    >
                      Ep {episodeNumber}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {selectedSeason !== null && selectedEpisode !== null && (
            <p className="text-xs text-gray-500">
              Tracking S{selectedSeason} · E{selectedEpisode}
              {selectedEpisodeName ? ` — ${selectedEpisodeName}` : ""}
            </p>
          )}
        </div>
      ) : (
        <p className="py-1 text-sm text-gray-400">No seasons available.</p>
      )}
    </div>
  );
}
