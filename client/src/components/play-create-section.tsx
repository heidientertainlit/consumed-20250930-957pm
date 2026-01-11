import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Star, Vote, Flame, HelpCircle, MessageSquare, Trophy, X, Search, Loader2, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

type CreateMode = "hot_take" | "poll" | "ask_for_recs" | "thought" | null;

interface PlayCreateSectionProps {
  defaultMode?: CreateMode;
}

export function PlayCreateSection({ defaultMode = null }: PlayCreateSectionProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [isPosting, setIsPosting] = useState(false);
  
  const [contentText, setContentText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [recCategory, setRecCategory] = useState<string>("");

  useEffect(() => {
    if (!session?.access_token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => handleMediaSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session?.access_token]);

  const handleMediaSearch = async (query: string) => {
    if (!session?.access_token) return;
    setIsSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/media-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const resetAll = () => {
    setCreateMode(null);
    setContentText("");
    setContainsSpoilers(false);
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    setPollOptions(["", ""]);
    setRecCategory("");
  };

  const handleClose = () => {
    resetAll();
    setIsSheetOpen(false);
  };

  const openCreate = (mode: CreateMode) => {
    setCreateMode(mode);
    setIsSheetOpen(true);
  };

  const handlePost = async () => {
    if (!session?.access_token) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }
    
    setIsPosting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      if (createMode === "thought" || createMode === "hot_take") {
        if (!contentText.trim()) {
          toast({ title: "Please add some text", variant: "destructive" });
          setIsPosting(false);
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/create-post`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: contentText,
            type: createMode === "hot_take" ? "hot_take" : "thought",
            containsSpoilers,
            mediaId: selectedMedia?.external_id,
            mediaType: selectedMedia?.type,
            mediaTitle: selectedMedia?.title,
            mediaImage: selectedMedia?.image,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to create post');
        
        toast({ title: createMode === "hot_take" ? "Hot Take posted! 🔥" : "Post created!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (createMode === "poll") {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length < 2) {
          toast({ title: "Add at least 2 options", variant: "destructive" });
          setIsPosting(false);
          return;
        }
        if (!contentText.trim()) {
          toast({ title: "Please add a question", variant: "destructive" });
          setIsPosting(false);
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/create-poll`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: contentText,
            options: validOptions,
            containsSpoilers,
            mediaId: selectedMedia?.external_id,
            mediaType: selectedMedia?.type,
            mediaTitle: selectedMedia?.title,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to create poll');
        
        toast({ title: "Poll created!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (createMode === "ask_for_recs") {
        if (!contentText.trim()) {
          toast({ title: "Please describe what you're looking for", variant: "destructive" });
          setIsPosting(false);
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/create-post`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: contentText,
            type: "ask_for_recs",
            category: recCategory || undefined,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to post');
        
        toast({ title: "Rec request posted!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      }
      
      handleClose();
    } catch (error) {
      console.error('Post error:', error);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const renderCreateContent = () => {
    if (createMode === "thought" || createMode === "hot_take") {
      const isHotTake = createMode === "hot_take";
      return (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tag a movie, show, book... (optional)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.slice(0, 4).map((result, idx) => (
                <button
                  key={`${result.external_id}-${idx}`}
                  onClick={() => {
                    setSelectedMedia(result);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left text-sm"
                >
                  {result.image && (
                    <img src={result.image} alt={result.title} className="w-8 h-10 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    <p className="text-xs text-gray-500">{result.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {selectedMedia && (
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
              {selectedMedia.image && (
                <img src={selectedMedia.image} alt={selectedMedia.title} className="w-8 h-10 object-cover rounded" />
              )}
              <span className="flex-1 text-sm font-medium truncate">{selectedMedia.title}</span>
              <button onClick={() => setSelectedMedia(null)} className="p-1">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
          )}
          
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder={isHotTake ? "Drop your hottest take... 🔥" : "What's on your mind?"}
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={4}
          />
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
            Contains spoilers
          </label>
        </div>
      );
    }
    
    if (createMode === "poll") {
      return (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tag a movie, show, book... (optional)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.slice(0, 4).map((result, idx) => (
                <button
                  key={`${result.external_id}-${idx}`}
                  onClick={() => {
                    setSelectedMedia(result);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left text-sm"
                >
                  {result.image && (
                    <img src={result.image} alt={result.title} className="w-8 h-10 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    <p className="text-xs text-gray-500">{result.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {selectedMedia && (
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
              {selectedMedia.image && (
                <img src={selectedMedia.image} alt={selectedMedia.title} className="w-8 h-10 object-cover rounded" />
              )}
              <span className="flex-1 text-sm font-medium truncate">{selectedMedia.title}</span>
              <button onClick={() => setSelectedMedia(null)} className="p-1">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
          )}
          
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Ask a question..."
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={2}
          />
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Options</label>
            {pollOptions.map((option, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...pollOptions];
                    newOptions[idx] = e.target.value;
                    setPollOptions(newOptions);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <button
                onClick={() => setPollOptions([...pollOptions, ""])}
                className="text-sm text-purple-600 font-medium"
              >
                + Add option
              </button>
            )}
          </div>
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
            Contains spoilers
          </label>
        </div>
      );
    }
    
    if (createMode === "ask_for_recs") {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">What are you looking for?</label>
            <select
              value={recCategory}
              onChange={(e) => setRecCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Anything</option>
              <option value="movies">Movies</option>
              <option value="tv">TV Shows</option>
              <option value="books">Books</option>
              <option value="music">Music</option>
              <option value="podcasts">Podcasts</option>
              <option value="games">Games</option>
            </select>
          </div>
          
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Describe what you're in the mood for..."
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={4}
          />
        </div>
      );
    }
    
    return null;
  };

  const getTitle = () => {
    switch (createMode) {
      case "hot_take": return "Drop a Hot Take 🔥";
      case "poll": return "Create a Poll";
      case "ask_for_recs": return "Ask for Recommendations";
      case "thought": return "Share a Thought";
      default: return "Create";
    }
  };

  const getButtonText = () => {
    switch (createMode) {
      case "hot_take": return "Post Hot Take 🔥";
      case "poll": return "Create Poll";
      case "ask_for_recs": return "Ask for Recs";
      case "thought": return "Post";
      default: return "Post";
    }
  };

  const createCards = [
    { 
      id: "hot_take" as CreateMode, 
      label: "Hot Take", 
      icon: Flame, 
      iconColor: "text-orange-500",
      bgGradient: "from-orange-500 to-red-500",
      desc: "Drop a spicy opinion" 
    },
    { 
      id: "poll" as CreateMode, 
      label: "Poll", 
      icon: Vote, 
      iconColor: "text-purple-500",
      bgGradient: "from-purple-500 to-indigo-500",
      desc: "Ask your friends" 
    },
    { 
      id: "thought" as CreateMode, 
      label: "Thought", 
      icon: MessageSquare, 
      iconColor: "text-blue-500",
      bgGradient: "from-blue-500 to-cyan-500",
      desc: "Share what's on your mind" 
    },
    { 
      id: "ask_for_recs" as CreateMode, 
      label: "Ask for Recs", 
      icon: HelpCircle, 
      iconColor: "text-green-500",
      bgGradient: "from-green-500 to-emerald-500",
      desc: "Get suggestions" 
    },
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Create</h2>
        <div className="grid grid-cols-2 gap-3">
          {createCards.map((card) => (
            <button
              key={card.id}
              onClick={() => openCreate(card.id)}
              className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.bgGradient} flex items-center justify-center mb-3`}>
                <card.icon size={20} className="text-white" />
              </div>
              <p className="font-semibold text-gray-900 text-sm">{card.label}</p>
              <p className="text-xs text-gray-500">{card.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <div className="flex items-center gap-3">
              <button onClick={handleClose} className="p-1">
                <ArrowLeft size={20} />
              </button>
              <SheetTitle className="text-lg font-semibold">{getTitle()}</SheetTitle>
            </div>
          </SheetHeader>
          
          <div className="px-4 py-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            {renderCreateContent()}
          </div>
          
          <div className="px-4 pb-6 pt-2 border-t bg-white">
            <Button
              onClick={handlePost}
              disabled={isPosting}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl"
            >
              {isPosting ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              {getButtonText()}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
