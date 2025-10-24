import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import ListShareModal from "@/components/list-share-modal";
import CreateListDialog from "@/components/create-list-dialog";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Award, Users, Plus, List, Play, BookOpen, Headphones, Eye, Gamepad2, Filter, Film, Tv, Music, Trophy, Sparkles, ExternalLink, Share2, CornerUpRight, X, ChevronDown, Upload, HelpCircle, Info, Heart } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Track() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isCreateListDialogOpen, setIsCreateListDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Currently");
  const [, setLocation] = useLocation();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareList = (listName: string, itemCount: number) => {
    if (!session?.user?.id) {
      toast({
        title: "Cannot Share",
        description: "You must be logged in to share lists",
        variant: "destructive"
      });
      return;
    }

    const listId = listName.toLowerCase().replace(/\s+/g, '-');
    const shareUrl = `${window.location.origin}/list/${listId}?user=${session.user.id}`;

    if (navigator.share) {
      // Use native sharing if available (mobile)
      navigator.share({
        title: `Check out my ${listName} list`,
        text: `Take a look at my entertainment list: ${listName} (${itemCount} items)`,
        url: shareUrl,
      }).catch(() => {
        // Fallback to clipboard
        fallbackCopyToClipboard(shareUrl);
      });
    } else {
      // Fallback to clipboard copy
      fallbackCopyToClipboard(shareUrl);
    }
  };

  const fallbackCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Link copied!",
        description: "List link has been copied to your clipboard.",
      });
    }).catch(() => {
      toast({
        title: "Share failed",
        description: "Unable to copy link. Please try again.",
        variant: "destructive",
      });
    });
  };

  const handleListClick = (listName: string) => {
    const listId = listName.toLowerCase().replace(/\s+/g, '-');
    setLocation(`/list/${listId}`);
  };

  const { user, session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user's lists and media data from Supabase
  const { data: userListsData, isLoading: listsLoading, error: listsError } = useQuery({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) {
        console.log('No session token available');
        return null;
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase lists fetch failed:', response.status, errorText);
        throw new Error('Failed to fetch user lists');
      }

      const data = await response.json();
      console.log('Supabase lists data:', data);
      return data;
    },
    enabled: !!session?.access_token,
  });

  // Extract lists and stats from the response
  const userLists = userListsData?.lists || [];

  // Get actual user points from Supabase
  const { data: userPointsData } = useQuery({
    queryKey: ['user-points'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-user-points', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return null;
    },
    enabled: !!session?.access_token,
  });

  const consumptionStats = {
    totalLogged: userLists.find((list: any) => list.id === 'all')?.items?.length || 0,
    pointsEarned: userPointsData?.points?.all_time || 0, // Use actual points from Supabase
  };

  // Get personalized recommendations from cached system (instant <1s load!)
  const fetchRecommendations = async () => {
    if (!session?.access_token) {
      console.log('No session token available for recommendations');
      return null;
    }

    console.log('[DEBUG] Fetching cached recommendations...');
    const startTime = Date.now();

    const response = await fetch("/api/media-recommendations", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] Cached recommendations received in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Recommendations fetch failed:', response.status, errorText);
      
      // Return empty state when fetch fails
      return {
        recommendations: [],
        isStale: false,
        isGenerating: false
      };
    }

    const data = await response.json();
    console.log('[DEBUG] Recommendations data:', {
      count: data.recommendations?.length || 0,
      isStale: data.isStale,
      isGenerating: data.isGenerating,
      totalTime: `${Date.now() - startTime}ms`
    });
    return data;
  };

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ["media-recommendations"],
    queryFn: fetchRecommendations,
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000, // Refetch after 5 minutes to check for updates
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: false,
  });

  const recommendations = recommendationsData?.recommendations || [];
  const isStaleRecommendations = recommendationsData?.isStale || false;
  const isGeneratingRecommendations = recommendationsData?.isGenerating || false;

  // React Query mutation for adding recommendations to lists
  const addRecommendationMutation = useMutation({
    mutationFn: async ({ recommendation, listType }: { recommendation: any; listType: string }) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      // Check if this is a custom list by looking for it in customLists
      const isCustomList = customLists.some((list: any) => list.id === listType);
      
      // Use different endpoint based on whether it's a custom list or system list
      const endpoint = isCustomList 
        ? "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-to-custom-list"
        : "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          media: {
            title: recommendation.title,
            mediaType: recommendation.media_type,
            creator: recommendation.creator,
            imageUrl: recommendation.image_url,
            externalId: recommendation.external_id,
            externalSource: recommendation.external_source,
            description: recommendation.description,
          },
          rating: null,
          review: null,
          ...(isCustomList ? { customListId: listType } : { listType: listType }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Add recommendation error response:', response.status, errorText);
        throw new Error(`Failed to add recommendation: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Use the listTitle from the response for consistent messaging
      const listTitle = data.listTitle || 'list';
      toast({
        title: "Added to list!",
        description: `${variables.recommendation.title} added to ${listTitle}.`,
      });
      // Invalidate and refetch only the lists data to show the new item - don't refetch recommendations
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'], exact: true });
    },
    onError: (error) => {
      toast({
        title: "Failed to add recommendation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddRecommendation = (recommendation: any, listType: string) => {
    addRecommendationMutation.mutate({ recommendation, listType });
  };

  // Handle file upload for media import
  const handleFileUpload = async () => {
    if (!uploadFile || !session?.access_token) {
      toast({
        title: "Error",
        description: "Please select a file and ensure you're logged in",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/import-media", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Import failed: ${errorText}`);
      }

      const result = await response.json();

      toast({
        title: "Import successful!",
        description: `Imported ${result.imported} items${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
      });

      // Refresh lists
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });

      // Close modal and reset
      setIsUploadModalOpen(false);
      setUploadFile(null);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import media",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.zip')) {
        toast({
          title: "Invalid file",
          description: "Please select a CSV or ZIP file",
          variant: "destructive",
        });
        return;
      }
      setUploadFile(file);
    }
  };

  const getCategoryIcon = (category: string, isWhiteBg = false) => {
    const iconClass = isWhiteBg ? "text-purple-600" : "text-gray-600";
    const iconSize = 16;

    switch (category) {
      case 'movies': return <Film className={iconClass} size={iconSize} />;
      case 'tv': return <Tv className={iconClass} size={iconSize} />;
      case 'books': return <BookOpen className={iconClass} size={iconSize} />;
      case 'music': return <Music className={iconClass} size={iconSize} />;
      case 'games': return <Gamepad2 className={iconClass} size={iconSize} />;
      case 'podcasts': return <Headphones className={iconClass} size={iconSize} />;
      case 'sports': return <Trophy className={iconClass} size={iconSize} />;
      default: return <Film className={iconClass} size={iconSize} />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Build filter options dynamically: system lists + custom lists
  const systemListTitles = ["All", "Currently", "Queue", "Finished", "Did Not Finish", "Favorites"];
  const customLists = userLists.filter((list: any) => list.isCustom) || [];
  const filterOptions = [...systemListTitles, ...customLists.map((list: any) => list.title)];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Track Entertainment,<br />Earn Points
          </h1>
          <p className="text-gray-600 mb-6">
            Track media. Make lists. Earn points for what you love.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => setIsTrackModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-5 py-4 rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-200 w-56"
              data-testid="button-track-media"
            >
              <Plus className="mr-2" size={24} />
              Track Media
            </Button>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-4 rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-200 w-56"
              data-testid="button-upload-media"
            >
              <Upload className="mr-2" size={24} />
              Import History
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        {consumptionStats && Object.keys(consumptionStats).length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-4 md:mb-6">
            <div className="bg-white rounded-xl p-4 text-center border border-gray-200 shadow-sm">
              <TrendingUp className="text-purple-800 mx-auto mb-2" size={20} />
              <div className="text-xl font-bold text-purple-800">{(consumptionStats as any).totalLogged || 0}</div>
              <div className="text-xs text-gray-500">Items Logged</div>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-gray-200 shadow-sm">
              <Award className="text-purple-800 mx-auto mb-2" size={20} />
              <div className="text-xl font-bold text-purple-800">{(consumptionStats as any).pointsEarned || 0}</div>
              <div className="text-xs text-gray-500">Points Earned</div>
            </div>
          </div>
        )}

        {/* Lists Section */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Lists</h2>
          <p className="text-gray-600 text-sm mb-4 md:mb-6">View your default lists. They include what you're on now, what you've finished, or what's next.</p>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-3 md:mb-4">
            {/* Filter Dropdown */}
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-full sm:w-80 h-16 bg-white border-gray-300 text-black text-lg">
                <SelectValue placeholder="Filter your lists" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {/* System Lists */}
                {systemListTitles.map((filter) => (
                  <SelectItem key={filter} value={filter} className="text-black hover:bg-gray-100 text-lg py-4">
                    {filter}
                  </SelectItem>
                ))}
                
                {/* Custom Lists Separator */}
                {customLists.length > 0 && (
                  <div className="px-2 py-2 text-xs text-gray-500 font-semibold border-t mt-2 pt-2">
                    MY CUSTOM LISTS
                  </div>
                )}
                
                {/* Custom Lists */}
                {customLists.map((list: any) => (
                  <SelectItem key={list.id} value={list.title} className="text-black hover:bg-gray-100 text-lg py-4 pl-6">
                    <div className="flex items-center">
                      <List className="text-purple-600 mr-2" size={16} />
                      {list.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Create New List Button */}
            <Button
              onClick={() => setIsCreateListDialogOpen(true)}
              className="w-full sm:w-auto h-16 px-6 bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center"
              data-testid="button-create-list"
            >
              <Plus size={20} className="mr-2" />
              <span>Create List</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listsLoading ? (
              <div className="col-span-2 text-center py-8 text-gray-500">
                Loading your lists...
              </div>
            ) : userLists.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-gray-500">
                No lists found. Create some lists to get started!
              </div>
            ) : (
              userLists
                .filter((list: any) => selectedFilter === "All" || list.title === selectedFilter)
                .map((list: any) => (
                  <div
                    key={list.id}
                    className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleListClick(list.title)}
                    data-testid={`list-card-${list.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center mb-4">
                      {list.title === "Currently" && <Play className="text-purple-700 mr-3" size={24} />}
                      {list.title === "Finished" && <Star className="text-purple-700 mr-3" size={24} />}
                      {list.title === "Did Not Finish" && <X className="text-purple-700 mr-3" size={24} />}
                      {list.title === "Queue" && <Users className="text-purple-700 mr-3" size={24} />}
                      {list.title === "Favorites" && <Heart className="text-purple-700 mr-3" size={24} />}
                      {list.title === "All Media" && <List className="text-purple-700 mr-3" size={24} />}
                      {!["Currently", "Finished", "Did Not Finish", "Queue", "Favorites", "All Media"].includes(list.title) &&
                        <List className="text-purple-700 mr-3" size={24} />}
                      <h3 className="font-bold text-lg text-gray-800">{list.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      {list.title === "Currently" && "What you're consuming right now"}
                      {list.title === "Finished" && "Media you've completed"}
                      {list.title === "Did Not Finish" && "Media you started but didn't complete"}
                      {list.title === "Queue" && "Media you want to consume later"}
                      {list.title === "Favorites" && "Your all-time favorite media"}
                      {list.title === "All Media" && "All tracked media items"}
                      {!["Currently", "Finished", "Did Not Finish", "Queue", "Favorites", "All Media"].includes(list.title) &&
                        (list.description || "Your custom list")}
                    </p>
                    <div className="text-2xl font-bold text-purple-800">{list.items?.length || 0}</div>
                    <div className="text-xs text-gray-500">items</div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recommendations Section */}
        {(recommendationsLoading || isGeneratingRecommendations || (Array.isArray(recommendations) && recommendations.length > 0)) && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <Sparkles className="text-purple-700 mr-2" size={20} />
              <h2 className="text-xl font-bold text-gray-800">Recommended for You</h2>
              {isGeneratingRecommendations && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse" data-testid="generating-badge">
                  Generating...
                </span>
              )}
              {!isGeneratingRecommendations && isStaleRecommendations && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full" data-testid="refreshing-badge">
                  Refreshing...
                </span>
              )}
            </div>

            <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
              {recommendationsLoading ? (
                // Loading skeleton cards
                [...Array(2)].map((_, index) => (
                  <div key={`loading-${index}`} className="flex-shrink-0 w-80 bg-gradient-to-r from-slate-700 to-purple-700 rounded-xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="bg-white/20 p-1.5 rounded-lg mr-2 animate-pulse">
                          <div className="w-4 h-4 bg-white/30 rounded"></div>
                        </div>
                        <div className="bg-white/30 h-4 w-12 rounded animate-pulse"></div>
                      </div>
                      <div className="bg-white/30 h-8 w-20 rounded animate-pulse"></div>
                    </div>
                    <div className="bg-white/30 h-6 w-3/4 rounded mb-2 animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="bg-white/20 h-3 w-full rounded animate-pulse"></div>
                      <div className="bg-white/20 h-3 w-5/6 rounded animate-pulse"></div>
                      <div className="bg-white/20 h-3 w-4/5 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))
              ) : (
                recommendations.map((rec: any) => (
                <div key={rec.id} className="flex-shrink-0 w-80 bg-gradient-to-r from-slate-700 to-purple-700 rounded-xl p-4 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium capitalize opacity-90">{rec.media_type}</span>
                    </div>
                    <div className="flex">
                      <Button
                        size="sm"
                        onClick={() => handleAddRecommendation(rec, 'queue')}
                        disabled={addRecommendationMutation.isPending}
                        className="bg-gray-400 hover:bg-gray-300 disabled:bg-gray-400 text-white px-3 py-1 text-xs rounded-r-none border-r border-gray-300"
                        data-testid={`add-to-queue-${rec.id}`}
                      >
                        <Plus size={14} className="mr-1" />
                        {addRecommendationMutation.isPending ? "Adding..." : "Queue"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            disabled={addRecommendationMutation.isPending}
                            className="bg-gray-400 hover:bg-gray-300 disabled:bg-gray-400 text-white px-2 py-1 text-xs rounded-l-none"
                            data-testid={`add-dropdown-${rec.id}`}
                          >
                            <ChevronDown size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onClick={() => handleAddRecommendation(rec, 'currently')}
                            className="cursor-pointer"
                            disabled={addRecommendationMutation.isPending}
                          >
                            Add to Currently
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAddRecommendation(rec, 'finished')}
                            className="cursor-pointer"
                            disabled={addRecommendationMutation.isPending}
                          >
                            Add to Finished
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAddRecommendation(rec, 'dnf')}
                            className="cursor-pointer"
                            disabled={addRecommendationMutation.isPending}
                          >
                            Add to Did Not Finish
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAddRecommendation(rec, 'favorites')}
                            className="cursor-pointer"
                            disabled={addRecommendationMutation.isPending}
                          >
                            Add to Favorites
                          </DropdownMenuItem>
                          
                          {/* Custom Lists Section */}
                          {customLists.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold border-t mt-1 pt-2">
                                MY CUSTOM LISTS
                              </div>
                              {customLists.map((list: any) => (
                                <DropdownMenuItem
                                  key={list.id}
                                  onClick={() => handleAddRecommendation(rec, list.id)}
                                  className="cursor-pointer pl-4"
                                  disabled={addRecommendationMutation.isPending}
                                >
                                  <List className="text-purple-600 mr-2 h-4 w-4" />
                                  Add to {list.title}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                          
                          {/* Create New List */}
                          <div className="border-t mt-1 pt-1">
                            <DropdownMenuItem
                              onClick={() => setIsCreateListDialogOpen(true)}
                              className="cursor-pointer text-purple-400 hover:text-purple-300 pl-4"
                              disabled={addRecommendationMutation.isPending}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Create New List
                            </DropdownMenuItem>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg mb-1">{rec.title}</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {rec.description}
                  </p>
                </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>


      <ConsumptionTracker
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />

      {/* Import History Dialog */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-black">Import History</DialogTitle>
            <DialogDescription className="text-gray-600 space-y-3">
              <div>
                Import your entertainment history from Netflix or Goodreads. Upload a CSV or ZIP file to get started.
                <button
                  onClick={() => setIsHelpModalOpen(true)}
                  className="inline-flex items-center ml-1 text-blue-600 hover:text-blue-700 underline"
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  How to download
                </button>
              </div>
              <div className="pt-3 border-t border-gray-200 text-sm">
                Have history from other sources? Email it to{' '}
                <a 
                  href="mailto:heidi@consumedapp.com" 
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                >
                  heidi@consumedapp.com
                </a>
                {' '}and we'll add it for you.
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">
                    {uploadFile ? uploadFile.name : 'Click to select file'}
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.zip"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-upload-file"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Supported: Netflix, Goodreads (CSV or ZIP)
                </p>
              </div>

              {uploadFile && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {uploadFile.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadFile(null)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Ready to import
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleFileUpload}
              disabled={!uploadFile || isUploading}
              className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
              data-testid="button-import"
            >
              {isUploading ? (
                <>
                  <span className="mr-2">Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Dialog - How to Download */}
      <Dialog open={isHelpModalOpen} onOpenChange={setIsHelpModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-black">How to Import Your History</DialogTitle>
            <DialogDescription className="text-gray-600">
              To bring your viewing and reading history into Consumed, you'll need to download your data from each service first. This process is easiest on desktop.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Where to download:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-gray-700 min-w-[100px]">Netflix:</span>
                  <div className="text-sm text-gray-600">
                    Go to your Account → Security → Personal Info Access → Request.{' '}
                    <a
                      href="https://www.netflix.com/account/getmyinfo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Request here
                    </a>
                    {' '}(This requests your personal info and it will be sent to you once it's approved)
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-gray-700 min-w-[100px]">Goodreads:</span>
                  <div className="text-sm text-gray-600">
                    Visit your Import/Export page and click "Export Library".{' '}
                    <a
                      href="https://www.goodreads.com/review/import"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      Export here
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-gray-700 min-w-[100px]">Other:</span>
                  <div className="text-sm text-gray-600">
                    If you have other media history data you want to enter from any other media platform not listed above, please feel free to email it to us and we can import it for you.
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                Once you've downloaded your files, come back here and click "Import History" to upload them.
              </p>
            </div>

            <div className="text-sm text-gray-600 text-center">
              Need help? We're here for you at{' '}
              <a
                href="mailto:import@consumedapp.com"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                import@consumedapp.com
              </a>
            </div>

            <Button
              onClick={() => setIsHelpModalOpen(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create List Dialog */}
      <CreateListDialog
        open={isCreateListDialogOpen}
        onOpenChange={setIsCreateListDialogOpen}
      />

      <FeedbackFooter />

    </div>
  );
}