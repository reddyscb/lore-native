import { supabase } from '@/shared/supabase/supabase';

export type EventRow = {
  id: string;
  place_id: string;
  title: string;
  event_date: string;
  event_time: string;
  price: number;
  tickets_total: number;
  tickets_sold: number;
  blurb: string | null;
  places: { name: string } | null;
};

export type Ticket = {
  id: string;
  event_id: string;
  count: number;
  created_at: string;
  events: { title: string } | null;
};

export async function fetchEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, places(name)')
    .order('event_date')
    .limit(100);

  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

export async function fetchMyTickets(userId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*, events(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Ticket[];
}

/**
 * Reserve seats on an event.
 *
 * The capacity check lives in the `reserve_tickets` Postgres function, which
 * does a conditional UPDATE and returns zero rows when the request would
 * oversell. That's what makes concurrent reservations safe — never bump
 * `tickets_sold` from the client.
 *
 * Known gap, shared with the web app: if the `tickets` insert below fails
 * after the RPC succeeded, the seats stay counted with no ticket to show for
 * it. Closing that needs the insert folded into the same function, which is a
 * schema change and so belongs in the web repo's migrations.
 */
export async function reserveTickets(
  eventId: string,
  userId: string,
  count: number
): Promise<'ok' | 'sold-out'> {
  const { data: reserved, error: reserveError } = await supabase
    .rpc('reserve_tickets', { p_event_id: eventId, p_count: count })
    .select()
    .maybeSingle();

  if (reserveError) throw reserveError;
  if (!reserved) return 'sold-out';

  const { error: ticketError } = await supabase
    .from('tickets')
    .insert({ event_id: eventId, user_id: userId, count });

  if (ticketError) throw ticketError;
  return 'ok';
}
