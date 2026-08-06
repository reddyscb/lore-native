import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  padded?: boolean;
}>;

export function ScreenContainer({ children, style, padded = true }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={[styles.container, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

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
