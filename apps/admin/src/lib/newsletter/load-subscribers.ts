import type { createServerClient } from '@/lib/supabase/server';
import type { SubscriberRow } from './subscribers';

type Client = Awaited<ReturnType<typeof createServerClient>>;

/** PostgREST rend au plus 1 000 lignes par requête : on lit la liste par pages. */
const PAGE = 1000;
const MAX_ROWS = 50_000;

/** Toute la liste des inscrits, sous la RLS des admins, de la plus récente à la plus ancienne. */
export async function loadSubscribers(
  supabase: Client,
): Promise<{ rows: SubscriberRow[]; error: string | null }> {
  const rows: SubscriberRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from('landing_newsletter_subscribers')
      .select('id, email, source, consent_at')
      .order('consent_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as SubscriberRow[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}
