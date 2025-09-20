
import React, { useState } from "react";
import { ArrowLeft, Play, Plus, Heart, Share, Star, Calendar, Clock, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";

// Rating Modal Component
function RatingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [userRating, setUserRating] = useState<string>("");
  const [hasRated, setHasRated] = useState(false);

  const handleRatingSubmit = () => {
    const rating = parseFloat(userRating);
    if (rating >= 0 && rating <= 5) {
      setHasRated(true);
      // Here you would typically save to backend
      console.log('Rating submitted:', rating);
    }
  };

  const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, numbers, and decimal with one decimal place
    if (value === '' || /^\d*\.?\d?$/.test(value)) {
      const num = parseFloat(value);
      if (value === '' || (num >= 0 && num <= 5)) {
        setUserRating(value);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add My Rating</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
        
        {!hasRated ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="rating-input" className="block text-sm text-gray-600 mb-2">
                Rate this podcast (0.0 - 5.0)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  id="rating-input"
                  type="text"
                  value={userRating}
                  onChange={handleRatingChange}
                  placeholder="4.5"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="input-rating"
                />
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        parseFloat(userRating) >= star
                          ? 'text-yellow-500 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleRatingSubmit}
              disabled={!userRating || parseFloat(userRating) < 0 || parseFloat(userRating) > 5}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300"
              data-testid="button-submit-rating"
            >
              Submit Rating
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              <span className="text-lg font-semibold">{userRating}</span>
            </div>
            <p className="text-sm text-gray-600">Thank you for rating!</p>
            <div className="flex gap-3 mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setHasRated(false); setUserRating(''); }}
                data-testid="button-change-rating"
              >
                Change Rating
              </Button>
              <Button 
                size="sm" 
                onClick={onClose}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaDetail() {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };
  // Mock data for SmartLess podcast
  const mediaItem = {
    id: "spotify_0Yzd0g8NYmn27k2HFNplv7",
    title: "SmartLess",
    creator: "Jason Bateman, Sean Hayes, Will Arnett",
    type: "Podcast",
    provider: "Spotify",
    artwork: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop",
    description: "Jason Bateman, Sean Hayes, and Will Arnett invite their favorite people for uninformed conversations.",
    rating: 4.8,
    totalEpisodes: 245,
    subscribers: "2.1M",
    category: "Comedy",
    language: "English",
    releaseDate: "2020-07-20",
    lastEpisode: "2024-01-15",
    averageLength: "45 min"
  };

  const recentEpisodes = [
    {
      id: 1,
      title: "Conan O'Brien",
      description: "The guys sit down with comedy legend Conan O'Brien to discuss late-night television, Harvard, and his new podcast.",
      duration: "47:32",
      releaseDate: "2024-01-15",
      plays: "1.2M"
    },
    {
      id: 2,
      title: "Ryan Reynolds",
      description: "Ryan Reynolds joins the hosts to talk about Deadpool, Aviation Gin, and his friendship with the guys.",
      duration: "52:18",
      releaseDate: "2024-01-08",
      plays: "2.1M"
    },
    {
      id: 3,
      title: "Amy Poehler",
      description: "Amy Poehler discusses Parks and Recreation, SNL, and her directorial work with the SmartLess crew.",
      duration: "41:25",
      releaseDate: "2024-01-01",
      plays: "890K"
    }
  ];

  const userStats = {
    episodesListened: 127,
    hoursListened: 94,
    favoriteEpisode: "Conan O'Brien",
    discoveredDate: "2022-03-15"
  };

  const availablePlatforms = [
    {
      name: "Spotify",
      type: "Free with ads",
      logo: "🎵",
      url: "https://open.spotify.com/show/...",
      color: "bg-green-500"
    },
    {
      name: "Apple Podcasts",
      type: "Free",
      logo: "🎧",
      url: "https://podcasts.apple.com/...",
      color: "bg-purple-500"
    },
    {
      name: "Google Podcasts",
      type: "Free",
      logo: "🔍",
      url: "https://podcasts.google.com/...",
      color: "bg-blue-500"
    },
    {
      name: "Amazon Music",
      type: "Prime included",
      logo: "📻",
      url: "https://music.amazon.com/...",
      color: "bg-orange-500"
    },
    {
      name: "YouTube",
      type: "Free with ads",
      logo: "📺",
      url: "https://youtube.com/...",
      color: "bg-red-500"
    },
    {
      name: "Stitcher",
      type: "Free",
      logo: "🎤",
      url: "https://stitcher.com/...",
      color: "bg-gray-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Media Header */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                  <img 
                    src={mediaItem.artwork} 
                    alt={mediaItem.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{mediaItem.title}</h1>
                    <p className="text-lg text-gray-600 mb-4">by {mediaItem.creator}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="font-medium">{mediaItem.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{mediaItem.subscribers} subscribers</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{mediaItem.totalEpisodes} episodes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>~{mediaItem.averageLength}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      <Play size={16} className="mr-2" />
                      Play Latest
                    </Button>
                    <Button variant="outline">
                      <Plus size={16} className="mr-2" />
                      Add to List
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowRatingModal(true)}
                      data-testid="button-add-rating"
                    >
                      <Star size={16} className="mr-2" />
                      Add My Rating
                    </Button>
                    <Button variant="outline">
                      <Share size={16} className="mr-2" />
                      Share
                    </Button>
                  </div>

                  {/* Listen On Platforms */}
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Listen On</h3>
                    <div className="flex flex-wrap gap-2">
                      {availablePlatforms.map((platform, index) => (
                        <a
                          key={index}
                          href={platform.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                          data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                          title={`${platform.name} - ${platform.type}`}
                        >
                          <span className="font-medium text-gray-700">{platform.name}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
              <p className="text-gray-700 leading-relaxed mb-6">{mediaItem.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Category</span>
                  <p className="font-medium text-gray-900">{mediaItem.category}</p>
                </div>
                <div>
                  <span className="text-gray-500">Language</span>
                  <p className="font-medium text-gray-900">{mediaItem.language}</p>
                </div>
                <div>
                  <span className="text-gray-500">Started</span>
                  <p className="font-medium text-gray-900">July 2020</p>
                </div>
                <div>
                  <span className="text-gray-500">Last Episode</span>
                  <p className="font-medium text-gray-900">Jan 15, 2024</p>
                </div>
              </div>
            </div>

            {/* Recent Episodes */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Episodes</h2>
                <Button variant="outline" size="sm">View All</Button>
              </div>
              
              <div className="space-y-4">
                {recentEpisodes.map((episode) => (
                  <div key={episode.id} className="flex items-start space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                    <Button variant="ghost" size="sm" className="p-2 mt-1">
                      <Play size={16} />
                    </Button>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{episode.title}</h3>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{episode.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{episode.releaseDate}</span>
                        <span>{episode.duration}</span>
                        <span>{episode.plays} plays</span>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="sm">
                      <Plus size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Episodes Listened</span>
                  <span className="font-semibold">{userStats.episodesListened}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hours Listened</span>
                  <span className="font-semibold">{userStats.hoursListened}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discovered</span>
                  <span className="font-semibold">Mar 2022</span>
                </div>
                <div>
                  <span className="text-gray-600">Favorite Episode</span>
                  <p className="font-semibold text-sm mt-1">{userStats.favoriteEpisode}</p>
                </div>
              </div>
            </div>


            {/* Related Shows */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">You Might Also Like</h3>
              <div className="space-y-4">
                {[
                  { title: "Conan O'Brien Needs a Friend", host: "Conan O'Brien" },
                  { title: "WTF with Marc Maron", host: "Marc Maron" },
                  { title: "The Joe Rogan Experience", host: "Joe Rogan" }
                ].map((show, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{show.title}</p>
                      <p className="text-xs text-gray-600">{show.host}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <RatingModal isOpen={showRatingModal} onClose={() => setShowRatingModal(false)} />
    </div>
  );
}
