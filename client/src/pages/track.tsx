import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ListShareModal from "@/components/list-share-modal";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Award, Users, Plus, List, Play, BookOpen, Headphones, Eye, Gamepad2, Filter, Film, Tv, Music, Trophy, Sparkles, ExternalLink, Share2, CornerUpRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Track() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Currently");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedListForShare, setSelectedListForShare] = useState<{name: string, items: number} | null>(null);
  const [, setLocation] = useLocation();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareList = (listName: string, itemCount: number) => {
    setSelectedListForShare({ name: listName, items: itemCount });
    setShareModalOpen(true);
  };

  const handleListClick = (listName: string) => {
    const listId = listName.toLowerCase().replace(/\s+/g, '-');
    setLocation(`/list/${listId}`);
  };

  const { data: consumptionStats = {} } = useQuery({
    queryKey: ["/api/users/user-1/consumption/stats"],
  });

  const { data: user = {} } = useQuery({
    queryKey: ["/api/users/user-1"],
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["/api/users/user-1/consumption"],
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ["/api/users/user-1/recommendations"],
  });

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

  const filterOptions = ["All", "Currently", "Read", "To Read", "Watched", "To Watch", "Listened", "To Listen", "Played", "To Play"];

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
            
            {/* Create List Button */}
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg shadow-sm"
              data-testid="create-list-button"
            >
              <List className="mr-2" size={20} />
              Create List
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(selectedFilter === "All" || selectedFilter === "Currently") && (
              <div 
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleListClick("Currently")}
                data-testid="list-card-currently"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Play className="text-purple-700 mr-3" size={24} />
                    <h3 className="font-bold text-lg text-gray-800">Currently</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareList("Currently", 0);
                    }}
                    className="text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                    data-testid="share-currently-list"
                  >
                    <CornerUpRight size={18} />
                  </Button>
                </div>
                <p className="text-gray-600 text-sm mb-4">What you're consuming right now</p>
                <div className="text-2xl font-bold text-purple-800">0</div>
                <div className="text-xs text-gray-500">items</div>
              </div>
            )}

            {/* Finished List */}
            {(selectedFilter === "All" || selectedFilter === "Finished") && (
              <div 
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleListClick("Finished")}
                data-testid="list-card-finished"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Star className="text-purple-700 mr-3" size={24} />
                    <h3 className="font-bold text-lg text-gray-800">Finished</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareList("Finished", 0);
                    }}
                    className="text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                    data-testid="share-finished-list"
                  >
                    <CornerUpRight size={18} />
                  </Button>
                </div>
                <p className="text-gray-600 text-sm mb-4">Media you've completed</p>
                <div className="text-2xl font-bold text-purple-800">0</div>
                <div className="text-xs text-gray-500">items</div>
              </div>
            )}

            {/* Did Not Finish List */}
            {(selectedFilter === "All" || selectedFilter === "Did Not Finish") && (
              <div 
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleListClick("Did-Not-Finish")}
                data-testid="list-card-dnf"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <X className="text-purple-700 mr-3" size={24} />
                    <h3 className="font-bold text-lg text-gray-800">Did Not Finish</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareList("Did Not Finish", 0);
                    }}
                    className="text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                    data-testid="share-dnf-list"
                  >
                    <CornerUpRight size={18} />
                  </Button>
                </div>
                <p className="text-gray-600 text-sm mb-4">Media you started but didn't complete</p>
                <div className="text-2xl font-bold text-purple-800">0</div>
                <div className="text-xs text-gray-500">items</div>
              </div>
            )}

            {/* Queue List */}
            {(selectedFilter === "All" || selectedFilter === "Queue") && (
              <div 
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleListClick("Queue")}
                data-testid="list-card-queue"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Users className="text-purple-700 mr-3" size={24} />
                    <h3 className="font-bold text-lg text-gray-800">Queue</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareList("Queue", 0);
                    }}
                    className="text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                    data-testid="share-queue-list"
                  >
                    <CornerUpRight size={18} />
                  </Button>
                </div>
                <p className="text-gray-600 text-sm mb-4">Media you want to consume later</p>
                <div className="text-2xl font-bold text-purple-800">0</div>
                <div className="text-xs text-gray-500">items</div>
              </div>
            )}

          </div>
        </div>

        {/* Recommendations Section */}
        {Array.isArray(recommendations) && recommendations.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <Sparkles className="text-purple-700 mr-2" size={20} />
              <h2 className="text-xl font-bold text-gray-800">Recommended for You</h2>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
              {recommendations.map((rec: any) => (
                <div key={rec.id} className="flex-shrink-0 w-80 bg-gradient-to-r from-slate-700 to-purple-700 rounded-xl p-4 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="bg-white/20 p-1.5 rounded-lg mr-2">
                        {getCategoryIcon(rec.category, true)}
                      </div>
                      <span className="text-sm font-medium capitalize opacity-90">{rec.category}</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-none px-3 py-1 text-xs"
                      data-testid={`add-to-list-${rec.id}`}
                    >
                      <Plus size={14} className="mr-1" />
                      Add
                    </Button>
                  </div>
                  
                  <h3 className="font-bold text-lg mb-1">{rec.title}</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>


      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />
      
      {selectedListForShare && (
        <ListShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedListForShare(null);
          }}
          listName={selectedListForShare.name}
          listItems={selectedListForShare.items}
          listType="default"
        />
      )}
    </div>
  );
}