import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import { Users, Sparkles, Search, ChevronLeft, ChevronRight, Loader2, UserPlus, Share2, MessageSquare } from "lucide-react";
import { Link } from "wouter";

interface Celebrity {
  id: string;
  name: string;
  image: string;
  known_for?: string;
}

interface Friend {
  id: string;
  user_name: string;
}

interface CastFriendsGameProps {
  onComplete?: () => void;
}

export default function CastFriendsGame({ onComplete }: CastFriendsGameProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<'browse' | 'add-friend' | 'confirm'>('browse');
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');
  const [mode, setMode] = useState<'browse' | 'describe' | 'search'>('browse');
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [customFriendName, setCustomFriendName] = useState("");
  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    loadPopularCelebs();
    if (session) loadFriends();
  }, [session]);

  useEffect(() => {
    loadPopularCelebs();
  }, [gender]);

  const loadPopularCelebs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popular: true, gender })
      });
      const data = await response.json();
      setCelebrities(data.celebrities || []);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load celebrities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestCelebrities = async () => {
    if (!description.trim() || description.length < 5) {
      toast({ title: "Describe a bit more!", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/suggest-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      const data = await response.json();
      if (data.celebrities?.length > 0) {
        setCelebrities(data.celebrities);
        setCurrentIndex(0);
        setMode('browse');
        trackEvent('cast_friends_ai_suggest', { description_length: description.length });
      } else {
        toast({ title: "No matches found", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const searchCelebrities = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await response.json();
      if (data.celebrities?.length > 0) {
        setCelebrities(data.celebrities);
        setCurrentIndex(0);
        setMode('browse');
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!session) return;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/get-friends`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const handleSubmit = async () => {
    if (!session || (!selectedFriend && !customFriendName) || !selectedCeleb) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/create-friend-cast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetFriendId: selectedFriend?.id,
          targetFriendName: customFriendName || selectedFriend?.user_name,
          celebId: selectedCeleb.id,
          celebName: selectedCeleb.name,
          celebImage: selectedCeleb.image
        })
      });

      if (!response.ok) throw new Error('Failed to create cast');

      trackEvent('friend_cast_created', {
        has_friend_account: !!selectedFriend,
        celeb_name: selectedCeleb.name
      });

      toast({ title: "Cast shared! Ask friends to argue your pick! 🎬" });
      onComplete?.();
      
      setStep('browse');
      setSelectedCeleb(null);
      setSelectedFriend(null);
      setCustomFriendName("");
    } catch (error) {
      toast({ title: "Failed to create cast", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToNext = () => {
    if (scrollRef.current && currentIndex < celebrities.length - 1) {
      const cardWidth = 140;
      scrollRef.current.scrollBy({ left: cardWidth + 8, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, celebrities.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = 140;
      scrollRef.current.scrollBy({ left: -(cardWidth + 8), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  if (!session) {
    return (
      <Card className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Cast Your Friends</p>
            <p className="text-xs text-gray-500">Who would play them in a movie?</p>
          </div>
        </div>
        <Link href="/login">
          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">Sign In to Play</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Cast Your Friends</p>
            <p className="text-[10px] text-gray-500">
              {step === 'browse' && "Pick a celebrity"}
              {step === 'add-friend' && "Who is this for?"}
              {step === 'confirm' && "Confirm & share"}
            </p>
          </div>
        </div>
        
        {step !== 'browse' && (
          <button
            onClick={() => setStep(step === 'confirm' ? 'add-friend' : 'browse')}
            className="text-xs text-gray-500 flex items-center"
          >
            <ChevronLeft className="w-3 h-3" /> Back
          </button>
        )}
      </div>

      {step === 'browse' && (
        <>
          {mode === 'browse' && (
            <>
              <div className="flex gap-2 mb-3">
                {(['all', 'male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      gender === g
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g === 'all' ? 'All' : g === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
                
                <div className="flex-1" />
                
                <button
                  onClick={() => setMode('describe')}
                  className="px-2 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> AI
                </button>
                <button
                  onClick={() => setMode('search')}
                  className="px-2 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1"
                >
                  <Search className="w-3 h-3" />
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : (
                <div className="relative">
                  {currentIndex > 0 && (
                    <button
                      onClick={scrollToPrev}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  
                  <div
                    ref={scrollRef}
                    className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-1"
                  >
                    {celebrities.map((celeb) => (
                      <button
                        key={celeb.id}
                        onClick={() => {
                          setSelectedCeleb(celeb);
                          setStep('add-friend');
                        }}
                        className={`flex-shrink-0 snap-center w-[100px] transition-transform hover:scale-105 ${
                          selectedCeleb?.id === celeb.id ? 'ring-2 ring-amber-500 rounded-xl' : ''
                        }`}
                      >
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden">
                          <img 
                            src={celeb.image} 
                            alt={celeb.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-[10px] text-white font-medium truncate">{celeb.name}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {currentIndex < celebrities.length - 4 && (
                    <button
                      onClick={scrollToNext}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {mode === 'describe' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Describe your friend's look and vibe...</p>
              <Textarea
                placeholder="e.g. Tall, dark hair, funny, always the life of the party..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[70px] resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('browse')}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={suggestCelebrities}
                  disabled={isLoading || description.length < 5}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Find Matches
                </Button>
              </div>
            </div>
          )}

          {mode === 'search' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Search for a specific celebrity</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Ryan Gosling"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCelebrities()}
                  className="text-sm"
                />
                <Button 
                  onClick={searchCelebrities}
                  disabled={isLoading || !searchQuery.trim()}
                  size="sm"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setMode('browse')}
                className="w-full text-gray-500"
              >
                Cancel
              </Button>
            </div>
          )}
        </>
      )}

      {step === 'add-friend' && selectedCeleb && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-3">
            <img 
              src={selectedCeleb.image} 
              alt={selectedCeleb.name}
              className="w-12 h-16 rounded-lg object-cover"
            />
            <div>
              <p className="text-xs text-gray-500">You picked:</p>
              <p className="text-amber-600 font-bold">{selectedCeleb.name}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600">Who does this remind you of?</p>
          
          {friends.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {friends.slice(0, 6).map(friend => (
                <button
                  key={friend.id}
                  onClick={() => {
                    setSelectedFriend(friend);
                    setCustomFriendName("");
                    setStep('confirm');
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedFriend?.id === friend.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  @{friend.user_name}
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Or type any name..."
              value={customFriendName}
              onChange={(e) => {
                setCustomFriendName(e.target.value);
                setSelectedFriend(null);
              }}
              className="text-sm"
            />
            <Button 
              onClick={() => customFriendName && setStep('confirm')}
              disabled={!customFriendName}
              size="sm"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && selectedCeleb && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4">
            <img 
              src={selectedCeleb.image} 
              alt={selectedCeleb.name}
              className="w-14 h-18 rounded-lg object-cover"
            />
            <div>
              <p className="text-xs text-gray-500">You think</p>
              <p className="text-amber-600 font-bold text-lg">{selectedCeleb.name}</p>
              <p className="text-xs text-gray-500">would play</p>
              <p className="text-gray-900 font-bold">{selectedFriend?.user_name || customFriendName}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <MessageSquare className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Friends can <span className="font-semibold text-amber-600">argue your pick</span> with their own!</p>
          </div>

          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-amber-500 hover:bg-amber-600"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Share2 className="w-4 h-4 mr-2" />
            )}
            Share & Let Friends Argue
          </Button>
        </div>
      )}
    </Card>
  );
}
