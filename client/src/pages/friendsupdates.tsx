import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Globe, Plus, Heart, MessageCircle, Share2 } from "lucide-react";

export default function FriendsUpdates() {
  const [activeTab, setActiveTab] = useState("friends");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 text-white pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">What's Everyone Watching</h1>
          <p className="text-gray-300">See what your friends are into right now</p>
        </div>

        {/* Friends / Everyone Toggle */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
            <TabsTrigger 
              value="friends" 
              className="data-[state=active]:bg-purple-600"
              data-testid="tab-friends"
            >
              <Users className="w-4 h-4 mr-2" />
              Friends
            </TabsTrigger>
            <TabsTrigger 
              value="everyone" 
              className="data-[state=active]:bg-purple-600"
              data-testid="tab-everyone"
            >
              <Globe className="w-4 h-4 mr-2" />
              Everyone
            </TabsTrigger>
          </TabsList>

          {/* Friends Tab Content */}
          <TabsContent value="friends" className="mt-6">
            {/* Empty State - No Friends */}
            <div className="text-center py-12 px-6">
              <div className="mb-4">
                <Users className="w-16 h-16 mx-auto text-purple-400 opacity-50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Start tracking what you're watching!</h3>
              <p className="text-gray-400 mb-6">
                When you add friends, you'll see their updates here too.
              </p>
              <div className="flex gap-3 justify-center">
                <Button 
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="button-track-now"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Track Now
                </Button>
                <Button 
                  variant="outline" 
                  className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
                  data-testid="button-find-friends"
                >
                  Find Friends
                </Button>
              </div>
            </div>

            {/* Sample Post (for UI reference - will show when there's data) */}
            <div className="hidden bg-gray-800/30 rounded-lg p-4 mb-4 border border-gray-700/50">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                  JD
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">johndoe</span>
                    <span className="text-gray-400 text-sm">2h ago</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">
                    Just finished watching this! 🔥
                  </p>
                  
                  {/* Media Card */}
                  <div className="bg-gray-900/50 rounded-lg p-3 flex gap-3">
                    <div className="w-16 h-24 bg-gray-700 rounded flex-shrink-0"></div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Stranger Things S4</h4>
                      <p className="text-sm text-gray-400 mb-2">Netflix Series</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <div key={star} className="w-4 h-4 text-yellow-500">★</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Row */}
              <div className="flex items-center gap-4 pt-3 border-t border-gray-700/50">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-pink-400">
                  <Heart className="w-4 h-4 mr-1" />
                  12
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-purple-400">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  3
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400">
                  <Share2 className="w-4 h-4 mr-1" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Everyone Tab Content */}
          <TabsContent value="everyone" className="mt-6">
            {/* Sample Posts for Everyone feed */}
            <div className="space-y-4">
              {[1, 2, 3].map((index) => (
                <div key={index} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold">
                      U{index}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">user{index}</span>
                        <span className="text-gray-400 text-sm">{index}h ago</span>
                      </div>
                      <p className="text-gray-300 text-sm mb-3">
                        Added to Currently Watching
                      </p>
                      
                      {/* Media Card */}
                      <div className="bg-gray-900/50 rounded-lg p-3 flex gap-3">
                        <div className="w-16 h-24 bg-gray-700 rounded flex-shrink-0"></div>
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">Sample Title {index}</h4>
                          <p className="text-sm text-gray-400">Media Type</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Row */}
                  <div className="flex items-center gap-4 pt-3 border-t border-gray-700/50">
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-pink-400">
                      <Heart className="w-4 h-4 mr-1" />
                      {Math.floor(Math.random() * 20)}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-purple-400">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      {Math.floor(Math.random() * 10)}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400">
                      <Share2 className="w-4 h-4 mr-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Navigation />
    </div>
  );
}
