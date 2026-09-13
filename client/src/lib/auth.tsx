import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { sessionTracker } from './sessionTracker'
import { identifyUser, resetUser, trackEvent } from './posthog'
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

  // Links this device's push token to the user's ID in OneSignal so we can target them.
  const linkOneSignalUser = async (userId: string) => {
    const platform = Capacitor.getPlatform()
    if (platform !== "ios" && platform !== "android") return

    try {
      await OneSignal.login(userId)
    } catch (e) {
      console.log("OneSignal login failed:", e)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user?.id) {
        const isRecoveryFlow = isRecoveryAuthCallback(window.location.pathname)
        if (!isRecoveryFlow) {
          rememberLastLoginMethodFromUser(session.user)
          sessionTracker.startSession(session.user.id)

          supabase
            .rpc('get_my_account_profile')
            .select('user_name, display_name')
            .maybeSingle()
            .then(({ data: profile }) => {
              identifyUser(session.user.id, {
                email: session.user.email,
                name: profile?.display_name || profile?.user_name || session.user.email,
                username: profile?.user_name,
              })
              console.log("PostHog identify", session.user.id)
            })

          await requestPushPermissionIfNative()
          await linkOneSignalUser(session.user.id)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session ? 'Session active' : 'No session')
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        if (event === 'SIGNED_IN' && session?.user?.id) {
          const isRecoveryFlow = isRecoveryAuthCallback(window.location.pathname)
          if (isRecoveryFlow) {
            clearOAuthTermsConsentAttempt()
            clearAuthSignInNote()
          } else {
            noteAuthSignIn(session.user.id)
            rememberLastLoginMethodFromUser(session.user)

            sessionTracker.startSession(session.user.id)

            supabase
              .rpc('get_my_account_profile')
              .select('user_name, display_name')
              .maybeSingle()
              .then(({ data: profile }) => {
                identifyUser(session.user.id, {
                  email: session.user.email,
                  name: profile?.display_name || profile?.user_name || session.user.email,
                  username: profile?.user_name,
                })
                console.log("PostHog identify", session.user.id)
              })

            trackEvent('user_signed_in')

            await requestPushPermissionIfNative()
            await linkOneSignalUser(session.user.id)
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
          try { await OneSignal.logout() } catch (_) {}
          sessionTracker.endSession()
          resetUser()
          trackEvent('user_signed_out')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
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