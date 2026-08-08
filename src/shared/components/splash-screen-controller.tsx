import { SplashScreen } from 'expo-router';
import { useAuthStore } from '@/features/auth/stores/auth-store';

SplashScreen.preventAutoHideAsync();

type Props = {
  fontsLoaded: boolean;
};

/** Keeps the native splash screen up until fonts are loaded AND the auth
 * check has resolved, so nothing ever flashes unstyled or logged-out. */
export function SplashScreenController({ fontsLoaded }: Props) {
  const { isLoading } = useAuthStore();

  if (fontsLoaded && !isLoading) {
    SplashScreen.hideAsync();
  }

  return null;
}
