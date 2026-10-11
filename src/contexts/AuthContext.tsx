import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import type { Organization, Profile, SignupRole, UserRole } from '../types/database'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  organization: Organization | null
  role: UserRole | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<Profile>
  signUp: (input: { fullName: string; email: string; password: string; phone?: string; requestedRole: SignupRole }) => Promise<Profile | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string) {
  const joined = await supabase.from('profiles').select('*, organizations(*)').eq('id', userId).maybeSingle()
  if (!joined.error) return joined.data as Profile | null

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    const next = await fetchProfile(userId)
    setProfile(next)
    return next
  }, [])

  useEffect(() => {
    let mounted = true

    if (!isSupabaseConfigured) {
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        try {
          await loadProfile(data.session.user.id)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load profile')
        }
      }
      setLoading(false)
    }).catch((err: unknown) => {
      if (!mounted) return
      setError(err instanceof Error ? err.message : 'Failed to restore session')
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        await loadProfile(nextSession.user.id)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null)
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Unable to sign in.')
        throw authError
      }
      if (!data.user) throw new Error('Sign-in succeeded but no user was returned.')
      const nextProfile = await loadProfile(data.user.id)
      if (!nextProfile) {
        const missing = 'No profile is linked to this account. Ask an admin to finish setup.'
        setError(missing)
        throw new Error(missing)
      }
      return nextProfile
    },
    [loadProfile],
  )

  const signUp = useCallback(
    async (input: { fullName: string; email: string; password: string; phone?: string; requestedRole: SignupRole }) => {
      setError(null)
      const { data, error: authError } = await supabase.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: input.fullName.trim(),
            phone: input.phone?.trim() || null,
            requested_role: input.requestedRole,
          },
        },
      })
      if (authError) {
        setError('Unable to create the account.')
        throw authError
      }
      if (!data.user) throw new Error('Sign-up did not return a user.')
      if (!data.session) return null
      let nextProfile = await loadProfile(data.user.id)
      if (!nextProfile) {
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        nextProfile = await loadProfile(data.user.id)
      }
      return nextProfile
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null
    return loadProfile(session.user.id)
  }, [loadProfile, session?.user])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      organization: profile?.organizations ?? null,
      role: profile?.role ?? null,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, error, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
