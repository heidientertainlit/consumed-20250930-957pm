import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

interface RouteGuardProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { user, loading, session } = useAuth();
  const [location, setLocation] = useLocation();
  const [checkingDNA, setCheckingDNA] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  // Check if user has completed DNA survey (skip check on onboarding page)
  useEffect(() => {
    const checkDNAProfile = async () => {
      if (!user || !session) {
        setCheckingDNA(false);
        return;
      }

      // Skip check if already on onboarding page
      if (location === '/onboarding') {
        setCheckingDNA(false);
        return;
      }

      try {
        const response = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/rest/v1/users?select=dna_profile_title&id=eq.${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MDA1NDMsImV4cCI6MjA1MDk3NjU0M30.AEnCfg4VgwPmhTOK-K2gIOcY7y-l-KJdnvBPdC3WcYM',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          // Redirect to onboarding if DNA profile is not set
          if (data.length > 0 && !data[0].dna_profile_title) {
            console.log('No DNA profile found, redirecting to onboarding');
            setLocation('/onboarding');
          }
        }
      } catch (error) {
        console.error('Error checking DNA profile:', error);
      } finally {
        setCheckingDNA(false);
      }
    };

    checkDNAProfile();
  }, [user, session, location, setLocation]);

  if (loading || !user || checkingDNA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">{loading ? "Loading..." : "Redirecting..."}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation('/feed');
    }
  }, [user, loading, setLocation]);

  if (loading || user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">{loading ? "Loading..." : "Redirecting..."}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
