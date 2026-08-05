import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRef } from 'react';
import { colors, fontFamily, fontSize, radii } from '@/constants/theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
};

const BOX_SIZE = 46;

/** Visually renders `length` boxes but is driven by a single real,
 * invisible TextInput underneath — the reliable way to build this in RN
 * without hand-rolling per-box focus management. */
export function OtpInput({ value, onChange, length = 6 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <Pressable style={styles.wrap} onPress={() => inputRef.current?.focus()}>
      {digits.map((digit, i) => (
        <View
          key={i}
          style={[styles.box, value.length === i && styles.boxActive]}
        >
          <Text style={styles.digitText}>{digit}</Text>
        </View>
      ))}

      <TextInput
        ref={inputRef}
        style={styles.captureInput}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        textContentType="oneTimeCode"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  boxActive: {
    borderColor: colors.raspberry,
  },
  digitText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  // Real input, invisible, positioned over the boxes to capture all
  // taps/typing/paste (including SMS autofill via textContentType).
  captureInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
