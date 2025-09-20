import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Sparkles, Dna } from "lucide-react";

interface SurveyAnswer {
  questionId: string;
  answer: string;
}

interface DNAProfile {
  title: string;
  description: string;
  superpowers: string[];
  meaning: string;
}

const surveyQuestions = [
  {
    id: "discovery",
    question: "How do you usually discover new entertainment?",
    options: [
      { value: "social", label: "Friends and social media recommendations" },
      { value: "algorithms", label: "Platform algorithms and trending lists" },
      { value: "critics", label: "Professional reviews and critic scores" },
      { value: "explore", label: "I love browsing and discovering randomly" }
    ]
  },
  {
    id: "consumption_style",
    question: "What's your ideal entertainment consumption style?",
    options: [
      { value: "binge", label: "Binge everything in marathon sessions" },
      { value: "scheduled", label: "Regular scheduled viewing/reading time" },
      { value: "mood", label: "Whatever matches my current mood" },
      { value: "social", label: "Only when I can share the experience with others" }
    ]
  },
  {
    id: "genre_preference",
    question: "Which best describes your genre approach?",
    options: [
      { value: "loyal", label: "I stick to genres I know I love" },
      { value: "adventurous", label: "I actively seek out new and different genres" },
      { value: "mood_based", label: "My genre choice depends entirely on my mood" },
      { value: "quality_first", label: "Genre doesn't matter if the quality is high" }
    ]
  },
  {
    id: "sharing_style",
    question: "How do you like to share your entertainment experiences?",
    options: [
      { value: "detailed_reviews", label: "Write detailed reviews and thoughtful analysis" },
      { value: "quick_ratings", label: "Quick ratings and short reactions" },
      { value: "recommendations", label: "Focus on recommending to specific people" },
      { value: "private", label: "Keep my entertainment experiences mostly private" }
    ]
  },
  {
    id: "completion_style",
    question: "What's your approach to finishing entertainment?",
    options: [
      { value: "completionist", label: "I finish everything I start, no matter what" },
      { value: "selective", label: "Life's too short for bad content - I drop things quickly" },
      { value: "comeback", label: "I take breaks but usually come back to finish later" },
      { value: "sampler", label: "I prefer trying many things rather than finishing everything" }
    ]
  },
  {
    id: "emotional_connection",
    question: "What creates the strongest emotional connection for you?",
    options: [
      { value: "characters", label: "Deep, complex characters I can relate to" },
      { value: "storytelling", label: "Masterful storytelling and plot construction" },
      { value: "world_building", label: "Rich, immersive worlds I can escape into" },
      { value: "themes", label: "Content that explores meaningful themes and ideas" }
    ]
  }
];

const generateDNAProfile = (answers: SurveyAnswer[]): DNAProfile => {
  // Analyze answers to determine personality type
  const answerMap = answers.reduce((acc, answer) => {
    acc[answer.questionId] = answer.answer;
    return acc;
  }, {} as Record<string, string>);

  // Example personality types based on common patterns
  if (answerMap.discovery === "explore" && answerMap.genre_preference === "adventurous") {
    return {
      title: "The Entertainment Explorer",
      description: "You're a fearless discoverer of new entertainment experiences! Your DNA reveals someone who thrives on variety and surprise.",
      superpowers: [
        "**Genre Hopper**: No entertainment category can contain your curiosity",
        "**Hidden Gem Hunter**: You find amazing content others miss",
        "**Trend Pioneer**: You discover things before they become popular",
        "**Recommendation Engine**: Friends rely on you for fresh ideas"
      ],
      meaning: "You approach entertainment like an adventurous explorer - always pushing boundaries and seeking new experiences. You're the friend who introduces everyone to their next favorite obsession."
    };
  }

  if (answerMap.sharing_style === "detailed_reviews" && answerMap.completion_style === "completionist") {
    return {
      title: "The Binge-Watching Bibliophile",
      description: "You're the rare entertainment enthusiast who seamlessly blends intellectual curiosity with pure escapism! Your DNA reveals a fascinating pattern:",
      superpowers: [
        "**Quality Curator**: Your careful analysis shows you appreciate both blockbusters and hidden gems",
        "**Deep Diver**: You don't just consume content, you truly experience it",
        "**Community Builder**: You love sharing discoveries and building conversations",
        "**Completion Master**: Once you start something great, you see it through to the end"
      ],
      meaning: "You approach entertainment like a passionate scholar - diving deep into every experience and building meaningful connections with content and community."
    };
  }

  if (answerMap.consumption_style === "social" && answerMap.emotional_connection === "characters") {
    return {
      title: "The Social Story Seeker",
      description: "You're all about shared experiences and emotional connections! Your entertainment DNA shows someone who values community and character depth.",
      superpowers: [
        "**Community Connector**: Entertainment is better when shared with others",
        "**Character Whisperer**: You form deep connections with fictional personalities",
        "**Experience Amplifier**: You make every watch party or book club better",
        "**Emotion Explorer**: You seek content that makes you feel deeply"
      ],
      meaning: "You see entertainment as a bridge to deeper human connection - whether through beloved characters or shared experiences with friends and family."
    };
  }

  if (answerMap.consumption_style === "mood" && answerMap.completion_style === "selective") {
    return {
      title: "The Mood-Driven Curator",
      description: "You're an intuitive entertainment consumer who follows your instincts! Your DNA reveals someone who trusts their emotional intelligence.",
      superpowers: [
        "**Mood Matcher**: You always know exactly what you need to watch or read",
        "**Quality Guardian**: Life's too short for bad content - you protect your time",
        "**Instinct Follower**: You trust your gut feeling about what's worth your time",
        "**Flexible Consumer**: You adapt your entertainment to fit your life perfectly"
      ],
      meaning: "You approach entertainment with emotional intelligence - knowing when to commit and when to move on, always following what truly resonates with you."
    };
  }

  // Default profile for other combinations
  return {
    title: "The Balanced Entertainment Enthusiast",
    description: "You have a wonderfully balanced approach to entertainment! Your DNA shows someone who appreciates variety and quality.",
    superpowers: [
      "**Versatile Viewer**: You can appreciate different types of content equally",
      "**Balanced Consumer**: You find the right mix of depth and variety",
      "**Open Explorer**: You're willing to try new things while respecting your preferences",
      "**Thoughtful Selector**: You make intentional choices about your entertainment time"
    ],
    meaning: "You approach entertainment with wisdom and flexibility - enjoying the journey while making choices that truly serve your interests and lifestyle."
  };
};

export default function OnboardingPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [dnaProfile, setDNAProfile] = useState<DNAProfile | null>(null);

  const handleAnswer = (value: string) => {
    const newAnswers = answers.filter(a => a.questionId !== surveyQuestions[currentQuestion].id);
    newAnswers.push({
      questionId: surveyQuestions[currentQuestion].id,
      answer: value
    });
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < surveyQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Generate DNA profile
      const profile = generateDNAProfile(answers);
      setDNAProfile(profile);
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const getCurrentAnswer = () => {
    return answers.find(a => a.questionId === surveyQuestions[currentQuestion].id)?.answer;
  };

  const progress = ((currentQuestion + 1) / surveyQuestions.length) * 100;

  if (showResults && dnaProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Dna className="text-white" size={40} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Entertainment DNA</h1>
            <div className="w-16 h-1 bg-gradient-to-r from-purple-600 to-pink-600 mx-auto rounded-full"></div>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                {dnaProfile.title}
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed">
                {dnaProfile.description}
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Sparkles className="mr-2 text-purple-600" size={24} />
                Your Entertainment Superpowers:
              </h3>
              <ul className="space-y-3">
                {dnaProfile.superpowers.map((power, index) => (
                  <li key={index} className="text-gray-700 text-base leading-relaxed">
                    • {power}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-3">🔮 What This Means:</h3>
              <p className="text-gray-700 text-base leading-relaxed">
                {dnaProfile.meaning}
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Button 
              onClick={() => window.location.href = '/dashboard'}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-4 text-lg rounded-full shadow-lg"
              data-testid="complete-onboarding-button"
            >
              Start Exploring Entertainlit!
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Dna className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Your Entertainment DNA</h1>
          <p className="text-gray-600 text-lg">
            Let's understand how you consume entertainment so we can personalize your experience
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestion + 1} of {surveyQuestions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Question */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 leading-relaxed">
            {surveyQuestions[currentQuestion].question}
          </h2>

          <RadioGroup 
            value={getCurrentAnswer() || ""} 
            onValueChange={handleAnswer}
            className="space-y-4"
          >
            {surveyQuestions[currentQuestion].options.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label 
                  htmlFor={option.value} 
                  className="text-gray-700 text-base leading-relaxed cursor-pointer flex-1"
                  data-testid={`option-${option.value}`}
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            variant="outline"
            className="flex items-center space-x-2 disabled:opacity-50"
            data-testid="previous-question-button"
          >
            <ChevronLeft size={20} />
            <span>Previous</span>
          </Button>

          <Button
            onClick={handleNext}
            disabled={!getCurrentAnswer()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center space-x-2 px-8 py-3 disabled:opacity-50"
            data-testid="next-question-button"
          >
            <span>{currentQuestion === surveyQuestions.length - 1 ? "Discover My DNA" : "Next"}</span>
            {currentQuestion === surveyQuestions.length - 1 ? (
              <Sparkles size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}