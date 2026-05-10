import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { EventsClient, type EventRow } from './EventsClient';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('landing_events')
    .select('id, date, title, place, stand, status, status_label, replay_url, display_order')
    .order('display_order', { ascending: true })
    .order('date', { ascending: true });

  const events = error ? [] : ((data ?? []) as unknown as EventRow[]);

  return (
    <PageShell
      crumbs={`Agenda · ${events.length} fiche${events.length > 1 ? 's' : ''}`}
      title="Événements"
    >
      <EventsClient events={events} />
    </PageShell>
  );
}
