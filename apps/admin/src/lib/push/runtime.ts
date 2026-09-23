import 'server-only';
import { createMobileClient } from '@/lib/supabase/mobile';
import type { PushDeps } from './pipeline';
import { createExpoSender } from './sender';
import { createSupabasePushStore } from './store';

/**
 * Les dépendances des routes d'envoi, lues à chaque appel : les variables
 * Coolify sont **runtime** (D9), une rotation ne demande pas de rebuild.
 * `null` si le projet mobile n'est pas configuré.
 */
export function createPushRuntime(): (PushDeps & { db: NonNullable<ReturnType<typeof createMobileClient>> }) | null {
  const db = createMobileClient();
  if (!db) return null;
  return {
    db,
    store: createSupabasePushStore(db),
    sender: createExpoSender(process.env.EXPO_ACCESS_TOKEN || undefined),
    now: () => new Date(),
  };
}
