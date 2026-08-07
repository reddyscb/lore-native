import { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { router } from 'expo-router';

import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { signInWithGoogle } from '@/features/auth/api/oauth';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function WelcomeScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onGooglePress() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // On success, the session updates via onAuthStateChange and the root
      // layout's Stack.Protected takes over — no manual navigation needed.
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View>
          <Text style={styles.wordmark}>lore.</Text>
          <Text style={styles.tagline}>Every place has lore.</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Continue with Google" onPress={onGooglePress} loading={googleLoading} />
          <Button
            label="Continue with phone number"
            variant="ghost"
            onPress={() => router.push('/(auth)/phone')}
          />
          <Text style={styles.disclaimer}>
            By entering, you agree there is, in fact, lore.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
  },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: 48,
    color: colors.ink,
  },
  tagline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  disclaimer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
