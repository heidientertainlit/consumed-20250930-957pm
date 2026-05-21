import React from 'react';

export function CinemaGold() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#0D1117' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap');
          
          .font-serif-gold {
            font-family: 'Playfair Display', serif;
          }
        `}
      </style>

      <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in duration-700 ease-out">
        {/* Username */}
        <div className="text-[#9CA3AF] text-xs tracking-[0.2em] uppercase font-medium mb-8">
          Jordan
        </div>

        {/* Score Section */}
        <div className="relative w-full flex flex-col items-center mb-10">
          <div className="w-16 h-[1px] bg-[#D97706]/30 absolute top-0"></div>
          
          <div className="flex items-baseline justify-center py-6">
            <span className="font-serif-gold text-[#F59E0B] text-[110px] leading-none font-bold italic tracking-tighter drop-shadow-sm">
              2
            </span>
            <span className="font-serif-gold text-[#9CA3AF]/50 text-4xl leading-none ml-2 italic">
              /3
            </span>
          </div>
          
          <div className="w-16 h-[1px] bg-[#D97706]/30 absolute bottom-0"></div>
        </div>

        {/* Headlines */}
        <div className="text-center mb-10 space-y-3">
          <h1 className="font-serif-gold text-white text-xl md:text-2xl font-bold tracking-wide">
            Almost perfect. One away from dangerous.
          </h1>
          <p className="text-[#9CA3AF] text-sm font-light tracking-wide">
            Your Entertainment DNA just got stronger.
          </p>
        </div>

        {/* Results Row */}
        <div className="flex w-full gap-3 justify-center mb-8">
          <div className="flex-1 flex flex-col items-center bg-[#1C2333] rounded-lg p-3 border border-white/5 shadow-lg">
            <span className="text-xl mb-1">🎬</span>
            <span className="text-white text-xs font-medium tracking-wide mb-2">Movies</span>
            <span className="text-[#F59E0B] font-bold text-sm">✓</span>
          </div>
          
          <div className="flex-1 flex flex-col items-center bg-[#1C2333] rounded-lg p-3 border border-white/5 shadow-lg">
            <span className="text-xl mb-1">🎵</span>
            <span className="text-white text-xs font-medium tracking-wide mb-2">Music</span>
            <span className="text-[#F59E0B] font-bold text-sm">✓</span>
          </div>
          
          <div className="flex-1 flex flex-col items-center bg-[#1C2333]/80 rounded-lg p-3 border border-white/5 opacity-80">
            <span className="text-xl mb-1 opacity-70">📺</span>
            <span className="text-white text-xs font-medium tracking-wide mb-2 opacity-70">TV</span>
            <span className="text-red-500 font-bold text-sm">✗</span>
          </div>
        </div>

        {/* Insight */}
        <p className="font-serif-gold text-[#9CA3AF] italic text-[15px] mb-10 text-center">
          "TV tripped you up — worth a revisit."
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-6 mb-12">
          <div className="flex flex-col items-center">
            <span className="text-[#F59E0B] font-serif-gold font-bold text-xl mb-1">+20</span>
            <span className="text-[#9CA3AF] text-[10px] uppercase tracking-widest">Points</span>
          </div>
          <div className="w-[1px] h-8 bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-[#F97316] font-serif-gold font-bold text-xl mb-1 flex items-center gap-1">
              <span>5</span>
              <span className="text-sm">🔥</span>
            </span>
            <span className="text-[#9CA3AF] text-[10px] uppercase tracking-widest">Day Streak</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="w-full flex flex-col gap-4">
          <button className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-[#0D1117] font-bold py-4 rounded-full uppercase tracking-wider text-sm transition-colors duration-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            Share Score
          </button>
          <button className="w-full bg-transparent border border-[#F59E0B]/30 hover:border-[#F59E0B] hover:bg-[#F59E0B]/5 text-[#F59E0B] font-medium py-4 rounded-full uppercase tracking-wider text-sm transition-all duration-200">
            Nudge a Friend
          </button>
        </div>

      </div>
    </div>
  );
}
