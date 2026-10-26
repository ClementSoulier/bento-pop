import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { authStorageKey } from '@/lib/boot-session';
import { PUBLIC_READS_AUTH_OPTIONS } from './public-reads';
import type { Database } from './types';

/**
 * Client Supabase pour l'app mobile.
 *
 * - Anonymous Sign-In au 1er lancement (cf. `src/state/session.ts`)
 * - Session persistée via AsyncStorage (pas SecureStore : Supabase a
 *   besoin de pouvoir refresh le token en background, et SecureStore
 *   bloque sur iOS si l'app n'est pas active)
 */
function getEnv(key: string): string {
  const value = Constants.expoConfig?.extra?.[key] ?? process.env[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing env var: ${key} (set in app.config.ts → extra)`);
  }
  return value;
}

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

/**
 * La clé de la session dans le stockage, celle que `supabase-js` calcule seul.
 * Donnée explicitement pour que le lancement la lise sans passer par le
 * client (chantier 28, D5) ; la même que toujours, sans quoi chaque téléphone
 * perdrait sa session en passant à cette version, cf. `boot-session.ts`.
 */
export const AUTH_STORAGE_KEY = authStorageKey(SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN n'a pas de fragment URL
  },
});

/**
 * Un client à part pour vérifier un code de reconnexion, chantier 28 : sans
 * stockage ni renouvellement, il rend la session du compte retrouvé sans
 * toucher celle du téléphone, qui doit encore effacer le compte vide qu'on
 * abandonne (D2). Cf. `confirmSignInCode`.
 */
export function createSignInClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'bento-pop-sign-in',
    },
  });
}

/**
 * Client des lectures publiques, sans session : il n'attend jamais le
 * renouvellement de celle du client principal. Réservé à ce que n'importe
 * quel visiteur peut lire, cf. `public-reads.ts`.
 */
export const publicSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: PUBLIC_READS_AUTH_OPTIONS,
});
