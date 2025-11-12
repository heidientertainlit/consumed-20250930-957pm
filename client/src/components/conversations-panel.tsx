import { useState } from "react";
import { TrendingUp, MessageCircle, Users, Clock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConversationsPanelProps {
  onStartConversation: () => void;
}

export default function ConversationsPanel({ onStartConversation }: ConversationsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<"hot" | "new" | "top">("hot");

  // TODO: Replace with actual API calls to conversation edge functions
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
    <div className="space-y-6">
      {/* Filter Pills */}
      <div className="flex gap-2">
        {[
          { id: "hot" as const, label: "🔥 Hot" },
          { id: "new" as const, label: "⏱️ New" },
          { id: "top" as const, label: "📈 Top" },
        ].map((filter) => (
          <button
            key={filter.id}
            data-testid={`button-filter-${filter.id}`}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeFilter === filter.id
                ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Start Conversation CTA */}
      <div className="bg-gradient-to-r from-orange-50 to-purple-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 font-semibold mb-1">Start a Conversation</h3>
            <p className="text-sm text-gray-600">Share your thoughts on your favorite entertainment</p>
          </div>
          <Button
            data-testid="button-start-conversation"
            onClick={onStartConversation}
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
          <h2 className="text-xl font-bold text-gray-900">Trending Conversations</h2>
        </div>

        <div className="space-y-3">
          {trendingTopics.map((topic) => (
            <div
              key={topic.id}
              data-testid={`card-topic-${topic.id}`}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all"
            >
              {/* Topic Header */}
              <div className="flex items-center gap-3 mb-3">
                {topic.posterUrl ? (
                  <img
                    src={topic.posterUrl}
                    alt={topic.title}
                    className="w-12 h-16 object-cover rounded shadow-sm"
                    data-testid={`img-topic-poster-${topic.id}`}
                  />
                ) : (
                  <div className="w-12 h-16 bg-gradient-to-br from-orange-500 to-purple-500 rounded flex items-center justify-center text-2xl">
                    {topic.icon}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold" data-testid={`text-topic-title-${topic.id}`}>
                    {topic.title}
                  </h3>
                  <p className="text-sm text-gray-500" data-testid={`text-topic-stats-${topic.id}`}>
                    {topic.postCount} posts • {topic.participantCount} talking
                  </p>
                </div>
              </div>

              {/* Top Threads */}
              <div className="space-y-2 mb-3">
                {topic.topThreads.map((thread) => (
                  <button
                    key={thread.id}
                    data-testid={`button-thread-${thread.id}`}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition-colors border border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 font-medium mb-1" data-testid={`text-thread-title-${thread.id}`}>
                          {thread.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span data-testid={`text-thread-replies-${thread.id}`}>{thread.replyCount} replies</span>
                          {thread.isActive && (
                            <span className="flex items-center gap-1 text-orange-500" data-testid={`text-thread-active-${thread.id}`}>
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
                data-testid={`button-view-all-topic-${topic.id}`}
                variant="ghost"
                className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50"
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
          <h2 className="text-xl font-bold text-gray-900">Hot Right Now</h2>
        </div>

        <div className="space-y-3">
          {hotThreads.map((thread) => (
            <button
              key={thread.id}
              data-testid={`button-hot-thread-${thread.id}`}
              className="w-full text-left bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{thread.topicIcon}</span>
                <span className="text-xs text-gray-500" data-testid={`text-hot-thread-topic-${thread.id}`}>
                  {thread.topicTitle}
                </span>
              </div>
              <h3 className="text-gray-900 font-semibold mb-2" data-testid={`text-hot-thread-title-${thread.id}`}>
                {thread.title}
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span data-testid={`text-hot-thread-author-${thread.id}`}>by @{thread.author}</span>
                <span className="flex items-center gap-1" data-testid={`text-hot-thread-replies-${thread.id}`}>
                  <MessageCircle className="w-3 h-3" />
                  {thread.replyCount}
                </span>
                <span className="flex items-center gap-1" data-testid={`text-hot-thread-participants-${thread.id}`}>
                  <Users className="w-3 h-3" />
                  {thread.participantCount}
                </span>
                {thread.isActive && (
                  <span className="flex items-center gap-1 text-orange-500" data-testid={`text-hot-thread-active-${thread.id}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    Active
                  </span>
                )}
                <span className="ml-auto" data-testid={`text-hot-thread-time-${thread.id}`}>{thread.timeAgo}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
