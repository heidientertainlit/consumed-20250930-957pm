import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import { Search, X, Check, Users, Share2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  const [step, setStep] = useState<'select-friend' | 'select-celeb' | 'confirm'>('select-friend');
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [customFriendName, setCustomFriendName] = useState("");
  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);
  const [celebScrollIndex, setCelebScrollIndex] = useState(0);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    loadPopularCelebs();
    if (session) loadFriends();
  }, [session]);

  const loadPopularCelebs = async () => {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popular: true })
      });
      const data = await response.json();
      setCelebrities(data.celebrities || []);
    } catch (error) {
      console.error('Failed to load celebrities:', error);
    }
  };

  const searchCelebrities = async (query: string) => {
    if (!query.trim()) {
      loadPopularCelebs();
      return;
    }
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
    } catch (error) {
      console.error('Celebrity search failed:', error);
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
        celeb_name: selectedCeleb.name
      });

      toast({ title: "Cast created! Share with your friend! 🎬" });
      onComplete?.();
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
              {step === 'select-friend' && "Pick a friend"}
              {step === 'select-celeb' && "Choose a celebrity"}
              {step === 'confirm' && "Confirm your cast"}
            </p>
          </div>
        </div>
        {step !== 'select-friend' && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setStep(step === 'confirm' ? 'select-celeb' : 'select-friend')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
      </div>

      {step === 'select-friend' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Who would you like to cast?</p>
          
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
                    setStep('select-celeb');
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
              placeholder="Or type a name..."
              value={customFriendName}
              onChange={(e) => {
                setCustomFriendName(e.target.value);
                setSelectedFriend(null);
              }}
              className="bg-black/30 border-amber-500/30"
            />
            <Button 
              onClick={() => customFriendName && setStep('select-celeb')}
              disabled={!customFriendName}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 'select-celeb' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            Who would play <span className="text-amber-400 font-semibold">{selectedFriend?.user_name || customFriendName}</span> in a movie?
          </p>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search celebrities..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 2) {
                  searchCelebrities(e.target.value);
                }
              }}
              className="pl-10 bg-black/30 border-amber-500/30"
            />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-400" />}
          </div>

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
                    setStep('confirm');
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
                  </div>
                  {selectedCeleb?.id === celeb.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
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

          {celebrities.length === 0 && !isSearching && (
            <p className="text-center text-gray-400 text-sm py-4">No celebrities found</p>
          )}
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
