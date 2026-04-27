import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { Brain, Loader2, ChevronLeft, ChevronRight, Trophy, Users, CheckCircle, XCircle, Star, Send } from 'lucide-react';
import { incrementActivityCount } from '@/components/dna-survey-nudge';

function normalizeCategory(cat: string | null | undefined): string {
  if (!cat) return 'Other';
  const lower = cat.toLowerCase().trim();
  if (lower === 'movies' || lower === 'movie') return 'Movies';
  if (lower === 'tv' || lower === 'tv shows' || lower === 'tv-show' || lower === 'tv show' ||
      lower === 'reality' || lower === 'reality tv' || lower === 'reality-tv') return 'TV';
  if (lower === 'music') return 'Music';
  if (lower === 'podcasts' || lower === 'podcast') return 'Podcasts';
  if (lower === 'gaming' || lower === 'games' || lower === 'game' || lower === 'video games') return 'Gaming';
  if (lower === 'sports' || lower === 'sport') return 'Sports';
  if (lower === 'books' || lower === 'book') return 'Books';
  if (lower === 'pop culture') return 'Pop Culture';
  return cat;
}

function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface TriviaItem {
  id: string;
  title: string;
  question: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
  showTag?: string;      // explicit show/media name from DB — used for the category pill
  mediaTitle?: string;   // for rating strip search — may include heuristic extraction
  pointsReward: number;
  isChallenge: boolean;
  questionCount: number;
  rawOptions: any;
  poolId?: string;
  questionIndex?: number;
}

interface FriendAnswer {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  answer: string;
  isCorrect: boolean;
}

interface TriviaCarouselProps {
  expanded?: boolean;
  category?: string;
  challengesOnly?: boolean;
}

const STREAK_MILESTONES = [
  { at: 3,  message: "Hat trick.",                                    sub: "Three in a row. You're on one." },
  { at: 5,  message: "Your entertainment instincts are no joke.",     sub: "Five correct. Keep that energy." },
  { at: 7,  message: "You are giving main character energy.",         sub: "All these right answers. We see you." },
  { at: 10, message: "At this point you need your own trivia show.",  sub: "Ten in a row is not normal behavior." },
  { at: 15, message: "Okay, actually iconic.",                        sub: "15 straight? That's a personality trait." },
  { at: 20, message: "Are you even human?",                           sub: "Twenty correct. Truly unhinged (in the best way)." },
];

export function TriviaCarousel({ expanded = false, category, challengesOnly = false }: TriviaCarouselProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<string, string>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answer: string; isCorrect: boolean; points?: number; stats: any; friendAnswers?: FriendAnswer[] }>>({});
  const [answeredLoaded, setAnsweredLoaded] = useState(false);
  const [lockedOrder, setLockedOrder] = useState<TriviaItem[] | null>(null);
  const [celebratingItems, setCelebratingItems] = useState<Record<string, number>>({});
  const [socialProofMap, setSocialProofMap] = useState<Record<string, { userName: string; option: string; pct: number; total: number }>>({});
  const [correctStreak, setCorrectStreak] = useState(0);
  const [streakBanner, setStreakBanner] = useState<{ message: string; sub: string; streak: number } | null>(null);
  const [triviaRatings, setTriviaRatings] = useState<Record<string, {
    ratingState: 'idle' | 'rated' | 'reviewed';
    rating: number;
    reviewText: string;
    skipped: boolean;
    hoverRating: number;
    reviewFocused: boolean;
  }>>({});

  const { data: leaderboardData } = useQuery({
    queryKey: ['trivia-leaderboard-position', user?.id, session?.access_token],
    queryFn: async () => {
      if (!user?.id || !session?.access_token) return { position: null, nextPerson: null };
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=trivia&scope=global&period=weekly`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) return { position: null, nextPerson: null };
        
        const data = await response.json();
        const triviaLeaderboard = data?.categories?.trivia || [];
        
        const userIndex = triviaLeaderboard.findIndex((p: any) => p.user_id === user.id);
        
        if (userIndex === 0) return { position: 1, nextPerson: null, isFirst: true };
        
        if (userIndex > 0) {
          const nextPerson = triviaLeaderboard[userIndex - 1];
          const userScore = triviaLeaderboard[userIndex]?.score || 0;
          const nextScore = nextPerson?.score || 0;
          const pointsNeeded = Math.max(1, Math.ceil((nextScore - userScore) / 10));
          
          return { 
            position: userIndex + 1, 
            nextPerson: nextPerson?.display_name || 'someone',
            pointsNeeded
          };
        }
        
        // User not in leaderboard, show generic message with position estimate
        return { 
          position: triviaLeaderboard.length + 1, 
          nextPerson: triviaLeaderboard[triviaLeaderboard.length - 1]?.display_name || 'someone',
          pointsNeeded: 3
        };
      } catch (error) {
        console.error('Leaderboard fetch error:', error);
        return { position: null, nextPerson: null };
      }
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: 30000
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trivia-carousel', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .or(`publish_at.is.null,publish_at.lte.${now}`)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      
      let answeredPoolIds: string[] = [];
      if (user?.id) {
        const { data: userPredictions } = await supabase
          .from('user_predictions')
          .select('pool_id')
          .eq('user_id', user.id);
        answeredPoolIds = (userPredictions || []).map(p => p.pool_id);
      }
      
      // Flatten pools into individual trivia questions, skipping already-answered ones
      const items: TriviaItem[] = [];
      
      for (const pool of (pools || [])) {
        if (answeredPoolIds.includes(pool.id)) continue;
        if (pool.options && Array.isArray(pool.options)) {
          const firstOpt = pool.options[0];
          const isObject = typeof firstOpt === 'object' && firstOpt !== null;
          const hasQuestion = isObject && 'question' in firstOpt;
          
          if (isObject && hasQuestion) {
            // Pool contains question objects - flatten each into individual trivia items
            for (let i = 0; i < pool.options.length; i++) {
              const q = pool.options[i];
              if (q.question && q.options && Array.isArray(q.options)) {
                // Extract media title from question if not provided in pool
                let mediaTitle = pool.media_title;
                if (!mediaTitle && q.question) {
                  // Try to extract movie/show name from question patterns:
                  // "Movie Name - question?" or "Was Movie Name released before..."
                  const dashMatch = q.question.match(/^(.+?)\s*[-–—]\s*.+\?$/);
                  const wasReleasedMatch = q.question.match(/^Was\s+(.+?)\s+released\s+/i);
                  
                  if (dashMatch) {
                    mediaTitle = dashMatch[1].trim();
                  } else if (wasReleasedMatch) {
                    mediaTitle = wasReleasedMatch[1].trim();
                  }
                }
                
                items.push({
                  id: `${pool.id}_q${i}`,
                  title: pool.title,
                  question: q.question,
                  options: q.options,
                  correctAnswer: q.answer || pool.correct_answer,
                  category: normalizeCategory(pool.category),
                  showTag: (pool.show_tag as string | undefined) || undefined,
                  mediaTitle: mediaTitle,
                  pointsReward: 10,
                  isChallenge: false,
                  questionCount: 1,
                  rawOptions: pool.options,
                  poolId: pool.id,
                  questionIndex: i
                });
              }
            }
          } else {
            // Simple string options format - single question
            const optionsList = pool.options.filter((o: any) => typeof o === 'string');
            if (optionsList.length > 0) {
              // Try to extract a media title from the question text when pool.media_title is absent
              let singleMediaTitle = pool.media_title as string | undefined;
              if (!singleMediaTitle && pool.title) {
                const q = pool.title as string;
                // Pattern: single-quoted title e.g. 'The Matrix'
                const singleQuote = q.match(/['']([^'']+)['']/);
                // Pattern: double-quoted title e.g. "The Matrix"
                const doubleQuote = q.match(/"([^"]+)"/);
                // Pattern: dash separator e.g. "The Matrix - question?"
                const dashMatch = q.match(/^(.+?)\s*[-–—]\s*.+\??$/);
                // Pattern: was/is/did ... released/from etc. e.g. "Was Interstellar released in..."
                const wasMatch = q.match(/^(?:Was|Is|Does|Did|Which)\s+([A-Z][^?]+?)\s+(?:released|from|win|star|feature|made|based)/i);
                // Pattern: "In [Title]," opener e.g. "In Inception, who..."
                const inMatch = q.match(/^In\s+(?:the movie\s+|the show\s+|the film\s+)?['"]?([A-Z][A-Za-z0-9 :!?'-]+?)['"]?,/);
                // Pattern: parenthetical movie name e.g. "...in The Matrix (1999)?"
                const parenMatch = q.match(/\b([A-Z][A-Za-z0-9 :!'-]+?)\s+\(\d{4}\)/);

                singleMediaTitle =
                  singleQuote?.[1] ||
                  doubleQuote?.[1] ||
                  inMatch?.[1] ||
                  parenMatch?.[1] ||
                  dashMatch?.[1]?.trim() ||
                  wasMatch?.[1]?.trim() ||
                  undefined;
              }

              items.push({
                id: pool.id,
                title: pool.title,
                question: pool.title,
                options: optionsList,
                correctAnswer: pool.correct_answer,
                category: normalizeCategory(pool.category),
                showTag: (pool.show_tag as string | undefined) || undefined,
                mediaTitle: singleMediaTitle,
                pointsReward: 10,
                isChallenge: false,
                questionCount: 1,
                rawOptions: pool.options,
                poolId: pool.id,
                questionIndex: 0
              });
            }
          }
        }
      }
      
      return items;
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch social proof (most-picked option + voter name) for each pool in one batch
  useEffect(() => {
    if (!data || data.length === 0) return;
    const poolIds = [...new Set(
      data.map(item => item.poolId).filter(id => !!id)
    )];
    if (poolIds.length === 0) return;

    (async () => {
      try {
        // Step 1: get votes
        const { data: votes, error: votesError } = await supabase
          .from('user_predictions')
          .select('pool_id, prediction, user_id')
          .in('pool_id', poolIds)
          .order('created_at', { ascending: false })
          .limit(500);

        if (votesError || !votes || votes.length === 0) return;

        // Step 2: get user names for the most recent voter per pool
        const recentUserIds = [...new Set(poolIds.map(poolId => {
          const first = votes.find(v => v.pool_id === poolId);
          return first?.user_id;
        }).filter(Boolean))];

        const { data: userRows } = await supabase
          .from('users')
          .select('id, display_name, user_name')
          .in('id', recentUserIds);

        const userMap: Record<string, string> = {};
        for (const u of userRows || []) {
          userMap[u.id] = u.display_name || u.user_name || 'Someone';
        }

        // Step 3: aggregate per pool
        const map: Record<string, { userName: string; option: string; pct: number; total: number }> = {};
        for (const poolId of poolIds) {
          const poolVotes = votes.filter(v => v.pool_id === poolId);
          if (poolVotes.length === 0) continue;
          const counts: Record<string, number> = {};
          for (const v of poolVotes) {
            const opt = v.prediction as string;
            if (opt) counts[opt] = (counts[opt] || 0) + 1;
          }
          const topOption = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (!topOption) continue;
          const total = poolVotes.length;
          const pct = Math.round((counts[topOption] / total) * 100);
          const latestUserId = poolVotes[0]?.user_id;
          const latestUser = latestUserId ? (userMap[latestUserId] || 'Someone') : 'Someone';
          map[poolId] = { userName: latestUser, option: topOption, pct, total };
        }
        setSocialProofMap(map);
      } catch (_) {}
    })();
  }, [data]);

  useEffect(() => {
    setAnsweredLoaded(false);
    setLockedOrder(null);

    const computeOrder = (answeredState: Record<string, any>, items: TriviaItem[]) => {
      const knownCategories = ['movies', 'tv', 'books', 'music', 'sports', 'podcasts', 'games'];
      let filtered = items;
      if (category) {
        if (category.toLowerCase() === 'other') {
          filtered = filtered.filter(item => !item.category || !knownCategories.includes(item.category.toLowerCase()));
        } else if (category.toLowerCase() === 'mixed') {
          filtered = filtered.filter(item => !item.category || item.category.toLowerCase() === 'mixed' || item.category.toLowerCase() === 'entertainment');
        } else {
          filtered = filtered.filter(item => item.category?.toLowerCase() === category.toLowerCase());
        }
      }
      if (challengesOnly) {
        filtered = filtered.filter(item => item.isChallenge);
      }
      const catOffset = category ? category.charCodeAt(0) : 0;
      const shuffled = shuffleArray(filtered, sessionSeed + catOffset);
      // Unanswered first, answered at the end — order locked so answering mid-session doesn't jump
      return [
        ...shuffled.filter(item => !answeredState[item.id]),
        ...shuffled.filter(item => !!answeredState[item.id]),
      ];
    };

    const loadAnswered = async () => {
      if (!user?.id || !data || data.length === 0) {
        setLockedOrder(computeOrder({}, data || []));
        setAnsweredLoaded(true);
        return;
      }

      // Query 1: get this user's answers across all trivia pools
      const uniquePoolIds = [...new Set(data.map(q => q.poolId || q.id))];
      const { data: userPredictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id)
        .in('pool_id', uniquePoolIds);

      if (!userPredictions || userPredictions.length === 0) {
        setLockedOrder(computeOrder({}, data));
        setAnsweredLoaded(true);
        return;
      }

      // Query 2: batch-fetch all community answers for every answered pool in one go
      const answeredPoolIds = [...new Set(userPredictions.map(p => p.pool_id))];
      const { data: allPoolPredictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .in('pool_id', answeredPoolIds);

      // Build stats client-side — no more per-pool queries
      const predsByPool: Record<string, string[]> = {};
      for (const p of allPoolPredictions || []) {
        if (!predsByPool[p.pool_id]) predsByPool[p.pool_id] = [];
        predsByPool[p.pool_id].push(p.prediction);
      }

      const answered: Record<string, { answer: string; isCorrect: boolean; stats: any }> = {};
      for (const userPred of userPredictions) {
        const poolQuestions = data.filter(q => (q.poolId || q.id) === userPred.pool_id);
        const poolPreds = predsByPool[userPred.pool_id] || [];
        const total = poolPreds.length || 1;

        for (const question of poolQuestions) {
          if (question.options.includes(userPred.prediction)) {
            const stats: Record<string, number> = {};
            for (const opt of question.options) {
              const count = poolPreds.filter(p => p === opt).length;
              stats[opt] = Math.round((count / total) * 100);
            }
            answered[question.id] = {
              answer: userPred.prediction,
              isCorrect: question.correctAnswer === userPred.prediction,
              stats,
            };
            break;
          }
        }
      }

      setAnsweredQuestions(answered);
      setLockedOrder(computeOrder(answered, data));
      setAnsweredLoaded(true);
    };

    loadAnswered();
  }, [data, user?.id]);

  const answerMutation = useMutation({
    mutationFn: async ({ itemId, poolId, answer, pointsReward, correctAnswer, options, questionTitle }: { itemId: string; poolId: string; answer: string; pointsReward: number; correctAnswer?: string; options: string[]; questionTitle?: string }) => {
      if (!user?.id) throw new Error('Not logged in');
      const { data: existingAnswer, error: existingError } = await supabase
        .from('user_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('pool_id', poolId)
        .single();
      
      if (existingAnswer) {
        throw new Error('You already answered this question');
      }
      
      const isCorrect = correctAnswer === answer;
      const points = isCorrect ? pointsReward : 0;
      
      const { error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: poolId,
          prediction: answer,
          points_earned: points
        });
      
      if (error) {
        if (error.message.includes('duplicate') || error.code === '23505') {
          throw new Error('You already answered this question');
        }
        throw new Error(`Insert failed: ${error.message}`);
      }
      
      await supabase.rpc('increment_user_points', { user_id_param: user.id, points_to_add: points });

      const { data: allPredictions } = await supabase
        .from('user_predictions')
        .select('prediction, user_id')
        .eq('pool_id', poolId);
      
      const total = allPredictions?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of options) {
        const count = allPredictions?.filter(p => p.prediction === opt).length || 0;
        stats[opt] = Math.round((count / total) * 100);
      }
      
      // Fetch friend answers
      let friendAnswers: FriendAnswer[] = [];
      try {
        // Get user's friends
        const { data: friendships } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted');
        
        const friendIds = (friendships || []).map(f => 
          f.user_id === user.id ? f.friend_id : f.user_id
        );
        
        if (friendIds.length > 0) {
          // Get friend predictions for this question
          const friendPredictions = (allPredictions || []).filter(p => 
            friendIds.includes(p.user_id) && p.user_id !== user.id
          );
          
          if (friendPredictions.length > 0) {
            // Get friend user info
            const { data: friendUsers } = await supabase
              .from('users')
              .select('id, display_name, first_name, last_name, avatar_url')
              .in('id', friendPredictions.map(p => p.user_id));
            
            friendAnswers = friendPredictions.map(p => {
              const friendUser = friendUsers?.find(u => u.id === p.user_id);
              const displayName = friendUser?.first_name 
                ? `${friendUser.first_name}${friendUser.last_name ? ' ' + friendUser.last_name : ''}`
                : friendUser?.display_name || 'Friend';
              return {
                userId: p.user_id,
                displayName,
                avatarUrl: friendUser?.avatar_url,
                answer: p.prediction,
                isCorrect: p.prediction === correctAnswer
              };
            });
          }
        }
      } catch (err) {
        console.error('Error fetching friend answers:', err);
      }
      
      return { itemId, answer, isCorrect, points, stats, friendAnswers };
    },
    onSuccess: (result) => {
      if (result.isCorrect) {
        setCelebratingItems(prev => ({ ...prev, [result.itemId]: result.points }));
        setTimeout(() => {
          setCelebratingItems(prev => { const next = { ...prev }; delete next[result.itemId]; return next; });
        }, 1600);

        setCorrectStreak(prev => {
          const newStreak = prev + 1;
          const milestone = STREAK_MILESTONES.find(m => m.at === newStreak);
          if (milestone) {
            setStreakBanner({ message: milestone.message, sub: milestone.sub, streak: newStreak });
            setTimeout(() => setStreakBanner(null), 3200);
          }
          return newStreak;
        });
      } else {
        setCorrectStreak(0);
      }
      setAnsweredQuestions(prev => ({
        ...prev,
        [result.itemId]: {
          answer: result.answer,
          isCorrect: result.isCorrect,
          points: result.points,
          stats: result.stats,
          friendAnswers: result.friendAnswers
        }
      }));
      
      incrementActivityCount();
      setTimeout(() => queryClient.refetchQueries({ queryKey: ['social-feed'] }), 800);
    },
    onError: (error: Error, variables) => {
      if (error.message === 'You already answered this question') {
        setAnsweredQuestions(prev => ({
          ...prev,
          [variables.itemId]: {
            answer: variables.answer,
            isCorrect: variables.correctAnswer === variables.answer,
            points: 0,
            stats: {},
            friendAnswers: []
          }
        }));
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive'
        });
      }
    }
  });

  const triviaMediaType = (category?: string) => {
    const c = (category || '').toLowerCase();
    if (c === 'movies' || c === 'movie') return 'movie';
    if (c === 'tv' || c === 'tv shows' || c === 'tv show') return 'tv';
    if (c === 'music') return 'music';
    if (c === 'books' || c === 'book') return 'book';
    return 'movie';
  };

  const setTriviaRatingField = (itemId: string, updates: Partial<typeof triviaRatings[string]>) => {
    setTriviaRatings(prev => ({
      ...prev,
      [itemId]: { ratingState: 'idle', rating: 0, reviewText: '', skipped: false, hoverRating: 0, reviewFocused: false, ...(prev[itemId] || {}), ...updates },
    }));
  };

  const handleTriviaRate = async (item: TriviaItem, rating: number) => {
    if (!session?.access_token || !item.mediaTitle) return;
    setTriviaRatingField(item.id, { rating, ratingState: 'rated' });
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    const mediaType = triviaMediaType(item.category);
    try {
      // Try to find externalId first
      const searchRes = await fetch(
        `${supabaseUrl}/functions/v1/media-search?q=${encodeURIComponent(item.mediaTitle)}&type=${mediaType}&limit=1`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const searchData = await searchRes.json();
      const results = searchData?.results || searchData || [];
      const first = Array.isArray(results) ? results[0] : null;
      const externalId = String(first?.externalId || first?.external_id || first?.id || '');
      const externalSource = first?.externalSource || first?.external_source || 'tmdb';
      if (!externalId) return;
      await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_external_id: externalId,
          media_external_source: externalSource,
          media_title: item.mediaTitle,
          media_type: mediaType,
          media_image_url: first?.posterUrl || first?.image || '',
          rating,
          skip_social_post: false,
        }),
      });
    } catch { /* silent — UI already updated optimistically */ }
  };

  const handleTriviaReview = async (item: TriviaItem, reviewText: string) => {
    setTriviaRatingField(item.id, { ratingState: 'reviewed' });
    if (!session?.user?.id || !reviewText.trim()) return;
    try {
      await supabase.from('social_posts').insert({
        user_id: session.user.id,
        content: reviewText.trim(),
        type: 'thought',
        media_title: item.mediaTitle || null,
        media_type: item.category ? triviaMediaType(item.category) : null,
      });
    } catch { /* silent */ }
  };

  const scrollToNext = () => {
    if (scrollRef.current && data && currentIndex < data.length - 1) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, data.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleScroll = () => {
    if (scrollRef.current && data) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), data.length - 1));
    }
  };

  const handleSelectAndSubmit = (item: TriviaItem, option: string) => {
    setSelectedAnswer(prev => ({ ...prev, [item.id]: option }));
    answerMutation.mutate({
      itemId: item.id,
      poolId: item.poolId || item.id,
      answer: option,
      pointsReward: item.pointsReward,
      correctAnswer: item.correctAnswer,
      options: item.options,
      questionTitle: item.question,
    });
  };

  // Generate a session-based seed that changes daily (must be before any returns)
  const sessionSeed = useMemo(() => {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  }, []);

  // Dynamically size the scroll container to the current slide's height only
  useEffect(() => {
    const updateHeight = () => {
      const el = slideRefs.current[currentIndex];
      if (el) setContainerHeight(el.offsetHeight);
    };
    updateHeight();
    const el = slideRefs.current[currentIndex];
    if (!el) return;
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentIndex, answeredQuestions]);

  if (!session) return null;

  if (isLoading || !answeredLoaded) {
    return (
      <div className="bg-white border border-gray-100 shadow rounded-2xl p-4 pb-2 overflow-hidden">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-purple-500 opacity-40" />
        </div>
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return null;
  }

  // Use the locked order (computed once at load time) so answering never causes a re-sort
  const filteredData = lockedOrder || [];

  if (filteredData.length === 0) {
    return null;
  }

  return (
    <>
      {/* Streak banner — slides in from top when a milestone is hit */}
      {streakBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm pointer-events-none">
          <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-600 text-white rounded-2xl px-5 py-4 shadow-2xl border border-purple-500/40 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="text-2xl shrink-0">
                {streakBanner.streak >= 15 ? '🔥' : streakBanner.streak >= 10 ? '⚡' : streakBanner.streak >= 7 ? '💜' : streakBanner.streak >= 5 ? '🎯' : '✨'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight">{streakBanner.message}</p>
                <p className="text-purple-200 text-xs mt-0.5 leading-tight">{streakBanner.sub}</p>
              </div>
              <div className="ml-auto shrink-0 bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
                {streakBanner.streak}🔥
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white border border-gray-100 shadow rounded-2xl p-4 pb-2 overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {category ? (
              <>
                <div className={`w-7 h-7 rounded-full ${challengesOnly ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-purple-900'} flex items-center justify-center`}>
                  {challengesOnly ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Brain className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{category === 'Movies' ? 'Movie' : category} {challengesOnly ? 'Challenges' : 'Trivia'}</p>
                  <p className="text-[10px] text-gray-500">{challengesOnly ? 'Multi-question challenges' : 'One question trivia'}</p>
                </div>
              </>
            ) : (
              <>
                <div className={`w-7 h-7 rounded-full ${challengesOnly ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-purple-900'} flex items-center justify-center`}>
                  {challengesOnly ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Brain className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{challengesOnly ? 'Trivia Challenges' : 'Quick Trivia'}</p>
                  <p className="text-[10px] text-gray-500">{challengesOnly ? 'Multi-question challenges' : 'One question trivia'}</p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {currentIndex > 0 && (
              <button
                onClick={scrollToPrev}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            )}
            {currentIndex < filteredData.length - 1 && (
              <button
                onClick={scrollToNext}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <span className="text-xs text-gray-500 ml-1">
              {currentIndex + 1}/{filteredData.length}
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ height: containerHeight ? `${containerHeight}px` : undefined }}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 items-start transition-[height] duration-300"
        >
          {filteredData.map((item, idx) => {
            const answered = answeredQuestions[item.id];
            const selected = selectedAnswer[item.id];
            
            return (
              <div key={item.id} ref={(el) => { slideRefs.current[idx] = el; }} className="flex-shrink-0 w-full snap-center h-auto relative">
                {item.showTag && (
                  <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1">{item.showTag}</p>
                )}
                <h3 className="text-gray-900 font-semibold text-base leading-snug mb-4">{item.question}</h3>
                
                {!answered ? (
                  <div className="flex flex-col gap-2">
                    {item.options.map((option, idx) => (
                      <button
                        key={idx}
                        className={`py-3 px-4 rounded-full text-sm font-medium transition-all text-left ${
                          selected === option 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        onClick={() => handleSelectAndSubmit(item, option)}
                        disabled={answerMutation.isPending}
                      >
                        {option}
                      </button>
                    ))}
                    {/* Social proof — most popular pick so far */}
                    {socialProofMap[item.poolId] && (
                      <p className="text-[11px] text-gray-400 text-center pt-1">
                        {socialProofMap[item.poolId].userName} picked &ldquo;{socialProofMap[item.poolId].option}&rdquo; &middot; {socialProofMap[item.poolId].pct}% of players agree &middot; {socialProofMap[item.poolId].total} {socialProofMap[item.poolId].total === 1 ? 'vote' : 'votes'}
                      </p>
                    )}
                  </div>
                ) : (
                  <><div className="relative">
                    <div className="flex flex-col gap-2">
                    {/* Percentage bars */}
                    {item.options.map((option, idx) => {
                        const isUserAnswer = answered.answer === option;
                        const isCorrect = item.correctAnswer === option;
                        const percentage = answered.stats?.[option] || 0;
                        return (
                          <div 
                            key={idx}
                            className={`relative py-3 px-4 rounded-full overflow-hidden transition-all ${
                              isCorrect ? 'bg-green-100' : isUserAnswer ? 'bg-red-100' : 'bg-gray-100'
                            }`}
                          >
                            <div 
                              className={`absolute inset-0 transition-all duration-1000 ease-out ${
                                isCorrect ? 'bg-green-200/60' : 'bg-gray-200/40'
                              }`} 
                              style={{ width: `${percentage}%` }} 
                            />
                            <div className="relative flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                                {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                                <span className={`text-sm font-medium ${isCorrect ? 'text-green-800' : isUserAnswer ? 'text-red-800' : 'text-gray-800'}`}>
                                  {option}
                                </span>
                                {isUserAnswer && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                  }`}>
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-medium text-gray-600">{percentage}%</span>
                            </div>
                          </div>
                        );
                      })}

                      {/* ─── Inline rating / review strip ─── */}
                      {item.mediaTitle && session?.access_token && (() => {
                        const tr = triviaRatings[item.id] || { ratingState: 'idle', rating: 0, reviewText: '', skipped: false, hoverRating: 0, reviewFocused: false };
                        if (tr.skipped) return null;
                        return (
                          <div className="mt-3 rounded-xl bg-violet-50 border border-violet-100 overflow-hidden">
                            {tr.ratingState === 'idle' && (
                              <div className="px-3 py-2.5">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase">
                                    Rate {item.mediaTitle}
                                  </p>
                                  <button className="text-[10px] text-gray-400" onClick={(e) => { e.stopPropagation(); setTriviaRatingField(item.id, { skipped: true }); }}>
                                    Skip
                                  </button>
                                </div>
                                <div
                                  className="flex items-center gap-1"
                                  onMouseLeave={() => setTriviaRatingField(item.id, { hoverRating: 0 })}
                                >
                                  {[1,2,3,4,5].map(s => (
                                    <button
                                      key={s}
                                      className="p-0.5 transition-transform hover:scale-110 active:scale-95"
                                      onMouseEnter={() => setTriviaRatingField(item.id, { hoverRating: s })}
                                      onClick={(e) => { e.stopPropagation(); handleTriviaRate(item, s); }}
                                    >
                                      <Star size={22} className={(tr.hoverRating || 0) >= s ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                                    </button>
                                  ))}
                                  <span className="text-[10px] text-gray-400 ml-1">while it's on your mind</span>
                                </div>
                              </div>
                            )}
                            {tr.ratingState === 'rated' && (
                              <div>
                                <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mb-1">{item.mediaTitle}</p>
                                    <div className="flex items-center gap-0.5">
                                      {[1,2,3,4,5].map(s => (
                                        <Star key={s} size={13} className={s <= tr.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                                      ))}
                                      <span className="ml-1 text-[10px] text-gray-500">{tr.rating}/5</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+5 pts</span>
                                </div>
                                <div className="border-t border-violet-100 mx-3" />
                                <div className="px-3 pt-2 pb-2.5">
                                  <p className="text-[10px] font-semibold text-gray-600 mb-1.5">
                                    Add a quick take? <span className="font-normal text-gray-400">(optional)</span>
                                  </p>
                                  <div className={`flex items-end gap-1.5 bg-white rounded-lg border transition-colors ${tr.reviewFocused ? 'border-violet-300' : 'border-gray-200'}`}>
                                    <textarea
                                      value={tr.reviewText}
                                      onChange={(e) => setTriviaRatingField(item.id, { reviewText: e.target.value })}
                                      onFocus={() => setTriviaRatingField(item.id, { reviewFocused: true })}
                                      onBlur={() => setTriviaRatingField(item.id, { reviewFocused: false })}
                                      placeholder={`Your take on ${item.mediaTitle}…`}
                                      rows={2}
                                      className="flex-1 resize-none text-xs text-gray-800 placeholder-gray-400 px-2.5 py-2 bg-transparent outline-none leading-snug"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleTriviaReview(item, tr.reviewText); }}
                                      disabled={!tr.reviewText.trim()}
                                      className={`mb-1.5 mr-1.5 p-1.5 rounded-lg transition-all ${tr.reviewText.trim() ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-300'}`}
                                    >
                                      <Send size={12} />
                                    </button>
                                  </div>
                                  <button className="mt-1 text-[10px] text-gray-400" onClick={(e) => { e.stopPropagation(); handleTriviaReview(item, ''); }}>
                                    Skip review
                                  </button>
                                </div>
                              </div>
                            )}
                            {tr.ratingState === 'reviewed' && (
                              <div className="px-3 py-2.5 flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    {[1,2,3,4,5].map(s => (
                                      <Star key={s} size={12} className={s <= tr.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                                    ))}
                                  </div>
                                  {tr.reviewText.trim() && (
                                    <p className="text-[11px] text-gray-500 italic line-clamp-1">"{tr.reviewText}"</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                  <span className="text-[11px] font-semibold text-green-600">Posted</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Continue/Done button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentIndex < (filteredData?.length || 0) - 1) {
                            scrollToNext();
                          } else {
                            queryClient.invalidateQueries({ queryKey: ['trivia-carousel'] });
                          }
                        }}
                        className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 hover:from-blue-600 hover:via-purple-600 hover:to-purple-700"
                      >
                        {currentIndex < (filteredData?.length || 0) - 1 ? 'Next question' : 'All done!'}
                      </button>
                    </div>

                    {/* Celebration overlay — semi-transparent dark, reveals dimmed bars behind */}
                    <div className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 transition-opacity duration-300 bg-black/60 ${
                      celebratingItems[item.id] !== undefined ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}>
                      <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-xl font-bold text-white">Correct!</p>
                      <div className="bg-white/20 rounded-xl px-5 py-2.5 border border-white/30">
                        <span className="text-2xl font-bold text-white">+{celebratingItems[item.id] ?? 0} pts</span>
                      </div>
                    </div>
                  </div>
                    {/* Friend answers section */}
                    {answered && answered.friendAnswers && answered.friendAnswers.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-semibold text-gray-700">Friends who played</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {answered.friendAnswers.filter(f => f.isCorrect).length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-2">
                                {answered.friendAnswers.filter(f => f.isCorrect).slice(0, 4).map((friend, idx) => (
                                  <div 
                                    key={friend.userId}
                                    className="w-7 h-7 rounded-full bg-green-100 border-2 border-white flex items-center justify-center overflow-hidden"
                                    title={friend.displayName}
                                  >
                                    {friend.avatarUrl ? (
                                      <img src={friend.avatarUrl} alt={friend.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-medium text-green-700">{friend.displayName.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-green-600" />
                                <span className="text-xs text-green-700 font-medium">
                                  {answered.friendAnswers.filter(f => f.isCorrect).length === 1 
                                    ? answered.friendAnswers.find(f => f.isCorrect)?.displayName
                                    : `${answered.friendAnswers.filter(f => f.isCorrect).length} got it right`}
                                </span>
                              </div>
                            </div>
                          )}
                          {answered.friendAnswers.filter(f => !f.isCorrect).length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-2">
                                {answered.friendAnswers.filter(f => !f.isCorrect).slice(0, 4).map((friend, idx) => (
                                  <div 
                                    key={friend.userId}
                                    className="w-7 h-7 rounded-full bg-red-100 border-2 border-white flex items-center justify-center overflow-hidden"
                                    title={friend.displayName}
                                  >
                                    {friend.avatarUrl ? (
                                      <img src={friend.avatarUrl} alt={friend.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-medium text-red-700">{friend.displayName.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-600 font-medium">
                                  {answered.friendAnswers.filter(f => !f.isCorrect).length === 1 
                                    ? answered.friendAnswers.find(f => !f.isCorrect)?.displayName
                                    : `${answered.friendAnswers.filter(f => !f.isCorrect).length} missed it`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>)}
                
                <div className="flex items-center justify-end mt-4">
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                    +{item.pointsReward} pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!category && (
          <Link href="/leaderboard">
            <div className="flex items-center justify-center gap-1.5 py-1 border-t border-gray-200 cursor-pointer hover:opacity-80 transition-opacity">
              <Trophy className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs text-purple-600 font-medium">
                {leaderboardData?.isFirst 
                  ? "Keep playing to stay ahead!" 
                  : leaderboardData?.nextPerson 
                    ? `Get ${leaderboardData.pointsNeeded} more points to pass ${leaderboardData.nextPerson}`
                    : "Play to climb the leaderboard"}
              </span>
            </div>
          </Link>
        )}

        {answerMutation.isPending && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        )}
      </div>

    </>
  );
}
