import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ListShareModal from "@/components/list-share-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star, User, Users, MessageCircle, Share, Play, BookOpen, Music, Film, Tv, Trophy, Heart, Plus, Settings, Calendar, TrendingUp, Clock, Headphones, Gamepad2, Sparkles, Brain, Share2, ChevronDown, ChevronUp, CornerUpRight, RefreshCw, Loader2, ChevronLeft, ChevronRight, List, Search, X } from "lucide-react";
import { AuthModal } from "@/components/auth";

export default function UserProfile() {
  const { user, session, loading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isDNAExpanded, setIsDNAExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedListForShare, setSelectedListForShare] = useState<{name: string, items: number, isPublic: boolean} | null>(null);
  const [isDNASurveyOpen, setIsDNASurveyOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false); // Added state for highlight modal

  // Entertainment DNA states
  const [dnaProfileStatus, setDnaProfileStatus] = useState<'no_profile' | 'has_profile' | 'generating'>('no_profile');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [dnaProfile, setDnaProfile] = useState<any>(null);

  // Survey states
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<{ questionId: string; answer: string | string[] }[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // User lists states
  const [userLists, setUserLists] = useState<any[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // User stats states
  const [userStats, setUserStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Media History filters
  const [mediaHistorySearch, setMediaHistorySearch] = useState("");
  const [mediaHistoryYear, setMediaHistoryYear] = useState("all");
  const [mediaHistoryMonth, setMediaHistoryMonth] = useState("all");
  const [mediaHistoryType, setMediaHistoryType] = useState("all");

  // Highlights state
  const [highlights, setHighlights] = useState<any[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);

  // Media search states for highlights
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["All Media"]);

  // Categories for media search
  const categories = ["All Media", "Movies", "TV Shows", "Books", "Music", "Podcasts", "Games", "Sports", "YouTube"];

  // Search mutation using React Query pattern
  const searchMutation = {
    isPending: false,
    mutate: async () => {
      // Search functionality will be implemented
    }
  };

  // Perform search function
  const performSearch = async () => {
    if (!searchQuery.trim() || !session?.access_token) return;

    try {
      setSearchResults([]);
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          type: selectedCategories.includes("All Media") ? null : 
                selectedCategories.includes("Movies") ? "movie" :
                selectedCategories.includes("TV Shows") ? "tv" :
                selectedCategories.includes("Books") ? "book" :
                selectedCategories.includes("Music") ? "music" :
                selectedCategories.includes("Podcasts") ? "podcast" :
                selectedCategories.includes("Games") ? "game" :
                selectedCategories.includes("Sports") ? "sports" :
                selectedCategories.includes("YouTube") ? "youtube" : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        console.error('Search failed:', response.status);
        toast({
          title: "Search Failed",
          description: "Unable to search for media. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Fetch DNA profile and user lists when authenticated
  useEffect(() => {
    if (session?.access_token) {
      fetchDnaProfile();
      fetchUserLists();
      fetchUserStats();
      // fetchHighlights(); // Uncomment when fetchHighlights is implemented
    }
  }, [session?.access_token]);

  // Fetch user lists from Supabase edge function
  const fetchUserLists = async () => {
    if (!session?.access_token) return;

    setIsLoadingLists(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Show ONLY the system default lists (exclude "All" but include the 4 main ones)
        const systemLists = data.lists?.filter((list: any) => 
          list.id !== 'all' && 
          ['Currently', 'Queue', 'Finished', 'Did Not Finish'].includes(list.title)
        ) || [];
        setUserLists(systemLists);
        console.log('User lists loaded:', systemLists);
      } else {
        console.error('Failed to fetch user lists');
        setUserLists([]);
      }
    } catch (error) {
      console.error('Error fetching user lists:', error);
      setUserLists([]);
    } finally {
      setIsLoadingLists(false);
    }
  };

  // Fetch user stats from Supabase edge function
  const fetchUserStats = async () => {
    if (!session?.access_token) return;

    setIsLoadingStats(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
        console.log('User stats loaded:', data.stats);
      } else {
        console.error('Failed to fetch user stats');
        setUserStats(null);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setUserStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch survey questions from database
  const fetchSurveyQuestions = async () => {
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/rest/v1/edna_questions?select=*', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const questions = await response.json();
        setSurveyQuestions(questions);
        return true;
      } else {
        console.error('Failed to fetch survey questions');
        return false;
      }
    } catch (error) {
      console.error('Error fetching survey questions:', error);
      return false;
    }
  };

  // Fetch DNA profile from database
  const fetchDnaProfile = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/rest/v1/dna_profiles?select=*', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const profiles = await response.json();
        if (profiles && profiles.length > 0) {
          const profile = profiles[0];
          setDnaProfile(profile);
          setDnaProfileStatus('has_profile');
          console.log('DNA profile loaded:', profile);
        } else {
          setDnaProfileStatus('no_profile');
        }
      }
    } catch (error) {
      console.error('Failed to fetch DNA profile:', error);
      setDnaProfileStatus('no_profile');
    }
  };

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };


  const handleShareList = (listName: string, itemCount: number, isPublic: boolean) => {
    setSelectedListForShare({ name: listName, items: itemCount, isPublic });
    setShareModalOpen(true);
  };

  // Exact same working pattern as prediction invites  
  const handleShareListDirect = async (listId: string, listTitle: string) => {
    // Add user ID to shared URL so anyone can see your real data
    const shareUrl = session?.user?.id 
      ? `${window.location.origin}/list/${listTitle.toLowerCase().replace(/\s+/g, '-')}?user=${session.user.id}`
      : `${window.location.origin}/list/${listTitle.toLowerCase().replace(/\s+/g, '-')}`;

    const shareData = {
      title: `Check out my ${listTitle} list on consumed!`,
      text: `I'm tracking my ${listTitle} - want to see what I'm consuming? Check it out and share yours too! 🎬🎵📚`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast({
          title: "List Link Copied!",
          description: "Share this with your friends to show your entertainment list",
        });
      }
    } catch (error) {
      console.error('Error sharing list:', error);
      toast({
        title: "Share Failed",
        description: "Unable to create share link",
        variant: "destructive"
      });
    }
  };

  const handleCreateList = () => {
    // For now, show a toast - this can be expanded to open a create list modal
    toast({
      title: "Create List",
      description: "List creation feature coming soon!",
    });
  };

  const handleListClick = (listName: string) => {
    const listId = listName.toLowerCase().replace(/\s+/g, '-');
    setLocation(`/list/${listId}`);
  };

  // Entertainment DNA API Functions
  const submitSurveyResponses = async (responses: { questionId: string; answer: string }[]) => {

    console.log('Auth session check:', { hasSession: !!session, hasToken: !!session?.access_token });
    console.log('Session details:', session ? { user: session.user?.id, token_length: session.access_token?.length } : 'No session');

    if (!session?.access_token) {
      console.log('No authentication token - using mock submission for now');
      // For now, mock the submission and proceed with profile generation
      return responses.map(r => ({ success: true, questionId: r.questionId, answer: r.answer }));
    }

    // Submit each response individually to match edge function structure
    const results = [];
    for (const { questionId, answer } of responses) {
      try {
        console.log(`Submitting to edge function for question ${questionId}:`, { questionId, answer: answer.substring(0, 50) + '...' });

        const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/dna-survey-responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            user_id: session.user?.id,
            question_id: questionId, 
            answer_text: answer 
          }),
        });

        console.log(`Edge function response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Edge function error ${response.status}:`, errorText);
          throw new Error(`Failed to submit survey response: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const responseData = await response.json();
        console.log('Edge function success:', responseData);
        results.push(responseData);
      } catch (error) {
        console.error(`Error submitting response for question ${questionId}:`, error);
        throw error;
      }
    }

    return results;
  };

  const generateDNAProfile = async () => {

    console.log('Generating DNA profile...');

    if (!session?.access_token) {
      console.log('No authentication token - using mock profile generation');
      // Mock DNA profile generation for now
      return {
        success: true,
        profile: {
          id: 'mock-profile-123',
          profile_text: 'Based on your responses, you are an Entertainment Explorer! You love discovering new content through recommendations and enjoy diverse genres. Your entertainment choices are driven by emotional connection and you actively engage in discussions about what you consume.',
          favorite_genres: ['Action', 'Comedy', 'Drama'],
          personality_type: 'Explorer',
          created_at: new Date().toISOString()
        }
      };
    }

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-dna-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.JSON.stringify({ user_id: session.user?.id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DNA generation failed ${response.status}:`, errorText);
        throw new Error(`Failed to generate profile: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error generating DNA profile:', error);
      throw error;
    }
  };

  const fetchDNAProfile = async () => {
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

  const handleTakeDNASurvey = async () => {
    // Check if user is authenticated
    if (!user || !session) {
      setIsAuthModalOpen(true);
      return;
    }

    setCurrentQuestion(0);
    setSurveyAnswers([]);
    setIsLoadingQuestions(true);
    setIsDNASurveyOpen(true); // Open modal first to show loading

    const success = await fetchSurveyQuestions();
    setIsLoadingQuestions(false);

    if (!success) {
      setIsDNASurveyOpen(false); // Close if failed to load
    }
  };

  // Survey navigation functions
  const handleSurveyAnswer = (value: string | string[]) => {
    const currentQ = surveyQuestions[currentQuestion];
    if (!currentQ) return;

    const newAnswers = surveyAnswers.filter(a => a.questionId !== currentQ.id);
    newAnswers.push({
      questionId: currentQ.id,
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
        console.log('Survey completed with answers:', surveyAnswers);

        // Convert answers to the format expected by edge functions
        const formattedAnswers = surveyAnswers.map(answer => ({
          questionId: answer.questionId,
          answer: Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer
        }));

        console.log('Formatted answers for submission:', formattedAnswers);

        await submitSurveyResponses(formattedAnswers);
        setIsDNASurveyOpen(false);
        await handleGenerateDNAProfile();
      } catch (error) {
        console.error('Failed to complete survey:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Survey submission failed: ${error.message || 'Unknown error'}. Please try again.`);
      }
    }
  };

  const handleSurveyPrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const getCurrentSurveyAnswer = () => {
    const currentQ = surveyQuestions[currentQuestion];
    if (!currentQ) return undefined;
    return surveyAnswers.find(a => a.questionId === currentQ.id)?.answer;
  };

  const handleGenerateDNAProfile = async () => {
    // Check if user is authenticated
    if (!user || !session) {
      setIsAuthModalOpen(true);
      return;
    }

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

  // Mock mockUserData data for display
  const mockUserData = {
    name: "Alex Thompson",
    mockUserDataname: "@alexthompson",
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

  // Get currently consuming items from the "Currently" list
  const currentlyList = userLists.find(list => list.title === 'Currently');
  const currentlyConsuming = currentlyList?.items || [];

  // Aggregate all media items from all lists for media history
  const getAllMediaItems = () => {
    const allItems: any[] = [];
    userLists.forEach(list => {
      if (list.items) {
        list.items.forEach((item: any) => {
          allItems.push({
            ...item,
            listName: list.title
          });
        });
      }
    });
    // Sort by created_at descending (newest first)
    return allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Filter media history based on search and filters
  const getFilteredMediaHistory = () => {
    const allItems = getAllMediaItems();

    return allItems.filter(item => {
      // Search filter
      if (mediaHistorySearch.trim()) {
        const searchLower = mediaHistorySearch.toLowerCase();
        const matchesSearch = 
          item.title?.toLowerCase().includes(searchLower) ||
          item.creator?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Media type filter
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

      // Year filter
      if (mediaHistoryYear !== 'all') {
        const itemYear = new Date(item.created_at).getFullYear();
        if (itemYear.toString() !== mediaHistoryYear) return false;
      }

      // Month filter
      if (mediaHistoryMonth !== 'all') {
        const itemMonth = new Date(item.created_at).getMonth();
        const monthNumber = parseInt(mediaHistoryMonth);
        if (itemMonth !== monthNumber) return false;
      }

      return true;
    });
  };

  // Get media type counts for summary display
  const getMediaTypeCounts = () => {
    const allItems = getAllMediaItems();
    const counts: any = {
      movie: 0,
      tv: 0,
      book: 0,
      music: 0,
      podcast: 0,
      game: 0
    };

    allItems.forEach(item => {
      if (counts.hasOwnProperty(item.media_type)) {
        counts[item.media_type]++;
      }
    });

    return counts;
  };

  const mediaTypeCounts = getMediaTypeCounts();
  const filteredMediaHistory = getFilteredMediaHistory();

  // Generate years and months for filter dropdowns
  const getAvailableYears = () => {
    const allItems = getAllMediaItems();
    const years = new Set(allItems.map(item => new Date(item.created_at).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  };

  const availableYears = getAvailableYears();


  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="relative px-4 pb-6 pt-6">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 bg-gray-200 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <User size={48} className="text-gray-600" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="mt-4 md:mt-0 flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-black mb-1">{mockUserData.name}</h1>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-gray-600">{mockUserData.mockUserDataname}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">Joined {mockUserData.joinedDate}</span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users size={16} />
                      <span>{mockUserData.followers.toLocaleString()} followers</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>{mockUserData.following} following</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy size={16} />
                      <span>{mockUserData.fanPoints.toLocaleString()} fan points</span>
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
            <p className="text-gray-700 leading-relaxed">{mockUserData.bio}</p>
          </div>

          {/* Your Stats */}
          <div className="mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Your Stats</h3>
            {isLoadingStats ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                  <span className="ml-2 text-gray-600">Loading your stats...</span>
                </div>
              </div>
            ) : userStats ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-700">{userStats.moviesWatched}</div>
                    <div className="text-xs text-gray-600">Movies</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-pink-600">{userStats.tvShowsWatched}</div>
                    <div className="text-xs text-gray-600">TV Shows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-cyan-600">{userStats.booksRead}</div>
                    <div className="text-xs text-gray-600">Books</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{userStats.musicHours}h</div>
                    <div className="text-xs text-gray-600">Music</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{userStats.podcastHours}h</div>
                    <div className="text-xs text-gray-600">Podcasts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">{userStats.gamesPlayed}</div>
                    <div className="text-xs text-gray-600">Games</div>
                  </div>
                </div>

                <div className="flex justify-around border-t border-gray-200 pt-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{userStats.totalHours}h</div>
                    <div className="text-xs text-gray-600">Total Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{userStats.averageRating}</div>
                    <div className="text-xs text-gray-600">Avg Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{userStats.dayStreak}</div>
                    <div className="text-xs text-gray-600">Day Streak</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="text-center text-gray-600">
                  <p>No stats available yet. Start tracking media to see your stats!</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Highlights Section */}
        <div className="px-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Highlights</h2>
                <p className="text-xs text-gray-600">Share what you're loving or have loved recently</p>
              </div>
              <Button
                onClick={() => setIsHighlightModalOpen(true)}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>

            {highlights.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Star className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Add Your First Highlight</h3>
                <p className="text-xs text-gray-600 mb-4 max-w-xs mx-auto">
                  Share what you're loving - a show, book, song, or anything!
                </p>
                <Button
                  onClick={() => setIsHighlightModalOpen(true)}
                  size="sm"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Highlight
                </Button>
              </div>
            ) : (
              // Render highlights in a compact 3-column grid
              <div className="grid grid-cols-3 gap-3">
                {highlights.slice(0, 3).map((highlight, index) => (
                  <div key={index} className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-100 text-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Star className="text-purple-600" size={16} />
                    </div>
                    <h4 className="font-medium text-gray-900 text-xs truncate">{highlight.title}</h4>
                    <p className="text-xs text-gray-600 mt-1 truncate">{highlight.creator || highlight.type}</p>
                  </div>
                ))}
              </div>
            )}
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
                    {dnaProfile?.profile_text || "Your personalized Entertainment DNA profile will appear here."}
                  </p>
                </div>

                {/* Favorite Genres */}
                <div className="mb-6">
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Your Favorite Genres</h5>
                  <div className="flex flex-wrap gap-2">
                    {(dnaProfile?.favorite_genres || []).map((genre, index) => (
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
                    {(dnaProfile?.favorite_media_types || []).map((type, index) => (
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
                            <span className="font-medium">Primary Media:</span> {mockUserData.entertainmentDNA.mediaConsumptionStats.primaryMediaType}
                          </p>
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Viewing Style:</span> {mockUserData.entertainmentDNA.mediaConsumptionStats.viewingStyle}
                          </p>
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Discovery Method:</span> {mockUserData.entertainmentDNA.mediaConsumptionStats.discoveryMethod}
                          </p>
                          <p className="text-sm text-indigo-800">
                            <span className="font-medium">Social Aspect:</span> {mockUserData.entertainmentDNA.mediaConsumptionStats.socialAspect}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Favorite Sports */}
                    {mockUserData.entertainmentDNA.favoriteSports && mockUserData.entertainmentDNA.favoriteSports.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2">Favorite Sports</h5>
                        <div className="flex flex-wrap gap-2">
                          {mockUserData.entertainmentDNA.favoriteSports.map((sport, index) => (
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





        {/* Currently Consuming */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Currently Consuming</h2>
          {isLoadingLists ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
              <p className="text-gray-600 mt-2">Loading your current media...</p>
            </div>
          ) : currentlyConsuming.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentlyConsuming.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start space-x-4">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.title} 
                        className="w-16 h-16 rounded-lg object-cover" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                        <span className="text-2xl">
                          {item.media_type === 'movie' ? '🎬' : 
                           item.media_type === 'tv' ? '📺' : 
                           item.media_type === 'book' ? '📚' : 
                           item.media_type === 'music' ? '🎵' : 
                           item.media_type === 'podcast' ? '🎧' : 
                           item.media_type === 'game' ? '🎮' : '🎭'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-600 mb-1">
                        {item.media_type === 'tv' ? 'TV Show' : 
                         item.media_type === 'movie' ? 'Movie' : 
                         item.media_type === 'book' ? 'Book' : 
                         item.media_type === 'music' ? 'Music' : 
                         item.media_type === 'podcast' ? 'Podcast' : 
                         item.media_type === 'game' ? 'Game' : item.type}
                      </p>
                      {item.creator && (
                        <p className="text-xs text-gray-500">by {item.creator}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-600 mt-2 italic">"{item.notes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📺</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nothing Currently Consuming</h3>
              <p className="text-gray-600 mb-4">Start tracking what you're watching, reading, or listening to</p>
              <Button 
                onClick={handleTrackConsumption}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-start-tracking"
              >
                <Plus size={16} className="mr-2" />
                Track Media
              </Button>
            </div>
          )}
        </div>

        {/* Favorite Creators */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Favorite Creators</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="space-y-4">
              {favoriteCreators.map((creator, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={24} className="text-gray-600" />
                    </div>
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


        {/* Media History */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Media History</h2>

          {/* Search Bar */}
          <div className="mb-4">
            <Input
              value={mediaHistorySearch}
              onChange={(e) => setMediaHistorySearch(e.target.value)}
              placeholder="Search your media history..."
              className="w-full"
              data-testid="input-media-history-search"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Select value={mediaHistoryYear} onValueChange={setMediaHistoryYear}>
              <SelectTrigger data-testid="select-year-filter">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={mediaHistoryMonth} onValueChange={setMediaHistoryMonth}>
              <SelectTrigger data-testid="select-month-filter">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                <SelectItem value="0">January</SelectItem>
                <SelectItem value="1">February</SelectItem>
                <SelectItem value="2">March</SelectItem>
                <SelectItem value="3">April</SelectItem>
                <SelectItem value="4">May</SelectItem>
                <SelectItem value="5">June</SelectItem>
                <SelectItem value="6">July</SelectItem>
                <SelectItem value="7">August</SelectItem>
                <SelectItem value="8">September</SelectItem>
                <SelectItem value="9">October</SelectItem>
                <SelectItem value="10">November</SelectItem>
                <SelectItem value="11">December</SelectItem>
              </SelectContent>
            </Select>

            <Select value={mediaHistoryType} onValueChange={setMediaHistoryType}>
              <SelectTrigger data-testid="select-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="movies">Movies</SelectItem>
                <SelectItem value="tv">TV Shows</SelectItem>
                <SelectItem value="books">Books</SelectItem>
                <SelectItem value="music">Music</SelectItem>
                <SelectItem value="podcasts">Podcasts</SelectItem>
                <SelectItem value="games">Games</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Media Type Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🎵</span>
                    </div>
                    <span className="font-medium text-gray-900">Music</span>
                  </div>
                  <span className="text-gray-600">{mediaTypeCounts.music} songs</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🎬</span>
                    </div>
                    <span className="font-medium text-gray-900">Movies</span>
                  </div>
                  <span className="text-gray-600">{mediaTypeCounts.movie} watched</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">📺</span>
                    </div>
                    <span className="font-medium text-gray-900">TV Shows</span>
                  </div>
                  <span className="text-gray-600">{mediaTypeCounts.tv} series</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">📚</span>
                    </div>
                    <span className="font-medium text-gray-900">Books</span>
                  </div>
                  <span className="text-gray-600">{mediaTypeCounts.book} completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Media History */}
          {isLoadingLists ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
              <p className="text-gray-600 mt-2">Loading your media history...</p>
            </div>
          ) : filteredMediaHistory.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="divide-y divide-gray-100">
                {filteredMediaHistory.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="p-4 flex items-center space-x-4 hover:bg-gray-50">
                    {item.image_url ? (
                      <img 
                        src={item.image_url}
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">
                          {item.media_type === 'movie' ? '🎬' : 
                           item.media_type === 'tv' ? '📺' : 
                           item.media_type === 'book' ? '📚' : 
                           item.media_type === 'music' ? '🎵' : 
                           item.media_type === 'podcast' ? '🎧' : 
                           item.media_type === 'game' ? '🎮' : '🎭'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{item.title}</h4>
                      <p className="text-sm text-gray-600 truncate">
                        {item.media_type === 'tv' ? 'TV Show' : 
                         item.media_type === 'movie' ? 'Movie' : 
                         item.media_type === 'book' ? 'Book' : 
                         item.media_type === 'music' ? 'Music' : 
                         item.media_type === 'podcast' ? 'Podcast' : 
                         item.media_type === 'game' ? 'Game' : item.type}
                        {item.creator && ` by ${item.creator}`}
                      </p>
                      <p className="text-xs text-purple-600">In {item.listName}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Media History</h3>
              <p className="text-gray-600">No media found matching your current filters</p>
            </div>
          )}
        </div>

        {/* My Lists */}
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Lists</h2>
          </div>

          {isLoadingLists ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your lists...</p>
            </div>
          ) : userLists.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <List className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Custom Lists Yet</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                You haven't created any custom lists yet. Your system lists (Currently, Queue, Finished, Did Not Finish) are always available.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {userLists.map((list) => (
                <div 
                  key={list.id} 
                  className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleListClick(list.title)}
                  data-testid={`list-card-${list.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <List className="text-purple-700 mr-3" size={24} />
                      <h3 className="text-xl font-semibold text-gray-900">{list.title}</h3>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant="secondary" 
                        className="bg-purple-100 text-purple-800 hover:bg-purple-200"
                      >
                        Public
                      </Badge>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareListDirect(list.id, list.title);
                        }}
                        className="bg-black text-white hover:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2"
                        data-testid={`share-${list.title.toLowerCase().replace(/\s+/g, '-')}-list`}
                      >
                        <Share2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span>{list.items?.length || 0} items</span>
                      <div className="flex items-center space-x-1">
                        <Heart size={16} />
                        <span>145 likes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <User size={24} className="text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900">{mockUserData.name}</span>
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

      {/* Highlight Modal with Media Search */}
      {isHighlightModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Add a Highlight</h1>
                  <p className="text-gray-600 text-sm mt-1">Share something you're loving or have loved recently!</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsHighlightModalOpen(false)}
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Media Type Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Media Types to Search</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-6">
                  {categories.map((category) => {
                    const isChecked = selectedCategories.includes(category);
                    const isAllMedia = category === "All Media";
                    
                    const handleToggle = (checked: boolean) => {
                      if (isAllMedia) {
                        if (checked) {
                          setSelectedCategories(categories);
                        } else {
                          setSelectedCategories([]);
                        }
                      } else {
                        if (checked) {
                          const newCategories = [...selectedCategories, category];
                          if (newCategories.length === categories.length - 1) {
                            setSelectedCategories(categories);
                          } else {
                            setSelectedCategories(newCategories);
                          }
                        } else {
                          setSelectedCategories(prev => 
                            prev.filter(cat => cat !== category && cat !== "All Media")
                          );
                        }
                      }
                    };

                    return (
                      <div key={category} className="flex items-center space-x-3">
                        <Checkbox
                          id={category}
                          checked={isChecked}
                          onCheckedChange={handleToggle}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-5 h-5"
                        />
                        <label
                          htmlFor={category}
                          className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                        >
                          {category === "All Media" ? "All Types" : category}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search for Media Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search for Media</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for movies, TV shows, books, podcasts, music..."
                    className="pl-10 py-3 text-base bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>

                {/* Search Button */}
                {searchQuery.trim() && (
                  <div className="mt-4">
                    <Button
                      onClick={performSearch}
                      disabled={searchMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {searchMutation.isPending ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="animate-spin h-4 w-4" />
                          <span>Searching...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Search className="h-4 w-4" />
                          <span>Search</span>
                        </div>
                      )}
                    </Button>
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Search Results</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          onClick={() => setSelectedMedia(result)}
                          className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            selectedMedia?.title === result.title && selectedMedia?.creator === result.creator
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            {result.image && (
                              <img
                                src={result.image}
                                alt={result.title}
                                className="w-16 h-20 object-cover rounded flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-gray-900 truncate">{result.title}</h5>
                              <p className="text-sm text-gray-600 truncate">
                                {result.type === 'tv' ? 'TV Show' : 
                                 result.type === 'movie' ? 'Movie' : 
                                 result.type === 'book' ? 'Book' : 
                                 result.type === 'music' ? 'Music' : 
                                 result.type === 'podcast' ? 'Podcast' : 
                                 result.type === 'game' ? 'Game' : 
                                 result.type === 'sports' ? 'Sports' : 
                                 result.type === 'youtube' ? 'YouTube' : result.type}
                              </p>
                              {result.creator && (
                                <p className="text-sm text-gray-500 truncate">by {result.creator}</p>
                              )}
                              {result.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{result.description}</p>
                              )}
                            </div>
                            {selectedMedia?.title === result.title && selectedMedia?.creator === result.creator && (
                              <div className="flex-shrink-0">
                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Media Preview */}
                {selectedMedia && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">Selected for Highlight</h4>
                    <div className="flex items-center space-x-4">
                      {selectedMedia.image && (
                        <img
                          src={selectedMedia.image}
                          alt={selectedMedia.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        <h5 className="font-medium text-gray-900">{selectedMedia.title}</h5>
                        <p className="text-sm text-gray-600">
                          {selectedMedia.type === 'tv' ? 'TV Show' : 
                           selectedMedia.type === 'movie' ? 'Movie' : 
                           selectedMedia.type === 'book' ? 'Book' : 
                           selectedMedia.type === 'music' ? 'Music' : 
                           selectedMedia.type === 'podcast' ? 'Podcast' : 
                           selectedMedia.type === 'game' ? 'Game' : 
                           selectedMedia.type === 'sports' ? 'Sports' : 
                           selectedMedia.type === 'youtube' ? 'YouTube' : selectedMedia.type}
                        </p>
                        {selectedMedia.creator && (
                          <p className="text-sm text-gray-500">by {selectedMedia.creator}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Add Highlight Button */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setIsHighlightModalOpen(false)}
                  variant="outline"
                  className="text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedMedia) {
                      // Add the selected media to highlights
                      setHighlights(prev => [...prev, selectedMedia]);
                      toast({ 
                        title: "Highlight Added!", 
                        description: `Added "${selectedMedia.title}" to your highlights` 
                      });
                      setIsHighlightModalOpen(false);
                      setSelectedMedia(null);
                      setSearchResults([]);
                      setSearchQuery("");
                    }
                  }}
                  disabled={!selectedMedia}
                  className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  <Plus size={16} className="mr-2" />
                  Add Highlight
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


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
              {surveyQuestions.length > 0 && (
                <div className="mb-8">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Question {currentQuestion + 1} of {surveyQuestions.length}</span>
                    <span>{Math.round(((currentQuestion + 1) / surveyQuestions.length) * 100)}% complete</span>
                  </div>
                  <Progress value={((currentQuestion + 1) / surveyQuestions.length) * 100} className="h-3" />
                </div>
              )}

              {/* Question */}
              <div className="mb-8">
                {!isLoadingQuestions && surveyQuestions.length > 0 && currentQuestion < surveyQuestions.length && (
                  <>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-6 leading-relaxed">
                      {surveyQuestions[currentQuestion].question_text}
                    </h2>

                    {/* Text Input */}
                    {surveyQuestions[currentQuestion].question_type === 'text' && (
                      <textarea
                        value={getCurrentSurveyAnswer() || ""}
                        onChange={(e) => handleSurveyAnswer(e.target.value)}
                        placeholder="Please share your thoughts..."
                        className="w-full p-4 border border-gray-200 rounded-xl focus:border-purple-300 focus:ring-purple-300 min-h-[120px] resize-vertical text-black bg-white placeholder:text-gray-500"
                        data-testid="text-input"
                      />
                    )}

                    {/* Single Select */}
                    {surveyQuestions[currentQuestion].question_type === 'select' && (
                      <RadioGroup 
                        value={getCurrentSurveyAnswer() || ""} 
                        onValueChange={handleSurveyAnswer}
                        className="space-y-4"
                      >
                        {surveyQuestions[currentQuestion].options?.map((option, index) => (
                          <div key={index} className="flex items-center space-x-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer">
                            <RadioGroupItem value={option} id={`option-${index}`} />
                            <Label 
                              htmlFor={`option-${index}`} 
                              className="text-gray-700 text-base leading-relaxed cursor-pointer flex-1"
                              data-testid={`option-${option}`}
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Multi-Select */}
                    {surveyQuestions[currentQuestion].question_type === 'multi-select' && (
                      <div className="space-y-4">
                        {surveyQuestions[currentQuestion].options?.map((option, index) => {
                          const currentAnswers = Array.isArray(getCurrentSurveyAnswer()) ? getCurrentSurveyAnswer() : [];
                          const isChecked = currentAnswers.includes(option);

                          return (
                            <div key={index} className="flex items-center space-x-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer">
                              <input
                                type="checkbox"
                                id={`multi-option-${index}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentAnswers = Array.isArray(getCurrentSurveyAnswer()) ? [...getCurrentSurveyAnswer()] : [];
                                  if (e.target.checked) {
                                    currentAnswers.push(option);
                                  } else {
                                    const optionIndex = currentAnswers.indexOf(option);
                                    if (optionIndex > -1) {
                                      currentAnswers.splice(optionIndex, 1);
                                    }
                                  }
                                  handleSurveyAnswer(currentAnswers);
                                }}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                data-testid={`multi-option-${option}`}
                              />
                              <Label 
                                htmlFor={`multi-option-${index}`} 
                                className="text-gray-700 text-base leading-relaxed cursor-pointer flex-1"
                              >
                                {option}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {isLoadingQuestions && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading survey questions...</p>
                  </div>
                )}
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
                  disabled={surveyQuestions.length === 0 || !getCurrentSurveyAnswer() || (Array.isArray(getCurrentSurveyAnswer()) && getCurrentSurveyAnswer().length === 0)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center space-x-2 px-8 py-3 disabled:opacity-50"
                  data-testid="next-question-button"
                >
                  <span>{surveyQuestions.length > 0 && currentQuestion === surveyQuestions.length - 1 ? "Generate My DNA" : "Next"}</span>
                  {surveyQuestions.length > 0 && currentQuestion === surveyQuestions.length - 1 ? (
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

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}