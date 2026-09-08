import { useEffect, useRef, useState } from "react";
import { Check, Link2, Search, Tv, X } from "lucide-react";
import { RoomMediaAttachment, type RoomMediaAttachment as Attachment, roomMediaAttachmentToDatabaseFields } from "@/components/room-media-attachment";
import { parseYouTubeUrl } from "@/lib/youtube-url";
import { MEDIA_SEARCH_FILTERS, requestMediaSearch } from "@/components/media-search-panel";
import { getBookVolumeLabel } from "@/lib/book-volume";

const API = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
type MediaTypeFilter = Exclude<(typeof MEDIA_SEARCH_FILTERS)[number]["value"], undefined>;
type Props = {
  value: Attachment | null;
  onChange: (value: Attachment | null) => void;
  token: string;
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  triggerLabel?: string;
  disabled?: boolean;
};

const pick = (r: any): Attachment => ({
  ...r,
  title: r.title || r.name || "Untitled",
  type: r.type || r.media_type || "movie",
  creator: r.creator || r.author || r.artist || null,
  imageUrl: r.imageUrl || r.image_url || r.poster_url || r.image || r.thumbnail_url || null,
  externalId: r.externalId || r.external_id || r.id || null,
  externalSource: r.externalSource || r.external_source || r.source || "tmdb",
  mediaSubtype: r.mediaSubtype || r.media_subtype || null,
});

function typeLabel(type?: string, mediaSubtype?: string) {
  if (type === "tv") return "TV Series";
  if (type === "movie") return "Movie";
  if (type === "book") return "Book";
  if (type === "book_series") return "Book Series";
  if (type === "music") return mediaSubtype === "album" ? "Album" : mediaSubtype === "song" || mediaSubtype === "track" ? "Song" : "Music";
  if (type === "podcast") return "Podcast";
  if (type === "youtube") return "YouTube";
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "";
}

export async function resolveYouTubeAttachment(input: string, token: string): Promise<Attachment | null> {
  const parsed = parseYouTubeUrl(input);
  if (!parsed) return null;
  const response = await fetch(
    `${API}/functions/v1/get-media-details?source=youtube&external_id=${encodeURIComponent(parsed.id)}&media_type=youtube`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) return null;
  const details = await response.json();
  return pick({
    ...details,
    type: "youtube",
    media_subtype: details.media_subtype || (parsed.subtype === "handle" ? "channel" : parsed.subtype),
    external_id: details.externalId || parsed.id,
    external_source: "youtube",
    image_url: details.artwork,
    mediaUrl: parsed.url,
    youtubeVideoId: parsed.subtype === "video" ? parsed.id : null,
    youtubeChannelId: parsed.subtype === "channel" || parsed.subtype === "handle"
      ? details.externalId || parsed.id
      : null,
  });
}

export function RoomMediaPicker({ value, onChange, token, compact = false, autoFocus = false, placeholder = "Search a title or paste a YouTube link", className = "", triggerLabel = "Add media", disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MediaTypeFilter | undefined>(undefined);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [episode, setEpisode] = useState<number | null>(null);
  const [series, setSeries] = useState<Attachment | null>(null);
  const request = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);
  const previousFilter = useRef<MediaTypeFilter | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open && autoFocus) input.current?.focus(); }, [open, autoFocus]);
  useEffect(() => {
    const trimmedQuery = query.trim();
    const filterChanged = previousFilter.current !== filter;
    previousFilter.current = filter;
    searchAbort.current?.abort();
    searchAbort.current = null;
    request.current += 1;
    setLoading(false);
    setError("");

    if (!open || !trimmedQuery || trimmedQuery.length < 2 || parseYouTubeUrl(query)) {
      setResults([]);
      return;
    }
    const search = async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      const id = ++request.current;
      setLoading(true);
      try {
        const searched = await requestMediaSearch({ query: trimmedQuery, type: filter, bearer: token, signal: controller.signal });
        if (id === request.current) setResults(searched);
      } catch (err) {
        if (!controller.signal.aborted && id === request.current) {
          setError(err instanceof Error ? err.message : "Media search failed. Please try again.");
        }
      } finally {
        if (id === request.current) {
          setLoading(false);
          if (searchAbort.current === controller) searchAbort.current = null;
        }
      }
    };
    if (filterChanged) {
      void search();
      return;
    }
    const timer = window.setTimeout(() => void search(), 200);
    return () => window.clearTimeout(timer);
  }, [open, query, filter, token]);
  useEffect(() => () => {
    searchAbort.current?.abort();
    request.current += 1;
  }, []);
  const fetchSeries = async (item: Attachment) => {
    setSeries(item); setSeason(null); setEpisode(null); setEpisodes([]); setSeasons([]);
    try {
      const res = await fetch(`${API}/functions/v1/get-media-details?source=tmdb&external_id=${encodeURIComponent(item.externalId || "")}&media_type=tv`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json(); setSeasons(data.seasons || []);
    } catch { setError("Could not load seasons."); }
  };
  const choose = (raw: any) => {
    const item = pick(raw);
    if (item.type === "tv" && item.externalId) { void fetchSeries(item); return; }
    onChange(item); setOpen(false); setQuery("");
  };
  const chooseSeason = async (n: number) => {
    setSeason(n); setEpisode(null);
    try {
      const res = await fetch(`${API}/functions/v1/get-season-episodes?external_id=${encodeURIComponent(series?.externalId || "")}&season=${n}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json(); setEpisodes(data.episodes || []);
    } catch { setError("Could not load episodes."); }
  };
  const finishTv = (ep?: any) => {
    if (!series) return;
    onChange({ ...series, seasonNumber: season, episodeNumber: ep ? (ep.episodeNumber || ep.episode_number) : null, episodeTitle: ep?.name || null });
    setOpen(false); setSeries(null); setQuery("");
  };
  const pasteYoutube = async () => {
    if (!parseYouTubeUrl(query)) return;
    setLoading(true);
    let attached = false;
    try {
      const media = await resolveYouTubeAttachment(query, token);
      if (media) {
        onChange(media);
        attached = true;
      }
      else setError("We couldn't resolve that YouTube link.");
    } catch {
      setError("We couldn't resolve that YouTube link.");
    } finally {
      setLoading(false);
      if (attached) { setOpen(false); setQuery(""); }
    }
  };
  return <div className={`relative ${className}`}>
    {value ? <RoomMediaAttachment media={value} compact={compact} editable onRemove={() => onChange(null)} /> : <button type="button" disabled={disabled} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-purple-200 bg-purple-50/50 px-3 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:border-purple-300 hover:bg-purple-50 disabled:opacity-50"><Link2 size={16} /><span>{triggerLabel}</span></button>}
    {open && <div className="relative z-30 mt-2 w-full min-w-[290px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input ref={input} value={query} onChange={e => { setQuery(e.target.value); setError(""); }} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-16 text-base text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400" aria-label="Search media" data-testid="media-search-input" />
        <button type="button" onClick={() => setOpen(false)} aria-label="Close media picker" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200"><X size={15} /></button>
      </div>
      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold text-gray-500">Filter by media type</p>
        <div className="scrollbar-hide flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} aria-label="Filter media type" data-testid="media-search-type-filters">
          {MEDIA_SEARCH_FILTERS.map(({ value, label }) => <button type="button" key={value || "all"} aria-pressed={filter === value} data-testid={`filter-media-${value || "all"}`} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors ${filter === value ? "border-purple-600 bg-purple-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50"}`}>{label}</button>)}
        </div>
      </div>
      {parseYouTubeUrl(query) && <button type="button" onClick={() => void pasteYoutube()} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-red-50 p-2.5 text-left text-sm font-semibold text-red-700"><Link2 size={15} />Attach this YouTube link</button>}
      {series ? <div className="mt-3 space-y-2"><button type="button" onClick={() => setSeries(null)} className="text-xs font-semibold text-[#786d65]">Back to results</button><p className="truncate text-sm font-semibold">{series.title}</p><button type="button" onClick={() => finishTv()} className="flex w-full items-center justify-between rounded-lg border border-[#e1d8d1] px-3 py-2 text-left text-xs font-semibold hover:bg-[#f3ede8]"><span>Attach whole series</span><Tv size={13} /></button><div className="flex gap-2 overflow-x-auto">{seasons.map(s => { const n = s.seasonNumber || s.season_number; return <button type="button" key={n} onClick={() => void chooseSeason(n)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${season === n ? "border-[#3d3430] bg-[#3d3430] text-white" : "border-[#e1d8d1]"}`}>Season {n}</button>; })}</div>{season != null && <div className="max-h-40 space-y-1 overflow-y-auto">{episodes.map(ep => { const n = ep.episodeNumber || ep.episode_number; return <button type="button" key={n} onClick={() => finishTv(ep)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-[#f3ede8]"><span>Episode {n} · {ep.name || "Untitled"}</span><Check size={13} /></button>; })}<button type="button" onClick={() => finishTv()} className="w-full rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f3ede8]">Attach whole season</button></div>}</div> : <div className="mt-3 max-h-64 overflow-y-auto">{loading ? <div className="space-y-2 p-2">{[1,2,3].map(n => <div key={n} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}</div> : error ? <p role="alert" className="p-3 text-center text-sm text-red-600">{error}</p> : results.length ? <><p className="mb-1.5 text-xs font-semibold text-gray-400">Top results</p><div className="space-y-1 rounded-xl border border-gray-200 p-1" data-testid="media-search-results">{results.slice(0, 12).map((r, i) => <button type="button" key={`${r.external_id || r.id || r.title}-${i}`} onClick={() => choose(r)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-50" data-testid={`media-search-result-${r.external_id}`}><div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100">{r.image && <img src={r.image} alt={r.title || r.name} className="h-full w-full object-cover" />}</div><span className="min-w-0"><b className="block truncate text-sm text-gray-900">{r.title || r.name}</b><small className="text-xs text-gray-500">{typeLabel(r.type, r.media_subtype)}{getBookVolumeLabel(r) ? ` • ${getBookVolumeLabel(r)}` : ""}{r.year ? ` • ${r.year}` : ""}</small>{r.creator && r.creator !== "Unknown Author" && <small className="block truncate text-xs text-gray-400">{r.creator}</small>}</span></button>)}</div></> : <p className="p-3 text-center text-sm text-gray-400">{query.trim().length >= 2 ? `No results for "${query}".` : "Search for something to attach."}</p>}</div>}
    </div>}
  </div>;
}
export { roomMediaAttachmentToDatabaseFields };
export default RoomMediaPicker;