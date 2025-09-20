import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import ShareUpdateDialog from "@/components/share-update-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Users, MessageCircle, Share, Play, BookOpen, Music, Film, Tv, Trophy, Heart, Plus, Settings, ChevronDown, Brain, Target, Handshake } from "lucide-react";

export default function CreatorProfile() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareAudience, setShareAudience] = useState<"top-fans" | "all">("all");
  const [isPlayMenuOpen, setIsPlayMenuOpen] = useState(false);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareUpdate = (audience: "top-fans" | "all") => {
    setShareAudience(audience);
    setIsShareDialogOpen(true);
  };

  // Mock creator data
  const creator = {
    name: "Taylor Swift",
    type: "Musician & Artist",
    avatar: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&h=300&fit=crop",
    followers: 2847329,
    verified: true,
    fanPoints: 156780,
    bio: "Grammy-winning singer-songwriter creating music that tells stories. Currently re-recording my masters and sharing the journey with you.",
    stats: {
      albums: 12,
      songs: 187,
      movies: 3,
      collaborations: 45
    }
  };

  const featuredContent = {
    music: [
      { title: "Anti-Hero", type: "Song", plays: "2.4M", artwork: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop" },
      { title: "Midnights", type: "Album", plays: "1.8M", artwork: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=100&h=100&fit=crop" }
    ],
    movies: [
      { title: "Miss Americana", type: "Documentary", plays: "890K", artwork: "https://images.unsplash.com/photo-1489599843444-10da8eb01117?w=100&h=100&fit=crop" }
    ],
    books: [
      { title: "Taylor Swift: The Stories Behind Every Song", type: "Biography", plays: "234K", artwork: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=100&h=100&fit=crop" }
    ]
  };

  const recentUpdates = [
    {
      id: 1,
      content: "Just finished recording a new song in the studio! Can't wait to share it with you all 🎵",
      timestamp: "2 hours ago",
      likes: 45789,
      comments: 892,
      audience: "all"
    },
    {
      id: 2,
      content: "Thank you to my top fans for the incredible support on the new album! Special listening party coming soon 💜",
      timestamp: "1 day ago", 
      likes: 23456,
      comments: 567,
      audience: "top-fans"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-4xl mx-auto">
        {/* Cover Photo */}
        <div className="relative h-48 md:h-64">
          <img 
            src={creator.coverImage} 
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Profile Header */}
        <div className="relative px-4 pb-6">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-6 -mt-16">
            {/* Avatar */}
            <div className="relative">
              <img 
                src={creator.avatar}
                alt={creator.name}
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
              />
              {creator.verified && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center">
                  <Star className="text-white" size={16} />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="mt-4 md:mt-0 flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-black mb-1">{creator.name}</h1>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-gray-600">{creator.type}</span>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      Verified Creator
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users size={16} />
                      <span>{creator.followers.toLocaleString()} followers</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy size={16} />
                      <span>{creator.fanPoints.toLocaleString()} fan points</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 mt-4 md:mt-0">
                  <Button className="bg-purple-700 text-white hover:bg-purple-800">
                    <Heart size={16} className="mr-2" />
                    Follow
                  </Button>
                  <Button className="bg-gradient-to-r from-purple-700 to-pink-600 text-white hover:from-purple-800 hover:to-pink-700">
                    <Star size={16} className="mr-2" />
                    Inner Circle
                  </Button>
                  <div className="relative">
                    <Button 
                      onClick={() => setIsPlayMenuOpen(!isPlayMenuOpen)}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      <Play size={16} className="mr-2" />
                      Play
                      <ChevronDown size={16} className="ml-2" />
                    </Button>
                    {isPlayMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <div className="py-2">
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center">
                            <Brain size={16} className="mr-3 text-purple-600" />
                            <span className="text-gray-900">Trivia</span>
                          </button>
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center">
                            <Target size={16} className="mr-3 text-blue-600" />
                            <span className="text-gray-900">Predict</span>
                          </button>
                          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center">
                            <Handshake size={16} className="mr-3 text-orange-600" />
                            <span className="text-gray-900">Blends</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-6">
            <p className="text-gray-700 leading-relaxed">{creator.bio}</p>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(creator.stats).map(([key, value]) => (
              <div key={key} className="text-center p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-600 capitalize">{key}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Share Update Section */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Share an Update</h2>
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={() => handleShareUpdate("all")}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Share size={16} className="mr-2" />
                Share to All Followers
              </Button>
              <Button 
                onClick={() => handleShareUpdate("top-fans")}
                className="flex-1 bg-purple-700 text-white hover:bg-purple-800"
              >
                <Trophy size={16} className="mr-2" />
                Share to Top Fans
              </Button>
            </div>
          </div>
        </div>

        {/* Featured Content */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Content</h2>
          
          {/* Music Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Music className="text-purple-700" size={24} />
              <h3 className="text-xl font-bold text-gray-900">Music</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredContent.music.map((item, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <img src={item.artwork} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-600">{item.type}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Play size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-500">{item.plays} plays</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Movies Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Film className="text-purple-700" size={24} />
              <h3 className="text-xl font-bold text-gray-900">Movies & TV</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredContent.movies.map((item, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <img src={item.artwork} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-600">{item.type}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Play size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-500">{item.plays} views</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Books Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="text-purple-700" size={24} />
              <h3 className="text-xl font-bold text-gray-900">Books</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredContent.books.map((item, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <img src={item.artwork} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-600">{item.type}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Play size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-500">{item.plays} reads</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Updates */}
        <div className="px-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Updates</h2>
          <div className="space-y-4">
            {recentUpdates.map((update) => (
              <div key={update.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  <img 
                    src={creator.avatar}
                    alt={creator.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900">{creator.name}</span>
                      <Badge variant={update.audience === "top-fans" ? "default" : "secondary"} className={update.audience === "top-fans" ? "bg-purple-700" : ""}>
                        {update.audience === "top-fans" ? "Top Fans" : "Public"}
                      </Badge>
                      <span className="text-sm text-gray-500">{update.timestamp}</span>
                    </div>
                    <p className="text-gray-800 mb-3">{update.content}</p>
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <button className="flex items-center space-x-1 hover:text-red-500 transition-colors">
                        <Heart size={16} />
                        <span>{update.likes.toLocaleString()}</span>
                      </button>
                      <button className="flex items-center space-x-1 hover:text-blue-500 transition-colors">
                        <MessageCircle size={16} />
                        <span>{update.comments}</span>
                      </button>
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
        audience={shareAudience}
      />
    </div>
  );
}