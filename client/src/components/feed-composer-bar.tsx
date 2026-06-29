import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Star, BarChart2, TrendingUp, X, Search, Loader2, Flame, ArrowLeft, ArrowRight, MessageSquarePlus, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import Navigation from "@/components/navigation";
import { useLocation } from "wouter";

type TabType = "take" | "review" | "poll" | "prediction";
type MediaFilter = "all" | "tv" | "movie" | "book" | "podcast" | "music" | "game" | "youtube";

const TABS: { id: TabType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { id: "take",       label: "Take",       icon: <Flame className="w-5 h-5" />,       placeholder: "What's your hot take?" },
  { id: "review",     label: "Rate",       icon: <Star className="w-5 h-5" />,         placeholder: "Write your review..." },
  { id: "poll",       label: "Poll",       icon: <BarChart2 className="w-5 h-5" />,    placeholder: "Ask a question..." },
  { id: "prediction", label: "Prediction", icon: <TrendingUp className="w-5 h-5" />,   placeholder: "Make a prediction..." },
];

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all",     label: "All" },
  { id: "tv",      label: "TV Shows" },
  { id: "movie",   label: "Movies" },
  { id: "book",    label: "Books" },
  { id: "podcast", label: "Podcasts" },
  { id: "music",   label: "Music" },
  { id: "youtube", label: "YouTube" },
];

function typeLabel(type: string) {
  if (type === "tv") return "TV Show";
  if (type === "movie") return "Movie";
  if (type === "book") return "Book";
  if (type === "book_series") return "Book Series";
  if (type === "podcast") return "Podcast";
  if (type === "music") return "Music";
  if (type === "game") return "Game";
  return type || "Media";
}

function inferSeries(title: string): string | null {
  const m = /^(.+?)\s+and\s+the\s+/i.exec(title);
  if (m) { const c = m[1].trim(); if (c.split(/\s+/).length <= 4) return c; }
  return null;
}

const SOURCE_COLORS: Record<string, string> = {
  'consumed':        'bg-purple-100 text-purple-700',
  'netflix':         'bg-violet-100 text-violet-700',
  'disney-plus':     'bg-indigo-100 text-indigo-700',
  'max':             'bg-blue-100 text-blue-700',
  'trending-tv':     'bg-violet-100 text-violet-700',
  'trending-movies': 'bg-indigo-100 text-indigo-700',
  'nyt':             'bg-fuchsia-100 text-fuchsia-700',
  'open-library':    'bg-purple-100 text-purple-700',
  'apple-music':     'bg-fuchsia-100 text-fuchsia-700',
  'apple-podcasts':  'bg-blue-100 text-blue-700',
};

function MediaCard({ item, onTrack, light }: { item: any; onTrack: () => void; onRate?: () => void; light?: boolean }) {
  return (
    <div className="flex-shrink-0 w-[104px]">
      <div className="relative w-full rounded-xl overflow-hidden" style={{ height: '148px' }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Search size={24} className="text-white/20" />
            </div>
        }
        {/* Gradient scrim so the add button is readable */}
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)' }} />
        {/* Add button overlaid at poster bottom-right */}
        <button
          onClick={onTrack}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 border border-white/20"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>
      <p className={`text-xs font-semibold mt-2 leading-snug line-clamp-2 ${light ? 'text-gray-900' : 'text-white'}`}>{item.title}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {item.source_label && (
          <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[item.source_key] || 'bg-purple-100 text-purple-700'}`}>
            {item.source_label}
          </span>
        )}
        <span className={`text-[10px] ${light ? 'text-gray-500' : 'text-white/40'}`}>{typeLabel(item.type)}</span>
      </div>
    </div>
  );
}

function MediaRow({
  item, onTrack, onRate, light,
  seriesExpanded, seriesBooks, seriesLoading, onToggleSeries,
  onTrackBook, onRateBook,
}: {
  item: any;
  onTrack: () => void;
  onRate: () => void;
  light?: boolean;
  seriesExpanded?: boolean;
  seriesBooks?: any[];
  seriesLoading?: boolean;
  onToggleSeries?: () => void;
  onTrackBook?: (book: any) => void;
  onRateBook?: (book: any) => void;
}) {
  const isSeries = item.type === "book_series";
  const seriesLabel = item.type === "book" ? (item.series || inferSeries(item.title)) : null;
  const seriesCount = item.series_count;

  return (
    <div>
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        {item.image_url
          ? <img src={item.image_url} alt="" className="object-cover rounded-lg flex-shrink-0" style={{ height: '72px', width: '52px' }} />
          : <div className="rounded-lg flex-shrink-0" style={{ width: 52, height: 72, background: 'rgba(255,255,255,0.1)' }} />
        }
        <div className="flex-1 min-w-0" onClick={isSeries ? onToggleSeries : undefined} style={isSeries ? { cursor: 'pointer' } : {}}>
          <p className={`text-sm font-semibold leading-snug line-clamp-2 ${light ? 'text-gray-900' : 'text-white'}`}>{item.title}</p>
          <p className={`text-xs mt-1 ${light ? 'text-gray-500' : 'text-white/40'}`}>
            {typeLabel(item.type)}{item.year ? ` • ${item.year}` : ""}
            {item.creator && item.creator !== "Unknown Author" ? ` • ${item.creator}` : ""}
          </p>
          {isSeries && seriesCount > 0 && (
            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1.5 ${light ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-purple-500/30 text-purple-200 border border-purple-400/40'}`}>
              📚 {seriesCount} books {seriesExpanded ? "▲" : "▼"}
            </span>
          )}
          {seriesLabel && (
            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1.5 max-w-[140px] truncate ${light ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
              📚 {seriesLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onTrack} className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center transition-all active:scale-90">
            <Plus size={16} className="text-white" />
          </button>
          <button onClick={onRate} className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 relative" style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
            <MessageSquarePlus size={15} className="text-white" />
            <Star size={7} className="absolute -top-0.5 -right-0.5 fill-yellow-300 text-yellow-300" />
          </button>
        </div>
      </div>

      {/* Expanded series books panel */}
      {isSeries && seriesExpanded && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-purple-500/20" style={{ background: 'rgba(109,40,217,0.08)' }}>
          <div className="px-3 py-1.5 border-b border-purple-500/15">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${light ? 'text-purple-700' : 'text-purple-300'}`}>Books in this series</span>
          </div>
          {seriesLoading ? (
            <div className="px-4 py-3 flex items-center gap-2">
              <Loader2 size={12} className="text-purple-400 animate-spin" />
              <span className={`text-xs ${light ? 'text-gray-400' : 'text-white/40'}`}>Loading books…</span>
            </div>
          ) : !seriesBooks || seriesBooks.length === 0 ? (
            <p className={`px-4 py-3 text-xs ${light ? 'text-gray-400' : 'text-white/30'}`}>No individual books found.</p>
          ) : (
            seriesBooks.map((book: any, bIdx: number) => {
              const bPoster = book.poster_url || book.image_url || "";
              return (
                <div key={`${book.external_id}-b${bIdx}`} className="flex items-center gap-2.5 px-3 py-2 border-b border-purple-500/10 last:border-0">
                  {bPoster
                    ? <img src={bPoster} alt={book.title} className="w-8 h-11 object-cover rounded flex-shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <div className="w-8 h-11 rounded flex-shrink-0 flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.06)' }}>📖</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium line-clamp-2 leading-snug ${light ? 'text-gray-900' : 'text-white/90'}`}>{book.title}</p>
                    {book.year && <p className={`text-[10px] mt-0.5 ${light ? 'text-gray-400' : 'text-white/30'}`}>{book.year}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => onTrackBook?.(book)} className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center active:scale-90 transition-all">
                      <Plus size={12} className="text-white" />
                    </button>
                    <button onClick={() => onRateBook?.(book)} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all relative" style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
                      <MessageSquarePlus size={11} className="text-white" />
                      <Star size={5} className="absolute -top-0.5 -right-0.5 fill-yellow-300 text-yellow-300" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function FeedComposerBar({
  pageMode = false,
  startExpanded = false,
  onExternalClose,
}: {
  pageMode?: boolean;
  startExpanded?: boolean;
  onExternalClose?: () => void;
}) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isOpen, setIsOpen] = useState(pageMode || startExpanded);
  const PLACEHOLDERS = ["Your take...", "Thoughts?", "What's your next move?"];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 9000);
    return () => clearInterval(t);
  }, []);
  const [showMediaSearch, setShowMediaSearch] = useState(pageMode);
  const [searchSlideIn, setSearchSlideIn] = useState(pageMode);
  const [activeTab, setActiveTab] = useState<TabType>("review");
  const [contentText, setContentText] = useState("");
  const [ratingValue, setRatingValue] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [recommendedItems, setRecommendedItems] = useState<any[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [seriesBooksMap, setSeriesBooksMap] = useState<Record<string, any[]>>({});
  const [loadingSeriesId, setLoadingSeriesId] = useState<string | null>(null);
  const [seriesBulkTarget, setSeriesBulkTarget] = useState<any | null>(null);
  const [seriesBulkStep, setSeriesBulkStep] = useState<'choice' | 'pick-list'>('choice');
  const [seriesBulkAdding, setSeriesBulkAdding] = useState(false);
  const [seriesUserLists, setSeriesUserLists] = useState<any[]>([]);
  const [seriesUserListsLoading, setSeriesUserListsLoading] = useState(false);

  const fetchSeriesBooks = async (seriesTitle: string, seriesId: string, author?: string): Promise<any[]> => {
    if (seriesBooksMap[seriesId]) return seriesBooksMap[seriesId];
    setLoadingSeriesId(seriesId);
    try {
      const params = new URLSearchParams({ q: seriesTitle, limit: '12', fields: 'title,author_name,first_publish_year,cover_i,key' });
      if (author && author !== 'Unknown Author') params.set('author', author);
      const resp = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        const seen = new Set<string>();
        const books = (data.docs || [])
          .filter((d: any) => d.key && d.title)
          .filter((d: any) => { if (seen.has(d.key)) return false; seen.add(d.key); return true; })
          .slice(0, 8)
          .map((d: any) => ({
            title: d.title, type: 'book',
            creator: d.author_name?.[0] || author || '',
            poster_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
            external_id: d.key.replace('/works/', ''),
            external_source: 'openlibrary',
            year: d.first_publish_year ? String(d.first_publish_year) : '',
          }));
        setSeriesBooksMap(prev => ({ ...prev, [seriesId]: books }));
        return books;
      }
    } catch (_) {}
    finally { setLoadingSeriesId(null); }
    return [];
  };

  const toggleSeries = (r: any) => {
    const sid = r.external_id;
    if (expandedSeriesId === sid) { setExpandedSeriesId(null); return; }
    setExpandedSeriesId(sid);
    fetchSeriesBooks(r.title, sid, r.creator);
  };

  const openSeriesBulkAdd = (r: any) => {
    setSeriesBulkTarget(r);
    setSeriesBulkStep('choice');
  };

  const fetchUserListsForSeries = async () => {
    if (!session?.access_token) return;
    setSeriesUserListsLoading(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
      const res = await fetch(`${url}/functions/v1/get-user-lists-with-media`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const systemNames = ['Want To', 'Currently', 'Finished', 'Did Not Finish', 'Favorites'];
        const lists = (data.lists || []).filter((l: any) =>
          systemNames.some(n => l.title?.startsWith(n))
        );
        setSeriesUserLists(lists.length ? lists : (data.lists || []).slice(0, 5));
      }
    } catch (_) {}
    finally { setSeriesUserListsLoading(false); }
  };

  const bulkAddSeries = async (listId: string, listTitle: string) => {
    if (!seriesBulkTarget || !session?.access_token) return;
    setSeriesBulkAdding(true);
    try {
      const sid = seriesBulkTarget.external_id;
      const books = await fetchSeriesBooks(seriesBulkTarget.title, sid, seriesBulkTarget.creator);
      if (!books.length) {
        toast({ title: "Couldn't load books for this series", variant: "destructive" });
        return;
      }
      const url = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
      for (const book of books) {
        await fetch(`${url}/functions/v1/add-media-to-list`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            list_id: listId,
            media_title: book.title,
            media_type: 'book',
            media_creator: book.creator || seriesBulkTarget.creator || '',
            media_image_url: book.poster_url || '',
            media_external_id: book.external_id,
            media_external_source: book.external_source || 'openlibrary',
            series_name: seriesBulkTarget.title,
            skip_social_post: true,
          }),
        });
      }
      toast({ title: `Added ${books.length} books to ${listTitle}` });
      setSeriesBulkTarget(null);
    } catch (_) {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSeriesBulkAdding(false);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const showRating = activeTab === "review";
  const showPollOptions = activeTab === "poll" || activeTab === "prediction";

  useEffect(() => {
    if (isOpen && !showMediaSearch && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
    if (showMediaSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, showMediaSearch]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      if (!session?.access_token) return;
      setIsSearching(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
        const res = await fetch(`${url}/functions/v1/media-search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, type: mediaFilter === "all" ? undefined : mediaFilter, include_book_series: true }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults((data.results || []).slice(0, 10).map((r: any) => ({
          ...r,
          image_url: r.image_url || r.poster_url || r.image || "",
        })));
      } catch {}
      finally { setIsSearching(false); }
    }, 350);
  }, [searchQuery, mediaFilter, session]);

  const resetForm = () => {
    setContentText("");
    setRatingValue(0);
    setHoverRating(0);
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    setPollOptions(["", ""]);
    setMediaFilter("all");
    if (pageMode) {
      // In pageMode the composer IS the page; Cancel/backdrop returns to the
      // media browse instead of unmounting the portal to a blank /add page.
      setShowMediaSearch(true);
      setSearchSlideIn(true);
      return;
    }
    setShowMediaSearch(false);
    setIsOpen(false);
    if (startExpanded) onExternalClose?.();
  };

  useEffect(() => {
    if (!showMediaSearch) return;
    requestAnimationFrame(() => setSearchSlideIn(true));

    const userId = session?.user?.id;
    if (!userId) return;

    supabase
      .from("list_items")
      .select("title, media_type, image_url, external_id, external_source, creator")
      .eq("user_id", userId)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecommendedItems(
          data.filter(r => r.image_url).map(r => ({
            title: r.title, type: r.media_type, image_url: r.image_url,
            external_id: r.external_id, external_source: r.external_source, creator: r.creator,
          }))
        );
      });

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(`${supabaseUrl}/functions/v1/get-trending-content`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json())
      .then(data => {
        setTrendingItems(
          (data.items || [])
            .filter((item: any) => item.image_url)
            .slice(0, 25)
            .map((item: any) => ({
              title: item.title,
              type: item.media_type,
              image_url: item.image_url,
              external_id: item.external_id || item.id,
              external_source: item.external_source || 'tmdb',
              source_label: item.source_label,
              source_key: item.source_key,
            }))
        );
      })
      .catch(() => {});
  }, [showMediaSearch, session]);

  const closeMediaSearch = () => {
    if (pageMode) {
      window.history.back();
      return;
    }
    setSearchSlideIn(false);
    setTimeout(() => {
      setShowMediaSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setMediaFilter("all");
    }, 260);
  };

  const selectMedia = (media: any) => {
    setSelectedMedia(media);
    // In pageMode the search layer covers the composer card. Slide it away to
    // reveal the composer instead of navigating back off the /add page.
    setSearchSlideIn(false);
    setTimeout(() => {
      setShowMediaSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setMediaFilter("all");
    }, 260);
  };

  const canPost = () => {
    if (activeTab === "take") return contentText.trim().length > 0;
    if (activeTab === "review") return !!selectedMedia && (ratingValue > 0 || contentText.trim().length > 0);
    if (activeTab === "poll") return pollOptions[0].trim().length > 0 && pollOptions[1].trim().length > 0;
    if (activeTab === "prediction") return contentText.trim().length > 0 && pollOptions[0].trim() && pollOptions[1].trim();
    return false;
  };

  const handlePost = async () => {
    if (!session?.access_token || isPosting) return;
    setIsPosting(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
    try {
      if (activeTab === "take") {
        const res = await fetch(`${supabaseUrl}/functions/v1/inline-post`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: contentText.trim(), type: "thought", post_type: "hot_take", visibility: "public",
            media_title: selectedMedia?.title, media_type: (selectedMedia?.type || selectedMedia?.mediaType) === 'book_series' ? 'book' : (selectedMedia?.type || selectedMedia?.mediaType),
            media_creator: selectedMedia?.creator || selectedMedia?.author || selectedMedia?.artist,
            media_image_url: selectedMedia?.image_url || selectedMedia?.poster_url || selectedMedia?.image,
            media_external_id: selectedMedia?.external_id || selectedMedia?.id,
            media_external_source: selectedMedia?.external_source || selectedMedia?.source || "tmdb",
          }),
        });
        if (!res.ok) throw new Error("Failed to post take");
        toast({ title: "Hot take posted!" });
      } else if (activeTab === "review") {
        const content = contentText.trim() || (ratingValue > 0 ? `Rated ${selectedMedia.title}` : `Reviewed ${selectedMedia.title}`);
        const res = await fetch(`${supabaseUrl}/functions/v1/inline-post`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content, type: "rate-review", rating: ratingValue > 0 ? ratingValue : undefined, visibility: "public",
            media_title: selectedMedia.title, media_type: (selectedMedia.type || selectedMedia.mediaType) === 'book_series' ? 'book' : (selectedMedia.type || selectedMedia.mediaType),
            media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
            media_image_url: selectedMedia.image_url || selectedMedia.poster_url || selectedMedia.image,
            media_external_id: selectedMedia.external_id || selectedMedia.id,
            media_external_source: selectedMedia.external_source || selectedMedia.source || "tmdb",
          }),
        });
        if (!res.ok) throw new Error("Failed to post review");
        toast({ title: "Review posted!" });
      } else if (activeTab === "poll") {
        const filled = pollOptions.filter(o => o.trim());
        const res = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ question: contentText.trim() || "What do you think?", options: filled, type: "poll" }),
        });
        if (!res.ok) throw new Error("Failed to create poll");
        toast({ title: "Poll created!" });
      } else if (activeTab === "prediction") {
        const filled = pollOptions.filter(o => o.trim());
        const res = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            question: contentText.trim(), options: filled, type: "predict",
            media_title: selectedMedia?.title || null, media_type: selectedMedia?.type === 'book_series' ? 'book' : (selectedMedia?.type || null),
            media_image_url: selectedMedia?.image_url || selectedMedia?.poster_url || null,
            media_external_id: selectedMedia?.external_id || null,
            media_external_source: selectedMedia?.external_source || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to create prediction");
        toast({ title: "Prediction posted!" });
      }
      setTimeout(() => queryClient.refetchQueries({ queryKey: ["social-feed"] }), 800);
      resetForm();
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <>
      {/* Collapsed trigger — hidden when opened externally via startExpanded, and in
          pageMode where the composer IS the full page (no stray bar behind it) */}
      {!startExpanded && !pageMode && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <span key={placeholderIdx} className="text-gray-400 text-sm flex-1 animate-in fade-in duration-500">{PLACEHOLDERS[placeholderIdx]}</span>
        </button>
      )}

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[99999]">
          {/* Dim backdrop */}
          <div className="absolute inset-0 bg-black/65" onClick={resetForm} />

          {/* ── Composer card ── */}
          <div
            className="absolute left-4 right-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ top: '20%' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <button onClick={resetForm} className="text-sm font-medium text-gray-400 hover:text-gray-700">Cancel</button>
              <span className="text-sm font-semibold text-gray-700">{currentTab.label}</span>
              <button
                onClick={handlePost}
                disabled={!canPost() || isPosting}
                className="bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 active:scale-95 transition-all"
              >
                {isPosting && <Loader2 className="w-3 h-3 animate-spin" />}
                Post
              </button>
            </div>

            {/* Textarea */}
            <div className="px-5 pt-3 pb-2">
              <textarea
                ref={textareaRef}
                value={contentText}
                onChange={e => setContentText(e.target.value)}
                placeholder={currentTab.placeholder}
                rows={3}
                className="w-full text-base text-gray-800 placeholder:text-gray-400 resize-none border-0 outline-none focus:outline-none bg-transparent"
              />
            </div>

            {/* Selected media chip */}
            {selectedMedia && (
              <div className="mx-5 mb-2 flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
                {selectedMedia.image_url && (
                  <img src={selectedMedia.image_url} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{selectedMedia.title}</p>
                  <p className="text-[10px] text-gray-400">{typeLabel(selectedMedia.type)}{selectedMedia.year ? ` · ${selectedMedia.year}` : ""}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="text-gray-300 hover:text-red-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Rating */}
            {showRating && (
              <div className="mx-5 mb-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Rating:</span>
                <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const displayVal = hoverRating || ratingValue;
                    return (
                      <div key={star} className="relative" style={{ width: 26, height: 26 }}>
                        <Star size={26} className="absolute inset-0 text-gray-200" />
                        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                          <Star size={26} className={hoverRating > 0 ? 'fill-yellow-300 text-yellow-300' : 'fill-yellow-400 text-yellow-400'} />
                        </div>
                        <button
                          className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }}
                          onMouseEnter={() => setHoverRating(star - 0.5)}
                          onClick={() => setRatingValue(star - 0.5 === ratingValue ? 0 : star - 0.5)}
                          aria-label={`Rate ${star - 0.5}`}
                        />
                        <button
                          className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }}
                          onMouseEnter={() => setHoverRating(star)}
                          onClick={() => setRatingValue(star === ratingValue ? 0 : star)}
                          aria-label={`Rate ${star}`}
                        />
                      </div>
                    );
                  })}
                  {(hoverRating > 0 || ratingValue > 0) && (
                    <span className="ml-1 text-xs text-gray-400">{hoverRating > 0 ? hoverRating : ratingValue}/5</span>
                  )}
                </div>
              </div>
            )}

            {/* Poll/Prediction options */}
            {showPollOptions && (
              <div className="mx-5 mb-2 space-y-1.5">
                {pollOptions.map((opt, i) => (
                  <input key={i} value={opt}
                    onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-purple-400 text-gray-800 placeholder:text-gray-400 bg-gray-50"
                  />
                ))}
              </div>
            )}

            {/* Bottom toolbar */}
            <div className="px-5 pb-4 pt-2 border-t border-gray-100 space-y-2">
              <div className="flex gap-1.5">
                {TABS.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className="flex flex-col items-center gap-1 flex-1 py-1 active:scale-95 transition-transform"
                    >
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                        isActive ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                        {tab.icon}
                      </div>
                      <span className={`text-[11px] font-semibold ${isActive ? "text-purple-700" : "text-gray-500"}`}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div>
                <button
                  onClick={() => setShowMediaSearch(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 transition-all"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Add media
                </button>
              </div>
            </div>
          </div>

          {/* ── Full-screen media search layer (slides up) ── */}
          {showMediaSearch && (
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{
                zIndex: 1,
                background: 'linear-gradient(to right, #0a0a0f 0%, #12121f 50%, #2d1f4e 100%)',
                transform: searchSlideIn ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              {/* Header row */}
              <div className="flex items-center px-4 pt-14 pb-2">
                <button onClick={closeMediaSearch} className="p-2 rounded-full hover:bg-white/10 transition-colors mr-2 flex-shrink-0">
                  <ArrowLeft size={22} className="text-white" />
                </button>
                <p className="text-base font-bold text-white flex-1 text-center pr-8">Add Media</p>
              </div>

              {/* Big headline */}
              <div className="px-5 pt-4 pb-5">
                <h2 className="text-3xl font-extrabold text-white leading-tight">What are you<br />looking for?</h2>
              </div>

              {/* Search bar */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 rounded-2xl px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Search size={16} className="text-white/50 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search movies, shows, books…"
                    className="flex-1 text-sm text-white placeholder:text-white/40 bg-transparent outline-none"
                  />
                  {searchQuery && (
                    isSearching
                      ? <Loader2 size={14} className="text-white/40 animate-spin flex-shrink-0" />
                      : <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}><X size={14} className="text-white/40" /></button>
                  )}
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-2 px-4 pb-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {MEDIA_FILTERS.map(f => (
                  <button key={f.id} onClick={() => setMediaFilter(f.id)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      mediaFilter === f.id ? "text-purple-400" : "text-white/60"
                    }`}
                    style={mediaFilter === f.id ? { background: 'rgba(40,40,48,0.9)' } : { background: 'rgba(255,255,255,0.08)' }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* ── Content area (white sheet in pageMode) ── */}
              <div className={pageMode ? 'bg-white min-h-screen pt-5 pb-24' : ''}>

              {/* ── Pre-search: poster grid sections ── */}
              {!searchQuery && (
                <div className="pb-10">
                  {trendingItems.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between px-5 mb-3">
                        <p className={`text-sm font-bold ${pageMode ? 'text-gray-900' : 'text-white'}`}>Trending Now</p>
                        <span className={`text-xs font-medium ${pageMode ? 'text-purple-600' : 'text-purple-400'}`}>See all</span>
                      </div>
                      <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {trendingItems.map((r, i) => (
                          <MediaCard key={i} item={r} light={pageMode}
                            onTrack={() => { setQuickAddMedia({ title: r.title, mediaType: r.type, imageUrl: r.image_url, externalId: r.external_id, externalSource: r.external_source }); setIsQuickAddOpen(true); }}
                            onRate={() => { setActiveTab("review"); selectMedia(r); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendedItems.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between px-5 mb-3">
                        <p className={`text-sm font-bold ${pageMode ? 'text-gray-900' : 'text-white'}`}>Recommended for You</p>
                        <button
                          type="button"
                          onClick={() => recommendedScrollRef.current?.scrollBy({ left: recommendedScrollRef.current.clientWidth * 0.8, behavior: 'smooth' })}
                          className={`flex items-center gap-0.5 text-xs font-medium ${pageMode ? 'text-purple-600' : 'text-purple-400'}`}
                        >
                          See More
                          <ChevronRight size={13} />
                        </button>
                      </div>
                      <div ref={recommendedScrollRef} className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {recommendedItems.map((r, i) => (
                          <MediaCard key={i} item={r} light={pageMode}
                            onTrack={() => { setQuickAddMedia({ title: r.title, mediaType: r.type, imageUrl: r.image_url, externalId: r.external_id, externalSource: r.external_source, creator: r.creator }); setIsQuickAddOpen(true); }}
                            onRate={() => { setActiveTab("review"); selectMedia(r); }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendedItems.length === 0 && trendingItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-8">
                      <Loader2 size={24} className={`animate-spin ${pageMode ? 'text-gray-300' : 'text-white/20'}`} />
                      <p className={`text-sm ${pageMode ? 'text-gray-400' : 'text-white/40'}`}>Loading suggestions…</p>
                    </div>
                  )}
                </div>
              )}

              {/* Loading */}
              {searchQuery && isSearching && (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="text-purple-400 animate-spin" />
                </div>
              )}

              {/* No results */}
              {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                  <p className={`text-sm ${pageMode ? 'text-gray-400' : 'text-white/40'}`}>No results for "<span className={pageMode ? 'text-gray-700' : 'text-white/60'}>{searchQuery}</span>"</p>
                </div>
              )}

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="pt-2 pb-10">
                  <p className={`px-5 text-xs font-bold uppercase tracking-widest mb-2 ${pageMode ? 'text-gray-500' : 'text-white/40'}`}>Results</p>
                  {searchResults.map((r, i) => {
                    const mediaType = r.type === 'book_series' ? 'book' : r.type;
                    const externalSource = r.external_source === 'openai' ? 'openlibrary' : (r.external_source || 'tmdb');
                    return (
                      <MediaRow key={i} item={r} light={pageMode}
                        onTrack={() => {
                          if (r.type === 'book_series') { openSeriesBulkAdd(r); }
                          else { setQuickAddMedia({ title: r.title, mediaType, imageUrl: r.image_url, externalId: r.external_id, externalSource: externalSource, creator: r.creator }); setIsQuickAddOpen(true); }
                        }}
                        onRate={() => { setActiveTab("review"); selectMedia({ ...r, type: r.type, external_source: externalSource }); }}
                        seriesExpanded={expandedSeriesId === r.external_id}
                        seriesBooks={seriesBooksMap[r.external_id]}
                        seriesLoading={loadingSeriesId === r.external_id}
                        onToggleSeries={() => toggleSeries(r)}
                        onTrackBook={(book) => { setQuickAddMedia({ title: book.title, mediaType: 'book', imageUrl: book.poster_url, externalId: book.external_id, externalSource: book.external_source || 'openlibrary', creator: book.creator, seriesName: r.type === 'book_series' ? r.title : undefined }); setIsQuickAddOpen(true); }}
                        onRateBook={(book) => { setActiveTab("review"); selectMedia({ ...book, image_url: book.poster_url }); }}
                      />
                    );
                  })}
                  <p className={`text-center text-xs mt-6 px-8 ${pageMode ? 'text-gray-400' : 'text-white/25'}`}>
                    Can't find what you're looking for?{" "}
                    <span className={`font-medium ${pageMode ? 'text-purple-600' : 'text-purple-400'}`}>Search more specifically →</span>
                  </p>
                </div>
              )}
              </div>
            </div>
          )}
        {/* ── Series bulk-add sheet ── */}
        {seriesBulkTarget && (
          <div
            className="absolute inset-0 flex flex-col justify-end"
            style={{ zIndex: 20, background: 'rgba(0,0,0,0.7)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setSeriesBulkTarget(null); }}
          >
            <div className="rounded-t-3xl px-5 pt-5 pb-10" style={{ background: 'linear-gradient(160deg, #12121f 0%, #1a1030 100%)' }}>
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

              {seriesBulkStep === 'choice' && (
                <>
                  {/* Series info */}
                  <div className="flex items-center gap-3 mb-6">
                    {seriesBulkTarget.image_url && (
                      <img src={seriesBulkTarget.image_url} className="w-12 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-white font-bold text-base leading-tight">{seriesBulkTarget.title}</p>
                      <p className="text-white/50 text-sm mt-0.5">Book Series · {seriesBulkTarget.series_count || seriesBooksMap[seriesBulkTarget.external_id]?.length || '?'} books · {seriesBulkTarget.creator}</p>
                    </div>
                  </div>

                  {/* Add all button */}
                  <button
                    onClick={() => { setSeriesBulkStep('pick-list'); fetchUserListsForSeries(); }}
                    className="w-full py-4 rounded-2xl font-bold text-white text-base mb-3"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                  >
                    📚 Add all {seriesBulkTarget.series_count || seriesBooksMap[seriesBulkTarget.external_id]?.length || ''} books
                  </button>

                  {/* Choose individually */}
                  <button
                    onClick={() => { toggleSeries(seriesBulkTarget); setSeriesBulkTarget(null); }}
                    className="w-full py-3.5 rounded-2xl font-semibold text-white/70 text-sm border border-white/15"
                  >
                    Browse individually
                  </button>
                </>
              )}

              {seriesBulkStep === 'pick-list' && (
                <>
                  <p className="text-white font-bold text-lg mb-1">Add all books to…</p>
                  <p className="text-white/40 text-sm mb-5">{seriesBulkTarget.title}</p>

                  {seriesUserListsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="text-purple-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {seriesUserLists.map((list: any) => (
                        <button
                          key={list.id}
                          disabled={seriesBulkAdding}
                          onClick={() => bulkAddSeries(list.id, list.title)}
                          className="w-full py-4 px-5 rounded-2xl text-left font-semibold text-white text-sm flex items-center justify-between disabled:opacity-50"
                          style={{ background: 'rgba(255,255,255,0.07)' }}
                        >
                          <span>{list.title}</span>
                          {seriesBulkAdding ? <Loader2 size={16} className="text-purple-400 animate-spin" /> : <span className="text-white/30 text-xs">{list.item_count ?? ''}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setSeriesBulkStep('choice')}
                    className="w-full mt-4 py-3 text-white/40 text-sm font-medium"
                  >
                    ← Back
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {pageMode && <Navigation hideTopBar inline />}
        </div>,
        document.body
      )}

      <QuickAddListSheet
        isOpen={isQuickAddOpen}
        onClose={() => { setIsQuickAddOpen(false); setQuickAddMedia(null); }}
        media={quickAddMedia}
        elevated={pageMode}
      />
    </>
  );
}

// ─── Two-chip replacement for the collapsed bar ───────────────────────────────
export function FeedActionChips({ dark = false, variant }: { dark?: boolean; variant?: 'cards' }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [, setLocation] = useLocation();

  if (variant === 'cards') {
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          {/* Add Media */}
          <button
            onClick={() => setLocation('/add')}
            className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed' }}>
              <Plus size={15} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[13px] text-gray-900 leading-tight">Save It</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Track movies, shows &amp; books</p>
            </div>
          </button>
          {/* Share a Take */}
          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-2xl text-left active:bg-gray-100 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)' }}>
              <MessageSquarePlus size={15} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[13px] text-gray-900 leading-tight">Share a Take</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Reviews, theories &amp; reactions</p>
            </div>
          </button>
        </div>
        {composerOpen && (
          <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />
        )}
      </>
    );
  }

  if (dark) {
    return (
      <>
        <div className="flex items-center">
          <button
            onClick={() => setLocation('/add')}
            className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 transition-opacity active:opacity-70"
          >
            <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed' }}>
              <Plus size={16} className="text-white" />
            </span>
            <span className="font-medium text-[12px]" style={{ color: '#c4a0ff' }}>Add Media</span>
            <ChevronRight size={12} style={{ color: '#c4a0ff', opacity: 0.7 }} />
          </button>
          <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <button
            onClick={() => setComposerOpen(true)}
            className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 transition-opacity active:opacity-70"
          >
            <span className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)' }}>
              <MessageSquarePlus size={16} className="text-white" />
            </span>
            <span className="font-medium text-[12px]" style={{ color: '#c4a0ff' }}>Share a Take</span>
            <ChevronRight size={13} style={{ color: '#c4a0ff', opacity: 0.7 }} />
          </button>
        </div>
        {composerOpen && (
          <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
        {/* Add Media */}
        <button
          onClick={() => setLocation('/add')}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 active:bg-gray-50 transition-colors"
        >
          <Plus size={15} className="text-gray-600 shrink-0" />
          <span className="font-medium text-[14px] text-gray-700">Add Media</span>
        </button>

        {/* Divider */}
        <div className="w-px self-stretch bg-gray-200" />

        {/* Share a Take */}
        <button
          onClick={() => setComposerOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 active:bg-gray-50 transition-colors"
        >
          <MessageSquarePlus size={15} className="text-gray-600 shrink-0" />
          <span className="font-medium text-[14px] text-gray-700">Share a Take</span>
        </button>
      </div>

      {composerOpen && (
        <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />
      )}
    </>
  );
}
