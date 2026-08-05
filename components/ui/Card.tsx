import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';

type Props = PropsWithChildren<{ style?: ViewStyle }>;

export function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.lg,
  },
});
