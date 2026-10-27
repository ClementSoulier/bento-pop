import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Le filtre de « La table », chantier 23 (D1, D7) : « Tout le monde », le fil
 * d'avant, ou « Abonnements », les bentos des comptes suivis. Retenu sur le
 * téléphone : on retrouve le fil qu'on a laissé.
 */
export type TableFilter = 'all' | 'following';

type TableFilterState = {
  filter: TableFilter;
  setFilter: (filter: TableFilter) => void;
};

export const useTableFilter = create<TableFilterState>()(
  persist(
    (set) => ({
      filter: 'all',
      setFilter: (filter) => set({ filter }),
    }),
    {
      name: 'bento-pop-table-filter',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ filter: s.filter }),
    },
  ),
);
