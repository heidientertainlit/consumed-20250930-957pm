import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Search, Globe, Lock, X, Plus, Loader2, Users } from "lucide-react";
import UserSearch from "@/components/user-search";

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
  year?: string | number;
  poster_url?: string;
}

interface SelectedCollaborator {
  id: string;
  user_name: string;
  display_name?: string;
}

export default function CreateListDialog({ open, onOpenChange }: CreateListDialogProps) {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<SelectedCollaborator[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const resetForm = () => {
    setTitle("");
    setIsPublic(true);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia([]);
    setSelectedCollaborators([]);
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
        searchMedia(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const createListMutation = useMutation({
    mutationFn: async () => {
      const payload = { 
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
      };
      console.log('Creating list with payload:', payload);
      
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-custom-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create list');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      console.log('List created successfully:', data);
      
      // Add collaborators if any were selected
      if (data.list?.id && selectedCollaborators.length > 0) {
        for (const collaborator of selectedCollaborators) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-list-collaborator`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                listId: data.list.id,
                userId: collaborator.id
              }),
            });
          } catch (err) {
            console.error('Failed to add collaborator:', err);
          }
        }
      }
      
      // Use refetchQueries to wait for fresh data before navigating
      await queryClient.refetchQueries({ queryKey: ['user-lists-with-media'] });
      
      const listSlug = (data.list?.title || title).toLowerCase().replace(/\s+/g, '-');
      
      resetForm();
      onOpenChange(false);
      
      if (data.list?.id) {
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
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col bg-white text-black border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-black">Create New List</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="list-title" className="text-black font-medium text-sm">List Name</Label>
            <Input
              id="list-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., My Watchlist, Classics"
              maxLength={50}
              data-testid="input-list-title"
              autoFocus
              className="bg-white text-black border-gray-300 placeholder:text-gray-400 h-10 focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-gray-400">{title.length}/50</p>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe size={16} className="text-purple-600" /> : <Lock size={16} className="text-gray-500" />}
              <span className="text-sm text-black">{isPublic ? 'Public' : 'Private'}</span>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-300"
              data-testid="toggle-list-visibility"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-black font-medium text-sm">Add Media (Optional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows, books..."
                className="pl-10 bg-white border-gray-300 text-black placeholder:text-gray-400 h-10 focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:ring-offset-0"
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
                {searchResults.map((result, index) => {
                  const imgUrl = result.image || result.poster_url || '';
                  const details = [result.year, result.creator, result.type].filter(Boolean).join(' · ');
                  return (
                    <div
                      key={index}
                      onClick={() => addMedia({ ...result, image: imgUrl })}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      {imgUrl ? (
                        <img src={imgUrl} alt={result.title} className="w-10 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center">
                          <Search className="text-gray-400" size={16} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-black text-sm truncate">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{details}</p>
                      </div>
                      <Plus className="text-purple-600 flex-shrink-0" size={18} />
                    </div>
                  );
                })}
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

          {/* Collaborators Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-500" />
              <Label className="text-black font-medium text-sm">Invite Collaborators (Optional)</Label>
            </div>
            <UserSearch
              onSelectUser={(user) => {
                if (!selectedCollaborators.find(c => c.id === user.id)) {
                  setSelectedCollaborators([...selectedCollaborators, {
                    id: user.id,
                    user_name: user.user_name,
                    display_name: user.display_name
                  }]);
                }
              }}
              excludeUserIds={[session?.user?.id || '', ...selectedCollaborators.map(c => c.id)]}
              placeholder="Search friends by name..."
            />
            {selectedCollaborators.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedCollaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                    <span className="text-sm text-blue-900">@{collab.user_name}</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedCollaborators(selectedCollaborators.filter(c => c.id !== collab.id))} 
                      className="text-blue-600 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { resetForm(); onOpenChange(false); }}
            className="border-gray-300 bg-white text-black hover:bg-gray-100"
            data-testid="button-cancel-create-list"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={createListMutation.isPending || !title.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-create-list"
          >
            {createListMutation.isPending ? (
              <><Loader2 className="animate-spin mr-1" size={14} /> Creating...</>
            ) : (
              `Create${selectedMedia.length > 0 ? ` (${selectedMedia.length})` : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
