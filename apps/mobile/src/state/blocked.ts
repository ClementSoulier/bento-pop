import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Liste de pseudos bloqués par device, persistée dans AsyncStorage.
 *
 * Compare-toi à une mute liste locale : seul l'utilisateur du device ne
 * voit plus les bentos en question. Aucun signal envoyé au backend, pas
 * de notif à l'utilisateur bloqué. C'est volontaire — ça permet à
 * l'utilisateur de gérer son expérience sans escalade (Apple guideline 1.2
 * recommande ce mécanisme côté client, complémentaire au report serveur).
 *
 * Le store hydrate au boot via `useBlocked.getState().load()` (appelé
 * depuis le root layout après init session).
 */

const STORAGE_KEY = 'bp_blocked_pseudos';

type BlockedState = {
  pseudos: Set<string>;
  hydrated: boolean;
  load: () => Promise<void>;
  block: (pseudo: string) => Promise<void>;
  unblock: (pseudo: string) => Promise<void>;
  isBlocked: (pseudo: string) => boolean;
};

async function persist(set: Set<string>) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export const useBlocked = create<BlockedState>((set, get) => ({
  pseudos: new Set<string>(),
  hydrated: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as string[];
        set({ pseudos: new Set(list.map((p) => p.toLowerCase())), hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      // Storage indisponible (rare) — on continue avec une liste vide
      set({ hydrated: true });
    }
  },

  block: async (pseudo) => {
    const next = new Set(get().pseudos);
    next.add(pseudo.toLowerCase());
    set({ pseudos: next });
    await persist(next);
  },

  unblock: async (pseudo) => {
    const next = new Set(get().pseudos);
    next.delete(pseudo.toLowerCase());
    set({ pseudos: next });
    await persist(next);
  },

  isBlocked: (pseudo) => get().pseudos.has(pseudo.toLowerCase()),
}));
