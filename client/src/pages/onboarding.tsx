import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Dna, Loader2, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

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

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[];
  display_order: number;
  is_required: boolean;
  depends_on_option?: string | null;
}

export default function OnboardingPage() {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [dnaProfile, setDNAProfile] = useState<DNAProfile | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [showDeepDNA, setShowDeepDNA] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing your responses...");
  
  const deepDNARef = useRef<HTMLDivElement>(null);

  // Quick DNA: first 4 questions (gender, entertainment types, genres, drivers)
  // Deep DNA: rest of questions (favorites, comfort, discovery, social, sports-related)
  const quickQuestions = surveyQuestions
    .filter(q => [1, 2, 3, 6].includes(q.display_order))
    .filter(q => !q.depends_on_option); // Exclude conditional questions
  
  const deepQuestions = surveyQuestions
    .filter(q => ![1, 2, 3, 6].includes(q.display_order))
    .filter(q => {
      // Filter out sports-related questions if user didn't select Sports
      if (q.depends_on_option === 'Sports') {
        const entertainmentAnswer = getAnswer('aa672604-6bf2-482c-9e2d-8c35145dd254');
        const hasSelectedSports = Array.isArray(entertainmentAnswer) && entertainmentAnswer.includes('Sports');
        return hasSelectedSports;
      }
      return true;
    });

  useEffect(() => {
    if (!loading && !session) {
      setLocation('/login');
    }
  }, [loading, session, setLocation]);

  useEffect(() => {
    if (!session?.access_token) return;
    
    const fetchSurveyQuestions = async () => {
      try {
        const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/rest/v1/edna_questions?select=*&order=display_order.asc', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
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

  const handleAnswer = (questionId: string, value: string | string[]) => {
    const newAnswers = answers.filter(a => a.questionId !== questionId);
    newAnswers.push({ questionId, answer: value });
    setAnswers(newAnswers);
  };

  const getAnswer = (questionId: string) => {
    return answers.find(a => a.questionId === questionId)?.answer;
  };

  const handleExpandDeepDNA = () => {
    setShowDeepDNA(true);
    setTimeout(() => {
      deepDNARef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const generateDNA = async () => {
    setIsGenerating(true);
    
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
      
      setDNAProfile({
        title: aiProfile.label || 'Entertainment Enthusiast',
        description: aiProfile.tagline || '',
        superpowers: aiProfile.flavor_notes || [],
        meaning: aiProfile.profile_text || ''
      });
      
      fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-media-recommendations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      }).catch(() => {});
      
      clearInterval(messageInterval);
      setShowResults(true);
    } catch (error) {
      console.error('Error generating DNA profile:', error);
      clearInterval(messageInterval);
      setDNAProfile({
        title: 'Entertainment Enthusiast',
        description: 'Your unique entertainment personality',
        superpowers: ['Diverse taste', 'Open to discovery', 'Engaged viewer'],
        meaning: 'You have a wonderful appreciation for entertainment across different formats and genres.'
      });
      setShowResults(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const isQuickDNAComplete = () => {
    const requiredQuickQuestions = quickQuestions.filter(q => q.is_required);
    return requiredQuickQuestions.every(q => {
      const answer = getAnswer(q.id);
      if (!answer) return false;
      if (Array.isArray(answer)) return answer.length > 0;
      return answer.trim().length > 0;
    });
  };

  const isDeepDNAComplete = () => {
    return deepQuestions.every(q => {
      const answer = getAnswer(q.id);
      if (!answer) return false;
      if (Array.isArray(answer)) return answer.length > 0;
      return answer.trim().length > 0;
    });
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="text-white animate-spin" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading...</h1>
          <p className="text-gray-600">Checking your account...</p>
        </div>
      </div>
    );
  }

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="text-white animate-spin" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loading Your Entertainment DNA Survey</h1>
          <p className="text-gray-600">Preparing your personalized questions...</p>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Dna className="text-white animate-spin" size={40} style={{ animationDuration: '3s' }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Discovering Your Entertainment DNA</h1>
          <p className="text-gray-700 mb-6 text-lg font-medium animate-pulse">{loadingMessage}</p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5 mb-4">
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 h-2.5 rounded-full animate-pulse" style={{ width: '85%' }}></div>
          </div>
          <p className="text-sm text-gray-600">This usually takes 30-60 seconds</p>
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
              <p className="text-gray-700 leading-relaxed">{dnaProfile.description}</p>
            </div>

            {dnaProfile.superpowers && dnaProfile.superpowers.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <Sparkles className="mr-2 text-purple-600" size={20} />
                  Your Flavor Notes:
                </h3>
                <ul className="space-y-2">
                  {dnaProfile.superpowers.map((power, index) => (
                    <li key={index} className="text-gray-700 text-sm leading-relaxed">• {power}</li>
                  ))}
                </ul>
              </div>
            )}

            {dnaProfile.meaning && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-2">🔮 Your Entertainment DNA:</h3>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{dnaProfile.meaning}</p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <Button 
              onClick={() => window.location.href = '/activity'}
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

  const renderQuestion = (question: SurveyQuestion) => {
    const currentAnswer = getAnswer(question.id);
    
    return (
      <div key={question.id} className="mb-8" data-testid={`question-${question.id}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-relaxed">
          {question.question_text}
          {!question.is_required && <span className="text-gray-400 text-sm font-normal ml-2">(optional)</span>}
        </h3>

        {question.question_type === 'text' && (
          <textarea
            value={(currentAnswer as string) || ""}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full p-3 border border-gray-200 rounded-xl focus:border-purple-300 focus:ring-purple-300 min-h-[100px] resize-vertical text-black bg-white placeholder:text-gray-400 text-sm"
            data-testid={`text-input-${question.id}`}
          />
        )}

        {question.question_type === 'select' && (
          <div className="flex flex-wrap gap-2">
            {question.options?.map((option, index) => {
              const isSelected = currentAnswer === option;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(question.id, option)}
                  className={`px-4 py-2 rounded-full border-2 transition-all text-sm ${
                    isSelected
                      ? 'border-purple-600 bg-purple-600 text-white font-medium'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                  }`}
                  data-testid={`option-${question.id}-${option}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {question.question_type === 'multi-select' && (
          <div className="flex flex-wrap gap-2">
            {question.options?.map((option, index) => {
              const currentAnswers = Array.isArray(currentAnswer) ? currentAnswer : [];
              const isChecked = currentAnswers.includes(option);

              return (
                <button
                  key={index}
                  onClick={() => {
                    const updatedAnswers = isChecked
                      ? currentAnswers.filter(a => a !== option)
                      : [...currentAnswers, option];
                    handleAnswer(question.id, updatedAnswers);
                  }}
                  className={`px-4 py-2 rounded-full border-2 transition-all text-sm ${
                    isChecked
                      ? 'border-purple-600 bg-purple-600 text-white font-medium'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700'
                  }`}
                  data-testid={`multi-option-${question.id}-${option}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Dna className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Discover Your Entertainment DNA</h1>
            <p className="text-gray-600 text-sm">Answer a few questions to unlock your personalized entertainment profile</p>
            <button
              onClick={() => window.location.href = '/activity'}
              className="text-xs text-gray-400 hover:text-gray-500 mt-3 underline"
            >
              Skip for now
            </button>
          </div>

          {/* Quick DNA Questions */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Sparkles className="text-purple-600" size={16} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Quick DNA</h2>
              <span className="text-sm text-gray-500">({quickQuestions.length} questions)</span>
            </div>
            
            {quickQuestions.map(renderQuestion)}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-100 pt-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={generateDNA}
                disabled={!isQuickDNAComplete()}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="get-quick-dna-button"
              >
                <Sparkles size={18} className="mr-2" />
                Get Your Quick DNA
              </Button>
              
              {!showDeepDNA && (
                <Button
                  onClick={handleExpandDeepDNA}
                  disabled={!isQuickDNAComplete()}
                  variant="outline"
                  className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="expand-deep-dna-button"
                >
                  <ChevronDown size={18} className="mr-2" />
                  Answer {deepQuestions.length} more for deeper analysis
                </Button>
              )}
            </div>
          </div>

          {/* Deep DNA Questions (Expandable) */}
          {showDeepDNA && (
            <div ref={deepDNARef} className="border-t border-gray-100 pt-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <Dna className="text-white" size={16} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Deep DNA</h2>
                <span className="text-sm text-gray-500">(+{deepQuestions.length} questions)</span>
              </div>
              
              {deepQuestions.map(renderQuestion)}

              <div className="mt-6">
                <Button
                  onClick={generateDNA}
                  disabled={!isQuickDNAComplete() || !isDeepDNAComplete()}
                  className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-700 hover:via-pink-700 hover:to-indigo-700 text-white rounded-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="get-deep-dna-button"
                >
                  <Dna size={18} className="mr-2" />
                  Unlock Your Deep DNA
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
