import { PropsWithChildren, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext, type Profile } from '@/hooks/use-auth-context';

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the current session once, then subscribe to changes (sign in,
  // sign out, token refresh — all flow through the same listener).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, onboarded')
      .eq('id', userId)
      .maybeSingle();

    if (error) console.error('Error fetching profile:', error);
    setProfile(data ?? null);
  }

  // Whenever the session changes, (re)fetch the profile row. This is what
  // tells us whether someone needs onboarding, same as the web app's check.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!session?.user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      await fetchProfile(session.user.id);
      if (!cancelled) setIsLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function refreshProfile() {
    if (!session?.user) return;
    await fetchProfile(session.user.id);
  }

  const isLoggedIn = !!session;
  const needsOnboarding = isLoggedIn && (!profile || profile.onboarded !== true);

  return (
    <AuthContext.Provider
      value={{ session, profile, isLoading, isLoggedIn, needsOnboarding, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
