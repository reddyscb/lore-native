import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SplashScreenController } from '@/components/splash-screen-controller';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import AuthProvider from '@/providers/auth-provider';
import { colors, fontFamily } from '@/constants/theme';

// Sentry.init must always run (not just when a DSN is set) — Sentry.wrap
// below expects an initialized client and logs a startup warning
// otherwise. An empty dsn is Sentry's own supported way to disable
// sending; see CLAUDE.md's "Required manual setup" for the DSN itself
// (create a Sentry project, add it to .env's EXPO_PUBLIC_SENTRY_DSN).
// debug is gated on the DSN too — with nothing to send to, Sentry's own
// internal logger just console.warns about it on every launch, which
// (like the expo-notifications warning documented in hooks/use-push-
// notifications.ts) surfaces RN's "Open debugger to view warnings" banner
// over the UI.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn,
  debug: __DEV__ && Boolean(sentryDsn),
  tracesSampleRate: 0.1,
});

// Three mutually-exclusive states, each its own protected branch:
//  1. logged out              -> (auth) welcome / phone / verify
//  2. logged in, not onboarded -> onboarding (name + role, same as web Phase 1)
//  3. logged in, onboarded     -> (tabs) the actual app
// Shared header treatment for every pushed (non-tab) screen.
const pushedScreenOptions = {
  title: '',
  headerBackTitle: 'Back',
  headerStyle: { backgroundColor: colors.cream },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fontFamily.body },
  headerShadowVisible: false,
  // Pauses a pushed screen's React tree once the next screen fully covers
  // it, instead of leaving it mounted and re-rendering in the background —
  // a real win for screens like café detail and the messages thread that
  // otherwise keep doing state-driven work while off-screen.
  freezeOnBlur: true,
} as const;

function RootNavigator() {
  const { isLoggedIn, needsOnboarding, session } = useAuthContext();
  usePushNotifications(isLoggedIn && !needsOnboarding ? session?.user?.id : undefined);

  return (
    <Stack>
      <Stack.Protected guard={isLoggedIn && !needsOnboarding}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="place/[id]" options={pushedScreenOptions} />
        <Stack.Screen name="checkin/[placeId]" options={pushedScreenOptions} />
        <Stack.Screen name="collections/index" options={pushedScreenOptions} />
        <Stack.Screen name="collections/[id]" options={pushedScreenOptions} />
        <Stack.Screen name="diary" options={pushedScreenOptions} />
        <Stack.Screen name="events" options={pushedScreenOptions} />
        <Stack.Screen name="messages/index" options={pushedScreenOptions} />
        <Stack.Screen name="messages/new" options={pushedScreenOptions} />
        <Stack.Screen name="messages/[conversationId]" options={pushedScreenOptions} />
        <Stack.Screen name="owner/claim" options={pushedScreenOptions} />
        <Stack.Screen name="owner/index" options={pushedScreenOptions} />
        <Stack.Screen name="owner/place/[id]" options={pushedScreenOptions} />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn && needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  const fontsLoaded = useAppFonts();

  return (
    <AuthProvider>
      <SplashScreenController fontsLoaded={fontsLoaded} />
      {fontsLoaded && <RootNavigator />}
      <StatusBar style="dark" />
    </AuthProvider>
  );
}

export default Sentry.wrap(RootLayout);
