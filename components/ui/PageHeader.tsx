import { StyleSheet, Text, View } from 'react-native';
import { Eyebrow } from './Eyebrow';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

/** eyebrow + h1 + lede — the opening block on every web screen. */
export function PageHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
});
