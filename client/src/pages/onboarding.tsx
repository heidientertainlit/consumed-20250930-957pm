
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Sparkles, Dna, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface SurveyAnswer {
  questionId: string;
  answer: string | string[];
}

interface DNAProfile {
  title: string;
  description: string;
  superpowers: string[];
  meaning: string;
}

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
  const { session } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [dnaProfile, setDNAProfile] = useState<DNAProfile | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  // Fetch survey questions from database
  useEffect(() => {
    const fetchSurveyQuestions = async () => {
      try {
        const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/rest/v1/edna_questions?select=*&order=display_order.asc', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const questions = await response.json();
          setSurveyQuestions(questions);
        } else {
          console.error('Failed to fetch survey questions');
        }
      } catch (error) {
        console.error('Error fetching survey questions:', error);
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    fetchSurveyQuestions();
  }, [session?.access_token]);

  const handleAnswer = (value: string | string[]) => {
    if (surveyQuestions.length === 0) return;
    
    const newAnswers = answers.filter(a => a.questionId !== surveyQuestions[currentQuestion].id);
    newAnswers.push({
      questionId: surveyQuestions[currentQuestion].id,
      answer: value
    });
    setAnswers(newAnswers);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing your responses...");

  const handleNext = async () => {
    if (currentQuestion < surveyQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Save responses to database and generate AI DNA profile
      setIsGenerating(true);
      
      // Rotating loading messages
      const messages = [
        "Analyzing your responses...",
        "Mapping your entertainment preferences...",
        "Discovering your unique patterns...",
        "Crafting your DNA profile...",
        "Almost there, adding the finishing touches..."
      ];
      
      let messageIndex = 0;
      const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
      }, 6000);
      
      try {
        // First, save all survey responses
        for (const answer of answers) {
          await fetch('https://mahpgcogwpawvviapqza.supabase.co/rest/v1/edna_responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              user_id: session?.user?.id,
              question_id: answer.questionId,
              answer_text: Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer
            })
          });
        }

        // Now call the AI generation edge function
        const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-dna-profile', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: session?.user?.id }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate DNA profile');
        }

        const aiProfile = await response.json();
        
        // Convert to display format
        setDNAProfile({
          title: aiProfile.label || 'Entertainment Enthusiast',
          description: aiProfile.tagline || '',
          superpowers: aiProfile.flavor_notes || [],
          meaning: aiProfile.profile_text || ''
        });
        
        // Pre-generate recommendations in background (don't await - fire and forget)
        // TODO: Switch back to rebuild-recommendations after deploying edge functions
        fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-media-recommendations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }).catch(() => {
          // Silent fail - recommendations will be generated on first visit to track page if this fails
        });
        
        clearInterval(messageInterval);
        setShowResults(true);
      } catch (error) {
        console.error('Error generating DNA profile:', error);
        clearInterval(messageInterval);
        // Fallback to local generation if AI fails
        const profile = generateDNAProfile(answers);
        setDNAProfile(profile);
        setShowResults(true);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const getCurrentAnswer = () => {
    if (surveyQuestions.length === 0) return undefined;
    return answers.find(a => a.questionId === surveyQuestions[currentQuestion].id)?.answer;
  };

  const progress = surveyQuestions.length > 0 ? ((currentQuestion + 1) / surveyQuestions.length) * 100 : 0;

  // Show loading state while fetching questions
  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="text-white animate-spin" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading Your Entertainment DNA Survey</h1>
          <p className="text-gray-600">
            Preparing your personalized questions...
          </p>
          <p className="text-sm text-gray-500 mt-2">This will just take a moment</p>
        </div>
      </div>
    );
  }

  // Show loading screen while generating DNA profile
  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Dna className="text-white animate-spin" size={40} style={{ animationDuration: '3s' }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Discovering Your Entertainment DNA</h1>
          <p className="text-gray-700 mb-6 text-lg font-medium animate-pulse">
            {loadingMessage}
          </p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5 mb-4">
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 h-2.5 rounded-full animate-pulse" style={{ width: '85%' }}></div>
          </div>
          <p className="text-sm text-gray-600 mb-2">Give us a moment while our AI analyzes your responses...</p>
          <p className="text-xs text-gray-500">This usually takes 30-60 seconds</p>
          
          <div className="mt-8 flex justify-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && dnaProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Dna className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Entertainment DNA</h1>
            <div className="w-12 h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 mx-auto rounded-full"></div>
          </div>

          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                {dnaProfile.title}
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {dnaProfile.description}
              </p>
            </div>

            {dnaProfile.superpowers && dnaProfile.superpowers.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <Sparkles className="mr-2 text-purple-600" size={20} />
                  Your Flavor Notes:
                </h3>
                <ul className="space-y-2">
                  {dnaProfile.superpowers.map((power, index) => (
                    <li key={index} className="text-gray-700 text-sm leading-relaxed">
                      • {power}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dnaProfile.meaning && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-2">🔮 Your Entertainment DNA:</h3>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                  {dnaProfile.meaning}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <Button 
              onClick={() => {
                // DNA profile is already saved by the edge function
                window.location.href = '/feed';
              }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-2.5 rounded-full shadow-lg text-base"
              data-testid="complete-onboarding-button"
            >
              Start Exploring Consumed!
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Dna className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Discover Your Entertainment DNA</h1>
          <p className="text-gray-600 text-sm">
            Let's understand how you consume entertainment
          </p>
          <button
            onClick={() => window.location.href = '/feed'}
            className="text-xs text-gray-400 hover:text-gray-500 mt-2 underline"
          >
            Skip for now
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Question {currentQuestion + 1} of {surveyQuestions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question */}
        <div className="mb-6">
          {surveyQuestions.length > 0 && currentQuestion < surveyQuestions.length && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-5 leading-relaxed">
                {surveyQuestions[currentQuestion].question_text}
              </h2>

              {/* Text Input */}
              {surveyQuestions[currentQuestion].question_type === 'text' && (
                <textarea
                  value={getCurrentAnswer() || ""}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Please share your thoughts..."
                  className="w-full p-3 border border-gray-200 rounded-xl focus:border-purple-300 focus:ring-purple-300 min-h-[100px] resize-vertical text-black bg-white placeholder:text-gray-500 text-sm"
                  data-testid="text-input"
                />
              )}

              {/* Single Select - Pill Buttons */}
              {surveyQuestions[currentQuestion].question_type === 'select' && (
                <div className="space-y-2">
                  {surveyQuestions[currentQuestion].options?.map((option, index) => {
                    const isSelected = getCurrentAnswer() === option;
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswer(option)}
                        className={`w-full p-3 rounded-full border-2 transition-all text-left text-sm ${
                          isSelected
                            ? 'border-purple-600 bg-gradient-to-r from-purple-50 to-pink-50 text-gray-900 font-medium'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                        }`}
                        data-testid={`option-${option}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multi-Select - Pill Checkboxes */}
              {surveyQuestions[currentQuestion].question_type === 'multi-select' && (
                <div className="space-y-2">
                  {surveyQuestions[currentQuestion].options?.map((option, index) => {
                    const currentAnswers = Array.isArray(getCurrentAnswer()) ? getCurrentAnswer() : [];
                    const isChecked = currentAnswers.includes(option);

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          const currentAnswers = Array.isArray(getCurrentAnswer()) ? [...getCurrentAnswer()] : [];
                          if (isChecked) {
                            const optionIndex = currentAnswers.indexOf(option);
                            if (optionIndex > -1) {
                              currentAnswers.splice(optionIndex, 1);
                            }
                          } else {
                            currentAnswers.push(option);
                          }
                          handleAnswer(currentAnswers);
                        }}
                        className={`w-full p-3 rounded-full border-2 transition-all text-left text-sm flex items-center ${
                          isChecked
                            ? 'border-purple-600 bg-gradient-to-r from-purple-50 to-pink-50 text-gray-900 font-medium'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                        }`}
                        data-testid={`multi-option-${option}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center flex-shrink-0 ${
                          isChecked ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                        }`}>
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          )}
                        </div>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            variant="outline"
            className="flex items-center space-x-2 disabled:opacity-50 rounded-full px-6 py-2"
            data-testid="previous-question-button"
          >
            <ChevronLeft size={18} />
            <span className="text-sm">Previous</span>
          </Button>

          <Button
            onClick={handleNext}
            disabled={
              surveyQuestions.length === 0 || 
              !getCurrentAnswer() || 
              (Array.isArray(getCurrentAnswer()) && (getCurrentAnswer() as string[]).length === 0)
            }
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center space-x-2 px-8 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
            data-testid="next-question-button"
          >
            <span className="text-sm">{surveyQuestions.length > 0 && currentQuestion === surveyQuestions.length - 1 ? "Discover My DNA" : "Next"}</span>
            {surveyQuestions.length > 0 && currentQuestion === surveyQuestions.length - 1 ? (
              <Sparkles size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
