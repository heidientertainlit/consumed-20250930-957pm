import React from 'react';

export function Wrapped() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-[#2D1B69] via-[#7C3AED] to-[#EC4899] text-white p-6 font-['Outfit',sans-serif] overflow-x-hidden">
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap');`}
      </style>
      
      {/* Top Header */}
      <div className="w-full flex justify-center pt-10">
        <span className="uppercase tracking-[0.2em] text-white/50 text-xs font-bold">Jordan</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 mt-6">
        
        {/* Score Area */}
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-baseline leading-none">
            <span className="text-[130px] font-black italic tracking-tighter drop-shadow-xl">2</span>
            <span className="text-[60px] font-bold text-white/40 italic ml-2">/3</span>
          </div>
          
          <div className="mt-4 text-center space-y-3 max-w-[300px]">
            <h1 className="text-2xl font-extrabold leading-tight text-white drop-shadow-md">
              Almost perfect. One away from dangerous. 🔥
            </h1>
            <p className="text-white/80 text-sm font-medium">Your Entertainment DNA just got stronger.</p>
          </div>
        </div>

        {/* Results Pills */}
        <div className="w-full max-w-[320px] space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
          {/* Pill 1 */}
          <div className="flex items-center justify-between px-5 py-3.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md shadow-sm">
            <div className="flex items-center space-x-3">
              <span className="text-2xl drop-shadow-sm">🎬</span>
              <span className="font-bold tracking-wide">Movies</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#10B981]/20 text-[#34D399] flex items-center justify-center border border-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 font-bold">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          {/* Pill 2 */}
          <div className="flex items-center justify-between px-5 py-3.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md shadow-sm">
            <div className="flex items-center space-x-3">
              <span className="text-2xl drop-shadow-sm">🎵</span>
              <span className="font-bold tracking-wide">Music</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#10B981]/20 text-[#34D399] flex items-center justify-center border border-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 font-bold">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          {/* Pill 3 */}
          <div className="flex items-center justify-between px-5 py-3.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md shadow-sm">
            <div className="flex items-center space-x-3">
              <span className="text-2xl drop-shadow-sm opacity-80">📺</span>
              <span className="font-bold tracking-wide text-white/90">TV</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#EF4444]/20 text-[#F87171] flex items-center justify-center border border-[#EF4444]/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 font-bold">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </div>
          </div>

          <div className="pt-2 pb-1">
            <p className="text-[13px] text-white/70 text-center font-medium">TV tripped you up — worth a revisit.</p>
          </div>
        </div>

        {/* Points and Streak */}
        <div className="flex items-center justify-center space-x-8 bg-white/10 border border-white/20 backdrop-blur-md px-8 py-5 rounded-[2rem] mt-2 shadow-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          <div className="flex flex-col items-center">
            <span className="text-[28px] font-black text-[#FDE047] drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">+20</span>
            <span className="text-[10px] uppercase tracking-widest text-white/70 font-bold mt-0.5">Points</span>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div className="flex flex-col items-center">
            <span className="text-[28px] font-black text-[#FCA5A5] drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">5 🔥</span>
            <span className="text-[10px] uppercase tracking-widest text-white/70 font-bold mt-0.5">Streak</span>
          </div>
        </div>

      </div>

      {/* Footer CTAs */}
      <div className="w-full flex flex-col space-y-3 pb-8 mt-10 pt-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 fill-mode-both">
        <button className="w-full py-4 rounded-full bg-white text-[#7C3AED] font-black text-lg hover:bg-gray-50 transition-all shadow-xl active:scale-[0.98] transform">
          Share Score
        </button>
        <button className="w-full py-4 rounded-full bg-transparent border-[2.5px] border-white/40 text-white font-bold text-lg hover:bg-white/10 hover:border-white/60 transition-all active:scale-[0.98] transform backdrop-blur-sm">
          Nudge a Friend
        </button>
      </div>
    </div>
  );
}
