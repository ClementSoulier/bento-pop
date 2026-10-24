import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NO_BLOCKED_ACCOUNTS,
  blockedIndex,
  isBlockedAccount,
  migrateBlockedPseudos,
  parseBlockedEntries,
  withBlocked,
  withCurrentPseudos,
  withoutBlockedEntry,
  type BlockedAccounts,
  type BlockedEntry,
} from '@/lib/blocked-accounts';
import { publicSupabase } from '@/supabase/client';

/**
 * Liste de comptes bloqués par device, persistée dans AsyncStorage.
 *
 * Compare-toi à une mute liste locale : seul l'utilisateur du device ne
 * voit plus les bentos en question. Aucun signal envoyé au backend, pas
 * de notif à l'utilisateur bloqué. C'est volontaire — ça permet à
 * l'utilisateur de gérer son expérience sans escalade (Apple guideline 1.2
 * recommande ce mécanisme côté client, complémentaire au report serveur).
 *
 * Depuis le chantier 21 (D8), chaque entrée retient le compte, et plus
 * seulement son pseudo : changer de pseudo ne lève pas un blocage. La liste
 * d'avant, des pseudos, est reprise au premier lancement, chacun rattaché à
 * son compte par `resolve_accounts` ; une entrée sans compte réessaie à
 * chaque lancement, et les pseudos affichés suivent ceux des comptes. Rien de
 * tout cela ne retarde l'hydratation : la liste lue sert tout de suite.
 *
 * Le store hydrate au boot via `useBlocked.getState().load()` (appelé
 * depuis le root layout après init session).
 */

const STORAGE_KEY = 'bp_blocked_accounts';
/** La liste d'avant le chantier 21, des pseudos en minuscules : lue une fois. */
const LEGACY_KEY = 'bp_blocked_pseudos';

type Who = { userId?: string | null; pseudo: string };

type BlockedState = {
  entries: BlockedEntry[];
  /** L'index des filtres, recalculé à chaque changement de `entries`. */
  index: BlockedAccounts;
  hydrated: boolean;
  load: () => Promise<void>;
  block: (who: BlockedEntry) => Promise<void>;
  unblock: (who: Who) => Promise<void>;
  isBlocked: (who: Who) => boolean;
};

async function persist(entries: readonly BlockedEntry[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

async function readStored(): Promise<BlockedEntry[]> {
  const stored = parseBlockedEntries(await AsyncStorage.getItem(STORAGE_KEY));
  if (stored !== null) return stored;
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return [];
  try {
    const list = JSON.parse(legacy) as unknown;
    return Array.isArray(list)
      ? list
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
          .map((p) => ({ userId: null, pseudo: p.trim().toLowerCase() }))
      : [];
  } catch {
    return [];
  }
}

/**
 * Rattache à leur compte les entrées qui n'en ont pas, et met à jour les
 * pseudos de celles qui en ont un. Sans réseau, rien ne change : la liste
 * telle quelle filtre déjà par pseudo.
 */
async function reconcile(entries: readonly BlockedEntry[]): Promise<BlockedEntry[]> {
  let next = [...entries];

  const orphans = next.filter((e) => !e.userId).map((e) => e.pseudo);
  if (orphans.length > 0) {
    const { data, error } = await publicSupabase.rpc('resolve_accounts', { p_pseudos: orphans });
    if (!error && data) {
      const resolved = migrateBlockedPseudos(orphans, data);
      next = [...next.filter((e) => e.userId), ...resolved].reduce<BlockedEntry[]>(
        (all, e) => withBlocked(all, e),
        [],
      );
    }
  }

  const ids = next.flatMap((e) => (e.userId ? [e.userId] : []));
  if (ids.length > 0) {
    const { data, error } = await publicSupabase.from('users').select('id, pseudo').in('id', ids);
    if (!error && data) {
      next = withCurrentPseudos(next, new Map(data.map((u) => [u.id, u.pseudo])));
    }
  }

  return next;
}

export const useBlocked = create<BlockedState>((set, get) => ({
  entries: [],
  index: NO_BLOCKED_ACCOUNTS,
  hydrated: false,

  load: async () => {
    let entries: BlockedEntry[] = [];
    try {
      entries = await readStored();
    } catch {
      // Storage indisponible (rare) — on continue avec une liste vide
    }
    set({ entries, index: blockedIndex(entries), hydrated: true });
    if (entries.length === 0) return;

    try {
      const next = await reconcile(entries);
      // Un blocage posé pendant la réconciliation l'emporte : on ne réécrit
      // que si la liste n'a pas bougé entre-temps.
      if (get().entries !== entries) return;
      if (JSON.stringify(next) === JSON.stringify(entries)) {
        // Rien à rattacher ni à renommer : la liste d'avant se recopie quand
        // même sous la nouvelle clé, pour n'être reprise qu'une fois.
        if ((await AsyncStorage.getItem(STORAGE_KEY)) === null) await persist(next);
        return;
      }
      set({ entries: next, index: blockedIndex(next) });
      await persist(next);
    } catch {
      // Réseau ou stockage en défaut : la liste lue reste en place.
    }
  },

  block: async (who) => {
    const next = withBlocked(get().entries, who);
    set({ entries: next, index: blockedIndex(next) });
    await persist(next);
  },

  unblock: async (who) => {
    const next = withoutBlockedEntry(get().entries, who);
    set({ entries: next, index: blockedIndex(next) });
    await persist(next);
  },

  isBlocked: (who) => isBlockedAccount(get().index, who),
}));
