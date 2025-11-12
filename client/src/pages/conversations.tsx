import { useState } from "react";
import { Search, TrendingUp, MessageCircle, Users, Clock, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ShareUpdateDialogV2 from "@/components/share-update-dialog-v2";

export default function ConversationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"hot" | "new" | "top">("hot");
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Mock data for now - will be replaced with actual API calls
  const trendingTopics = [
    {
      id: "1",
      title: "Selling Sunset Finale",
      icon: "📺",
      posterUrl: "https://image.tmdb.org/t/p/w92/fWlMNTPNP8S5fnwEHRcdzwdEhye.jpg",
      postCount: 42,
      participantCount: 12,
      topThreads: [
        { id: "1", title: "Chelsea vs Mary - who's right?", replyCount: 24, isActive: false },
        { id: "2", title: "That finale cliffhanger!! 😱", replyCount: 15, isActive: true },
      ],
    },
    {
      id: "2",
      title: "The Bear Season 3",
      icon: "🍴",
      posterUrl: "https://image.tmdb.org/t/p/w92/zey57p6nBPUsZJwakiqcULPJdJz.jpg",
      postCount: 23,
      participantCount: 6,
      topThreads: [
        { id: "3", title: "Ranking all episodes", replyCount: 18, isActive: false },
        { id: "4", title: "Sydney and Carmy chemistry?", replyCount: 12, isActive: true },
      ],
    },
    {
      id: "3",
      title: "Reality TV Drama",
      icon: "🎭",
      posterUrl: null,
      postCount: 17,
      participantCount: 8,
      topThreads: [
        { id: "5", title: "Best reality TV moments of 2025", replyCount: 9, isActive: false },
      ],
    },
  ];

  const hotThreads = [
    {
      id: "1",
      topicTitle: "Selling Sunset Finale",
      topicIcon: "📺",
      title: "Chelsea vs Mary - who's right?",
      author: "sarah_tv",
      replyCount: 89,
      participantCount: 24,
      isActive: true,
      timeAgo: "2h ago",
    },
    {
      id: "2",
      topicTitle: "The Bear Season 3",
      topicIcon: "🍴",
      title: "Will Taylor Swift win Album of the Year?",
      author: "musicfan",
      replyCount: 67,
      participantCount: 18,
      isActive: true,
      timeAgo: "4h ago",
    },
    {
      id: "3",
      topicTitle: "Awards Season",
      topicIcon: "🏆",
      title: "Best Picture predictions discussion",
      author: "film_buff",
      replyCount: 45,
      participantCount: 15,
      isActive: false,
      timeAgo: "6h ago",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-white">Conversations</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:ring-orange-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 mt-3">
            {[
              { id: "hot" as const, label: "🔥 Hot", icon: Flame },
              { id: "new" as const, label: "⏱️ New", icon: Clock },
              { id: "top" as const, label: "📈 Top", icon: TrendingUp },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeFilter === filter.id
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Start Conversation CTA */}
        <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-1">Start a Conversation</h3>
              <p className="text-sm text-gray-300">Share your thoughts on your favorite entertainment</p>
            </div>
            <Button
              onClick={() => setIsComposerOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              Create
            </Button>
          </div>
        </div>

        {/* Trending Topics */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-bold text-white">Trending Conversations</h2>
          </div>

          <div className="space-y-3">
            {trendingTopics.map((topic) => (
              <div
                key={topic.id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 hover:border-orange-500/50 transition-all"
              >
                {/* Topic Header */}
                <div className="flex items-center gap-3 mb-3">
                  {topic.posterUrl ? (
                    <img
                      src={topic.posterUrl}
                      alt={topic.title}
                      className="w-12 h-16 object-cover rounded shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-gradient-to-br from-orange-500 to-purple-500 rounded flex items-center justify-center text-2xl">
                      {topic.icon}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{topic.title}</h3>
                    <p className="text-sm text-gray-400">
                      {topic.postCount} posts • {topic.participantCount} talking
                    </p>
                  </div>
                </div>

                {/* Top Threads */}
                <div className="space-y-2 mb-3">
                  {topic.topThreads.map((thread) => (
                    <button
                      key={thread.id}
                      className="w-full text-left bg-gray-900/50 hover:bg-gray-900 rounded-lg p-3 transition-colors border border-gray-700/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium mb-1">{thread.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{thread.replyCount} replies</span>
                            {thread.isActive && (
                              <span className="flex items-center gap-1 text-orange-500">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                Active Now
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* View All Button */}
                <Button
                  variant="ghost"
                  className="w-full text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                >
                  View All {topic.title} Conversations →
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Hot Threads */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold text-white">Hot Right Now</h2>
          </div>

          <div className="space-y-3">
            {hotThreads.map((thread) => (
              <button
                key={thread.id}
                className="w-full text-left bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 hover:border-orange-500/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{thread.topicIcon}</span>
                  <span className="text-xs text-gray-400">{thread.topicTitle}</span>
                </div>
                <h3 className="text-white font-semibold mb-2">{thread.title}</h3>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>by @{thread.author}</span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {thread.replyCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {thread.participantCount}
                  </span>
                  {thread.isActive && (
                    <span className="flex items-center gap-1 text-orange-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      Active
                    </span>
                  )}
                  <span className="ml-auto">{thread.timeAgo}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Composer Dialog */}
      <ShareUpdateDialogV2
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
      />
    </div>
  );
}
