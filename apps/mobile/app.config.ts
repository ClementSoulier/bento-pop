import type { ExpoConfig } from 'expo/config';
import baseConfig from './app.json';

/**
 * Injection des variables d'env dans `extra` (consommées par
 * `src/supabase/client.ts` via `Constants.expoConfig.extra`).
 *
 * Au dev : depuis `.env` local (chargé par Expo).
 * Au build EAS : depuis l'env « production » sur EAS (cf. eas env:list).
 *
 * NB : on garde le double-import explicite (app.json → app.config.ts)
 * même si `expo doctor` signale un warning « app.config.ts is not using
 * the values from app.json » — la version « ConfigContext » plus propre
 * a coïncidé avec un crash au lancement en production. À ré-essayer plus
 * tard avec une investigation dédiée.
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
