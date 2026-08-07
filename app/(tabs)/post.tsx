import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TextField } from '@/components/ui/TextField';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { PlaceListItem } from '@/components/ui/PlaceListItem';
import { MediaStrip } from '@/components/ui/MediaStrip';
import { MessagesIcon } from '@/components/ui/MessagesIcon';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useCreateDrop } from '@/hooks/use-create-drop';
import {
  fetchPlace,
  searchPlaces,
  searchProfiles,
  type PickedMedia,
  type PlaceSummary,
  type ProfileSearchResult,
} from '@/lib/queries';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/RouteErrorBoundary';

const MAX_DROP_MEDIA = 4;

type PickedMediaItem = PickedMedia & { id: string };

export default function PostScreen() {
  const { profile, session } = useAuthContext();
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const authorId = profile?.id ?? session?.user?.id ?? '';

  const [place, setPlace] = useState<PlaceSummary | null>(null);

  useEffect(() => {
    if (placeId) {
      fetchPlace(placeId).then(setPlace);
    }
  }, [placeId]);

  if (!place) {
    return <PlacePicker onSelect={setPlace} />;
  }

  return <ComposeForm place={place} authorId={authorId} onChangePlace={() => setPlace(null)} />;
}

function PlacePicker({ onSelect }: { onSelect: (place: PlaceSummary) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      searchPlaces({ query }).then(setResults).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <ScreenContainer padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <PlaceListItem place={item} onPress={() => onSelect(item)} />}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Drop lore</Text>
              <MessagesIcon />
            </View>
            <Text style={styles.subtitle}>Which café is this about?</Text>
            <TextField
              placeholder="Search cafés by name"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
            {loading && <ActivityIndicator color={colors.raspberry} style={styles.spinner} />}
          </View>
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No cafés match that search.</Text> : null
        }
      />
    </ScreenContainer>
  );
}

type FormFields = {
  must_order: string;
  skip_note: string;
  sweet_spot: string;
  damage: string;
  vibe_check: string;
  plot_twist: string;
  secret_lore: string;
};

const EMPTY_FORM: FormFields = {
  must_order: '',
  skip_note: '',
  sweet_spot: '',
  damage: '',
  vibe_check: '',
  plot_twist: '',
  secret_lore: '',
};

function ComposeForm({
  place,
  authorId,
  onChangePlace,
}: {
  place: PlaceSummary;
  authorId: string;
  onChangePlace: () => void;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<ProfileSearchResult[]>([]);
  const [taggedFriends, setTaggedFriends] = useState<ProfileSearchResult[]>([]);
  const [media, setMedia] = useState<PickedMediaItem[]>([]);
  const createDropMutation = useCreateDrop();

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to attach media.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_DROP_MEDIA - media.length,
      quality: 0.7,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    const picked: PickedMediaItem[] = result.assets.map((asset, index) => ({
      id: `${Date.now()}-${index}`,
      uri: asset.uri,
      mediaType: asset.type === 'video' ? 'video' : 'image',
      mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    }));

    setMedia((prev) => [...prev, ...picked].slice(0, MAX_DROP_MEDIA));
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((item) => item.id !== id));
  }

  useEffect(() => {
    if (!friendQuery.trim() || !authorId) {
      setFriendResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchProfiles(friendQuery, authorId).then(setFriendResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [friendQuery, authorId]);

  const hasContent =
    media.length > 0 ||
    Object.entries(fields).some(([key, value]) => key !== 'damage' && value.trim().length > 0);

  function updateField(key: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFriend(person: ProfileSearchResult) {
    setTaggedFriends((prev) =>
      prev.some((p) => p.id === person.id) ? prev.filter((p) => p.id !== person.id) : [...prev, person]
    );
    setFriendQuery('');
    setFriendResults([]);
  }

  async function onSubmit() {
    if (!authorId) return;
    try {
      await createDropMutation.mutateAsync({
        input: {
          place_id: place.id,
          author_id: authorId,
          must_order: fields.must_order.trim() || undefined,
          skip_note: fields.skip_note.trim() || undefined,
          sweet_spot: fields.sweet_spot.trim() || undefined,
          damage: fields.damage.trim() ? Number(fields.damage.trim()) : undefined,
          vibe_check: fields.vibe_check.trim() || undefined,
          plot_twist: fields.plot_twist.trim() || undefined,
          secret_lore: fields.secret_lore.trim() || undefined,
        },
        taggedProfileIds: taggedFriends.map((f) => f.id),
        media,
      });

      setFields(EMPTY_FORM);
      setTaggedFriends([]);
      setMedia([]);
      router.push(`/place/${place.id}`);
    } catch (error) {
      Alert.alert('Could not post', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  return (
    <ScreenContainer padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.title}>Drop lore</Text>
            <MessagesIcon />
          </View>

          <View style={styles.placePinned}>
            <Text style={styles.placeName}>{place.name}</Text>
            <Pressable onPress={onChangePlace}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.mediaSection}>
            <MediaStrip
              media={media.map((m) => ({ id: m.id, media_type: m.mediaType, url: m.uri }))}
              onRemove={removeMedia}
            />
            {media.length < MAX_DROP_MEDIA && (
              <Button
                label={media.length === 0 ? 'Add photo or video' : 'Add more'}
                variant="secondary"
                inline
                onPress={pickMedia}
              />
            )}
          </View>

          <TextField
            label="Must order"
            placeholder="The one dish you'd send a friend for"
            value={fields.must_order}
            onChangeText={(v) => updateField('must_order', v)}
            style={styles.field}
          />
          <TextField
            label="Skip"
            placeholder="What's not worth it"
            value={fields.skip_note}
            onChangeText={(v) => updateField('skip_note', v)}
            style={styles.field}
          />
          <TextField
            label="Sweet spot"
            placeholder="Best time / seat / order combo"
            value={fields.sweet_spot}
            onChangeText={(v) => updateField('sweet_spot', v)}
            style={styles.field}
          />
          <TextField
            label="Vibe check"
            placeholder="Who this place is for"
            value={fields.vibe_check}
            onChangeText={(v) => updateField('vibe_check', v)}
            style={styles.field}
          />
          <TextField
            label="Plot twist"
            placeholder="Something unexpected"
            value={fields.plot_twist}
            onChangeText={(v) => updateField('plot_twist', v)}
            style={styles.field}
          />
          <TextField
            label="Secret lore"
            placeholder="Insider knowledge"
            value={fields.secret_lore}
            onChangeText={(v) => updateField('secret_lore', v)}
            style={styles.field}
          />
          <TextField
            label="Damage (₹)"
            placeholder="What you spent"
            keyboardType="numeric"
            value={fields.damage}
            onChangeText={(v) => updateField('damage', v)}
            style={styles.field}
          />

          <Text style={styles.sectionLabel}>Tag friends</Text>
          {taggedFriends.length > 0 && (
            <View style={styles.chipRow}>
              {taggedFriends.map((f) => (
                <Chip
                  key={f.id}
                  label={f.display_name ?? 'Someone'}
                  selected
                  onPress={() => toggleFriend(f)}
                />
              ))}
            </View>
          )}
          <TextField
            placeholder="Search by name"
            value={friendQuery}
            onChangeText={setFriendQuery}
            style={styles.field}
          />
          {friendResults.length > 0 && (
            <View style={styles.chipRow}>
              {friendResults.map((f) => (
                <Chip key={f.id} label={f.display_name ?? 'Someone'} onPress={() => toggleFriend(f)} />
              ))}
            </View>
          )}

          <Button
            label={createDropMutation.isPending ? 'Posting…' : 'Post drop'}
            onPress={onSubmit}
            disabled={!hasContent}
            loading={createDropMutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
  },
  search: {
    marginBottom: spacing.md,
  },
  spinner: {
    marginBottom: spacing.md,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  placePinned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  placeName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  changeLink: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.raspberry,
  },
  mediaSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
