import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, Vote, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

// Award Show Bracket Component
const AwardShowBracket = () => {
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
    },
    {
      id: "best-director",
      title: "Best Director", 
      nominees: ["Christopher Nolan", "Martin Scorsese", "Yorgos Lanthimos", "Justine Triet"]
    }
  ];

  const handlePick = (categoryId: string, nominee: string) => {
    setSelectedPicks(prev => ({
      ...prev,
      [categoryId]: nominee
    }));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">2024 Academy Awards</h2>
        <p className="text-gray-600">Make your predictions for this year's biggest awards</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((category) => (
          <Card key={category.id} className="border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">{category.title}</CardTitle>
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
                  data-testid={`pick-${category.id}-${nominee}`}
                >
                  {nominee}
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4">
        <Button 
          className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3"
          disabled={Object.keys(selectedPicks).length !== categories.length}
          data-testid="submit-awards-predictions"
        >
          <Trophy size={20} className="mr-2" />
          Submit Predictions (50 pts)
        </Button>
      </div>
    </div>
  );
};

// Weekly Bracket Component  
const WeeklyBracket = () => {
  const [selectedPicks, setSelectedPicks] = useState<Record<string, string>>({});

  const weeklyPredictions = [
    {
      id: "box-office",
      title: "Weekend Box Office Champion",
      description: "Which movie will top the box office this weekend?",
      options: ["Dune: Part Two", "Madame Web", "Bob Marley: One Love", "Ordinary Angels"]
    },
    {
      id: "streaming",
      title: "Top Streaming Show",
      description: "Which show will be #1 on Netflix this week?",
      options: ["Avatar: The Last Airbender", "Griselda", "American Nightmare", "Nobody Wants This"]
    },
    {
      id: "music",
      title: "Billboard Hot 100 #1",
      description: "Which song will top the charts this week?",
      options: ["Flowers - Miley Cyrus", "Anti-Hero - Taylor Swift", "As It Was - Harry Styles", "Unholy - Sam Smith"]
    }
  ];

  const handlePick = (predictionId: string, option: string) => {
    setSelectedPicks(prev => ({
      ...prev,
      [predictionId]: option
    }));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Weekly Entertainment Predictions</h2>
        <p className="text-gray-600">Predict this week's entertainment winners</p>
      </div>

      <div className="space-y-6">
        {weeklyPredictions.map((prediction) => (
          <Card key={prediction.id} className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{prediction.title}</CardTitle>
              <p className="text-gray-600">{prediction.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prediction.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handlePick(prediction.id, option)}
                    className={`p-4 text-left rounded-lg border transition-all ${
                      selectedPicks[prediction.id] === option
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid={`pick-${prediction.id}-${option}`}
                  >
                    <div className="font-medium">{option}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4">
        <Button 
          className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3"
          disabled={Object.keys(selectedPicks).length !== weeklyPredictions.length}
          data-testid="submit-weekly-predictions"
        >
          <Calendar size={20} className="mr-2" />
          Submit Weekly Picks (25 pts)
        </Button>
      </div>
    </div>
  );
};

// Simple Vote Component
const SimpleVote = () => {
  const [selectedVote, setSelectedVote] = useState<string>("");

  const currentVote = {
    id: "best-netflix-2024",
    title: "Best Netflix Original of 2024",
    description: "Cast your vote for the best Netflix original series or movie released this year",
    options: [
      "Nobody Wants This",
      "Emily in Paris (Season 4)", 
      "The Lincoln Lawyer (Season 3)",
      "Monsters: The Lyle and Erik Menendez Story",
      "American Nightmare",
      "Avatar: The Last Airbender"
    ],
    pointsReward: 10
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentVote.title}</h2>
        <p className="text-gray-600">{currentVote.description}</p>
      </div>

      <Card className="border-gray-200 max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="space-y-3">
            {currentVote.options.map((option) => (
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
                  name="simple-vote"
                  value={option}
                  checked={selectedVote === option}
                  onChange={(e) => setSelectedVote(e.target.value)}
                  className="sr-only"
                  data-testid={`vote-${option}`}
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
                <span className="font-medium text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-4">
        <Button 
          className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white px-8 py-3"
          disabled={!selectedVote}
          data-testid="submit-simple-vote"
        >
          <Vote size={20} className="mr-2" />
          Cast Your Vote ({currentVote.pointsReward} pts)
        </Button>
      </div>
    </div>
  );
};

export default function PredictionsPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
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
            <h1 className="text-3xl font-semibold text-black mb-2">
              Predictions
            </h1>
            <p className="text-lg text-gray-600">
              Make predictions about awards, weekly winners, and entertainment trends to earn points!
            </p>
          </div>
        </div>

        {/* Prediction Tabs */}
        <Tabs defaultValue="awards" className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-8">
            <TabsTrigger value="awards" data-testid="tab-awards">Award Shows</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly</TabsTrigger>
            <TabsTrigger value="vote" data-testid="tab-vote">Quick Vote</TabsTrigger>
          </TabsList>

          <TabsContent value="awards" className="space-y-6">
            <AwardShowBracket />
          </TabsContent>

          <TabsContent value="weekly" className="space-y-6">
            <WeeklyBracket />
          </TabsContent>

          <TabsContent value="vote" className="space-y-6">
            <SimpleVote />
          </TabsContent>
        </Tabs>
      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />
    </div>
  );
}