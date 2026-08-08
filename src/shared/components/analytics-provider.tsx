import { PropsWithChildren } from 'react';
import { LogBox } from 'react-native';
import { PostHogProvider } from 'posthog-react-native';

// EU cloud region, matching the privacy-friendly framing PostHog was chosen
// for — see CLAUDE.md's "Required manual setup" for the key itself (create a
// PostHog project, add it to .env's EXPO_PUBLIC_POSTHOG_API_KEY).
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

// Unlike Sentry — whose init() treats an empty DSN as "disabled" — PostHog's
// SDK console.errors on an empty key, and that surfaces a LogBox toast over
// the UI (confirmed on-device: it renders as a dismissible bar at the bottom
// of the screen, over the tab bar's tap targets — the same class of problem
// CLAUDE.md documents for expo-notifications' startup warning). Skipping
// <PostHogProvider> entirely (below) avoids constructing that misconfigured
// client, but usePostHog() *also* raw console.errors, unconditionally and
// undebounced by any debug flag, whenever it finds no client in context —
// every capture()/screen() call site in this app calls it regardless of
// whether a key is configured. Silencing that expected, known message is
// the same fix as use-push-notifications.ts uses for its own unavoidable
// Simulator warning.
LogBox.ignoreLogs(['usePostHog was called without a PostHog client']);

/**
 * Mounts PostHog only when an API key is actually configured. With it
 * skipped, `usePostHog()` returns undefined — every call site already uses
 * `posthog?.capture(...)`, so analytics is simply inert until the key
 * exists.
 */
export default function AnalyticsProvider({ children }: PropsWithChildren) {
  if (!posthogApiKey) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={posthogApiKey}
      options={{ host: 'https://eu.i.posthog.com', defaultOptIn: false }}
      // Only the explicit capture()/screen() calls this app makes should
      // send events, not an unreviewed firehose of touches/screens/lifecycle
      // events. defaultOptIn is off too — useTrackingTransparency is what
      // turns capture on, and only after ATT permission is granted.
      autocapture={false}
    >
      {children}
    </PostHogProvider>
  );
}
