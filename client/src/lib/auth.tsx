import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { SUPABASE_URL, supabase } from './supabase'
import { sessionTracker } from './sessionTracker'
import {
  identifyUser,
  resetUser,
  setPostHogCaptureAllowed,
  trackEvent,
} from './posthog'
import { Capacitor } from "@capacitor/core"
import { Browser } from "@capacitor/browser"
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
  clearMatchingOAuthTermsConsentAttempt,
  consumeNativeOAuthBrowserCancellation,
  markNativeOAuthBrowserAttempt,
  notifyNativeOAuthBrowserOutcome,
} from "./legal-terms-consent"
import {
  createAuthWorkGenerationGuard,
  isRecoveryAuthCallback,
  isSessionEstablishingAuthEvent,
  resolveInitialAuthStartup,
  shouldApplyAuthStateEvent,
  shouldInvalidateAuthWorkForEvent,
  withAuthStateRequestDeadline,
} from "./auth-flow"
import { isTrustedNativeOAuthAuthorizationUrl } from "./native-oauth"
import { createProviderIdentityTransition } from "./provider-identity-transition"
import { createOneSignalIdentityAdapter } from "./onesignal-identity"

type OAuthProvider = 'apple' | 'google'
type AuthConsentOptions = { termsAccepted?: boolean }

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  startupError: string | null
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
  retryStartup: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [startupAttempt, setStartupAttempt] = useState(0)
  const authWorkGeneration = useRef(createAuthWorkGenerationGuard());

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
  const oneSignalNativeAdapter = createOneSignalIdentityAdapter();
  const isNativePlatform = () => {
    const platform = Capacitor.getPlatform()
    return platform === "ios" || platform === "android"
  };
  const oneSignalIdentity = createProviderIdentityTransition({
    getCurrentUserId: () => observedAuthUserId,
    login: (userId) => {
      if (!isNativePlatform()) return;
      return oneSignalNativeAdapter.login(
        userId,
        () => observedAuthUserId === userId,
      );
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
    // Do not let a queued SIGNED_IN handler prepare an account that was
    // replaced before its background work began.
    if (observedAuthUserId !== authUser.id) return false;
    const generation = providerSetupGeneration;
    const state = await currentAccountState(authUser.id);
    if (
      generation !== providerSetupGeneration
      || observedAuthUserId !== authUser.id
    ) return false;
    if (state !== "live") {
      // Do not identify, track, request push permission, or log into
      // OneSignal when the UUID is stale or account status is unavailable.
      // A later successful check must restore capture and identity rather
      // than taking the already-prepared shortcut while still opted out.
      providerSetupUserId = null;
      setPostHogCaptureAllowed(false);
      if (state === "missing") {
        await oneSignalIdentity.logout();
      }
      return false;
    }

    if (providerSetupUserId === authUser.id) return true;
    providerSetupUserId = authUser.id;
    setPostHogCaptureAllowed(true, authUser.id);
    rememberLastLoginMethodFromUser(authUser);
    sessionTracker.startSession(authUser.id);

    const { data: profile } = await supabase
      .rpc('get_my_account_profile')
      .select('user_name, display_name')
      .maybeSingle();
    if (
      generation !== providerSetupGeneration
      || observedAuthUserId !== authUser.id
    ) return false;
    identifyUser(authUser.id, {
      email: authUser.email,
      name: profile?.display_name || profile?.user_name || authUser.email,
      username: profile?.user_name,
    });

    await requestPushPermissionIfNative();
    if (
      generation !== providerSetupGeneration
      || observedAuthUserId !== authUser.id
    ) return false;
    return await oneSignalIdentity.login(authUser.id);
  };

  useEffect(() => {
    oneSignalNativeAdapter.installJwtInvalidationHandler(
      (externalId) => observedAuthUserId === externalId,
    );

    let browserFinishedListener: { remove: () => Promise<void> } | undefined;
    let disposed = false;
    if (isNativePlatform()) {
      void Browser.addListener("browserFinished", () => {
        if (consumeNativeOAuthBrowserCancellation()) {
          notifyNativeOAuthBrowserOutcome("Sign-in was cancelled. Please try again.");
        }
      }).then((listener) => {
        if (disposed) {
          void listener.remove();
        } else {
          browserFinishedListener = listener;
        }
      }).catch(() => {
        // Opening the browser will surface an explicit error to its caller.
      });
    }

    // Get the initial session with a deadline so the auth UI cannot remain in
    // its loading state if browser storage or the auth transport stalls.
    const initialGeneration = authWorkGeneration.current.begin();
    void (async () => {
      try {
        const startup = await resolveInitialAuthStartup(
          () => supabase.auth.getSession(),
          () => supabase.auth.signOut(),
        );
        if (!authWorkGeneration.current.isCurrent(initialGeneration)) return;
        if (startup.kind === "blocked") {
          setStartupError(
            "We couldn't verify or safely clear your account session. Check your connection and try again.",
          )
          setLoading(false)
          return
        }
        const session = startup.kind === "resolved" ? startup.session : null;

        // Snapshot before awaiting identity work: this consumes a recovery
        // marker only while processing the session it was created for.
        const isRecoveryFlow = session?.user?.id
          ? isRecoveryAuthCallback(window.location.pathname)
          : false;
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setStartupError(null)

        const establishesInitialSession = isSessionEstablishingAuthEvent(
          "INITIAL_SESSION",
          !!session?.user?.id,
        )
        if (establishesInitialSession && session?.user?.id) {
          if (!isRecoveryFlow) {
            // INITIAL_SESSION is handled by this canonical startup read rather
            // than its duplicate SDK event, so native OAuth still receives
            // synchronous account correlation before the terms gate runs.
            noteAuthSignIn(session.user.id)
          }
          const transition = reconcileAuthIdentity(session.user.id)
          await transition
          if (!authWorkGeneration.current.isCurrent(initialGeneration)) return;
          if (!isRecoveryFlow) {
            await prepareProviderIdentity(session.user)
          }
        } else {
          // Reset any persisted account identity before allowing anonymous
          // capture. This prevents a signed-out deleted UUID from being reused.
          await oneSignalIdentity.logout()
          if (!authWorkGeneration.current.isCurrent(initialGeneration)) return;
          resetUser()
          setPostHogCaptureAllowed(true, null)
        }
      } catch (error) {
        if (!authWorkGeneration.current.isCurrent(initialGeneration)) return;
        console.error("[auth initial session]", error);
        setStartupError(
          "We couldn't verify or safely clear your account session. Check your connection and try again.",
        )
        setLoading(false)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Supabase emits INITIAL_SESSION as a reflection of getSession().
        // The bounded canonical startup resolver above is the only source
        // allowed to certify its null/non-null result. In particular, a null
        // event after an SDK read error cannot erase blocked fail-closed UI.
        if (!shouldApplyAuthStateEvent(event)) return;
        const eventGeneration = shouldInvalidateAuthWorkForEvent(event)
          ? authWorkGeneration.current.begin()
          : authWorkGeneration.current.current();
        const establishesSession = isSessionEstablishingAuthEvent(
          event,
          !!session?.user?.id,
        );
        // Read the recovery marker before yielding. The marker is one-use, so
        // a later event must not be able to consume this event's classification.
        const isRecoveryFlow = event === "PASSWORD_RECOVERY"
          ? isRecoveryAuthCallback(window.location.pathname)
          : establishesSession
            ? isRecoveryAuthCallback(window.location.pathname)
            : false;
        console.log('🔐 Auth event:', event, session ? 'Session active' : 'No session')
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setStartupError(null)

        // Supabase holds its auth lock until this callback returns. Keep this
        // callback synchronous: profile/account queries and provider work must
        // run after the lock has been released.
        const identityTransition = reconcileAuthIdentity(session?.user?.id ?? null)
        if (establishesSession && session?.user?.id && !isRecoveryFlow) {
          // The gate needs the callback account before React can inspect the
          // pending OAuth attempt. It still performs the authoritative RPC;
          // this note only correlates one short-lived browser attempt.
          noteAuthSignIn(session.user.id)
        }
        void (async () => {
          await identityTransition
          if (!authWorkGeneration.current.isCurrent(eventGeneration)) return

          if (establishesSession && session?.user?.id) {
            if (isRecoveryFlow) {
              clearOAuthTermsConsentAttempt()
              clearAuthSignInNote()
            } else {
              const isLive = await prepareProviderIdentity(session.user);
              if (!authWorkGeneration.current.isCurrent(eventGeneration)) return
              if (isLive) {
                if (event === "SIGNED_IN") {
                  trackEvent('user_signed_in')
                }
              }
            }

          } else if (event === 'PASSWORD_RECOVERY') {
            clearOAuthTermsConsentAttempt()
            clearAuthSignInNote()
            // Recovery session established — do nothing here. The reset-password page
            // handles everything. Push permission will be requested after normal login.

          } else if (event === 'SIGNED_OUT') {
            clearOAuthTermsConsentAttempt()
            clearLocallyAcceptedLegalTerms()
            clearAuthSignInNote()
            await oneSignalIdentity.logout()
            if (!authWorkGeneration.current.isCurrent(eventGeneration)) return
            sessionTracker.endSession()
            providerSetupUserId = null
            resetUser()
            setPostHogCaptureAllowed(true, null)
            trackEvent('user_signed_out')
          }
        })()
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
      disposed = true
      void browserFinishedListener?.remove()
      window.removeEventListener("consumed:profile-ready", handleProfileReady)
      sessionTracker.endSession()
    }
  }, [startupAttempt])

  const retryStartup = () => {
    setStartupError(null)
    setLoading(true)
    setStartupAttempt((attempt) => attempt + 1)
  }

  const signIn = async (
    email: string,
    password: string,
  ) => {
    clearOAuthTermsConsentAttempt()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error) {
      rememberLastLoginMethod('email')
    }
    return { error }
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

    const acceptanceAttempt = beginLegalTermsAcceptanceAttempt()
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
          await withAuthStateRequestDeadline(supabase.auth.signOut()).catch(() => undefined)
          return { error: acceptanceError, data }
        }
      }
      return { error, data }
    } finally {
      finishLegalTermsAcceptanceAttempt(acceptanceAttempt)
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

    // Web sign-in returns to the exact current origin. Native returns through
    // the published app URL, whose callback lifecycle is handled separately.
    const appUrl = (import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com').replace(/\/$/, '')
    const nativePlatform = Capacitor.isNativePlatform()
    const redirectOrigin = nativePlatform ? appUrl : window.location.origin
    const consentAttempt = options.termsAccepted || nativePlatform
      ? beginOAuthTermsConsentAttempt(provider, options.termsAccepted === true)
      : null
    if (nativePlatform && consentAttempt) markNativeOAuthBrowserAttempt(consentAttempt.id)
    const redirectTo = nativePlatform && consentAttempt
      ? `${redirectOrigin}/login?oauth_attempt=${encodeURIComponent(consentAttempt.id)}`
      : `${redirectOrigin}/login`
    let data: { url: string | null } | null = null
    let error: unknown = null
    try {
      const response = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          ...(nativePlatform ? { skipBrowserRedirect: true } : {}),
        },
      })
      data = response.data
      error = response.error
    } catch (oauthError) {
      if (consentAttempt) clearMatchingOAuthTermsConsentAttempt(consentAttempt.id)
      return {
        error: oauthError instanceof Error
          ? oauthError
          : new Error("Couldn't start sign-in securely. Please try again."),
      }
    }
    if (error) {
      if (consentAttempt) clearMatchingOAuthTermsConsentAttempt(consentAttempt.id)
      return { error }
    }

    if (nativePlatform) {
      const authorizationUrl = data?.url
      if (
        !authorizationUrl
        || !isTrustedNativeOAuthAuthorizationUrl(
          authorizationUrl,
          SUPABASE_URL,
          provider,
          redirectTo,
        )
      ) {
        clearMatchingOAuthTermsConsentAttempt(consentAttempt?.id ?? null)
        return {
          error: new Error("Couldn't start sign-in securely. Please try again."),
        }
      }

      try {
        await Browser.open({ url: authorizationUrl })
      } catch (browserError) {
        clearMatchingOAuthTermsConsentAttempt(consentAttempt?.id ?? null)
        return {
          error: browserError instanceof Error
            ? browserError
            : new Error("Couldn't open the secure sign-in browser. Please try again."),
        }
      }
      return { error: null }
    }

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
      startupError,
      signIn,
      signUp,
      signOut,
        signInWithOAuth,
      resetPassword,
      updatePassword,
      retryStartup,
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