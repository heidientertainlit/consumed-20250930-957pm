import { useEffect, useRef, useState } from "react";
import { createRequestGuard, scopeOptions, type SearchItem, type SubjectScope } from "./conversation-subject";

const field = "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-violet-500 focus:outline-none";
const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

export function ConversationScopePicker({ subject, onChange }: {
  subject: SearchItem;
  onChange: (seasonNumber?: number, episodeNumber?: number) => void;
}) {
  const [seasons, setSeasons] = useState<SubjectScope[]>([]);
  const [episodes, setEpisodes] = useState<SubjectScope[]>([]);
  const [season, setSeason] = useState<number>();
  const [episode, setEpisode] = useState<number>();
  const [loading, setLoading] = useState<"season" | "episode" | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const guard = useRef(createRequestGuard());
  const callback = useRef(onChange);
  callback.current = onChange;
  const isTmdbTv = subject.type === "tv" && subject.externalSource === "tmdb" && Boolean(subject.externalId);

  useEffect(() => {
    if (!isTmdbTv) return;
    const request = guard.current.next();
    const abort = new AbortController();
    const kind = season === undefined ? "season" : "episode";
    const path = season === undefined
      ? `get-media-details?source=tmdb&external_id=${encodeURIComponent(subject.externalId!)}&media_type=tv`
      : `get-season-episodes?external_id=${encodeURIComponent(subject.externalId!)}&season=${season}`;
    setLoading(kind); setError("");
    void (async () => {
      try {
        const response = await fetch(`${baseUrl}/functions/v1/${path}`, {
          signal: abort.signal,
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        });
        if (!response.ok) throw new Error(`Could not load ${kind === "season" ? "seasons" : "episodes"}.`);
        const data = await response.json();
        if (!guard.current.current(request)) return;
        const options = scopeOptions(data[kind === "season" ? "seasons" : "episodes"], kind);
        if (kind === "season") setSeasons(options); else setEpisodes(options);
      } catch (cause) {
        if (guard.current.current(request) && !abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Scope could not be loaded.");
      } finally {
        if (guard.current.current(request)) setLoading(null);
      }
    })();
    return () => { guard.current.next(); abort.abort(); };
  }, [isTmdbTv, subject.externalId, season, retry]);

  if (!isTmdbTv) return null;
  const changeSeason = (value: string) => {
    guard.current.next();
    const next = value === "" ? undefined : Number(value);
    setSeason(next); setEpisode(undefined); setEpisodes([]); setError(""); setLoading(next === undefined ? null : "episode");
    callback.current(next, undefined);
  };
  return <div className="mt-3 space-y-2">
    <p className="text-xs text-gray-400">Season & episode (optional)</p>
    {loading === "season" && <div role="status" className="h-9 animate-pulse rounded-lg bg-gray-800"><span className="sr-only">Loading seasons</span></div>}
    <label className="block text-xs text-gray-500">Season<select aria-label="Conversation season" className={`${field} mt-1`} value={season ?? ""} onChange={event => changeSeason(event.target.value)}>
      <option value="">Whole series</option>{seasons.map(item => <option key={item.number} value={item.number}>Season {item.number}{item.name ? ` · ${item.name}` : ""}</option>)}
    </select></label>
    {season !== undefined && <label className="block text-xs text-gray-500">Episode<select aria-label="Conversation episode" disabled={loading === "episode"} className={`${field} mt-1`} value={episode ?? ""} onChange={event => {
      const next = event.target.value === "" ? undefined : Number(event.target.value);
      setEpisode(next); callback.current(season, next);
    }}><option value="">{loading === "episode" ? "Loading episodes…" : "Whole season"}</option>{episodes.map(item => <option key={item.number} value={item.number}>Episode {item.number}{item.name ? ` · ${item.name}` : ""}</option>)}</select></label>}
    {error && <p role="alert" className="text-xs text-red-300">{error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {season !== undefined && !loading && !error && !episodes.length && <p className="text-xs text-gray-500">No episodes available. You can still use the whole season.</p>}
  </div>;
}
