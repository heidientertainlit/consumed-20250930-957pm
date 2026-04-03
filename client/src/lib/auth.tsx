import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { sessionTracker } from './sessionTracker'
import { identifyUser, resetUser, trackEvent } from './posthog'
import { Capacitor } from "@capacitor/core"
import OneSignal from "onesignal-cordova-plugin"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; username?: string }
  ) => Promise<{ error: any; data?: any }>
  signOut: () => Promise<{ error: any }>
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
      await OneSignal.Notifications.requestPermission(true)
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
        sessionTracker.startSession(session.user.id)

        supabase
          .from('users')
          .select('user_name, display_name')
          .eq('id', session.user.id)
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
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session ? 'Session active' : 'No session')
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        if (event === 'SIGNED_IN' && session?.user?.id) {
          sessionTracker.startSession(session.user.id)

          supabase
            .from('users')
            .select('user_name, display_name')
            .eq('id', session.user.id)
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

        } else if (event === 'SIGNED_OUT') {
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; username?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: metadata?.firstName || '',
          last_name: metadata?.lastName || '',
          user_name: metadata?.username || email.split('@')[0]
        }
      }
    })
    return { error, data }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
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