import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { useUnreadCount } from '@/features/messages/hooks/use-unread-count';

/** Paper-plane entry point into the DM inbox, with an unread-count badge.
 *  Dropped into the header row of every tab screen. Refreshes its count on
 *  tab focus rather than staying subscribed — see the DM design spec's
 *  "real-time inside an open thread" decision. Every instance shares one
 *  cached query, so five tab icons cost one fetch, not five. */
export function MessagesIcon() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const userId = profile?.id ?? session?.user?.id;
  const { data: unreadCount = 0, refetch } = useUnreadCount(!!userId);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      refetch();
    }, [userId, refetch])
  );

  return (
    <Pressable
      onPress={() => router.push('/messages')}
      hitSlop={8}
      accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
      style={styles.wrap}
    >
      <Ionicons name="paper-plane-outline" size={24} color={colors.ink} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.raspberry,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  badgeText: { fontFamily: fontFamily.mono, fontSize: 9, color: colors.paper },
});
