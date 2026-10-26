import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NO_BLOCKED_ACCOUNTS,
  blockedIndex,
  isBlockedAccount,
  mergeServerBlocks,
  migrateBlockedPseudos,
  parseBlockedEntries,
  parsePendingBlocks,
  withBlocked,
  withCurrentPseudos,
  withPendingBlock,
  withoutBlockedEntry,
  type BlockedAccounts,
  type BlockedEntry,
  type PendingBlock,
} from '@/lib/blocked-accounts';
import { setBlock, syncBlocks } from '@/lib/social-actions';
import { publicSupabase, supabase } from '@/supabase/client';
import { useSocial } from '@/state/social';

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
 *
 * **Depuis le chantier 22 (D9), le blocage vit aussi en base**, par compte :
 * le bloqué ne commente ni n'aime plus les bentos de qui l'a bloqué, et la
 * liste suit un compte gardé d'un téléphone à l'autre. Chaque geste s'écrit
 * en base ; hors ligne, il attend la synchronisation suivante. La liste du
 * téléphone est versée une fois par compte, puis celle de la base fait foi à
 * chaque lancement : un déblocage fait ailleurs n'est pas défait ici. Les
 * entrées sans compte restent locales, la base ne les connaît pas.
 */

const STORAGE_KEY = 'bp_blocked_accounts';
/** La liste du téléphone, versée une fois par compte (chantier 22, D9). */
const syncedKey = (uid: string) => `bp_blocks_synced:${uid}`;
/** Les gestes que la base n'a pas reçus, par compte. */
const pendingKey = (uid: string) => `bp_blocks_pending:${uid}`;
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
  /** La liste de la base, après les gestes en attente (chantier 22, D9). */
  syncWithServer: () => Promise<void>;
  /** « Se déconnecter » et « Supprimer mon compte » : le téléphone repart vide. */
  clear: () => Promise<void>;
};

async function persist(entries: readonly BlockedEntry[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function readPending(uid: string): Promise<PendingBlock[]> {
  return parsePendingBlocks(await AsyncStorage.getItem(pendingKey(uid)));
}

async function writePending(uid: string, pending: readonly PendingBlock[]) {
  if (pending.length === 0) await AsyncStorage.removeItem(pendingKey(uid));
  else await AsyncStorage.setItem(pendingKey(uid), JSON.stringify(pending));
}

/**
 * Écrit un geste en base. Reçu, il efface tout geste plus ancien en attente
 * sur le même compte ; perdu, il attend la synchronisation suivante.
 */
async function pushBlock(userId: string, on: boolean) {
  const uid = await currentUserId();
  if (!uid) return;
  try {
    await setBlock(supabase, userId, on);
    const pending = await readPending(uid);
    if (pending.some((p) => p.userId === userId)) {
      await writePending(uid, pending.filter((p) => p.userId !== userId));
    }
  } catch (e) {
    console.warn('[blocage] en attente du réseau', e);
    await writePending(uid, withPendingBlock(await readPending(uid), { userId, on }));
  }
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

    if (entries.length > 0) {
      try {
        const next = await reconcile(entries);
        // Un blocage posé pendant la réconciliation l'emporte : on ne réécrit
        // que si la liste n'a pas bougé entre-temps.
        if (get().entries === entries) {
          if (JSON.stringify(next) === JSON.stringify(entries)) {
            // Rien à rattacher ni à renommer : la liste d'avant se recopie
            // quand même sous la nouvelle clé, pour n'être reprise qu'une fois.
            if ((await AsyncStorage.getItem(STORAGE_KEY)) === null) await persist(next);
          } else {
            set({ entries: next, index: blockedIndex(next) });
            await persist(next);
          }
        }
      } catch {
        // Réseau ou stockage en défaut : la liste lue reste en place.
      }
    }

    // Chantier 22 (D9) : la base, à chaque lancement, **liste vide comprise**.
    // S'arrêter sur une liste vide retardait le versement unique jusqu'au
    // premier blocage : il partait alors après coup, avec une liste qui
    // pouvait défaire un déblocage fait sur un autre téléphone. Relevé à la
    // recette du lot 5, entre l'iPhone 17 Pro et le SE.
    void get().syncWithServer();
  },

  block: async (who) => {
    const next = withBlocked(get().entries, who);
    set({ entries: next, index: blockedIndex(next) });
    await persist(next);
    // Les commentaires du bloqué sortent des nombres une fois la base écrite.
    if (who.userId) void pushBlock(who.userId, true).then(() => useSocial.getState().refreshAll());
  },

  unblock: async (who) => {
    const next = withoutBlockedEntry(get().entries, who);
    set({ entries: next, index: blockedIndex(next) });
    await persist(next);
    if (who.userId) void pushBlock(who.userId, false).then(() => useSocial.getState().refreshAll());
  },

  isBlocked: (who) => isBlockedAccount(get().index, who),

  syncWithServer: async () => {
    const uid = await currentUserId();
    if (!uid) return;
    const start = get().entries;
    try {
      // Les gestes restés en attente d'abord : la liste rendue les compte.
      const left: PendingBlock[] = [];
      for (const op of await readPending(uid)) {
        try {
          await setBlock(supabase, op.userId, op.on);
        } catch {
          left.push(op);
        }
      }
      await writePending(uid, left);

      const firstTime = (await AsyncStorage.getItem(syncedKey(uid))) === null;
      const upload = firstTime ? start.flatMap((e) => (e.userId ? [e.userId] : [])) : [];
      const rows = await syncBlocks(supabase, upload);
      if (firstTime) await AsyncStorage.setItem(syncedKey(uid), '1');

      // Un geste fait pendant ce temps l'emporte : la prochaine
      // synchronisation reprendra la liste.
      if (get().entries !== start) return;
      const next = mergeServerBlocks(start, rows, left);
      if (JSON.stringify(next) === JSON.stringify(start)) return;
      set({ entries: next, index: blockedIndex(next) });
      await persist(next);
    } catch (e) {
      console.warn('[blocage] synchronisation', e);
    }
  },

  clear: async () => {
    set({ entries: [], index: NO_BLOCKED_ACCOUNTS });
    await persist([]);
  },
}));
