import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  hardShadow,
  radii,
  spacing,
} from '@/shared/theme/theme';

/**
 * Mirrors the web app's `.btn` family:
 *   primary   -> .btn.btn-primary  (raspberry fill)
 *   dark      -> .btn.btn-dark     (ink fill)
 *   secondary -> .btn              (paper fill — the unmodified base button)
 *   ghost     -> .btn-ghost        (borderless underlined link)
 */
type Variant = 'primary' | 'dark' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Shrink-wrap to the label instead of filling the row (web's `width: auto`). */
  inline?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, inline }: Props) {
  const isDisabled = disabled || loading;
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        isGhost ? styles.ghostBase : styles.base,
        !isGhost && variantStyles[variant],
        inline && styles.inline,
        // The web button physically presses down into its own shadow.
        pressed && !isDisabled && (isGhost ? styles.ghostPressed : styles.pressed),
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'dark' ? colors.paper : colors.ink}
        />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth,
    borderColor: colors.ink,
    ...hardShadow(4),
  },
  pressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    ...hardShadow(1),
  },
  ghostBase: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  ghostPressed: {
    opacity: 0.6,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.raspberry },
  dark: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.paper },
  ghost: {},
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.paper },
  dark: { color: colors.cream },
  secondary: { color: colors.ink },
  ghost: {
    color: colors.inkSoft,
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
});
