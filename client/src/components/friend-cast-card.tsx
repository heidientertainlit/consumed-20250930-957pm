import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";
import { Search, Users, Loader2, ChevronLeft, ChevronRight, MessageSquare, Swords } from "lucide-react";
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
    <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600">
            <Link href={`/profile/${cast.creator.user_name}`}>
              <span className="font-semibold text-gray-900 hover:underline cursor-pointer">@{cast.creator.user_name}</span>
            </Link>
            {' '}says...
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-3">
          <img 
            src={cast.creator_pick_celeb_image} 
            alt={cast.creator_pick_celeb_name}
            className="w-14 h-18 rounded-lg object-cover"
          />
          <div>
            <p className="text-amber-600 font-bold">{cast.creator_pick_celeb_name}</p>
            <p className="text-xs text-gray-500">would play</p>
            <p className="text-gray-900 font-semibold">{targetName}</p>
          </div>
        </div>
      </div>

      {cast.responses.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Swords className="w-3 h-3" /> {cast.responses.length} argued with different picks:
          </p>
          <div className="flex flex-wrap gap-2">
            {cast.responses.slice(0, 4).map((resp) => (
              <div key={resp.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
                {resp.celeb_image ? (
                  <img 
                    src={resp.celeb_image} 
                    alt={resp.celeb_name}
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-gray-300 flex items-center justify-center">
                    <span className="text-[10px] text-white">{resp.celeb_name.charAt(0)}</span>
                  </div>
                )}
                <div className="text-[10px]">
                  <span className="font-medium text-gray-900">{resp.celeb_name}</span>
                  <span className="text-gray-400"> by @{resp.responder.user_name}</span>
                </div>
              </div>
            ))}
            {cast.responses.length > 4 && (
              <div className="flex items-center px-2 py-1 text-xs text-gray-400">
                +{cast.responses.length - 4} more
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
          className="w-full border-amber-200 text-amber-600 hover:bg-amber-50"
          size="sm"
        >
          <Swords className="w-4 h-4 mr-2" />
          Argue This Pick
        </Button>
      )}

      {hasResponded && (
        <p className="text-center text-xs text-gray-400">You've added your pick</p>
      )}

      {!session && (
        <Link href="/login">
          <Button variant="outline" className="w-full border-amber-200 text-amber-600" size="sm">
            Sign in to argue this pick
          </Button>
        </Link>
      )}

      {showRespond && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          <p className="text-sm font-medium text-gray-700">Who would YOU cast as {targetName}?</p>
          
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
              className="pl-10 text-sm"
            />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />}
          </div>

          <div className="relative">
            {celebScrollIndex > 0 && (
              <button
                onClick={() => setCelebScrollIndex(Math.max(0, celebScrollIndex - 4))}
                className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"
              >
                <ChevronLeft className="w-3 h-3 text-gray-600" />
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
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <p className="text-[9px] text-white truncate">{celeb.name}</p>
                  </div>
                </button>
              ))}
            </div>

            {celebScrollIndex + 4 < celebrities.length && (
              <button
                onClick={() => setCelebScrollIndex(Math.min(celebrities.length - 4, celebScrollIndex + 4))}
                className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"
              >
                <ChevronRight className="w-3 h-3 text-gray-600" />
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
    </Card>
  );
}
