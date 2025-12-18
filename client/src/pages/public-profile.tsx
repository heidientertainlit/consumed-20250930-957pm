import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Trophy, TrendingUp, BookOpen, Tv, Film, Music, Headphones, Gamepad2, Lock } from "lucide-react";

interface PublicProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_points: number;
  items_logged: number;
  global_rank: number | null;
  mostly_into: string[];
  currently_consuming: Array<{
    title: string;
    image_url: string | null;
    media_type: string;
  }>;
  dna_label: string | null;
  dna_tagline: string | null;
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate(`/user/${userId}`);
    }
  }, [user, authLoading, userId, navigate]);

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-profile?user_id=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      return response.json();
    },
    enabled: !!userId && !user,
  });

  const handleJoin = () => {
    if (userId) {
      localStorage.setItem('consumed_referrer', userId);
    }
    navigate('/login');
  };

  const displayName = profile?.display_name || profile?.username || 'User';
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  const getMediaIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'book': return <BookOpen size={12} className="text-amber-500" />;
      case 'tv': return <Tv size={12} className="text-indigo-500" />;
      case 'movie': return <Film size={12} className="text-red-500" />;
      case 'music': return <Music size={12} className="text-pink-500" />;
      case 'podcast': return <Headphones size={12} className="text-violet-500" />;
      case 'game': return <Gamepad2 size={12} className="text-emerald-500" />;
      default: return <Star size={12} className="text-gray-400" />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Redirecting to full profile...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">This profile doesn't exist or is private.</p>
          <Button onClick={() => navigate('/login')} className="bg-purple-600 hover:bg-purple-700">
            Join consumed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{displayName}'s Profile | consumed</title>
        <meta name="description" content={`See what ${displayName} is watching, reading, and listening to on consumed`} />
        <meta property="og:title" content={`${displayName}'s Profile | consumed`} />
        <meta property="og:description" content={`See what ${displayName} is watching, reading, and listening to`} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={`${appUrl}/u/${userId}`} />
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-b from-purple-600 to-purple-800 text-white">
          <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                consumed
              </h1>
              <p className="text-purple-200 text-sm">Everyone's entertainment picks, all in one place</p>
            </div>
            
            <div className="flex items-center justify-center mb-4">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={displayName}
                  className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg bg-purple-400 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {displayName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-center">{displayName}</h2>
            <p className="text-purple-200 text-center">@{profile.username}</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 -mt-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div>
                <div className="flex items-center justify-center gap-1 text-purple-600 font-bold text-xl">
                  <Star size={16} />
                  {profile.total_points?.toLocaleString() || 0}
                </div>
                <p className="text-gray-500 text-xs">points</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-purple-600 font-bold text-xl">
                  <Trophy size={16} />
                  #{profile.global_rank || '—'}
                </div>
                <p className="text-gray-500 text-xs">global rank</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-purple-600 font-bold text-xl">
                  <TrendingUp size={16} />
                  {profile.items_logged || 0}
                </div>
                <p className="text-gray-500 text-xs">items logged</p>
              </div>
            </div>

            {profile.mostly_into && profile.mostly_into.length > 0 && (
              <div className="text-center mb-6">
                <p className="text-gray-500 text-sm">
                  Mostly into: <span className="font-medium text-gray-900">{profile.mostly_into.join(', ')}</span>
                </p>
              </div>
            )}

            {profile.currently_consuming && profile.currently_consuming.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {displayName} is currently consuming...
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {profile.currently_consuming.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex-shrink-0 w-16">
                      <div className="relative">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.title}
                            className="w-16 h-24 rounded-lg object-cover shadow-sm"
                          />
                        ) : (
                          <div className="w-16 h-24 rounded-lg bg-gray-200 flex items-center justify-center">
                            {getMediaIcon(item.media_type)}
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5 shadow">
                          {getMediaIcon(item.media_type)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.dna_label && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-medium text-purple-700 mb-1">Entertainment DNA</h3>
                <p className="font-bold text-purple-900">{profile.dna_label}</p>
                {profile.dna_tagline && (
                  <p className="text-sm text-purple-600 italic">{profile.dna_tagline}</p>
                )}
              </div>
            )}
          </div>

          <div className="relative mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 blur-sm">
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="flex gap-2">
                  <div className="h-20 w-16 bg-gray-200 rounded"></div>
                  <div className="h-20 w-16 bg-gray-200 rounded"></div>
                  <div className="h-20 w-16 bg-gray-200 rounded"></div>
                  <div className="h-20 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-xs">
                <Lock className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-2">See More</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Join consumed to see {displayName}'s full profile, lists, reviews, and activity
                </p>
                <Button 
                  onClick={handleJoin}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  data-testid="button-join-see-more"
                >
                  Join consumed - It's Free
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-6 text-white text-center mb-8">
            <h3 className="text-xl font-bold mb-2">Track your entertainment</h3>
            <p className="text-purple-100 text-sm mb-4">
              See what friends are watching, get your Entertainment DNA, and discover what to consume next
            </p>
            <Button 
              onClick={handleJoin}
              className="bg-white text-purple-700 hover:bg-gray-100 font-semibold px-8"
              data-testid="button-get-started"
            >
              Get Started Free
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
