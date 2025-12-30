import { useState, useMemo, useEffect } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Share2,
  Check,
  MoreHorizontal
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import FeedbackFooter from "@/components/feedback-footer";
import { QuickAddModal } from "@/components/quick-add-modal";
import { DnfReasonDrawer } from "@/components/dnf-reason-drawer";

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
  const [rankSearch, setRankSearch] = useState("");
  
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
  
  // Quick add modal state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Fast metadata query - try lightweight endpoint first, fallback to full endpoint
  const { data: listsMetadata, isLoading: isLoadingMetadata } = useQuery({
    queryKey: ['user-lists-metadata', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { lists: [] };
      
      // Try the fast metadata endpoint first
      try {
        const metadataResponse = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-metadata?user_id=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (metadataResponse.ok) {
          return metadataResponse.json();
        }
      } catch (e) {
        // Metadata endpoint not deployed yet, fall through to full endpoint
      }
      
      // Fallback to full endpoint if metadata endpoint fails
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
        // Transform full data to metadata format
        return {
          lists: (data.lists || []).map((list: any) => ({
            ...list,
            item_count: list.items?.length || 0
          }))
        };
      }
      return { lists: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Full items query - always loaded for carousel and history
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
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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

  // Extract Currently list items from the shared lists query
  const currentlyConsumingItems = useMemo(() => {
    const currentlyList = listsData?.lists?.find((list: any) => list.title === 'Currently');
    return currentlyList?.items || [];
  }, [listsData]);

  // Use metadata for Lists tab (fast), full data for History tab
  const userListsMetadata = listsMetadata?.lists || [];
  const userListsFull = listsData?.lists || [];
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
      queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] });
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

  // Update progress mutation for Currently Consuming items
  const updateProgressMutation = useMutation({
    mutationFn: async ({ itemId, progress, total, mode, progressDisplay }: { itemId: string; progress: number; total?: number; mode: string; progressDisplay: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            progress,
            total,
            progress_mode: mode,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to update progress');
      return { ...await response.json(), progressDisplay };
    },
    onSuccess: (data) => {
      toast({ title: `Progress updated to ${data.progressDisplay}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    },
  });

  // Move item to different list mutation
  const moveToListMutation = useMutation({
    mutationFn: async ({ itemId, targetList, listName }: { itemId: string; targetList: string; listName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/move-item-to-list',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            target_list: targetList,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Move item error:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to move item');
      }
      return { ...await response.json(), listName };
    },
    onSuccess: (data) => {
      toast({ title: `Moved to ${data.listName}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move item", variant: "destructive" });
    },
  });

  // Get all media items from lists for history (memoized and deduplicated)
  const allMediaItems = useMemo(() => {
    const seenItems = new Map<string, any>();
    
    // Skip the "All" list since it duplicates items from other lists
    userListsFull
      .filter(list => list.id !== 'all' && list.title !== 'All')
      .forEach(list => {
        if (list.items && Array.isArray(list.items)) {
          list.items.forEach((item: any) => {
            // Create unique key using external_id+source or item id
            const uniqueKey = item.external_id && item.external_source
              ? `${item.external_source}-${item.external_id}`
              : item.id || `${item.title}-${item.media_type}`;
            
            const itemWithList = {
              ...item,
              listName: list.title,
              listId: list.id,
            };
            
            // Keep only first occurrence (most recent due to sort order from API)
            if (!seenItems.has(uniqueKey)) {
              seenItems.set(uniqueKey, itemWithList);
            }
          });
        }
      });
    
    return Array.from(seenItems.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [userListsFull]);

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
        const itemRating = Math.floor(item.user_rating || 0);
        if (itemRating < parseInt(mediaHistoryRating)) return false;
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
        queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] });
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

        {/* Currently Consuming Section */}
        {currentlyConsumingItems.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Currently Consuming
              </h2>
              <Link href="/list/currently">
                <span className="text-sm text-purple-600 font-medium flex items-center gap-1 cursor-pointer hover:text-purple-700">
                  {currentlyConsumingItems.length > 10 ? `${currentlyConsumingItems.length} items • ` : ''}See All <ChevronRight size={16} />
                </span>
              </Link>
            </div>
            
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-3" style={{ width: 'max-content' }}>
                {currentlyConsumingItems.slice(0, 10).map((item: any) => (
                  <CurrentlyConsumingCard 
                    key={item.id} 
                    item={item}
                    onUpdateProgress={(progress, total, mode, progressDisplay) => {
                      updateProgressMutation.mutate({
                        itemId: item.id,
                        progress,
                        total,
                        mode,
                        progressDisplay
                      });
                    }}
                    onMoveToList={(targetList, listName) => {
                      moveToListMutation.mutate({
                        itemId: item.id,
                        targetList,
                        listName
                      });
                    }}
                    isUpdating={updateProgressMutation.isPending || moveToListMutation.isPending}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state for Currently Consuming */}
        {!isLoadingLists && currentlyConsumingItems.length === 0 && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Play className="text-purple-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Nothing in progress</h3>
                <p className="text-sm text-gray-600">Add media to your "Currently" list to track your progress</p>
              </div>
              <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => setIsQuickAddOpen(true)}
                data-testid="button-add-currently"
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </div>
          </div>
        )}

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

            {isLoadingMetadata ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : userListsMetadata.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <List className="mx-auto mb-3 text-gray-300" size={48} />
                <p className="text-gray-600">No lists yet</p>
                <p className="text-sm text-gray-500">Create your first list to start tracking media</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userListsMetadata
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
                            {list.item_count ?? list.items?.length ?? 0} {(list.item_count ?? list.items?.length ?? 0) === 1 ? 'item' : 'items'}
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
                            const url = `${import.meta.env.VITE_APP_URL || window.location.origin}/list/${listSlug}?user=${user?.id}`;
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
            <div className="mb-4 flex justify-center">
              <Dialog open={isCreateRankOpen} onOpenChange={setIsCreateRankOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-8 py-2 rounded-full" data-testid="button-create-rank">
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

            {/* Search Ranks */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search ranks..."
                value={rankSearch}
                onChange={(e) => setRankSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                data-testid="input-search-ranks"
              />
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
                {userRanks
                  .filter((rank: any) => 
                    rank.title.toLowerCase().includes(rankSearch.toLowerCase())
                  )
                  .map((rank: any) => (
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
                            const url = `${import.meta.env.VITE_APP_URL || window.location.origin}/rank/${rank.id}?user=${user?.id}`;
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

      {/* Floating Action Button - Quick Add */}
      <button
        onClick={() => setIsQuickAddOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-lg flex items-center justify-center text-white hover:from-purple-700 hover:to-blue-700 transition-all hover:scale-105 z-40"
        data-testid="fab-quick-add"
        aria-label="Quick add media"
      >
        <Plus size={24} />
      </button>

      {/* Quick Add Modal */}
      <QuickAddModal 
        isOpen={isQuickAddOpen} 
        onClose={() => setIsQuickAddOpen(false)} 
      />

      <FeedbackFooter />
    </div>
  );
}

// Currently Consuming Card Component
interface CurrentlyConsumingCardProps {
  item: any;
  onUpdateProgress: (progress: number, total: number | undefined, mode: string, progressDisplay: string) => void;
  onMoveToList: (targetList: string, listName: string) => void;
  isUpdating: boolean;
}

function CurrentlyConsumingCard({ item, onUpdateProgress, onMoveToList, isUpdating }: CurrentlyConsumingCardProps) {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const [isProgressSheetOpen, setIsProgressSheetOpen] = useState(false);
  const [isMoveSheetOpen, setIsMoveSheetOpen] = useState(false);
  const [isDnfDrawerOpen, setIsDnfDrawerOpen] = useState(false);
  
  const mediaType = item.media_type || 'movie';
  const isBook = mediaType === 'book';
  const isTv = mediaType === 'tv' || mediaType === 'series';
  const isPodcast = mediaType === 'podcast';
  const isMusic = mediaType === 'music';
  const progressMode = item.progress_mode || (isBook ? 'page' : isTv ? 'episode' : 'percent');

  // Mode-aware default for total/season
  const getDefaultTotal = () => {
    if (isTv) return 1; // Default to Season 1
    if (isBook || isPodcast) return 0; // No default total for pages/minutes
    return 100; // Default 100% for percent mode
  };

  // Local state for progress editing
  const [localProgress, setLocalProgress] = useState(item.progress || 0);
  const [localTotal, setLocalTotal] = useState(item.progress_total ?? getDefaultTotal());
  const [editProgress, setEditProgress] = useState(item.progress || 0);
  const [editTotal, setEditTotal] = useState(item.progress_total ?? getDefaultTotal());
  const [editSeason, setEditSeason] = useState(item.progress_total ?? 1);
  const [editEpisode, setEditEpisode] = useState(item.progress || 1);

  // Fetch TV show details when progress sheet opens (for season/episode data)
  const { data: tvShowData, isLoading: isTvDataLoading } = useQuery({
    queryKey: ['tv-show-seasons', item.external_source, item.external_id],
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${item.external_source || 'tmdb'}&external_id=${item.external_id}&media_type=tv`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isTv && isProgressSheetOpen && !!session?.access_token,
    staleTime: 1000 * 60 * 30, // Cache for 30 mins
  });

  // Get season data from TV show
  const seasons = tvShowData?.seasons || [];
  const currentSeasonData = seasons.find((s: any) => s.seasonNumber === editSeason);
  const maxEpisodes = currentSeasonData?.episodeCount || 999;

  // Clamp episode value when TMDB data loads or season changes
  useEffect(() => {
    if (maxEpisodes < 999 && editEpisode > maxEpisodes) {
      setEditEpisode(maxEpisodes);
    }
  }, [maxEpisodes, editEpisode]);

  // Default to media-appropriate tracking mode
  const getDefaultMode = () => {
    // If user already has a mode saved, use that
    if (progressMode === 'episode') return 'episode';
    if (progressMode === 'page') return 'page';
    // Otherwise, default based on media type
    if (isTv) return 'episode';
    if (isBook) return 'page';
    if (isPodcast) return 'minutes';
    return 'percent';
  };
  
  const [editMode, setEditMode] = useState<'percent' | 'page' | 'episode' | 'minutes'>(getDefaultMode());

  // DNF reason mutation
  const dnfReasonMutation = useMutation({
    mutationFn: async ({ listItemId, reasons, otherReason }: { listItemId: string; reasons: string[]; otherReason?: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/save-dnf-reason',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            list_item_id: listItemId,
            reasons,
            other_reason: otherReason,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save DNF reason');
      }
      return response.json();
    },
    onError: (error) => {
      console.error('DNF reason error:', error);
    },
  });

  const handleDnfWithReason = async (reasons: string[], otherReason?: string) => {
    // First move the item to DNF list
    onMoveToList('dnf', 'Did Not Finish');
    setIsDnfDrawerOpen(false);
    setIsMoveSheetOpen(false);
    
    // Then save the DNF reason (uses the current item ID)
    try {
      await dnfReasonMutation.mutateAsync({
        listItemId: item.id,
        reasons,
        otherReason,
      });
    } catch (error) {
      console.error('Failed to save DNF reason:', error);
    }
  };
  
  const getProgressDisplay = () => {
    // For TV shows, always show episode format if we have season data (localTotal > 0)
    if (isTv && localTotal > 0) {
      return `S${localTotal}E${localProgress}`;
    }
    if (progressMode === 'percent') {
      return `${localProgress}%`;
    } else if (progressMode === 'page') {
      return localTotal > 0 ? `p${localProgress}/${localTotal}` : `p${localProgress}`;
    } else if (progressMode === 'episode') {
      return localTotal > 0 ? `S${localTotal}E${localProgress}` : `E${localProgress}`;
    }
    return `${localProgress}%`;
  };

  const getProgressPercent = () => {
    if (progressMode === 'percent') {
      return localProgress;
    } else if (localTotal > 0) {
      return Math.min(Math.round((localProgress / localTotal) * 100), 100);
    }
    return 0;
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case 'movie': return <Film size={12} className="text-purple-400" />;
      case 'tv': return <Tv size={12} className="text-pink-400" />;
      case 'book': return <BookOpen size={12} className="text-cyan-400" />;
      case 'music': return <Music size={12} className="text-green-400" />;
      case 'podcast': return <Headphones size={12} className="text-blue-400" />;
      case 'game': return <Gamepad2 size={12} className="text-orange-400" />;
      default: return <Play size={12} className="text-gray-400" />;
    }
  };

  const handleIncrement = () => {
    let newProgress = localProgress;
    let displayText = '';
    if (progressMode === 'percent') {
      newProgress = Math.min(localProgress + 10, 100);
      displayText = `${newProgress}% (+10%)`;
    } else if (progressMode === 'episode') {
      newProgress = localProgress + 1;
      displayText = isTv ? `S${localTotal}E${newProgress} (+1 episode)` : `E${newProgress} (+1 episode)`;
    } else if (progressMode === 'page') {
      newProgress = localProgress + 1;
      displayText = localTotal > 0 ? `page ${newProgress}/${localTotal} (+1 page)` : `page ${newProgress} (+1 page)`;
    } else {
      newProgress = localProgress + 1;
      displayText = `${newProgress} (+1)`;
    }
    setLocalProgress(newProgress);
    onUpdateProgress(newProgress, progressMode !== 'percent' ? localTotal : undefined, progressMode, displayText);
  };

  const handleSaveProgress = () => {
    let newProgress = editProgress;
    let newTotal = editTotal;
    let mode = editMode;
    let displayText = '';
    
    if (editMode === 'episode') {
      newProgress = editEpisode;
      newTotal = editSeason;
      mode = 'episode';
      displayText = `S${newTotal}E${newProgress}`;
    } else if (editMode === 'page') {
      displayText = newTotal > 0 ? `page ${newProgress}/${newTotal}` : `page ${newProgress}`;
    } else if (editMode === 'minutes') {
      displayText = newTotal > 0 ? `${newProgress}/${newTotal} min` : `${newProgress} min`;
      mode = 'percent'; // Store as percent for now
    } else {
      displayText = `${newProgress}%`;
    }
    
    setLocalProgress(newProgress);
    setLocalTotal(newTotal);
    onUpdateProgress(newProgress, mode !== 'percent' ? newTotal : undefined, mode, displayText);
    setIsProgressSheetOpen(false);
  };

  const getModeOptions = () => {
    if (isTv) return [{ value: 'episode', label: 'Episode' }, { value: 'percent', label: 'Percent' }];
    if (isBook) return [{ value: 'page', label: 'Page' }, { value: 'percent', label: 'Percent' }];
    if (isPodcast) return [{ value: 'minutes', label: 'Minutes' }, { value: 'percent', label: 'Percent' }];
    return [{ value: 'percent', label: 'Percent' }];
  };

  return (
    <>
      <div 
        className="w-36 flex-shrink-0"
        data-testid={`currently-card-${item.id}`}
      >
        {/* Image Section */}
        <div 
          className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer mb-2"
          onClick={() => setLocation(`/media/${item.media_type}/${item.external_source || 'tmdb'}/${item.external_id || item.id}`)}
        >
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-800 to-blue-900 flex items-center justify-center">
              {getMediaIcon()}
            </div>
          )}
          
          {/* Bottom overlay with progress bar and controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-2 px-2">
            {/* Progress bar */}
            <div className="h-1 bg-gray-700/50 rounded-full mb-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all rounded-full"
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>
            
            {/* Controls row */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-white/80">
                {getMediaIcon()}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsProgressSheetOpen(true); }}
                disabled={isUpdating}
                className="flex-1 h-6 text-[11px] bg-purple-600/80 hover:bg-purple-600 text-white font-medium rounded-md px-2 transition-colors"
                data-testid={`button-edit-progress-${item.id}`}
              >
                {getProgressDisplay()}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMoveSheetOpen(true); }}
                disabled={isUpdating}
                className="h-6 w-6 bg-white/20 hover:bg-white/30 text-white rounded-md flex items-center justify-center"
                data-testid={`button-more-${item.id}`}
              >
                <MoreHorizontal size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Title below card */}
        <h4 className="text-sm font-medium text-white truncate px-0.5">{item.title}</h4>
      </div>

      {/* Progress Edit Sheet */}
      <Sheet open={isProgressSheetOpen} onOpenChange={setIsProgressSheetOpen}>
        <SheetContent side="bottom" className="bg-white rounded-t-2xl p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <SheetTitle className="text-lg font-semibold text-gray-900">Update Progress</SheetTitle>
            <button 
              onClick={() => {
                setIsProgressSheetOpen(false);
                onMoveToList('finished', 'Finished');
              }}
              disabled={isUpdating}
              className="text-green-600 font-semibold text-sm hover:text-green-700"
            >
              I'm finished!
            </button>
          </div>
          
          <div className="px-4 py-4 space-y-4 pb-8">
            {/* Item info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="w-12 h-16 object-cover rounded-lg" />
              ) : (
                <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                  {getMediaIcon()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                <p className="text-sm text-gray-500 capitalize">{mediaType}</p>
              </div>
            </div>

            {/* Mode selector - pill style */}
            {getModeOptions().length > 1 && (
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                {getModeOptions().map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditMode(opt.value as any)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      editMode === opt.value 
                        ? 'bg-white text-purple-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Mode-specific inputs */}
            {editMode === 'percent' && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Percentage Complete</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="text-center text-lg font-semibold pr-8 bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
                  </div>
                </div>
                {/* Quick percentage buttons */}
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setEditProgress(pct)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editProgress === pct 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editMode === 'episode' && (
              <div className="space-y-3">
                {isTvDataLoading ? (
                  <div className="text-center py-4 text-gray-500">Loading season data...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Season</label>
                        {seasons.length > 0 ? (
                          <select
                            value={editSeason}
                            onChange={(e) => {
                              const newSeason = parseInt(e.target.value);
                              setEditSeason(newSeason);
                              // Reset episode to 1 when changing seasons
                              setEditEpisode(1);
                            }}
                            className="w-full h-10 px-3 text-center text-lg font-semibold bg-white text-gray-900 border border-gray-200 rounded-md focus:border-purple-400 focus:ring-purple-400"
                          >
                            {seasons.map((s: any) => (
                              <option key={s.seasonNumber} value={s.seasonNumber}>
                                S{s.seasonNumber} ({s.episodeCount} eps)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            value={editSeason}
                            onChange={(e) => setEditSeason(Math.max(1, parseInt(e.target.value) || 1))}
                            className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Episode {maxEpisodes < 999 && <span className="text-gray-400 font-normal">/ {maxEpisodes}</span>}
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={maxEpisodes}
                          value={editEpisode}
                          onChange={(e) => setEditEpisode(Math.min(maxEpisodes, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                    {/* Quick episode increment buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditEpisode(Math.min(editEpisode + 1, maxEpisodes))}
                        disabled={editEpisode >= maxEpisodes}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          editEpisode >= maxEpisodes
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        +1 Episode
                      </button>
                      <button
                        onClick={() => {
                          const nextSeasonNum = editSeason + 1;
                          const nextSeason = seasons.find((s: any) => s.seasonNumber === nextSeasonNum);
                          if (nextSeason || seasons.length === 0) {
                            setEditSeason(nextSeasonNum);
                            setEditEpisode(1);
                          }
                        }}
                        disabled={seasons.length > 0 && !seasons.find((s: any) => s.seasonNumber === editSeason + 1)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          seasons.length > 0 && !seasons.find((s: any) => s.seasonNumber === editSeason + 1)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Next Season
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {editMode === 'page' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Current Page</label>
                    <Input
                      type="number"
                      min={0}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Total Pages</label>
                    <Input
                      type="number"
                      min={0}
                      value={editTotal}
                      onChange={(e) => setEditTotal(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                </div>
                {/* Quick page increment buttons */}
                <div className="flex gap-2">
                  {[10, 25, 50].map((pages) => (
                    <button
                      key={pages}
                      onClick={() => setEditProgress(Math.min(editProgress + pages, editTotal || 9999))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      +{pages} pages
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editMode === 'minutes' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Minutes Listened</label>
                    <Input
                      type="number"
                      min={0}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Total Minutes</label>
                    <Input
                      type="number"
                      min={0}
                      value={editTotal}
                      onChange={(e) => setEditTotal(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                </div>
                {/* Quick minute increment buttons */}
                <div className="flex gap-2">
                  {[15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setEditProgress(Math.min(editProgress + mins, editTotal || 9999))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      +{mins} min
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save button */}
            <Button 
              onClick={handleSaveProgress}
              disabled={isUpdating}
              className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-base font-medium"
            >
              Update Progress
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Move to List Sheet */}
      <Sheet open={isMoveSheetOpen} onOpenChange={setIsMoveSheetOpen}>
        <SheetContent side="bottom" className="bg-white rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-lg font-semibold text-gray-900">Move to List</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-2 pb-6">
            <button
              onClick={() => { onMoveToList('finished', 'Finished'); setIsMoveSheetOpen(false); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-finished-${item.id}`}
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="text-green-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Finished</p>
                <p className="text-sm text-gray-500">Mark as completed</p>
              </div>
            </button>
            
            <button
              onClick={() => { setIsDnfDrawerOpen(true); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-dnf-${item.id}`}
            >
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <X className="text-red-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Did Not Finish</p>
                <p className="text-sm text-gray-500">Stopped watching/reading</p>
              </div>
            </button>
            
            <button
              onClick={() => { onMoveToList('queue', 'Want To'); setIsMoveSheetOpen(false); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-queue-${item.id}`}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Want To</p>
                <p className="text-sm text-gray-500">Save for later</p>
              </div>
            </button>
            
            <button
              onClick={() => { onMoveToList('favorites', 'Favorites'); setIsMoveSheetOpen(false); }}
              disabled={isUpdating}
              className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
              data-testid={`move-favorites-${item.id}`}
            >
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Trophy className="text-yellow-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Favorites</p>
                <p className="text-sm text-gray-500">Add to your favorites</p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* DNF Reason Drawer */}
      <DnfReasonDrawer
        isOpen={isDnfDrawerOpen}
        onClose={() => setIsDnfDrawerOpen(false)}
        onSubmit={handleDnfWithReason}
        mediaTitle={item.title}
      />
    </>
  );
}
