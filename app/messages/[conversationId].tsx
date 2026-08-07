import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TextField } from '@/components/ui/TextField';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useMessagesRealtime } from '@/hooks/use-messages-realtime';
import {
  blockUser,
  deleteMessage,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type Conversation,
  type Message,
} from '@/lib/messages';

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const selfId = profile?.id ?? session?.user?.id ?? '';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const seenIds = useRef(new Set<string>());
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const [conversationData, messageData] = await Promise.all([
      fetchConversation(conversationId),
      fetchMessages(conversationId),
    ]);
    setConversation(conversationData);
    messageData.forEach((m) => seenIds.current.add(m.id));
    setMessages(messageData);
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
      if (conversationId && selfId) {
        markConversationRead(conversationId, selfId).catch((error) =>
          console.log('Failed to mark conversation read:', error)
        );
      }
    }, [load, conversationId, selfId])
  );

  // Fallback for realtime silently dropping during backgrounding: when the
  // app returns to the foreground, refetch rather than trust the socket
  // reconnected cleanly. Cheap (one query) and avoids a thread that looks
  // caught up but silently isn't.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => subscription.remove();
  }, [load]);

  useMessagesRealtime(conversationId ?? '', (incoming) => {
    if (seenIds.current.has(incoming.id)) return;
    seenIds.current.add(incoming.id);
    setMessages((prev) => [...prev, incoming]);
    if (conversationId && selfId) {
      markConversationRead(conversationId, selfId).catch(() => {});
    }
  });

  async function onSend() {
    const body = draft.trim();
    if (!body || !conversationId || !selfId || sending) return;
    setSending(true);
    setDraft('');
    try {
      const sent = await sendMessage(conversationId, selfId, body);
      seenIds.current.add(sent.id);
      setMessages((prev) => [...prev, sent]);
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Something went wrong.');
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  function onLongPressMessage(message: Message) {
    if (message.sender_id !== selfId) return;
    Alert.alert('Delete this message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(message.id);
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
          } catch (error) {
            Alert.alert('Could not delete', error instanceof Error ? error.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  function onBlock() {
    if (!conversation || !selfId) return;
    Alert.alert(
      `Block ${conversation.other_participant.display_name ?? 'this person'}?`,
      "They won't be able to message you again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(selfId, conversation.other_participant.id);
              router.back();
            } catch (error) {
              Alert.alert('Could not block', error instanceof Error ? error.message : 'Something went wrong.');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Avatar
            uri={conversation?.other_participant.avatar_url}
            name={conversation?.other_participant.display_name}
            size={36}
          />
          <Text style={styles.headerName}>{conversation?.other_participant.display_name ?? 'Someone'}</Text>
          <Pressable onPress={onBlock} hitSlop={8}>
            <Text style={styles.blockLink}>Block</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isSelf={item.sender_id === selfId}
              onLongPress={() => onLongPressMessage(item)}
            />
          )}
        />

        <View style={styles.composer}>
          <TextField
            containerStyle={styles.composerField}
            placeholder="Write a message…"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable onPress={onSend} disabled={sending || !draft.trim()} style={styles.sendButton}>
            <Text style={styles.sendLabel}>{sending ? '…' : 'Send'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export function MessageBubble({
  message,
  isSelf,
  onLongPress,
}: {
  message: Message;
  isSelf: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowOther]}
    >
      <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
        {message.body && <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>{message.body}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  headerName: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },
  blockLink: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.danger },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowSelf: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  bubbleSelf: { backgroundColor: colors.raspberry },
  bubbleOther: { backgroundColor: colors.paper },
  bubbleText: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: colors.ink },
  bubbleTextSelf: { color: colors.paper },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  composerField: { flex: 1 },
  sendButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.ink,
    justifyContent: 'center',
  },
  sendLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.cream },
});
