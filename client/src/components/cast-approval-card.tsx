import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { X, RefreshCw, Loader2, Search, Share2, Download } from "lucide-react";
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
    display_name?: string;
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
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Celebrity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCounter, setSelectedCounter] = useState<Celebrity | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const creatorName = cast.creator?.display_name || cast.creator?.user_name || 'A friend';

  const handleAction = async (action: 'approve' | 'decline' | 'counter') => {
    if (!session) return;
    
    if (action === 'counter' && !selectedCounter) {
      toast({ title: "Pick a celebrity first!", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setLoadingAction(action);
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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to respond');
      }

      if (action !== 'decline') {
        toast({ 
          title: action === 'approve' 
            ? "Posted to feed! 🎬" 
            : "Counter-suggestion sent! 🎭"
        });
      }
      
      onRespond?.();
    } catch (error: any) {
      console.error('Action error:', error);
      toast({ title: error.message || "Failed to respond", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const searchCelebrities = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await response.json();
      console.log('Celebrity search results:', data);
      setSearchResults(data.celebrities || []);
    } catch (error) {
      console.error('Search failed:', error);
      toast({ title: "Search failed", variant: "destructive" });
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
      canvas.height = 750;

      // Dark gradient background
      const gradient = ctx.createLinearGradient(0, 0, 600, 750);
      gradient.addColorStop(0, '#1e1b4b');
      gradient.addColorStop(1, '#312e81');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 750);

      // Load and draw celebrity image - centered and smaller
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = cast.creator_pick_celeb_image;
      });

      const imgWidth = 280;
      const imgHeight = 350;
      const imgX = (600 - imgWidth) / 2;
      const imgY = 80;
      
      // Draw rounded image
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgWidth, imgHeight, 16);
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();

      // "I've been cast as" text
      ctx.fillStyle = '#a5b4fc';
      ctx.font = '22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("I've been cast as", 300, 480);

      // Celebrity name - bold and white
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillText(cast.creator_pick_celeb_name, 300, 520);

      // Cast by line - use creator name properly
      const casterName = cast.creator?.user_name && cast.creator.user_name !== 'Unknown' 
        ? cast.creator.user_name 
        : cast.creator?.display_name || creatorName;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(`Cast by @${casterName}`, 300, 560);

      // Draw consumed logo circle
      ctx.beginPath();
      ctx.arc(300, 640, 25, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      
      // "C" letter in logo
      ctx.fillStyle = '#1e1b4b';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText('C', 300, 650);

      // CTA text
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Cast your friends on @consumedapp', 300, 710);

      const link = document.createElement('a');
      link.download = `cast-${cast.creator_pick_celeb_name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({ title: "Image downloaded!" });
    } catch (error) {
      console.error('Download failed:', error);
      toast({ title: "Couldn't download image", variant: "destructive" });
    }
  };

  if (showCounter) {
    return (
      <Card className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-gray-800">Who should play you instead?</span>
        </div>

        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Search celebrities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchCelebrities()}
            className="bg-gray-50 border-gray-200"
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
          <div className="grid grid-cols-4 gap-2 mb-3 max-h-40 overflow-y-auto">
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
                  <p className="text-[10px] text-white truncate">{celeb.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedCounter && (
          <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg mb-3">
            <img 
              src={selectedCounter.image} 
              alt={selectedCounter.name}
              className="w-10 h-10 rounded object-cover"
            />
            <span className="text-gray-800 font-medium">{selectedCounter.name}</span>
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
            {isLoading && loadingAction === 'counter' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Counter"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-3">
      <div className="flex items-center gap-3">
        <img 
          src={cast.creator_pick_celeb_image || '/placeholder-avatar.png'} 
          alt={cast.creator_pick_celeb_name}
          className="w-16 h-20 rounded-xl object-cover object-center flex-shrink-0"
        />
        
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mb-1">
            You've Been Cast!
          </span>
          <p className="text-base font-semibold text-gray-900 truncate">
            {cast.creator_pick_celeb_name}
          </p>
          <p className="text-xs text-gray-500 mb-3">
            @{creatorName} thinks this celebrity would play you
          </p>

          <div className="flex gap-2 mb-2">
            <Button 
              size="sm"
              onClick={() => handleAction('approve')}
              disabled={isLoading}
              className="flex-1 text-white text-xs"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}
            >
              {isLoading && loadingAction === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Share2 className="w-3 h-3 mr-1" /> Share to Feed</>}
            </Button>
            <Button 
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="border-gray-200 text-gray-600 text-xs px-2"
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm"
              variant="ghost"
              onClick={() => setShowCounter(true)}
              disabled={isLoading}
              className="flex-1 text-purple-600 hover:text-purple-700 hover:bg-transparent text-xs h-8"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Suggest Different
            </Button>
            <Button 
              size="sm"
              variant="ghost"
              onClick={() => handleAction('decline')}
              disabled={isLoading}
              className="text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs h-8"
            >
              {isLoading && loadingAction === 'decline' ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3 mr-1" /> Decline</>}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
