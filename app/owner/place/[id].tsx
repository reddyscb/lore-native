import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchPlace, updatePlaceStatus, updatePlaceTagline, type Place } from '@/lib/queries';

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

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setPlace(null);
      setPlaceNotFound(false);
      fetchPlace(id)
        .then((data) => {
          setPlace(data);
          setStatus(data.status);
          setReopenDate(data.reopen_date ?? '');
          setTagline(data.tagline ?? '');
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
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

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
