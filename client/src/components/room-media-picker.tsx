import { useEffect, useRef, useState } from "react";
import { Check, Link2, Search, Tv, X } from "lucide-react";
import { RoomMediaAttachment, type RoomMediaAttachment as Attachment, roomMediaAttachmentToDatabaseFields } from "@/components/room-media-attachment";
import { parseYouTubeUrl } from "@/lib/youtube-url";

const API = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
const filters = [{ id: "", label: "All" }, { id: "tv", label: "TV" }, { id: "movie", label: "Movies" }, { id: "book", label: "Books" }, { id: "music", label: "Music" }, { id: "podcast", label: "Podcasts" }, { id: "youtube", label: "YouTube" }];
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
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [episode, setEpisode] = useState<number | null>(null);
  const [series, setSeries] = useState<Attachment | null>(null);
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open && autoFocus) input.current?.focus(); }, [open, autoFocus]);
  useEffect(() => {
    if (!open || query.trim().length < 2 || parseYouTubeUrl(query)) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      const id = ++request.current; setLoading(true); setError("");
      try {
        const response = await fetch(`${API}/functions/v1/media-search`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim(), include_book_series: true, ...(filter ? { type: filter } : {}) }) });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        if (id === request.current) setResults((data.results || []).filter((r: any) => !filter || r.type === filter || (filter === "book" && r.type === "book_series")));
      } catch { if (id === request.current) setError("Search is unavailable right now. Try again."); } finally { if (id === request.current) setLoading(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, query, filter, token]);
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
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3"><Search size={16} className="text-gray-400" /><input ref={input} value={query} onChange={e => { setQuery(e.target.value); setError(""); }} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-gray-400" aria-label="Search media" /><button type="button" onClick={() => setOpen(false)} aria-label="Close media picker"><X size={16} /></button></div>
      <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1">{filters.map(f => <button type="button" key={f.id} onClick={() => setFilter(f.id)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${filter === f.id ? "bg-purple-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{f.label}</button>)}</div>
      {parseYouTubeUrl(query) && <button type="button" onClick={() => void pasteYoutube()} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-red-50 p-2.5 text-left text-sm font-semibold text-red-700"><Link2 size={15} />Attach this YouTube link</button>}
      {series ? <div className="mt-3 space-y-2"><button type="button" onClick={() => setSeries(null)} className="text-xs font-semibold text-[#786d65]">Back to results</button><p className="truncate text-sm font-semibold">{series.title}</p><button type="button" onClick={() => finishTv()} className="flex w-full items-center justify-between rounded-lg border border-[#e1d8d1] px-3 py-2 text-left text-xs font-semibold hover:bg-[#f3ede8]"><span>Attach whole series</span><Tv size={13} /></button><div className="flex gap-2 overflow-x-auto">{seasons.map(s => { const n = s.seasonNumber || s.season_number; return <button type="button" key={n} onClick={() => void chooseSeason(n)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${season === n ? "border-[#3d3430] bg-[#3d3430] text-white" : "border-[#e1d8d1]"}`}>Season {n}</button>; })}</div>{season != null && <div className="max-h-40 space-y-1 overflow-y-auto">{episodes.map(ep => { const n = ep.episodeNumber || ep.episode_number; return <button type="button" key={n} onClick={() => finishTv(ep)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-[#f3ede8]"><span>Episode {n} · {ep.name || "Untitled"}</span><Check size={13} /></button>; })}<button type="button" onClick={() => finishTv()} className="w-full rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f3ede8]">Attach whole season</button></div>}</div> : <div className="mt-2 max-h-64 overflow-y-auto">{loading ? <div className="space-y-2 p-2">{[1,2,3].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[#f2ece7]" />)}</div> : error ? <p className="p-3 text-xs text-[#a04d42]">{error}</p> : results.length ? results.map((r, i) => <button type="button" key={`${r.external_id || r.id || r.title}-${i}`} onClick={() => choose(r)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[#f4eee9]"><div className="h-11 w-8 shrink-0 overflow-hidden rounded bg-[#eee8e2]">{(r.poster_url || r.image || r.image_url) && <img src={r.poster_url || r.image || r.image_url} alt="" className="h-full w-full object-cover" />}</div><span className="min-w-0"><b className="block truncate text-sm text-[#39312d]">{r.title || r.name}</b><small className="text-xs text-[#91867d]">{r.type === "tv" ? "TV series" : r.type || "Media"}{r.year ? ` · ${r.year}` : ""}</small></span></button>) : <p className="p-3 text-center text-xs text-[#978c83]">{query ? "No matches yet." : "Search for something to attach."}</p>}</div>}
    </div>}
  </div>;
}
export { roomMediaAttachmentToDatabaseFields };
export default RoomMediaPicker;