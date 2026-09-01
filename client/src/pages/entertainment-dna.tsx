import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dna, Feather, Loader2, Share2, Download, Tv, Film, BookOpen, Music, Mic, Gamepad2, Trophy, Sparkles, Check, ArrowLeft, ArrowRight, Search, Heart, Zap, Clapperboard, Wand2, Smile, Skull, HelpCircle, Crown, Rocket, Video, Palette, Drama, HeartHandshake, Home, Leaf, Plane, Users, Eye, CircleUser, Youtube } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import html2canvas from "html2canvas";
import consumedPurpleLogo from "@/assets/consumed_logo_purple_trimmed.png";
import { ShareImageSheet } from "@/components/share-image-sheet";
import { APP_BASE } from "@/lib/share";
import { useFirstSessionHooks } from "@/components/first-session-hooks";

// Icon mapping for entertainment types
const ENTERTAINMENT_ICONS: Record<string, typeof Tv> = {
  'TV': Tv,
  'TV Shows': Tv,
  'Movies': Film,
  'Books': BookOpen,
  'Music': Music,
  'Podcasts': Mic,
  'Gaming': Gamepad2,
  'Sports': Trophy,
  'YouTube': Youtube,
};

// Icons for the "when you press play" drivers question, keyed by option keywords.
const DRIVER_ICONS: { match: string; Icon: typeof Tv }[] = [
  { match: "feel something", Icon: Heart },
  { match: "escape", Icon: Plane },
  { match: "connect over", Icon: Users },
  { match: "visuals", Icon: Eye },
  { match: "unwind", Icon: Leaf },
  { match: "figure things out", Icon: Search },
  { match: "curious about people", Icon: CircleUser },
  { match: "fun or action", Icon: Zap },
  { match: "depends on the day", Icon: Sparkles },
];
const driverIcon = (option: string) =>
  DRIVER_ICONS.find((d) => option.toLowerCase().includes(d.match))?.Icon;

// Official genre rooms (pools table, room_category='genre'). Tapping one both
// follows the room AND counts as the genre answer for the DNA generator.
// `genre` maps to the option wording on the survey's genre question.
const GENRE_ROOMS: { id: string; name: string; genre: string | null; Icon: typeof Tv }[] = [
  { id: "eb529882-4a66-496d-97f2-bf9981692968", name: "True Crime", genre: "True Crime", Icon: Search },
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
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
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
          fetch(`${SUPABASE_URL}/rest/v1/media_ratings?select=media_title,media_type&user_id=eq.${session.user.id}&order=created_at.desc&limit=30`, { headers }),
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
        for (const r of ratings as { media_title: string; media_type: string }[]) {
          if (r.media_title && !titles.includes(r.media_title)) titles.push(r.media_title);
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
  // Onboarding already asked "What’s in your rotation?" — if they picked
  // mappable rooms there, don't ask again; their follows still write the genre answer.
  const roomsAnsweredInOnboarding = GENRE_ROOMS.some((r) => initialFollows.has(r.id) && r.genre);

  // One question per screen. Rooms screen is skipped when onboarding already
  // captured mappable rooms. Gender question dropped from the survey.
  const screens: ("types" | "rooms" | "love" | "drivers")[] = [
    "types",
    ...(roomsAnsweredInOnboarding ? [] : ["rooms" as const]),
    "love",
    "drivers",
  ];
  const screenComplete = (name: string) => {
    if (name === "types") return hasAnswer(qByOrder(2));
    if (name === "rooms") return hasMappableRoom;
    if (name === "love") return true; // optional
    return hasAnswer(qByOrder(5));
  };

  // DNA completion % shown in the header bar. Credit for what they've already
  // added (onboarding picks / follows), climbing as steps are finished.

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}>
        <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}>
        <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
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

    const handleShare = async () => {
      if (!cardRef.current || isSharing) return;
      setIsSharing(true);
      try {
        const canvas = await html2canvas(cardRef.current, {
          scale: 3,
          useCORS: true,
          backgroundColor: null,
        });
        const shareText = `I'm a "${dnaProfile.title}" — ${dnaProfile.description} Check out my Entertainment DNA on Consumed!`;
        // Public, no-login-required DNA page for recipients.
        const shareUrl = session?.user?.id ? `${APP_BASE}/edna/${session.user.id}` : APP_BASE;
        // Prefer the OS share sheet (text, AirDrop, etc.) with the image attached.
        const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        if (blob && navigator.share) {
          const file = new File([blob], 'my-entertainment-dna.png', { type: 'image/png' });
          const withImage = { files: [file], title: 'My Entertainment DNA', text: `${shareText} ${shareUrl}` };
          try {
            if (navigator.canShare?.(withImage)) {
              await navigator.share(withImage);
            } else {
              await navigator.share({ title: 'My Entertainment DNA', text: shareText, url: shareUrl });
            }
            return;
          } catch (err: any) {
            if (err?.name === 'AbortError') return; // user closed the share sheet
          }
        }
        // Fallback (no native share support): show the in-app share sheet.
        setShareImageUrl(canvas.toDataURL('image/png'));
        setShareSheetOpen(true);
      } catch (error) {
        console.error('Error preparing share image:', error);
      } finally {
        setIsSharing(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col items-center justify-center p-4">
        {/* Shareable Card - Instagram Story optimized (9:16 aspect ratio) */}
        <div 
          ref={cardRef}
          className="w-[320px] bg-white rounded-3xl overflow-hidden shadow-2xl"
          style={{ minHeight: '568px' }}
        >
          <div className="p-5 flex flex-col h-full">
            {/* Header */}
            <div className="text-center mb-3">
              <h1
                className="mb-2 text-[17px] font-medium leading-tight text-gray-900"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Your Entertainment DNA by
              </h1>
              <img src={consumedPurpleLogo} alt="Consumed" className="mx-auto mb-3 h-auto w-28" />
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Dna className="text-white" size={24} />
              </div>
            </div>

            {/* DNA Label & Tagline */}
            <div className="text-center mb-3">
              <h2 className="bg-gradient-to-r from-purple-950 to-purple-700 bg-clip-text font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-transparent">
                {dnaProfile.title}
              </h2>
              <p className="text-gray-600 text-sm">{dnaProfile.description}</p>
            </div>

            {/* Flavor Notes */}
            {dnaProfile.superpowers && dnaProfile.superpowers.length > 0 && (
              <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                {dnaProfile.superpowers.slice(0, 3).map((power, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[11px] font-medium leading-tight text-purple-800"
                  >
                    {power}
                  </span>
                ))}
              </div>
            )}

            {/* DNA Bio */}
            {dnaProfile.meaning && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-3 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Your Entertainment DNA Profile:</h3>
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
            onClick={handleShare}
            disabled={isSharing}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-6 py-2.5 rounded-full shadow-lg text-sm flex items-center justify-center gap-2"
            data-testid="share-dna-button"
          >
            <Share2 size={18} />
            {isSharing ? 'Preparing...' : 'Share'}
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/activity'}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-2.5 rounded-full shadow-lg text-sm"
            data-testid="go-to-feed-button"
          >
            Check out what others are consuming
          </Button>
        </div>

        <ShareImageSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          imageDataUrl={shareImageUrl}
          fileName="my-entertainment-dna.png"
          title="Share Your Entertainment DNA"
          shareText={`I'm a "${dnaProfile.title}" — ${dnaProfile.description} Check out my Entertainment DNA on Consumed!`}
          shareUrl={session?.user?.id ? `${APP_BASE}/edna/${session.user.id}` : undefined}
        />
      </div>
    );
  }

  // ── Stepped survey: dark purple gradient header, white body (app vibe) ──
  const typesQ = qByOrder(2);
  const driversQ = qByOrder(5);
  const loveQ = qByOrder(4);

  const pill = (_selected: boolean) =>
    "flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold border transition-all active:scale-95 text-left";
  const pillStyle = (selected: boolean): React.CSSProperties => ({
    borderColor: selected ? "#7c3aed" : "rgb(229,231,235)",
    background: selected ? "linear-gradient(135deg,#6d28d9,#9333ea 45%,#d946ef)" : "white",
    color: selected ? "white" : "rgb(55,65,81)",
    boxShadow: selected ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
  });


  const totalSteps = screens.length;
  const clampedStep = Math.min(step, totalSteps - 1);
  const screen = screens[clampedStep];
  const screenTitles: Record<string, string> = {
    types: "Starting to take shape",
    rooms: "Beginning to see patterns",
    love: "Your taste is becoming clearer",
    drivers: "Almost ready",
  };
  const basePct = alreadyAdded.length > 0 ? 35 : 10;
  const dnaPct = clampedStep >= totalSteps - 1 ? 99 : Math.round(basePct + (clampedStep / totalSteps) * (90 - basePct));
  const typesCount = (() => {
    const a = typesQ ? getAnswer(typesQ.id) : undefined;
    return Array.isArray(a) ? a.length : 0;
  })();


  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-[#fbf8f5]">
      <div className="w-full max-w-[430px] flex flex-col relative bg-white">
        {/* Dark purple gradient header */}
        <div
          className="px-5 pt-5 pb-6 text-white"
          style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => (clampedStep > 0 ? setStep(clampedStep - 1) : setLocation("/"))}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              data-testid="dna-back-button"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">{clampedStep > 0 ? "Back" : "Exit"}</span>
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
            Step {clampedStep + 1} of {totalSteps} — {screenTitles[screen]}
          </p>
        </div>

        {/* White step content */}
        <div className="flex-1 px-5 pt-6 pb-4 bg-white">
          {screen === "types" && typesQ && (
            <div>
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 mb-1.5">LET&apos;S START WITH THE BASICS</p>
              <h2 className="text-[26px] leading-[1.15] font-black text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                What are you into?
              </h2>
              <p className="text-[13px] text-gray-400 mt-1 mb-5">Pick <span className="text-gray-500 font-medium underline decoration-purple-300 decoration-2 underline-offset-2">everything</span> you regularly watch, read, listen to, or play.</p>
              <div className="grid grid-cols-2 gap-3">
                {typesQ.options?.map((option) => {
                  const current = getAnswer(typesQ.id);
                  const currentAnswers = Array.isArray(current) ? current : [];
                  const on = currentAnswers.includes(option);
                  const clean = option.replace(" (please specify)", "");
                  const IconComponent = ENTERTAINMENT_ICONS[clean];
                  return (
                    <button
                      key={option}
                      onClick={() => {
                        const updated = on
                          ? currentAnswers.filter((a) => a !== option)
                          : [...currentAnswers, option];
                        handleAnswer(typesQ.id, updated);
                      }}
                      className="relative flex flex-col items-start gap-2.5 p-4 rounded-2xl border text-left transition-all active:scale-95"
                      style={{
                        borderColor: on ? "rgb(203,205,215)" : "rgb(235,236,240)",
                        background: on ? "#fafafb" : "white",
                        boxShadow: "none",
                      }}
                      data-testid={`multi-option-${typesQ.id}-${clean}`}
                    >
                      {IconComponent && <IconComponent size={24} strokeWidth={1.5} style={{ color: "#4b4a63" }} />}
                      <span className="text-[15px] font-medium text-gray-800">{clean}</span>
                      {on && (
                        <span
                          className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "#4b4a63" }}
                        >
                          <Check size={12} className="text-white" strokeWidth={2.5} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {typesCount > 0 && (
                <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-3.5 flex items-start gap-3" data-testid="dna-types-feedback">
                  <Sparkles size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: "#4b4a63" }} />
                  <p className="text-[14px] leading-snug">
                    {typesCount >= 3 ? (
                      <>
                        <span className="font-bold text-gray-900">A true multi-format consumer.</span>{" "}
                        <span className="text-gray-500">We like that.</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-gray-900">Noted.</span>{" "}
                        <span className="text-gray-500">Your DNA is starting to take shape...</span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {screen === "rooms" && (
            <div>
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 mb-1.5">NOW FOR THE FUN QUESTION</p>
              <h2 className="text-[26px] leading-[1.15] font-black text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                What could you talk about for hours?
              </h2>
              <p className="text-[13px] text-gray-400 mt-1 mb-4">
                {typesCount > 0
                  ? `Nice — ${typesCount} format${typesCount === 1 ? "" : "s"} locked in. Now pick as many topics as you like.`
                  : "Pick as many as you like — each one shapes your DNA."}
              </p>
              {selectedRooms.length > 0 && (
                <p className="text-[13px] font-semibold text-purple-600 mb-3" data-testid="dna-room-feedback">
                  {selectedRooms.length >= 3
                    ? "\uD83E\uDDEC Your patterns are showing already..."
                    : "\u2728 Your DNA is starting to take shape..."}
                </p>
              )}
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
                      <Icon size={15} className={on ? "text-white" : "text-purple-600"} />
                      {room.name}
                      {on && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screen === "love" && loveQ && (
            <div>
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 mb-1.5">TELL US ANYTHING</p>
              <h2 className="text-[26px] leading-[1.15] font-black text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                What do you love?
              </h2>
              <p className="text-[14px] text-gray-400 mt-1 mb-4">
                Anything we missed? <span className="text-gray-300">(optional)</span>
              </p>
              <div className="relative">
                <textarea
                  value={(getAnswer(loveQ.id) as string) || ""}
                  onChange={(e) => handleAnswer(loveQ.id, e.target.value)}
                  placeholder="Share anything you love..."
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:border-purple-400 focus:outline-none min-h-[160px] resize-none text-gray-900 placeholder:text-gray-400 text-[15px]"
                  data-testid={`text-input-${loveQ.id}`}
                />
                <Feather size={16} className="absolute bottom-4 right-4 text-gray-400 pointer-events-none" />
              </div>
              {alreadyAdded.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <p className="flex items-center gap-1.5 text-[14px] font-bold text-gray-900 shrink-0">
                      <Sparkles size={14} className="text-purple-600" />
                      Already shaping your DNA
                    </p>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Sparkles size={15} className="text-purple-600" />
                    </span>
                    {alreadyAdded.map((t) => (
                      <span
                        key={t}
                        className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-800 text-[14px] font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center gap-3 bg-purple-50 rounded-2xl px-4 py-3.5">
                    <Dna size={18} className="text-purple-600 shrink-0" />
                    <p className="text-[14px] text-gray-800">This makes your DNA even more personal.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {screen === "drivers" && driversQ && (
            <div>
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 mb-1.5">LAST QUESTION — ALMOST DONE</p>
              <h2 className="text-[22px] leading-[1.15] font-black text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
                When you press play, what are you hoping for?
              </h2>
              <p className="text-[13px] text-gray-400 mt-1 mb-4">Select as many as you want.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {driversQ.options?.map((option, index) => {
                  const current = getAnswer(driversQ.id);
                  const currentAnswers = Array.isArray(current) ? current : [];
                  const on = currentAnswers.includes(option);
                  const IconComponent = driverIcon(option);
                  const isLastOdd = index === (driversQ.options?.length || 0) - 1 && (driversQ.options?.length || 0) % 2 === 1;
                  return (
                    <button
                      key={option}
                      onClick={() => {
                        const updated = on
                          ? currentAnswers.filter((a) => a !== option)
                          : [...currentAnswers, option];
                        handleAnswer(driversQ.id, updated);
                      }}
                      className={`relative flex items-center gap-3 px-3.5 py-3.5 rounded-2xl border text-left transition-all active:scale-95 ${isLastOdd ? "col-span-2" : ""}`}
                      style={{
                        borderColor: on ? "#7c3aed" : "rgb(229,231,235)",
                        background: on ? "#f6f3fd" : "white",
                      }}
                      data-testid={`multi-option-${driversQ.id}-${option}`}
                    >
                      {IconComponent && <IconComponent size={20} className="text-purple-600 shrink-0" />}
                      <span className="text-[13px] font-medium text-gray-900 leading-snug">{option}</span>
                      {on && (
                        <span className="absolute right-3 top-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#6d28d9" }}>
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer button */}
        <div className="px-5 pb-10 bg-white">
          {clampedStep < totalSteps - 1 ? (
            <button
              onClick={() => setStep(clampedStep + 1)}
              disabled={!screenComplete(screen)}
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
              disabled={!screenComplete("drivers")}
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
