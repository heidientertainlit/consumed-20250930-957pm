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

  const hotTakes = [
    {
      id: "1",
      topicTitle: "Selling Sunset Finale",
      topicIcon: "📺",
      title: "Chelsea is 100% right and Mary needs to apologize",
      author: "sarah_tv",
      votes: 89,
      replyCount: 24,
      isHot: true,
      timeAgo: "2h ago",
    },
    {
      id: "2",
      topicTitle: "The Bear Season 3",
      topicIcon: "🍴",
      title: "Carmy is the worst character and ruins every scene",
      author: "foodie_critic",
      votes: 67,
      replyCount: 18,
      isHot: true,
      timeAgo: "4h ago",
    },
    {
      id: "3",
      topicTitle: "Awards Season",
      topicIcon: "🏆",
      title: "The Oscars are completely irrelevant in 2025",
      author: "film_buff",
      votes: 45,
      replyCount: 15,
      isHot: false,
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
            🔥 Hot Takes
          </h1>
          <p className="text-base text-gray-600">
            Share your boldest opinions. Vote on the spiciest takes.
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
          {/* Post Hot Take CTA */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-gray-900 font-semibold mb-1">🔥 Drop a Hot Take</h3>
                <p className="text-sm text-gray-600">Say something bold. Get upvotes. Win points.</p>
              </div>
              <Button
                data-testid="button-post-hot-take"
                onClick={() => setIsComposerOpen(true)}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                Post
              </Button>
            </div>
          </div>

          {/* All Hot Takes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-900">Hottest Takes</h2>
            </div>

            <div className="space-y-3">
              {hotTakes.map((take) => (
                <button
                  key={take.id}
                  data-testid={`button-hot-take-${take.id}`}
                  className="w-full text-left bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{take.topicIcon}</span>
                    <span className="text-xs text-gray-500" data-testid={`text-take-topic-${take.id}`}>{take.topicTitle}</span>
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-2" data-testid={`text-take-title-${take.id}`}>{take.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span data-testid={`text-take-author-${take.id}`}>by @{take.author}</span>
                    <span className="flex items-center gap-1 text-orange-500 font-semibold" data-testid={`text-take-votes-${take.id}`}>
                      <Flame className="w-3 h-3" />
                      {take.votes} upvotes
                    </span>
                    <span className="flex items-center gap-1" data-testid={`text-take-replies-${take.id}`}>
                      <MessageCircle className="w-3 h-3" />
                      {take.replyCount}
                    </span>
                    {take.isHot && (
                      <span className="flex items-center gap-1 text-red-500" data-testid={`text-take-hot-${take.id}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        On Fire
                      </span>
                    )}
                    <span className="ml-auto" data-testid={`text-take-time-${take.id}`}>{take.timeAgo}</span>
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
