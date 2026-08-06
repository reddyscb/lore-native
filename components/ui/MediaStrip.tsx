import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/constants/theme';

type MediaItem = {
  id: string;
  media_type: 'image' | 'video';
  url: string;
};

type Props = {
  media: MediaItem[];
  /** When provided, renders a remove (×) button on each thumbnail — used by
   *  the compose flow's preview. Omitted for read-only display (DropCard). */
  onRemove?: (id: string) => void;
};

const THUMB_SIZE = 130;

export function MediaStrip({ media, onRemove }: Props) {
  if (media.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {media.map((item) => (
        <View key={item.id} style={styles.thumbWrap}>
          {item.media_type === 'video' ? (
            <VideoThumb uri={item.url} />
          ) : (
            <Image source={{ uri: item.url }} style={styles.thumb} contentFit="cover" transition={150} />
          )}
          {onRemove && (
            <Pressable style={styles.removeButton} onPress={() => onRemove(item.id)} hitSlop={8}>
              <Ionicons name="close" size={14} color={colors.paper} />
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView player={player} style={styles.thumb} nativeControls allowsFullscreen contentFit="cover" />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
