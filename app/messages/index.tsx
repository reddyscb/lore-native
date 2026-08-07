import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchConversations, type Conversation } from '@/lib/messages';

export default function MessagesInboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchConversations()
        .then(setConversations)
        .finally(() => setLoading(false));
    }, [])
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
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <PageHeader eyebrow="Messages" title="Your conversations" />
            </View>
            <Button label="New" variant="secondary" inline onPress={() => router.push('/messages/new')} />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No conversations yet — tap &quot;New&quot; to message someone.</Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/messages/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Avatar
                  uri={item.other_participant.avatar_url}
                  name={item.other_participant.display_name}
                  size={44}
                />
                <View style={styles.textCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.other_participant.display_name ?? 'Someone'}</Text>
                    {item.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {previewText(item)}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

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
