import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, CheckCircle2, XCircle, Trophy, Brain } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
}

const CHALLENGE_BANKS: Record<string, { questions: Omit<Question, "id" | "points">[] }> = {
  "Harry Potter": {
    questions: [
      { text: "What is the name of Harry Potter's owl?", options: ["Hedwig", "Crookshanks", "Fang", "Scabbers"], correctAnswer: "Hedwig" },
      { text: "Which Hogwarts house does Harry belong to?", options: ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"], correctAnswer: "Gryffindor" },
      { text: "What is the core of Harry Potter's wand?", options: ["Phoenix feather", "Dragon heartstring", "Unicorn hair", "Veela hair"], correctAnswer: "Phoenix feather" },
      { text: "What platform do students board the Hogwarts Express from?", options: ["Platform 9¾", "Platform 10", "Platform 8¾", "Platform 7"], correctAnswer: "Platform 9¾" },
      { text: "What is the name of Hagrid's three-headed dog?", options: ["Fluffy", "Fang", "Norbert", "Buckbeak"], correctAnswer: "Fluffy" },
      { text: "What subject does Professor Snape actually want to teach?", options: ["Defense Against the Dark Arts", "Potions", "Transfiguration", "Divination"], correctAnswer: "Defense Against the Dark Arts" },
      { text: "How many points is catching the Golden Snitch worth in Quidditch?", options: ["150 points", "100 points", "50 points", "200 points"], correctAnswer: "150 points" },
      { text: "What is the name of the Weasley family's home?", options: ["The Burrow", "The Hollow", "The Den", "The Hive"], correctAnswer: "The Burrow" },
      { text: "Who is revealed to be the Half-Blood Prince?", options: ["Severus Snape", "Tom Riddle", "Sirius Black", "Albus Dumbledore"], correctAnswer: "Severus Snape" },
      { text: "What animal form does Professor McGonagall's Animagus take?", options: ["Tabby cat", "Black dog", "Stag", "Raven"], correctAnswer: "Tabby cat" },
      { text: "What is the name of Voldemort's snake?", options: ["Nagini", "Basilisk", "Norberta", "Aragog"], correctAnswer: "Nagini" },
      { text: "What type of creature guards the vaults at Gringotts bank?", options: ["Goblins", "Trolls", "Giants", "House Elves"], correctAnswer: "Goblins" },
    ],
  },
  "Friends": {
    questions: [
      { text: "What is the name of the coffee shop the friends hang out at?", options: ["Central Perk", "The Coffee Bean", "Java City", "Perky's"], correctAnswer: "Central Perk" },
      { text: "How many times has Ross been divorced?", options: ["3", "2", "1", "4"], correctAnswer: "3" },
      { text: "What is Phoebe's twin sister's name?", options: ["Ursula", "Sandra", "Regina", "Francesca"], correctAnswer: "Ursula" },
      { text: "What is Monica's career?", options: ["Chef", "Doctor", "Lawyer", "Florist"], correctAnswer: "Chef" },
      { text: "What is Rachel's last name?", options: ["Green", "Geller", "Bing", "Buffay"], correctAnswer: "Green" },
      { text: "What song does Phoebe sing at Central Perk?", options: ["Smelly Cat", "Sticky Shoes", "Hairy Bear", "Lonely Dog"], correctAnswer: "Smelly Cat" },
      { text: "Which friend works at Bloomingdale's?", options: ["Rachel", "Monica", "Phoebe", "Emily"], correctAnswer: "Rachel" },
      { text: "What is Joey's agent's name?", options: ["Estelle", "Stella", "Nicole", "Karen"], correctAnswer: "Estelle" },
      { text: "Who famously said \"We were on a break!\"?", options: ["Ross", "Chandler", "Joey", "Richard"], correctAnswer: "Ross" },
      { text: "What is the name of Ross's pet monkey?", options: ["Marcel", "Max", "Buddy", "Chester"], correctAnswer: "Marcel" },
      { text: "Where do Monica and Chandler move at the end of the series?", options: ["Westchester", "New Jersey", "Connecticut", "Long Island"], correctAnswer: "Westchester" },
      { text: "What is Joey's character name on Days of Our Lives?", options: ["Dr. Drake Ramoray", "Dr. Ramoray Drake", "Dr. Joe Drake", "Dr. Joey Drake"], correctAnswer: "Dr. Drake Ramoray" },
    ],
  },
};

const SHOW_CONFIG: Record<string, { emoji: string; accentColor: string; description: string }> = {
  "Harry Potter": { emoji: "⚡", accentColor: "#7c3aed", description: "Test your wizarding world knowledge" },
  "Friends": { emoji: "☕", accentColor: "#f59e0b", description: "Could you BE any more of a fan?" },
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

  const bank = CHALLENGE_BANKS[showTag];
  const questions: Question[] = (bank?.questions || []).map((q, i) => ({
    ...q,
    id: `${showTag.replace(/\s+/g, "-").toLowerCase()}-q${i}`,
    points: 10,
  }));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Record<string, { correct: boolean; points: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionKey] = useState(() => `challenge-${showTag}-${Date.now()}`);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const totalPoints = Object.values(results).reduce((sum, r) => sum + r.points, 0);
  const correctCount = Object.values(results).filter(r => r.correct).length;

  async function handleSelectAnswer(option: string) {
    if (answered || submitting || !currentQuestion) return;
    setSelectedAnswer(option);
    setAnswered(true);

    const isCorrect = option === currentQuestion.correctAnswer;
    const points = isCorrect ? currentQuestion.points : 0;
    setResults(prev => ({ ...prev, [currentQuestion.id]: { correct: isCorrect, points } }));

    if (user?.id) {
      setSubmitting(true);
      try {
        const poolKey = `challenge-${showTag.replace(/\s+/g, "-").toLowerCase()}-${currentIndex}`;
        await supabase
          .from("user_predictions")
          .upsert(
            { user_id: user.id, pool_id: poolKey, prediction: option, points_earned: points },
            { onConflict: "user_id,pool_id" }
          );
        if (points > 0) {
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
              let iconEl = null;

              if (answered && isCorrect) {
                iconEl = <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
              } else if (answered && isSelected && !isCorrect) {
                iconEl = <XCircle size={16} className="text-red-400 shrink-0" />;
              }

              return (
                <button
                  key={option}
                  disabled={answered}
                  onClick={() => handleSelectAnswer(option)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: answered && isCorrect ? "#4ade80" : answered && isSelected && !isCorrect ? "#f87171" : isSelected && !answered ? accent : "#e5e7eb",
                    background: answered && isCorrect ? "#f0fdf4" : answered && isSelected && !isCorrect ? "#fef2f2" : isSelected && !answered ? accent + "10" : "",
                    color: answered && isCorrect ? "#166534" : answered && isSelected && !isCorrect ? "#991b1b" : "#111827",
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
                  The answer was: <span className="font-semibold text-gray-700">{q.correctAnswer}</span>
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
