import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Share2, Loader2, Download, Sparkles } from "lucide-react";

interface CastData {
  id: string;
  creator_pick_celeb_name: string;
  creator_pick_celeb_image: string;
  target_friend_name?: string;
  status: string;
  counter_celeb_name?: string;
  counter_celeb_image?: string;
  creator?: {
    id: string;
    user_name: string;
    avatar_url?: string;
  };
  target?: {
    id: string;
    user_name: string;
    avatar_url?: string;
  };
}

export default function CastSharePage() {
  const { token } = useParams<{ token: string }>();
  const [cast, setCast] = useState<CastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    const loadCast = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/get-cast-by-token?token=${token}`
        );
        
        if (!response.ok) {
          setError("This casting link is invalid or expired");
          return;
        }
        
        const data = await response.json();
        setCast(data.cast);
      } catch (err) {
        setError("Failed to load casting");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCast();
  }, [token, supabaseUrl]);

  const shareLink = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cast Your Friends - Consumed',
          text: `Check out this celebrity casting on Consumed!`,
          url,
        });
      } catch (err) {
        navigator.clipboard.writeText(url);
      }
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !cast) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="p-6 bg-gray-800/50 border-gray-700 text-center">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Casting Not Found</h1>
            <p className="text-gray-400 mb-4">{error || "This casting doesn't exist"}</p>
            <Link href="/">
              <Button className="bg-purple-600 hover:bg-purple-700">
                Go to Consumed
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const targetName = cast.target?.user_name || cast.target_friend_name || "their friend";
  const creatorName = cast.creator?.user_name || "Someone";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4">
      <div className="max-w-md mx-auto pt-8">
        <Card className="overflow-hidden bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-500/30">
          <div className="p-6">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Users className="w-6 h-6 text-amber-400" />
              <span className="text-amber-400 font-bold text-lg">Cast Your Friends</span>
            </div>

            <div className="text-center mb-6">
              <p className="text-xl text-white font-semibold mb-2">
                {creatorName} cast you as...
              </p>
              
              <div className="relative inline-block mb-4">
                <img 
                  src={cast.creator_pick_celeb_image || '/placeholder-avatar.png'} 
                  alt={cast.creator_pick_celeb_name}
                  className="w-36 h-44 rounded-xl object-cover mx-auto shadow-2xl border-2 border-amber-400/50"
                />
                {cast.status === 'approved' && (
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Approved!
                  </div>
                )}
                {cast.status === 'counter' && (
                  <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                    Counter!
                  </div>
                )}
              </div>
              
              <p className="text-3xl font-bold text-amber-300 mb-3">
                {cast.creator_pick_celeb_name}
              </p>
              
              <p className="text-gray-300 text-lg">
                in a movie! 🎬
              </p>
            </div>

            {cast.status === 'counter' && cast.counter_celeb_name && (
              <div className="bg-purple-600/20 rounded-lg p-4 mb-4">
                <p className="text-purple-300 text-sm mb-2">But {targetName} thinks...</p>
                <div className="flex items-center gap-3">
                  <img 
                    src={cast.counter_celeb_image || '/placeholder-avatar.png'}
                    alt={cast.counter_celeb_name}
                    className="w-16 h-20 rounded-lg object-cover"
                  />
                  <p className="text-white font-semibold text-lg">{cast.counter_celeb_name}</p>
                </div>
                <p className="text-purple-300 text-sm mt-2">would be a better fit!</p>
              </div>
            )}

            {cast.status === 'approved' && (
              <div className="bg-green-600/20 rounded-lg p-4 text-center mb-4">
                <p className="text-green-300">
                  {targetName} approved this casting! 🎬
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={shareLink}
                className="w-full bg-amber-600 hover:bg-amber-700 py-3"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share This
              </Button>
              
              <div className="bg-purple-600/30 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-purple-300" />
                  <span className="text-purple-200 font-semibold">Want to cast your friends?</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Find your Entertainment DNA and play games with friends on Consumed!
                </p>
                <Link href="/">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    <Users className="w-4 h-4 mr-2" /> Cast Your Friends Too
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <p className="text-center text-gray-500 text-sm mt-6">
          <span className="text-purple-400 font-semibold">Consumed</span> - Where Fans Come to Play
        </p>
      </div>
    </div>
  );
}
