import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  User, Users, Star, Trophy, Heart, Share2, ExternalLink, 
  Globe, ShoppingBag, Film, Tv, Music, BookOpen, Sparkles,
  CheckCircle, Bell, Lock, Crown, MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";

export default function CreatorProfile() {
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isInnerCircle, setIsInnerCircle] = useState(false);

  const creator = {
    id: "creator-demo-1",
    username: "filmcritic_sarah",
    displayName: "Sarah Chen",
    avatar: null,
    bio: "Film critic & entertainment journalist. I review movies, dissect TV shows, and share my honest takes. Join my Inner Circle for exclusive early reviews!",
    isVerified: true,
    followers: 12847,
    innerCircleMembers: 342,
    points: 89420,
    website: "https://sarahreviews.com",
    shopLink: "https://shop.sarahreviews.com",
    stats: {
      movies: 847,
      tvShows: 156,
      books: 89,
      music: 234
    },
    recentContent: [
      { title: "My Top 10 Films of 2024", type: "list", likes: 2341 },
      { title: "Is Dune Part 3 Happening?", type: "prediction", votes: 8923 },
      { title: "Why Nosferatu is a Masterpiece", type: "review", likes: 1256 }
    ],
    innerCirclePerks: [
      "Early access to reviews (24hrs before public)",
      "Monthly exclusive Q&A sessions",
      "Vote on what I review next",
      "Behind-the-scenes content"
    ]
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    toast({
      title: isFollowing ? "Unfollowed" : "Following!",
      description: isFollowing 
        ? `You unfollowed @${creator.username}` 
        : `You're now following @${creator.username}`
    });
  };

  const handleJoinInnerCircle = () => {
    if (isInnerCircle) {
      setIsInnerCircle(false);
      toast({
        title: "Left Inner Circle",
        description: "You've left the Inner Circle"
      });
    } else {
      setIsInnerCircle(true);
      setIsFollowing(true);
      toast({
        title: "Welcome to the Inner Circle!",
        description: "You now have access to exclusive content"
      });
    }
  };

  const handleShare = async () => {
    try {
      await copyLink({ kind: 'profile', id: creator.id });
      toast({
        title: "Link copied!",
        description: "Share this creator's profile"
      });
    } catch (error) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950">
      <div className="max-w-lg mx-auto pb-24">
        {/* Header */}
        <div className="relative">
          {/* Banner gradient */}
          <div className="h-32 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400" />
          
          {/* Profile section */}
          <div className="px-4 -mt-12">
            {/* Avatar */}
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-4 border-gray-950 flex items-center justify-center">
                <User size={40} className="text-white" />
              </div>
              {creator.isVerified && (
                <div className="absolute -right-1 -bottom-1 bg-purple-600 rounded-full p-1">
                  <CheckCircle size={18} className="text-white" />
                </div>
              )}
            </div>

            {/* Name & Username */}
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{creator.displayName}</h1>
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs">
                  Creator
                </Badge>
              </div>
              <p className="text-gray-400 text-sm">@{creator.username}</p>
            </div>

            {/* Bio */}
            <p className="text-gray-300 text-sm mt-3 leading-relaxed">{creator.bio}</p>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1">
                <Users size={14} className="text-purple-400" />
                <span className="text-white font-semibold">{creator.followers.toLocaleString()}</span>
                <span className="text-gray-400">followers</span>
              </div>
              <div className="flex items-center gap-1">
                <Crown size={14} className="text-yellow-400" />
                <span className="text-white font-semibold">{creator.innerCircleMembers}</span>
                <span className="text-gray-400">inner circle</span>
              </div>
              <div className="flex items-center gap-1">
                <Star size={14} className="text-yellow-400" />
                <span className="text-white font-semibold">{(creator.points / 1000).toFixed(1)}k</span>
                <span className="text-gray-400">pts</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleFollow}
                className={`flex-1 ${
                  isFollowing 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                data-testid="follow-button"
              >
                {isFollowing ? (
                  <>
                    <CheckCircle size={16} className="mr-1" />
                    Following
                  </>
                ) : (
                  <>
                    <Bell size={16} className="mr-1" />
                    Follow
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleJoinInnerCircle}
                className={`flex-1 ${
                  isInnerCircle 
                    ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                }`}
                data-testid="inner-circle-button"
              >
                <Crown size={16} className="mr-1" />
                {isInnerCircle ? 'Inner Circle ✓' : 'Join My Inner Circle'}
              </Button>
              
              <Button
                onClick={handleShare}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                data-testid="share-creator-button"
              >
                <Share2 size={16} />
              </Button>
            </div>

            {/* External Links */}
            <div className="flex gap-2 mt-3">
              {creator.website && (
                <a 
                  href={creator.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-gray-300 transition-colors"
                  data-testid="website-link"
                >
                  <Globe size={14} />
                  Website
                  <ExternalLink size={12} />
                </a>
              )}
              {creator.shopLink && (
                <a 
                  href={creator.shopLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-gray-300 transition-colors"
                  data-testid="shop-link"
                >
                  <ShoppingBag size={14} />
                  Shop
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Inner Circle Perks Card */}
        <div className="px-4 mt-6">
          <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/30 border-purple-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown size={18} className="text-yellow-400" />
                <h3 className="font-semibold text-white">Inner Circle Perks</h3>
                {!isInnerCircle && (
                  <Badge variant="outline" className="ml-auto border-purple-500 text-purple-300 text-xs">
                    <Lock size={10} className="mr-1" />
                    Members Only
                  </Badge>
                )}
              </div>
              <ul className="space-y-2">
                {creator.innerCirclePerks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Sparkles size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className={isInnerCircle ? 'text-gray-200' : 'text-gray-400'}>{perk}</span>
                  </li>
                ))}
              </ul>
              {!isInnerCircle && (
                <Button
                  onClick={handleJoinInnerCircle}
                  className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  data-testid="join-inner-circle-cta"
                >
                  <Crown size={16} className="mr-2" />
                  Join for Exclusive Access
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Consumption Stats */}
        <div className="px-4 mt-6">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-purple-400" />
            Entertainment Stats
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <Film size={20} className="text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{creator.stats.movies}</div>
              <div className="text-xs text-gray-400">Movies</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <Tv size={20} className="text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{creator.stats.tvShows}</div>
              <div className="text-xs text-gray-400">TV Shows</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <BookOpen size={20} className="text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{creator.stats.books}</div>
              <div className="text-xs text-gray-400">Books</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <Music size={20} className="text-pink-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{creator.stats.music}</div>
              <div className="text-xs text-gray-400">Albums</div>
            </div>
          </div>
        </div>

        {/* Recent Content */}
        <div className="px-4 mt-6">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            Recent Content
          </h3>
          <div className="space-y-2">
            {creator.recentContent.map((content, i) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700 hover:border-purple-600/50 transition-colors cursor-pointer">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{content.title}</div>
                    <div className="text-xs text-gray-400 capitalize">{content.type}</div>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <Heart size={14} />
                    <span>{content.likes?.toLocaleString() || content.votes?.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      
      <Navigation />
    </div>
  );
}
