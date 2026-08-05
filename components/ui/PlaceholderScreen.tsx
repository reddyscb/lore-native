import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';

type Props = {
  title: string;
  note: string;
};

/** Placeholder for tabs whose real content lands in a later phase. Proves
 * navigation, auth-gating, fonts, and theme all work end to end. */
export function PlaceholderScreen({ title, note }: Props) {
  return (
    <ScreenContainer>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
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
  note: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
});
