import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/AppShell/Sidebar';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  // Charge les compteurs pour les badges sidebar (à venir / live / brouillons).
  const supabase = await createServerClient();
  const [eventsRes, pollsRes, showDraftsRes, podcastDraftsRes] = await Promise.all([
    supabase.from('landing_events').select('id', { count: 'exact', head: true }).eq('status', 'soon'),
    supabase.from('landing_vote_weeks').select('id', { count: 'exact', head: true }).eq('is_current', true),
    supabase.from('landing_show_episodes').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('landing_podcast_episodes').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
  ]);

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Sidebar
        user={{ email: session.email, role: session.role }}
        badges={{
          events: eventsRes.count ?? 0,
          polls: pollsRes.count ?? 0,
          emissions: showDraftsRes.count ?? 0,
          podcasts: podcastDraftsRes.count ?? 0,
        }}
      />
      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  );
}
