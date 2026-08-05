import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
};

export function TextField({ label, style, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
});
