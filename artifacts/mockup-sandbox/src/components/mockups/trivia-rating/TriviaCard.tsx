import { useState } from "react";
import { Star, Users, CheckCircle2, XCircle, Brain } from "lucide-react";

const answers = [
  { id: "a", text: "Jared Leto", correct: false, userPicked: true, pct: 50 },
  { id: "b", text: "Joaquin Phoenix", correct: false, userPicked: false, pct: 0 },
  { id: "c", text: "Jack Nicholson", correct: false, userPicked: false, pct: 0 },
  { id: "d", text: "Heath Ledger", correct: true, userPicked: false, pct: 50 },
];

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95"
          onMouseEnter={() => setHover(s)}
          onClick={() => onChange(s)}
        >
          <Star
            size={28}
            className={display >= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}
          />
        </button>
      ))}
    </div>
  );
}

export function TriviaCard() {
  const [rating, setRating] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const rated = rating > 0;
  const showStrip = !skipped;

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-8 pb-8 px-4">
      <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
              <Brain size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Movie Trivia</p>
              <p className="text-[11px] text-gray-400 leading-tight">One question trivia</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">›</span>
            <span className="text-sm font-semibold text-gray-500">1/2</span>
          </div>
        </div>

        {/* Question */}
        <div className="px-5 pb-4">
          <p className="text-[17px] font-bold text-gray-900 leading-snug">
            Who played the Joker in 'The Dark Knight'?
          </p>
        </div>

        {/* Answer options */}
        <div className="px-5 flex flex-col gap-2.5 pb-4">
          {answers.map((a) => {
            const base =
              a.correct
                ? "bg-green-50 border-green-300 text-green-800"
                : a.userPicked
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-gray-50 border-gray-200 text-gray-600";
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${base}`}
              >
                <div className="flex items-center gap-2.5">
                  {a.correct ? (
                    <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                  ) : a.userPicked ? (
                    <XCircle size={16} className="text-red-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4" />
                  )}
                  <span className="text-sm font-medium">{a.text}</span>
                  {a.userPicked && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-500">{a.pct}%</span>
              </div>
            );
          })}
        </div>

        {/* ─── INLINE RATING STRIP ─── */}
        {showStrip && (
          <div className="mx-5 mb-4 rounded-2xl bg-violet-50 border border-violet-100 px-4 py-3">
            {!rated ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-violet-600 tracking-wide uppercase">
                    Rate The Dark Knight
                  </p>
                  <button
                    className="text-[11px] text-gray-400 hover:text-gray-600"
                    onClick={() => setSkipped(true)}
                  >
                    Skip
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <StarRow value={rating} onChange={setRating} />
                  <span className="text-[11px] text-gray-400 ml-1">while it's on your mind</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-violet-600 tracking-wide uppercase mb-1">
                    The Dark Knight — rated!
                  </p>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        className={s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}
                      />
                    ))}
                    <span className="ml-1.5 text-[11px] text-gray-500">{rating}/5</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    +5 pts
                  </span>
                  <button
                    className="text-[10px] text-gray-400 hover:text-gray-600"
                    onClick={() => setRating(0)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next question button */}
        <div className="px-5 pb-4">
          <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 text-white text-sm font-bold shadow-md hover:opacity-95 transition-opacity">
            Next question
          </button>
        </div>

        {/* Friends who played */}
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-violet-400" />
            <span className="text-xs font-semibold text-gray-500">Friends who played</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
              F
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-green-500" />
              <span className="text-xs text-gray-600">Friend</span>
            </div>
          </div>
        </div>

        {/* Points */}
        <div className="px-5 pb-5 flex justify-end">
          <span className="text-xs font-bold text-green-600">+10 pts</span>
        </div>
      </div>
    </div>
  );
}
