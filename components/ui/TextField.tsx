import { TextInput, TextInputProps, StyleSheet, View, Text, ViewStyle, StyleProp } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
  /** Styles the wrapping View. Needed to make the field flex inside a row —
   * `style` lands on the TextInput itself, which can't size its own parent. */
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({ label, style, containerStyle, ...props }: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
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
  // Web's `.field label`: mono, uppercase, tracked out.
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.field,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
});
