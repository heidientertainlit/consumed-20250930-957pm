import { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import FeedbackFooter from "@/components/feedback-footer";

export default function CollectionsPage() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'lists' | 'ranks' | 'history'>('lists');
  
  // Lists state
  const [userLists, setUserLists] = useState<any[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListVisibility, setNewListVisibility] = useState("private");
  
  // Ranks state
  const [userRanks, setUserRanks] = useState<any[]>([]);
  const [isLoadingRanks, setIsLoadingRanks] = useState(true);
  const [isCreateRankOpen, setIsCreateRankOpen] = useState(false);
  const [newRankName, setNewRankName] = useState("");
  const [newRankVisibility, setNewRankVisibility] = useState("private");
  
  // History state
  const [mediaHistorySearch, setMediaHistorySearch] = useState("");
  const [mediaHistoryType, setMediaHistoryType] = useState("all");
  const [mediaHistoryYear, setMediaHistoryYear] = useState("all");
  const [mediaHistoryMonth, setMediaHistoryMonth] = useState("all");
  
  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportHelpOpen, setIsImportHelpOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch user lists
  const fetchUserLists = async () => {
    if (!session?.access_token || !user?.id) return;
    
    setIsLoadingLists(true);
    try {
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
        const data = await response.json();
        setUserLists(data.lists || []);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setIsLoadingLists(false);
    }
  };

  // Fetch user ranks
  const fetchUserRanks = async () => {
    if (!session?.access_token || !user?.id) return;
    
    setIsLoadingRanks(true);
    try {
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
        const data = await response.json();
        setUserRanks(data.ranks || []);
      }
    } catch (error) {
      console.error('Error fetching ranks:', error);
    } finally {
      setIsLoadingRanks(false);
    }
  };

  useEffect(() => {
    if (session?.access_token && user?.id) {
      fetchUserLists();
      fetchUserRanks();
    }
  }, [session?.access_token, user?.id]);

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
      fetchUserLists();
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
      fetchUserRanks();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create rank", variant: "destructive" });
    },
  });

  // Get all media items from lists for history
  const getAllMediaItems = () => {
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
  };

  // Filter media history
  const getFilteredMediaHistory = () => {
    const allItems = getAllMediaItems();
    
    return allItems.filter(item => {
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
      
      return true;
    });
  };

  // Get media type counts
  const getMediaTypeCounts = () => {
    const allItems = getAllMediaItems();
    const counts: any = { movie: 0, tv: 0, book: 0, music: 0, podcast: 0, game: 0 };
    allItems.forEach(item => {
      if (counts.hasOwnProperty(item.media_type)) {
        counts[item.media_type]++;
      }
    });
    return counts;
  };

  const mediaTypeCounts = getMediaTypeCounts();
  const filteredMediaHistory = getFilteredMediaHistory();

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
        fetchUserLists();
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
    const titleMap: any = {
      'Currently': 'Currently Watching/Reading',
      'Want to Watch': 'Want to Watch',
      'Completed': 'Finished',
      'Did Not Finish': 'Did Not Finish',
      'Favorites': 'Favorites',
    };
    return titleMap[title] || title;
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
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Collections
          </h1>
          <p className="text-sm text-gray-600">Your lists, ranks, and media history</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="w-full mb-6 bg-white border border-gray-200 p-1 h-auto">
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
            <div className="mb-4 flex justify-end">
              <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-create-list">
                    <Plus size={16} className="mr-2" />
                    Create List
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New List</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="List name"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      data-testid="input-list-name"
                    />
                    <Select value={newListVisibility} onValueChange={setNewListVisibility}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="friends">Friends Only</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
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
                {userLists.map((list: any) => (
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
                      <ChevronRight className="text-gray-400" size={20} />
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Rank</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Rank name (e.g. Top 10 90s Movies)"
                      value={newRankName}
                      onChange={(e) => setNewRankName(e.target.value)}
                      data-testid="input-rank-name"
                    />
                    <Select value={newRankVisibility} onValueChange={setNewRankVisibility}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="friends">Friends Only</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{rank.title}</h3>
                            {rank.visibility && (
                              <Badge variant="outline" className="text-xs">
                                {rank.visibility === 'private' ? <Lock size={10} className="mr-1" /> : <Users size={10} className="mr-1" />}
                                {rank.visibility}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {rank.items?.length || 0} {rank.items?.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="text-gray-400" size={20} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search your history..."
                  value={mediaHistorySearch}
                  onChange={(e) => setMediaHistorySearch(e.target.value)}
                  className="pl-10 bg-white text-gray-900 border-gray-300"
                  data-testid="input-history-search"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setIsImportModalOpen(true)}
                className="border-purple-300 text-purple-600"
                data-testid="button-import-history"
              >
                <Upload size={16} className="mr-2" />
                Import
              </Button>
            </div>

            {/* Media type filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              <button
                onClick={() => setMediaHistoryType('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  mediaHistoryType === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-all"
              >
                All
              </button>
              <button
                onClick={() => setMediaHistoryType('movies')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  mediaHistoryType === 'movies'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-movies"
              >
                <Film size={14} />
                Movies {mediaTypeCounts.movie > 0 && `(${mediaTypeCounts.movie})`}
              </button>
              <button
                onClick={() => setMediaHistoryType('tv')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  mediaHistoryType === 'tv'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-tv"
              >
                <Tv size={14} />
                TV {mediaTypeCounts.tv > 0 && `(${mediaTypeCounts.tv})`}
              </button>
              <button
                onClick={() => setMediaHistoryType('books')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  mediaHistoryType === 'books'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-books"
              >
                <BookOpen size={14} />
                Books {mediaTypeCounts.book > 0 && `(${mediaTypeCounts.book})`}
              </button>
              <button
                onClick={() => setMediaHistoryType('music')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  mediaHistoryType === 'music'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid="filter-music"
              >
                <Music size={14} />
                Music {mediaTypeCounts.music > 0 && `(${mediaTypeCounts.music})`}
              </button>
            </div>

            {/* Date filters */}
            <div className="flex gap-2 mb-4">
              <Select value={mediaHistoryYear} onValueChange={setMediaHistoryYear}>
                <SelectTrigger className="w-32 bg-white text-gray-900 border-gray-300">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mediaHistoryMonth} onValueChange={setMediaHistoryMonth}>
                <SelectTrigger className="w-36 bg-white text-gray-900 border-gray-300">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Import Media History
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImportHelpOpen(true)}
              >
                <HelpCircle size={16} />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-gray-600">
              Upload a CSV or ZIP file with your viewing history from Netflix, Goodreads, or other services.
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
                <p className="text-xs text-gray-400 mt-1">CSV or ZIP files supported</p>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to Export Your Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Netflix</h4>
              <p className="text-gray-600">Go to Account → Profile → Viewing Activity → Download all</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Goodreads</h4>
              <p className="text-gray-600">Go to My Books → Import and export → Export Library</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Spotify</h4>
              <p className="text-gray-600">Go to Privacy settings → Download your data</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FeedbackFooter />
    </div>
  );
}
