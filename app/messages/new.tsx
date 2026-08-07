import { memo, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { searchProfiles, type ProfileSearchResult } from '@/lib/queries';
import { getOrCreateDirectConversation } from '@/lib/messages';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/RouteErrorBoundary';

export default function NewMessageScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const selfId = profile?.id ?? session?.user?.id ?? '';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() || !selfId) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchProfiles(query, selfId).then(setResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selfId]);

  const onSelect = useCallback(
    async (otherUserId: string) => {
      if (startingId) return;
      setStartingId(otherUserId);
      try {
        const conversationId = await getOrCreateDirectConversation(otherUserId);
        // replace, not push: backing out of a freshly started thread should
        // return to the inbox, not back to this search screen.
        router.replace(`/messages/${conversationId}`);
      } catch (error) {
        Alert.alert('Could not start conversation', error instanceof Error ? error.message : 'Something went wrong.');
        setStartingId(null);
      }
    },
    [startingId, router]
  );

  const keyExtractor = useCallback((item: ProfileSearchResult) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: ProfileSearchResult }) => (
      <PersonRow person={item} starting={startingId === item.id} onPress={() => onSelect(item.id)} />
    ),
    [startingId, onSelect]
  );

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            <PageHeader eyebrow="New message" title="Who's the lore for?" />
            <TextField
              placeholder="Search people by name"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
          </>
        }
        ListEmptyComponent={query.trim() ? <Text style={styles.empty}>No one matches that name.</Text> : null}
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

const PersonRow = memo(function PersonRow({
  person,
  starting,
  onPress,
}: {
  person: ProfileSearchResult;
  starting: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={starting}>
      <Avatar uri={person.avatar_url} name={person.display_name} size={44} />
      <Text style={styles.name}>{person.display_name ?? 'Someone'}</Text>
      {starting && <ActivityIndicator color={colors.raspberry} style={styles.spinner} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  search: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  name: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },
  spinner: { marginLeft: spacing.sm },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
