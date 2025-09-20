import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Search, Plus, Check, Users, UserPlus, Filter, Star, Sparkles } from "lucide-react";

export default function FriendsCreatorsPage() {
  const [activeCreatorTab, setActiveCreatorTab] = useState("actors");
  const [creatorSearchQuery, setCreatorSearchQuery] = useState("");
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("creators");

  const mockCreators = {
    actors: ["Ariana Grande", "Emma Stone", "Margot Robbie", "Ryan Gosling", "Zendaya", "Timothée Chalamet"],
    authors: ["Taylor Jenkins Reid", "Colleen Hoover", "Sarah J. Maas", "James Clear", "Brandon Sanderson", "Sally Rooney"],
    artists: ["Harry Styles", "Taylor Swift", "The Weeknd", "Billie Eilish", "Olivia Rodrigo", "Bad Bunny"]
  };

  const mockFriends = [
    { id: "friend-1", username: "AlexMovieFan", name: "Alex Johnson", mutualFriends: 12, isFollowing: false },
    { id: "friend-2", username: "BookwormSarah", name: "Sarah Chen", mutualFriends: 8, isFollowing: true },
    { id: "friend-3", username: "MusicLover23", name: "Mike Davis", mutualFriends: 15, isFollowing: false },
    { id: "friend-4", username: "TVSeriesAddict", name: "Jessica Liu", mutualFriends: 6, isFollowing: true },
    { id: "friend-5", username: "GameMaster", name: "Tyler Kim", mutualFriends: 9, isFollowing: false }
  ];

  const handleFollowCreator = (creatorName: string) => {
    if (!followedCreators.includes(creatorName)) {
      setFollowedCreators([...followedCreators, creatorName]);
      console.log(`Awarded +2 points for following ${creatorName}`);
    }
  };

  const handleFollowFriend = (friendId: string) => {
    // In a real app, this would update the backend
    console.log(`Following friend ${friendId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Friends & Creators
          </h1>
          <p className="text-lg text-gray-600">
            Discover and follow your favorite creators and connect with fellow entertainment fans
          </p>
        </div>

        {/* Main Tab Selector */}
        <div className="flex space-x-1 bg-white rounded-lg p-1 mb-6 border border-gray-200">
          <button
            onClick={() => setActiveTab("creators")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === "creators"
                ? "bg-gradient-to-r from-purple-700 to-purple-800 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            data-testid="tab-creators"
          >
            <Users className="inline mr-2" size={18} />
            Creators
          </button>
          <button
            onClick={() => setActiveTab("friends")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === "friends"
                ? "bg-gradient-to-r from-purple-700 to-purple-800 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            data-testid="tab-friends"
          >
            <UserPlus className="inline mr-2" size={18} />
            Friends
          </button>
        </div>

        {/* Creators Tab */}
        {activeTab === "creators" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-purple-800 to-purple-900 bg-clip-text text-transparent">
              Find Creators to Follow
            </h3>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search for actors, authors, artists..."
                value={creatorSearchQuery}
                onChange={(e) => setCreatorSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent text-sm"
                data-testid="input-creator-search"
              />
            </div>

            {/* Creator Category Tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4">
              {[
                { id: "actors", label: "Actors" },
                { id: "authors", label: "Authors" },
                { id: "artists", label: "Artists" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCreatorTab(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-md font-medium transition-colors text-sm ${
                    activeCreatorTab === tab.id
                      ? "bg-white text-purple-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid={`tab-creator-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Creator List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {mockCreators[activeCreatorTab as keyof typeof mockCreators]
                .filter(creator =>
                  creator.toLowerCase().includes(creatorSearchQuery.toLowerCase())
                )
                .map((creator) => (
                <div key={creator} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">👤</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{creator}</div>
                      <div className="text-sm text-gray-500 capitalize">{activeCreatorTab.slice(0, -1)}</div>
                    </div>
                  </div>
                  {followedCreators.includes(creator) ? (
                    <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                      <Check size={14} />
                      <span>Following</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleFollowCreator(creator)}
                      className="bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white font-medium px-3 py-1 text-sm"
                      data-testid={`button-follow-${creator.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <Plus size={14} className="mr-1" />
                      Follow
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended for You Section - Creators */}
        {activeTab === "creators" && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6 shadow-sm mt-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-800 to-indigo-900 bg-clip-text text-transparent">
                Recommended for You
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Based on your entertainment preferences</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: "Pedro Pascal",
                  type: "Actor",
                  reason: "You love The Last of Us and Mandalorian",
                  popularity: "95% match",
                  followers: "2.1M"
                },
                {
                  name: "Rebecca Ross",
                  type: "Author",
                  reason: "Fans of fantasy romance like Fourth Wing",
                  popularity: "88% match",
                  followers: "450K"
                },
                {
                  name: "Sabrina Carpenter",
                  type: "Artist",
                  reason: "Similar to artists you follow",
                  popularity: "92% match",
                  followers: "1.8M"
                },
                {
                  name: "Anya Taylor-Joy",
                  type: "Actor",
                  reason: "You rated The Queen's Gambit 5 stars",
                  popularity: "89% match",
                  followers: "3.2M"
                }
              ].map((creator, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{creator.name}</div>
                        <div className="text-sm text-gray-500">{creator.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-purple-600">
                      <Star className="fill-current" size={14} />
                      <span className="text-xs font-medium">{creator.popularity}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">{creator.reason}</div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{creator.followers} followers</span>
                    {followedCreators.includes(creator.name) ? (
                      <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                        <Check size={14} />
                        <span>Following</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleFollowCreator(creator.name)}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium px-3 py-1 text-sm rounded-full"
                        data-testid={`button-follow-recommended-${creator.name.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <Plus size={12} className="mr-1" />
                        Follow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends Tab */}
        {activeTab === "friends" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-purple-800 to-purple-900 bg-clip-text text-transparent">
              Connect with Fellow Fans
            </h3>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by username or name..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent text-sm"
                data-testid="input-friend-search"
              />
            </div>

            {/* Suggested Friends */}
            <div className="space-y-3">
              {mockFriends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">👤</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{friend.name}</div>
                      <div className="text-sm text-gray-500">@{friend.username}</div>
                      <div className="text-xs text-gray-400">{friend.mutualFriends} mutual connections</div>
                    </div>
                  </div>
                  {friend.isFollowing ? (
                    <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                      <Check size={14} />
                      <span>Following</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleFollowFriend(friend.id)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-4 py-2 text-sm rounded-full"
                      data-testid={`button-follow-friend-${friend.id}`}
                    >
                      <UserPlus size={14} className="mr-1" />
                      Follow
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share DNA with Friends */}
        {activeTab === "friends" && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6 shadow-sm mt-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-800 to-pink-900 bg-clip-text text-transparent">
                Share Your Entertainment DNA
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Invite friends to discover their entertainment personality and compare with yours</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🧬</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Your DNA: The Thoughtful Explorer</div>
                    <div className="text-sm text-gray-500">Sci-Fi Enthusiast • Character-Driven</div>
                  </div>
                </div>
                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  data-testid="button-share-my-dna"
                >
                  Share My DNA
                </Button>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center">
                    <Users className="text-white" size={18} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Invite Friends</div>
                    <div className="text-sm text-gray-500">Help them discover their entertainment DNA</div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                  data-testid="button-invite-friends-dna"
                >
                  Send DNA Invites
                </Button>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">
              Friends who complete their Entertainment DNA will appear here with compatibility scores
            </div>
          </div>
        )}

        {/* Recommended for You Section - Friends */}
        {activeTab === "friends" && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-6 shadow-sm mt-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-800 to-purple-900 bg-clip-text text-transparent">
                Recommended for You
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Friends with similar entertainment tastes</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: "rec-friend-1",
                  username: "SciFiFanatic",
                  name: "Emma Rodriguez",
                  reason: "Both love sci-fi shows and Dune series",
                  compatibility: "94% match",
                  mutualFriends: 18,
                  isFollowing: false
                },
                {
                  id: "rec-friend-2",
                  username: "BookClubQueen",
                  name: "Olivia Park",
                  reason: "Shares your love for romance novels",
                  compatibility: "91% match",
                  mutualFriends: 12,
                  isFollowing: false
                },
                {
                  id: "rec-friend-3",
                  username: "IndieVibes",
                  name: "Jordan Martinez",
                  reason: "Similar music taste - indie and alternative",
                  compatibility: "87% match",
                  mutualFriends: 7,
                  isFollowing: false
                },
                {
                  id: "rec-friend-4",
                  username: "CinemaLover24",
                  name: "Taylor Brooks",
                  reason: "You both rate A24 films highly",
                  compatibility: "89% match",
                  mutualFriends: 14,
                  isFollowing: false
                }
              ].map((friend) => (
                <div key={friend.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{friend.name}</div>
                        <div className="text-sm text-gray-500">@{friend.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-blue-600">
                      <Star className="fill-current" size={14} />
                      <span className="text-xs font-medium">{friend.compatibility}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">{friend.reason}</div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{friend.mutualFriends} mutual connections</span>
                    {friend.isFollowing ? (
                      <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                        <Check size={14} />
                        <span>Following</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleFollowFriend(friend.id)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-3 py-1 text-sm rounded-full"
                        data-testid={`button-follow-recommended-friend-${friend.id}`}
                      >
                        <UserPlus size={12} className="mr-1" />
                        Follow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}