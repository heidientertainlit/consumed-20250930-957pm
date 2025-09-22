import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, Vote, ArrowLeft, Clock, Users, Star } from "lucide-react";
import { Link } from "wouter";

interface PredictionGame {
  id: string;
  title: string;
  description: string;
  type: "awards" | "weekly" | "vote";
  pointsReward: number;
  deadline: string;
  participants: number;
  status: "open" | "locked" | "completed";
  category: string;
  image?: string;
}

// Sample prediction games data
const predictionGames: PredictionGame[] = [
  {
    id: "oscars-2024",
    title: "2024 Academy Awards",
    description: "Predict the winners across all major categories including Best Picture, Actor, Actress, and Director.",
    type: "awards",
    pointsReward: 50,
    deadline: "March 10, 2024",
    participants: 1247,
    status: "open",
    category: "Movies"
  },
  {
    id: "emmys-2024",
    title: "2024 Emmy Awards",
    description: "Pick the winners for Outstanding Drama Series, Comedy Series, and Lead Actor/Actress categories.",
    type: "awards", 
    pointsReward: 45,
    deadline: "September 15, 2024",
    participants: 892,
    status: "open",
    category: "TV"
  },
  {
    id: "box-office-weekend",
    title: "Weekend Box Office Champion",
    description: "Which movie will dominate the box office this weekend?",
    type: "weekly",
    pointsReward: 25,
    deadline: "Friday 11:59 PM",
    participants: 534,
    status: "open",
    category: "Movies"
  },
  {
    id: "streaming-weekly",
    title: "Top Streaming Show This Week",
    description: "Predict which show will be #1 on Netflix, Hulu, or Prime Video this week.",
    type: "weekly",
    pointsReward: 20,
    deadline: "Sunday 11:59 PM", 
    participants: 723,
    status: "open",
    category: "TV"
  },
  {
    id: "netflix-original-vote",
    title: "Best Netflix Original of 2024",
    description: "Vote for your favorite Netflix original series or movie released this year.",
    type: "vote",
    pointsReward: 10,
    deadline: "December 31, 2024",
    participants: 2156,
    status: "open",
    category: "Streaming"
  },
  {
    id: "golden-globes-2024",
    title: "2024 Golden Globe Awards",
    description: "Make your predictions for the Golden Globes across film and television categories.",
    type: "awards",
    pointsReward: 40,
    deadline: "January 7, 2024",
    participants: 967,
    status: "completed",
    category: "Awards"
  }
];

// Award Show Modal Component
const AwardShowModal = ({ game, isOpen, onClose }: { game: PredictionGame; isOpen: boolean; onClose: () => void }) => {
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{game.title}</DialogTitle>
          <p className="text-gray-600">{game.description}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {categories.map((category) => (
            <Card key={category.id} className="border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{category.title}</CardTitle>
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
                    {nominee}
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
            Submit Predictions ({game.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Weekly Prediction Modal Component
const WeeklyModal = ({ game, isOpen, onClose }: { game: PredictionGame; isOpen: boolean; onClose: () => void }) => {
  const [selectedPick, setSelectedPick] = useState<string>("");

  const options = game.id === "box-office-weekend" 
    ? ["Dune: Part Two", "Madame Web", "Bob Marley: One Love", "Ordinary Angels"]
    : ["Avatar: The Last Airbender", "Griselda", "American Nightmare", "Nobody Wants This"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{game.title}</DialogTitle>
          <p className="text-gray-600">{game.description}</p>
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
              <div className="font-medium">{option}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedPick}
          >
            Submit Prediction ({game.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Vote Modal Component
const VoteModal = ({ game, isOpen, onClose }: { game: PredictionGame; isOpen: boolean; onClose: () => void }) => {
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{game.title}</DialogTitle>
          <p className="text-gray-600">{game.description}</p>
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
            Cast Vote ({game.pointsReward} pts)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function PredictionsPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<PredictionGame | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "completed">("open");

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
      case "locked": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Locked</Badge>;
      case "completed": return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>;
      default: return null;
    }
  };

  const filteredGames = predictionGames.filter(game => 
    filterStatus === "all" || game.status === filterStatus
  );

  const handleGameClick = (game: PredictionGame) => {
    if (game.status === "open") {
      setSelectedGame(game);
    }
  };

  const renderModal = () => {
    if (!selectedGame) return null;

    switch (selectedGame.type) {
      case "awards":
        return <AwardShowModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />;
      case "weekly":
        return <WeeklyModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />;
      case "vote":
        return <VoteModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link href="/play">
            <Button variant="ghost" size="sm" className="mr-4" data-testid="back-to-play">
              <ArrowLeft size={20} className="mr-2" />
              Back to Play
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-gray-800 mb-2">
              Predictions
            </h1>
            <p className="text-lg text-gray-600">
              Join prediction games and earn points by making accurate predictions about entertainment!
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit mb-8">
          {[
            { key: "open", label: "Open Games" },
            { key: "all", label: "All Games" },
            { key: "completed", label: "Completed" }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterStatus(filter.key as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
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

        {/* Prediction Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map((game) => (
            <Card 
              key={game.id} 
              className={`border-gray-200 transition-all hover:shadow-md ${
                game.status === "open" ? "cursor-pointer hover:border-purple-300" : "opacity-75"
              }`}
              onClick={() => handleGameClick(game)}
              data-testid={`prediction-game-${game.id}`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(game.type)}
                    <Badge variant="outline" className="text-xs">{game.category}</Badge>
                  </div>
                  {getStatusBadge(game.status)}
                </div>
                <CardTitle className="text-lg font-semibold line-clamp-2">{game.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{game.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Deadline:</span>
                    <span className="font-medium text-gray-700 flex items-center">
                      <Clock size={14} className="mr-1" />
                      {game.deadline}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Participants:</span>
                    <span className="font-medium text-gray-700 flex items-center">
                      <Users size={14} className="mr-1" />
                      {game.participants.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Reward:</span>
                    <span className="font-bold text-purple-700">{game.pointsReward} points</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-12">
            <Trophy size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No prediction games found</h3>
            <p className="text-gray-600">Check back later for new prediction opportunities!</p>
          </div>
        )}
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