import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/AppShell/Sidebar';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  // Charge les compteurs pour les badges sidebar (à venir / live).
  const supabase = await createServerClient();
  const [eventsRes, pollsRes] = await Promise.all([
    supabase.from('landing_events').select('id', { count: 'exact', head: true }).eq('status', 'soon'),
    supabase.from('landing_vote_weeks').select('id', { count: 'exact', head: true }).eq('is_current', true),
  ]);

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Sidebar
        user={{ email: session.email, role: session.role }}
        badges={{
          events: eventsRes.count ?? 0,
          polls: pollsRes.count ?? 0,
        }}
      />
      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  );
}
