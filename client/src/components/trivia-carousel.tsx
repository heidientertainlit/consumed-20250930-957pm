import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { Brain, Loader2, ChevronLeft, ChevronRight, Trophy, Users, CheckCircle, XCircle, Star, Send, Share2 } from 'lucide-react';
import { shareTrivia } from '@/lib/share';
import { useDnaArchetype } from '@/hooks/use-dna-archetype';
import { getGameAlignment } from '@/lib/identity-feedback';
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

function firstName(name: string | null | undefined, fallback = 'Friend'): string {
  return name?.trim().split(/\s+/)[0] || fallback;
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
  const { archetypeKey } = useDnaArchetype();
  const gameAlignment = getGameAlignment(archetypeKey, 'trivia');
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<string, string>>({});
  const challengeFromUserId = new URLSearchParams(window.location.search).get('from');
  const challengedPoolId = new URLSearchParams(window.location.search).get('challenge');
  const [sharedChallenger, setSharedChallenger] = useState<{ name: string; prediction: string } | null>(null);

  useEffect(() => {
    if (!challengeFromUserId || !challengedPoolId || challengeFromUserId === user?.id) {
      setSharedChallenger(null);
      return;
    }
    let active = true;
    (async () => {
      const [{ data: prediction }, { data: profile }] = await Promise.all([
        supabase
          .from('user_predictions')
          .select('prediction')
          .eq('user_id', challengeFromUserId)
          .eq('pool_id', challengedPoolId)
          .maybeSingle(),
        supabase
          .from('users')
          .select('display_name, first_name')
          .eq('id', challengeFromUserId)
          .maybeSingle(),
      ]);
      if (active && prediction?.prediction) {
        setSharedChallenger({
          name: profile?.first_name || profile?.display_name || 'Your friend',
          prediction: prediction.prediction,
        });
      }
    })();
    return () => { active = false; };
  }, [challengeFromUserId, challengedPoolId, user?.id]);
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answer: string; isCorrect: boolean; points?: number; stats: any; friendAnswers?: FriendAnswer[] }>>({});
  const [answeredLoaded, setAnsweredLoaded] = useState(false);
  const [lockedOrder, setLockedOrder] = useState<TriviaItem[] | null>(null);
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
    queryKey: ['trivia-carousel', user?.id, challengedPoolId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // YYYY-MM-DD Pacific Time
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .or(`publish_at.is.null,publish_at.lte.${now}`)
        .or(`featured_date.is.null,featured_date.lt.${today}`)
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
      
      // Keep the exact shared challenge even if this user answered it before, so
      // the existing result can be hydrated and compared without replaying it.
      const items: TriviaItem[] = [];
      
      for (const pool of (pools || [])) {
        if (answeredPoolIds.includes(pool.id) && pool.id !== challengedPoolId) continue;
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
      data.map(item => item.poolId).filter((id): id is string => Boolean(id))
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
          const pct = Math.round(((counts[topOption] ?? 0) / total) * 100);
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
      const challenged = challengedPoolId
        ? shuffled.find(item => (item.poolId || item.id) === challengedPoolId)
        : null;
      const remaining = challenged
        ? shuffled.filter(item => item.id !== challenged.id)
        : shuffled;
      // Unanswered first, answered at the end — order locked so answering mid-session doesn't jump
      return [
        ...(challenged ? [challenged] : []),
        ...remaining.filter(item => !answeredState[item.id]),
        ...remaining.filter(item => !!answeredState[item.id]),
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

      setAnsweredQuestions(answered);
      setLockedOrder(computeOrder(answered, data));
      setAnsweredLoaded(true);
    };

    loadAnswered();
  }, [data, user?.id, challengedPoolId]);

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
      
      if (points > 0) {
        await supabase.rpc('increment_trivia_points', { uid: user.id, pts: points });
      }

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
              .select('id, display_name, first_name, last_name, avatar')
              .in('id', friendPredictions.map(p => p.user_id));
            
            friendAnswers = friendPredictions.map(p => {
              const friendUser = friendUsers?.find(u => u.id === p.user_id);
              const displayName = friendUser?.first_name 
                ? `${friendUser.first_name}${friendUser.last_name ? ' ' + friendUser.last_name : ''}`
                : friendUser?.display_name || 'Friend';
              return {
                userId: p.user_id,
                displayName,
                avatarUrl: friendUser?.avatar,
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
    setTriviaRatings(prev => {
      const current = prev[itemId] ?? {
        ratingState: 'idle' as const,
        rating: 0,
        reviewText: '',
        skipped: false,
        hoverRating: 0,
        reviewFocused: false,
      };
      return {
        ...prev,
        [itemId]: { ...current, ...updates },
      };
    });
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

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.children[0]?.clientWidth || 280;
    el.scrollTo({ left: idx * (cardWidth + 12), behavior: 'smooth' });
    setCurrentIndex(idx);
  };

  const scrollToNext = () => {
    if (data && currentIndex < data.length - 1) scrollToIndex(currentIndex + 1);
  };

  const scrollToPrev = () => {
    if (currentIndex > 0) scrollToIndex(currentIndex - 1);
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
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 pb-2 overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {category ? (
              <>
                <div className={`w-7 h-7 rounded-full ${challengesOnly ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-purple-900'} flex items-center justify-center`}>
                  {challengesOnly ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Brain className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{category === 'Movies' ? 'Movie' : category} {challengesOnly ? 'Challenges' : 'Trivia'}</p>
                  {challengesOnly && <p className="text-[10px] text-gray-500">Multi-question challenges</p>}
                </div>
              </>
            ) : (
              <>
                <div className={`w-7 h-7 rounded-full ${challengesOnly ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-purple-900'} flex items-center justify-center`}>
                  {challengesOnly ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Brain className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{challengesOnly ? 'Trivia Challenges' : 'Quick Trivia'}</p>
                  {challengesOnly && <p className="text-[10px] text-gray-500">Multi-question challenges</p>}
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {filteredData.length <= 8 ? (
              <span className="flex items-center gap-1 ml-1" aria-label={`${currentIndex + 1} of ${filteredData.length}`}>
                {filteredData.map((_, i) => (
                  <span key={i} className={`rounded-full transition-all ${i === currentIndex ? 'w-2 h-2 bg-purple-600' : 'w-1.5 h-1.5 bg-gray-300'}`} />
                ))}
              </span>
            ) : (
              <span className="text-xs text-gray-500 ml-1">
                {currentIndex + 1}/{filteredData.length}
              </span>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ height: containerHeight ? `${containerHeight}px` : undefined }}
          className="flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory -mx-1 px-1 items-start transition-[height] duration-300"
        >
          {filteredData.map((item, idx) => {
            const answered = answeredQuestions[item.id];
            const selected = selectedAnswer[item.id];
            const socialProof = item.poolId ? socialProofMap[item.poolId] : undefined;
            
            return (
              <div key={item.id} ref={(el) => { slideRefs.current[idx] = el; }} className="flex-shrink-0 w-full snap-center h-auto relative">
                <div className="flex items-start justify-between mb-1">
                  {item.showTag && (
                    <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">{item.showTag}</p>
                  )}
                  {answered && (
                    <CheckCircle size={16} className="text-green-500 ml-auto flex-shrink-0" aria-label="Done" />
                  )}
                </div>
                <h3 className="text-gray-900 font-semibold text-[18px] leading-snug mb-1.5">{item.question}</h3>
                {!answered && (
                  <p className="flex items-center gap-1.5 mb-3">
                    <span className="text-[12px] font-bold text-purple-600">+{item.pointsReward || 10} pts</span>
                  </p>
                )}

                {!answered ? (
                  <div className="flex flex-col gap-2">
                    {item.options.map((option, idx) => (
                      <button
                        key={idx}
                        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-medium transition-all text-left border ${
                          selected === option 
                            ? 'bg-purple-600 border-purple-600 text-white shadow-md' 
                            : 'bg-white border-gray-200 text-gray-800 hover:border-purple-300 hover:bg-purple-50/40'
                        }`}
                        onClick={() => handleSelectAndSubmit(item, option)}
                        disabled={answerMutation.isPending}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          selected === option ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 min-w-0">{option}</span>
                        <ChevronRight className={`w-4 h-4 shrink-0 ${selected === option ? 'text-white/70' : 'text-gray-300'}`} />
                      </button>
                    ))}
                    {/* Social proof — most popular pick so far */}
                    {socialProof && (
                      <p className="text-[11px] text-gray-400 text-center pt-1">
                        {socialProof.total} {socialProof.total === 1 ? 'player has' : 'players have'} already answered — your turn
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

                  </div>
                    {/* Friend answers section */}
                    {answered && answered.friendAnswers && answered.friendAnswers.length > 0 && (
                      <div className="mt-2.5 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-semibold text-gray-700">Friends who played</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          {answered.friendAnswers.slice(0, 6).map((friend, idx) => (
                            <div key={friend.userId} className="contents">
                              {idx > 0 && <span className="text-gray-300">·</span>}
                              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                <span className={friend.isCorrect ? 'text-emerald-600' : 'text-gray-400'}>
                                  {friend.isCorrect ? '✓' : '✕'}
                                </span>
                                <span>{firstName(friend.displayName)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>)}
                
                {answered && <div className="mt-2.5">
                  {answered && sharedChallenger && challengedPoolId === (item.poolId || item.id) ? (
                    <div className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 flex items-center justify-center gap-2 text-[13px] font-semibold text-gray-700">
                      <span className={answered.isCorrect ? 'text-emerald-600' : 'text-gray-400'}>{answered.isCorrect ? '✓' : '✕'}</span>
                      <span>{firstName(user?.user_metadata?.first_name || user?.user_metadata?.display_name, 'You')}</span>
                      <span className="text-gray-300">·</span>
                      <span>{firstName(sharedChallenger.name)}</span>
                      <span className={sharedChallenger.prediction === item.correctAnswer ? 'text-emerald-600' : 'text-gray-400'}>{sharedChallenger.prediction === item.correctAnswer ? '✓' : '✕'}</span>
                    </div>
                  ) : (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const result = await shareTrivia({
                          poolId: item.poolId || item.id,
                          question: item.question,
                          fromUserId: user?.id,
                          result: answered.isCorrect ? 'right' : 'wrong',
                        });
                        if (result === 'copied') {
                          toast({ title: 'Challenge link copied', description: 'Send it to a friend to compare scores.' });
                        }
                      }}
                      className="w-full rounded-xl border border-purple-100 bg-purple-50/70 px-3.5 py-3 flex items-center gap-3 text-left transition-colors hover:bg-purple-50"
                    >
                      <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                        <Send className="w-4 h-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[13px] font-semibold text-purple-700">Send to a friend</span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">See how they scored</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-purple-500" />
                    </button>
                  )}
                </div>}
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
