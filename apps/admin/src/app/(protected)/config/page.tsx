import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { ConfigClient, type SettingsRow } from './ConfigClient';

export const dynamic = 'force-dynamic';

const FALLBACK: SettingsRow = { seasonNumber: 2 };

export default async function ConfigPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('landing_settings')
    .select('season_number')
    .eq('id', 'singleton')
    .maybeSingle();

  const row = data as unknown as { season_number: number } | null;
  const settings: SettingsRow = row ? { seasonNumber: row.season_number } : FALLBACK;

  return (
    <PageShell crumbs="Paramètres globaux de la landing" title="Configuration">
      <ConfigClient settings={settings} />
    </PageShell>
  );
}
