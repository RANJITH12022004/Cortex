import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types/database';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserRole>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export class AuthProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthProfileError';
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load user profile', error);
    throw new AuthProfileError(
      `Could not load your account profile (${error.message}). Contact an administrator.`,
    );
  }

  return data;
}

function assertActiveProfile(profile: UserProfile | null): UserProfile {
  if (!profile) {
    throw new AuthProfileError(
      'Your account is not set up in Cortex yet. Ask an administrator to invite you or link your profile.',
    );
  }
  if (!profile.active) {
    throw new AuthProfileError(
      'Your account has been deactivated. Contact an administrator to restore access.',
    );
  }
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchProfile(user.id);
    setProfile(nextProfile);
    return nextProfile;
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Failed to restore session', error);
        }
        if (!mounted) return;

        setSession(data.session);
        setUser(data.session?.user ?? null);

        if (data.session?.user) {
          const nextProfile = await fetchProfile(data.session.user.id);
          if (mounted) setProfile(nextProfile);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void fetchProfile(nextSession.user.id)
        .then((nextProfile) => {
          if (mounted) setProfile(nextProfile);
        })
        .catch((err) => {
          console.error(err);
          if (mounted) setProfile(null);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;

    const signedInUser = data.user;
    const signedInSession = data.session;
    if (!signedInUser || !signedInSession) {
      throw new Error('Sign in succeeded but no session was returned. Try again.');
    }

    const nextProfile = assertActiveProfile(await fetchProfile(signedInUser.id));

    setSession(signedInSession);
    setUser(signedInUser);
    setProfile(nextProfile);
    // Session tokens only — password is never persisted client-side (PRD 5.1).
    return nextProfile.role;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, user, profile, loading, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
