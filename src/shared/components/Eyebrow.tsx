import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '@/shared/theme/theme';

/**
 * The web app's `.eyebrow` kicker — a tracked-out mono caption preceded by a
 * small raspberry square. Opens nearly every screen over there.
 */
export function Eyebrow({ children }: { children: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.marker} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marker: {
    width: 6,
    height: 6,
    backgroundColor: colors.raspberry,
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.54, // .14em at 11px
    textTransform: 'uppercase',
    color: colors.inkSoft,
    // Mono glyphs sit low in their box; nudge back onto the marker's centreline.
    marginTop: -spacing.xs / 2,
  },
});
