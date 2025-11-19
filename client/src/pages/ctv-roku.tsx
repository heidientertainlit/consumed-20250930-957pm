import { useState } from 'react';
import { Play, Trophy, TrendingUp, Users, MessageSquare, Target, Award, Star } from 'lucide-react';

export default function CTVRoku() {
  const [focusedSection, setFocusedSection] = useState('feed');

  const navItems = [
    { id: 'feed', label: 'Feed', icon: MessageSquare },
    { id: 'watch', label: 'Watch Together', icon: Play },
    { id: 'predictions', label: 'Predictions', icon: Target },
    { id: 'leaders', label: 'Leaders', icon: Trophy },
  ];

  const heroConversations = [
    {
      user: 'Alex Chen',
      avatar: '👤',
      content: 'Just finished The Bear S3... that finale has me SHOOK 🤯',
      media: 'The Bear',
      reactions: 47,
      comments: 23,
    },
    {
      user: 'Mia Patel',
      avatar: '👤',
      content: 'Hot take: Poor Things is the most underrated film of 2024',
      media: 'Poor Things',
      reactions: 89,
      comments: 34,
    },
  ];

  const livePredictions = [
    {
      question: 'Will Succession win Best Drama?',
      endsIn: '2h 14m',
      participants: 1247,
      options: ['Yes 67%', 'No 33%'],
    },
    {
      question: 'What gets renewed first?',
      endsIn: '5h 30m',
      participants: 892,
      options: ['Severance', 'White Lotus', 'Last of Us'],
    },
    {
      question: 'Best new show of the week?',
      endsIn: '1d 3h',
      participants: 2103,
      options: ['Fallout', 'Baby Reindeer', '3 Body Problem'],
    },
  ];

  const weeklyLeaders = [
    { name: 'Jordan Taylor', username: '@jordantaylor', points: 1247, rank: 1 },
    { name: 'Sarah Kim', username: '@sarahkim', points: 1089, rank: 2 },
    { name: 'Marcus Jones', username: '@marcusjones', points: 967, rank: 3 },
  ];

  const trendingTopics = [
    { title: 'The Bear S3 Finale', posts: 342 },
    { title: 'Dune 2 Discussion', posts: 289 },
    { title: 'Shogun Episode 8', posts: 256 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black text-white overflow-hidden">
      {/* 16:9 Safe Zone Container */}
      <div className="w-full h-screen flex">
        {/* Left Navigation Rail - Roku Style */}
        <div className="w-64 bg-black/40 backdrop-blur-sm border-r border-white/10 p-6 flex flex-col">
          <div className="mb-12">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              consumed
            </h1>
            <p className="text-sm text-purple-300 mt-1">for Roku</p>
          </div>

          <nav className="space-y-3 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isFocused = focusedSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setFocusedSection(item.id)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all ${
                    isFocused
                      ? 'bg-purple-600 scale-105 shadow-lg shadow-purple-500/50'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Icon size={28} />
                  <span className="text-xl font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10">
            <p className="text-xs text-gray-400">Press ✦ to select</p>
            <p className="text-xs text-gray-400">Use ◀ ▶ ▲ ▼ to navigate</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Hero Section - Live Conversations */}
          <section>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <MessageSquare size={32} className="text-purple-400" />
              What People Are Saying Right Now
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {heroConversations.map((conv, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-2xl">
                      {conv.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{conv.user}</p>
                      <p className="text-sm text-purple-300">{conv.media}</p>
                    </div>
                  </div>
                  <p className="text-xl leading-relaxed mb-4">{conv.content}</p>
                  <div className="flex gap-6 text-sm text-gray-300">
                    <span>❤️ {conv.reactions}</span>
                    <span>💬 {conv.comments}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Live Predictions - Horizontal Rail */}
          <section>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Target size={32} className="text-blue-400" />
              Live Predictions
              <span className="ml-auto text-sm text-gray-400 font-normal">Join & Win Points</span>
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-4">
              {livePredictions.map((pred, idx) => (
                <div
                  key={idx}
                  className="min-w-[400px] bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-md rounded-2xl p-6 border-2 border-blue-400/30 hover:border-blue-400 transition-all cursor-pointer"
                >
                  <div className="mb-4">
                    <div className="text-xs text-blue-300 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      LIVE • Ends in {pred.endsIn}
                    </div>
                    <p className="text-2xl font-bold mb-2">{pred.question}</p>
                    <p className="text-sm text-gray-300">{pred.participants.toLocaleString()} playing</p>
                  </div>
                  <div className="space-y-2">
                    {pred.options.map((option, i) => (
                      <div
                        key={i}
                        className="bg-white/10 rounded-lg px-4 py-3 hover:bg-white/20 transition-colors"
                      >
                        <p className="text-lg">{option}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Two Column: Leaders & Trending */}
          <div className="grid grid-cols-2 gap-6">
            {/* Weekly Leaders */}
            <section>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Trophy size={32} className="text-yellow-400" />
                Weekly Leaders
              </h2>
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="space-y-4">
                  {weeklyLeaders.map((leader) => (
                    <div
                      key={leader.rank}
                      className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${
                        leader.rank === 1 ? 'bg-yellow-500' : leader.rank === 2 ? 'bg-gray-400' : 'bg-orange-600'
                      }`}>
                        {leader.rank}
                      </div>
                      <div className="flex-1">
                        <p className="text-xl font-semibold">{leader.name}</p>
                        <p className="text-sm text-gray-400">{leader.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-400">{leader.points}</p>
                        <p className="text-xs text-gray-400">points</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Trending Topics */}
            <section>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <TrendingUp size={32} className="text-green-400" />
                Trending Now
              </h2>
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="space-y-4">
                  {trendingTopics.map((topic, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <p className="text-xl font-semibold mb-1">{topic.title}</p>
                      <p className="text-sm text-gray-400">{topic.posts} posts</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Value Prop Footer */}
          <section className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl p-8 border border-purple-400/30">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-5xl mb-3">💬</div>
                <p className="text-xl font-bold mb-2">Social Layer</p>
                <p className="text-sm text-gray-300">Talk about what you watch, right on your TV</p>
              </div>
              <div>
                <div className="text-5xl mb-3">🎯</div>
                <p className="text-xl font-bold mb-2">Make Predictions</p>
                <p className="text-sm text-gray-300">Compete with friends on what happens next</p>
              </div>
              <div>
                <div className="text-5xl mb-3">🏆</div>
                <p className="text-xl font-bold mb-2">Earn Rewards</p>
                <p className="text-sm text-gray-300">Climb leaderboards and unlock benefits</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
