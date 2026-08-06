import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize, hardShadow, radii } from '@/constants/theme';

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
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 15,
    backgroundColor: colors.paper,
  },
  chipSelected: {
    backgroundColor: colors.mustard,
    ...hardShadow(3),
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  labelSelected: {
    color: colors.ink,
  },
});
