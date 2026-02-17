import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Check, Flame, Star, Users, Sparkles, ChevronRight, Dna, HelpCircle, Gamepad2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

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

interface TasteInsight {
  observation: string;
  percentage: number;
  question: string;
  momentId: string;
}

function getMediaLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'movie': return 'movies';
    case 'tv': return 'TV shows';
    case 'book': return 'books';
    case 'podcast': return 'podcasts';
    case 'music': return 'music';
    case 'game': return 'games';
    default: return 'titles';
  }
}

function getIdentityLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'movie': return 'a movie person';
    case 'tv': return 'a TV binger';
    case 'book': return 'a bookworm';
    case 'podcast': return 'a podcast junkie';
    case 'music': return 'a music head';
    case 'game': return 'a gamer';
    default: return 'into this';
  }
}

function generateInsight(
  media: JustTrackedMedia,
  stats: { mediaType: string; count: number }[],
  creatorCount: number
): TasteInsight | null {
  const totalItems = stats.reduce((sum, s) => sum + s.count, 0);
  if (totalItems < 1) return null;

  const currentTypeStat = stats.find(s => s.mediaType?.toLowerCase() === media.mediaType?.toLowerCase());
  const currentTypeCount = (currentTypeStat?.count || 0) + 1;
  const totalWithNew = totalItems + 1;
  const percentage = Math.round((currentTypeCount / totalWithNew) * 100);

  const mediaLabel = getMediaLabel(media.mediaType);
  const identityLabel = getIdentityLabel(media.mediaType);

  if (media.creator && creatorCount >= 2) {
    return {
      observation: `You've tracked ${creatorCount + 1} ${media.creator} titles.`,
      percentage,
      question: `Are you a ${media.creator} fan?`,
      momentId: `identity-creator-${(media.creator || '').toLowerCase().replace(/\s+/g, '-')}`,
    };
  }

  if (percentage >= 40 && currentTypeCount >= 3) {
    return {
      observation: `${percentage}% of your library is ${mediaLabel}.`,
      percentage,
      question: `Are you ${identityLabel}?`,
      momentId: `identity-type-${media.mediaType?.toLowerCase() || 'other'}`,
    };
  }

  if (currentTypeCount >= 2) {
    return {
      observation: `That's ${currentTypeCount} ${mediaLabel} you've tracked.`,
      percentage,
      question: `Are you ${identityLabel}?`,
      momentId: `identity-type-${media.mediaType?.toLowerCase() || 'other'}`,
    };
  }

  return {
    observation: `Your first ${media.mediaType?.toLowerCase() || 'title'} on Consumed!`,
    percentage: 100,
    question: `Are you ${identityLabel}?`,
    momentId: `identity-type-${media.mediaType?.toLowerCase() || 'other'}`,
  };
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

  const { data: tasteStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['taste-stats', user?.id, media?.mediaType],
    queryFn: async () => {
      if (!user?.id) return { typeStats: [], creatorCount: 0 };

      const { data: items } = await supabase
        .from('list_items')
        .select('media_type, creator, lists!inner(user_id)')
        .eq('lists.user_id', user.id);

      if (!items || items.length === 0) return { typeStats: [], creatorCount: 0 };

      const typeCounts: Record<string, number> = {};
      let creatorCount = 0;

      items.forEach((item: any) => {
        const mt = item.media_type?.toLowerCase() || 'other';
        typeCounts[mt] = (typeCounts[mt] || 0) + 1;
        if (media?.creator && item.creator?.toLowerCase() === media.creator.toLowerCase()) {
          creatorCount++;
        }
      });

      const typeStats = Object.entries(typeCounts).map(([mediaType, count]) => ({ mediaType, count }));
      return { typeStats, creatorCount };
    },
    enabled: isOpen && !!user?.id && !!media,
    staleTime: 30000,
  });

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

  const insight = tasteStats && media ? generateInsight(media, tasteStats.typeStats, tasteStats.creatorCount) : null;

  useEffect(() => {
    if (isOpen) {
      setPhase('identity');
      setIdentityAnswer(null);
      setTriviaAnswer(null);
      setTriviaRevealed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (phase === 'identity' && tasteStats && !isLoadingStats && !insight) {
      setPhase('actions');
    }
  }, [phase, tasteStats, isLoadingStats, insight]);

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
      if (user?.id && insight) {
        const answerCode = answer === 'definitely' ? 'a' : answer === 'sometimes' ? 'b' : 'c';

        const { data: existing } = await supabase
          .from('dna_moment_responses')
          .select('id')
          .eq('user_id', user.id)
          .eq('moment_id', insight.momentId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('dna_moment_responses')
            .update({ answer: answerCode })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('dna_moment_responses')
            .insert({
              id: `identity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              user_id: user.id,
              moment_id: insight.momentId,
              answer: answerCode,
              points_earned: 5,
            });
        }
      }
    } catch (err) {
      console.log('Identity answer save failed (non-blocking):', err);
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
        
        {phase === 'identity' && (isLoadingStats || !tasteStats) ? (
          <div className="px-4 py-8 flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-400">Analyzing your taste...</p>
          </div>
        ) : phase === 'identity' && insight ? (
          <div className="px-4 py-5">
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Dna className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Your Taste</span>
              </div>

              <p className="text-sm text-gray-600 mb-1">{insight.observation}</p>

              <div className="flex items-center justify-center gap-2 my-3">
                <div className="h-2 flex-1 max-w-[180px] bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-400 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${insight.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-teal-600">{insight.percentage}%</span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mt-3">{insight.question}</h3>
            </div>

            {!identityAnswer ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleIdentityAnswer('definitely')}
                  disabled={isSavingAnswer}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 text-white font-semibold text-sm hover:from-teal-600 hover:to-blue-600 transition-all"
                >
                  Definitely
                </button>
                <button
                  onClick={() => handleIdentityAnswer('sometimes')}
                  disabled={isSavingAnswer}
                  className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all border border-gray-200"
                >
                  Sometimes
                </button>
                <button
                  onClick={() => handleIdentityAnswer('not_really')}
                  disabled={isSavingAnswer}
                  className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all border border-gray-200"
                >
                  Not really
                </button>
              </div>
            ) : (
              <div className="text-center py-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <p className="text-sm text-purple-600 font-medium">
                    {identityAnswer === 'definitely' ? 'Noted! That\'s part of your DNA now.' :
                     identityAnswer === 'sometimes' ? 'Got it! We\'ll keep exploring.' :
                     'Fair enough! Your taste is unique.'}
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
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle size={16} className="text-purple-500" />
                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Quick Trivia</span>
                </div>
                
                <p className="text-gray-900 font-semibold text-sm mb-3">{triviaQuestion.title}</p>
                
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
