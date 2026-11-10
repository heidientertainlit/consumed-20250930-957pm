import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FinishedReactionMedia } from "@/lib/finished-media-follow-up";

export function isTvMedia(type?: string) {
  return /^(tv|tv_show|tv_shows|tv_series|television|series)$/.test((type || "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
}

/** Query keys isolate titles/seasons; changing a season clears its episode synchronously. */
export function useFinishedTvScope(media: FinishedReactionMedia | null, enabled: boolean) {
  const [selection, setSelection] = useState<{ key: string; season: number | null; episode: number | null }>({ key: "", season: null, episode: null });
  const key = `${media?.externalSource}:${media?.externalId}`;
  const selectedSeason = selection.key === key ? selection.season : null;
  const selectedEpisode = selection.key === key ? selection.episode : null;
  const tv = isTvMedia(media?.mediaType);
  const url = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
  async function load(path: string) {
    const response = await fetch(`${url}/functions/v1/${path}`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    });
    if (!response.ok) throw new Error("Couldn't load season or episode choices.");
    return response.json();
  }
  const supported = !!media?.externalId && media.externalSource === "tmdb";
  const seasonsQuery = useQuery({
    queryKey: ["finished-tv-seasons", key],
    enabled: enabled && tv && supported,
    queryFn: () => load(`get-media-details?source=tmdb&external_id=${encodeURIComponent(media!.externalId!)}&media_type=tv`),
    retry: false,
  });
  const episodesQuery = useQuery({
    queryKey: ["finished-tv-episodes", key, selectedSeason],
    enabled: enabled && tv && supported && selectedSeason !== null,
    queryFn: () => load(`get-season-episodes?external_id=${encodeURIComponent(media!.externalId!)}&season=${selectedSeason}`),
    retry: false,
  });
  const seasons = (seasonsQuery.data?.seasons || []).map((s: any) => ({ seasonNumber: s.seasonNumber ?? s.season_number }));
  const episodes = (episodesQuery.data?.episodes || []).map((e: any) => ({ episodeNumber: e.episodeNumber ?? e.episode_number, name: e.name }));
  return {
    tv,
    seasons, episodes, selectedSeason, selectedEpisode,
    loadingSeasons: seasonsQuery.isFetching,
    loadingEpisodes: episodesQuery.isFetching,
    error: !supported && tv ? "Season choices need a linked TV title." : seasonsQuery.error?.message || episodesQuery.error?.message || null,
    onSeasonChange: (season: number | null) => setSelection({ key, season, episode: null }),
    onEpisodeChange: (episode: number | null) => setSelection({ key, season: selectedSeason, episode }),
    onRetry: () => { void (seasonsQuery.error ? seasonsQuery.refetch() : episodesQuery.refetch()); },
    reset: () => setSelection({ key: "", season: null, episode: null }),
  };
}
