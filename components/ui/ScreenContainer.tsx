import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  padded?: boolean;
  /**
   * Set on screens pushed under a navigation header. The header already sits
   * below the status bar, so insetting the top again leaves a dead band of
   * background between the header and the content.
   */
  hasHeader?: boolean;
}>;

export function ScreenContainer({ children, style, padded = true, hasHeader }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={hasHeader ? BOTTOM_ONLY : TOP_AND_BOTTOM}>
      <View style={[styles.container, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

// Hoisted so the array identity is stable across renders.
const TOP_AND_BOTTOM = ['top', 'bottom'] as const;
const BOTTOM_ONLY = ['bottom'] as const;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
