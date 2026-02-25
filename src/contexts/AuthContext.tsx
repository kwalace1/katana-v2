import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

// Types
export interface UserProfile {
  id: string
  organization_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member' | 'viewer'
  department: string | null
  job_title: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  domain: string | null
  slug: string
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise'
  subscription_status: 'active' | 'trial' | 'suspended' | 'cancelled'
  max_users: number
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  organization: Organization | null
  loading: boolean
  signInWithMicrosoft: () => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: string | string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const initialLoadCompleteRef = useRef(false)
  const clockSkewDetectedRef = useRef(false)

  // Fetch user profile and organization
  const fetchUserData = async (userId: string, session?: Session | null) => {
    try {
      console.log('🔍 Fetching user data for:', userId)
      
      // Use provided session or get current session
      let currentSession = session
      if (!currentSession) {
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          
          // Handle clock skew errors
          if (sessionError.message?.includes('clock') || sessionError.message?.includes('future') || sessionError.message?.includes('skew')) {
            console.error('❌ Clock skew error - device clock is out of sync')
            console.error('💡 Please sync your device clock and refresh the page')
          }
          
          setProfile(null)
          setOrganization(null)
          return
        }
        currentSession = fetchedSession
      }
      
      if (!currentSession) {
        console.error('❌ No active session')
        setProfile(null)
        setOrganization(null)
        return
      }
      
      // Ensure session access token is available
      if (!currentSession.access_token) {
        console.error('❌ No access token in session')
        setProfile(null)
        setOrganization(null)
        return
      }
      
      console.log('✅ Session active:', currentSession.user.email)

      // Fetch user profile with simpler timeout
      const { data: profileData, error: profileError } = await Promise.race([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        new Promise<{ data: null, error: { code: string, message: string } }>((resolve) => 
          setTimeout(() => resolve({ 
            data: null, 
            error: { code: 'TIMEOUT', message: 'Profile query timeout' } 
          }), 3000)
        )
      ])

      if (profileError) {
        // Profile might not exist yet - this is OK for new users
        if (profileError.code === 'PGRST116') {
          console.warn('⚠️ Profile not found - user may need to complete onboarding')
          setProfile(null)
          setOrganization(null)
          return
        }
        if (profileError.code === 'TIMEOUT' || profileError.message?.includes('timeout')) {
          console.error('❌ Profile query timed out - session may not be ready or RLS blocking')
          setProfile(null)
          setOrganization(null)
          return
        }
        console.error('❌ Profile fetch error:', profileError)
        setProfile(null)
        setOrganization(null)
        return
      }

      if (!profileData) {
        console.warn('⚠️ Profile data is null')
        setProfile(null)
        setOrganization(null)
        return
      }

      console.log('✅ Profile loaded:', profileData?.email)
      setProfile(profileData as UserProfile)

      // Fetch organization with simpler timeout
      if (profileData?.organization_id) {
        const { data: orgData, error: orgError } = await Promise.race([
          supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single(),
          new Promise<{ data: null, error: { code: string, message: string } }>((resolve) => 
            setTimeout(() => resolve({ 
              data: null, 
              error: { code: 'TIMEOUT', message: 'Organization query timeout' } 
            }), 3000)
          )
        ])

        if (orgError) {
          if (orgError.code === 'TIMEOUT') {
            console.error('❌ Organization query timed out')
          } else {
            console.error('❌ Organization fetch error:', orgError)
          }
          setOrganization(null)
        } else if (orgData) {
          console.log('✅ Organization loaded:', orgData?.name)
          setOrganization(orgData as Organization)
        } else {
          setOrganization(null)
        }
      } else {
        console.warn('⚠️ No organization_id in profile')
        setOrganization(null)
      }
    } catch (error) {
      console.error('❌ Error fetching user data:', error)
      // Ensure we always clear state on error
      setProfile(null)
      setOrganization(null)
    }
  }

  // Initialize auth state - simplified version
  useEffect(() => {
    console.log('🚀 AuthContext initializing...')
    let isMounted = true
    
    // Reset flags
    initialLoadCompleteRef.current = false
    clockSkewDetectedRef.current = false
    
    // If Supabase is not configured, skip auth entirely
    if (!isSupabaseConfigured) {
      console.warn('⚠️ Supabase not configured - skipping auth')
      setLoading(false)
      initialLoadCompleteRef.current = true
      return
    }
    
    // Simple initialization - just get the session
    const initAuth = async () => {
      try {
        console.log('⏱️ Starting getSession...')
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('✅ getSession completed', session?.user?.email || 'no session')
        
        if (!isMounted) return
        
        if (error) {
          console.error('❌ Error getting session:', error)
          // Clear state on error
          setSession(null)
          setUser(null)
          setProfile(null)
          setOrganization(null)
          setLoading(false)
          initialLoadCompleteRef.current = true
          return
        }
        
        if (session?.user) {
          console.log('✅ Session found:', session.user.email)
          setSession(session)
          setUser(session.user)
          
          // Fetch user profile data
          try {
            await fetchUserData(session.user.id, session)
          } catch (fetchError) {
            console.error('❌ Error fetching user data:', fetchError)
          }
        } else {
          console.log('⚠️ No session found')
          setSession(null)
          setUser(null)
        }
        
        setLoading(false)
        initialLoadCompleteRef.current = true
      } catch (error) {
        console.error('❌ Error in initAuth:', error)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setOrganization(null)
          setLoading(false)
          initialLoadCompleteRef.current = true
        }
      }
    }
    
    // Run initialization
    initAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      console.log('🔄 Auth state changed:', event, session?.user?.email)
      
      // Handle SIGNED_OUT event immediately
      if (event === 'SIGNED_OUT') {
        console.log('⚠️ User signed out - clearing state')
        setSession(null)
        setUser(null)
        setProfile(null)
        setOrganization(null)
        setLoading(false)
        initialLoadCompleteRef.current = true
        return
      }
      
      // Handle SIGNED_IN event (OAuth callback)
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email)
        setSession(session)
        setUser(session.user)
        
        try {
          await fetchUserData(session.user.id, session)
        } catch (fetchError) {
          console.error('❌ Error fetching user data on sign in:', fetchError)
        }
        
        // Fetch Microsoft avatar using Edge Function (app credentials)
        // This uses the user's Microsoft OID from metadata, not the provider token
        const userMetadata = session.user.user_metadata
        if (userMetadata?.custom_claims?.oid) {
          console.log('📸 Fetching Microsoft avatar via Edge Function...')
          // Don't await - let it happen in background
          fetchAndSaveMicrosoftAvatar(session.user.id, userMetadata)
            .catch(err => console.error('❌ Background avatar fetch failed:', err))
        } else {
          console.warn('⚠️ No Microsoft OID in user metadata - cannot fetch photo')
        }
        
        setLoading(false)
        initialLoadCompleteRef.current = true
        return
      }
      
      // Handle TOKEN_REFRESHED event
      if (event === 'TOKEN_REFRESHED' && session) {
        console.log('✅ Token refreshed')
        setSession(session)
        setUser(session.user)
        return
      }
      
      // Handle INITIAL_SESSION - only if we haven't completed initial load yet
      if (event === 'INITIAL_SESSION') {
        // This is already handled by initAuth(), so skip if we already processed it
        if (initialLoadCompleteRef.current) {
          return
        }
        
        if (session?.user) {
          setSession(session)
          setUser(session.user)
          try {
            await fetchUserData(session.user.id, session)
          } catch (fetchError) {
            console.error('❌ Error fetching user data:', fetchError)
          }
        } else {
          setSession(null)
          setUser(null)
        }
        
        setLoading(false)
        initialLoadCompleteRef.current = true
        return
      }
      
      // For other events, update state
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        try {
          await fetchUserData(session.user.id, session)
        } catch (fetchError) {
          console.error('❌ Error fetching user data:', fetchError)
        }
      } else {
        setProfile(null)
        setOrganization(null)
      }
      
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Fetch Microsoft profile photo via Edge Function (uses app credentials)
  const fetchAndSaveMicrosoftAvatar = async (userId: string, userMetadata: any) => {
    try {
      console.log('📸 Fetching Microsoft profile photo via Edge Function...')
      
      // Get the Microsoft OID and Tenant ID from user metadata
      const microsoftOid = userMetadata?.custom_claims?.oid
      const tenantId = userMetadata?.custom_claims?.tid
      
      if (!microsoftOid || !tenantId) {
        console.warn('⚠️ Missing Microsoft OID or Tenant ID in user metadata')
        console.log('User metadata:', userMetadata)
        return null
      }
      
      console.log('📸 Microsoft OID:', microsoftOid)
      console.log('📸 Tenant ID:', tenantId)
      
      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-microsoft-avatar', {
        body: {
          user_id: userId,
          microsoft_oid: microsoftOid,
          tenant_id: tenantId,
        },
      })
      
      if (error) {
        console.error('❌ Edge Function error:', error)
        // Try to get more details
        if (error.context) {
          try {
            const errorBody = await error.context.json()
            console.error('❌ Error details:', errorBody)
          } catch (e) {
            console.error('❌ Could not parse error body')
          }
        }
        return null
      }
      
      if (data?.success && data?.avatar_url) {
        console.log('✅ Avatar fetched successfully:', data.avatar_url)
        // Update local profile state
        setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null)
        return data.avatar_url
      } else if (data?.message) {
        console.log('ℹ️', data.message)
        return null
      } else {
        console.error('❌ Unexpected response:', data)
        return null
      }
    } catch (error) {
      console.error('❌ Error fetching Microsoft avatar:', error)
      return null
    }
  }

  // Sign in with Microsoft
  const signInWithMicrosoft = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid User.Read',
          redirectTo: window.location.origin + '/employee', // Redirect to employee portal after login
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('Error signing in with Microsoft:', error)
      throw error
    }
  }

  // Sign up with email and password (e.g. from invite link; profile created via DB trigger from invite)
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + '/hub' },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing up with email:', error)
      throw error
    }
  }

  // Sign in with email and password (Katana account, no Microsoft)
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
    } catch (error) {
      console.error('Error signing in with email:', error)
      throw error
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setSession(null)
      setProfile(null)
      setOrganization(null)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id)
    }
  }

  // Check if user has specific role(s)
  const hasRole = (role: string | string[]): boolean => {
    if (!profile) return false
    
    if (Array.isArray(role)) {
      return role.includes(profile.role)
    }
    
    return profile.role === role
  }

  const value: AuthContextType = {
    user,
    session,
    profile,
    organization,
    loading,
    signInWithMicrosoft,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    refreshProfile,
    hasRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Protected route component
interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string | string[]
  fallback?: React.ReactNode
}

export function ProtectedRoute({ children, requiredRole, fallback }: ProtectedRouteProps) {
  const { user, profile, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to access this page.</p>
        </div>
      </div>
    )
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

