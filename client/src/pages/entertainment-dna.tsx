import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dna, Loader2, Download, Tv, Film, BookOpen, Music, Mic, Gamepad2, Trophy, Sparkles, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import html2canvas from "html2canvas";
import { useFirstSessionHooks } from "@/components/first-session-hooks";

// Icon mapping for entertainment types
const ENTERTAINMENT_ICONS: Record<string, typeof Tv> = {
  'TV': Tv,
  'Movies': Film,
  'Books': BookOpen,
  'Music': Music,
  'Podcasts': Mic,
  'Gaming': Gamepad2,
  'Sports': Trophy,
};

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

export default function EntertainmentDNAPage() {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { markDNA } = useFirstSessionHooks();
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [dnaProfile, setDNAProfile] = useState<DNAProfile | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing your responses...");
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getAnswer = (questionId: string) => {
    return answers.find(a => a.questionId === questionId)?.answer;
  };

  // 5 essential questions: gender, entertainment types, genres, favorites, drivers
  const questions = useMemo(() => {
    return surveyQuestions
      .filter(q => [1, 2, 3, 4, 5].includes(q.display_order))
      .filter(q => !q.depends_on_option);
  }, [surveyQuestions]);

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
      markDNA();
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

  const isComplete = () => {
    const requiredQuestions = questions.filter(q => q.is_required);
    return requiredQuestions.every(q => {
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
    const handleDownload = async () => {
      if (!cardRef.current) return;
      setIsDownloading(true);
      
      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3,
          useCORS: true,
          backgroundColor: null,
        });
        
        const link = document.createElement('a');
        link.download = 'my-entertainment-dna.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (error) {
        console.error('Error downloading image:', error);
      } finally {
        setIsDownloading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col items-center justify-center p-4">
        {/* Shareable Card - Instagram Story optimized (9:16 aspect ratio) */}
        <div 
          ref={cardRef}
          className="w-[320px] bg-white rounded-3xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: '9/16' }}
        >
          {/* Gradient top border */}
          <div className="h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
          
          <div className="p-5 flex flex-col h-full">
            {/* Header */}
            <div className="text-center mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Dna className="text-white" size={24} />
              </div>
              <h1 className="text-base font-bold text-gray-900">Your Entertainment DNA</h1>
              <div className="w-10 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full mt-1"></div>
            </div>

            {/* DNA Label & Tagline */}
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {dnaProfile.title}
              </h2>
              <p className="text-gray-600 text-sm">{dnaProfile.description}</p>
            </div>

            {/* Flavor Notes */}
            {dnaProfile.superpowers && dnaProfile.superpowers.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                  <Sparkles className="mr-1.5 text-purple-600" size={14} />
                  Your Flavor Notes:
                </h3>
                <ul>
                  {dnaProfile.superpowers.slice(0, 3).map((power, index) => (
                    <li key={index} className="text-gray-700 text-xs leading-tight">• {power}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* DNA Bio */}
            {dnaProfile.meaning && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-3 flex-1 overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">🔮 Your Entertainment DNA Profile:</h3>
                <p className="text-gray-700 text-xs leading-relaxed">{dnaProfile.meaning}</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-3 pt-2 border-t border-gray-100">
              <p className="text-purple-600 text-xs font-medium">@consumedapp</p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Outside the shareable card */}
        <div className="mt-6 flex flex-col gap-3 w-[320px]">
          <Button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-6 py-2.5 rounded-full shadow-lg text-sm flex items-center justify-center gap-2"
            data-testid="download-dna-button"
          >
            <Download size={18} />
            {isDownloading ? 'Saving...' : 'Save to Share'}
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/activity'}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-2.5 rounded-full shadow-lg text-sm"
            data-testid="complete-onboarding-button"
          >
            Back to My DNA
          </Button>
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
            placeholder="Just jot down a bunch of things you love..."
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
                  data-testid={`option-${question.id}-${option.replace(' (please specify)', '')}`}
                >
                  {option.replace(' (please specify)', '')}
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
                  data-testid={`multi-option-${question.id}-${option.replace(' (please specify)', '')}`}
                >
                  {option.replace(' (please specify)', '')}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white px-6 pt-6 pb-8">
      <div className="max-w-lg mx-auto">
        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">Back</span>
        </button>
        
        {/* Header */}
        <div className="mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 via-purple-500 to-purple-700 rounded-full flex items-center justify-center mb-4">
            <Dna className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your entertainment DNA starts here</h1>
          <p className="text-gray-600 text-sm">Answer a few quick questions to shape your taste profile.</p>
          <button
            onClick={() => window.location.href = '/activity'}
            className="text-xs text-purple-500 hover:text-purple-700 mt-3 underline"
          >
            Skip for now
          </button>
        </div>

        {/* DNA Questions */}
        <div className="space-y-6 mb-8">
          {questions.map((question) => {
            const currentAnswer = getAnswer(question.id);
            
            return (
              <div key={question.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200" data-testid={`question-${question.id}`}>
                {question.question_type === 'text' ? (
                  <>
                    <h3 className="text-base font-semibold text-gray-900 mb-1 leading-tight">
                      What do you love?
                    </h3>
                    <p className="text-gray-600 text-sm leading-snug mb-2">
                      Drop anything you're into lately or always come back to — books, shows, teams, creators, comfort rewatches, guilty pleasures. Whatever feels you.
                      <span className="text-gray-400 ml-1">(optional)</span>
                    </p>
                    <textarea
                      value={(currentAnswer as string) || ""}
                      onChange={(e) => handleAnswer(question.id, e.target.value)}
                      placeholder="Type freely — one thing per line or however it comes out."
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-purple-400 focus:ring-purple-400 min-h-[100px] resize-vertical text-black placeholder:text-gray-400 text-sm"
                      data-testid={`text-input-${question.id}`}
                    />
                    <p className="text-gray-400 text-xs mt-2 text-center">Scroll down to continue</p>
                  </>
                ) : (
                  <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug">
                    {question.question_text}
                    {!question.is_required && <span className="text-gray-400 text-sm font-normal ml-2">(optional)</span>}
                  </h3>
                )}

                {question.question_type === 'select' && (
                  <div className="flex flex-wrap gap-2">
                    {question.options?.map((option, index) => {
                      const isSelected = currentAnswer === option;
                      return (
                        <button
                          key={index}
                          onClick={() => handleAnswer(question.id, option)}
                          className={`px-5 py-2.5 rounded-full transition-all text-sm flex items-center gap-2 text-left ${
                            isSelected
                              ? 'bg-purple-500/20 border-2 border-cyan-400 text-white font-medium'
                              : 'bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/30'
                          }`}
                          data-testid={`option-${question.id}-${option.replace(' (please specify)', '')}`}
                        >
                          {option.replace(' (please specify)', '')}
                          {isSelected && <Check size={16} />}
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
                      const cleanOption = option.replace(' (please specify)', '');
                      const IconComponent = ENTERTAINMENT_ICONS[cleanOption];

                      return (
                        <button
                          key={index}
                          onClick={() => {
                            const updatedAnswers = isChecked
                              ? currentAnswers.filter(a => a !== option)
                              : [...currentAnswers, option];
                            handleAnswer(question.id, updatedAnswers);
                          }}
                          className={`px-5 py-2.5 rounded-full transition-all text-sm flex items-center gap-2 text-left ${
                            isChecked
                              ? 'bg-purple-500/20 border-2 border-cyan-400 text-white font-medium'
                              : 'bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/30'
                          }`}
                          data-testid={`multi-option-${question.id}-${cleanOption}`}
                        >
                          {IconComponent && <IconComponent size={16} />}
                          {cleanOption}
                          {isChecked && <Check size={16} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <Button
          onClick={generateDNA}
          disabled={!isComplete()}
          className="w-full bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 hover:from-cyan-300 hover:via-purple-400 hover:to-purple-600 text-white font-semibold rounded-full py-4 text-base shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="get-dna-button"
        >
          Discover Your DNA
        </Button>
      </div>
    </div>
  );
}
