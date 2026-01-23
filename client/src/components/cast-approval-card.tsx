import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Check, X, RefreshCw, Loader2, Search, Share2, Download, Sparkles } from "lucide-react";
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
  const cardRef = useRef<HTMLDivElement>(null);

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
          ? "Posted to feed! 🎬" 
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

  const handleDownload = async () => {
    toast({ title: "Preparing your image..." });
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 600;
      canvas.height = 800;

      const gradient = ctx.createLinearGradient(0, 0, 600, 800);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 800);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = cast.creator_pick_celeb_image;
      });

      const imgX = 100;
      const imgY = 150;
      const imgWidth = 400;
      const imgHeight = 400;
      
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgWidth, imgHeight, 20);
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎬 You\'ve Been Cast!', 300, 80);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillText(cast.creator_pick_celeb_name, 300, 620);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(`would play you in a movie`, 300, 660);

      ctx.fillStyle = '#6b7280';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(`Cast by @${cast.creator?.user_name || 'a friend'}`, 300, 700);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('consumed', 300, 760);

      const link = document.createElement('a');
      link.download = `cast-${cast.creator_pick_celeb_name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({ title: "Image downloaded! 📸" });
    } catch (error) {
      console.error('Download failed:', error);
      toast({ title: "Couldn't download image", variant: "destructive" });
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
    <Card ref={cardRef} className="overflow-hidden bg-gradient-to-br from-amber-900/60 to-orange-900/60 border-amber-500/40">
      <div className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-sm">You've Been Cast!</span>
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <p className="text-amber-100 text-xs mt-0.5">
          @{cast.creator?.user_name || 'A friend'} thinks this celebrity should play you
        </p>
      </div>

      <div className="p-4">
        <div className="relative mx-auto w-48 h-64 mb-4">
          <img 
            src={cast.creator_pick_celeb_image || '/placeholder-avatar.png'} 
            alt={cast.creator_pick_celeb_name}
            className="w-full h-full rounded-xl object-cover shadow-2xl ring-4 ring-amber-500/50"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 px-4 py-1 rounded-full shadow-lg">
            <p className="text-white font-bold text-sm whitespace-nowrap">{cast.creator_pick_celeb_name}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button 
              onClick={() => handleAction('approve')}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Share2 className="w-4 h-4 mr-2" /> Share to Feed</>}
            </Button>
            <Button 
              variant="outline"
              onClick={handleDownload}
              className="border-amber-500 text-amber-400 hover:bg-amber-500/20"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm"
              variant="ghost"
              onClick={() => setShowCounter(true)}
              disabled={isLoading}
              className="flex-1 text-purple-400 hover:bg-purple-500/20"
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Suggest Different
            </Button>
            <Button 
              size="sm"
              variant="ghost"
              onClick={() => handleAction('decline')}
              disabled={isLoading}
              className="text-gray-400 hover:text-red-400 hover:bg-red-500/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
