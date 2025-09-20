import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ShareUpdateDialog from "@/components/share-update-dialog";
import ListShareModal from "@/components/list-share-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Users, MessageCircle, Share, Play, BookOpen, Music, Film, Tv, Trophy, Heart, Plus, Settings, Calendar, TrendingUp, Clock, Headphones, Gamepad2, Sparkles, Brain, Share2, ChevronDown, ChevronUp, CornerUpRight } from "lucide-react";

export default function UserProfile() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isDNAExpanded, setIsDNAExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedListForShare, setSelectedListForShare] = useState<{name: string, items: number, isPublic: boolean} | null>(null);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareUpdate = () => {
    setIsShareDialogOpen(true);
  };

  const handleShareList = (listName: string, itemCount: number, isPublic: boolean) => {
    setSelectedListForShare({ name: listName, items: itemCount, isPublic });
    setShareModalOpen(true);
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
      personality: "The Thoughtful Explorer",
      description: "You seek meaningful narratives with complex characters and layered storytelling. Quality over quantity defines your entertainment choices.",
      traits: [
        { name: "Sci-Fi Enthusiast", percentage: 92, color: "from-purple-500 to-indigo-600" },
        { name: "Character-Driven", percentage: 88, color: "from-blue-500 to-cyan-600" },
        { name: "Indie Appreciator", percentage: 75, color: "from-green-500 to-emerald-600" },
        { name: "Critical Thinker", percentage: 82, color: "from-yellow-500 to-orange-600" }
      ],
      topGenres: ["Science Fiction", "Drama", "Indie Films", "Literary Fiction"],
      viewingStyle: "Binge Enthusiast",
      discoverMethod: "Friend Recommendations",
      totalItems: 342,
      listsCreated: 12
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
                  <Button 
                    onClick={handleShareUpdate}
                    className="bg-purple-700 text-white hover:bg-purple-800"
                  >
                    <MessageCircle size={16} className="mr-2" />
                    Share Update
                  </Button>
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
                  <p className="text-sm text-gray-600">{user.entertainmentDNA.personality}</p>
                </div>
              </div>
              <Button 
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                data-testid="button-share-dna"
              >
                <Share2 size={14} className="mr-2" />
                Share
              </Button>
            </div>

            {/* Simplified DNA Content */}
            <div className="bg-white rounded-xl p-4">
              {/* Brief Description */}
              <p className="text-sm text-gray-600 mb-4">
                {user.entertainmentDNA.description.split('.')[0]}.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {user.entertainmentDNA.traits.slice(0, 2).map((trait, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{trait.name}</span>
                      <span className="text-xs font-semibold text-gray-700">{trait.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`bg-gradient-to-r ${trait.color} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${trait.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {user.entertainmentDNA.topGenres.slice(0, 3).map((genre, index) => (
                  <Badge key={index} className="bg-purple-100 text-purple-700 text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>

              {/* Expandable Section */}
              {isDNAExpanded && (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                  {/* Additional Traits */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 mb-3">All Entertainment Traits</h5>
                    <div className="space-y-3">
                      {user.entertainmentDNA.traits.slice(2).map((trait, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{trait.name}</span>
                            <span className="text-xs font-semibold text-gray-700">{trait.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`bg-gradient-to-r ${trait.color} h-2 rounded-full transition-all duration-500`}
                              style={{ width: `${trait.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Entertainment Style */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">Entertainment Style</h5>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Viewing Style:</span> {user.entertainmentDNA.viewingStyle}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Discovery Method:</span> {user.entertainmentDNA.discoverMethod}
                      </p>
                    </div>
                  </div>

                  {/* All Genres */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">All Top Genres</h5>
                    <div className="flex flex-wrap gap-2">
                      {user.entertainmentDNA.topGenres.map((genre, index) => (
                        <Badge key={index} className="bg-purple-100 text-purple-700 text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Show More/Less Button */}
              <button
                onClick={() => setIsDNAExpanded(!isDNAExpanded)}
                className="flex items-center justify-center space-x-2 w-full mt-3 py-2 text-sm text-purple-700 hover:text-purple-800 transition-colors"
                data-testid="button-expand-dna"
              >
                <span>{isDNAExpanded ? 'Show Less' : 'Show More'}</span>
                {isDNAExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
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

      <ShareUpdateDialog 
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
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
    </div>
  );
}