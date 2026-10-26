import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase-mobile/types';
import type { ModerationStore } from './run-digest';

type MobileClient = SupabaseClient<Database>;

/** Ce que le mail à l'équipe lit et marque, sur la base mobile, clé de service. */
export function createSupabaseModerationStore(db: MobileClient): ModerationStore {
  return {
    unalertedReports: async () => {
      const { data, error } = await db
        .from('reports')
        .select('id, target_kind, target_pseudo, reason_code, target_text, created_at')
        .eq('status', 'pending')
        .is('alerted_at', null)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    lastAlertAt: async () => {
      const { data, error } = await db
        .from('reports')
        .select('alerted_at')
        .not('alerted_at', 'is', null)
        .order('alerted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.alerted_at ? new Date(data.alerted_at) : null;
    },
    markAlerted: async (ids, at) => {
      const { error } = await db
        .from('reports')
        .update({ alerted_at: at.toISOString() })
        .in('id', [...ids]);
      if (error) throw new Error(error.message);
    },
  };
}

/** Un an après : la trace d'une sanction le temps d'une contestation (D20). */
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Efface les signalements traités, les commentaires et les pourquoi masqués
 * de plus d'un an (D20 du 22, D19 du 12). Appelée à l'ouverture de la
 * modération, comme la purge du registre (`purge_user_deletions`) : le projet
 * n'a de battement que celui des push, et les tables ne grossissent que de
 * quelques lignes.
 */
export async function purgeModeration(db: MobileClient, now = new Date()): Promise<void> {
  const before = new Date(now.getTime() - RETENTION_MS).toISOString();
  await db.from('reports').delete().neq('status', 'pending').lt('reviewed_at', before);
  await db.from('bento_comments').delete().eq('status', 'hidden').lt('hidden_at', before);
  await db.from('bento_whys').delete().eq('status', 'hidden').lt('hidden_at', before);
}
