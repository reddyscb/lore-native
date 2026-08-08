import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { TextField } from '@/shared/components/TextField';
import { Avatar } from '@/shared/components/Avatar';
import { MediaStrip } from '@/shared/components/MediaStrip';
import { colors, fontFamily, fontSize, radii, spacing } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { useMessagesRealtime } from '@/features/messages/hooks/use-messages-realtime';
import { useConversation } from '@/features/messages/hooks/use-conversation';
import { useMessages } from '@/features/messages/hooks/use-messages';
import { useSendMessage } from '@/features/messages/hooks/use-send-message';
import { useSendMessageMedia } from '@/features/messages/hooks/use-send-message-media';
import { useMarkConversationRead } from '@/features/messages/hooks/use-mark-conversation-read';
import { useDeleteMessage } from '@/features/messages/hooks/use-delete-message';
import { useBlockUser } from '@/features/messages/hooks/use-block-user';
import type { Message } from '@/features/messages/api/messages';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const selfId = profile?.id ?? session?.user?.id ?? '';

  const {
    data: conversation = null,
    isLoading: conversationLoading,
    refetch: refetchConversation,
  } = useConversation(conversationId);
  const {
    data: fetchedMessages,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useMessages(conversationId);
  const loading = conversationLoading || messagesLoading;

  // Local, imperatively-managed list: sends and realtime inserts append here
  // directly (see the DM design spec's "no optimistic temp-id" decision, and
  // the seenIds dedup guard below for the real races that decision leaves).
  // `fetchedMessages` reseeds this list wholesale whenever a query/refetch
  // finds genuinely different data — first load, focus, or app-foreground.
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const seenIds = useRef(new Set<string>());
  const listRef = useRef<FlashListRef<Message>>(null);

  useEffect(() => {
    if (!fetchedMessages) return;
    fetchedMessages.forEach((m) => seenIds.current.add(m.id));
    setMessages(fetchedMessages);
  }, [fetchedMessages]);

  const sendMessageMutation = useSendMessage();
  const sendMessageMediaMutation = useSendMessageMedia();
  const { mutate: markConversationRead } = useMarkConversationRead();
  const deleteMessageMutation = useDeleteMessage();
  const blockUserMutation = useBlockUser();
  const sending = sendMessageMutation.isPending;
  const sendingMedia = sendMessageMediaMutation.isPending;

  useFocusEffect(
    useCallback(() => {
      refetchConversation().catch((error) => console.log('Failed to load conversation:', error));
      refetchMessages().catch((error) => console.log('Failed to load conversation:', error));
      if (conversationId && selfId) {
        markConversationRead(
          { conversationId, userId: selfId },
          { onError: (error) => console.log('Failed to mark conversation read:', error) }
        );
      }
    }, [conversationId, selfId, refetchConversation, refetchMessages, markConversationRead])
  );

  // Fallback for realtime silently dropping during backgrounding: when the
  // app returns to the foreground, refetch rather than trust the socket
  // reconnected cleanly. Cheap (one query) and avoids a thread that looks
  // caught up but silently isn't.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refetchConversation().catch((error) => console.log('Failed to load conversation:', error));
        refetchMessages().catch((error) => console.log('Failed to load conversation:', error));
      }
    });
    return () => subscription.remove();
  }, [refetchConversation, refetchMessages]);

  useMessagesRealtime(conversationId ?? '', (incoming) => {
    if (seenIds.current.has(incoming.id)) return;
    seenIds.current.add(incoming.id);
    setMessages((prev) => [...prev, incoming]);
    if (conversationId && selfId) {
      markConversationRead({ conversationId, userId: selfId });
    }
  });

  async function onSend() {
    const body = draft.trim();
    if (!body || !conversationId || !selfId || sending) return;
    setDraft('');
    try {
      const sent = await sendMessageMutation.mutateAsync({ conversationId, senderId: selfId, body });
      if (!seenIds.current.has(sent.id)) {
        seenIds.current.add(sent.id);
        setMessages((prev) => [...prev, sent]);
      }
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Something went wrong.');
      setDraft(body);
    }
  }

  async function onPickMedia() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access in Settings to attach media.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.7,
        videoMaxDuration: 60,
      });

      if (result.canceled || !conversationId || !selfId) return;

      const asset = result.assets[0];
      try {
        const sent = await sendMessageMediaMutation.mutateAsync({
          conversationId,
          senderId: selfId,
          media: {
            uri: asset.uri,
            mediaType: asset.type === 'video' ? 'video' : 'image',
            mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          },
        });
        if (!seenIds.current.has(sent.id)) {
          seenIds.current.add(sent.id);
          setMessages((prev) => [...prev, sent]);
        }
      } catch (error) {
        Alert.alert('Could not send', error instanceof Error ? error.message : 'Something went wrong.');
      }
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  const onLongPressMessage = useCallback(
    (message: Message) => {
      if (message.sender_id !== selfId) return;
      Alert.alert('Delete this message?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessageMutation.mutateAsync(message.id);
              setMessages((prev) => prev.filter((m) => m.id !== message.id));
            } catch (error) {
              Alert.alert('Could not delete', error instanceof Error ? error.message : 'Something went wrong.');
            }
          },
        },
      ]);
    },
    [selfId, deleteMessageMutation]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isSelf={item.sender_id === selfId}
        onLongPress={() => onLongPressMessage(item)}
      />
    ),
    [selfId, onLongPressMessage]
  );

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
              await blockUserMutation.mutateAsync({
                blockerId: selfId,
                blockedId: conversation.other_participant.id,
              });
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

        <FlashList
          ref={listRef}
          maintainVisibleContentPosition={{ disabled: true }}
          style={styles.flex}
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={renderItem}
        />

        <View style={styles.composer}>
          <Pressable onPress={onPickMedia} disabled={sendingMedia} style={styles.attachButton}>
            {sendingMedia ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.ink} />
            )}
          </Pressable>
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

export const MessageBubble = memo(function MessageBubble({
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
        {message.media_url && (
          <MediaStrip media={[{ id: message.id, media_type: message.media_type ?? 'image', url: message.media_url }]} />
        )}
        {message.body && <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>{message.body}</Text>}
      </View>
    </Pressable>
  );
});

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
  // Inter-bubble spacing lives on the row, not as a contentContainerStyle
  // `gap` — FlashList positions recycled cells itself, so container gap
  // isn't a reliable way to space items.
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm },
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
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
