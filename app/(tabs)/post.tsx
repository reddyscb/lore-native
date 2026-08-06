import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import {
  createDrop,
  fetchPlace,
  searchPlaces,
  searchProfiles,
  tagProfilesOnDrop,
  type PlaceSummary,
  type ProfileSearchResult,
} from '@/lib/queries';

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
            <Text style={styles.title}>Drop lore</Text>
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
  const [submitting, setSubmitting] = useState(false);

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

  const hasContent = Object.entries(fields).some(
    ([key, value]) => key !== 'damage' && value.trim().length > 0
  );

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
    setSubmitting(true);
    try {
      const { id: dropId } = await createDrop({
        place_id: place.id,
        author_id: authorId,
        must_order: fields.must_order.trim() || undefined,
        skip_note: fields.skip_note.trim() || undefined,
        sweet_spot: fields.sweet_spot.trim() || undefined,
        damage: fields.damage.trim() ? Number(fields.damage.trim()) : undefined,
        vibe_check: fields.vibe_check.trim() || undefined,
        plot_twist: fields.plot_twist.trim() || undefined,
        secret_lore: fields.secret_lore.trim() || undefined,
      });

      await tagProfilesOnDrop(
        dropId,
        taggedFriends.map((f) => f.id)
      );

      setFields(EMPTY_FORM);
      setTaggedFriends([]);
      router.push(`/place/${place.id}`);
    } catch (error) {
      Alert.alert('Could not post', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Drop lore</Text>

          <View style={styles.placePinned}>
            <Text style={styles.placeName}>{place.name}</Text>
            <Pressable onPress={onChangePlace}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
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
            label={submitting ? 'Posting…' : 'Post drop'}
            onPress={onSubmit}
            disabled={!hasContent}
            loading={submitting}
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
