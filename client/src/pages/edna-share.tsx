import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface DNAProfile {
  id: string;
  user_id: string;
  label: string;
  tagline: string;
  profile_text: string;
  favorite_genres: string[];
  favorite_media_types: string[];
  favorite_sports: string[];
  flavor_notes: string[];
  users?: {
    user_name: string;
    display_name: string;
  };
}

export default function EdnaSharePage() {
  const [, params] = useRoute("/edna/:id");
  const [, navigate] = useLocation();
  const { session, loading: authLoading } = useAuth();
  const [dnaProfile, setDnaProfile] = useState<DNAProfile | null>(null);
  const [access, setAccess] = useState<"full" | "preview">("preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDNAProfile = async () => {
      if (!params?.id || authLoading) return;

      try {
        setLoading(true);
        setError(null);
        // Get user_id from query parameter or URL path
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user') || params.id;

        console.log('Fetching public DNA for user:', userId);

        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-dna?user_id=${userId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Public DNA fetch failed:', response.status, errorText);
          throw new Error('Failed to fetch DNA profile');
        }

        const data = await response.json();
        console.log('Public DNA data:', data);

        if (data.dna_profile) {
          setDnaProfile(data.dna_profile as DNAProfile);
          setAccess(data.access === "full" ? "full" : "preview");
        } else {
          throw new Error('No DNA profile returned');
        }
      } catch (err) {
        console.error("Error fetching DNA profile:", err);
        setError("DNA Profile not found");
      } finally {
        setLoading(false);
      }
    };

    fetchDNAProfile();
  }, [params?.id, authLoading, session?.access_token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-700 to-purple-500 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" data-testid="loader-edna-share" />
      </div>
    );
  }

  if (error || !dnaProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-700 to-purple-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-error-title">DNA Profile Not Found</h2>
          <p className="text-gray-600 mb-6" data-testid="text-error-message">
            This Entertainment DNA profile doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => window.location.href = '/login'}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="button-go-to-login"
          >
            Go to consumed
          </Button>
        </div>
      </div>
    );
  }

  const userName = dnaProfile.users?.display_name || dnaProfile.users?.user_name || 'Someone';
  const isPreview = access === "preview";
  const handleProfileAction = () => {
    if (session) {
      navigate(`/user/${dnaProfile.user_id}?ref=invite`);
      return;
    }
    localStorage.setItem("consumed_referrer", dnaProfile.user_id);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-purple-500 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2" data-testid="text-page-title">
            {userName}'s Entertainment DNA
          </h1>
          <p className="text-blue-100 text-lg" data-testid="text-page-subtitle">by consumed</p>
        </div>

        {/* Top CTA Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          <div className="text-center">
            <p className="text-white text-lg mb-3" data-testid="text-top-cta">
              {isPreview ? `Connect with ${userName} on consumed to unlock their full Entertainment DNA` : "Try consumed and get your own Entertainment DNA"}
            </p>
            <Button
              onClick={handleProfileAction}
              className="bg-white text-purple-700 hover:bg-gray-100 font-semibold px-8 py-3 text-lg shadow-lg"
              data-testid="button-get-started-top"
            >
              {session ? `View ${userName}'s profile` : "Get Started Free"}
            </Button>
          </div>
        </div>

        {/* DNA Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* DNA Label */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-purple-600 mb-2" data-testid="text-dna-label">
              {dnaProfile.label}
            </h2>
            {dnaProfile.tagline && (
              <p className="text-gray-500 italic text-lg" data-testid="text-dna-tagline">
                {dnaProfile.tagline}
              </p>
            )}
          </div>

          {isPreview ? (
            <div className="border-t border-gray-200 mt-6 pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">A closer look is for friends</h3>
              <p className="text-gray-600 mb-5">
                {session
                  ? `Visit ${userName}'s profile to connect and see their entertainment tastes.`
                  : `Join ${userName} on consumed to see their favorite genres, entertainment style, and full DNA.`}
              </p>
              <Button onClick={handleProfileAction} className="bg-purple-600 hover:bg-purple-700 text-white px-8" data-testid="button-preview-profile-action">
                {session ? `View ${userName}'s profile` : "Log in to connect"}
              </Button>
            </div>
          ) : (
            <>
              <div className="border-t border-gray-200 my-6" />
              <div className="mb-8">
                <p className="text-gray-700 text-lg leading-relaxed" data-testid="text-dna-profile">
                  {dnaProfile.profile_text}
                </p>
              </div>

          {dnaProfile.favorite_genres && dnaProfile.favorite_genres.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3" data-testid="text-section-genres">Favorite Genres</h3>
              <div className="flex flex-wrap gap-2">
                {dnaProfile.favorite_genres.map((genre, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                    data-testid={`badge-genre-${index}`}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Favorite Media Types */}
          {dnaProfile.favorite_media_types && dnaProfile.favorite_media_types.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3" data-testid="text-section-media-types">Favorite Media Types</h3>
              <div className="flex flex-wrap gap-2">
                {dnaProfile.favorite_media_types.map((type, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                    data-testid={`badge-media-type-${index}`}
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Favorite Sports */}
          {dnaProfile.favorite_sports && dnaProfile.favorite_sports.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3" data-testid="text-section-sports">Favorite Sports</h3>
              <div className="flex flex-wrap gap-2">
                {dnaProfile.favorite_sports.map((sport, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                    data-testid={`badge-sport-${index}`}
                  >
                    {sport}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Flavor Notes */}
          {dnaProfile.flavor_notes && dnaProfile.flavor_notes.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3" data-testid="text-section-style">Entertainment Style</h3>
              <div className="flex flex-wrap gap-2">
                {dnaProfile.flavor_notes.map((note, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                    data-testid={`badge-style-${index}`}
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}
            </>
          )}

          {/* CTA */}
          <div className="pt-6 border-t border-gray-200 text-center">
            <p className="text-gray-600 mb-4" data-testid="text-cta-message">
              Discover your own Entertainment DNA
            </p>
            <Button
              onClick={handleProfileAction}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8"
              data-testid="button-discover-yours"
            >
              {session ? `View ${userName}'s profile` : "Get Started on consumed"}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-blue-100 text-sm" data-testid="text-footer">
            consumedapp.com
          </p>
        </div>
      </div>
    </div>
  );
}
