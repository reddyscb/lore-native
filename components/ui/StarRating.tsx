import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '@/constants/theme';

type Props = {
  rating: number | null;
  /** Omit for a read-only display; provide to make stars tappable. */
  onChange?: (rating: number) => void;
  size?: number;
};

const STAR_COUNT = 5;

/** Tap-to-set 1–5 star row, reused for both editing (owner dashboard) and
 * potential read-only display. */
export function StarRating({ rating, onChange, size = 20 }: Props) {
  const filled = rating ?? 0;

  return (
    <View style={styles.row}>
      {Array.from({ length: STAR_COUNT }, (_, index) => {
        const starNumber = index + 1;
        const star = (
          <Text
            style={[
              styles.star,
              { fontSize: size },
              starNumber <= filled ? styles.starFilled : styles.starEmpty,
            ]}
          >
            ★
          </Text>
        );

        return onChange ? (
          <Pressable key={starNumber} onPress={() => onChange(starNumber)} hitSlop={6}>
            {star}
          </Pressable>
        ) : (
          <View key={starNumber}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontFamily: fontFamily.mono,
  },
  starFilled: {
    color: colors.mustard,
  },
  starEmpty: {
    color: colors.creamDeep,
  },
});
