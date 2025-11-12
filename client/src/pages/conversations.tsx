import { useState } from "react";
import { Search, TrendingUp, MessageCircle, Users, Clock, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ShareUpdateDialogV2 from "@/components/share-update-dialog-v2";
import Navigation from "@/components/navigation";

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
    <div className="min-h-screen bg-gray-50 pb-32">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Conversations
          </h1>
          <p className="text-base text-gray-600">
            Join discussions about the entertainment you love
          </p>
        </div>

        <div className="space-y-6">

          {/* Filter Pills */}
          <div className="flex gap-2 justify-center mb-6">
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
                    ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {/* Start Conversation CTA */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-gray-900 font-semibold mb-1">Start a Conversation</h3>
                <p className="text-sm text-gray-600">Share your thoughts on your favorite entertainment</p>
              </div>
              <Button
                data-testid="button-start-conversation"
                onClick={() => setIsComposerOpen(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
              >
                Create
              </Button>
            </div>
          </div>

          {/* All Threads */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-bold text-gray-900">All Conversations</h2>
            </div>

            <div className="space-y-3">
              {hotThreads.map((thread) => (
                <button
                  key={thread.id}
                  data-testid={`button-thread-${thread.id}`}
                  className="w-full text-left bg-white rounded-xl p-4 border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{thread.topicIcon}</span>
                    <span className="text-xs text-gray-500" data-testid={`text-thread-topic-${thread.id}`}>{thread.topicTitle}</span>
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-2" data-testid={`text-thread-title-${thread.id}`}>{thread.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span data-testid={`text-thread-author-${thread.id}`}>by @{thread.author}</span>
                    <span className="flex items-center gap-1" data-testid={`text-thread-replies-${thread.id}`}>
                      <MessageCircle className="w-3 h-3" />
                      {thread.replyCount}
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-thread-participants-${thread.id}`}>
                      <Users className="w-3 h-3" />
                      {thread.participantCount}
                    </span>
                    {thread.isActive && (
                      <span className="flex items-center gap-1 text-purple-500" data-testid={`text-thread-active-${thread.id}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        Active
                      </span>
                    )}
                    <span className="ml-auto" data-testid={`text-thread-time-${thread.id}`}>{thread.timeAgo}</span>
                  </div>
                </button>
              ))}
            </div>
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
