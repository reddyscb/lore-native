import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';

type Variant = 'primary' | 'ghost' | 'dark';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled }: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.ink : colors.paper} />
      ) : (
        <Text style={[styles.label, variant === 'ghost' && styles.labelGhost]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.paper,
  },
  labelGhost: {
    color: colors.ink,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.raspberry,
    borderColor: colors.raspberry,
  },
  dark: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.ink,
  },
});
