import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, Flame, Star, Users, Sparkles, ChevronRight, Dna, HelpCircle, Gamepad2, Film, Tv, BookOpen, Music, Headphones, Gamepad } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

interface JustTrackedMedia {
  title: string;
  mediaType: string;
  imageUrl?: string;
  externalId?: string;
  externalSource?: string;
  creator?: string;
}

interface JustTrackedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  media: JustTrackedMedia | null;
  listName?: string;
  onDropHotTake?: () => void;
  onRateIt?: () => void;
  onChallengeFriend?: () => void;
  showRateOption?: boolean;
}

interface DnaMoment {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c?: string | null;
  option_d?: string | null;
  option_e?: string | null;
  category: string;
  is_multi_select?: boolean;
}

const triviaCategories = [
  { label: 'Movies', icon: Film, type: 'movie', color: 'from-red-400 to-pink-500' },
  { label: 'TV', icon: Tv, type: 'tv', color: 'from-blue-400 to-indigo-500' },
  { label: 'Books', icon: BookOpen, type: 'book', color: 'from-amber-400 to-orange-500' },
  { label: 'Music', icon: Music, type: 'music', color: 'from-green-400 to-emerald-500' },
  { label: 'Podcasts', icon: Headphones, type: 'podcast', color: 'from-purple-400 to-violet-500' },
];

function TriviaMorePrompt({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();

  const handleCategoryPick = (type: string) => {
    onClose();
    navigate(`/play/trivia?category=${type}`);
  };

  return (
    <div className="mt-3 pt-3 border-t border-purple-100">
      <p className="text-sm font-semibold text-gray-900 text-center mb-3">Want more trivia?</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {triviaCategories.map((cat) => (
          <button
            key={cat.type}
            onClick={() => handleCategoryPick(cat.type)}
            className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
              <cat.icon size={16} className="text-white" />
            </div>
            <span className="text-xs text-gray-600 font-medium">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function JustTrackedSheet({ 
  isOpen, 
  onClose, 
  media, 
  listName,
  onDropHotTake,
  onRateIt,
  onChallengeFriend,
  showRateOption = true,
}: JustTrackedSheetProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'identity' | 'actions'>('identity');
  const [identityAnswer, setIdentityAnswer] = useState<string | null>(null);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [triviaAnswer, setTriviaAnswer] = useState<string | null>(null);
  const [triviaRevealed, setTriviaRevealed] = useState(false);

  const isWantToList = listName?.toLowerCase().includes('want') || listName?.toLowerCase().includes('queue');

  const { data: triviaQuestion } = useQuery({
    queryKey: ['want-to-trivia', media?.mediaType],
    queryFn: async () => {
      const categoryMap: Record<string, string[]> = {
        'movie': ['Movies', 'movies', 'Movie', 'movie'],
        'tv': ['TV', 'tv', 'Television', 'television'],
        'music': ['Music', 'music'],
        'book': ['Books', 'books', 'Book', 'book'],
        'podcast': ['Podcasts', 'podcasts', 'Podcast', 'podcast'],
      };
      const categories = categoryMap[media?.mediaType?.toLowerCase() || ''] || [media?.mediaType || ''];
      
      const { data: triviaItems } = await supabase
        .from('prediction_pools')
        .select('id, title, options, correct_answer, category, points_reward, media_title')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .in('category', categories)
        .limit(10);
      
      if (triviaItems && triviaItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * triviaItems.length);
        const item = triviaItems[randomIndex];
        return {
          id: item.id,
          title: item.title,
          options: Array.isArray(item.options) ? item.options : JSON.parse(item.options || '[]'),
          correct_answer: item.correct_answer || '',
          category: item.category || '',
          points_reward: item.points_reward || 10,
          media_title: item.media_title,
        };
      }
      return null;
    },
    enabled: isOpen && !!isWantToList && !!media?.mediaType,
    staleTime: 0,
  });

  const { data: dnaMoment, isLoading: isLoadingMoment } = useQuery<DnaMoment | null>({
    queryKey: ['unanswered-dna-moment', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: answered } = await supabase
        .from('dna_moment_responses')
        .select('moment_id')
        .eq('user_id', user.id);
      const answeredIds = new Set((answered || []).map((r: any) => r.moment_id));

      const { data: allMoments } = await supabase
        .from('dna_moments')
        .select('id, question_text, option_a, option_b, option_c, option_d, option_e, category, is_multi_select')
        .eq('is_active', true);

      const unanswered = (allMoments || []).filter((m: any) => !answeredIds.has(m.id));
      if (unanswered.length === 0) return null;
      return unanswered[Math.floor(Math.random() * unanswered.length)] as DnaMoment;
    },
    enabled: isOpen && !!user?.id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (isOpen) {
      setPhase('identity');
      setIdentityAnswer(null);
      setTriviaAnswer(null);
      setTriviaRevealed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (phase === 'identity' && !isLoadingMoment && dnaMoment === null) {
      setPhase('actions');
    }
  }, [phase, isLoadingMoment, dnaMoment]);

  if (!media) return null;

  const getMediaVerb = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'book': return 'read';
      case 'music':
      case 'podcast': return 'listened to';
      case 'game': return 'played';
      default: return 'watched';
    }
  };

  const getConfirmationTitle = (list?: string, mediaVerb?: string) => {
    switch (list?.toLowerCase()) {
      case 'finished': return `Nice! You ${mediaVerb} it.`;
      case 'currently': return `Enjoy!`;
      case 'want to': return `On your radar!`;
      case 'favorites': return `Added to Favorites!`;
      case 'did not finish':
      case 'dnf': return `No worries, moving on.`;
      default: return `Added!`;
    }
  };

  const handleIdentityAnswer = async (answer: string) => {
    setIdentityAnswer(answer);
    setIsSavingAnswer(true);

    try {
      if (user?.id && dnaMoment) {
        const { data: existing } = await supabase
          .from('dna_moment_responses')
          .select('id')
          .eq('user_id', user.id)
          .eq('moment_id', dnaMoment.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('dna_moment_responses')
            .update({ answer })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('dna_moment_responses')
            .insert({
              id: `dna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              user_id: user.id,
              moment_id: dnaMoment.id,
              answer,
              points_earned: 5,
            });
        }

        queryClient.invalidateQueries({ queryKey: ['unanswered-dna-moment'] });
      }
    } catch (err) {
      console.log('DNA moment answer save failed (non-blocking):', err);
    }

    setIsSavingAnswer(false);

    setTimeout(() => {
      setPhase('actions');
    }, 800);
  };

  const handleChallenge = async () => {
    if (onChallengeFriend) {
      onChallengeFriend();
      return;
    }
    const verb = getMediaVerb(media.mediaType);
    const shareText = `Have you ${verb} "${media.title}"? Let me know on Consumed!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${media.title} on Consumed`,
          text: shareText,
          url: window.location.origin,
        });
      } catch (err) {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText);
    }
    onClose();
  };

  const verb = getMediaVerb(media.mediaType);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="text-green-600" size={22} />
            </div>
          </div>
          <DrawerTitle className="text-lg font-semibold text-gray-900">
            {getConfirmationTitle(listName, verb)}
          </DrawerTitle>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{media.title}</span>
            {listName && <> added to {listName}</>}
          </p>
        </DrawerHeader>
        
        {phase === 'identity' && (isLoadingMoment || dnaMoment === undefined) ? (
          <div className="px-4 py-8 flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-400">Loading DNA check...</p>
          </div>
        ) : phase === 'identity' && dnaMoment ? (
          <div className="px-4 py-5">
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Dna className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">DNA Check</span>
              </div>

              <h3 className="text-lg font-bold text-gray-900">{dnaMoment.question_text}</h3>
              {dnaMoment.category && (
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-600 bg-teal-50 rounded-full">
                  {dnaMoment.category}
                </span>
              )}
            </div>

            {!identityAnswer ? (
              <div className="flex flex-wrap gap-2">
                {[dnaMoment.option_a, dnaMoment.option_b, dnaMoment.option_c, dnaMoment.option_d, dnaMoment.option_e]
                  .filter((opt): opt is string => !!opt)
                  .map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleIdentityAnswer(option)}
                      disabled={isSavingAnswer}
                      className={`flex-1 min-w-[calc(50%-4px)] py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                        i === 0
                          ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))
                }
              </div>
            ) : (
              <div className="text-center py-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <p className="text-sm text-purple-600 font-medium">
                    Noted! That's part of your DNA now.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 mt-3 border-t border-gray-100">
              <button
                onClick={() => setPhase('actions')}
                className="w-full py-2.5 text-purple-600 text-sm font-medium hover:text-purple-700 transition-colors"
              >
                {identityAnswer ? 'Continue' : 'Skip'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-3 text-center">
              What's next?
            </p>

            {onDropHotTake && (
              <button
                onClick={onDropHotTake}
                className="w-full p-4 text-left rounded-xl bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 flex items-center gap-3 transition-colors border border-orange-100"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Flame className="text-white" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Drop a Hot Take</p>
                  <p className="text-sm text-gray-500">Share your bold opinion</p>
                </div>
                <ChevronRight className="text-gray-400" size={18} />
              </button>
            )}

            {isWantToList && triviaQuestion ? (
              <>
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                <p className="text-gray-900 font-bold text-base mb-3">
                Know your {media.mediaType?.toLowerCase() === 'tv' ? 'TV' : media.mediaType?.toLowerCase() || 'entertainment'} trivia?
              </p>
                
              <p className="text-gray-700 text-sm mb-3">{triviaQuestion.title}</p>
                
                <div className="space-y-2">
                  {triviaQuestion.options.map((option: string, idx: number) => {
                    const isSelected = triviaAnswer === option;
                    const isCorrectOption = option === triviaQuestion.correct_answer;
                    
                    let btnClass = 'w-full py-2.5 px-4 rounded-xl border text-sm font-medium text-left transition-all duration-200 ';
                    
                    if (triviaRevealed) {
                      if (isCorrectOption) {
                        btnClass += 'bg-green-100 border-green-400 text-green-900';
                      } else if (isSelected && !isCorrectOption) {
                        btnClass += 'bg-red-100 border-red-400 text-red-900';
                      } else {
                        btnClass += 'bg-gray-50 border-gray-200 text-gray-400';
                      }
                    } else {
                      btnClass += 'bg-white border-gray-200 text-gray-900 hover:bg-purple-50 hover:border-purple-300';
                    }
                    
                    return (
                      <button
                        key={idx}
                        className={btnClass}
                        onClick={() => {
                          if (!triviaRevealed) {
                            setTriviaAnswer(option);
                            setTriviaRevealed(true);
                          }
                        }}
                        disabled={triviaRevealed}
                      >
                        {option}
                        {triviaRevealed && isCorrectOption && <span className="ml-2">✓</span>}
                      </button>
                    );
                  })}
                </div>
                
                {triviaRevealed && (
                  <div className={`mt-3 p-2 rounded-lg text-center text-sm font-medium ${
                    triviaAnswer === triviaQuestion.correct_answer
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {triviaAnswer === triviaQuestion.correct_answer
                      ? `Nice! +${triviaQuestion.points_reward} points` 
                      : `The answer was: ${triviaQuestion.correct_answer}`
                    }
                  </div>
                )}
              </div>
              {triviaRevealed && (
                <TriviaMorePrompt onClose={onClose} />
              )}
              </>
            ) : showRateOption && onRateIt ? (
              <button
                onClick={onRateIt}
                className="w-full p-4 text-left rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 flex items-center gap-3 transition-colors border border-yellow-100"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="text-white fill-white" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Rate It</p>
                  <p className="text-sm text-gray-500">How many stars does it deserve?</p>
                </div>
                <ChevronRight className="text-gray-400" size={18} />
              </button>
            ) : null}

            <button
              onClick={handleChallenge}
              className="w-full p-4 text-left rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 flex items-center gap-3 transition-colors border border-purple-100"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="text-white" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Challenge a Friend</p>
                <p className="text-sm text-gray-500">Have they {verb} it too?</p>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                {isWantToList && triviaRevealed ? 'Done' : 'Maybe later'}
              </button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
