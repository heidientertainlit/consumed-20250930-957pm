import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Calendar, Vote, ArrowLeft, Clock, Users, Star } from "lucide-react";
import { Link } from "wouter";

interface PredictionPool {
  id: string;
  title: string;
  description: string;
  type: "awards" | "weekly" | "vote" | "bracket";
  pointsReward: number;
  deadline: string;
  participants: number;
  status: "open" | "locked" | "completed";
  category: string;
  icon: string;
  image?: string;
  options?: string[];
  inline?: boolean;
}

// Low Stakes Prediction Pools (Quick & Fun)
const lowStakesPools: PredictionPool[] = [
  {
    id: "netflix-weekend",
    title: "Netflix Top 10 This Week",
    description: "Predict which show will be #1 on Netflix this week",
    type: "vote",
    pointsReward: 10,
    deadline: "Sunday 11:59 PM",
    participants: 1247,
    status: "open",
    category: "Streaming",
    icon: "📺",
    inline: true,
    options: ["Nobody Wants This", "Emily in Paris S4", "Monsters: Menendez", "Avatar: Last Airbender"]
  },
  {
    id: "box-office-weekend", 
    title: "Weekend Box Office Champion",
    description: "Which movie will dominate the box office this weekend?",
    type: "weekly",
    pointsReward: 15,
    deadline: "Friday 11:59 PM", 
    participants: 743,
    status: "open",
    category: "Movies",
    icon: "🎬",
    inline: true,
    options: ["Dune: Part Two", "Madame Web", "Bob Marley: One Love", "Ordinary Angels"]
  },
  {
    id: "trending-music",
    title: "Billboard Hot 100 #1",
    description: "Predict next week's Billboard Hot 100 #1 single",
    type: "vote",
    pointsReward: 12,
    deadline: "Monday 11:59 PM",
    participants: 892,
    status: "open", 
    category: "Music",
    icon: "🎵",
    inline: true,
    options: ["Flowers - Miley Cyrus", "Anti-Hero - Taylor Swift", "Unholy - Sam Smith", "As It Was - Harry Styles"]
  },
  {
    id: "tv-ratings",
    title: "Highest Rated TV Show",
    description: "Predict which show will have the highest ratings this week",
    type: "vote", 
    pointsReward: 13,
    deadline: "Sunday 11:59 PM",
    participants: 567,
    status: "open",
    category: "TV",
    icon: "📊",
    inline: true,
    options: ["Sunday Night Football", "The Voice", "NCIS", "60 Minutes"]
  },
  {
    id: "dancing-with-stars",
    title: "Dancing with the Stars Season 34",
    description: "Predict the winner of DWTS Season 34 - Full Tournament Bracket",
    type: "bracket",
    pointsReward: 25,
    deadline: "May 20, 2025", 
    participants: 2834,
    status: "open",
    category: "Reality TV",
    icon: "🏆",
    inline: false
  },
  {
    id: "academy-awards",
    title: "2025 Academy Awards",
    description: "Predict winners across all major Oscar categories",
    type: "awards",
    pointsReward: 20,
    deadline: "March 2, 2025",
    participants: 4156,
    status: "open",
    category: "Movies", 
    icon: "🎭",
    inline: false
  }
];


// Award Show Modal Component
const AwardShowModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedPicks, setSelectedPicks] = useState<Record<string, string>>({});

  const categories = [
    {
      id: "best-picture",
      title: "Best Picture",
      nominees: ["Oppenheimer", "Killers of the Flower Moon", "Barbie", "Poor Things"]
    },
    {
      id: "best-actor",
      title: "Best Actor",
      nominees: ["Cillian Murphy", "Paul Giamatti", "Bradley Cooper", "Jeffrey Wright"]
    },
    {
      id: "best-actress", 
      title: "Best Actress",
      nominees: ["Emma Stone", "Lily Gladstone", "Carey Mulligan", "Sandra Hüller"]
    }
  ];

  const handlePick = (categoryId: string, nominee: string) => {
    setSelectedPicks(prev => ({
      ...prev,
      [categoryId]: nominee
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {categories.map((category) => (
            <Card key={category.id} className="bg-white border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-gray-900">{category.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.nominees.map((nominee) => (
                  <button
                    key={nominee}
                    onClick={() => handlePick(category.id, nominee)}
                    className={`w-full p-3 text-left rounded-lg border transition-all ${
                      selectedPicks[category.id] === nominee
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-gray-800">{nominee}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={Object.keys(selectedPicks).length !== categories.length}
          >
            Submit Predictions ({pool.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Weekly Prediction Modal Component
const WeeklyModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedPick, setSelectedPick] = useState<string>("");

  const options = pool.id === "box-office-weekend" 
    ? ["Dune: Part Two", "Madame Web", "Bob Marley: One Love", "Ordinary Angels"]
    : ["Avatar: The Last Airbender", "Griselda", "American Nightmare", "Nobody Wants This"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedPick(option)}
              className={`w-full p-4 text-left rounded-lg border transition-all ${
                selectedPick === option
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-800">{option}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedPick}
          >
            Submit Prediction ({pool.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Bracket Modal Component for Dancing with the Stars
const BracketModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedWinner, setSelectedWinner] = useState<string>("");

  const fullCast = [
    "Ariana Grande & Choreographer Val Chmerkovskiy",
    "Glen Powell & Choreographer Jenna Johnson", 
    "Sabrina Carpenter & Choreographer Derek Hough",
    "Barry Keoghan & Choreographer Emma Slater",
    "Zendaya & Choreographer Brandon Armstrong",
    "Jacob Elordi & Choreographer Daniella Karagach",
    "Sydney Sweeney & Choreographer Alan Bersten",
    "Paul Mescal & Choreographer Witney Carson",
    "Anya Taylor-Joy & Choreographer Gleb Savchenko",
    "Timothée Chalamet & Choreographer Rylee Arnold"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[85vh] overflow-y-auto bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="mt-6">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">🕺💃 DANCING WITH THE STARS 💃🕺</h3>
            <h4 className="text-lg font-semibold text-purple-700 mb-1">Season 34 Tournament Bracket</h4>
            <p className="text-sm text-gray-600">Pick your Mirrorball Trophy winner!</p>
          </div>
          
          <div className="relative bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl border border-gray-200">
            {/* NCAA-Style Tournament Bracket */}
            <div className="flex justify-between items-center min-h-[500px] overflow-x-auto">
              
              {/* Left Side - Round 1 */}
              <div className="flex flex-col space-y-3 min-w-[200px]">
                <div className="text-center">
                  <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold mb-3">ROUND 1</div>
                </div>
                {fullCast.slice(0, 5).map((couple, index) => (
                  <div key={couple} className="relative">
                    <button
                      onClick={() => setSelectedWinner(couple)}
                      className={`w-full p-2 text-left rounded border transition-all text-xs ${
                        selectedWinner === couple
                          ? 'border-purple-500 bg-purple-100 shadow-md text-purple-900'
                          : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50 text-gray-800'
                      }`}
                    >
                      <div className="font-medium leading-tight">{couple.split(' & ')[0]}</div>
                      <div className="text-xs text-gray-600">{couple.split(' & ')[1]}</div>
                    </button>
                    {/* Connecting line to next round */}
                    {index < 4 && (
                      <div className="absolute -right-6 top-1/2 w-6 h-px bg-gray-400"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Left Side - Quarterfinals */}
              <div className="flex flex-col justify-center space-y-12 min-w-[150px]">
                <div className="text-center">
                  <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-6">QUARTERFINALS</div>
                </div>
                <div className="space-y-16">
                  <div className="relative">
                    <div className="h-8 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-500">TBD</span>
                    </div>
                    <div className="absolute -right-6 top-1/2 w-6 h-px bg-gray-400"></div>
                  </div>
                  <div className="relative">
                    <div className="h-8 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-500">TBD</span>
                    </div>
                    <div className="absolute -right-6 top-1/2 w-6 h-px bg-gray-400"></div>
                  </div>
                </div>
              </div>

              {/* Left Side - Semifinals */}
              <div className="flex flex-col justify-center min-w-[120px]">
                <div className="text-center mb-6">
                  <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold">SEMIFINALS</div>
                </div>
                <div className="relative">
                  <div className="h-10 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                    <span className="text-xs text-gray-500">TBD</span>
                  </div>
                  <div className="absolute -right-6 top-1/2 w-6 h-px bg-gray-400"></div>
                </div>
              </div>

              {/* Center - Finals */}
              <div className="flex flex-col items-center justify-center min-w-[160px] px-4">
                <div className="text-center mb-4">
                  <div className="bg-gradient-to-r from-yellow-400 to-blue-400 text-white px-4 py-2 rounded-full text-sm font-bold">🏆 FINALS 🏆</div>
                </div>
                <div className={`w-36 h-24 rounded-xl border-4 flex flex-col items-center justify-center transition-all ${
                  selectedWinner 
                    ? 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-blue-50 shadow-lg' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="text-3xl mb-1">🏆</div>
                  <div className="text-xs text-center font-bold text-gray-700">
                    {selectedWinner ? (
                      <div>
                        <div className="text-purple-700">CHAMPION</div>
                        <div className="text-xs text-gray-600 mt-1">Mirrorball Winner</div>
                      </div>
                    ) : (
                      <div>
                        <div>MIRRORBALL</div>
                        <div>TROPHY</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side - Semifinals */}
              <div className="flex flex-col justify-center min-w-[120px]">
                <div className="text-center mb-6">
                  <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold">SEMIFINALS</div>
                </div>
                <div className="relative">
                  <div className="h-10 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                    <span className="text-xs text-gray-500">TBD</span>
                  </div>
                  <div className="absolute -left-6 top-1/2 w-6 h-px bg-gray-400"></div>
                </div>
              </div>

              {/* Right Side - Quarterfinals */}
              <div className="flex flex-col justify-center space-y-12 min-w-[150px]">
                <div className="text-center">
                  <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-6">QUARTERFINALS</div>
                </div>
                <div className="space-y-16">
                  <div className="relative">
                    <div className="h-8 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-500">TBD</span>
                    </div>
                    <div className="absolute -left-6 top-1/2 w-6 h-px bg-gray-400"></div>
                  </div>
                  <div className="relative">
                    <div className="h-8 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-500">TBD</span>
                    </div>
                    <div className="absolute -left-6 top-1/2 w-6 h-px bg-gray-400"></div>
                  </div>
                </div>
              </div>

              {/* Right Side - Round 1 */}
              <div className="flex flex-col space-y-3 min-w-[200px]">
                <div className="text-center">
                  <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold mb-3">ROUND 1</div>
                </div>
                {fullCast.slice(5, 10).map((couple, index) => (
                  <div key={couple} className="relative">
                    <button
                      onClick={() => setSelectedWinner(couple)}
                      className={`w-full p-2 text-left rounded border transition-all text-xs ${
                        selectedWinner === couple
                          ? 'border-purple-500 bg-purple-100 shadow-md text-purple-900'
                          : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50 text-gray-800'
                      }`}
                    >
                      <div className="font-medium leading-tight">{couple.split(' & ')[0]}</div>
                      <div className="text-xs text-gray-600">{couple.split(' & ')[1]}</div>
                    </button>
                    {/* Connecting line to next round */}
                    {index < 4 && (
                      <div className="absolute -left-6 top-1/2 w-6 h-px bg-gray-400"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Winner Display */}
            {selectedWinner && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-center">
                  <div className="text-sm text-purple-600 font-medium">Your Season 34 Champion Prediction:</div>
                  <div className="text-lg font-bold text-purple-900">{selectedWinner}</div>
                  <div className="text-xs text-purple-600 mt-1">Will take home the Mirrorball Trophy!</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedWinner}
          >
            Submit Prediction ({pool.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Vote Modal Component
const VoteModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedVote, setSelectedVote] = useState<string>("");

  const options = [
    "Nobody Wants This",
    "Emily in Paris (Season 4)", 
    "The Lincoln Lawyer (Season 3)",
    "Monsters: The Lyle and Erik Menendez Story",
    "American Nightmare",
    "Avatar: The Last Airbender"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          {options.map((option) => (
            <label
              key={option}
              className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${
                selectedVote === option
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="vote"
                value={option}
                checked={selectedVote === option}
                onChange={(e) => setSelectedVote(e.target.value)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                selectedVote === option
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-gray-300'
              }`}>
                {selectedVote === option && (
                  <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                )}
              </div>
              <span className="font-medium text-gray-700">{option}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedVote}
          >
            Cast Vote ({pool.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function PredictionsPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PredictionPool | null>(null);
  const [filterStatus, setFilterStatus] = useState<"open" | "my_predictions" | "completed">("open");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "awards": return <Trophy size={24} className="text-yellow-600" />;
      case "weekly": return <Calendar size={24} className="text-blue-600" />;
      case "vote": return <Vote size={24} className="text-green-600" />;
      default: return <Star size={24} className="text-purple-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>;
      case "locked": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Locked</Badge>;
      case "completed": return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>;
      default: return null;
    }
  };

  // Filter pools based on status
  const filteredPools = lowStakesPools.filter(pool => 
    pool.status === filterStatus
  );

  const handlePoolClick = (pool: PredictionPool) => {
    if (pool.status === "open" && !pool.inline) {
      setSelectedPool(pool);
    }
  };

  const handleQuickPick = (poolId: string, option: string) => {
    setSelectedOptions(prev => ({ ...prev, [poolId]: option }));
    toast({
      title: "Prediction Submitted!",
      description: `You predicted "${option}" for ${lowStakesPools.find(p => p.id === poolId)?.title}`,
    });
  };

  const renderModal = () => {
    if (!selectedPool) return null;

    switch (selectedPool.type) {
      case "awards":
        return <AwardShowModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      case "weekly":
        return <WeeklyModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      case "bracket":
        return <BracketModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      case "vote":
        return <VoteModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-6xl mx-auto px-4 pt-2 pb-6">
        {/* Back Button */}
        <div className="mb-4">
          <Link href="/play">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="back-to-play">
              <ArrowLeft size={20} className="mr-2" />
              Back to Play
            </Button>
          </Link>
        </div>

        {/* Header and Prediction Pools */}
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-800 mb-2">
              Predictions
            </h1>
            <p className="text-lg text-gray-600">
              Join prediction pools and earn points by making accurate predictions about entertainment!
            </p>
          </div>

          {/* Prediction Pools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {lowStakesPools.filter(pool => pool.status === filterStatus).map((pool) => (
              <Card key={pool.id} className="bg-white border border-gray-200 overflow-hidden">
                <div className="min-h-[320px] flex flex-col">
                    {/* Header Bar */}
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{pool.icon}</span>
                        <Badge className="bg-white bg-opacity-20 text-white hover:bg-white hover:bg-opacity-20">
                          {pool.pointsReward} pts
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-3 flex flex-col">
                      <div className="mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">
                          {pool.title}
                        </h3>
                        <p className="text-xs text-gray-600 line-clamp-1">
                          {pool.description}
                        </p>
                      </div>
                      
                      {/* Inline Options or Action Button */}
                      <div className="flex-1 flex flex-col justify-end">
                        {pool.inline && pool.options ? (
                          <div className="space-y-1.5">
                            {pool.options.map((option) => (
                              <button
                                key={option}
                                onClick={() => handleQuickPick(pool.id, option)}
                                className={`w-full py-1.5 px-2 text-xs font-medium rounded-md border transition-all ${
                                  selectedOptions[pool.id] === option
                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                                }`}
                                data-testid={`quick-pick-${pool.id}-${option}`}
                              >
                                {option.length > 18 ? `${option.substring(0, 18)}...` : option}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={() => handlePoolClick(pool)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md text-sm font-medium hover:from-purple-600 hover:to-purple-700 transition-all"
                            data-testid={`open-pool-${pool.id}`}
                          >
                            Predict
                          </button>
                        )}
                      </div>
                      
                      {/* Footer Info */}
                      <div className="mt-2 pt-1.5 border-t border-gray-100 text-xs text-gray-500 text-center">
                        {pool.participants.toLocaleString()} participants
                      </div>
                    </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Filter Tabs for Status */}
          <div className="flex justify-center mt-8">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: "open", label: "Open Pools" },
                { key: "my_predictions", label: "My Predictions" },
                { key: "completed", label: "Completed" }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key as any)}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                    filterStatus === filter.key
                      ? 'bg-white text-gray-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-700'
                  }`}
                  data-testid={`filter-${filter.key}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {renderModal()}

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />
    </div>
  );
}