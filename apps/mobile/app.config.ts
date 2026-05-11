import type { ExpoConfig } from 'expo/config';
import baseConfig from './app.json';

/**
 * Injection des variables d'env dans `extra` (consommées par
 * `src/supabase/client.ts` via `Constants.expoConfig.extra`).
 *
 * Au dev : depuis `.env` local (chargé par Expo).
 * Au build EAS : depuis `eas.json` → `env` (jamais commit secrets).
 */
const config = baseConfig as { expo: ExpoConfig };

export default (): ExpoConfig => ({
  ...config.expo,
  extra: {
    ...config.expo.extra,
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    TMDB_TOKEN: process.env.EXPO_PUBLIC_TMDB_TOKEN,
  },
});
