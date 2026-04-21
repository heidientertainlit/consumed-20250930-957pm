import { Flame, X, Lock, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function PreviewStack() {
  const [selectedOption, setSelectedOption] = useState<string | null>("1925");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <div 
        className="pt-12 pb-6 px-4 rounded-b-[2.5rem] shadow-sm relative overflow-hidden"
        style={{ background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" }}
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 flex items-start justify-between mb-4">
          <div className="flex flex-col">
            <h1 className="text-white text-2xl font-bold tracking-tight mb-1">Today's Play</h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                4-Day Streak
              </span>
            </div>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative z-10">
          <p className="text-white/90 text-sm leading-relaxed">
            Keep your streak alive. Answer all 3 correctly to challenge a friend!
          </p>
        </div>
      </div>

      {/* Content Stack */}
      <div className="flex-1 px-4 pt-6 pb-12 overflow-y-auto space-y-5">
        
        {/* Q1: Active Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#4ade80]"></div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Q1 of 3 · Books</span>
              <span className="text-[10px] font-bold text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded uppercase tracking-wider">Easy</span>
            </div>
            
            <h2 className="text-[19px] font-bold text-gray-900 leading-snug mb-6">
              What year did 'The Great Gatsby' premiere?
            </h2>
            
            <div className="space-y-2.5 mb-6">
              {['1922', '1925', '1929', '1931'].map((option) => {
                const isSelected = selectedOption === option;
                return (
                  <button 
                    key={option}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 text-left
                      ${isSelected 
                        ? 'border-purple-600 bg-purple-50' 
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className={`text-[15px] font-semibold ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                      {option}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'}
                    `}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
            
            <button 
              className={`w-full py-4 rounded-xl text-[15px] font-bold text-white shadow-md transition-all duration-200
                ${selectedOption 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-50 pointer-events-none translate-y-1'
                }
              `}
              style={selectedOption ? { background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" } : { backgroundColor: "#9ca3af" }}
            >
              Lock In Answer
            </button>
          </div>
        </div>

        {/* Q2: Locked Preview */}
        <div className="bg-white/60 rounded-2xl border border-gray-200 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#facc15]/60"></div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3 opacity-70">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Q2 of 3 · TV</span>
              <span className="text-[10px] font-bold text-[#facc15] bg-[#facc15]/10 px-2 py-0.5 rounded uppercase tracking-wider">Medium</span>
            </div>
            
            <h2 className="text-[17px] font-bold text-gray-800 leading-snug mb-5 opacity-90">
              Which character said 'I am the one who knocks'?
            </h2>
            
            <div className="relative">
              <div className="space-y-2 opacity-30 blur-[2px] pointer-events-none">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full h-14 bg-gray-100 rounded-xl border-2 border-gray-50 flex items-center px-4">
                    <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-md shadow-sm border border-gray-100 py-2 px-4 rounded-full flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-bold text-gray-600">Unlocks after Q1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Q3: Locked Preview */}
        <div className="bg-white/40 rounded-2xl border border-gray-200 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#f87171]/40"></div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3 opacity-50">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Q3 of 3 · Film</span>
              <span className="text-[10px] font-bold text-[#f87171] bg-[#f87171]/10 px-2 py-0.5 rounded uppercase tracking-wider">Hard</span>
            </div>
            
            <h2 className="text-[17px] font-bold text-gray-700 leading-snug mb-5 opacity-70">
              Who directed 'There Will Be Blood'?
            </h2>
            
            <div className="relative">
              <div className="space-y-2 opacity-20 blur-[3px] pointer-events-none">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full h-14 bg-gray-100 rounded-xl border-2 border-gray-50 flex items-center px-4">
                    <div className="w-3/5 h-4 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-md shadow-sm border border-gray-100 py-2 px-4 rounded-full flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-500">Unlocks after Q2</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer for bottom */}
        <div className="h-4"></div>

      </div>
    </div>
  );
}
