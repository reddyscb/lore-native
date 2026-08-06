import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SplashScreenController } from '@/components/splash-screen-controller';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import AuthProvider from '@/providers/auth-provider';
import { colors, fontFamily } from '@/constants/theme';

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

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  return (
    <AuthProvider>
      <SplashScreenController fontsLoaded={fontsLoaded} />
      {fontsLoaded && <RootNavigator />}
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
