import { useFonts } from 'expo-font';
import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';

/**
 * Loads the three-font system from the web app: Fraunces (display),
 * Inter (body), Space Mono (stamps / mono details). Returns `true` once
 * fonts are ready to render — gate the splash screen on this.
 */
export function useAppFonts() {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    Inter_400Regular,
    Inter_600SemiBold,
    SpaceMono_400Regular,
  });

  return loaded;
}
