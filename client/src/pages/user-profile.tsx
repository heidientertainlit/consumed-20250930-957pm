import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ListShareModal from "@/components/list-share-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Star, Users, MessageCircle, Share, Play, BookOpen, Music, Film, Tv, Trophy, Heart, Plus, Settings, Calendar, TrendingUp, Clock, Headphones, Gamepad2, Sparkles, Brain, Share2, ChevronDown, ChevronUp, CornerUpRight, RefreshCw, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export default function UserProfile() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isDNAExpanded, setIsDNAExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedListForShare, setSelectedListForShare] = useState<{name: string, items: number, isPublic: boolean} | null>(null);
  const [isDNASurveyOpen, setIsDNASurveyOpen] = useState(false);
  
  // Entertainment DNA states
  const [dnaProfileStatus, setDnaProfileStatus] = useState<'no_profile' | 'has_profile' | 'generating'>('has_profile'); // Mock: user has profile
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  
  // Survey states
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<{ questionId: string; answer: string }[]>([]);

  // Survey questions data
  const surveyQuestions = [
    {
      id: "discovery",
      question: "How do you usually discover new entertainment?",
      options: [
        { value: "social", label: "Friends and social media recommendations" },
        { value: "algorithms", label: "Platform algorithms and trending lists" },
        { value: "critics", label: "Professional reviews and critic scores" },
        { value: "explore", label: "I love browsing and discovering randomly" }
      ]
    },
    {
      id: "consumption_style",
      question: "What's your ideal entertainment consumption style?",
      options: [
        { value: "binge", label: "Binge everything in marathon sessions" },
        { value: "scheduled", label: "Regular scheduled viewing/reading time" },
        { value: "mood", label: "Whatever matches my current mood" },
        { value: "social", label: "Only when I can share the experience with others" }
      ]
    },
    {
      id: "genre_preference",
      question: "Which best describes your genre approach?",
      options: [
        { value: "loyal", label: "I stick to genres I know I love" },
        { value: "adventurous", label: "I actively seek out new and different genres" },
        { value: "mood_based", label: "My genre choice depends entirely on my mood" },
        { value: "quality_first", label: "Genre doesn't matter if the quality is high" }
      ]
    },
    {
      id: "sharing_style",
      question: "How do you like to share your entertainment experiences?",
      options: [
        { value: "detailed_reviews", label: "Write detailed reviews and thoughtful analysis" },
        { value: "quick_ratings", label: "Quick ratings and short reactions" },
        { value: "recommendations", label: "Focus on recommending to specific people" },
        { value: "private", label: "Keep my entertainment experiences mostly private" }
      ]
    },
    {
      id: "completion_style",
      question: "What's your approach to finishing entertainment?",
      options: [
        { value: "completionist", label: "I finish everything I start, no matter what" },
        { value: "selective", label: "Life's too short for bad content - I drop things quickly" },
        { value: "comeback", label: "I take breaks but usually come back to finish later" },
        { value: "sampler", label: "I prefer trying many things rather than finishing everything" }
      ]
    },
    {
      id: "emotional_connection",
      question: "What creates the strongest emotional connection for you?",
      options: [
        { value: "characters", label: "Deep, complex characters I can relate to" },
        { value: "storytelling", label: "Masterful storytelling and plot construction" },
        { value: "world_building", label: "Rich, immersive worlds I can escape into" },
        { value: "themes", label: "Content that explores meaningful themes and ideas" }
      ]
    }
  ];

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };


  const handleShareList = (listName: string, itemCount: number, isPublic: boolean) => {
    setSelectedListForShare({ name: listName, items: itemCount, isPublic });
    setShareModalOpen(true);
  };

  // Entertainment DNA API Functions
  const submitSurveyResponses = async (responses: { questionId: string; answer: string }[]) => {
    const session = (window as any).session; // Get from auth context
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Submit each response individually to match edge function structure
    const results = [];
    for (const { questionId, answer } of responses) {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/dna-survey-responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_id: session.user?.id,
          question_id: questionId, 
          answer 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit survey response: ${response.statusText}`);
      }
      results.push(await response.json());
    }

    return results;
  };

  const generateDNAProfile = async () => {
    const session = (window as any).session; // Get from auth context
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-dna-profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate profile: ${response.statusText}`);
    }

    return response.json();
  };

  const fetchDNAProfile = async () => {
    const session = (window as any).session; // Get from auth context
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/dna-profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No profile exists
      }
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    return response.json();
  };

  const handleTakeDNASurvey = () => {
    setCurrentQuestion(0);
    setSurveyAnswers([]);
    setIsDNASurveyOpen(true);
  };

  // Survey navigation functions
  const handleSurveyAnswer = (value: string) => {
    const newAnswers = surveyAnswers.filter(a => a.questionId !== surveyQuestions[currentQuestion].id);
    newAnswers.push({
      questionId: surveyQuestions[currentQuestion].id,
      answer: value
    });
    setSurveyAnswers(newAnswers);
  };

  const handleSurveyNext = async () => {
    if (currentQuestion < surveyQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Survey complete - submit to edge functions
      try {
        await submitSurveyResponses(surveyAnswers);
        setIsDNASurveyOpen(false);
        await handleGenerateDNAProfile();
      } catch (error) {
        console.error('Failed to complete survey:', error);
      }
    }
  };

  const handleSurveyPrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const getCurrentSurveyAnswer = () => {
    return surveyAnswers.find(a => a.questionId === surveyQuestions[currentQuestion].id)?.answer;
  };

  const handleGenerateDNAProfile = async () => {
    setIsGeneratingProfile(true);
    setDnaProfileStatus('generating');
    
    try {
      await generateDNAProfile();
      console.log("DNA Profile generated successfully");
      setDnaProfileStatus('has_profile');
    } catch (error) {
      console.error("Failed to generate DNA profile:", error);
      setDnaProfileStatus('no_profile');
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleRetakeDNASurvey = () => {
    setDnaProfileStatus('no_profile');
  };

  const handleShareDNAProfile = () => {
    console.log("Sharing DNA Profile...");
    // Will implement sharing functionality
  };

  // Mock user data
  const user = {
    name: "Alex Thompson",
    username: "@alexthompson",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150&h=150&fit=crop&crop=face",
    followers: 1234,
    following: 567,
    fanPoints: 8945,
    joinedDate: "March 2023",
    bio: "",
    stats: {
      tracked: 342,
      reviews: 89,
      lists: 12,
      streak: 28
    },
    consumptionStats: {
      moviesWatched: 127,
      tvShowsWatched: 45,
      booksRead: 89,
      musicHours: 1247,
      podcastHours: 342,
      gamesPlayed: 23,
      totalHours: 1823,
      averageRating: 4.2,
      genreBreakdown: {
        action: 28,
        drama: 35,
        comedy: 42,
        scifi: 31,
        fantasy: 19,
        documentary: 15
      }
    },
    entertainmentDNA: {
      profileText: "You're a fearless discoverer of new entertainment experiences! Your DNA reveals someone who thrives on variety and surprise, seeking meaningful narratives with complex characters and layered storytelling. Quality over quantity defines your entertainment choices, and you approach content like an adventurous explorer - always pushing boundaries and seeking new experiences. You're the friend who introduces everyone to their next favorite obsession, combining intellectual curiosity with pure escapism in a way that makes every recommendation feel like a treasure map.",
      favoriteGenres: ["Science Fiction", "Drama", "Indie Films", "Literary Fiction"],
      favoriteMediaTypes: ["Movies", "Books", "TV Series", "Documentaries"],
      favoriteSports: ["Basketball", "Tennis"],
      mediaConsumptionStats: {
        primaryMediaType: "Movies",
        viewingStyle: "Binge Enthusiast", 
        discoveryMethod: "Friend Recommendations",
        socialAspect: "Loves discussing and sharing recommendations"
      },
      isPrivate: false
    }
  };

  const favoriteCreators = [
    { name: "Christopher Nolan", type: "Director", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face", points: 1250 },
    { name: "Taylor Jenkins Reid", type: "Author", avatar: "https://images.unsplash.com/photo-1494790108755-2616c6c46c06?w=50&h=50&fit=crop&crop=face", points: 890 },
    { name: "Phoebe Wallen-Bridge", type: "Writer", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face", points: 723 }
  ];

  const recentActivity = [
    {
      id: 1,
      type: "review",
      content: "Just finished 'Dune' and I'm absolutely blown away! The world-building is incredible.",
      media: "Dune",
      category: "books",
      rating: 5,
      timestamp: "3 hours ago"
    },
    {
      id: 2,
      type: "track",
      content: "Added to my 'Sci-Fi Must Reads' list",
      media: "Project Hail Mary",
      category: "books",
      timestamp: "1 day ago"
    },
    {
      id: 3,
      type: "review",
      content: "Nolan does it again with Oppenheimer. The cinematography is stunning.",
      media: "Oppenheimer",
      category: "movies",
      rating: 4,
      timestamp: "3 days ago"
    }
  ];

  const currentlyConsuming = [
    {
      title: "The Seven Moons of Maali Almeida",
      type: "Book",
      progress: 68,
      artwork: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop"
    },
    {
      title: "The Bear Season 3",
      type: "TV Show",
      progress: 40,
      artwork: "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=80&h=80&fit=crop"
    },
    {
      title: "Folklore",
      type: "Album",
      progress: 90,
      artwork: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop"
    }
  ];

  const topLists = [
    { name: "Sci-Fi Must Reads", items: 28, public: true, likes: 145 },
    { name: "Comfort Movies", items: 15, public: true, likes: 89 },
    { name: "Workout Playlists", items: 42, public: false, likes: 0 },
    { name: "Oscar Winners 2024", items: 8, public: true, likes: 67 }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="relative px-4 pb-6 pt-6">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-6">
            {/* Avatar */}
            <div className="relative">
              <img 
                src={user.avatar}
                alt={user.name}
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
              />
            </div>

            {/* Profile Info */}
            <div className="mt-4 md:mt-0 flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-black mb-1">{user.name}</h1>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-gray-600">{user.username}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">Joined {user.joinedDate}</span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users size={16} />
                      <span>{user.followers.toLocaleString()} followers</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>{user.following} following</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy size={16} />
                      <span>{user.fanPoints.toLocaleString()} fan points</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 mt-4 md:mt-0">
                  <Button variant="outline" className="border-gray-300">
                    <Settings size={16} className="mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-6">
            <p className="text-gray-700 leading-relaxed">{user.bio}</p>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(user.stats).map(([key, value]) => (
              <div key={key} className="text-center p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-600 capitalize">{key}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Entertainment DNA */}
        <div className="px-4 mb-8">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <Sparkles className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-purple-800 to-indigo-900 bg-clip-text text-transparent">
                    Your Entertainment DNA
                  </h2>
                  {dnaProfileStatus === 'has_profile' && (
                    <p className="text-sm text-gray-600">Your Entertainment Personality</p>
                  )}
                  {dnaProfileStatus === 'no_profile' && (
                    <p className="text-sm text-gray-600">Discover your unique entertainment personality</p>
                  )}
                  {dnaProfileStatus === 'generating' && (
                    <p className="text-sm text-gray-600">Analyzing your entertainment preferences...</p>
                  )}
                </div>
              </div>
              
              {/* Action Buttons based on status */}
              <div className="flex items-center space-x-2">
                {dnaProfileStatus === 'no_profile' && (
                  <Button 
                    size="sm"
                    onClick={handleTakeDNASurvey}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                    data-testid="button-take-dna-survey"
                  >
                    <Brain size={14} className="mr-2" />
                    Take DNA Survey
                  </Button>
                )}
                
                {dnaProfileStatus === 'generating' && (
                  <Button 
                    size="sm"
                    disabled
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white opacity-75"
                  >
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Generating...
                  </Button>
                )}
                
                {dnaProfileStatus === 'has_profile' && (
                  <>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={handleRetakeDNASurvey}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      data-testid="button-retake-dna-survey"
                    >
                      <RefreshCw size={14} className="mr-2" />
                      Retake
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleShareDNAProfile}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      data-testid="button-share-dna"
                    >
                      <Share2 size={14} className="mr-2" />
                      Share
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Conditional Content based on status */}
            {dnaProfileStatus === 'no_profile' && (
              <div className="bg-white rounded-xl p-6 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Brain className="text-white" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Discover Your Entertainment DNA
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    Take our comprehensive survey to unlock your unique entertainment personality profile. 
                    Get personalized recommendations and connect with others who share your taste.
                  </p>
                </div>
                <Button 
                  onClick={handleTakeDNASurvey}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8"
                  data-testid="button-start-dna-survey"
                >
                  <Brain size={16} className="mr-2" />
                  Start DNA Survey
                </Button>
                <p className="text-xs text-gray-500 mt-3">Takes about 5 minutes</p>
              </div>
            )}

            {dnaProfileStatus === 'generating' && (
              <div className="bg-white rounded-xl p-6 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="text-white animate-spin" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Generating Your DNA Profile
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                    Our AI is analyzing your entertainment preferences and creating your unique personality profile...
                  </p>
                  <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">This usually takes 30-60 seconds</p>
                </div>
              </div>
            )}

            {dnaProfileStatus === 'has_profile' && (
              <div className="bg-white rounded-xl p-6">
                {/* Full AI-Generated Description */}
                <div className="mb-6">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {user.entertainmentDNA.profileText}
                  </p>
                </div>

                {/* Favorite Genres */}
                <div className="mb-6">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Your Favorite Genres</h5>
                  <div className="flex flex-wrap gap-2">
                    {user.entertainmentDNA.favoriteGenres.map((genre, index) => (
                      <Badge key={index} className="bg-purple-100 text-purple-700 text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Favorite Media Types */}
                <div className="mb-6">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Your Favorite Media Types</h5>
                  <div className="flex flex-wrap gap-2">
                    {user.entertainmentDNA.favoriteMediaTypes.map((type, index) => (
                      <Badge key={index} className="bg-indigo-100 text-indigo-700 text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Expandable Details Section */}
                {isDNAExpanded && (
                  <div className="border-t border-gray-200 pt-6 mt-6 space-y-4">
                    {/* Media Consumption Stats */}
                    <div>
                      <h5 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                        <Brain className="mr-2 text-indigo-600" size={18} />
                        Your Entertainment Style
                      </h5>
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                        <div className="space-y-2">
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Primary Media:</span> {user.entertainmentDNA.mediaConsumptionStats.primaryMediaType}
                          </p>
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Viewing Style:</span> {user.entertainmentDNA.mediaConsumptionStats.viewingStyle}
                          </p>
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Discovery Method:</span> {user.entertainmentDNA.mediaConsumptionStats.discoveryMethod}
                          </p>
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Social Aspect:</span> {user.entertainmentDNA.mediaConsumptionStats.socialAspect}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Favorite Sports */}
                    {user.entertainmentDNA.favoriteSports && user.entertainmentDNA.favoriteSports.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2">Favorite Sports</h5>
                        <div className="flex flex-wrap gap-2">
                          {user.entertainmentDNA.favoriteSports.map((sport, index) => (
                            <Badge key={index} className="bg-green-100 text-green-700 text-xs">
                              {sport}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show More/Less Button */}
                <button
                  onClick={() => setIsDNAExpanded(!isDNAExpanded)}
                  className="flex items-center justify-center space-x-2 w-full mt-4 py-3 text-sm text-purple-700 hover:text-purple-800 transition-colors border-t border-gray-200"
                  data-testid="button-expand-dna"
                >
                  <span>{isDNAExpanded ? 'Hide Details' : 'See What This Means For You'}</span>
                  {isDNAExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            )}
          </div>
        </div>


        {/* Creators with Similar DNA */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Creators with Similar DNA</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "Christopher Nolan", type: "Director", match: "94%", avatar: "🎬" },
                { name: "Denis Villeneuve", type: "Director", match: "89%", avatar: "🎭" },
                { name: "Andy Weir", type: "Author", match: "87%", avatar: "📚" },
                { name: "Rian Johnson", type: "Director", match: "85%", avatar: "🎪" }
              ].map((creator, index) => (
                <div key={index} className="text-center p-3 bg-gray-50 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer">
                  <div className="text-2xl mb-1">{creator.avatar}</div>
                  <div className="font-medium text-gray-900 text-sm">{creator.name}</div>
                  <div className="text-xs text-gray-500 mb-1">{creator.type}</div>
                  <div className="text-xs font-semibold text-purple-600">{creator.match} match</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Simplified Stats */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Stats</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-700">{user.consumptionStats.moviesWatched}</div>
                <div className="text-xs text-gray-600">Movies</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-pink-600">{user.consumptionStats.tvShowsWatched}</div>
                <div className="text-xs text-gray-600">TV Shows</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-600">{user.consumptionStats.booksRead}</div>
                <div className="text-xs text-gray-600">Books</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{user.consumptionStats.musicHours}h</div>
                <div className="text-xs text-gray-600">Music</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{user.consumptionStats.podcastHours}h</div>
                <div className="text-xs text-gray-600">Podcasts</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{user.consumptionStats.gamesPlayed}</div>
                <div className="text-xs text-gray-600">Games</div>
              </div>
            </div>

            <div className="flex justify-around border-t border-gray-200 pt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{user.consumptionStats.totalHours.toLocaleString()}h</div>
                <div className="text-xs text-gray-600">Total Hours</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{user.consumptionStats.averageRating}</div>
                <div className="text-xs text-gray-600">Avg Rating</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{user.stats.streak}</div>
                <div className="text-xs text-gray-600">Day Streak</div>
              </div>
            </div>
          </div>
        </div>

        {/* Currently Consuming */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Currently Consuming</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentlyConsuming.map((item, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start space-x-4">
                  <img src={item.artwork} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{item.type}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-700 h-2 rounded-full" 
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.progress}% complete</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Favorite Creators */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Favorite Creators</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="space-y-4">
              {favoriteCreators.map((creator, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img 
                      src={creator.avatar}
                      alt={creator.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">{creator.name}</div>
                      <div className="text-sm text-gray-600">{creator.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-700">{creator.points}</div>
                    <div className="text-xs text-gray-500">fan pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Lists */}
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Lists</h2>
            <Button variant="outline" size="sm">
              <Plus size={16} className="mr-2" />
              Create List
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topLists.map((list, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{list.name}</h4>
                  <div className="flex items-center space-x-2">
                    <Badge variant={list.public ? "default" : "secondary"}>
                      {list.public ? "Public" : "Private"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShareList(list.name, list.items, list.public)}
                      className="text-gray-700 hover:text-purple-600 hover:bg-purple-50 p-1"
                      data-testid={`share-list-${list.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <CornerUpRight size={16} />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{list.items} items</span>
                  {list.public && (
                    <div className="flex items-center space-x-1">
                      <Heart size={14} />
                      <span>{list.likes} likes</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Media History */}
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Media History</h2>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option>All Media</option>
              <option>Movies</option>
              <option>TV Shows</option>
              <option>Books</option>
              <option>Music</option>
              <option>Podcasts</option>
              <option>Games</option>
            </select>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="divide-y divide-gray-100">
              <div className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                <img 
                  src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=60&h=60&fit=crop"
                  alt="Dune"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">Dune</h4>
                  <p className="text-sm text-gray-600">Book by Frank Herbert</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className={i < 5 ? "text-yellow-400 fill-current" : "text-gray-300"} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Jan 15, 2024</p>
                </div>
              </div>

              <div className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                <img 
                  src="https://images.unsplash.com/photo-1489599314-aed0e9803726?w=60&h=60&fit=crop"
                  alt="Oppenheimer"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">Oppenheimer</h4>
                  <p className="text-sm text-gray-600">Movie by Christopher Nolan</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className={i < 4 ? "text-yellow-400 fill-current" : "text-gray-300"} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Jan 12, 2024</p>
                </div>
              </div>

              <div className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                <img 
                  src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop"
                  alt="Folklore"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">Folklore</h4>
                  <p className="text-sm text-gray-600">Album by Taylor Swift</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className={i < 5 ? "text-yellow-400 fill-current" : "text-gray-300"} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Jan 10, 2024</p>
                </div>
              </div>

              <div className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                <img 
                  src="https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=60&h=60&fit=crop"
                  alt="The Bear"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">The Bear</h4>
                  <p className="text-sm text-gray-600">TV Show by Christopher Storer</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className={i < 4 ? "text-yellow-400 fill-current" : "text-gray-300"} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Jan 8, 2024</p>
                </div>
              </div>

              <div className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                <img 
                  src="https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=60&h=60&fit=crop"
                  alt="SmartLess"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">SmartLess</h4>
                  <p className="text-sm text-gray-600">Podcast by Jason Bateman</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className={i < 5 ? "text-yellow-400 fill-current" : "text-gray-300"} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Jan 5, 2024</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 text-center">
              <Button variant="outline" className="text-sm">
                Load More History
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  <img 
                    src={user.avatar}
                    alt={user.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900">{user.name}</span>
                      <Badge variant="secondary">
                        {activity.type === "review" ? "Review" : "Added"}
                      </Badge>
                      <span className="text-sm text-gray-500">{activity.timestamp}</span>
                    </div>
                    <p className="text-gray-800 mb-2">{activity.content}</p>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {activity.category === "books" && <BookOpen className="text-purple-700" size={16} />}
                        {activity.category === "movies" && <Film className="text-purple-700" size={16} />}
                        {activity.category === "music" && <Music className="text-purple-700" size={16} />}
                        <span className="font-medium text-gray-900">{activity.media}</span>
                      </div>
                      {activity.rating && (
                        <div className="flex items-center space-x-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={14} 
                              className={i < activity.rating ? "text-yellow-400 fill-current" : "text-gray-300"}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
          listType="custom"
        />
      )}

      {/* Entertainment DNA Survey Modal */}
      {isDNASurveyOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="text-white" size={32} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Entertainment DNA Survey</h1>
                <p className="text-gray-600 text-lg">
                  Let's understand how you consume entertainment so we can personalize your experience
                </p>
              </div>

              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Question {currentQuestion + 1} of {surveyQuestions.length}</span>
                  <span>{Math.round(((currentQuestion + 1) / surveyQuestions.length) * 100)}% complete</span>
                </div>
                <Progress value={((currentQuestion + 1) / surveyQuestions.length) * 100} className="h-3" />
              </div>

              {/* Question */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6 leading-relaxed">
                  {surveyQuestions[currentQuestion].question}
                </h2>

                <RadioGroup 
                  value={getCurrentSurveyAnswer() || ""} 
                  onValueChange={handleSurveyAnswer}
                  className="space-y-4"
                >
                  {surveyQuestions[currentQuestion].options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label 
                        htmlFor={option.value} 
                        className="text-gray-700 text-base leading-relaxed cursor-pointer flex-1"
                        data-testid={`option-${option.value}`}
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <Button
                  onClick={handleSurveyPrevious}
                  disabled={currentQuestion === 0}
                  variant="outline"
                  className="flex items-center space-x-2 disabled:opacity-50"
                  data-testid="previous-question-button"
                >
                  <ChevronLeft size={20} />
                  <span>Previous</span>
                </Button>

                <Button
                  onClick={() => setIsDNASurveyOpen(false)}
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700"
                  data-testid="close-survey-button"
                >
                  Close
                </Button>

                <Button
                  onClick={handleSurveyNext}
                  disabled={!getCurrentSurveyAnswer()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center space-x-2 px-8 py-3 disabled:opacity-50"
                  data-testid="next-question-button"
                >
                  <span>{currentQuestion === surveyQuestions.length - 1 ? "Generate My DNA" : "Next"}</span>
                  {currentQuestion === surveyQuestions.length - 1 ? (
                    <Sparkles size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}