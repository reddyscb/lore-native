import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import {
  fetchPlace,
  fetchDishes,
  updatePlaceStatus,
  updatePlaceTagline,
  updateDish,
  deleteDish,
  uploadDishPhoto,
  type Place,
  type Dish,
} from '@/lib/queries';

const STATUSES: { id: string; label: string }[] = [
  { id: 'open', label: 'Open as usual' },
  { id: 'temp-closed', label: 'Temporarily closed' },
  { id: 'perm-closed', label: 'Permanently closed' },
];

export default function ManagePlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [placeNotFound, setPlaceNotFound] = useState(false);

  const [status, setStatus] = useState('open');
  const [reopenDate, setReopenDate] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const [tagline, setTagline] = useState('');
  const [savingTagline, setSavingTagline] = useState(false);
  const [taglineSaved, setTaglineSaved] = useState(false);

  const [dishes, setDishes] = useState<Dish[]>([]);

  // Re-fetch on focus (e.g. returning here after editing elsewhere) —
  // `loading` only gates the very first load, so later focuses refresh in
  // the background without re-showing the spinner, same convention as the
  // Home tab (app/(tabs)/index.tsx).
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.all([fetchPlace(id), fetchDishes(id)])
        .then(([placeData, dishData]) => {
          setPlace(placeData);
          setPlaceNotFound(false);
          setStatus(placeData.status);
          setReopenDate(placeData.reopen_date ?? '');
          setTagline(placeData.tagline ?? '');
          setDishes(dishData);
        })
        .catch(() => setPlaceNotFound(true))
        .finally(() => setLoading(false));
    }, [id])
  );

  async function onSaveStatus() {
    if (!id) return;
    setSavingStatus(true);
    try {
      await updatePlaceStatus(id, status, status === 'temp-closed' ? reopenDate.trim() || null : null);
      setStatusSaved(true);
    } catch (error) {
      Alert.alert('Could not update status', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSavingStatus(false);
    }
  }

  async function onSaveTagline() {
    if (!id) return;
    setSavingTagline(true);
    try {
      await updatePlaceTagline(id, tagline.trim() || null);
      setTaglineSaved(true);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSavingTagline(false);
    }
  }

  if (loading || !place) {
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PageHeader
            eyebrow="Owner's Lore"
            title={place.name}
            subtitle={[place.area, place.price_range].filter(Boolean).join(' · ')}
          />

          <Text style={styles.sectionLabel}>Café status</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                selected={status === s.id}
                onPress={() => {
                  setStatus(s.id);
                  setStatusSaved(false);
                }}
              />
            ))}
          </View>
          {status === 'temp-closed' && (
            <TextField
              placeholder="Expected back (e.g. 25 Jul)"
              value={reopenDate}
              onChangeText={(value) => {
                setReopenDate(value);
                setStatusSaved(false);
              }}
              style={styles.field}
            />
          )}
          <Button
            label={savingStatus ? 'Saving…' : statusSaved ? 'Status updated ✓' : 'Update status'}
            variant="dark"
            inline
            loading={savingStatus}
            onPress={onSaveStatus}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Straight from the owner</Text>
          <TextField
            placeholder="Tell people your story…"
            value={tagline}
            onChangeText={(value) => {
              setTagline(value);
              setTaglineSaved(false);
            }}
            multiline
            numberOfLines={3}
            style={[styles.field, styles.multiline]}
          />
          <Button
            label={savingTagline ? 'Saving…' : taglineSaved ? 'Saved ✓' : 'Save'}
            variant="dark"
            inline
            loading={savingTagline}
            onPress={onSaveTagline}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Menu</Text>
          {dishes.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              placeId={id}
              onChange={(updated) =>
                setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
              }
              onDelete={async (dishId) => {
                try {
                  await deleteDish(dishId);
                  setDishes((prev) => prev.filter((d) => d.id !== dishId));
                } catch (error) {
                  Alert.alert(
                    'Could not remove dish',
                    error instanceof Error ? error.message : 'Something went wrong.'
                  );
                }
              }}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function DishRow({
  dish,
  placeId,
  onChange,
  onDelete,
}: {
  dish: Dish;
  placeId: string;
  onChange: (dish: Dish) => void;
  onDelete: (dishId: string) => void;
}) {
  const [name, setName] = useState(dish.name);
  const [tag, setTag] = useState(dish.tag ?? '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function saveField(fields: { name?: string; tag?: string | null; rating?: number | null }) {
    try {
      await updateDish(dish.id, fields);
      onChange({ ...dish, ...fields });
    } catch (error) {
      Alert.alert('Could not save dish', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  async function onChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to add a dish photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUploadingPhoto(true);
    try {
      const url = await uploadDishPhoto(dish.id, placeId, {
        uri: asset.uri,
        mediaType: 'image',
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      onChange({ ...dish, photo_url: url });
    } catch (error) {
      Alert.alert('Could not upload photo', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function onConfirmDelete() {
    Alert.alert('Remove this dish?', dish.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(dish.id) },
    ]);
  }

  return (
    <View style={dishRowStyles.row}>
      <Pressable onPress={onChangePhoto} disabled={uploadingPhoto}>
        {dish.photo_url ? (
          <Image source={{ uri: dish.photo_url }} style={dishRowStyles.photo} contentFit="cover" transition={150} />
        ) : (
          <View style={dishRowStyles.photoPlaceholder}>
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.raspberry} />
            ) : (
              <Text style={dishRowStyles.photoPlaceholderText}>+</Text>
            )}
          </View>
        )}
      </Pressable>

      <View style={dishRowStyles.fields}>
        <TextField
          value={name}
          onChangeText={setName}
          onBlur={() => name.trim() && name !== dish.name && saveField({ name: name.trim() })}
          style={dishRowStyles.nameField}
        />
        <TextField
          value={tag}
          onChangeText={setTag}
          onBlur={() => tag !== (dish.tag ?? '') && saveField({ tag: tag.trim() || null })}
          placeholder="Tag (e.g. Must try)"
          style={dishRowStyles.tagField}
        />
        <StarRating rating={dish.rating} onChange={(rating) => saveField({ rating })} size={18} />
      </View>

      <Pressable onPress={onConfirmDelete} hitSlop={8}>
        <Text style={dishRowStyles.remove}>remove</Text>
      </Pressable>
    </View>
  );
}

const dishRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.creamDeep,
    borderStyle: 'dashed',
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  photoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.inkSoft,
  },
  fields: {
    flex: 1,
    gap: spacing.xs,
  },
  nameField: {
    paddingVertical: spacing.sm,
  },
  tagField: {
    paddingVertical: spacing.sm,
  },
  remove: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.raspberry,
  },
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  divider: {
    borderTopWidth: 2,
    borderTopColor: colors.creamDeep,
    borderStyle: 'dashed',
    marginVertical: spacing.xl,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
