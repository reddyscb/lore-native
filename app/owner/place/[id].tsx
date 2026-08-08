import { useCallback, useEffect, useState } from 'react';
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
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { Chip } from '@/shared/components/Chip';
import { TextField } from '@/shared/components/TextField';
import { Button } from '@/shared/components/Button';
import { StarRating } from '@/features/owner/components/StarRating';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { usePlace } from '@/features/places/hooks/use-place';
import { useDishes } from '@/features/places/hooks/use-dishes';
import { useUpdatePlaceStatus } from '@/features/owner/hooks/use-update-place-status';
import { useUpdatePlaceTagline } from '@/features/owner/hooks/use-update-place-tagline';
import { useAddDish } from '@/features/owner/hooks/use-add-dish';
import { useUpdateDish } from '@/features/owner/hooks/use-update-dish';
import { useDeleteDish } from '@/features/owner/hooks/use-delete-dish';
import { useUploadDishPhoto } from '@/features/owner/hooks/use-upload-dish-photo';
import type { Dish } from '@/features/places/api/places';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

const STATUSES: { id: string; label: string }[] = [
  { id: 'open', label: 'Open as usual' },
  { id: 'temp-closed', label: 'Temporarily closed' },
  { id: 'perm-closed', label: 'Permanently closed' },
];

export default function ManagePlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: place,
    isLoading: placeLoading,
    isError: placeNotFound,
    refetch: refetchPlace,
  } = usePlace(id);
  const { data: dishes = [], refetch: refetchDishes } = useDishes(id);
  const loading = placeLoading;

  const [status, setStatus] = useState('open');
  const [reopenDate, setReopenDate] = useState('');
  const [statusSaved, setStatusSaved] = useState(false);
  const updateStatusMutation = useUpdatePlaceStatus();

  const [tagline, setTagline] = useState('');
  const [taglineSaved, setTaglineSaved] = useState(false);
  const updateTaglineMutation = useUpdatePlaceTagline();

  const [newDishName, setNewDishName] = useState('');
  const addDishMutation = useAddDish();

  // Seed the editable form fields whenever the underlying place data
  // changes (first load, or a value that actually differs from what's
  // cached) — matches the prior fetch-and-reset-on-focus behavior.
  useEffect(() => {
    if (!place) return;
    setStatus(place.status);
    setReopenDate(place.reopen_date ?? '');
    setTagline(place.tagline ?? '');
  }, [place]);

  // Re-fetch on focus (e.g. returning here after editing elsewhere) —
  // `loading` only gates the very first load, so later focuses refresh in
  // the background without re-showing the spinner, same convention as the
  // Home tab (app/(tabs)/index.tsx).
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      refetchPlace();
      refetchDishes();
    }, [id, refetchPlace, refetchDishes])
  );

  async function onSaveStatus() {
    if (!id) return;
    try {
      await updateStatusMutation.mutateAsync({
        placeId: id,
        status,
        reopenDate: status === 'temp-closed' ? reopenDate.trim() || null : null,
      });
      setStatusSaved(true);
    } catch (error) {
      Alert.alert('Could not update status', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }
  const savingStatus = updateStatusMutation.isPending;

  async function onSaveTagline() {
    if (!id) return;
    try {
      await updateTaglineMutation.mutateAsync({ placeId: id, tagline: tagline.trim() || null });
      setTaglineSaved(true);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }
  const savingTagline = updateTaglineMutation.isPending;

  async function onAddDish() {
    if (!id || !newDishName.trim() || addDishMutation.isPending) return;
    try {
      await addDishMutation.mutateAsync({ placeId: id, fields: { name: newDishName.trim() } });
      setNewDishName('');
    } catch (error) {
      Alert.alert('Could not add dish', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }
  const addingDish = addDishMutation.isPending;

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
            <DishRow key={dish.id} dish={dish} placeId={id} />
          ))}

          <View style={styles.addDishRow}>
            <TextField
              placeholder="Add a dish…"
              value={newDishName}
              onChangeText={setNewDishName}
              containerStyle={styles.addDishField}
              onSubmitEditing={onAddDish}
              returnKeyType="done"
            />
            <Button label={addingDish ? '…' : 'Add'} inline loading={addingDish} onPress={onAddDish} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function DishRow({ dish, placeId }: { dish: Dish; placeId: string }) {
  const [name, setName] = useState(dish.name);
  const [tag, setTag] = useState(dish.tag ?? '');
  const updateDishMutation = useUpdateDish();
  const deleteDishMutation = useDeleteDish();
  const uploadDishPhotoMutation = useUploadDishPhoto();
  const uploadingPhoto = uploadDishPhotoMutation.isPending;

  async function saveField(fields: { name?: string; tag?: string | null; rating?: number | null }) {
    try {
      await updateDishMutation.mutateAsync({ placeId, dishId: dish.id, fields });
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

    try {
      await uploadDishPhotoMutation.mutateAsync({
        dishId: dish.id,
        placeId,
        media: { uri: asset.uri, mediaType: 'image', mimeType: asset.mimeType ?? 'image/jpeg' },
      });
    } catch (error) {
      Alert.alert('Could not upload photo', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  function onConfirmDelete() {
    Alert.alert('Remove this dish?', dish.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDishMutation.mutateAsync({ placeId, dishId: dish.id });
          } catch (error) {
            Alert.alert(
              'Could not remove dish',
              error instanceof Error ? error.message : 'Something went wrong.'
            );
          }
        },
      },
    ]);
  }

  return (
    <View style={dishRowStyles.row}>
      <Pressable onPress={onChangePhoto} disabled={uploadingPhoto}>
        {dish.photo_url ? (
          <Image
            source={{ uri: dish.photo_url }}
            style={dishRowStyles.photo}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
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
    marginVertical: spacing.xl,
  },
  addDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addDishField: {
    flex: 1,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
