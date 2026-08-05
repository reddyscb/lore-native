import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SplashScreenController } from '@/components/splash-screen-controller';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useAppFonts } from '@/hooks/use-app-fonts';
import AuthProvider from '@/providers/auth-provider';

// Three mutually-exclusive states, each its own protected branch:
//  1. logged out              -> (auth) welcome / phone / verify
//  2. logged in, not onboarded -> onboarding (name + role, same as web Phase 1)
//  3. logged in, onboarded     -> (tabs) the actual app
function RootNavigator() {
  const { isLoggedIn, needsOnboarding } = useAuthContext();

  return (
    <Stack>
      <Stack.Protected guard={isLoggedIn && !needsOnboarding}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
