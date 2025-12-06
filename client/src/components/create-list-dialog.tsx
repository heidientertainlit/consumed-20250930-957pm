import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Search, Globe, Lock, X, Plus, Loader2 } from "lucide-react";

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MediaResult {
  title: string;
  type: string;
  creator: string;
  image: string;
  external_id?: string;
  external_source?: string;
  description?: string;
}

export default function CreateListDialog({ open, onOpenChange }: CreateListDialogProps) {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["All Media"]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const categories = ["All Media", "Movies", "TV Shows", "Books", "Music", "Podcasts", "YouTube", "Games"];

  const resetForm = () => {
    setTitle("");
    setIsPublic(true);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia([]);
    setSelectedCategories(["All Media"]);
  };

  const searchMedia = async (query: string, type?: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setIsSearching(true);
    
    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query: query.trim(), type }),
      });

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Media search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const categoryToType: Record<string, string> = {
          "Movies": "movie", "TV Shows": "tv", "Books": "book",
          "Music": "music", "Podcasts": "podcast", "YouTube": "youtube", "Games": "game"
        };
        const searchType = selectedCategories.includes("All Media")
          ? undefined
          : categoryToType[selectedCategories[0]];
        searchMedia(searchQuery, searchType);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategories]);

  const createListMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-custom-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ 
          title: title.trim(),
          visibility: isPublic ? 'public' : 'private',
          items: selectedMedia.map(m => ({
            title: m.title,
            mediaType: m.type,
            creator: m.creator,
            imageUrl: m.image,
            externalId: m.external_id,
            externalSource: m.external_source,
          }))
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create list');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "List Created!",
        description: `"${data.list?.title || title}" has been created with ${selectedMedia.length} items`,
      });
      
      await queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      
      resetForm();
      onOpenChange(false);
      
      if (data.list?.id) {
        const listSlug = (data.list.title || title).toLowerCase().replace(/\s+/g, '-');
        setLocation(`/list/${listSlug}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create List",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please enter a name for your list", variant: "destructive" });
      return;
    }

    if (title.trim().length > 50) {
      toast({ title: "Title Too Long", description: "List name must be 50 characters or less", variant: "destructive" });
      return;
    }

    createListMutation.mutate();
  };

  const addMedia = (media: MediaResult) => {
    if (!selectedMedia.find(m => m.external_id === media.external_id && m.external_source === media.external_source)) {
      setSelectedMedia([...selectedMedia, media]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white text-black border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-black">Create New List</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
          <div className="space-y-2">
            <Label htmlFor="list-title" className="text-black font-medium">List Name</Label>
            <Input
              id="list-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., My Watchlist, Classics, Binge Queue"
              maxLength={50}
              data-testid="input-list-title"
              autoFocus
              className="bg-white text-black border-gray-300 placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500">{title.length}/50 characters</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe size={18} className="text-purple-600" /> : <Lock size={18} className="text-gray-600" />}
              <span className="font-medium text-black">{isPublic ? 'Public' : 'Private'}</span>
              <span className="text-sm text-gray-500">
                {isPublic ? 'Anyone can see this list' : 'Only you can see this list'}
              </span>
            </div>
            <Badge 
              onClick={() => setIsPublic(!isPublic)}
              variant="secondary" 
              className="cursor-pointer hover:bg-gray-200 px-3 py-1"
              data-testid="toggle-list-visibility"
            >
              {isPublic ? 'Make Private' : 'Make Public'}
            </Badge>
          </div>

          <div className="space-y-3">
            <Label className="text-black font-medium">Add Media (Optional)</Label>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    if (category === "All Media") {
                      setSelectedCategories(["All Media"]);
                    } else {
                      const newSelected = selectedCategories.filter(c => c !== "All Media");
                      if (selectedCategories.includes(category)) {
                        const filtered = newSelected.filter(c => c !== category);
                        setSelectedCategories(filtered.length === 0 ? ["All Media"] : filtered);
                      } else {
                        setSelectedCategories([...newSelected, category]);
                      }
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedCategories.includes(category)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, TV shows, books, music..."
                className="pl-10 bg-white border-gray-300 text-black placeholder:text-gray-500"
              />
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-purple-600" size={20} />
                <span className="ml-2 text-gray-500">Searching...</span>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => addMedia(result)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    {result.image ? (
                      <img src={result.image} alt={result.title} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                        <Search className="text-gray-400" size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black text-sm truncate">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.creator} · {result.type}</p>
                    </div>
                    <Plus className="text-purple-600" size={18} />
                  </div>
                ))}
              </div>
            )}

            {selectedMedia.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{selectedMedia.length} item{selectedMedia.length > 1 ? 's' : ''} added:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedMedia.map((media, index) => (
                    <div key={index} className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
                      {media.image && (
                        <img src={media.image} alt="" className="w-5 h-5 rounded object-cover" />
                      )}
                      <span className="text-sm text-purple-900 max-w-32 truncate">{media.title}</span>
                      <button type="button" onClick={() => removeMedia(index)} className="text-purple-600 hover:text-red-600">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => { resetForm(); onOpenChange(false); }}
            className="border-gray-300 bg-white text-black hover:bg-gray-100"
            data-testid="button-cancel-create-list"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createListMutation.isPending || !title.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-create-list"
          >
            {createListMutation.isPending ? (
              <><Loader2 className="animate-spin mr-2" size={16} /> Creating...</>
            ) : (
              `Create List${selectedMedia.length > 0 ? ` (${selectedMedia.length} items)` : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
