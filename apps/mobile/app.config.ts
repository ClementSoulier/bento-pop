import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Injection des variables d'env dans `extra` (consommées par
 * `src/supabase/client.ts` via `Constants.expoConfig.extra`).
 *
 * `config` est le résultat du merge automatique app.json + valeurs par
 * défaut d'Expo CLI ; on ne ré-importe donc PAS app.json (sinon expo
 * doctor signale un duplicate « app.config.ts is not using the values
 * from app.json »).
 *
 * Au dev : depuis `.env` local (chargé par Expo).
 * Au build EAS : depuis `eas.json` → `env` (jamais commit secrets).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // `name` et `slug` sont obligatoires côté ExpoConfig même quand on
  // spread un ConfigContext.config ; on les force depuis le merge.
  name: config.name ?? 'Mon Bento Pop',
  slug: config.slug ?? 'mon-bento-pop',
  extra: {
    ...config.extra,
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    TMDB_TOKEN: process.env.EXPO_PUBLIC_TMDB_TOKEN,
  },
});
