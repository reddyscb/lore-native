import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { createDiaryEntry, fetchPlace, type Place } from '@/lib/queries';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/RouteErrorBoundary';

export default function CheckInScreen() {
  const router = useRouter();
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [dish, setDish] = useState('');
  const [whoWith, setWhoWith] = useState('');
  const [spend, setSpend] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!placeId) return;
    fetchPlace(placeId)
      .then(setPlace)
      .finally(() => setLoading(false));
  }, [placeId]);

  async function onSubmit() {
    if (!ownerId || !placeId) return;
    setSubmitting(true);
    try {
      // Match the web's parsing: strip everything non-numeric, and treat an
      // empty or unparseable value as "didn't say" rather than zero.
      const spendDigits = spend.replace(/[^0-9]/g, '');
      await createDiaryEntry({
        owner_id: ownerId,
        place_id: placeId,
        dish: dish.trim() || undefined,
        who_with: whoWith.trim() || undefined,
        spend: spendDigits ? Number(spendDigits) : undefined,
        note: note.trim() || undefined,
      });
      router.replace({ pathname: '/(tabs)/passport', params: { stamped: '1' } });
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  if (!place) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <Text style={styles.empty}>Couldn&apos;t find this café.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PageHeader
            eyebrow="Private — only you can see this"
            title={`Remember ${place.name}`}
            subtitle="This also unlocks a passport stamp for this place."
          />

          <TextField
            label="What did you order"
            value={dish}
            onChangeText={setDish}
            style={styles.field}
          />
          <TextField
            label="Who were you with"
            value={whoWith}
            onChangeText={setWhoWith}
            style={styles.field}
          />
          <TextField
            label="You spent"
            placeholder="₹"
            keyboardType="numeric"
            value={spend}
            onChangeText={setSpend}
            style={styles.field}
          />
          <TextField
            label="A little memory"
            placeholder="What made it worth remembering…"
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
            style={[styles.field, styles.multiline]}
          />

          <Button
            label={submitting ? 'Saving…' : 'Save to my diary'}
            onPress={onSubmit}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
