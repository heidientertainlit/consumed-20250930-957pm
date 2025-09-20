import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Star, Heart, MessageCircle, Share, ChevronRight, Check, Badge, User, Vote, TrendingUp, Lightbulb, Eye, Users, BookOpen, Film } from "lucide-react";
import ShareUpdateDialog from "@/components/share-update-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface SocialPost {
  id: string;
  type: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  mediaItems: Array<{
    id: string;
    title: string;
    creator: string;
    mediaType: string;
    imageUrl: string;
    rating?: number;
    externalId: string;
    externalSource: string;
  }>;
}

const fetchSocialFeed = async (session: any): Promise<SocialPost[]> => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/social-feed', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch social feed: ${response.statusText}`);
  }

  return response.json();
};

export default function Feed() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const { session, user } = useAuth();

  const { data: socialPosts, isLoading } = useQuery({
    queryKey: ["social-feed"],
    queryFn: () => fetchSocialFeed(session),
    enabled: !!session?.access_token,
  });

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShareUpdate = () => {
    setIsShareDialogOpen(true);
  };

  const handleFollowCreator = (creatorName: string) => {
    if (!followedCreators.includes(creatorName)) {
      setFollowedCreators([...followedCreators, creatorName]);
      // Award +2 points to user
      const currentUser = user;
      if (currentUser) {
        // In a real app, this would update the backend
        console.log(`Awarded +2 points for following ${creatorName}`);
      }
    }
  };

  const getCreatorForMedia = (title: string) => {
    const creators = {
      "SmartLess": "Jason Bateman",
      "The Bear": "Jeremy Allen White",
      "Inception": "Christopher Nolan",
      "Dune": "Denis Villeneuve",
      "The Seven Husbands of Evelyn Hugo": "Taylor Jenkins Reid",
      "Atomic Habits": "James Clear",
      "Harry's House": "Harry Styles",
      "Renaissance": "Beyoncé"
    };
    return creators[title as keyof typeof creators] || "Unknown Creator";
  };

  const getMediaArtwork = (title: string, category: string) => {
    // Mock artwork URLs for different media
    const artworkMap: { [key: string]: string } = {
      "SmartLess": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=100&h=100&fit=crop",
      "The Bear": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=100&h=100&fit=crop",
      "Inception": "https://images.unsplash.com/photo-1489599843444-10da8eb01117?w=100&h=100&fit=crop",
      "Dune": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop",
      "The Seven Husbands of Evelyn Hugo": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=100&h=100&fit=crop",
      "Atomic Habits": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100&h=100&fit=crop",
      "Harry's House": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop",
      "Renaissance": "https://images.unsplash.com/photo-1520523839897-bd0b52f915a0?w=100&h=100&fit=crop"
    };

    return artworkMap[title] || `https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Activity Feed
          </h1>
          <p className="text-lg text-gray-600">
            Follow your friends and favorite creators. See what friends are watching, reading, listening to, and playing — all in one place.
          </p>
        </div>


        {/* Activity Stream */}
        <div className="space-y-6">

          {/* Followed Creators */}
          {followedCreators.length > 0 && (
            <div className="flex items-center space-x-3 overflow-x-auto pb-2">
              <span className="text-gray-600 font-medium whitespace-nowrap">Following:</span>
              {followedCreators.map((creator) => (
                <div
                  key={creator}
                  className="flex items-center space-x-2 bg-white border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="text-white" size={12} />
                  </div>
                  <span className="text-gray-700">{creator}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button
              onClick={handleShareUpdate}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              data-testid="share-update-button"
            >
              <MessageCircle size={24} className="mr-3" />
              Share Update
            </Button>
          </div>


          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse shadow-sm">
                  {/* User info skeleton */}
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>

                  {/* Text skeleton */}
                  <div className="h-4 bg-gray-200 rounded mb-4 w-3/4"></div>

                  {/* Media card skeleton */}
                  <div className="bg-gray-100 rounded-2xl p-4 mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-5 bg-gray-200 rounded mb-2 w-2/3"></div>
                        <div className="h-3 bg-gray-200 rounded mb-2 w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </div>
                  </div>

                  {/* Interaction bar skeleton */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <div className="h-6 bg-gray-200 rounded w-8"></div>
                      <div className="h-6 bg-gray-200 rounded w-8"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : !session ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Please sign in to view your social feed.</p>
            </div>
          ) : socialPosts && socialPosts.length > 0 ? (
            <div className="space-y-4">
              {socialPosts.map((post: SocialPost) => (
                <div key={post.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  {/* User Info and Date */}
                  <div className="flex items-center space-x-3 mb-4">
                    <img 
                      src={post.user.avatar} 
                      alt={post.user.displayName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{post.user.displayName}</div>
                      <div className="text-sm text-gray-500">{formatFullDate(post.timestamp)}</div>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.content && (
                    <div className="mb-4">
                      <p className="text-gray-800">{post.content}</p>
                    </div>
                  )}

                  {/* Media Cards */}
                  {post.mediaItems && post.mediaItems.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {post.mediaItems.map((media, index) => (
                        <div key={index} className="bg-gray-100 rounded-2xl p-4">
                          <div className="flex items-center space-x-4">
                            {/* Media Artwork */}
                            <div className="w-16 h-24 rounded-lg overflow-hidden">
                              <img 
                                src={media.imageUrl || getMediaArtwork(media.title, media.mediaType)}
                                alt={`${media.title} artwork`}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Media Info */}
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-gray-900 mb-1" data-testid={`feed-post-${post.id}-media-${index}`}>
                                {media.title}
                              </h3>

                              {/* Creator Info */}
                              {media.creator && (
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-gray-600 text-sm">by {media.creator}</span>
                                  {!followedCreators.includes(media.creator) ? (
                                    <button
                                      onClick={() => handleFollowCreator(media.creator)}
                                      className="text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 px-2 py-1 rounded-full transition-colors"
                                    >
                                      + Follow
                                    </button>
                                  ) : (
                                    <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                                      <Check size={14} />
                                      <span>Following</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="text-gray-600 text-sm capitalize mb-2">
                                {media.mediaType}
                              </div>
                              {media.rating && (
                                <div className="flex items-center">
                                  <div className="flex text-yellow-400">
                                    {Array.from({ length: 5 }, (_, i) => (
                                      <Star
                                        key={i}
                                        size={16}
                                        fill={i < media.rating! ? "currentColor" : "none"}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm text-gray-600 ml-2">({media.rating}/5)</span>
                                </div>
                              )}
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="text-gray-400" size={20} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interaction Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
                        <Heart size={18} />
                        <span className="text-sm">{post.likes}</span>
                      </button>
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
                        <MessageCircle size={18} />
                        <span className="text-sm">{post.comments}</span>
                      </button>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(post.timestamp)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Sponsor Survey Question */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Vote className="text-white" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="font-semibold text-gray-900">Quick Poll</div>
                      <Badge className="bg-blue-100 text-blue-700 text-xs px-2 py-1">Sponsored</Badge>
                    </div>
                    <div className="text-sm text-gray-500">Netflix • 5 minutes ago</div>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">Who should play The Joker in the new Batman series?</h3>
                  <p className="text-gray-600 text-sm mb-4">Help us understand fan preferences for upcoming castings</p>
                  
                  <div className="space-y-2">
                    {['Willem Dafoe', 'Barry Keoghan', 'Joe Keery', 'Someone completely new'].map((option, index) => (
                      <button 
                        key={index}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-purple-300 transition-colors"
                        data-testid={`poll-option-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-800">{option}</span>
                          <span className="text-sm text-gray-500">{Math.floor(Math.random() * 30 + 10)}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="text-sm text-gray-600">4.2k votes • Earn 5 points for participating</div>
                  <div className="text-sm text-blue-600 font-medium">+5 points</div>
                </div>
              </div>

              {/* Discovery Content - Trending */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="text-white" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Trending Now</div>
                    <div className="text-sm text-gray-500">What everyone's talking about</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { title: "House of the Dragon S2", category: "TV", trend: "+340%" },
                    { title: "Deadpool & Wolverine", category: "Movies", trend: "+250%" },
                    { title: "The Summer I Turned Pretty", category: "Books", trend: "+180%" },
                    { title: "Sabrina Carpenter", category: "Music", trend: "+420%" }
                  ].map((item, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-medium text-gray-900 text-sm">{item.title}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">{item.category}</span>
                        <span className="text-xs text-green-600 font-medium">{item.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="text-sm text-gray-600">Based on community activity</div>
                  <button className="text-sm text-green-600 font-medium hover:text-green-700">
                    See all trends
                  </button>
                </div>
              </div>

              {/* Creator Update Card - More Subtle */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                {/* Creator Info and Date */}
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🎵</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="font-semibold text-gray-900">Ariana Grande</div>
                      <Badge className="bg-purple-100 text-purple-700 text-xs px-2 py-1">Official</Badge>
                    </div>
                    <div className="text-sm text-gray-500">2 hours ago</div>
                  </div>
                </div>

                {/* Creator Update */}
                <div className="mb-4">
                  <p className="text-gray-800">Just finished recording my new album! The vocals are insane and I can't wait for you all to hear it. 💜</p>
                </div>

                {/* Interaction Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-6">
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
                      <Heart size={18} />
                      <span className="text-sm">1.2k</span>
                    </button>
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
                      <MessageCircle size={18} />
                      <span className="text-sm">89</span>
                    </button>
                  </div>
                </div>
              </div>


              {/* Book-to-Screen Discovery */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <Eye className="text-white" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Coming to Screen</div>
                    <div className="text-sm text-gray-500">Books getting adaptations</div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {[
                    { book: "Fourth Wing", author: "Rebecca Ross", platform: "Amazon Prime", status: "In Production" },
                    { book: "It Ends with Us", author: "Colleen Hoover", platform: "Sony Pictures", status: "Coming Aug 2024" },
                    { book: "The Atlas Six", author: "Olivie Blake", platform: "Netflix", status: "Early Development" }
                  ].map((item, index) => (
                    <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <BookOpen className="text-purple-500" size={16} />
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{item.book}</div>
                            <div className="text-xs text-gray-500">by {item.author}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-purple-600 font-medium">{item.platform}</div>
                          <div className="text-xs text-gray-500">{item.status}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="text-sm text-gray-600">Track these adaptations</div>
                  <button className="text-sm text-purple-600 font-medium hover:text-purple-700">
                    Add to watchlist
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="text-5xl mb-4">📡</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">No Activity Yet</h3>
              <p className="text-gray-600 max-w-sm mx-auto">
                The feed will show activity from you and other users as they start tracking their entertainment.
              </p>
            </div>
          )}
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

    </div>
  );
}