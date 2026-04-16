import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, CheckCircle2, XCircle, Trophy, Brain } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

interface Question {
  id: string;
  poolId: string;
  text: string;
  options: string[];
  correctAnswer?: string;
  points: number;
}

const SHOW_CONFIG: Record<string, { emoji: string; accentColor: string; description: string }> = {
  "Harry Potter": { emoji: "⚡", accentColor: "#7c3aed", description: "Test your wizarding world knowledge" },
  "Friends": { emoji: "☕", accentColor: "#f59e0b", description: "Could you BE any more of a fan?" },
  "Friends Pool": { emoji: "☕", accentColor: "#f59e0b", description: "Could you BE any more of a fan?" },
  "Stranger Things": { emoji: "🔦", accentColor: "#ef4444", description: "Enter the Upside Down" },
  "Reelz True Crime": { emoji: "🔍", accentColor: "#0ea5e9", description: "True crime trivia" },
};

function getConfig(showTag: string) {
  return SHOW_CONFIG[showTag] || { emoji: "🎮", accentColor: "#7c3aed", description: `${showTag} trivia` };
}

export default function PlayChallengePage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ showTag: string }>();
  const { user } = useAuth();
  const showTag = decodeURIComponent(params.showTag || "");
  const config = getConfig(showTag);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Record<string, { correct: boolean; points: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: pools } = await supabase
          .from("prediction_pools")
          .select("*")
          .eq("type", "trivia")
          .eq("status", "open")
          .eq("show_tag", showTag)
          .order("created_at", { ascending: true });

        if (!pools || pools.length === 0) { setLoading(false); return; }

        const poolIds = pools.map((p: any) => p.id);

        let answeredPoolIds: Set<string> = new Set();
        if (user?.id) {
          const { data: userPreds } = await supabase
            .from("user_predictions")
            .select("pool_id")
            .eq("user_id", user.id)
            .in("pool_id", poolIds);
          answeredPoolIds = new Set((userPreds || []).map((p: any) => p.pool_id));
        }
        setAlreadyAnswered(answeredPoolIds);

        const flatQuestions: Question[] = [];
        for (const pool of pools) {
          if (!pool.options || !Array.isArray(pool.options)) continue;
          const firstOpt = pool.options[0];
          const isMulti = typeof firstOpt === "object" && firstOpt !== null && "question" in firstOpt;

          if (isMulti) {
            pool.options.forEach((q: any, i: number) => {
              if (!q.question || !q.options) return;
              flatQuestions.push({
                id: `${pool.id}_q${i}`,
                poolId: pool.id,
                text: q.question,
                options: q.options,
                correctAnswer: q.answer || pool.correct_answer,
                points: 10,
              });
            });
          } else {
            const opts = pool.options.filter((o: any) => typeof o === "string");
            if (opts.length > 0) {
              flatQuestions.push({
                id: pool.id,
                poolId: pool.id,
                text: pool.title,
                options: opts,
                correctAnswer: pool.correct_answer,
                points: pool.points_reward || 10,
              });
            }
          }
        }

        setQuestions(flatQuestions);
      } catch (err) {
        console.error("[PlayChallenge] load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showTag, user?.id]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const totalPoints = Object.values(results).reduce((sum, r) => sum + r.points, 0);
  const correctCount = Object.values(results).filter(r => r.correct).length;

  async function handleSelectAnswer(option: string) {
    if (answered || submitting || !currentQuestion) return;
    setSelectedAnswer(option);
    setAnswered(true);
    const isCorrect = currentQuestion.correctAnswer ? option === currentQuestion.correctAnswer : false;
    const points = isCorrect ? currentQuestion.points : 0;

    setResults(prev => ({ ...prev, [currentQuestion.id]: { correct: isCorrect, points } }));

    if (user?.id && !alreadyAnswered.has(currentQuestion.poolId)) {
      setSubmitting(true);
      try {
        const { error } = await supabase
          .from("user_predictions")
          .upsert({ user_id: user.id, pool_id: currentQuestion.poolId, prediction: option, points_earned: points }, { onConflict: "user_id,pool_id" });
        if (!error && points > 0) {
          await supabase.rpc("increment_user_points", { user_id_param: user.id, points_to_add: points });
        }
      } catch (e) {
        console.error("[PlayChallenge] submit error:", e);
      } finally {
        setSubmitting(false);
      }
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= totalQuestions) {
      setDone(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  }

  const accent = config.accentColor;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Navigation />
        <div className="text-center pt-24">
          <div className="w-12 h-12 rounded-full animate-pulse mx-auto mb-3" style={{ background: accent + "30" }} />
          <p className="text-gray-500 text-sm">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="px-4 pt-20 text-center">
          <p className="text-4xl mb-3">{config.emoji}</p>
          <h1 className="text-gray-900 text-xl font-bold mb-2">{showTag}</h1>
          <p className="text-gray-400 text-sm">No questions available yet. Check back soon!</p>
          <button onClick={() => setLocation("/play/pools")} className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: accent }}>
            Back to Pools
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((correctCount / totalQuestions) * 100);
    return (
      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(160deg, ${accent}22 0%, #f9fafb 40%)` }}>
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-28 pt-8 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: accent + "20" }}>
            <Trophy size={36} style={{ color: accent }} />
          </div>
          <h1 className="text-gray-900 text-2xl font-bold mb-1">Challenge Complete!</h1>
          <p className="text-gray-500 text-sm mb-8">{showTag}</p>

          <div className="w-full max-w-xs bg-white rounded-2xl shadow-sm p-6 mb-6" style={{ border: `1px solid ${accent}20` }}>
            <div className="text-5xl font-black mb-1" style={{ color: accent }}>{pct}%</div>
            <p className="text-gray-400 text-sm mb-4">Correct</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-900 text-lg font-bold">{correctCount}/{totalQuestions}</p>
                <p className="text-gray-400 text-xs">Questions</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-lg font-bold" style={{ color: accent }}>+{totalPoints}</p>
                <p className="text-gray-400 text-xs">Points earned</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setLocation("/play/pools")}
            className="w-full max-w-xs py-3.5 rounded-2xl text-white font-bold text-sm"
            style={{ background: accent }}
          >
            Back to Pools
          </button>
          <button
            onClick={() => { setCurrentIndex(0); setSelectedAnswer(null); setAnswered(false); setResults({}); setDone(false); }}
            className="mt-2.5 w-full max-w-xs py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  const q = currentQuestion;
  const result = results[q.id];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="px-4 pt-4 pb-28 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setLocation("/play/pools")}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{config.emoji}</span>
              <h1 className="text-gray-900 text-base font-bold truncate">{showTag}</h1>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">Question {currentIndex + 1} of {totalQuestions}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold" style={{ color: accent }}>+{totalPoints} pts</p>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%`, background: accent }}
          />
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm" style={{ border: "0.5px solid #f3f4f6" }}>
          <div className="flex items-start gap-2 mb-5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: accent + "18" }}>
              <Brain size={14} style={{ color: accent }} />
            </div>
            <p className="text-gray-900 text-[15px] font-semibold leading-snug">{q.text}</p>
          </div>

          <div className="space-y-2.5">
            {q.options.map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === q.correctAnswer;
              let bg = "bg-gray-50";
              let border = "border-gray-200";
              let textColor = "text-gray-900";
              let iconEl = null;

              if (answered) {
                if (isCorrect) {
                  bg = "bg-green-50";
                  border = "border-green-400";
                  textColor = "text-green-800";
                  iconEl = <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
                } else if (isSelected && !isCorrect) {
                  bg = "bg-red-50";
                  border = "border-red-400";
                  textColor = "text-red-800";
                  iconEl = <XCircle size={16} className="text-red-400 shrink-0" />;
                }
              } else if (isSelected) {
                bg = "";
                border = `border-[${accent}]`;
              }

              return (
                <button
                  key={option}
                  disabled={answered}
                  onClick={() => handleSelectAnswer(option)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all ${bg} ${textColor}`}
                  style={{
                    borderColor: answered && isCorrect ? "#4ade80" : answered && isSelected ? "#f87171" : isSelected ? accent : "#e5e7eb",
                    background: answered && isCorrect ? "#f0fdf4" : answered && isSelected && !isCorrect ? "#fef2f2" : isSelected && !answered ? accent + "10" : "",
                  }}
                >
                  <span className="text-sm font-medium leading-snug">{option}</span>
                  {iconEl}
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="mt-4 pt-3.5" style={{ borderTop: "0.5px solid #f3f4f6" }}>
              {result?.correct ? (
                <p className="text-green-600 text-sm font-semibold text-center">Correct! +{result.points} pts</p>
              ) : (
                <p className="text-gray-500 text-sm text-center">
                  {q.correctAnswer ? `The answer was: ${q.correctAnswer}` : "Better luck next time!"}
                </p>
              )}
            </div>
          )}
        </div>

        {answered && (
          <button
            onClick={handleNext}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm"
            style={{ background: accent }}
          >
            {currentIndex + 1 >= totalQuestions ? "See Results" : "Next Question"}
          </button>
        )}
      </div>
    </div>
  );
}
