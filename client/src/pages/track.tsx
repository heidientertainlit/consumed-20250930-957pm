import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ListShareModal from "@/components/list-share-modal";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Award, Users, Plus, List, Play, BookOpen, Headphones, Eye, Gamepad2, Filter, Film, Tv, Music, Trophy, Sparkles, ExternalLink, Share2, CornerUpRight, X, ChevronDown } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

export default function Track() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Currently");
  const [, setLocation] = useLocation();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareList = (listName: string, itemCount: number) => {
    const listId = listName.toLowerCase().replace(/\s+/g, '-');
    const shareUrl = `${window.location.origin}/list/${listId}`;
    
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
  const consumptionStats = {
    totalLogged: userLists.reduce((total: number, list: any) => total + (list.items?.length || 0), 0),
    pointsEarned: userLists.reduce((total: number, list: any) => total + (list.items?.length || 0) * 5, 0), // 5 points per item
  };
  
  // Get personalized recommendations from Supabase
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['media-recommendations'],
    queryFn: async () => {
      if (!session?.access_token) {
        console.log('No session token available for recommendations');
        return null;
      }
      
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-media-recommendations", {
        method: "GET", 
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Recommendations fetch failed:', response.status, errorText);
        // Don't throw error, just return empty to not break the page
        return { recommendations: [] };
      }
      
      const data = await response.json();
      console.log('Recommendations data:', data);
      return data;
    },
    enabled: !!session?.access_token,
    // Cache for 10 minutes since recommendations are expensive to generate
    staleTime: 10 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const recommendations = recommendationsData?.recommendations || [];

  // React Query mutation for adding recommendations to lists
  const addRecommendationMutation = useMutation({
    mutationFn: async ({ recommendation, listType }: { recommendation: any; listType: string }) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media", {
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
          listType: listType,
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
      toast({
        title: "Added to list!",
        description: `${variables.recommendation.title} added to ${variables.listType === 'queue' ? 'Queue' : variables.listType === 'currently' ? 'Currently' : variables.listType === 'finished' ? 'Finished' : 'Did Not Finish'}.`,
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

  // Fixed filter options for the 5 standard lists
  const filterOptions = ["All", "Currently", "Queue", "Finished", "Did Not Finish", "Favorites"];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Track Entertainment,<br />Earn Points
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Every show, book, song, or game you log helps you climb the leaderboard.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => setIsTrackModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              data-testid="button-track-media"
            >
              <Plus className="mr-3" size={24} />
              Track Media
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
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 md:mb-4">
            {/* Filter Dropdown */}
            <div className="mb-3 md:mb-4">
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-80 h-16 bg-white border-gray-300 text-black text-lg">
                  <SelectValue placeholder="Filter your lists" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {filterOptions.map((filter) => (
                    <SelectItem key={filter} value={filter} className="text-black hover:bg-gray-100 text-lg py-4">
                      {filter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
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
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        {list.title === "Currently" && <Play className="text-purple-700 mr-3" size={24} />}
                        {list.title === "Finished" && <Star className="text-purple-700 mr-3" size={24} />}
                        {list.title === "Did Not Finish" && <X className="text-purple-700 mr-3" size={24} />}
                        {list.title === "Queue" && <Users className="text-purple-700 mr-3" size={24} />}
                        {list.title === "All Media" && <List className="text-purple-700 mr-3" size={24} />}
                        {!["Currently", "Finished", "Did Not Finish", "Queue", "All Media"].includes(list.title) && 
                          <List className="text-purple-700 mr-3" size={24} />}
                        <h3 className="font-bold text-lg text-gray-800">{list.title}</h3>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareList(list.title, list.items?.length || 0);
                        }}
                        className="bg-black text-white hover:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2"
                        data-testid={`share-${list.title.toLowerCase().replace(/\s+/g, '-')}-list`}
                      >
                        <Share2 size={16} />
                        Share
                      </Button>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      {list.title === "Currently" && "What you're consuming right now"}
                      {list.title === "Finished" && "Media you've completed"}
                      {list.title === "Did Not Finish" && "Media you started but didn't complete"}
                      {list.title === "Queue" && "Media you want to consume later"}
                      {list.title === "All Media" && "All tracked media items"}
                      {!["Currently", "Finished", "Did Not Finish", "Queue", "All Media"].includes(list.title) && 
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
        {(recommendationsLoading || (Array.isArray(recommendations) && recommendations.length > 0)) && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <Sparkles className="text-purple-700 mr-2" size={20} />
              <h2 className="text-xl font-bold text-gray-800">Recommended for You</h2>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
              {recommendationsLoading ? (
                // Loading skeleton cards
                [...Array(3)].map((_, index) => (
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
                        <DropdownMenuContent align="end" className="w-48">
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
      
    </div>
  );
}