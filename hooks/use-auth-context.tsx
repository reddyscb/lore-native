import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  display_name: string | null;
  role: string | null;
  onboarded: boolean | null;
};

export type AuthData = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  needsOnboarding: boolean;
  /** Re-fetch the profile row — call this after writing to `profiles`
   * (e.g. right after onboarding saves display_name/role/onboarded),
   * since the provider only re-fetches automatically on session changes. */
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthData>({
  session: null,
  profile: null,
  isLoading: true,
  isLoggedIn: false,
  needsOnboarding: false,
  refreshProfile: async () => {},
});

export const useAuthContext = () => useContext(AuthContext);
