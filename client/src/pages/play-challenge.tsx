import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, CheckCircle2, XCircle, Trophy, Brain, Lock } from "lucide-react";
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

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; points: number; color: string }> = {
  easy:   { label: "Easy",   points: 10, color: "#22c55e" },
  medium: { label: "Medium", points: 15, color: "#f59e0b" },
  hard:   { label: "Hard",   points: 25, color: "#ef4444" },
};

const CHALLENGE_BANKS: Record<string, Record<Difficulty, Omit<Question, "id" | "points">[]>> = {
  "Harry Potter": {
    easy: [
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
    medium: [
      { text: "What is the incantation to cast a Patronus charm?", options: ["Expecto Patronum", "Expelliarmus", "Riddikulus", "Lumos Maxima"], correctAnswer: "Expecto Patronum" },
      { text: "What animal is Harry's Patronus?", options: ["Stag", "Doe", "Otter", "Wolf"], correctAnswer: "Stag" },
      { text: "Who teaches Defense Against the Dark Arts in Harry's first year?", options: ["Professor Quirrell", "Professor Lockhart", "Professor Lupin", "Professor Umbridge"], correctAnswer: "Professor Quirrell" },
      { text: "What is the name of Dumbledore's phoenix?", options: ["Fawkes", "Phoenix", "Blaze", "Ember"], correctAnswer: "Fawkes" },
      { text: "What does Hermione use to attend multiple classes at once in Year 3?", options: ["Time-Turner", "Invisibility Cloak", "Portkey", "Floo Powder"], correctAnswer: "Time-Turner" },
      { text: "What tree attacks Ron and Harry when they arrive at Hogwarts in Year 2?", options: ["The Whomping Willow", "The Forbidden Forest Oak", "The Shrieking Shrub", "The Haunted Elm"], correctAnswer: "The Whomping Willow" },
      { text: "Who is the author of 'Fantastic Beasts and Where to Find Them'?", options: ["Newt Scamander", "Gilderoy Lockhart", "Albus Dumbledore", "Bathilda Bagshot"], correctAnswer: "Newt Scamander" },
      { text: "Which Quidditch position does Harry play?", options: ["Seeker", "Keeper", "Beater", "Chaser"], correctAnswer: "Seeker" },
      { text: "What is the incantation to disarm an opponent?", options: ["Expelliarmus", "Stupefy", "Protego", "Accio"], correctAnswer: "Expelliarmus" },
      { text: "Who is the Malfoy family's house elf?", options: ["Dobby", "Kreacher", "Winky", "Hokey"], correctAnswer: "Dobby" },
      { text: "In which book does Harry first learn about Horcruxes from Dumbledore?", options: ["Half-Blood Prince", "Order of the Phoenix", "Goblet of Fire", "Deathly Hallows"], correctAnswer: "Half-Blood Prince" },
      { text: "What does the spell 'Lumos' do?", options: ["Creates light at wand tip", "Unlocks doors", "Levitates objects", "Creates a shield"], correctAnswer: "Creates light at wand tip" },
    ],
    hard: [
      { text: "What is the vault number where the Sorcerer's Stone is kept at Gringotts?", options: ["713", "711", "217", "666"], correctAnswer: "713" },
      { text: "Who is R.A.B. — the person who stole the real locket Horcrux?", options: ["Regulus Arcturus Black", "Rodolphus Algernon Bellatrix", "Rufus Archibald Bones", "Roland Aldric Birch"], correctAnswer: "Regulus Arcturus Black" },
      { text: "What is Professor Dumbledore's full name?", options: ["Albus Percival Wulfric Brian Dumbledore", "Albus Phineas Wolfric Brayan Dumbledore", "Albert Percival Wulfric Bernard Dumbledore", "Albus Percy Wulfrick Brian Dumbledore"], correctAnswer: "Albus Percival Wulfric Brian Dumbledore" },
      { text: "What is the Hogwarts school motto?", options: ["Draco Dormiens Nunquam Titillandus", "Semper Vigilans Et Fortis", "Veritas Et Honorum", "Ad Astra Per Aspera"], correctAnswer: "Draco Dormiens Nunquam Titillandus" },
      { text: "What is the name of Neville Longbottom's toad?", options: ["Trevor", "Tanker", "Toadsworth", "Tybalt"], correctAnswer: "Trevor" },
      { text: "What are Voldemort's parents' names?", options: ["Tom Riddle Sr. and Merope Gaunt", "Tom Riddle Sr. and Helena Gaunt", "Morphin Gaunt and Cecelia Riddle", "Morfin Gaunt and Mary Riddle"], correctAnswer: "Tom Riddle Sr. and Merope Gaunt" },
      { text: "What core does Voldemort's wand share with Harry's?", options: ["Phoenix feather", "Dragon heartstring", "Unicorn hair", "Thestral tail hair"], correctAnswer: "Phoenix feather" },
      { text: "What does Dumbledore see when he looks into the Mirror of Erised?", options: ["He and his family united, wearing warm socks", "Himself as the greatest wizard", "Gellert Grindelwald defeated", "The Deathly Hallows assembled"], correctAnswer: "He and his family united, wearing warm socks" },
      { text: "What is the name of the Leaky Cauldron's landlord in the early books?", options: ["Tom", "Bob", "Stan", "Ernie"], correctAnswer: "Tom" },
      { text: "In which village did the Potters live before they went into hiding?", options: ["Godric's Hollow", "Hogsmeade", "Ottery St. Catchpole", "Little Whinging"], correctAnswer: "Godric's Hollow" },
      { text: "What does the incantation 'Obliviate' do?", options: ["Erases memories", "Opens locks", "Creates fire", "Reveals hidden objects"], correctAnswer: "Erases memories" },
      { text: "Which school does Fleur Delacour represent in the Triwizard Tournament?", options: ["Beauxbatons", "Durmstrang", "Ilvermorny", "Castelobruxo"], correctAnswer: "Beauxbatons" },
    ],
  },
  "Friends": {
    easy: [
      { text: "What is the name of the coffee shop the friends hang out at?", options: ["Central Perk", "The Coffee Bean", "Java City", "Perky's"], correctAnswer: "Central Perk" },
      { text: "How many times has Ross been divorced?", options: ["3", "2", "1", "4"], correctAnswer: "3" },
      { text: "What is Phoebe's twin sister's name?", options: ["Ursula", "Sandra", "Regina", "Francesca"], correctAnswer: "Ursula" },
      { text: "What is Monica's career?", options: ["Chef", "Doctor", "Lawyer", "Florist"], correctAnswer: "Chef" },
      { text: "What is Rachel's last name?", options: ["Green", "Geller", "Bing", "Buffay"], correctAnswer: "Green" },
      { text: "What song does Phoebe sing at Central Perk?", options: ["Smelly Cat", "Sticky Shoes", "Hairy Bear", "Lonely Dog"], correctAnswer: "Smelly Cat" },
      { text: "Which friend works at Bloomingdale's?", options: ["Rachel", "Monica", "Phoebe", "Emily"], correctAnswer: "Rachel" },
      { text: "What is Joey's agent's name?", options: ["Estelle", "Stella", "Nicole", "Karen"], correctAnswer: "Estelle" },
      { text: "Who famously said 'We were on a break!'?", options: ["Ross", "Chandler", "Joey", "Richard"], correctAnswer: "Ross" },
      { text: "What is the name of Ross's pet monkey?", options: ["Marcel", "Max", "Buddy", "Chester"], correctAnswer: "Marcel" },
      { text: "Where do Monica and Chandler move at the end of the series?", options: ["Westchester", "New Jersey", "Connecticut", "Long Island"], correctAnswer: "Westchester" },
      { text: "What is Joey's character name on Days of Our Lives?", options: ["Dr. Drake Ramoray", "Dr. Ramoray Drake", "Dr. Joe Drake", "Dr. Joey Drake"], correctAnswer: "Dr. Drake Ramoray" },
    ],
    medium: [
      { text: "What is the name of Ross's first wife?", options: ["Carol", "Emily", "Elizabeth", "Mona"], correctAnswer: "Carol" },
      { text: "Who is Gunther secretly in love with throughout the series?", options: ["Rachel", "Monica", "Phoebe", "Janice"], correctAnswer: "Rachel" },
      { text: "How many seasons of Friends are there?", options: ["10", "8", "9", "11"], correctAnswer: "10" },
      { text: "What is the name of Joey and Chandler's favorite TV show?", options: ["Baywatch", "ER", "Days of Our Lives", "MacGyver"], correctAnswer: "Baywatch" },
      { text: "What is Monica's brother's name?", options: ["Ross", "Richard", "Ryan", "Randy"], correctAnswer: "Ross" },
      { text: "In what city is Friends set?", options: ["New York City", "Los Angeles", "Chicago", "Boston"], correctAnswer: "New York City" },
      { text: "What is the name of Ross and Monica's dog growing up?", options: ["Chi-Chi", "Spot", "Rufus", "Buddy"], correctAnswer: "Chi-Chi" },
      { text: "What store does Phoebe's boyfriend David work at when she first meets him?", options: ["He's a scientist, not a store worker", "Central Perk", "Bloomingdale's", "The Museum"], correctAnswer: "He's a scientist, not a store worker" },
      { text: "What holiday does Chandler hate?", options: ["Thanksgiving", "Christmas", "Halloween", "Valentine's Day"], correctAnswer: "Thanksgiving" },
      { text: "What are the names of Chandler and Monica's twins?", options: ["Jack and Erica", "Ben and Erica", "Ross and Rachel", "Joey and Phoebe"], correctAnswer: "Jack and Erica" },
      { text: "What is the name of Joey's stuffed penguin?", options: ["Hugsy", "Penguin", "Waddles", "Pablo"], correctAnswer: "Hugsy" },
      { text: "Who officiates Monica and Chandler's wedding?", options: ["Joey", "Ross", "Phoebe", "Gunther"], correctAnswer: "Joey" },
    ],
    hard: [
      { text: "What is Chandler Bing's middle name?", options: ["Muriel", "Matthew", "Michael", "Martin"], correctAnswer: "Muriel" },
      { text: "What year did Friends first premiere?", options: ["1994", "1995", "1993", "1996"], correctAnswer: "1994" },
      { text: "What is the name of Phoebe's birth mother?", options: ["Phoebe Abbott", "Sandra Green", "Judy Geller", "Alice Knight"], correctAnswer: "Phoebe Abbott" },
      { text: "What is the name of the pizza place the gang orders from most often?", options: ["Pizza By Alfredo", "Mario's Pizza", "Riff's Place", "Salvatore's"], correctAnswer: "Pizza By Alfredo" },
      { text: "What is the name of the episode where everyone finds out about Monica and Chandler?", options: ["The One Where Everybody Finds Out", "The One With The Secret", "The One Where Ross Finds Out", "The One With The Revelation"], correctAnswer: "The One Where Everybody Finds Out" },
      { text: "What does the character 'Ugly Naked Guy' eventually do with his apartment?", options: ["Ross rents it", "Joey moves in", "He gives it to Phoebe", "Rachel moves back in"], correctAnswer: "Ross rents it" },
      { text: "What is the name of Joey's roommate before he moves in with Chandler?", options: ["He always lived with Chandler", "Kip", "Eddie", "Gary"], correctAnswer: "Kip" },
      { text: "In which state was Chandler falsely imprisoned in the early seasons?", options: ["Yemen", "He was never falsely imprisoned", "Tulsa", "He told Janice he was moving to Yemen"], correctAnswer: "He told Janice he was moving to Yemen" },
      { text: "What actress played Phoebe Buffay?", options: ["Lisa Kudrow", "Courteney Cox", "Jennifer Aniston", "Helen Hunt"], correctAnswer: "Lisa Kudrow" },
      { text: "What is the name of the game show that Joey hosts in a later season?", options: ["Bamboozled", "Pyramid", "Wipeout", "Lucky Stars"], correctAnswer: "Bamboozled" },
      { text: "Who was Monica's boyfriend before Richard?", options: ["Alan", "Fun Bobby", "Paul the Wine Guy", "Pete Becker"], correctAnswer: "Fun Bobby" },
      { text: "What is Phoebe's legal name after she changes it?", options: ["Princess Consuela Banana Hammock", "Queen Consuela Banana Hammock", "Princess Phoebe Buffay", "Crap Bag Banana Hammock"], correctAnswer: "Princess Consuela Banana Hammock" },
    ],
  },
};

const SHOW_CONFIG: Record<string, { accentColor: string; posterUrl: string; fallbackEmoji: string }> = {
  "Harry Potter": {
    accentColor: "#7c3aed",
    posterUrl: "https://image.tmdb.org/t/p/w200/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg",
    fallbackEmoji: "⚡",
  },
  "Friends": {
    accentColor: "#7c3aed",
    posterUrl: "https://image.tmdb.org/t/p/w200/f496cm9enuEsZkSPzCwnTESEK5s.jpg",
    fallbackEmoji: "☕",
  },
};

function getConfig(showTag: string) {
  return SHOW_CONFIG[showTag] || { accentColor: "#7c3aed", posterUrl: "", fallbackEmoji: "🎮" };
}

function completionKey(showTag: string, difficulty: Difficulty) {
  return `challenge-completed-${showTag}-${difficulty}`;
}

export function markChallengeCompleted(showTag: string, difficulty: Difficulty) {
  localStorage.setItem(completionKey(showTag, difficulty), "1");
}

export function isChallengeCompleted(showTag: string, difficulty: Difficulty) {
  return localStorage.getItem(completionKey(showTag, difficulty)) === "1";
}

export default function PlayChallengePage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ showTag: string; difficulty?: string }>();
  const { user } = useAuth();

  const showTag = decodeURIComponent(params.showTag || "");
  const difficulty: Difficulty = (params.difficulty as Difficulty) || "easy";
  const config = getConfig(showTag);
  const diffConfig = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.easy;
  const [posterFailed, setPosterFailed] = useState(false);

  const bankForShow = CHALLENGE_BANKS[showTag];
  const rawQuestions = bankForShow?.[difficulty] || [];
  const questions: Question[] = rawQuestions.map((q, i) => ({
    ...q,
    id: `${showTag.replace(/\s+/g, "-").toLowerCase()}-${difficulty}-q${i}`,
    points: diffConfig.points,
  }));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Record<string, { correct: boolean; points: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
        const poolKey = `challenge-${showTag.replace(/\s+/g, "-").toLowerCase()}-${difficulty}-${currentIndex}`;
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
      markChallengeCompleted(showTag, difficulty);
      setDone(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  }

  const accent = config.accentColor;

  const nextDifficulty: Record<Difficulty, Difficulty | null> = {
    easy: "medium",
    medium: "hard",
    hard: null,
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="px-4 pt-20 text-center">
          <p className="text-4xl mb-3">{config.fallbackEmoji}</p>
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
    const next = nextDifficulty[difficulty];
    return (
      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(160deg, ${accent}22 0%, #f9fafb 40%)` }}>
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-28 pt-8 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: accent + "20" }}>
            <Trophy size={36} style={{ color: accent }} />
          </div>
          <h1 className="text-gray-900 text-2xl font-bold mb-1">Round Complete!</h1>
          <p className="text-gray-500 text-sm mb-1">{showTag}</p>
          <div
            className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-8"
            style={{ background: diffConfig.color + "18", color: diffConfig.color }}
          >
            {diffConfig.label}
          </div>

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

          {next && (
            <button
              onClick={() => setLocation(`/play/challenge/${encodeURIComponent(showTag)}/${next}`)}
              className="w-full max-w-xs py-3.5 rounded-2xl text-white font-bold text-sm mb-2.5"
              style={{ background: accent }}
            >
              Play {DIFFICULTY_CONFIG[next].label} Round
            </button>
          )}
          <button
            onClick={() => setLocation("/play/pools")}
            className="w-full max-w-xs py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100"
          >
            Back to Pools
          </button>
          <button
            onClick={() => { setCurrentIndex(0); setSelectedAnswer(null); setAnswered(false); setResults({}); setDone(false); }}
            className="mt-2 text-sm text-gray-400 underline"
          >
            Play again
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setLocation("/play/pools")}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
              {!posterFailed && config.posterUrl ? (
                <img
                  src={config.posterUrl}
                  alt={showTag}
                  className="w-full h-full object-cover"
                  onError={() => setPosterFailed(true)}
                />
              ) : (
                <span className="text-base">{config.fallbackEmoji}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-gray-900 text-sm font-bold truncate">{showTag}</h1>
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: diffConfig.color + "15", color: diffConfig.color }}
                >
                  {diffConfig.label}
                </span>
              </div>
              <p className="text-gray-400 text-xs">Question {currentIndex + 1} of {totalQuestions}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold" style={{ color: accent }}>+{totalPoints} pts</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%`, background: diffConfig.color }}
          />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm" style={{ border: "0.5px solid #f3f4f6" }}>
          <div className="flex items-start gap-2 mb-5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: diffConfig.color + "18" }}>
              <Brain size={14} style={{ color: diffConfig.color }} />
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
            style={{ background: diffConfig.color }}
          >
            {currentIndex + 1 >= totalQuestions ? "See Results" : "Next Question"}
          </button>
        )}
      </div>
    </div>
  );
}
