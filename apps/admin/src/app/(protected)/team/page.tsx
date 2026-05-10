import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import { TeamClient, type MemberRow } from './TeamClient';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('landing_team')
    .select('id, name, nick, bio, initials, photo_kind, photo_from, photo_to, photo_url, rotation, display_order')
    .order('display_order', { ascending: true });

  const members = (error ? [] : (data ?? [])) as unknown as MemberRow[];

  return (
    <PageShell crumbs={`Membres · ${members.length} fiche${members.length > 1 ? 's' : ''}`} title="La Team">
      <TeamClient members={members} />
    </PageShell>
  );
}
