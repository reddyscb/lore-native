import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { largeSecureStore } from './secure-store-adapter';

// Same Supabase project as the web app (lore-app-iota.vercel.app).
// Every table, RLS policy, and RPC function is shared — this app talks to
// the exact same backend, just through a native client instead of Next.js
// Server Components.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: largeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // native apps use the deep-link flow instead
  },
});
