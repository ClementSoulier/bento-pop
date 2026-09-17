import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, AppState, InteractionManager, Platform, type AppStateStatus } from 'react-native';
import { supabase } from '@/supabase/client';
import { useSession } from '@/state/session';
import {
  PUSH_ASK_ACCEPT,
  PUSH_ASK_LATER,
  PUSH_ASK_MESSAGE,
  pushAskTitle,
  refreshPushRegistration,
  shouldOfferPushAsk,
  type PushPermission,
  type PushPlatform,
  type PushRegistrationDeps,
  type PushRegistrationMemory,
  type PushRegistrationOutcome,
} from './push';

/**
 * Notifications push, le branchement sur `expo-notifications` et Supabase.
 * Chantier 17, lot 2. Toute la décision est dans `push.ts`, testée.
 *
 * Deux entrées, et aucune ne bloque ni ne lève :
 *
 * - `startPushRegistration`, au démarrage : réenregistre l'appareil à chaque
 *   ouverture et à chaque retour au premier plan, **sans jamais rien
 *   demander** ;
 * - `offerPushAfterProposal`, juste après une proposition d'item (D5) : la
 *   phrase de l'app, puis la boîte du système sur « Oui » seulement (D14).
 */

const platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

let memory: PushRegistrationMemory = null;
let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

/**
 * Un canal par régime (§1.4), pour qu'Android laisse couper l'un sans l'autre
 * depuis ses propres réglages. Il doit exister avant la demande
 * d'autorisation, à partir d'Android 13.
 */
async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('items', {
    name: 'Mes items',
    description: "Quand l'équipe valide, fusionne ou refuse un item que tu as proposé.",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('editions', {
    name: 'Les éditions',
    description: 'Quand une nouvelle édition sort.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function readPermission(): Promise<PushPermission> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted, canAskAgain };
}

function easProjectId(): string {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!id) throw new Error('Identifiant de projet EAS introuvable dans la configuration.');
  return id;
}

const deps: PushRegistrationDeps = {
  platform,
  userId: () => useSession.getState().user?.id ?? null,
  permission: readPermission,
  expoToken: async () => {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId() });
    return data;
  },
  register: async (token, p) => {
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: p,
    });
    if (error) throw error;
  },
  now: () => Date.now(),
};

/** Réenregistre l'appareil si l'autorisation est accordée. Ne demande rien. */
export async function refreshPush(force = false): Promise<PushRegistrationOutcome> {
  const result = await refreshPushRegistration(deps, memory, { force });
  memory = result.memory;
  if (result.outcome.state === 'failed') {
    // Journal seulement : l'app fonctionne exactement pareil sans
    // notification (§2, critère 7), rien ne s'affiche.
    console.warn(`[push] enregistrement impossible, étape ${result.outcome.step}`, result.outcome.error);
  }
  return result.outcome;
}

/**
 * Au démarrage, une fois la session posée. Idempotent : le suivi du premier
 * plan ne s'attache qu'une fois.
 */
export function startPushRegistration(): void {
  ensureAndroidChannels().catch((err) => console.warn('[push] canaux Android', err));
  void refreshPush();

  if (!appStateListener) {
    appStateListener = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void refreshPush();
    });
  }
}

/**
 * Juste après une proposition d'item (D5).
 *
 * Autorisation déjà accordée : l'appareil se réenregistre, rien ne s'affiche.
 * Sinon, si le système peut encore demander, la phrase de l'app d'abord, et la
 * boîte du système sur « Oui » seulement (D14) : iOS ne la montre qu'une fois,
 * un refus par réflexe serait définitif. « Plus tard » ne retient rien, la
 * phrase reviendra à la proposition suivante.
 */
export async function offerPushAfterProposal(itemTitle: string): Promise<void> {
  try {
    await ensureAndroidChannels();
    const permission = await readPermission();
    if (permission.granted) {
      await refreshPush(true);
      return;
    }
    if (!shouldOfferPushAsk(permission)) return;

    // La modale de recherche se ferme : une alerte présentée pendant
    // l'animation de fermeture peut être perdue sur iOS.
    await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));

    Alert.alert(pushAskTitle(itemTitle), PUSH_ASK_MESSAGE, [
      { text: PUSH_ASK_LATER, style: 'cancel' },
      { text: PUSH_ASK_ACCEPT, isPreferred: true, onPress: () => void acceptPush() },
    ]);
  } catch (err) {
    console.warn('[push] demande après proposition', err);
  }
}

async function acceptPush(): Promise<void> {
  try {
    const { granted } = await Notifications.requestPermissionsAsync({
      // Pas de pastille sur l'icône : aucune notification ne la tiendrait à jour.
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    if (granted) await refreshPush(true);
  } catch (err) {
    console.warn('[push] autorisation', err);
  }
}
