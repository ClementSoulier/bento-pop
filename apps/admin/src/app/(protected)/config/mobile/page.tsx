import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import { MobileConfigClient, type MobileConfigRow } from './MobileConfigClient';

export const dynamic = 'force-dynamic';

const FALLBACK: MobileConfigRow = {
  maintenanceMode: false,
  maintenanceTitle: 'On revient vite',
  maintenanceMessage: 'Mon Bento Pop est en maintenance, on revient dans quelques minutes.',
  iosMinVersion: '0.0.1',
  iosLatestVersion: '0.0.1',
  androidMinVersion: null,
  androidLatestVersion: null,
};

export default async function MobileConfigPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Configuration · App mobile" title="App mobile">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Le projet Supabase <strong>mobile</strong> n&apos;est pas configuré. Renseigne{' '}
          <code className="font-mono">MOBILE_SUPABASE_URL</code> et{' '}
          <code className="font-mono">MOBILE_SUPABASE_SERVICE_ROLE_KEY</code> dans{' '}
          <code className="font-mono">apps/admin/.env</code>.
        </div>
      </PageShell>
    );
  }

  const { data } = await mobile
    .from('app_config')
    .select(
      'maintenance_mode, maintenance_title, maintenance_message, ios_min_version, ios_latest_version, android_min_version, android_latest_version',
    )
    .eq('id', 1)
    .maybeSingle();

  const config: MobileConfigRow = data
    ? {
        maintenanceMode: data.maintenance_mode,
        maintenanceTitle: data.maintenance_title,
        maintenanceMessage: data.maintenance_message,
        iosMinVersion: data.ios_min_version,
        iosLatestVersion: data.ios_latest_version,
        androidMinVersion: data.android_min_version,
        androidLatestVersion: data.android_latest_version,
      }
    : FALLBACK;

  return (
    <PageShell
      crumbs="Configuration · App mobile"
      title="App mobile"
    >
      <MobileConfigClient config={config} />
    </PageShell>
  );
}
