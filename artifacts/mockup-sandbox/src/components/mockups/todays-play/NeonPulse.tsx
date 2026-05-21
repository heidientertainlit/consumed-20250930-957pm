import React from 'react';

export function NeonPulse() {
  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col font-sans overflow-hidden" style={{ backgroundColor: '#0A0A0F', color: '#FFFFFF' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap');
          
          .neon-pulse-container {
            font-family: 'Outfit', sans-serif;
          }
          
          .bg-glow {
            position: absolute;
            top: 20%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(10, 10, 15, 0) 70%);
            pointer-events: none;
            z-index: 0;
          }

          .gradient-text {
            background: linear-gradient(to right, #A855F7, #06B6D4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            color: transparent;
          }

          .neon-divider {
            height: 1px;
            width: 100%;
            background: linear-gradient(90deg, transparent, #A855F7, #06B6D4, transparent);
            opacity: 0.5;
          }
        `}
      </style>
      
      <div className="neon-pulse-container flex flex-col flex-1 relative z-10 px-6 py-10 max-w-md mx-auto w-full">
        <div className="bg-glow" />
        
        {/* Header */}
        <div className="flex justify-center mb-8">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: '#A855F7' }}>
            Jordan
          </span>
        </div>

        {/* Score Section */}
        <div className="flex flex-col items-center justify-center mb-10 mt-4 relative">
          <div className="flex items-baseline justify-center">
            <span 
              className="text-[110px] font-extrabold leading-none tracking-tighter"
              style={{ 
                textShadow: '0 0 30px #A855F7, 0 0 60px #7C3AED',
                color: '#FFFFFF'
              }}
            >
              2
            </span>
            <span className="text-4xl font-semibold ml-2 opacity-40" style={{ color: '#A855F7' }}>
              /3
            </span>
          </div>
          
          <div className="mt-8 text-center space-y-2 max-w-[280px]">
            <h1 className="text-[22px] font-bold leading-tight">
              Almost perfect. <span className="gradient-text">One away from dangerous.</span>
            </h1>
            <p className="text-sm font-light text-white/60">
              Your Entertainment DNA just got stronger.
            </p>
          </div>
        </div>

        {/* Categories Results */}
        <div className="space-y-3 mb-8 w-full">
          <div className="flex items-center rounded-xl overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
            <div className="w-1.5 h-full self-stretch" style={{ backgroundColor: '#10B981' }} />
            <div className="flex-1 flex items-center justify-between py-3.5 px-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎬</span>
                <span className="font-medium text-white/90">Movies</span>
              </div>
              <div className="flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <svg className="w-3.5 h-3.5" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinelinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center rounded-xl overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
            <div className="w-1.5 h-full self-stretch" style={{ backgroundColor: '#10B981' }} />
            <div className="flex-1 flex items-center justify-between py-3.5 px-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎵</span>
                <span className="font-medium text-white/90">Music</span>
              </div>
              <div className="flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <svg className="w-3.5 h-3.5" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinelinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center rounded-xl overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
            <div className="w-1.5 h-full self-stretch" style={{ backgroundColor: '#EF4444' }} />
            <div className="flex-1 flex items-center justify-between py-3.5 px-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">📺</span>
                <span className="font-medium text-white/90">TV</span>
              </div>
              <div className="flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <svg className="w-3.5 h-3.5" style={{ color: '#EF4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinelinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Insight */}
        <div className="text-center mb-8">
          <p className="text-[13px] font-medium text-white/50 italic">
            TV tripped you up — worth a revisit.
          </p>
        </div>

        <div className="neon-divider mb-8" />

        {/* Stats */}
        <div className="flex justify-between items-center mb-10 px-4">
          <div className="flex flex-col items-center">
            <span className="text-xs text-white/50 uppercase tracking-wide mb-1 font-semibold">Earned</span>
            <span className="text-xl font-bold" style={{ color: '#A855F7' }}>+20 pts</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-white/50 uppercase tracking-wide mb-1 font-semibold">Streak</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold" style={{ color: '#F97316', textShadow: '0 0 10px rgba(249, 115, 22, 0.5)' }}>5 days</span>
              <span className="text-lg">🔥</span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 space-y-4">
          <button 
            className="w-full py-4 rounded-xl font-bold text-base transition-transform active:scale-[0.98]"
            style={{ 
              backgroundColor: '#7C3AED', 
              boxShadow: '0 8px 25px -5px rgba(124, 58, 237, 0.5), 0 0 10px rgba(124, 58, 237, 0.3)' 
            }}
          >
            Share Score
          </button>
          
          <button 
            className="w-full py-4 rounded-xl font-bold text-base transition-transform active:scale-[0.98] border"
            style={{ 
              backgroundColor: 'transparent',
              borderColor: 'rgba(168, 85, 247, 0.4)',
              color: '#A855F7'
            }}
          >
            Nudge a Friend
          </button>
        </div>
      </div>
    </div>
  );
}
