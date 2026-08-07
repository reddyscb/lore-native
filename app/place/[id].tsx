import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DropCard } from '@/components/ui/DropCard';
import { ReplyRow } from '@/components/ui/ReplyRow';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import {
  fetchPlace,
  fetchDishes,
  fetchPlaceDrops,
  fetchCollectionsForPlace,
  saveToCollection,
  removeFromCollection,
  createReply,
  type Place,
  type Dish,
  type Drop,
  type DropReply,
  type Collection,
} from '@/lib/queries';

const LORE_FIELDS: { key: keyof Place; label: string }[] = [
  { key: 'go_for', label: 'Go for' },
  { key: 'skip_note', label: 'Skip' },
  { key: 'secret', label: 'Secret' },
];

export default function PlaceDetailScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const authorId = profile?.id ?? session?.user?.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  // `place` gates the initial paint (it's a fast single-row lookup, and we
  // need it for the header regardless), but dishes/drops load independently
  // afterward with their own small inline spinners rather than blocking the
  // whole screen on whichever of the three queries is slowest.
  const [place, setPlace] = useState<Place | null>(null);
  const [placeNotFound, setPlaceNotFound] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishesLoading, setDishesLoading] = useState(true);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [dropsLoading, setDropsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setPlace(null);
    setPlaceNotFound(false);
    fetchPlace(id)
      .then(setPlace)
      .catch(() => setPlaceNotFound(true));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setDishesLoading(true);
    fetchDishes(id)
      .then(setDishes)
      .finally(() => setDishesLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setDropsLoading(true);
    fetchPlaceDrops(id)
      .then(setDrops)
      .finally(() => setDropsLoading(false));
  }, [id]);

  const [savedIn, setSavedIn] = useState<Collection[]>([]);

  useEffect(() => {
    if (!id || !authorId) return;
    fetchCollectionsForPlace(authorId, id).then(setSavedIn);
  }, [id, authorId]);

  if (!place) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        {placeNotFound ? (
          <Text style={styles.empty}>Couldn&apos;t find this café.</Text>
        ) : (
          <ActivityIndicator color={colors.raspberry} />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.meta}>
          {[place.area, place.price_range].filter(Boolean).join(' · ')}
        </Text>
        {place.tagline && <Text style={styles.tagline}>{place.tagline}</Text>}
        <StatusBadge status={place.status} reopenDate={place.reopen_date} />

        <View style={styles.actionRow}>
          <Button
            label="Drop lore about this place"
            variant="dark"
            inline
            onPress={() => router.push({ pathname: '/(tabs)/post', params: { placeId: place.id } })}
          />
          <Button
            label="Been here?"
            variant="secondary"
            inline
            onPress={() => router.push(`/checkin/${place.id}`)}
          />
        </View>

        {authorId && (
          <SaveToCollection
            ownerId={authorId}
            placeId={place.id}
            savedIn={savedIn}
            onChange={setSavedIn}
          />
        )}

        {LORE_FIELDS.some(({ key }) => place[key]) && (
          <Card style={styles.section}>
            {LORE_FIELDS.map(({ key, label }) => {
              const value = place[key];
              if (!value) return null;
              return (
                <View key={key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{value}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {(dishesLoading || dishes.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Menu highlights</Text>
            {dishesLoading ? (
              <ActivityIndicator color={colors.raspberry} />
            ) : (
              dishes.map((dish) => (
                <Card key={dish.id} style={styles.dishCard}>
                  <View style={styles.dishRow}>
                    <View style={styles.dishRowLeft}>
                      {dish.photo_url && (
                        <Image
                          source={{ uri: dish.photo_url }}
                          style={styles.dishPhoto}
                          contentFit="cover"
                          transition={150}
                          cachePolicy="memory-disk"
                        />
                      )}
                      <Text style={styles.dishName}>{dish.name}</Text>
                    </View>
                    {dish.rating != null && <Text style={styles.dishRating}>{dish.rating}★</Text>}
                  </View>
                  {dish.tag && <Chip label={dish.tag} />}
                </Card>
              ))
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drops</Text>
          {dropsLoading ? (
            <ActivityIndicator color={colors.raspberry} />
          ) : drops.length === 0 ? (
            <Text style={styles.empty}>No drops for this place yet.</Text>
          ) : (
            drops.map((drop) => (
              <View key={drop.id}>
                <DropCard drop={drop} />
                {drop.drop_replies?.map((reply) => <ReplyRow key={reply.id} reply={reply} />)}
                {authorId && (
                  <ReplyComposer
                    dropId={drop.id}
                    authorId={authorId}
                    onReplyAdded={(reply) => {
                      setDrops((prev) =>
                        prev.map((d) =>
                          d.id === drop.id
                            ? { ...d, drop_replies: [...(d.drop_replies ?? []), reply] }
                            : d
                        )
                      );
                    }}
                  />
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * "Save to a collection" — typing a name that already exists adds to that
 * list rather than creating a duplicate (the upsert keys off the
 * `(owner_id, name)` unique constraint). Collections this place is already
 * in show as selected chips; tapping one removes the place from it.
 */
function SaveToCollection({
  ownerId,
  placeId,
  savedIn,
  onChange,
}: {
  ownerId: string;
  placeId: string;
  savedIn: Collection[];
  onChange: (collections: Collection[]) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    onChange(await fetchCollectionsForPlace(ownerId, placeId));
  }

  async function onSave() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveToCollection(ownerId, placeId, name);
      setName('');
      await refresh();
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(collectionId: string) {
    setBusy(true);
    try {
      await removeFromCollection(collectionId, placeId);
      await refresh();
    } catch (error) {
      Alert.alert('Could not remove', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.saveSection}>
      {savedIn.length > 0 && (
        <View style={styles.chipRow}>
          {savedIn.map((collection) => (
            <Chip
              key={collection.id}
              label={`✓ ${collection.name} ✕`}
              selected
              onPress={() => onRemove(collection.id)}
            />
          ))}
        </View>
      )}
      <View style={styles.saveRow}>
        <TextField
          placeholder="Save to a collection (e.g. Date spots)"
          value={name}
          onChangeText={setName}
          containerStyle={styles.saveInput}
        />
        <Button
          label="Save"
          variant="dark"
          inline
          onPress={onSave}
          disabled={!name.trim() || busy}
        />
      </View>
    </View>
  );
}

function ReplyComposer({
  dropId,
  authorId,
  onReplyAdded,
}: {
  dropId: string;
  authorId: string;
  onReplyAdded: (reply: DropReply) => void;
}) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const reply = await createReply(dropId, authorId, body.trim());
      onReplyAdded(reply);
      setBody('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.replyComposer}>
      <TextField
        placeholder="Reply…"
        value={body}
        onChangeText={setBody}
        containerStyle={styles.replyInput}
        style={styles.replyInputText}
      />
      <Pressable onPress={onSubmit} disabled={submitting || !body.trim()}>
        <Text style={[styles.replySubmit, (submitting || !body.trim()) && styles.replySubmitDisabled]}>
          Post
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  tagline: {
    fontFamily: fontFamily.displayItalic,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  fieldRow: {
    gap: 2,
  },
  fieldLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.raspberry,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  dishCard: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dishRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  dishPhoto: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dishName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  dishRating: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: colors.mustard,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveSection: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveInput: {
    flex: 1,
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  replyInput: {
    flex: 1,
  },
  replyInputText: {
    paddingVertical: spacing.sm,
  },
  replySubmit: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.raspberry,
  },
  replySubmitDisabled: {
    color: colors.inkSoft,
  },
});
