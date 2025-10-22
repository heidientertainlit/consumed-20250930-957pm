import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

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
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, metadata?: { firstName?: string; lastName?: string; username?: string }) => {
    // Ensure username is provided and valid
    const username = metadata?.username?.trim() || email.split('@')[0];
    const firstName = metadata?.firstName?.trim() || '';
    const lastName = metadata?.lastName?.trim() || '';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          user_name: username
        }
      }
    });
    
    if (error || !data.user) {
      return { error, data };
    }

    // Wait a moment for auth to fully complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create user in custom users table immediately with upsert to handle duplicates
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: data.user.id,
        email: email,
        user_name: username,
        first_name: firstName,
        last_name: lastName,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (dbError) {
      console.error('Failed to create user in database:', dbError);
      // Return the error so signup knows it failed
      return { error: dbError, data };
    }

    // Verify the insert completed by fetching the user with retries
    let verifyData = null;
    let verifyError = null;
    for (let i = 0; i < 3; i++) {
      const result = await supabase
        .from('users')
        .select('user_name, first_name, last_name')
        .eq('id', data.user.id)
        .single();
      
      verifyData = result.data;
      verifyError = result.error;
      
      if (!verifyError && verifyData) {
        console.log('User successfully created in database:', verifyData);
        break;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (verifyError || !verifyData) {
      console.error('Failed to verify user creation:', verifyError);
      return { error: new Error('Failed to create user profile'), data };
    }

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