import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, fontFamily } from '@/shared/theme/theme';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
};

/** Circular avatar. Falls back to the name's first letter when there's no photo. */
export function Avatar({ uri, name, size = 36 }: Props) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, dimension]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={uri}
      />
    );
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {(name?.trim()?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
  },
  fallback: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.ink,
  },
});
