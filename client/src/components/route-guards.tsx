import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hasConfirmedProfileIdentity } from "@/lib/profile-identity";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  loadOnboardingProgress,
  saveOnboardingProgress,
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  resetOnboardingState,
  resolveOnboardingResumeStep,
  type OnboardingResumeStep,
  type OnboardingProgress,
} from "@/lib/onboarding-progress";

export {
  isOnboardingComplete,
  markOnboardingComplete,
  loadOnboardingProgress,
  saveOnboardingProgress,
  dismissOnboardingPrompt,
  isOnboardingPromptDismissed,
  resetOnboardingState,
  resolveOnboardingResumeStep,
};
export type { OnboardingResumeStep, OnboardingProgress };

interface RouteGuardProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    if (!loading && !user) {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      if (fullPath !== '/login') {
        sessionStorage.setItem('returnUrl', fullPath);
      }
      setLocation('/login');
      return;
    }

    if (!loading && user) {
      if (location.startsWith("/onboarding")) {
        setReady(true);
        return;
      }

      void Promise.all([
        supabase
          .from("users")
          .select("identity_confirmed_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("dna_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]).then(([identityResult, dnaResult]) => {
          if (cancelled) return;
          if (hasConfirmedProfileIdentity(identityResult.data) || dnaResult.data) {
            setReady(true);
          } else {
            setLocation("/onboarding");
          }
        });
    }
    return () => { cancelled = true; };
  }, [user, loading, location, setLocation]);

  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function IdentityAwareRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (loading) {
      setReady(false);
      return;
    }
    if (!user) {
      setReady(true);
      return;
    }
    if (location.startsWith("/onboarding")) {
      setReady(true);
      return;
    }

    setReady(false);
    void Promise.all([
      supabase.from("users").select("identity_confirmed_at").eq("id", user.id).maybeSingle(),
      supabase.from("dna_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]).then(([identityResult, dnaResult]) => {
      if (cancelled) return;
      if (hasConfirmedProfileIdentity(identityResult.data) || dnaResult.data) {
        setReady(true);
      } else {
        setLocation("/onboarding");
      }
    });
    return () => { cancelled = true; };
  }, [user, loading, location, setLocation]);

  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const redirectAuthenticatedUser = async () => {
      const [identityResult, dnaResult] = await Promise.all([
        supabase.from("users").select("identity_confirmed_at").eq("id", user.id).maybeSingle(),
        supabase.from("dna_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;

      const dnaProfile = dnaResult.data;
      if (dnaProfile) markOnboardingComplete(user.id);
      const hasIdentity = hasConfirmedProfileIdentity(identityResult.data);
      const shouldOnboard = !dnaProfile && !hasIdentity;

      if (shouldOnboard) {
        sessionStorage.removeItem("returnUrl");
        setLocation("/onboarding");
        return;
      }

      const returnUrl = sessionStorage.getItem("returnUrl");
      if (returnUrl) {
        sessionStorage.removeItem("returnUrl");
        setLocation(returnUrl);
      } else {
        setLocation("/activity");
      }
    };

    void redirectAuthenticatedUser();
    return () => { cancelled = true; };
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
