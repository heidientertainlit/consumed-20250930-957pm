import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Helmet } from "react-helmet";
import { Loader2 } from "lucide-react";

export default function InvitePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['invite-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile?.id) {
      const timer = setTimeout(() => {
        navigate(`/user/${profile.id}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [profile?.id, navigate]);

  const displayName = profile?.display_name || profile?.username || 'A friend';
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  return (
    <>
      <Helmet>
        <title>{displayName} invited you to consumed</title>
        <meta name="description" content="I want to see what you're watching, reading, and listening to" />
        <meta property="og:title" content={`${displayName} invited you to consumed`} />
        <meta property="og:description" content="I want to see what you're watching, reading, and listening to" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${appUrl}/invite/${userId}`} />
        <meta property="og:image" content={`${appUrl}/og-invite.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${displayName} invited you to consumed`} />
        <meta name="twitter:description" content="I want to see what you're watching, reading, and listening to" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center px-6">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              consumed
            </h1>
            <p className="text-purple-300 text-lg">
              Track what you're watching, reading, and listening to
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading invitation...</span>
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 max-w-sm mx-auto">
              <p className="text-white text-lg mb-2">
                <span className="font-semibold text-purple-400">{displayName}</span> wants to see what you're watching, reading, and listening to
              </p>
              <p className="text-gray-400 text-sm mb-4">
                Redirecting you to their profile...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
