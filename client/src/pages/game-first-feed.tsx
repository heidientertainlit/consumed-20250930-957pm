import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { Trophy, Flame, Target, Zap, ChevronRight, Star, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";

export default function GameFirstFeed() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-32">
      <Navigation onTrackConsumption={() => {}} />

      {/* Hero Section - Daily Engagement */}
      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                Play Today
              </h1>
              <p className="text-gray-400 mt-1">Boost your DNA level with daily challenges.</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-yellow-500 font-bold text-xl">
                <Zap className="fill-current" />
                {user?.points || 0} pts
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Current Score</p>
            </div>
          </div>

          <DailyChallengeCard />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-8">
        {/* Active Games Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Target className="text-purple-500" />
              Active Game Pools
            </h2>
            <Button variant="link" className="text-purple-400">View All</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#12121f] rounded-2xl p-5 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-purple-500/10 p-2 rounded-lg">
                  <Star className="text-purple-500 w-6 h-6" />
                </div>
                <div className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                  Ending Soon
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">Oscars 2026 Predictions</h3>
              <p className="text-gray-400 text-sm mb-4">Predict the winners and earn up to 500 pts.</p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#12121f] bg-gray-700" />
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-[#12121f] bg-purple-900 flex items-center justify-center text-[10px]">
                    +42
                  </div>
                </div>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">Predict Now</Button>
              </div>
            </div>

            <div className="bg-[#12121f] rounded-2xl p-5 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <Flame className="text-blue-500 w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">Weekly Trivia: Sci-Fi Hits</h3>
              <p className="text-gray-400 text-sm mb-4">Test your knowledge of Dune and Foundation.</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">12 Questions • 120 pts</span>
                <Button size="sm" variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">Play</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Global Leaderboard Snapshot */}
        <section className="bg-[#12121f] rounded-3xl p-6 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                Your Standing
              </h2>
              <p className="text-sm text-gray-400">You are in the top 15% this week!</p>
            </div>
            <Button variant="outline" size="sm" className="border-gray-700">See Full Table</Button>
          </div>

          <div className="space-y-4">
            {[
              { rank: 1, name: "AlexM", pts: 4250, avatar: "A", color: "text-yellow-500" },
              { rank: 2, name: "Sarah_C", pts: 3890, avatar: "S", color: "text-gray-300" },
              { rank: 3, name: "You", pts: 3420, avatar: "Y", color: "text-orange-500", isMe: true },
            ].map((entry) => (
              <div key={entry.rank} className={`flex items-center justify-between p-3 rounded-xl ${entry.isMe ? 'bg-purple-500/10 border border-purple-500/20' : ''}`}>
                <div className="flex items-center gap-4">
                  <span className={`font-bold w-4 ${entry.color}`}>#{entry.rank}</span>
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-bold">
                    {entry.avatar}
                  </div>
                  <span className={entry.isMe ? 'font-bold' : ''}>{entry.name}</span>
                </div>
                <div className="font-mono text-sm">{entry.pts} pts</div>
              </div>
            ))}
          </div>
        </section>

        {/* Entertainment DNA Progress */}
        <section className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-3xl p-6 border border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold">DNA Level 14</h3>
              <p className="text-sm text-purple-200/70">120 pts to Level 15</p>
            </div>
            <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Voyager
            </div>
          </div>
          <Progress value={75} className="h-2 bg-white/10 mb-6" />
          
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-white/5 rounded-2xl">
              <div className="text-xl font-bold mb-1">12</div>
              <div className="text-[10px] text-gray-400 uppercase">Games Won</div>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-2xl">
              <div className="text-xl font-bold mb-1">84</div>
              <div className="text-[10px] text-gray-400 uppercase">Correct Picks</div>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-2xl">
              <div className="text-xl font-bold mb-1">100%</div>
              <div className="text-[10px] text-gray-400 uppercase">Hot Take Heat</div>
            </div>
          </div>
        </section>

        {/* Game Activity Feed (Optional - just to show friends) */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="text-blue-400" />
            Circle Activity
          </h2>
          <div className="space-y-4">
            <div className="bg-[#12121f]/50 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="text-blue-400 w-5 h-5" />
              </div>
              <div>
                <p className="text-sm"><span className="font-bold">Sarah_C</span> just moved into the <span className="text-yellow-500 font-bold">Top 10 Global</span></p>
                <p className="text-xs text-gray-500">2 mins ago</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
