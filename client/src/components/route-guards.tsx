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
  const [dnaChecked, setDnaChecked] = useState(false); // Prevent loop

  useEffect(() => {
    if (!loading && !user) {
      // Capture full URL including hash fragment for redirect after login
      const fullPath = window.location.pathname + window.location.hash;
      if (fullPath !== '/login') {
        sessionStorage.setItem('returnUrl', fullPath);
      }
      setLocation('/login');
    }
  }, [user, loading, setLocation]);

  // Check if user has completed DNA survey (skip check on onboarding page)
  useEffect(() => {
    const checkDNAProfile = async () => {
      // Don't check again if already checked
      if (dnaChecked) {
        setCheckingDNA(false);
        return;
      }

      if (!user || !session) {
        setCheckingDNA(false);
        return;
      }

      // Skip check if already on onboarding page
      if (location === '/onboarding') {
        setCheckingDNA(false);
        setDnaChecked(true);
        return;
      }

      try {
        // Use supabase client instead of fetch to avoid auth issues
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('dna_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('DNA check error:', error);
          // On error, allow user through
        } else if (!data) {
          console.log('🎯 No DNA profile found, redirecting to onboarding');
          setLocation('/onboarding');
        } else {
          console.log('✅ DNA profile exists, user can proceed');
        }
      } catch (error) {
        console.error('Error checking DNA profile:', error);
        // On error, allow user through
      } finally {
        setCheckingDNA(false);
        setDnaChecked(true); // Mark as checked
      }
    };

    checkDNAProfile();
  }, [user, session, location]);

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
