import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/supabase/client';
import { withTimeout } from '@/lib/with-timeout';

/**
 * Lecture de la config runtime de l'app (table publique `app_config`).
 *
 * Sert au boot et au retour foreground pour décider si l'app doit afficher
 * un écran maintenance / force update plutôt que l'UI normale. Lecture
 * publique : pas besoin d'auth (et c'est volontaire — l'utilisateur doit
 * voir la maintenance même si l'anonymous sign-in échoue).
 */

const FETCH_TIMEOUT_MS = 4000;

export type AppConfig = {
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  iosMinVersion: string;
  iosLatestVersion: string;
  androidMinVersion: string | null;
  androidLatestVersion: string | null;
};

export type AppStatus = 'ok' | 'maintenance' | 'force_update';

/**
 * Récupère la config depuis Supabase avec timeout. En cas d'échec
 * (réseau, downtime, RLS), renvoie `null` → l'appelant décide de
 * laisser passer (fail-open).
 *
 * Le PostgrestBuilder est thenable mais pas un vrai `Promise` selon TS, on
 * encapsule dans une fonction async pour rentrer dans la signature de
 * `withTimeout`.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  const fetcher = async () =>
    supabase
      .from('app_config')
      .select(
        'maintenance_mode, maintenance_title, maintenance_message, ios_min_version, ios_latest_version, android_min_version, android_latest_version',
      )
      .eq('id', 1)
      .maybeSingle();

  const result = await withTimeout(fetcher(), FETCH_TIMEOUT_MS, null);
  if (!result || result.error || !result.data) return null;

  const r = result.data;
  return {
    maintenanceMode: r.maintenance_mode,
    maintenanceTitle: r.maintenance_title,
    maintenanceMessage: r.maintenance_message,
    iosMinVersion: r.ios_min_version,
    iosLatestVersion: r.ios_latest_version,
    androidMinVersion: r.android_min_version,
    androidLatestVersion: r.android_latest_version,
  };
}

/**
 * Compare deux versions "X.Y.Z". Retourne -1 si a<b, 0 si égales, 1 si a>b.
 * Les segments manquants comptent comme 0. Suffixes non supportés (suffit
 * pour les versions Expo en production).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * Version courante de l'app (depuis app.config.ts → expo.version).
 * Si absente (cas dev très tordu), on renvoie '0.0.0' → toute borne
 * min > 0.0.0 déclenchera le force update, ce qui est le comportement
 * conservateur souhaité.
 */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * Combine config + version + plateforme pour produire le verdict final.
 * `null` config → 'ok' (fail-open).
 */
export function deriveAppStatus(config: AppConfig | null): AppStatus {
  if (!config) return 'ok';
  if (config.maintenanceMode) return 'maintenance';

  const minVersion = Platform.OS === 'ios'
    ? config.iosMinVersion
    : config.androidMinVersion;
  if (!minVersion) return 'ok';

  const current = getCurrentAppVersion();
  return compareVersions(current, minVersion) < 0 ? 'force_update' : 'ok';
}
