import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';

type Props = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
};

export function Chip({ label, onPress, selected }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.paper,
  },
  chipSelected: {
    backgroundColor: colors.mustard,
    borderColor: colors.ink,
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  labelSelected: {
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
  },
});
