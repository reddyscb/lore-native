import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { Button } from '@/shared/components/Button';
import { Eyebrow } from '@/shared/components/Eyebrow';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';

/**
 * Every route file re-exports this as `ErrorBoundary` — Expo Router's own
 * per-route convention (github.com/expo/router: a route module exporting
 * `ErrorBoundary` gets it rendered in place of a thrown screen, scoped to
 * just that route, so the tab bar / stack header around it keeps working
 * and a bug on one screen doesn't take down the whole app).
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ScreenContainer>
      <Eyebrow>Error</Eyebrow>
      <Text style={styles.title}>Something went wrong.</Text>
      <Text style={styles.message}>{error.message}</Text>
      <Button label="Try again" onPress={retry} inline />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  message: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
