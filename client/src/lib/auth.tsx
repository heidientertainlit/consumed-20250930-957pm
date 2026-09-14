import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { sessionTracker } from './sessionTracker'
import {
  identifyUser,
  resetUser,
  setPostHogCaptureAllowed,
  trackEvent,
} from './posthog'
import { Capacitor } from "@capacitor/core"
import OneSignal from "onesignal-cordova-plugin"
import { rememberLastLoginMethod, rememberLastLoginMethodFromUser } from "./last-login-method"
import {
  acceptCurrentLegalTerms,
  clearOAuthTermsConsentAttempt,
  beginOAuthTermsConsentAttempt,
  clearLocallyAcceptedLegalTerms,
  beginLegalTermsAcceptanceAttempt,
  finishLegalTermsAcceptanceAttempt,
  noteAuthSignIn,
  clearAuthSignInNote,
} from "./legal-terms-consent"
import { isRecoveryAuthCallback } from "./auth-flow"
import { createProviderIdentityTransition } from "./provider-identity-transition"

type OAuthProvider = 'apple' | 'google'
type AuthConsentOptions = { termsAccepted?: boolean }

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string, options?: AuthConsentOptions) => Promise<{ error: any }>
  signUp: (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; username?: string },
    options?: AuthConsentOptions,
  ) => Promise<{ error: any; data?: any }>
  signOut: () => Promise<{ error: any }>
  signInWithOAuth: (provider: OAuthProvider, options?: AuthConsentOptions) => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ error: any }>
  updatePassword: (newPassword: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const requestPushPermissionIfNative = async () => {
    const platform = Capacitor.getPlatform()
    if (platform !== "ios" && platform !== "android") return

    try {
      await new Promise((r) => setTimeout(r, 800))
      await OneSignal.Notifications.requestPermission(false)
    } catch (e) {
      console.log("Push permission request failed:", e)
    }
  }

  type AccountState = "live" | "missing" | "unknown";

  // public.users is the authoritative first-party account existence check.
  // Retry a just-created profile briefly so the signup -> complete-profile
  // flow and native onboarding are not mistaken for a deleted account.
  const currentAccountState = async (userId: string): Promise<AccountState> => {
    const delays = [0, 150, 350, 700, 1200];
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data?.id === userId) return "live";
      if (error && delay === delays[delays.length - 1]) return "unknown";
    }
    return "missing";
  };

  let providerSetupUserId: string | null = null;
  let providerSetupGeneration = 0;
  let observedAuthUserId: string | null = null;
  const isNativePlatform = () => {
    const platform = Capacitor.getPlatform()
    return platform === "ios" || platform === "android"
  };
  const oneSignalIdentity = createProviderIdentityTransition({
    getCurrentUserId: () => observedAuthUserId,
    login: (userId) => {
      if (!isNativePlatform()) return;
      return OneSignal.login(userId);
    },
    logout: () => {
      if (!isNativePlatform()) return;
      return OneSignal.logout();
    },
  });

  // Auth can switch directly from one signed-in account to another without
  // emitting SIGNED_OUT first. Invalidate the old identity synchronously,
  // then serialize native logout transitions before allowing a new login.
  const reconcileAuthIdentity = (nextUserId: string | null) => {
    if (observedAuthUserId === nextUserId) {
      return oneSignalIdentity.transitionTo(nextUserId).completion;
    }

    observedAuthUserId = nextUserId;
    providerSetupGeneration += 1;
    providerSetupUserId = null;
    resetUser();
    setPostHogCaptureAllowed(false);
    sessionTracker.endSession();

    return oneSignalIdentity.transitionTo(nextUserId).completion;
  };

  const prepareProviderIdentity = async (authUser: User) => {
    const generation = providerSetupGeneration;
    const state = await currentAccountState(authUser.id);
    if (generation !== providerSetupGeneration) return false;
    if (state !== "live") {
      // Do not identify, track, request push permission, or log into
      // OneSignal when the UUID is stale or account status is unavailable.
      setPostHogCaptureAllowed(false);
      if (state === "missing") {
        await oneSignalIdentity.logout();
      }
      return false;
    }

    if (providerSetupUserId === authUser.id) return true;
    providerSetupUserId = authUser.id;
    setPostHogCaptureAllowed(true);
    rememberLastLoginMethodFromUser(authUser);
    sessionTracker.startSession(authUser.id);

    const { data: profile } = await supabase
      .rpc('get_my_account_profile')
      .select('user_name, display_name')
      .maybeSingle();
    if (generation !== providerSetupGeneration) return false;
    identifyUser(authUser.id, {
      email: authUser.email,
      name: profile?.display_name || profile?.user_name || authUser.email,
      username: profile?.user_name,
    });

    await requestPushPermissionIfNative();
    if (generation !== providerSetupGeneration) return false;
    return await oneSignalIdentity.login(authUser.id);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user?.id) {
        await reconcileAuthIdentity(session.user.id)
        const isRecoveryFlow = isRecoveryAuthCallback(window.location.pathname)
        if (!isRecoveryFlow) {
          await prepareProviderIdentity(session.user)
        }
      } else {
        // Reset any persisted account identity before allowing anonymous
        // capture. This prevents a signed-out deleted UUID from being reused.
        await oneSignalIdentity.logout()
        resetUser()
        setPostHogCaptureAllowed(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session ? 'Session active' : 'No session')
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        await reconcileAuthIdentity(session?.user?.id ?? null)

        if (event === 'SIGNED_IN' && session?.user?.id) {
          const isRecoveryFlow = isRecoveryAuthCallback(window.location.pathname)
          if (isRecoveryFlow) {
            clearOAuthTermsConsentAttempt()
            clearAuthSignInNote()
          } else {
            const isLive = await prepareProviderIdentity(session.user);
            if (isLive) {
              noteAuthSignIn(session.user.id)
              trackEvent('user_signed_in')
            }
          }

        } else if (event === 'PASSWORD_RECOVERY') {
          isRecoveryAuthCallback(window.location.pathname)
          clearOAuthTermsConsentAttempt()
          clearAuthSignInNote()
          // Recovery session established — do nothing here. The reset-password page
          // handles everything. Push permission will be requested after normal login.

        } else if (event === 'SIGNED_OUT') {
          clearOAuthTermsConsentAttempt()
          clearLocallyAcceptedLegalTerms()
          clearAuthSignInNote()
          await oneSignalIdentity.logout()
          sessionTracker.endSession()
          providerSetupUserId = null
          resetUser()
          setPostHogCaptureAllowed(true)
          trackEvent('user_signed_out')
        }
      }
    )

    const handleProfileReady = () => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && !isRecoveryAuthCallback(window.location.pathname)) {
          void prepareProviderIdentity(session.user);
        }
      });
    };
    window.addEventListener("consumed:profile-ready", handleProfileReady);

    return () => {
      subscription.unsubscribe()
      window.removeEventListener("consumed:profile-ready", handleProfileReady)
      sessionTracker.endSession()
    }
  }, [])

  const signIn = async (
    email: string,
    password: string,
    options: AuthConsentOptions = {},
  ) => {
    clearOAuthTermsConsentAttempt()
    if (!options.termsAccepted) {
      return {
        error: new Error("Please review and agree to the Terms of Service before signing in."),
      }
    }

    beginLegalTermsAcceptanceAttempt()
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (!error) {
        rememberLastLoginMethod('email')
        const { error: acceptanceError } = await acceptCurrentLegalTerms(data.user?.id)
        if (acceptanceError) {
          await supabase.auth.signOut()
          return { error: acceptanceError }
        }
      }
      return { error }
    } finally {
      finishLegalTermsAcceptanceAttempt()
    }
  }

  const signUp = async (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; username?: string },
    options: AuthConsentOptions = {},
  ) => {
    clearOAuthTermsConsentAttempt()
    if (!options.termsAccepted) {
      return {
        error: new Error("Please review and agree to the Terms of Service before signing up."),
        data: undefined,
      }
    }

    beginLegalTermsAcceptanceAttempt()
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata?.firstName || '',
            last_name: metadata?.lastName || '',
            user_name: metadata?.username?.trim().toLowerCase() || email.split('@')[0].toLowerCase(),
          }
        }
      })
      if (!error && data.session) {
        const { error: acceptanceError } = await acceptCurrentLegalTerms(data.user?.id)
        if (acceptanceError) {
          await supabase.auth.signOut()
          return { error: acceptanceError, data }
        }
      }
      return { error, data }
    } finally {
      finishLegalTermsAcceptanceAttempt()
    }
  }

  const signOut = async () => {
    clearOAuthTermsConsentAttempt()
    clearLocallyAcceptedLegalTerms()
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const signInWithOAuth = async (
    provider: OAuthProvider,
    options: AuthConsentOptions = {},
  ) => {
    clearOAuthTermsConsentAttempt()
    if (!options.termsAccepted) {
      return {
        error: new Error("Please review and agree to the Terms of Service before signing in."),
      }
    }

    // Browser sign-in must return to the exact current origin so previews and
    // production work without separate code paths. Native uses the published
    // app URL, which is handled by CapacitorDeepLinkHandler.
    const appUrl = (import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com').replace(/\/$/, '')
    const redirectOrigin = Capacitor.isNativePlatform() ? appUrl : window.location.origin
    const redirectTo = `${redirectOrigin}/login`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (!error) beginOAuthTermsConsentAttempt(provider)
    return { error }
  }

  const resetPassword = async (email: string) => {
    // IMPORTANT: Never use window.location.origin as fallback here.
    // On iOS Capacitor the origin is 'https://localhost', which Supabase
    // rejects as an unauthorized redirect URL and silently falls back to
    // the Site URL (https://app.consumedapp.com), stripping the /reset-password path.
    // Always resolve to the known production URL.
    const appUrl = (import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com').replace(/\/$/, '');
    const redirectTo = `${appUrl}/reset-password`;
    console.log("[RESET-DEBUG] resetPassword: redirectTo =", redirectTo);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    return { error }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
        signInWithOAuth,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}