import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import { Search, X, Check, Users, Share2, ChevronLeft, ChevronRight, Loader2, Sparkles, UserPlus } from "lucide-react";
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
  const [step, setStep] = useState<'describe' | 'pick-celeb' | 'add-friend' | 'confirm'>('describe');
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [customFriendName, setCustomFriendName] = useState("");
  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);
  const [celebScrollIndex, setCelebScrollIndex] = useState(0);
  const [mode, setMode] = useState<'describe' | 'search'>('describe');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (session) loadFriends();
  }, [session]);

  const suggestCelebrities = async () => {
    if (!description.trim() || description.length < 5) {
      toast({ title: "Please describe your friend a bit more", variant: "destructive" });
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/suggest-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      const data = await response.json();
      
      if (data.celebrities && data.celebrities.length > 0) {
        setCelebrities(data.celebrities);
        setCelebScrollIndex(0);
        setStep('pick-celeb');
        trackEvent('cast_friends_ai_suggest', { description_length: description.length });
      } else {
        toast({ title: "No matches found. Try different words!", variant: "destructive" });
      }
    } catch (error) {
      console.error('Suggest failed:', error);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const searchCelebrities = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      setCelebrities(data.celebrities || []);
      setCelebScrollIndex(0);
      if (data.celebrities?.length > 0) {
        setStep('pick-celeb');
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
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
        celeb_name: selectedCeleb.name,
        used_ai: mode === 'describe'
      });

      toast({ title: "Cast created! Share with your friend! 🎬" });
      onComplete?.();
      
      setStep('describe');
      setSelectedCeleb(null);
      setSelectedFriend(null);
      setCustomFriendName("");
      setDescription("");
      setCelebrities([]);
    } catch (error) {
      toast({ title: "Failed to create cast", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleCelebs = celebrities.slice(celebScrollIndex, celebScrollIndex + 4);
  const canScrollLeft = celebScrollIndex > 0;
  const canScrollRight = celebScrollIndex + 4 < celebrities.length;

  if (!session) {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl p-6 border border-amber-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Cast Your Friends</h3>
            <p className="text-sm text-gray-400">Who would play them in a movie?</p>
          </div>
        </div>
        <p className="text-gray-300 text-sm mb-4">Sign in to cast your friends as celebrities!</p>
        <Link href="/login">
          <Button className="w-full bg-amber-600 hover:bg-amber-700">Sign In to Play</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-xl p-4 border border-amber-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Cast Your Friends</h3>
            <p className="text-xs text-gray-400">
              {step === 'describe' && "Describe or search"}
              {step === 'pick-celeb' && "Pick a celebrity"}
              {step === 'add-friend' && "Who is this for?"}
              {step === 'confirm' && "Confirm your cast"}
            </p>
          </div>
        </div>
        {step !== 'describe' && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              if (step === 'pick-celeb') setStep('describe');
              else if (step === 'add-friend') setStep('pick-celeb');
              else if (step === 'confirm') setStep('add-friend');
            }}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
      </div>

      {step === 'describe' && (
        <div className="space-y-3">
          <div className="flex gap-2 mb-3">
            <Button
              variant={mode === 'describe' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('describe')}
              className={mode === 'describe' ? 'bg-amber-600' : ''}
            >
              <Sparkles className="w-3 h-3 mr-1" /> Describe
            </Button>
            <Button
              variant={mode === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('search')}
              className={mode === 'search' ? 'bg-amber-600' : ''}
            >
              <Search className="w-3 h-3 mr-1" /> Search Name
            </Button>
          </div>

          {mode === 'describe' ? (
            <>
              <p className="text-sm text-gray-300">Describe your friend - looks, personality, vibe...</p>
              <Textarea
                placeholder="e.g. Tall, dark hair, funny, always the life of the party, gives off superhero energy..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-black/30 border-amber-500/30 min-h-[80px] resize-none"
              />
              <Button 
                onClick={suggestCelebrities}
                disabled={isSearching || description.length < 5}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Find Matching Celebrities
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-300">Search for a specific celebrity</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Ryan Gosling"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCelebrities(searchQuery)}
                  className="bg-black/30 border-amber-500/30"
                />
                <Button 
                  onClick={() => searchCelebrities(searchQuery)}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'pick-celeb' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            {mode === 'describe' ? 'AI found these matches!' : 'Pick your celebrity'}
          </p>

          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => setCelebScrollIndex(Math.max(0, celebScrollIndex - 4))}
                className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/80 border border-amber-500/30 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
            )}
            
            <div className="grid grid-cols-4 gap-2 py-2">
              {visibleCelebs.map(celeb => (
                <button
                  key={celeb.id}
                  onClick={() => {
                    setSelectedCeleb(celeb);
                    setStep('add-friend');
                  }}
                  className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                    selectedCeleb?.id === celeb.id 
                      ? 'border-amber-500 scale-105' 
                      : 'border-transparent hover:border-amber-500/50'
                  }`}
                >
                  <img 
                    src={celeb.image} 
                    alt={celeb.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                    <p className="text-[10px] text-white font-medium truncate">{celeb.name}</p>
                    {celeb.known_for && (
                      <p className="text-[8px] text-gray-400 truncate">{celeb.known_for}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {canScrollRight && (
              <button
                onClick={() => setCelebScrollIndex(Math.min(celebrities.length - 4, celebScrollIndex + 4))}
                className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/80 border border-amber-500/30 flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {celebrities.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">No celebrities found</p>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setStep('describe')}
            className="w-full text-gray-400"
          >
            Try a different description
          </Button>
        </div>
      )}

      {step === 'add-friend' && selectedCeleb && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-black/30 rounded-lg p-3 mb-2">
            <img 
              src={selectedCeleb.image} 
              alt={selectedCeleb.name}
              className="w-12 h-16 rounded-lg object-cover"
            />
            <div>
              <p className="text-xs text-gray-400">You picked:</p>
              <p className="text-amber-400 font-bold">{selectedCeleb.name}</p>
            </div>
          </div>

          <p className="text-sm text-gray-300">Who does this remind you of?</p>
          
          {friends.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {friends.slice(0, 6).map(friend => (
                <Button
                  key={friend.id}
                  variant={selectedFriend?.id === friend.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedFriend(friend);
                    setCustomFriendName("");
                    setStep('confirm');
                  }}
                  className={selectedFriend?.id === friend.id ? "bg-amber-600" : ""}
                >
                  @{friend.user_name}
                </Button>
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
              className="bg-black/30 border-amber-500/30"
            />
            <Button 
              onClick={() => customFriendName && setStep('confirm')}
              disabled={!customFriendName}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && selectedCeleb && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-black/30 rounded-lg p-3">
            <img 
              src={selectedCeleb.image} 
              alt={selectedCeleb.name}
              className="w-16 h-20 rounded-lg object-cover"
            />
            <div className="flex-1">
              <p className="text-gray-400 text-sm">You think</p>
              <p className="text-amber-400 font-bold">{selectedCeleb.name}</p>
              <p className="text-gray-400 text-sm">would play</p>
              <p className="text-white font-bold">{selectedFriend?.user_name || customFriendName}</p>
            </div>
          </div>

          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Share2 className="w-4 h-4 mr-2" />
            )}
            Share & Ask Friends
          </Button>
          
          <p className="text-center text-xs text-gray-400">
            Your pick will be shared for friends to weigh in
          </p>
        </div>
      )}
    </div>
  );
}
