import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
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

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN n'a pas de fragment URL
  },
});
