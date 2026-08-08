import { memo, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Avatar } from '@/shared/components/Avatar';
import { Button } from '@/shared/components/Button';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useConversations } from '@/features/messages/hooks/use-conversations';
import type { Conversation } from '@/features/messages/api/messages';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function MessagesInboxScreen() {
  const router = useRouter();
  const {
    data: conversations = [],
    isLoading: loading,
    isError: loadError,
    refetch,
  } = useConversations();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow conversation={item} onPress={() => router.push(`/messages/${item.id}`)} />
    ),
    [router]
  );

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={conversations}
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <PageHeader eyebrow="Messages" title="Your conversations" />
            </View>
            <Button label="New" variant="secondary" inline onPress={() => router.push('/messages/new')} />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loadError
              ? "Couldn't load your conversations. Try again in a moment."
              : 'No conversations yet — tap "New" to message someone.'}
          </Text>
        }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar
            uri={conversation.other_participant.avatar_url}
            name={conversation.other_participant.display_name}
            size={44}
          />
          <View style={styles.textCol}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{conversation.other_participant.display_name ?? 'Someone'}</Text>
              {conversation.unread && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.preview} numberOfLines={1}>
              {previewText(conversation)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

function previewText(conversation: Conversation): string {
  const message = conversation.last_message;
  if (!message) return 'Say hello';
  if (message.body) return message.body;
  if (message.media_type === 'video') return 'Sent a video';
  if (message.media_type === 'image') return 'Sent a photo';
  return '';
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: { flex: 1 },
  card: { marginBottom: spacing.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.raspberry },
  preview: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.inkSoft },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
