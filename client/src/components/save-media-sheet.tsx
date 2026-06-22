import { useState, useEffect, useRef } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Search, X, Clock, Play, Check, Ban, Loader2, ArrowLeft, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface SaveMediaSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MediaResult {
  title: string;
  type: string;
  creator?: string;
  image?: string;
  poster_url?: string;
  year?: number;
  external_id?: string;
  external_source?: string;
}

const LIST_OPTIONS = [
  { key: "Want To", label: "Want To", desc: "Read, Listen, Watch later", bg: "bg-blue-100", iconEl: <Clock className="text-blue-600" size={20} /> },
  { key: "Currently", label: "Currently", desc: "Currently consuming", bg: "bg-purple-100", iconEl: <Play className="text-purple-600" size={20} /> },
  { key: "Finished", label: "Finished", desc: "Completed media", bg: "bg-green-100", iconEl: <Check className="text-green-600" size={20} /> },
  { key: "Did Not Finish", label: "Did Not Finish", desc: "Stopped watching/reading", bg: "bg-red-100", iconEl: <Ban className="text-red-600" size={20} /> },
];

export function SaveMediaSheet({ isOpen, onClose }: SaveMediaSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [addingList, setAddingList] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedMedia(null);
      setAddingList(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const { data: results = [], isLoading } = useQuery<MediaResult[]>({
    queryKey: ["save-media-search", query],
    queryFn: async () => {
      if (!query.trim() || !session?.access_token) return [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
      const res = await fetch(`${supabaseUrl}/functions/v1/media-search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || []).slice(0, 10);
    },
    enabled: !!query.trim() && !!session?.access_token && isOpen,
    staleTime: 30_000,
  });

  const handleClose = () => {
    setQuery("");
    setSelectedMedia(null);
    setAddingList(null);
    onClose();
  };

  const handleAddToList = async (listName: string) => {
    if (!session?.access_token || !selectedMedia) return;
    setAddingList(listName);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

      const listsRes = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const listsData = await listsRes.json();
      const lists = listsData?.lists || [];
      const match = lists.find((l: any) => l.title?.toLowerCase().includes(listName.toLowerCase()));

      let listId = match?.id;
      if (!listId) {
        const createRes = await fetch(`${supabaseUrl}/functions/v1/create-custom-list`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ title: listName, is_default: true, is_private: false }),
        });
        const createData = await createRes.json();
        listId = createData?.list?.id || createData?.id;
      }

      if (!listId) throw new Error("Could not find or create list");

      const posterSrc = selectedMedia.poster_url || selectedMedia.image || "";
      const res = await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          list_id: listId,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type === "book_series" ? "book" : (selectedMedia.type || "movie"),
          media_creator: selectedMedia.creator || "",
          media_image_url: posterSrc,
          media_external_id: selectedMedia.external_id,
          media_external_source: selectedMedia.external_source === "openai" ? "openlibrary" : (selectedMedia.external_source || "tmdb"),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add");
      }

      queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
      queryClient.invalidateQueries({ queryKey: ["user-lists", session?.user?.id] });
      toast({ title: "Saved!", description: `${selectedMedia.title} added to ${listName}` });
      handleClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to add to list", variant: "destructive" });
    } finally {
      setAddingList(null);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent
        className="!rounded-t-2xl !border-0 !outline-none !shadow-none"
        style={{ background: "#ffffff", maxHeight: "90svh" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {selectedMedia ? (
          /* ── Step 2: List picker ── */
          <div className="flex flex-col" style={{ minHeight: "320px" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <button onClick={() => setSelectedMedia(null)} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{selectedMedia.title}</p>
                <p className="text-xs text-gray-400 capitalize">{selectedMedia.type}{selectedMedia.year ? ` · ${selectedMedia.year}` : ""}</p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-4 pt-2 pb-1">
              <p className="text-sm font-semibold text-gray-900">Add to List</p>
            </div>

            <div className="px-4 pb-6 pt-1 space-y-2">
              {LIST_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleAddToList(opt.key)}
                  disabled={!!addingList}
                  className="w-full flex items-center gap-4 py-3.5 px-4 rounded-2xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all text-left"
                >
                  <div className={`w-10 h-10 rounded-full ${opt.bg} flex items-center justify-center flex-shrink-0`}>
                    {addingList === opt.key ? <Loader2 size={18} className="animate-spin text-gray-500" /> : opt.iconEl}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Step 1: Search ── */
          <div className="flex flex-col" style={{ maxHeight: "80svh" }}>
            <div className="px-4 pt-2 pb-3">
              <p className="text-center font-semibold text-gray-900 text-base mb-3">Save to a list</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies, shows, books..."
                  className="pl-9 pr-9 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-2 pb-6">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 size={22} className="animate-spin text-purple-500" />
                </div>
              )}

              {!isLoading && query.trim() && results.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No results found</p>
              )}

              {!query.trim() && (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <Plus size={32} className="text-gray-300" />
                  <p className="text-sm">Search for something to save</p>
                </div>
              )}

              {results.map((item, idx) => {
                const poster = item.poster_url || item.image || "";
                return (
                  <button
                    key={`${item.external_id}-${idx}`}
                    onClick={() => setSelectedMedia(item)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    {poster ? (
                      <img src={poster} alt={item.title} className="w-10 h-14 object-cover rounded shrink-0" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <div className="w-10 h-14 bg-gray-100 rounded shrink-0 flex items-center justify-center text-gray-300 text-xs">?</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{item.title}</p>
                      <p className="text-xs text-gray-400 capitalize mt-0.5">{item.type === "tv" ? "TV Show" : item.type}{item.year ? ` · ${item.year}` : ""}</p>
                      {item.creator && <p className="text-xs text-gray-400 truncate">{item.creator}</p>}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Plus size={13} className="text-purple-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
