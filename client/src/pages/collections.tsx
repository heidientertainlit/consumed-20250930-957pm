import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  List, 
  Trophy, 
  Clock, 
  Play, 
  Plus, 
  Search, 
  Lock, 
  Users, 
  Globe,
  Film, 
  Tv, 
  BookOpen, 
  Music, 
  Headphones, 
  Gamepad2, 
  Upload, 
  Loader2,
  ChevronRight,
  Calendar,
  HelpCircle,
  X,
  Share2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import FeedbackFooter from "@/components/feedback-footer";

export default function CollectionsPage() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'lists' | 'ranks' | 'history'>('lists');
  
  // Lists state
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListVisibility, setNewListVisibility] = useState("private");
  const [listSearch, setListSearch] = useState("");
  
  // Ranks state
  const [isCreateRankOpen, setIsCreateRankOpen] = useState(false);
  const [newRankName, setNewRankName] = useState("");
  const [newRankVisibility, setNewRankVisibility] = useState("private");
  
  // History state
  const [mediaHistorySearch, setMediaHistorySearch] = useState("");
  const [mediaHistoryType, setMediaHistoryType] = useState("all");
  const [mediaHistoryYear, setMediaHistoryYear] = useState("all");
  const [mediaHistoryMonth, setMediaHistoryMonth] = useState("all");
  const [mediaHistoryRating, setMediaHistoryRating] = useState("all");
  const [openFilter, setOpenFilter] = useState<'type' | 'year' | 'rating' | null>(null);
  
  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportHelpOpen, setIsImportHelpOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch user lists with caching
  const { data: listsData, isLoading: isLoadingLists } = useQuery({
    queryKey: ['user-lists', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { lists: [] };
      
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        return response.json();
      }
      return { lists: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Fetch user ranks with caching
  const { data: ranksData, isLoading: isLoadingRanks } = useQuery({
    queryKey: ['user-ranks', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { ranks: [] };
      
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        return response.json();
      }
      return { ranks: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const userLists = listsData?.lists || [];
  const userRanks = ranksData?.ranks || [];

  // Create list mutation
  const createListMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !newListName.trim()) return;
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-user-lists',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create',
            title: newListName.trim(),
            visibility: newListVisibility,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to create list');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "List created!", description: `"${newListName}" has been created.` });
      setNewListName("");
      setIsCreateListOpen(false);
      queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create list", variant: "destructive" });
    },
  });

  // Create rank mutation
  const createRankMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !newRankName.trim()) return;
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-ranks',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create',
            title: newRankName.trim(),
            visibility: newRankVisibility,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to create rank');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Rank created!", description: `"${newRankName}" has been created.` });
      setNewRankName("");
      setIsCreateRankOpen(false);
      queryClient.invalidateQueries({ queryKey: ['user-ranks', user?.id] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create rank", variant: "destructive" });
    },
  });

  // Get all media items from lists for history (memoized)
  const allMediaItems = useMemo(() => {
    const allItems: any[] = [];
    userLists.forEach(list => {
      if (list.items && Array.isArray(list.items)) {
        list.items.forEach((item: any) => {
          allItems.push({
            ...item,
            listName: list.title,
            listId: list.id,
          });
        });
      }
    });
    return allItems.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [userLists]);

  // Get media type counts (memoized)
  const mediaTypeCounts = useMemo(() => {
    const counts: any = { movie: 0, tv: 0, book: 0, music: 0, podcast: 0, game: 0 };
    allMediaItems.forEach(item => {
      if (counts.hasOwnProperty(item.media_type)) {
        counts[item.media_type]++;
      }
    });
    return counts;
  }, [allMediaItems]);

  // Filter media history (memoized)
  const filteredMediaHistory = useMemo(() => {
    return allMediaItems.filter(item => {
      if (mediaHistorySearch.trim()) {
        const searchLower = mediaHistorySearch.toLowerCase();
        const matchesSearch = 
          item.title?.toLowerCase().includes(searchLower) ||
          item.creator?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      if (mediaHistoryType !== 'all') {
        const typeMap: any = {
          'movies': 'movie',
          'tv': 'tv',
          'books': 'book',
          'music': 'music',
          'podcasts': 'podcast',
          'games': 'game'
        };
        if (item.media_type !== typeMap[mediaHistoryType]) return false;
      }
      
      if (mediaHistoryYear !== 'all') {
        const itemYear = new Date(item.created_at).getFullYear();
        if (itemYear.toString() !== mediaHistoryYear) return false;
      }
      
      if (mediaHistoryMonth !== 'all') {
        const itemMonth = new Date(item.created_at).getMonth();
        if (itemMonth !== parseInt(mediaHistoryMonth)) return false;
      }
      
      if (mediaHistoryRating !== 'all') {
        const itemRating = Math.floor(item.rating || 0);
        if (itemRating !== parseInt(mediaHistoryRating)) return false;
      }
      
      return true;
    });
  }, [allMediaItems, mediaHistorySearch, mediaHistoryType, mediaHistoryYear, mediaHistoryMonth, mediaHistoryRating]);

  // Get filter display labels
  const getTypeLabel = () => {
    const labels: any = { all: 'Media Type', movies: 'Movies', tv: 'TV', books: 'Books', music: 'Music', podcasts: 'Podcasts', games: 'Games' };
    return labels[mediaHistoryType] || 'Media Type';
  };
  
  const getYearLabel = () => mediaHistoryYear === 'all' ? 'Year' : mediaHistoryYear;
  
  const getRatingLabel = () => mediaHistoryRating === 'all' ? 'Rating' : `${mediaHistoryRating}★`;

  // Handle file import
  const handleFileImport = async () => {
    if (!importFile || !session?.access_token) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/import-media-history',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Import successful!",
          description: `Imported ${result.imported || 0} items.`,
        });
        setImportFile(null);
        setIsImportModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] });
      } else {
        throw new Error('Import failed');
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing your data.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const getDisplayTitle = (title: string) => {
    return title;
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film size={16} className="text-purple-600" />;
      case 'tv': return <Tv size={16} className="text-pink-600" />;
      case 'book': return <BookOpen size={16} className="text-cyan-600" />;
      case 'music': return <Music size={16} className="text-green-600" />;
      case 'podcast': return <Headphones size={16} className="text-blue-600" />;
      case 'game': return <Gamepad2 size={16} className="text-orange-600" />;
      default: return <Play size={16} className="text-gray-600" />;
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-black mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            My Collections
          </h1>
          <p className="text-base text-gray-600">Your lists, ranks, and media history</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="w-full mb-3 bg-white border border-gray-200 p-1 h-auto">
            <TabsTrigger 
              value="lists" 
              className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              data-testid="tab-lists"
            >
              <List size={16} className="mr-2" />
              Lists
            </TabsTrigger>
            <TabsTrigger 
              value="ranks" 
              className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              data-testid="tab-ranks"
            >
              <Trophy size={16} className="mr-2" />
              Ranks
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              data-testid="tab-history"
            >
              <Clock size={16} className="mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Lists Tab */}
          <TabsContent value="lists">
            <div className="mb-4 flex justify-center">
              <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-8 py-2 rounded-full" data-testid="button-create-list">
                    <Plus size={16} className="mr-2" />
                    Create List
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Create New List</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="List name"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="bg-white text-gray-900 border-gray-300"
                      data-testid="input-list-name"
                    />
                    <Select value={newListVisibility} onValueChange={setNewListVisibility}>
                      <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="private" className="text-gray-900">Private</SelectItem>
                        <SelectItem value="friends" className="text-gray-900">Friends Only</SelectItem>
                        <SelectItem value="public" className="text-gray-900">Public</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => createListMutation.mutate()}
                      disabled={!newListName.trim() || createListMutation.isPending}
                      data-testid="button-submit-list"
                    >
                      {createListMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Create List
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search Lists */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search lists..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                data-testid="input-search-lists"
              />
            </div>

            {isLoadingLists ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : userLists.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <List className="mx-auto mb-3 text-gray-300" size={48} />
                <p className="text-gray-600">No lists yet</p>
                <p className="text-sm text-gray-500">Create your first list to start tracking media</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userLists
                  .filter((list: any) => 
                    list.title.toLowerCase().includes(listSearch.toLowerCase())
                  )
                  .map((list: any) => (
                  <div
                    key={list.id}
                    className="bg-white border border-gray-200 rounded-xl hover:border-purple-300 transition-colors cursor-pointer"
                    onClick={() => {
                      const listSlug = list.title.toLowerCase().replace(/\s+/g, '-');
                      setLocation(`/list/${listSlug}`);
                    }}
                    data-testid={`list-card-${list.id}`}
                  >
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                          {list.is_default ? (
                            list.title === 'Want to Watch' ? <Play className="text-purple-600" size={18} /> :
                            list.title === 'Currently' ? <Clock className="text-blue-600" size={18} /> :
                            list.title === 'Completed' ? <Trophy className="text-green-600" size={18} /> :
                            <List className="text-gray-600" size={18} />
                          ) : (
                            <List className="text-purple-600" size={18} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{getDisplayTitle(list.title)}</h3>
                            {!list.is_default && list.visibility && (
                              <Badge variant="outline" className="text-xs">
                                {list.visibility === 'private' ? <Lock size={10} className="mr-1" /> : <Users size={10} className="mr-1" />}
                                {list.visibility}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {list.items?.length || 0} {list.items?.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Share2 
                          className="text-gray-400 hover:text-purple-600" 
                          size={18}
                          onClick={(e) => {
                            e.stopPropagation();
                            const listSlug = list.title.toLowerCase().replace(/\s+/g, '-');
                            const url = `${import.meta.env.VITE_APP_URL || window.location.origin}/list/${listSlug}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Link copied!" });
                          }}
                        />
                        <ChevronRight className="text-gray-400" size={20} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ranks Tab */}
          <TabsContent value="ranks">
            <div className="mb-4 flex justify-end">
              <Dialog open={isCreateRankOpen} onOpenChange={setIsCreateRankOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-create-rank">
                    <Plus size={16} className="mr-2" />
                    Create Rank
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Create New Rank</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Rank name (e.g. Top 10 90s Movies)"
                      value={newRankName}
                      onChange={(e) => setNewRankName(e.target.value)}
                      className="bg-white text-gray-900 border-gray-300"
                      data-testid="input-rank-name"
                    />
                    <Select value={newRankVisibility} onValueChange={setNewRankVisibility}>
                      <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="private" className="text-gray-900">Private</SelectItem>
                        <SelectItem value="friends" className="text-gray-900">Friends Only</SelectItem>
                        <SelectItem value="public" className="text-gray-900">Public</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => createRankMutation.mutate()}
                      disabled={!newRankName.trim() || createRankMutation.isPending}
                      data-testid="button-submit-rank"
                    >
                      {createRankMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Create Rank
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingRanks ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : userRanks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <Trophy className="mx-auto mb-3 text-gray-300" size={48} />
                <p className="text-gray-600">No ranks yet</p>
                <p className="text-sm text-gray-500">Create your first ranked list</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userRanks.map((rank: any) => (
                  <div
                    key={rank.id}
                    className="bg-white border border-gray-200 rounded-xl hover:border-purple-300 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/rank/${rank.id}`)}
                    data-testid={`rank-card-${rank.id}`}
                  >
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg flex items-center justify-center">
                          <Trophy className="text-yellow-600" size={18} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{rank.title}</h3>
                          <p className="text-sm text-gray-500">
                            {rank.items?.length || 0} {rank.items?.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Share2 
                          className="text-gray-400 hover:text-purple-600" 
                          size={18}
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${import.meta.env.VITE_APP_URL || window.location.origin}/rank/${rank.id}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Link copied!" });
                          }}
                        />
                        <ChevronRight className="text-gray-400" size={20} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {/* Import Media History Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="w-full mb-4 px-4 py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-colors flex items-center justify-center gap-2 font-medium"
              data-testid="button-import-history"
            >
              <Upload size={18} />
              Import Media History
            </button>

            {/* Filter buttons row */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Media Type Filter */}
              <div className="relative">
                <button
                  onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    mediaHistoryType !== 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                  data-testid="filter-type-button"
                >
                  <Film size={12} />
                  {getTypeLabel()}
                  <ChevronRight size={12} className={`transition-transform ${openFilter === 'type' ? 'rotate-90' : ''}`} />
                </button>
                {openFilter === 'type' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[120px]">
                    {[
                      { value: 'all', label: 'All Types' },
                      { value: 'movies', label: 'Movies', icon: Film },
                      { value: 'tv', label: 'TV', icon: Tv },
                      { value: 'books', label: 'Books', icon: BookOpen },
                      { value: 'music', label: 'Music', icon: Music },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => { setMediaHistoryType(value); setOpenFilter(null); }}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-100 ${
                          mediaHistoryType === value ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                        }`}
                      >
                        {Icon && <Icon size={12} className="text-gray-600" />}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year Filter */}
              <div className="relative">
                <button
                  onClick={() => setOpenFilter(openFilter === 'year' ? null : 'year')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    mediaHistoryYear !== 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                  data-testid="filter-year-button"
                >
                  <Calendar size={12} />
                  {getYearLabel()}
                  <ChevronRight size={12} className={`transition-transform ${openFilter === 'year' ? 'rotate-90' : ''}`} />
                </button>
                {openFilter === 'year' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[100px] max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setMediaHistoryYear('all'); setOpenFilter(null); }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                        mediaHistoryYear === 'all' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                      }`}
                    >
                      All Years
                    </button>
                    {years.map((year) => (
                      <button
                        key={year}
                        onClick={() => { setMediaHistoryYear(year); setOpenFilter(null); }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                          mediaHistoryYear === year ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rating Filter */}
              <div className="relative">
                <button
                  onClick={() => setOpenFilter(openFilter === 'rating' ? null : 'rating')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    mediaHistoryRating !== 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                  data-testid="filter-rating-button"
                >
                  ⭐
                  {getRatingLabel()}
                  <ChevronRight size={12} className={`transition-transform ${openFilter === 'rating' ? 'rotate-90' : ''}`} />
                </button>
                {openFilter === 'rating' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[100px]">
                    <button
                      onClick={() => { setMediaHistoryRating('all'); setOpenFilter(null); }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                        mediaHistoryRating === 'all' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                      }`}
                    >
                      All Ratings
                    </button>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => { setMediaHistoryRating(rating.toString()); setOpenFilter(null); }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                          mediaHistoryRating === rating.toString() ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                        }`}
                      >
                        {'⭐'.repeat(rating)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search media history..."
                value={mediaHistorySearch}
                onChange={(e) => setMediaHistorySearch(e.target.value)}
                className="pl-10 bg-white text-gray-900 border-gray-300"
                data-testid="input-history-search"
              />
            </div>

            {isLoadingLists ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : filteredMediaHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <Clock className="mx-auto mb-3 text-gray-300" size={48} />
                <p className="text-gray-600">No media history yet</p>
                <p className="text-sm text-gray-500">Start tracking media to see your history here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMediaHistory.map((item: any, index: number) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="bg-white border border-gray-200 rounded-xl p-3 hover:border-purple-300 transition-colors cursor-pointer"
                    onClick={() => {
                      if (item.external_id && item.external_source) {
                        setLocation(`/media/${item.media_type}/${item.external_source}/${item.external_id}`);
                      }
                    }}
                    data-testid={`history-item-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {getMediaIcon(item.media_type)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {getMediaIcon(item.media_type)}
                          <span>{item.media_type}</span>
                          <span>•</span>
                          <span>{item.listName}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-gray-900">
              Import Goodreads
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImportHelpOpen(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <HelpCircle size={16} />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload your Goodreads export file to import your reading history.
            </p>
            <p className="text-sm text-gray-500 bg-purple-50 rounded-lg px-3 py-2">
              Want to import from other services? Email <a href="mailto:heidi@consumedapp.com" className="text-purple-600 font-medium hover:underline">heidi@consumedapp.com</a> and we'll do it for you!
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".csv,.zip"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-600">
                  {importFile ? importFile.name : 'Click to select a file'}
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV files supported</p>
              </label>
            </div>
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={handleFileImport}
              disabled={!importFile || isUploading}
              data-testid="button-submit-import"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Help Modal */}
      <Dialog open={isImportHelpOpen} onOpenChange={setIsImportHelpOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">How to Export Your Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1 text-gray-900">Netflix</h4>
              <p className="text-gray-600">Go to Account → Profile → Viewing Activity → Download all</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-900">Goodreads</h4>
              <p className="text-gray-600">Go to My Books → Import and export → Export Library</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-900">Spotify</h4>
              <p className="text-gray-600">Go to Privacy settings → Download your data</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FeedbackFooter />
    </div>
  );
}
