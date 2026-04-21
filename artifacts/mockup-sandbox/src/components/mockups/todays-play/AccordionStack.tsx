import { X, Flame, CheckCircle2, Circle, ChevronDown, ChevronRight, Lock } from "lucide-react";

export default function AccordionStack() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8">
      <div className="w-full max-w-[390px] bg-white min-h-[844px] shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Header Strip */}
        <header className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex-1"></div>
          <div className="flex-1 flex justify-center">
            <h1 className="font-bold text-gray-900 tracking-tight">Today's Play</h1>
          </div>
          <div className="flex-1 flex justify-end">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Motivational Header */}
        <div className="px-5 py-6 flex flex-col items-center text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-100">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-bold text-orange-700">4-Day Streak</span>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed px-4">
            Keep your streak alive — answer all 3 then challenge a friend.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="px-4 flex-1 flex flex-col gap-3 pb-8">
          
          {/* Q1 Expanded */}
          <div className="rounded-2xl border-2 border-[#4c1d95] shadow-sm overflow-hidden bg-white">
            {/* Top color band */}
            <div 
              className="h-1.5 w-full"
              style={{ background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" }}
            />
            
            <div className="p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#4c1d95] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    1
                  </div>
                  <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">Books</span>
                </div>
                <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
                  Easy
                </div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 leading-snug">
                What year did 'The Great Gatsby' premiere?
              </h2>

              <div className="flex flex-col gap-2.5 mt-2">
                {/* Options */}
                {[
                  { text: "1931", selected: false },
                  { text: "1925", selected: true },
                  { text: "1922", selected: false },
                  { text: "1929", selected: false },
                ].map((opt, i) => (
                  <button 
                    key={i}
                    className={`flex items-center p-3.5 rounded-xl border-2 text-left transition-all ${
                      opt.selected 
                        ? "border-[#4c1d95] bg-purple-50/50" 
                        : "border-gray-100 hover:border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex-1">
                      <span className={`font-semibold ${opt.selected ? "text-[#4c1d95]" : "text-gray-700"}`}>
                        {opt.text}
                      </span>
                    </div>
                    {opt.selected ? (
                      <CheckCircle2 className="w-5 h-5 text-[#4c1d95] fill-[#4c1d95]/10" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-200" />
                    )}
                  </button>
                ))}
              </div>

              <button 
                className="w-full mt-2 py-3.5 rounded-xl font-bold text-white text-base shadow-md transition-transform active:scale-[0.98]"
                style={{ background: "linear-gradient(160deg,#4c1d95 0%,#3b0764 100%)" }}
              >
                Lock In Answer
              </button>
            </div>
          </div>

          {/* Q2 Collapsed */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 flex items-center gap-3 cursor-not-allowed opacity-90">
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex shrink-0 items-center justify-center text-sm font-bold">
              <Lock className="w-3.5 h-3.5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">TV</span>
                <span className="text-[10px] font-bold text-yellow-600">Medium</span>
              </div>
              <p className="text-sm font-medium text-gray-500 truncate">
                Which character said 'I am the...
              </p>
            </div>
            
            <ChevronDown className="w-5 h-5 text-gray-300" />
          </div>

          {/* Q3 Collapsed */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 flex items-center gap-3 cursor-not-allowed opacity-90">
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex shrink-0 items-center justify-center text-sm font-bold">
              <Lock className="w-3.5 h-3.5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Film</span>
                <span className="text-[10px] font-bold text-red-500">Hard</span>
              </div>
              <p className="text-sm font-medium text-gray-500 truncate">
                Who directed 'There Will Be...
              </p>
            </div>
            
            <ChevronDown className="w-5 h-5 text-gray-300" />
          </div>

        </div>
      </div>
    </div>
  );
}
