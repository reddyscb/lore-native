import { memo, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { borderWidth, colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';
import { formatEventDate } from '@/lib/format';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchEvents, fetchMyTickets, reserveTickets, type EventRow, type Ticket } from '@/lib/queries';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/RouteErrorBoundary';

type Banner = { kind: 'reserved' | 'sold-out' } | null;

export default function EventsScreen() {
  const { profile, session } = useAuthContext();
  const userId = profile?.id ?? session?.user?.id ?? '';

  const [events, setEvents] = useState<EventRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);

  const load = useCallback(async () => {
    const [eventData, ticketData] = await Promise.all([
      fetchEvents(),
      userId ? fetchMyTickets(userId) : Promise.resolve([]),
    ]);
    setEvents(eventData);
    setTickets(ticketData);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onReserve = useCallback(
    async (eventId: string, count: number) => {
      if (!userId) return;
      try {
        const result = await reserveTickets(eventId, userId, count);
        setBanner(result === 'ok' ? { kind: 'reserved' } : { kind: 'sold-out' });
        // Refetch either way: on success to pick up the new count, on failure
        // because a stale "N left" is exactly what caused the failure.
        await load();
      } catch (error) {
        Alert.alert(
          'Could not reserve',
          error instanceof Error ? error.message : 'Something went wrong.'
        );
      }
    },
    [userId, load]
  );

  const keyExtractor = useCallback((item: EventRow) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: EventRow }) => (
      <EventCard event={item} canReserve={!!userId} onReserve={(count) => onReserve(item.id, count)} />
    ),
    [userId, onReserve]
  );

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        data={events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            <PageHeader
              eyebrow="Events & Pop-Ups"
              title="What's on this week"
              subtitle="Ticketed nights and tastings — reserve your spot ahead of time."
            />

            {banner?.kind === 'reserved' && (
              <View style={[styles.banner, styles.bannerOk]}>
                <Text style={styles.bannerText}>Reserved ✓</Text>
              </View>
            )}
            {banner?.kind === 'sold-out' && (
              <View style={[styles.banner, styles.bannerError]}>
                <Text style={styles.bannerText}>
                  Not enough tickets left for that request — someone else may have just booked ahead
                  of you.
                </Text>
              </View>
            )}

            {tickets.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your tickets</Text>
                {tickets.map((ticket) => (
                  <Card key={ticket.id} style={styles.ticketCard}>
                    <Text style={styles.ticketText}>
                      🎟️ {ticket.count} × {ticket.events?.title ?? 'An event'}
                    </Text>
                  </Card>
                ))}
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.upcomingTitle]}>Upcoming</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing on the calendar yet.</Text>}
      />
    </ScreenContainer>
  );
}

const EventCard = memo(function EventCard({
  event,
  canReserve,
  onReserve,
}: {
  event: EventRow;
  canReserve: boolean;
  onReserve: (count: number) => Promise<void>;
}) {
  const left = event.tickets_total - event.tickets_sold;
  // Web defaults the picker to 2, but never above what's actually left.
  const [count, setCount] = useState(Math.min(2, Math.max(left, 1)));
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await onReserve(count);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.eventCard}>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventMeta}>
        {[event.places?.name, formatEventDate(event.event_date), event.event_time]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {event.blurb && <Text style={styles.eventBlurb}>{event.blurb}</Text>}

      <View style={styles.eventFooter}>
        <Text style={styles.price}>
          ₹{event.price} · {left > 0 ? `${left} left` : 'sold out'}
        </Text>

        {canReserve && left > 0 ? (
          <View style={styles.reserveRow}>
            <Stepper
              value={count}
              min={1}
              max={left}
              onChange={setCount}
              disabled={submitting}
            />
            <Button
              label="Reserve"
              variant="dark"
              inline
              onPress={submit}
              loading={submitting}
            />
          </View>
        ) : (
          <Text style={styles.soldOut}>{left > 0 ? 'sign in to reserve' : 'sold out'}</Text>
        )}
      </View>
    </Card>
  );
});

function Stepper({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel="One fewer ticket"
        disabled={disabled || value <= min}
        onPress={() => onChange(value - 1)}
        style={styles.stepperButton}
      >
        <Text style={[styles.stepperGlyph, value <= min && styles.stepperGlyphOff]}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        accessibilityLabel="One more ticket"
        disabled={disabled || value >= max}
        onPress={() => onChange(value + 1)}
        style={styles.stepperButton}
      >
        <Text style={[styles.stepperGlyph, value >= max && styles.stepperGlyphOff]}>+</Text>
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
    paddingBottom: spacing.xl,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  upcomingTitle: {
    marginTop: spacing.lg,
  },
  banner: {
    borderRadius: radii.card,
    borderWidth,
    borderColor: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  bannerOk: {
    backgroundColor: colors.teal,
  },
  bannerError: {
    backgroundColor: colors.raspberry,
  },
  bannerText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.paper,
  },
  ticketCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  ticketText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  eventCard: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  eventTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  eventMeta: {
    fontFamily: fontFamily.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  eventBlurb: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  eventFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  price: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  reserveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  soldOut: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radii.field,
    backgroundColor: colors.paper,
  },
  stepperButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepperGlyph: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  stepperGlyphOff: {
    color: colors.inkSoft,
    opacity: 0.4,
  },
  stepperValue: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: colors.ink,
    minWidth: 18,
    textAlign: 'center',
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
