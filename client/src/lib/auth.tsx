import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { sessionTracker } from './sessionTracker'
import { identifyUser, resetUser, trackEvent } from './posthog'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, metadata?: { firstName?: string; lastName?: string; username?: string }) => Promise<{ error: any; data?: any }>
  signOut: () => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ error: any }>
  updatePassword: (newPassword: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
          })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth event:', event, session ? 'Session active' : 'No session');
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
            })
          trackEvent('user_signed_in')
        } else if (event === 'SIGNED_OUT') {
          sessionTracker.endSession()
          resetUser()
          trackEvent('user_signed_out')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      // Clean up session on unmount
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

  const signUp = async (email: string, password: string, metadata?: { firstName?: string; lastName?: string; username?: string }) => {
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `https://app.consumedapp.com/reset-password`,
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