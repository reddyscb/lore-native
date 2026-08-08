import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/supabase/supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  role: string | null;
  onboarded: boolean | null;
  avatar_url: string | null;
  city: string | null;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  needsOnboarding: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  /** Re-fetch the profile row — call this after writing to `profiles`
   * (e.g. right after onboarding saves display_name/role/onboarded),
   * since the store only re-fetches automatically on session changes. */
  refreshProfile: () => Promise<void>;
};

function deriveFlags(session: Session | null, profile: Profile | null) {
  const isLoggedIn = !!session;
  const needsOnboarding = isLoggedIn && (!profile || profile.onboarded !== true);
  return { isLoggedIn, needsOnboarding };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  isLoggedIn: false,
  needsOnboarding: false,
  setSession: (session) => set({ session, ...deriveFlags(session, get().profile) }),
  setProfile: (profile) => set({ profile, ...deriveFlags(get().session, profile) }),
  setLoading: (isLoading) => set({ isLoading }),
  refreshProfile: async () => {
    const { session, setProfile } = get();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, onboarded, avatar_url, city')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) console.error('Error fetching profile:', error);
    setProfile(data ?? null);
  },
}));
