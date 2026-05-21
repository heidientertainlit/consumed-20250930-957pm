import React from "react";
import { Flame } from "lucide-react";

export function NeonPulse() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
        
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        
        .neon-glow-purple { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); }
        .neon-text-purple { text-shadow: 0 0 10px rgba(168, 85, 247, 0.5); }
      `}</style>
      
      <div className="min-h-[100dvh] bg-[#0A0A0F] text-white font-outfit pb-32 overflow-x-hidden selection:bg-purple-500/30 flex flex-col relative w-full">
        
        {/* Background Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-md mx-auto px-6 py-8 relative z-10 flex flex-col gap-6 w-full flex-1">
          
          {/* Header */}
          <header className="flex justify-center items-center">
            <div className="text-[#A855F7] text-xs font-bold uppercase tracking-[0.2em] neon-text-purple">
              Jordan
            </div>
          </header>

          {/* Question */}
          <div className="mt-2 text-center">
            <h1 className="text-[16px] leading-relaxed font-medium text-white/90">
              What year did The Sopranos first premiere?
            </h1>
          </div>

          {/* You Picked Block */}
          <div className="bg-[#1A1A2E] border-l-[3px] border-l-[#A855F7] p-5 rounded-r-xl rounded-l-sm neon-glow-purple relative overflow-hidden mt-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#A855F7]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="text-purple-400/80 text-[11px] font-bold uppercase tracking-wider mb-2 font-space relative z-10">
              You Picked
            </div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-4xl font-space font-bold text-white tracking-tight">1999</span>
            </div>
          </div>

          {/* Vote Breakdown */}
          <div className="space-y-3 mt-4">
            <div className="space-y-2.5">
              {/* Option 1: Picked */}
              <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden flex items-center border border-purple-500/30">
                <div className="absolute left-0 top-0 bottom-0 bg-[#A855F7]/40 w-[62%] neon-glow-purple border-r border-purple-400" />
                <div className="relative z-10 flex justify-between w-full px-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">1999</span>
                    <span className="text-[10px] bg-[#A855F7] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">You</span>
                  </div>
                  <span className="font-bold text-white font-space">62%</span>
                </div>
              </div>

              {/* Option 2 */}
              <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden flex items-center border border-white/5">
                <div className="absolute left-0 top-0 bottom-0 bg-white/10 w-[22%]" />
                <div className="relative z-10 flex justify-between w-full px-4 items-center">
                  <span className="font-medium text-white/70">1997</span>
                  <span className="font-medium text-white/70 font-space">22%</span>
                </div>
              </div>

              {/* Option 3 */}
              <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden flex items-center border border-white/5">
                <div className="absolute left-0 top-0 bottom-0 bg-white/10 w-[9%]" />
                <div className="relative z-10 flex justify-between w-full px-4 items-center">
                  <span className="font-medium text-white/70">2001</span>
                  <span className="font-medium text-white/70 font-space">9%</span>
                </div>
              </div>

              {/* Option 4 */}
              <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden flex items-center border border-white/5">
                <div className="absolute left-0 top-0 bottom-0 bg-white/10 w-[7%]" />
                <div className="relative z-10 flex justify-between w-full px-4 items-center">
                  <span className="font-medium text-white/70">1995</span>
                  <span className="font-medium text-white/70 font-space">7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Start a Fight Block */}
          <div className="bg-[#111827] border-l-[4px] border-[#A855F7] p-5 rounded-xl mt-4">
            <p className="text-[15px] font-medium text-white/90 leading-relaxed mb-4">
              <span className="font-bold text-white">38%</span> of fans got this wrong. Think they just haven't watched enough TV?
            </p>
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-[#A855F7]/50 text-[#A855F7] font-bold hover:bg-[#A855F7]/10 transition-colors neon-glow-purple text-sm">
              Start a debate &rarr;
            </button>
          </div>

          {/* DNA Glimpses */}
          <div className="mt-6 flex flex-col gap-3">
            <h3 className="text-white/50 text-[11px] font-bold uppercase tracking-[0.15em] font-space mb-1">DNA Glimpses</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="text-2xl drop-shadow-md">🎬</div>
                <span className="text-[13px] font-medium text-white/90 leading-tight">Better at Movies than 78% of fans</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="text-2xl drop-shadow-md">🔥</div>
                <span className="text-[13px] font-medium text-white/90 leading-tight">Thriller obsessive</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="text-2xl drop-shadow-md">📺</div>
                <span className="text-[13px] font-medium text-white/90 leading-tight">Prestige TV devotee</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="text-2xl drop-shadow-md">🎯</div>
                <span className="text-[13px] font-medium text-white/90 leading-tight">Knows 90s pop culture cold</span>
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-[40px]" />

          {/* Fixed Bottom Actions */}
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-1.5 text-[#A855F7] font-bold font-space text-lg">
                <span>+10 pts</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold font-space text-sm text-[#F97316]">
                <Flame size={16} className="text-[#F97316]" fill="currentColor" />
                <span>5-day streak</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3.5 rounded-xl font-bold transition-colors neon-glow-purple flex items-center justify-center gap-2">
                Share Score
              </button>
              <button className="border border-[#A855F7]/50 hover:bg-[#A855F7]/10 text-[#A855F7] py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                Nudge a Friend
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
