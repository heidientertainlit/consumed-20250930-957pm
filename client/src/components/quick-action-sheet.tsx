import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Star, Vote, Flame, HelpCircle, MessageSquare, Trophy, X, Search, Loader2, Plus, ChevronDown, ListPlus, ArrowLeft, Swords } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import MentionTextarea from "@/components/mention-textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IntentType = "capture" | "say" | "play" | null;
type ActionType = "track" | "post" | "hot_take" | "poll" | "ask_for_recs" | "rank" | "challenge" | null;

interface QuickActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMedia?: {
    title: string;
    mediaType: string;
    imageUrl?: string;
    externalId?: string;
    externalSource?: string;
    creator?: string;
  } | null;
}

export function QuickActionSheet({ isOpen, onClose, preselectedMedia }: QuickActionSheetProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  const [selectedIntent, setSelectedIntent] = useState<IntentType>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [sayMode, setSayMode] = useState<"thought" | "hot_take" | "ask">("thought");
  const [isPosting, setIsPosting] = useState(false);
  
  const [contentText, setContentText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  
  // Set preselected media and auto-select track action when provided
  useEffect(() => {
    if (isOpen && preselectedMedia) {
      setSelectedMedia({
        title: preselectedMedia.title,
        type: preselectedMedia.mediaType,
        image_url: preselectedMedia.imageUrl,
        external_id: preselectedMedia.externalId,
        external_source: preselectedMedia.externalSource,
        creator: preselectedMedia.creator,
      });
      setSelectedIntent("capture");
      setSelectedAction("track");
      setAddToList(true);
    }
  }, [isOpen, preselectedMedia]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [ratingValue, setRatingValue] = useState(0);
  const [rewatchCount, setRewatchCount] = useState<number>(1);
  
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  const [recCategory, setRecCategory] = useState<string>("");
  
  const [addToList, setAddToList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  
  const episodeCache = useRef<Record<string, any[]>>({});

  const { data: userListsData } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user lists');
      return response.json();
    },
    enabled: !!session?.access_token && isOpen,
  });

  const userLists = userListsData?.lists || [];

  const { data: userRanksData } = useQuery<any>({
    queryKey: ['user-ranks'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-ranks`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user ranks');
      return response.json();
    },
    enabled: !!session?.access_token && isOpen && selectedAction === "rank",
  });

  const userRanks = userRanksData?.ranks || [];

  useEffect(() => {
    if (!session?.access_token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => handleMediaSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session?.access_token]);

  useEffect(() => {
    if (selectedMedia?.type === 'tv' && selectedMedia.external_id) {
      fetchSeasons(selectedMedia.external_id);
    } else {
      setSeasons([]);
      setEpisodes([]);
      setSelectedSeason(null);
      setSelectedEpisode(null);
    }
  }, [selectedMedia]);

  useEffect(() => {
    if (selectedMedia?.type === 'tv' && selectedMedia.external_id && selectedSeason) {
      fetchEpisodes(selectedMedia.external_id, selectedSeason);
    } else {
      setEpisodes([]);
      setSelectedEpisode(null);
    }
  }, [selectedSeason]);

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

  const fetchSeasons = async (externalId: string) => {
    setIsLoadingSeasons(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-media-details?source=tmdb&external_id=${externalId}&media_type=tv`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.seasons?.length > 0) setSeasons(data.seasons);
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    } finally {
      setIsLoadingSeasons(false);
    }
  };

  const fetchEpisodes = async (externalId: string, seasonNum: number) => {
    const cacheKey = `${externalId}-${seasonNum}`;
    if (cacheKey in episodeCache.current) {
      setEpisodes(episodeCache.current[cacheKey]);
      return;
    }
    
    setIsLoadingEpisodes(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-season-episodes?external_id=${externalId}&season=${seasonNum}`,
        { headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } }
      );
      if (response.ok) {
        const data = await response.json();
        const eps = data.episodes || [];
        episodeCache.current[cacheKey] = eps;
        setEpisodes(eps);
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const resetAll = () => {
    setSelectedIntent(null);
    setSelectedAction(null);
    setSayMode("thought");
    setContentText("");
    setContainsSpoilers(false);
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    setRatingValue(0);
    setRewatchCount(1);
    setPollOptions(["", ""]);
    setRecCategory("");
    setAddToList(false);
    setSelectedListId("");
    setSelectedRankId("");
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSeasons([]);
    setEpisodes([]);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleIntentSelect = (intent: IntentType) => {
    setSelectedIntent(intent);
    if (intent === "capture") {
      setSelectedAction("track");
    } else if (intent === "say") {
      setSelectedAction("post");
      setSayMode("thought");
    } else if (intent === "play") {
      setSelectedAction(null);
    }
  };

  const handleActionSelect = (action: ActionType) => {
    setSelectedAction(action);
  };

  const handleBack = () => {
    if (selectedAction && selectedIntent === "play") {
      setSelectedAction(null);
    } else if (selectedIntent) {
      setSelectedIntent(null);
      setSelectedAction(null);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handlePost = async () => {
    if (!session?.access_token) return;
    
    setIsPosting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      if (selectedAction === "track") {
        if (!selectedMedia) {
          toast({ title: "Please select media to track", variant: "destructive" });
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/track-media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media: {
              title: selectedMedia.title,
              mediaType: selectedMedia.type,
              creator: selectedMedia.creator || '',
              imageUrl: selectedMedia.image || selectedMedia.image_url || '',
              externalId: selectedMedia.external_id,
              externalSource: selectedMedia.external_source || 'tmdb',
            },
            listType: selectedListId || 'finished',
            rating: ratingValue > 0 ? ratingValue : undefined,
            review: contentText || undefined,
            containsSpoilers,
            rewatchCount: rewatchCount > 1 ? rewatchCount : undefined,
            seasonNumber: selectedSeason || undefined,
            episodeNumber: selectedEpisode || undefined,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Track media error:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to track media');
        }
        
        toast({ title: `Tracked ${selectedMedia.title}!` });
        queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "post" || selectedAction === "hot_take") {
        if (!contentText.trim()) {
          toast({ title: "Please add some text", variant: "destructive" });
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
            type: selectedAction === "hot_take" ? "hot_take" : "thought",
            containsSpoilers,
            mediaId: selectedMedia?.external_id,
            mediaType: selectedMedia?.type,
            mediaTitle: selectedMedia?.title,
            mediaImage: selectedMedia?.image,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to create post');
        
        toast({ title: selectedAction === "hot_take" ? "Hot Take posted! 🔥" : "Post created!" });
        queryClient.invalidateQueries({ queryKey: ['social-feed'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
      } else if (selectedAction === "poll") {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length < 2) {
          toast({ title: "Add at least 2 options", variant: "destructive" });
          return;
        }
        if (!contentText.trim()) {
          toast({ title: "Please add a question", variant: "destructive" });
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
        
      } else if (selectedAction === "ask_for_recs") {
        if (!contentText.trim()) {
          toast({ title: "Please describe what you're looking for", variant: "destructive" });
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
        
      } else if (selectedAction === "rank") {
        if (!selectedMedia || !selectedRankId) {
          toast({ title: "Please select a rank and media", variant: "destructive" });
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/add-rank-item`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rank_id: selectedRankId,
            media: {
              title: selectedMedia.title,
              media_type: selectedMedia.type,
              creator: selectedMedia.creator || '',
              image_url: selectedMedia.image || selectedMedia.image_url || '',
              external_id: selectedMedia.external_id,
              external_source: selectedMedia.external_source || 'tmdb',
            },
          }),
        });
        
        if (!response.ok) throw new Error('Failed to add to rank');
        
        toast({ title: `Added ${selectedMedia.title} to rank!` });
        queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
      }
      
      handleClose();
    } catch (error) {
      console.error('Post error:', error);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const intents = [
    { 
      id: "capture" as IntentType, 
      label: "Add", 
      icon: Star, 
      iconColor: "text-white", 
      bgColor: "bg-gradient-to-br from-violet-500 to-purple-700", 
      desc: "Track, rate, or review something" 
    },
    { 
      id: "say" as IntentType, 
      label: "Say something", 
      icon: MessageSquare, 
      iconColor: "text-white", 
      bgColor: "bg-gradient-to-br from-blue-500 to-indigo-700", 
      desc: "Share a thought, hot take, or ask for recs" 
    },
    { 
      id: "play" as IntentType, 
      label: "Play", 
      icon: Swords, 
      iconColor: "text-white", 
      bgColor: "bg-gradient-to-br from-fuchsia-500 to-purple-700", 
      desc: "Create a poll, add to rankings" 
    },
  ];

  const playActions = [
    { id: "poll" as ActionType, label: "Create a Poll", icon: Vote, desc: "Ask your friends" },
    { id: "rank" as ActionType, label: "Add to Ranking", icon: Trophy, desc: "Build a ranked list" },
    { id: "challenge" as ActionType, label: "Challenge a Friend", icon: Swords, desc: "Coming soon" },
  ];

  const actions = [
    { id: "track" as ActionType, label: "Track & Rate", icon: Star, iconColor: "text-yellow-500", bgColor: "bg-yellow-50", desc: "Log something you finished" },
    { id: "post" as ActionType, label: "Post", icon: MessageSquare, iconColor: "text-blue-500", bgColor: "bg-blue-50", desc: "Share a thought" },
    { id: "hot_take" as ActionType, label: "Hot Take", icon: Flame, iconColor: "text-orange-500", bgColor: "bg-orange-50", desc: "Drop a spicy opinion" },
    { id: "poll" as ActionType, label: "Poll", icon: Vote, iconColor: "text-purple-500", bgColor: "bg-purple-50", desc: "Ask your friends" },
    { id: "ask_for_recs" as ActionType, label: "Ask for Recs", icon: HelpCircle, iconColor: "text-green-500", bgColor: "bg-green-50", desc: "Get suggestions" },
    { id: "rank" as ActionType, label: "Rank", icon: Trophy, iconColor: "text-amber-500", bgColor: "bg-amber-50", desc: "Add to a ranked list" },
    { id: "challenge" as ActionType, label: "Challenge", icon: Swords, iconColor: "text-pink-500", bgColor: "bg-pink-50", desc: "Challenge a friend" },
  ];

  const renderActionContent = () => {
    if (selectedAction === "track") {
      return (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a movie, show, book..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="quick-action-search"
            />
          </div>
          
          {isSearching && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          )}
          
          {!selectedMedia && searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {searchResults.slice(0, 6).map((result, idx) => (
                <button
                  key={`${result.external_id}-${idx}`}
                  onClick={() => {
                    setSelectedMedia(result);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg text-left"
                  data-testid={`search-result-${result.external_id}`}
                >
                  {result.image && (
                    <img src={result.image} alt={result.title} className="w-10 h-14 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{result.title}</p>
                    <p className="text-sm text-gray-500 truncate">{result.type} {result.year && `• ${result.year}`}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {selectedMedia && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                {selectedMedia.image && (
                  <img src={selectedMedia.image} alt={selectedMedia.title} className="w-12 h-16 object-cover rounded" />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{selectedMedia.title}</p>
                  <p className="text-sm text-gray-600">{selectedMedia.type} {selectedMedia.year && `• ${selectedMedia.year}`}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-purple-100 rounded">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              
              {selectedMedia.type === 'tv' && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-700">Track specific episode (optional)</p>
                  {isLoadingSeasons ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="animate-spin" size={16} />
                      Loading seasons...
                    </div>
                  ) : seasons.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={selectedSeason || ""}
                        onChange={(e) => setSelectedSeason(Number(e.target.value) || null)}
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">All seasons</option>
                        {seasons.map((s) => (
                          <option key={s.seasonNumber || s.season_number} value={s.seasonNumber || s.season_number}>
                            Season {s.seasonNumber || s.season_number}
                          </option>
                        ))}
                      </select>
                      
                      {selectedSeason && (
                        <select
                          value={selectedEpisode || ""}
                          onChange={(e) => setSelectedEpisode(Number(e.target.value) || null)}
                          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          disabled={isLoadingEpisodes}
                        >
                          <option value="">{isLoadingEpisodes ? "Loading..." : "All episodes"}</option>
                          {episodes.map((ep) => (
                            <option key={ep.episodeNumber || ep.episode_number} value={ep.episodeNumber || ep.episode_number}>
                              Ep {ep.episodeNumber || ep.episode_number}: {ep.name || ep.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No season data available</p>
                  )}
                </div>
              )}
              
              <div className="space-y-3 p-3 bg-gray-50 rounded-xl">
                <label className="text-sm font-medium text-gray-700 block">Rating (optional)</label>
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const fillPercent = Math.min(Math.max(ratingValue - (star - 1), 0), 1) * 100;
                      return (
                        <button
                          key={star}
                          onClick={() => setRatingValue(ratingValue === star ? 0 : star)}
                          className="focus:outline-none relative"
                          data-testid={`rating-star-${star}`}
                        >
                          <Star className="w-7 h-7 text-gray-300" />
                          <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                            <Star className="w-7 h-7 fill-yellow-400 text-yellow-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={ratingValue || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) setRatingValue(0);
                      else setRatingValue(Math.min(5, Math.max(0, val)));
                    }}
                    placeholder="0.0"
                    className="w-14 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center bg-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Add to list</label>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="finished">Finished</option>
                  <option value="queue">Want To</option>
                  <option value="currently">Currently Consuming</option>
                  {userLists.filter((l: any) => !l.is_default).map((list: any) => (
                    <option key={list.id} value={list.id}>{list.title}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Review (optional)</label>
                <textarea
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="What did you think?"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg resize-none bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  data-testid="track-review-input"
                />
              </div>
              
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
                Contains spoilers
              </label>
            </div>
          )}
        </div>
      );
    }
    
    if (selectedAction === "post" || selectedAction === "hot_take") {
      const isHotTake = selectedAction === "hot_take";
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
            data-testid="post-content-input"
          />
          
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox checked={containsSpoilers} onCheckedChange={(c) => setContainsSpoilers(!!c)} />
            Contains spoilers
          </label>
        </div>
      );
    }
    
    if (selectedAction === "poll") {
      return (
        <div className="space-y-4">
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Ask a question..."
            className="w-full px-3 py-3 border rounded-lg resize-none"
            rows={2}
            data-testid="poll-question-input"
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
                  data-testid={`poll-option-${idx}`}
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
    
    if (selectedAction === "ask_for_recs") {
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
            data-testid="recs-content-input"
          />
        </div>
      );
    }
    
    if (selectedAction === "rank") {
      return (
        <div className="space-y-4">
          {userRanks.length === 0 ? (
            <div className="text-center py-8">
              <Trophy size={48} className="mx-auto text-amber-500" />
              <div className="mt-4">
                <h3 className="font-semibold text-lg">No Ranked Lists Yet</h3>
                <p className="text-gray-600 mt-2">
                  Create your first ranked list in Collections.
                </p>
              </div>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = "/collections?tab=ranks";
                }}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
              >
                Go to Collections
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Add to which rank?</label>
                <select
                  value={selectedRankId}
                  onChange={(e) => setSelectedRankId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="select-rank"
                >
                  <option value="">Select a ranked list...</option>
                  {userRanks.map((rank: any) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.title}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedRankId && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for media to add..."
                      className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      data-testid="rank-media-search"
                    />
                  </div>
                  
                  {isSearching && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="animate-spin text-purple-500" size={24} />
                    </div>
                  )}
                  
                  {!selectedMedia && searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {searchResults.slice(0, 6).map((result, idx) => (
                        <button
                          key={`${result.external_id}-${idx}`}
                          onClick={() => {
                            setSelectedMedia(result);
                            setSearchResults([]);
                            setSearchQuery("");
                          }}
                          className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg text-left"
                        >
                          {result.image && (
                            <img src={result.image} alt={result.title} className="w-10 h-14 object-cover rounded" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{result.title}</p>
                            <p className="text-sm text-gray-500 truncate">{result.type} {result.year && `• ${result.year}`}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedMedia && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                      {selectedMedia.image && (
                        <img src={selectedMedia.image} alt={selectedMedia.title} className="w-12 h-16 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{selectedMedia.title}</p>
                        <p className="text-sm text-gray-600">{selectedMedia.type} {selectedMedia.year && `• ${selectedMedia.year}`}</p>
                      </div>
                      <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-amber-100 rounded">
                        <X size={18} className="text-gray-500" />
                      </button>
                    </div>
                  )}
                </>
              )}
              
              <div className="pt-2 border-t">
                <button
                  onClick={() => {
                    handleClose();
                    window.location.href = "/collections?tab=ranks";
                  }}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create new ranked list instead →
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    
    if (selectedAction === "challenge") {
      return (
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 flex items-center justify-center">
              <Swords size={32} className="text-pink-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Challenge a Friend</h3>
            <p className="text-gray-500 text-sm">Create a custom challenge and invite friends to compete!</p>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Challenge title (e.g., 'Best 90s Movie')"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
              data-testid="challenge-title-input"
            />
            
            <textarea
              placeholder="Describe your challenge..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white resize-none"
              rows={3}
              data-testid="challenge-description-input"
            />
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search friends to challenge..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                data-testid="challenge-friend-search"
              />
            </div>
          </div>
          
          <p className="text-center text-xs text-gray-400 pt-2">
            Coming soon! Challenge functionality will be available shortly.
          </p>
        </div>
      );
    }
    
    return null;
  };

  const canPost = () => {
    if (selectedAction === "track") return !!selectedMedia;
    if (selectedAction === "post" || selectedAction === "hot_take") return !!contentText.trim();
    if (selectedAction === "poll") return !!contentText.trim() && pollOptions.filter(o => o.trim()).length >= 2;
    if (selectedAction === "ask_for_recs") return !!contentText.trim();
    if (selectedAction === "rank") return !!selectedMedia && !!selectedRankId;
    if (selectedAction === "challenge") return false;
    return false;
  };

  const getSheetTitle = () => {
    if (!selectedIntent) return null;
    if (selectedIntent === "capture") return "Add";
    if (selectedIntent === "say") return "Say something";
    if (selectedIntent === "play" && !selectedAction) return "Play";
    if (selectedAction) return actions.find(a => a.id === selectedAction)?.label;
    return null;
  };

  const renderPlayHub = () => {
    return (
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-1 gap-3">
          {playActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionSelect(action.id)}
              className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              data-testid={`play-action-${action.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <action.icon size={20} className="text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">{action.label}</p>
                <p className="text-sm text-gray-500">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
        
        <div className="pt-2 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400 py-2">
            Or explore the Play page for trivia, predictions & more
          </p>
        </div>
      </div>
    );
  };

  const renderSayContent = () => {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setSayMode("thought"); setSelectedAction("post"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "thought" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-thought"
          >
            Thought
          </button>
          <button
            onClick={() => { setSayMode("hot_take"); setSelectedAction("hot_take"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "hot_take" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-hot-take"
          >
            Hot Take
          </button>
          <button
            onClick={() => { setSayMode("ask"); setSelectedAction("ask_for_recs"); }}
            className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
              sayMode === "ask" 
                ? "bg-gray-100 text-gray-900 border border-gray-200" 
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            data-testid="say-mode-ask"
          >
            Ask
          </button>
        </div>
        
        <MentionTextarea
          value={contentText}
          onChange={setContentText}
          session={session}
          placeholder={
            sayMode === "thought" ? "What's on your mind?" :
            sayMode === "hot_take" ? "Drop your spicy take..." :
            "What are you looking for?"
          }
          className="min-h-[100px] bg-white text-gray-900 border border-gray-200 rounded-xl"
          testId="say-content-input"
        />
        
        {sayMode === "ask" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Category (optional)</p>
            <div className="flex flex-wrap gap-2">
              {["Movies", "TV Shows", "Books", "Music", "Podcasts", "Games"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setRecCategory(recCategory === cat ? "" : cat)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    recCategory === cat
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  data-testid={`rec-category-${cat.toLowerCase()}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tag Media Section */}
        {(sayMode === "thought" || sayMode === "hot_take") && (
          <div className="space-y-2">
            {!selectedMedia ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tag a movie, show, book... (optional)"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="say-media-search"
                />
              </div>
            ) : null}
            
            {isSearching && (
              <div className="flex justify-center py-2">
                <Loader2 className="animate-spin text-purple-500" size={20} />
              </div>
            )}
            
            {!selectedMedia && searchResults.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-2">
                {searchResults.slice(0, 4).map((result, idx) => (
                  <button
                    key={`${result.external_id}-${idx}`}
                    onClick={() => {
                      setSelectedMedia(result);
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left"
                    data-testid={`say-search-result-${result.external_id}`}
                  >
                    {result.image && (
                      <img src={result.image} alt={result.title} className="w-8 h-10 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.type}</p>
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedMedia.title}</p>
                  <p className="text-xs text-gray-500 truncate">{selectedMedia.type}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-purple-100 rounded">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="spoilers"
            checked={containsSpoilers}
            onCheckedChange={(checked) => setContainsSpoilers(!!checked)}
          />
          <label htmlFor="spoilers" className="text-sm text-gray-600">
            Contains spoilers
          </label>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto !bg-white border-t border-gray-100" style={{ backgroundColor: 'white' }}>
        {!selectedIntent ? (
          <>
            <SheetHeader className="pb-4">
              <SheetTitle className="text-center text-gray-900 text-xl font-semibold">What's on your mind?</SheetTitle>
            </SheetHeader>
            
            <div className="flex flex-col gap-3 pb-6 px-4">
              {intents.map((intent) => (
                <button
                  key={intent.id}
                  onClick={() => handleIntentSelect(intent.id)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  data-testid={`intent-${intent.id}`}
                >
                  <div className={`w-14 h-14 rounded-xl ${intent.bgColor} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <intent.icon size={24} className="text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-gray-900 text-base">{intent.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{intent.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="relative flex items-center justify-center">
                <button onClick={handleBack} className="absolute left-0 p-2 hover:bg-gray-100 rounded-full" data-testid="back-button">
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <SheetTitle className="text-gray-900 text-lg font-semibold">
                  {getSheetTitle()}
                </SheetTitle>
              </div>
            </SheetHeader>
            
            {selectedIntent === "play" && !selectedAction ? (
              renderPlayHub()
            ) : selectedIntent === "say" && selectedAction !== "poll" && selectedAction !== "rank" ? (
              renderSayContent()
            ) : (
              renderActionContent()
            )}
            
            {selectedAction && selectedAction !== "challenge" && (selectedAction !== "rank" || (selectedAction === "rank" && userRanks.length > 0)) && (
              <div className="pt-4 pb-2">
                <Button
                  onClick={handlePost}
                  disabled={!canPost() || isPosting}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6"
                  data-testid="submit-action"
                >
                  {isPosting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    selectedAction === "track" ? "Add" : 
                    selectedAction === "rank" ? "Add to Rank" : 
                    sayMode === "hot_take" ? "Drop It 🔥" :
                    sayMode === "ask" ? "Ask" :
                    "Share"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
