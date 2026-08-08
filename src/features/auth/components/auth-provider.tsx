import { PropsWithChildren, useEffect } from 'react';
import { supabase } from '@/shared/supabase/supabase';
import { useAuthStore } from '@/features/auth/stores/auth-store';

export default function AuthProvider({ children }: PropsWithChildren) {
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const setProfile = useAuthStore((state) => state.setProfile);
  const setLoading = useAuthStore((state) => state.setLoading);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  // Load the current session once, then subscribe to changes (sign in,
  // sign out, token refresh — all flow through the same listener).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading]);

  // Whenever the session changes, (re)fetch the profile row. This is what
  // tells us whether someone needs onboarding, same as the web app's check.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      await refreshProfile();
      if (!cancelled) setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [session, setProfile, setLoading, refreshProfile]);

  return <>{children}</>;
}
