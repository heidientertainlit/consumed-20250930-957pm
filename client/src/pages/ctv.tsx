import { Play, MessageCircle, TrendingUp, Users } from 'lucide-react';

export default function CTVDemo() {
  return (
    <div className="h-screen bg-black flex overflow-hidden">
      {/* Main Content Area (75%) */}
      <div className="flex-1 relative">
        {/* Mock Video Player */}
        <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-32 h-32 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto border-4 border-purple-500/50">
              <Play size={64} className="text-purple-400" />
            </div>
            <h2 className="text-white text-4xl font-bold">Chiefs vs. Eagles</h2>
            <p className="text-gray-400 text-xl">Live • Q4 2:47</p>
          </div>
        </div>

        {/* Bottom Video Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">LIVE</span>
            </div>
            <div className="flex items-center gap-6 text-white/60">
              <Users size={20} />
              <span className="text-sm">847 watching with you</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Feed Sidebar (25%) */}
      <div className="w-96 bg-gray-950 border-l border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <MessageCircle size={20} className="text-purple-400" />
            Live Chat
          </h3>
          <p className="text-gray-400 text-xs mt-1">847 friends watching</p>
        </div>

        {/* Active Prediction/Poll */}
        <div className="p-4 bg-purple-900/20 border-b border-purple-700/30">
          <div className="flex items-start gap-3">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=heidi" 
              alt="Heidi"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Heidi cast a prediction</p>
              <p className="text-gray-300 text-xs mt-1">"Chiefs score next drive"</p>
              
              <div className="mt-3 space-y-2">
                <button className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 rounded-lg px-3 py-2 text-green-400 text-sm font-medium flex items-center justify-between">
                  <span>✓ Yes</span>
                  <span className="text-xs">73%</span>
                </button>
                <button className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg px-3 py-2 text-red-400 text-sm font-medium flex items-center justify-between">
                  <span>✗ No</span>
                  <span className="text-xs">27%</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Feed Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Message 1 */}
          <div className="flex items-start gap-3 animate-slide-in">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=mike" 
              alt="Mike"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-sm font-medium">Mike</span>
                <span className="text-gray-500 text-xs">2s</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">LET'S GOOOOO 🔥🏈</p>
            </div>
          </div>

          {/* Message 2 */}
          <div className="flex items-start gap-3">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=sarah" 
              alt="Sarah"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-sm font-medium">Sarah</span>
                <span className="text-gray-500 text-xs">5s</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">Kelce is UNSTOPPABLE</p>
            </div>
          </div>

          {/* Message 3 */}
          <div className="flex items-start gap-3">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=alex" 
              alt="Alex"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-sm font-medium">Alex</span>
                <span className="text-gray-500 text-xs">12s</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">Best game of the season 😱</p>
            </div>
          </div>

          {/* Trending Moment */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-blue-400" />
              <span className="text-blue-400 text-xs font-medium">TRENDING MOMENT</span>
            </div>
            <p className="text-white text-sm">Mahomes 40-yard bomb 🚀</p>
            <p className="text-gray-400 text-xs mt-1">234 reactions in last 30s</p>
          </div>

          {/* Message 4 */}
          <div className="flex items-start gap-3">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=emma" 
              alt="Emma"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-sm font-medium">Emma</span>
                <span className="text-gray-500 text-xs">18s</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">I'm calling it - Chiefs by 14 🎯</p>
            </div>
          </div>

          {/* Message 5 */}
          <div className="flex items-start gap-3">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=trey" 
              alt="Trey"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-sm font-medium">Trey</span>
                <span className="text-gray-500 text-xs">25s</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">Defense looking shaky</p>
            </div>
          </div>

          {/* Message 6 */}
          <div className="flex items-start gap-3">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=jordan" 
              alt="Jordan"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-white text-sm font-medium">Jordan</span>
                <span className="text-gray-500 text-xs">32s</span>
              </div>
              <p className="text-gray-300 text-sm mt-1">🔴⚪ CHIEFS KINGDOM!</p>
            </div>
          </div>
        </div>

        {/* Quick React Bar */}
        <div className="p-4 border-t border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2">
            <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2 text-2xl">
              🔥
            </button>
            <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2 text-2xl">
              😱
            </button>
            <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2 text-2xl">
              👏
            </button>
            <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg py-2 text-2xl">
              💀
            </button>
          </div>
        </div>
      </div>

      {/* Floating Context Label */}
      <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
        <p className="text-gray-300 text-sm">CTV Experience Demo</p>
        <p className="text-gray-500 text-xs">consumed × Apple TV</p>
      </div>
    </div>
  );
}
