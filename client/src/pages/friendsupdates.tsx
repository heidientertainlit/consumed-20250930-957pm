import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Globe, Heart, MessageCircle, Share2, MoreHorizontal, Film, Tv, Music, Book } from "lucide-react";

export default function FriendsUpdates() {
  const [activeTab, setActiveTab] = useState("friends");

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Threads-style Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-2 bg-transparent border-b-0 h-auto p-0">
              <TabsTrigger 
                value="friends" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none py-4 text-gray-600 data-[state=active]:text-black"
                data-testid="tab-friends"
              >
                Friends
              </TabsTrigger>
              <TabsTrigger 
                value="everyone" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:shadow-none py-4 text-gray-600 data-[state=active]:text-black"
                data-testid="tab-everyone"
              >
                Everyone
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Friends Tab Content */}
          <TabsContent value="friends" className="mt-0">
            {/* Composer */}
            <div className="border-b border-gray-200 px-4 py-4">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  ME
                </div>
                <div className="flex-1">
                  <button className="text-gray-400 text-left w-full" data-testid="button-compose">
                    What's new?
                  </button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-sm font-semibold"
                  data-testid="button-post"
                >
                  Post
                </Button>
              </div>
            </div>

            {/* Empty State - No Friends */}
            <div className="text-center py-16 px-6">
              <div className="mb-4">
                <Users className="w-16 h-16 mx-auto text-gray-300" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Start tracking what you're watching!</h3>
              <p className="text-gray-500 mb-6">
                When you add friends, you'll see their updates here too.
              </p>
              <div className="flex gap-3 justify-center">
                <Button 
                  className="bg-black hover:bg-gray-800 text-white"
                  data-testid="button-find-friends"
                >
                  Find Friends
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Everyone Tab Content */}
          <TabsContent value="everyone" className="mt-0">
            {/* Composer */}
            <div className="border-b border-gray-200 px-4 py-4">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  ME
                </div>
                <div className="flex-1">
                  <button className="text-gray-400 text-left w-full">
                    What's new?
                  </button>
                </div>
                <Button variant="outline" size="sm" className="text-sm font-semibold">
                  Post
                </Button>
              </div>
            </div>

            {/* Sample Posts - Threads Style */}
            <div>
              {/* Post 1: Text-only post */}
              <div className="border-b border-gray-200 px-4 py-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    JD
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">johndoe</span>
                      <span className="text-gray-500 text-sm">2h</span>
                      <MoreHorizontal className="w-4 h-4 text-gray-400 ml-auto cursor-pointer" />
                    </div>
                    <p className="text-gray-900 mb-3">
                      Just finished watching <span className="font-semibold text-purple-600 cursor-pointer hover:underline">Stranger Things S4</span> 🔥 That ending was insane!
                    </p>
                    
                    {/* Engagement */}
                    <div className="flex items-center gap-6 text-gray-500">
                      <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors" data-testid="button-like">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">24</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">8</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Post 2: With small inline media mention */}
              <div className="border-b border-gray-200 px-4 py-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    SK
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">sarahk</span>
                      <span className="text-gray-500 text-sm">5h</span>
                      <MoreHorizontal className="w-4 h-4 text-gray-400 ml-auto cursor-pointer" />
                    </div>
                    <p className="text-gray-900 mb-3">
                      Added to my queue
                    </p>
                    
                    {/* Small inline media card */}
                    <div className="border border-gray-200 rounded-lg p-2.5 mb-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="flex gap-2.5 items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                          <Film className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">The Last of Us</p>
                          <p className="text-xs text-gray-500">TV Series</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Engagement */}
                    <div className="flex items-center gap-6 text-gray-500">
                      <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">12</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">3</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Post 3: With LARGE poster (trending/multiple people discussing) */}
              <div className="border-b border-gray-200 px-4 py-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    MR
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">mikeross</span>
                      <span className="text-gray-500 text-sm">8h</span>
                      <MoreHorizontal className="w-4 h-4 text-gray-400 ml-auto cursor-pointer" />
                    </div>
                    <p className="text-gray-900 mb-3">
                      This movie is absolutely incredible! ⭐⭐⭐⭐⭐
                    </p>
                    
                    {/* Large poster card (when trending or multiple friends watching) */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="aspect-video bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Film className="w-16 h-16 text-white opacity-50" />
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-gray-900 mb-0.5">Inception</p>
                        <p className="text-sm text-gray-500 mb-2">2010 · Christopher Nolan</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          <span>3 friends are watching this</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Engagement */}
                    <div className="flex items-center gap-6 text-gray-500">
                      <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors">
                        <Heart className="w-4 h-4" />
                        <span className="text-sm">45</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">12</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Navigation />
    </div>
  );
}
