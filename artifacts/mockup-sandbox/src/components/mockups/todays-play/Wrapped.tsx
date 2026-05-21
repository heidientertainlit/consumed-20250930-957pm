import React from 'react';

export function Wrapped() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        
        .wrapped-container {
          font-family: 'Outfit', sans-serif;
        }
        
        .bg-wrapped-gradient {
          background: linear-gradient(135deg, #2D1B69 0%, #7C3AED 50%, #EC4899 100%);
        }

        .glass-pill {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .glass-panel {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dna-gradient {
          background: linear-gradient(90deg, #F59E0B 0%, #EC4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
      
      <div className="wrapped-container min-h-[100dvh] bg-wrapped-gradient text-white p-6 flex flex-col w-full max-w-md mx-auto relative overflow-hidden">
        
        <header className="text-center mb-8 pt-4">
          <p className="text-white/60 text-xs font-bold tracking-[0.2em] uppercase mb-1">Jordan</p>
        </header>

        <main className="flex-1 flex flex-col gap-8 pb-32">
          {/* Question & User Pick */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-white/80 text-[16px] font-medium leading-snug text-center px-4">
              What year did The Sopranos first premiere?
            </h1>
            
            <div className="glass-pill rounded-3xl p-4 flex flex-col items-center justify-center gap-2 mt-4 transform hover:scale-[1.02] transition-transform">
              <span className="text-white/70 text-[10px] font-bold tracking-wider uppercase">You Picked</span>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black tracking-tight">1999</span>
                <div className="w-8 h-8 rounded-full bg-white text-[#7C3AED] flex items-center justify-center font-black text-lg">
                  ✓
                </div>
              </div>
            </div>
          </div>

          {/* Vote Breakdown */}
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
            <div className="space-y-2.5">
              {/* Option 1: 1999 (User's Pick) */}
              <div className="relative h-12 rounded-xl overflow-hidden glass-pill border-white/40">
                <div className="absolute top-0 left-0 bottom-0 bg-white w-[62%] transition-all duration-1000 ease-out" />
                <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#2D1B69] mix-blend-plus-lighter">1999</span>
                    <span className="bg-[#2D1B69] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">✓ You</span>
                  </div>
                  <span className="font-black text-[#2D1B69] mix-blend-plus-lighter">62%</span>
                </div>
              </div>

              {/* Option 2: 1997 */}
              <div className="relative h-12 rounded-xl overflow-hidden glass-pill">
                <div className="absolute top-0 left-0 bottom-0 bg-white/20 w-[22%] transition-all duration-1000 ease-out" />
                <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                  <span className="font-semibold text-white/90">1997</span>
                  <span className="font-bold text-white/80">22%</span>
                </div>
              </div>

              {/* Option 3: 2001 */}
              <div className="relative h-12 rounded-xl overflow-hidden glass-pill">
                <div className="absolute top-0 left-0 bottom-0 bg-white/20 w-[9%] transition-all duration-1000 ease-out" />
                <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                  <span className="font-semibold text-white/90">2001</span>
                  <span className="font-bold text-white/80">9%</span>
                </div>
              </div>

              {/* Option 4: 1995 */}
              <div className="relative h-12 rounded-xl overflow-hidden glass-pill">
                <div className="absolute top-0 left-0 bottom-0 bg-white/20 w-[7%] transition-all duration-1000 ease-out" />
                <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                  <span className="font-semibold text-white/90">1995</span>
                  <span className="font-bold text-white/80">7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Start a Fight Block */}
          <div className="glass-panel rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
            <h3 className="text-[15px] font-bold leading-tight text-white/90">
              38% of fans got this wrong. Think they just haven't watched enough TV?
            </h3>
            <button className="text-[11px] font-bold uppercase tracking-wider text-white border border-white/30 hover:bg-white/10 px-4 py-2 rounded-full transition-colors flex items-center gap-2 w-max">
              Start a debate <span>→</span>
            </button>
          </div>

          {/* DNA Strip */}
          <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
            <div className="flex items-center gap-2">
              <span className="bg-[#EC4899] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                TV Obsessive
              </span>
            </div>
            <p className="text-white/70 text-[13px] font-medium">
              Knows their prestige TV inside out
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="glass-pill px-3 py-1 rounded-lg text-[11px] font-semibold text-white/90">Drama</span>
              <span className="glass-pill px-3 py-1 rounded-lg text-[11px] font-semibold text-white/90">Crime</span>
              <span className="glass-pill px-3 py-1 rounded-lg text-[11px] font-semibold text-white/90">Thriller</span>
            </div>
          </div>
          
          {/* Points + Streak Row */}
          <div className="glass-pill rounded-2xl p-4 flex items-center justify-around animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700 fill-mode-both">
            <div className="text-center">
              <span className="block text-2xl font-black text-white">+10</span>
              <span className="block text-[10px] uppercase tracking-wider text-white/60 font-bold mt-1">Points</span>
            </div>
            <div className="w-px h-10 bg-white/20"></div>
            <div className="text-center">
              <span className="block text-2xl font-black text-white flex items-center justify-center gap-1">
                5 <span className="text-[#F59E0B]">🔥</span>
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-white/60 font-bold mt-1">Day Streak</span>
            </div>
          </div>
        </main>

        {/* Bottom CTAs */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#2D1B69] via-[#2D1B69]/80 to-transparent w-full max-w-md mx-auto pointer-events-none pb-8 z-50">
          <div className="flex flex-col gap-3 pointer-events-auto mt-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-1000 fill-mode-both">
            <button className="w-full bg-white text-[#7C3AED] font-black text-lg py-3.5 rounded-xl shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
              Share Score
            </button>
            <button className="w-full bg-transparent border border-white/60 text-white font-bold text-md py-3 rounded-xl hover:bg-white/10 transition-colors">
              Nudge a Friend
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
