import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dna, Loader2, Download, Tv, Film, BookOpen, Music, Mic, Gamepad2, Trophy, Sparkles, Check, ArrowLeft, ArrowRight, Search, Heart, Zap, Clapperboard, Wand2, Smile, Skull, HelpCircle, Crown, Rocket, Video, Palette, Drama, HeartHandshake, Home, Leaf } from "lucide-react";
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

// Official genre rooms (pools table, room_category='genre'). Tapping one both
// follows the room AND counts as the genre answer for the DNA generator.
// `genre` maps to the option wording on the survey's genre question.
const GENRE_ROOMS: { id: string; name: string; genre: string | null; Icon: typeof Tv }[] = [
  { id: "eb529882-4a66-496d-97f2-bf9981692968", name: "True Crime", genre: "Crime", Icon: Search },
  { id: "c73774e0-c54c-44ed-8b14-ae0e3b076ddc", name: "Reality", genre: "Reality", Icon: Tv },
  { id: "a776d7dd-8206-4381-b847-17ff6f1e0d67", name: "Heartwarming", genre: "Romance", Icon: Heart },
  { id: "9e424f35-cd99-43ff-b695-d0ae89747b5a", name: "Action & Thriller", genre: "Action", Icon: Zap },
  { id: "47182919-da7a-41bb-9688-50ec11561e53", name: "Rom-Com", genre: "Rom-com/chick-lit", Icon: Clapperboard },
  { id: "58841101-ce10-46d7-9241-f7d52a11f630", name: "Fantasy", genre: "Fantasy", Icon: Wand2 },
  { id: "b32722af-0a76-4df3-9fa2-a94a7e3046fb", name: "Comedy", genre: "Comedy", Icon: Smile },
  { id: "3e0a4b3d-e211-44c7-9633-4a6a5a9206de", name: "Sports", genre: null, Icon: Trophy },
  { id: "6ce32c55-b1ab-42ce-8e5c-6cf530e3e58b", name: "Horror", genre: "Horror", Icon: Skull },
  { id: "0ab28a57-065e-4d7a-8bd2-09af8c3be7d9", name: "Mystery", genre: "Mystery/Thriller", Icon: HelpCircle },
  { id: "cdd6dffe-70d2-45af-80b1-55e1f30ae6a5", name: "Period Drama", genre: "Historical", Icon: Crown },
  { id: "58db44eb-d82d-4173-85d9-c4c4e288d77b", name: "Sci-Fi", genre: "Science Fiction", Icon: Rocket },
  { id: "41c7f7bb-faeb-4780-956e-f77f7f4adf64", name: "Documentaries", genre: "Documentaries", Icon: Video },
  { id: "d7db8196-b5df-4354-944f-44c0b9857780", name: "Animation", genre: "Animation", Icon: Palette },
  { id: "f7f22b7c-2e3b-470e-ac60-d4ee9601b16b", name: "Drama", genre: "Drama", Icon: Drama },
  { id: "51432489-35b9-468a-a0fb-7648a7d588e3", name: "Romance", genre: "Romance", Icon: HeartHandshake },
  { id: "dd89be31-9f46-47b9-848d-7519be038176", name: "Lifestyle", genre: "Lifestyle (Home Reno, Food, Travel)", Icon: Home },
  { id: "4792cc12-15c9-4ea3-bf50-19abfbab49de", name: "Nonfiction", genre: "Nonfiction", Icon: BookOpen },
  { id: "e227edc9-bcb1-4828-8360-374a9792a636", name: "Self Help", genre: "Self Help", Icon: Leaf },
];

const TYPE_FROM_MEDIA: Record<string, string> = {
  movie: "Movies",
  tv: "TV Shows",
  book: "Books",
  podcast: "Podcasts",
  music: "Music",
};

const SUPABASE_URL = "https://mahpgcogwpawvviapqza.supabase.co";

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

  // Stepped flow state + pre-fill from onboarding activity.
  const [step, setStep] = useState(0);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [initialFollows, setInitialFollows] = useState<Set<string>>(new Set());
  const [alreadyAdded, setAlreadyAdded] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

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

  // Pre-fill: rooms they already follow (checked pills) and titles they've
  // already rated (shown as "already in your DNA" chips + media-type prefill).
  useEffect(() => {
    if (!session?.access_token || !session?.user?.id || surveyQuestions.length === 0 || prefilled) return;
    const headers = {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
    const load = async () => {
      try {
        const [followsRes, ratingsRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/room_follows?select=room_id&user_id=eq.${session.user.id}`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/media_ratings?select=title,media_type&user_id=eq.${session.user.id}&order=created_at.desc&limit=30`, { headers }),
        ]);
        const follows = followsRes.ok ? await followsRes.json() : [];
        const ratings = ratingsRes.ok ? await ratingsRes.json() : [];

        const genreRoomIds = new Set(GENRE_ROOMS.map((r) => r.id));
        const followed = (follows as { room_id: string }[])
          .map((f) => f.room_id)
          .filter((id) => genreRoomIds.has(id));
        setInitialFollows(new Set(followed));
        setSelectedRooms(followed);

        const titles: string[] = [];
        const types = new Set<string>();
        for (const r of ratings as { title: string; media_type: string }[]) {
          if (r.title && !titles.includes(r.title)) titles.push(r.title);
          const t = TYPE_FROM_MEDIA[(r.media_type || '').toLowerCase()];
          if (t) types.add(t);
        }
        setAlreadyAdded(titles.slice(0, 12));

        // Pre-check media types from what they've actually added.
        const typesQ = surveyQuestions.find((q) => q.display_order === 2);
        if (typesQ && types.size > 0) {
          setAnswers((prev) => prev.some((a) => a.questionId === typesQ.id)
            ? prev
            : [...prev, { questionId: typesQ.id, answer: Array.from(types) }]);
        }
      } catch (e) {
        console.error('[dna prefill]', e);
      } finally {
        setPrefilled(true);
      }
    };
    load();
  }, [session?.access_token, session?.user?.id, surveyQuestions, prefilled]);

  const toggleRoom = (id: string) =>
    setSelectedRooms((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

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
      const authHeaders = {
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      };

      // Sync room follows: add newly tapped rooms, remove explicitly untapped ones.
      const toAdd = selectedRooms.filter((id) => !initialFollows.has(id));
      const toRemove = Array.from(initialFollows).filter((id) => !selectedRooms.includes(id));
      await Promise.all([
        ...toAdd.map((room_id) =>
          fetch(`${SUPABASE_URL}/rest/v1/room_follows`, {
            method: 'POST',
            headers: { ...authHeaders, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify({ user_id: session?.user?.id, room_id }),
          }).then((res) => { if (!res.ok) console.error('[dna room follow] failed', room_id, res.status); })
            .catch((e) => console.error('[dna room follow]', e))),
        ...toRemove.map((room_id) =>
          fetch(`${SUPABASE_URL}/rest/v1/room_follows?user_id=eq.${session?.user?.id}&room_id=eq.${room_id}`, {
            method: 'DELETE',
            headers: authHeaders,
          }).then((res) => { if (!res.ok) console.error('[dna room unfollow] failed', room_id, res.status); })
            .catch((e) => console.error('[dna room unfollow]', e))),
      ]);

      // The rooms they picked double as the genre answer for the DNA generator.
      const genresQ = surveyQuestions.find((q) => q.display_order === 3);
      const roomGenres = Array.from(new Set(
        GENRE_ROOMS.filter((r) => selectedRooms.includes(r.id) && r.genre).map((r) => r.genre as string)
      ));
      const allAnswers: SurveyAnswer[] = genresQ && roomGenres.length > 0
        ? [...answers.filter((a) => a.questionId !== genresQ.id), { questionId: genresQ.id, answer: roomGenres }]
        : answers;

      for (const answer of allAnswers) {
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

  const qByOrder = (n: number) => questions.find((q) => q.display_order === n);

  const hasAnswer = (q?: SurveyQuestion) => {
    if (!q) return false;
    const a = getAnswer(q.id);
    if (!a) return false;
    return Array.isArray(a) ? a.length > 0 : a.trim().length > 0;
  };

  // At least one selected room must map to a survey genre (Sports maps to none),
  // so the required genres answer is always written on submit.
  const hasMappableRoom = GENRE_ROOMS.some((r) => selectedRooms.includes(r.id) && r.genre);

  // Step gating: 0 = types + rooms, 1 = drivers + open-ended, 2 = gender.
  const stepComplete = (s: number) => {
    if (s === 0) return hasAnswer(qByOrder(2)) && hasMappableRoom;
    if (s === 1) return hasAnswer(qByOrder(5));
    return hasAnswer(qByOrder(1));
  };

  // DNA completion % shown in the header bar. Credit for what they've already
  // added (onboarding picks / follows), climbing as steps are finished.
  const basePct = alreadyAdded.length > 0 ? 35 : 10;
  const dnaPct = Math.min(90, basePct + step * Math.round((90 - basePct) / 3));

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

  // ── Stepped survey: dark purple gradient header, white body (app vibe) ──
  const typesQ = qByOrder(2);
  const driversQ = qByOrder(5);
  const loveQ = qByOrder(4);
  const genderQ = qByOrder(1);

  const pill = (selected: boolean) =>
    `px-4 py-2.5 rounded-full text-sm flex items-center gap-2 text-left transition-all border ${
      selected
        ? "border-gray-300 bg-gray-200 text-gray-900 font-medium shadow-sm"
        : "border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50"
    }`;
  const pillStyle = (_selected: boolean) => undefined;

  const renderMulti = (q: SurveyQuestion, withIcons = false) => {
    const current = getAnswer(q.id);
    const currentAnswers = Array.isArray(current) ? current : [];
    return (
      <div className="flex flex-wrap gap-2">
        {q.options?.map((option, index) => {
          const isChecked = currentAnswers.includes(option);
          const clean = option.replace(" (please specify)", "");
          const IconComponent = withIcons ? ENTERTAINMENT_ICONS[clean] : undefined;
          return (
            <button
              key={index}
              onClick={() => {
                const updated = isChecked
                  ? currentAnswers.filter((a) => a !== option)
                  : [...currentAnswers, option];
                handleAnswer(q.id, updated);
              }}
              className={pill(isChecked)}
              style={pillStyle(isChecked)}
              data-testid={`multi-option-${q.id}-${clean}`}
            >
              {IconComponent && <IconComponent size={15} />}
              {clean}
              {isChecked && <Check size={15} />}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSelect = (q: SurveyQuestion) => {
    const current = getAnswer(q.id);
    return (
      <div className="flex flex-wrap gap-2">
        {q.options?.map((option, index) => {
          const isSelected = current === option;
          return (
            <button
              key={index}
              onClick={() => handleAnswer(q.id, option)}
              className={pill(isSelected)}
              style={pillStyle(isSelected)}
              data-testid={`option-${q.id}-${option}`}
            >
              {option}
              {isSelected && <Check size={15} />}
            </button>
          );
        })}
      </div>
    );
  };

  const stepTitles = ["What you're into", "What it does for you", "Last thing"];
  const totalSteps = 3;

  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-gray-100">
      <div className="w-full max-w-[430px] flex flex-col relative bg-white">
        {/* Dark purple gradient header */}
        <div
          className="px-5 pt-5 pb-6 text-white"
          style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => (step > 0 ? setStep(step - 1) : setLocation("/"))}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              data-testid="dna-back-button"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">{step > 0 ? "Back" : "Exit"}</span>
            </button>
            <button
              onClick={() => setLocation("/activity")}
              className="text-xs text-white/70 hover:text-white"
            >
              Skip for now
            </button>
          </div>

          {/* DNA hero */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-purple-600/25 border border-purple-400/40 flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/40">
              <Dna className="text-purple-200" size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-purple-300 text-[11px] font-semibold tracking-[0.15em] uppercase mb-0.5">
                Finish building
              </p>
              <h1
                className="text-2xl font-bold leading-tight"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Your Entertainment DNA
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${dnaPct}%`, background: "linear-gradient(90deg, #a78bfa, #e879f9)" }}
              />
            </div>
            <span className="text-sm text-purple-200 font-medium shrink-0">
              <span className="text-white font-semibold">{dnaPct}%</span> complete
            </span>
          </div>
          <p className="text-white/50 text-xs mt-2">
            Step {step + 1} of {totalSteps} — {stepTitles[step]}
          </p>
        </div>

        {/* White step content */}
        <div className="flex-1 px-5 pt-6 pb-4 space-y-7 bg-white">
          {step === 0 && (
            <>
              {typesQ && (
                <div>
                  <h2 className="text-xl font-bold leading-snug text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                    What do you like to consume?
                  </h2>
                  <p className="text-gray-500 text-sm mb-3">Select all that apply.</p>
                  {renderMulti(typesQ, true)}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold leading-snug text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                  What conversations do you want to follow?
                </h2>
                <div className="flex flex-wrap gap-2">
                  {[...GENRE_ROOMS]
                    .sort((a, b) => Number(initialFollows.has(a.id)) - Number(initialFollows.has(b.id)))
                    .map((room) => {
                    const on = selectedRooms.includes(room.id);
                    const Icon = room.Icon;
                    return (
                      <button
                        key={room.id}
                        onClick={() => toggleRoom(room.id)}
                        className={pill(on)}
                        style={pillStyle(on)}
                        data-testid={`room-pill-${room.name}`}
                      >
                        <Icon size={15} />
                        {room.name}
                        {on && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {loveQ && (
                <div>
                  <h2 className="text-xl font-bold leading-snug text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                    What do you love?
                  </h2>
                  <p className="text-gray-500 text-sm mb-3">
                    What else are you into that we haven't asked about? Teams, athletes, musicians,
                    authors, comfort rewatches — anything. <span className="text-gray-400">(optional)</span>
                  </p>
                  <textarea
                    value={(getAnswer(loveQ.id) as string) || ""}
                    onChange={(e) => handleAnswer(loveQ.id, e.target.value)}
                    placeholder="Type freely — one thing per line or however it comes out."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none min-h-[110px] resize-vertical text-gray-900 placeholder:text-gray-400 text-sm"
                    data-testid={`text-input-${loveQ.id}`}
                  />
                  {alreadyAdded.length > 0 && (
                    <div className="mt-3">
                      <p className="text-gray-400 text-xs mb-2">Already added to your DNA</p>
                      <div className="flex flex-wrap gap-1.5">
                        {alreadyAdded.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-400 text-xs"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {driversQ && (
                <div>
                  <h2 className="text-xl font-bold leading-snug text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                    What drives your choices?
                  </h2>
                  <p className="text-gray-500 text-sm mb-3">Pick up to 3.</p>
                  {renderMulti(driversQ)}
                </div>
              )}

            </>
          )}

          {step === 2 && genderQ && (
            <div>
              <h2 className="text-xl font-bold leading-snug text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                One quick detail
              </h2>
              <p className="text-gray-500 text-sm mb-3">{genderQ.question_text}</p>
              {renderSelect(genderQ)}
              <p className="text-gray-400 text-xs mt-6">
                That's everything — hit the button below to generate your Entertainment DNA.
              </p>
            </div>
          )}
        </div>

        {/* Footer button */}
        <div className="px-5 pb-10 bg-white">
          {step < totalSteps - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!stepComplete(step)}
              className="w-full text-white font-semibold rounded-full py-3.5 text-base shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
              data-testid="dna-continue-button"
            >
              Continue
              <ArrowRight size={18} />
            </button>
          ) : (
            <Button
              onClick={generateDNA}
              disabled={!stepComplete(2)}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white font-semibold rounded-full py-4 text-base shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="get-dna-button"
            >
              Discover Your DNA
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
