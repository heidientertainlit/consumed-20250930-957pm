import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Check, X, RefreshCw, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FriendCast {
  id: string;
  creator_id: string;
  creator_pick_celeb_id: string;
  creator_pick_celeb_name: string;
  creator_pick_celeb_image: string;
  status: string;
  creator?: {
    id: string;
    user_name: string;
    avatar_url?: string;
  };
}

interface Celebrity {
  id: string;
  name: string;
  image: string;
}

interface CastApprovalCardProps {
  cast: FriendCast;
  onRespond?: () => void;
}

export default function CastApprovalCard({ cast, onRespond }: CastApprovalCardProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Celebrity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCounter, setSelectedCounter] = useState<Celebrity | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleAction = async (action: 'approve' | 'decline' | 'counter') => {
    if (!session) return;
    
    if (action === 'counter' && !selectedCounter) {
      toast({ title: "Pick a celebrity first!", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        friendCastId: cast.id,
        action
      };

      if (action === 'counter' && selectedCounter) {
        body.counterCelebId = selectedCounter.id;
        body.counterCelebName = selectedCounter.name;
        body.counterCelebImage = selectedCounter.image;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/approve-friend-cast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to respond');
      }

      toast({ 
        title: action === 'approve' 
          ? "Casting approved! 🎬" 
          : action === 'decline' 
            ? "Casting declined" 
            : "Counter-suggestion sent! 🎭"
      });
      
      onRespond?.();
    } catch (error) {
      toast({ title: "Failed to respond", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const searchCelebrities = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await response.json();
      setSearchResults(data.celebrities || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (showCounter) {
    return (
      <Card className="p-4 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-purple-500/30">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white">Who should play you instead?</span>
        </div>

        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Search celebrities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchCelebrities()}
            className="bg-white/10 border-white/20"
          />
          <Button 
            size="sm" 
            onClick={searchCelebrities}
            disabled={isSearching}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3 max-h-48 overflow-y-auto">
            {searchResults.map((celeb) => (
              <button
                key={celeb.id}
                onClick={() => setSelectedCounter(celeb)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  selectedCounter?.id === celeb.id 
                    ? 'border-purple-500 ring-2 ring-purple-500/50' 
                    : 'border-transparent hover:border-purple-400/50'
                }`}
              >
                <img 
                  src={celeb.image} 
                  alt={celeb.name}
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <p className="text-xs text-white truncate">{celeb.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedCounter && (
          <div className="flex items-center gap-2 p-2 bg-purple-600/30 rounded-lg mb-3">
            <img 
              src={selectedCounter.image} 
              alt={selectedCounter.name}
              className="w-10 h-10 rounded object-cover"
            />
            <span className="text-white font-medium">{selectedCounter.name}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setShowCounter(false);
              setSelectedCounter(null);
              setSearchResults([]);
            }}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            onClick={() => handleAction('counter')}
            disabled={isLoading || !selectedCounter}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Counter"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-500/30">
      <div className="flex items-start gap-3">
        <div className="relative">
          <img 
            src={cast.creator_pick_celeb_image || '/placeholder-avatar.png'} 
            alt={cast.creator_pick_celeb_name}
            className="w-16 h-20 rounded-lg object-cover"
          />
        </div>
        
        <div className="flex-1">
          <p className="text-amber-400 text-sm font-medium">🎬 You've been cast!</p>
          <p className="text-white mt-1">
            <span className="font-semibold">{cast.creator?.user_name || 'Someone'}</span>
            {" "}thinks <span className="font-semibold text-amber-300">{cast.creator_pick_celeb_name}</span>
            {" "}should play you in a movie
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button 
          size="sm"
          onClick={() => handleAction('approve')}
          disabled={isLoading}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Accept</>}
        </Button>
        <Button 
          size="sm"
          variant="outline"
          onClick={() => setShowCounter(true)}
          disabled={isLoading}
          className="flex-1 border-purple-500/50 text-purple-300 hover:bg-purple-600/20"
        >
          <RefreshCw className="w-4 h-4 mr-1" /> Counter
        </Button>
        <Button 
          size="sm"
          variant="outline"
          onClick={() => handleAction('decline')}
          disabled={isLoading}
          className="border-red-500/50 text-red-300 hover:bg-red-600/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
