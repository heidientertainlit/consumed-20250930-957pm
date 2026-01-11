import { useState } from "react";
import { Link } from "wouter";
import Navigation from "@/components/navigation";
import { 
  Plus, 
  Flame, 
  Zap, 
  Trophy, 
  MessageCircle,
  Heart,
  ChevronRight,
  Gamepad2,
  Star,
  TrendingUp,
  Users,
  Play,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DailyChallengeCard } from "@/components/daily-challenge-card";

export default function BlendedFeed() {
  const [activeTab, setActiveTab] = useState<'for-you' | 'friends'>('for-you');

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Navigation onTrackConsumption={() => {}} />

      {/* Header - Same energy as current feed */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-lg mx-auto px-4 pt-6">
          <div className="text-center mb-5">
            <h1 className="text-white text-2xl font-bold tracking-tight">
              Where entertainment<br />comes together
            </h1>
            <p className="text-gray-400 text-sm mt-2">Play, react, and keep up with what you love.</p>
          </div>

          {/* EVOLUTION: Quick Actions Bar - replaces single button */}
          <div className="flex gap-2 mb-5">
            <Link href="/quick-log" className="flex-1">
              <Button className="w-full h-12 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                Log
              </Button>
            </Link>
            <Link href="/play" className="flex-1">
              <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-xl font-bold flex items-center justify-center gap-2">
                <Gamepad2 className="w-5 h-5" />
                Play
              </Button>
            </Link>
            <Button variant="outline" className="h-12 px-4 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl">
              <Flame className="w-5 h-5 text-orange-400" />
            </Button>
          </div>

          {/* Daily Challenge - stays prominent */}
          <DailyChallengeCard />
        </div>
      </div>

      {/* Feed Content */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        
        {/* Feed Tabs */}
        <div className="flex gap-2 mb-4">
          <button 
            onClick={() => setActiveTab('for-you')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'for-you' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            For You
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'friends' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            Friends
          </button>
        </div>

        {/* === BLENDED FEED ITEMS === */}
        <div className="space-y-4">

          {/* GAME PROMPT (Woven In) - This is the magic */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider mb-3">
                <Sparkles className="w-3 h-3" />
                Challenge Unlocked
              </div>
              <p className="text-gray-800 font-medium mb-3">
                <span className="text-purple-600">@sarah</span> just finished <span className="font-bold">Gladiator II</span>. Think you know it better?
              </p>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 rounded-xl h-9 px-4 font-bold flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                Challenge Her to Trivia
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">+15 XP</span>
              </Button>
            </CardContent>
          </Card>

          {/* REGULAR POST (Friend Activity) - Same as current */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=mike" />
                  <AvatarFallback>M</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">mike_watches</span>
                    <span className="text-xs text-gray-500">2h ago</span>
                  </div>
                  <p className="text-sm text-gray-600">finished watching</p>
                </div>
              </div>
              
              {/* Media Card */}
              <div className="bg-gray-100 rounded-xl p-3 flex gap-3 mb-3">
                <img 
                  src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=80&h=120&fit=crop" 
                  className="w-16 h-24 rounded-lg object-cover"
                  alt="Movie"
                />
                <div className="flex-1 pt-1">
                  <h4 className="font-bold text-gray-900">The Penguin</h4>
                  <p className="text-xs text-gray-500">TV • 2024</p>
                  <div className="flex gap-1 mt-2 text-yellow-500">
                    {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
                  </div>
                </div>
              </div>

              {/* Interactions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1 text-gray-500 hover:text-red-500">
                    <Heart className="w-5 h-5" />
                    <span className="text-sm">24</span>
                  </button>
                  <button className="flex items-center gap-1 text-gray-500 hover:text-purple-500">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">3</span>
                  </button>
                </div>
                <span className="text-xs text-gray-400">+10 XP earned</span>
              </div>
            </CardContent>
          </Card>

          {/* HOT TAKE (Gamified) - Evolution of current */}
          <Card className="bg-white border-gray-200 border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-bold">
                  <Flame className="w-3 h-3" />
                  HOT TAKE
                </div>
                <span className="text-xs text-gray-500">🔥 127 votes</span>
              </div>
              
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="w-10 h-10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=alex" />
                  <AvatarFallback>A</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-bold text-gray-900">alex_cinema</span>
                  <p className="text-gray-800 mt-1 text-lg font-medium">
                    "Gladiator II is better than the original. Russell Crowe was mid."
                  </p>
                </div>
              </div>

              {/* Voting - This is the game element */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-12 rounded-xl border-2 hover:bg-orange-50 hover:border-orange-500 font-bold flex items-center justify-center gap-2">
                  🌶️ SPICY
                  <span className="text-xs text-gray-500">68%</span>
                </Button>
                <Button variant="outline" className="flex-1 h-12 rounded-xl border-2 hover:bg-blue-50 hover:border-blue-500 font-bold flex items-center justify-center gap-2">
                  ❄️ COLD
                  <span className="text-xs text-gray-500">32%</span>
                </Button>
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">Vote to earn +5 XP</p>
            </CardContent>
          </Card>

          {/* LEADERBOARD TEASER (Woven In) */}
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-yellow-700 uppercase tracking-wider">
                  <Trophy className="w-3 h-3" />
                  Weekly Leaderboard
                </div>
                <Link href="/leaderboard">
                  <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                    View All <ChevronRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              
              <div className="space-y-2">
                {[
                  { rank: 1, name: "sarah_reviews", points: 2840, avatar: "sarah" },
                  { rank: 2, name: "mike_watches", points: 2650, avatar: "mike" },
                  { rank: 3, name: "you", points: 2420, avatar: "you", isYou: true },
                ].map((user) => (
                  <div 
                    key={user.rank} 
                    className={`flex items-center gap-3 p-2 rounded-xl ${user.isYou ? 'bg-purple-100 border border-purple-200' : ''}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      user.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                      user.rank === 2 ? 'bg-gray-300 text-gray-700' :
                      'bg-orange-300 text-orange-800'
                    }`}>
                      {user.rank}
                    </span>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar}`} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className={`flex-1 font-medium ${user.isYou ? 'text-purple-700' : 'text-gray-800'}`}>
                      {user.isYou ? 'You' : user.name}
                    </span>
                    <span className="text-sm font-bold text-gray-600">{user.points.toLocaleString()} XP</span>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-center text-yellow-700 mt-3 font-medium">
                You're 220 XP away from #2! 🚀
              </p>
            </CardContent>
          </Card>

          {/* ANOTHER REGULAR POST */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=emma" />
                  <AvatarFallback>E</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">emma_reads</span>
                    <span className="text-xs text-gray-500">5h ago</span>
                  </div>
                  <p className="text-sm text-gray-600">added to Watchlist</p>
                </div>
              </div>
              
              <div className="bg-gray-100 rounded-xl p-3 flex gap-3">
                <img 
                  src="https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=80&h=120&fit=crop" 
                  className="w-16 h-24 rounded-lg object-cover"
                  alt="Movie"
                />
                <div className="flex-1 pt-1">
                  <h4 className="font-bold text-gray-900">Dune: Part Two</h4>
                  <p className="text-xs text-gray-500">Movie • 2024</p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs rounded-lg">
                    Add to your list
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* POLL (Game Element) */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 bg-purple-100 text-purple-600 px-2 py-1 rounded-full text-xs font-bold">
                  <Play className="w-3 h-3 fill-current" />
                  POLL
                </div>
                <span className="text-xs text-gray-500">89 votes • 2h left</span>
              </div>

              <p className="text-gray-900 font-bold text-lg mb-4">
                Best villain performance of 2024?
              </p>

              <div className="space-y-2">
                {[
                  { option: "Colin Farrell - The Penguin", percent: 45 },
                  { option: "Pedro Pascal - Gladiator II", percent: 32 },
                  { option: "Ralph Fiennes - Conclave", percent: 23 },
                ].map((opt, i) => (
                  <button 
                    key={i}
                    className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left flex items-center justify-between"
                  >
                    <span className="font-medium">{opt.option}</span>
                    <span className="text-sm text-gray-500">{opt.percent}%</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-gray-400 mt-3">Vote to earn +5 XP</p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
