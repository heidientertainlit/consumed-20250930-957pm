import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import { Search, Users, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Link } from "wouter";

interface Celebrity {
  id: string;
  name: string;
  image: string;
}

interface FriendCastCardProps {
  cast: {
    id: string;
    creator: { id: string; user_name: string };
    target?: { id: string; user_name: string };
    target_friend_name?: string;
    creator_pick_celeb_name: string;
    creator_pick_celeb_image: string;
    responses: Array<{
      id: string;
      celeb_name: string;
      celeb_image?: string;
      responder: { id: string; user_name: string };
    }>;
  };
}

export default function FriendCastCard({ cast }: FriendCastCardProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [showRespond, setShowRespond] = useState(false);
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celebScrollIndex, setCelebScrollIndex] = useState(0);
  const [hasResponded, setHasResponded] = useState(
    cast.responses.some(r => r.responder?.id === user?.id)
  );

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const targetName = cast.target?.user_name || cast.target_friend_name || "them";

  const loadCelebrities = async (query?: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/search-celebrities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query ? { query } : { popular: true })
      });
      const data = await response.json();
      setCelebrities(data.celebrities || []);
      setCelebScrollIndex(0);
    } catch (error) {
      console.error('Failed to load celebrities:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRespond = async (celeb: Celebrity) => {
    if (!session) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/respond-friend-cast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          friendCastId: cast.id,
          celebId: celeb.id,
          celebName: celeb.name,
          celebImage: celeb.image
        })
      });

      if (!response.ok) throw new Error('Failed to respond');

      trackEvent('friend_cast_response', { celeb_name: celeb.name });
      setHasResponded(true);
      setShowRespond(false);
      toast({ title: "Your pick is in! 🎬" });
    } catch (error) {
      toast({ title: "Failed to submit", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleCelebs = celebrities.slice(celebScrollIndex, celebScrollIndex + 4);

  return (
    <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 rounded-xl p-4 border border-amber-500/20">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400">
            <Link href={`/profile/${cast.creator.user_name}`}>
              <span className="text-amber-400 hover:underline cursor-pointer">@{cast.creator.user_name}</span>
            </Link>
            {' '}thinks...
          </p>
          <p className="text-white font-medium">
            Who would play <span className="text-amber-400">{targetName}</span> in a movie?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-black/30 rounded-lg p-3 mb-3">
        <img 
          src={cast.creator_pick_celeb_image} 
          alt={cast.creator_pick_celeb_name}
          className="w-12 h-16 rounded-lg object-cover"
        />
        <div>
          <p className="text-xs text-gray-400">Their pick:</p>
          <p className="text-amber-400 font-bold">{cast.creator_pick_celeb_name}</p>
        </div>
      </div>

      {cast.responses.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-2">{cast.responses.length} other picks:</p>
          <div className="flex -space-x-2">
            {cast.responses.slice(0, 5).map((resp, i) => (
              <div key={resp.id} className="relative group">
                {resp.celeb_image ? (
                  <img 
                    src={resp.celeb_image} 
                    alt={resp.celeb_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-black"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500/30 border-2 border-black flex items-center justify-center">
                    <span className="text-xs text-white">{resp.celeb_name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 px-2 py-1 rounded text-xs text-white whitespace-nowrap z-10">
                  @{resp.responder.user_name}: {resp.celeb_name}
                </div>
              </div>
            ))}
            {cast.responses.length > 5 && (
              <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-black flex items-center justify-center">
                <span className="text-xs text-white">+{cast.responses.length - 5}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!hasResponded && session && !showRespond && (
        <Button 
          onClick={() => {
            setShowRespond(true);
            loadCelebrities();
          }}
          variant="outline"
          className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
        >
          Add Your Pick
        </Button>
      )}

      {hasResponded && (
        <p className="text-center text-sm text-gray-400">You've added your pick</p>
      )}

      {!session && (
        <Link href="/login">
          <Button variant="outline" className="w-full border-amber-500/50 text-amber-400">
            Sign in to add your pick
          </Button>
        </Link>
      )}

      {showRespond && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search celebrities..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 2) {
                  loadCelebrities(e.target.value);
                }
              }}
              className="pl-10 bg-black/30 border-amber-500/30"
            />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-400" />}
          </div>

          <div className="relative">
            {celebScrollIndex > 0 && (
              <button
                onClick={() => setCelebScrollIndex(Math.max(0, celebScrollIndex - 4))}
                className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/80 border border-amber-500/30 flex items-center justify-center"
              >
                <ChevronLeft className="w-3 h-3 text-white" />
              </button>
            )}
            
            <div className="grid grid-cols-4 gap-2">
              {visibleCelebs.map(celeb => (
                <button
                  key={celeb.id}
                  onClick={() => handleRespond(celeb)}
                  disabled={isSubmitting}
                  className="relative aspect-[3/4] rounded-lg overflow-hidden border border-transparent hover:border-amber-500 transition-all"
                >
                  <img 
                    src={celeb.image} 
                    alt={celeb.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                    <p className="text-[9px] text-white truncate">{celeb.name}</p>
                  </div>
                </button>
              ))}
            </div>

            {celebScrollIndex + 4 < celebrities.length && (
              <button
                onClick={() => setCelebScrollIndex(Math.min(celebrities.length - 4, celebScrollIndex + 4))}
                className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/80 border border-amber-500/30 flex items-center justify-center"
              >
                <ChevronRight className="w-3 h-3 text-white" />
              </button>
            )}
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowRespond(false)}
            className="w-full text-gray-400"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
