import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import { supabase } from '@/supabase/client';
import { useSession } from '@/state/session';
import {
  EDITORIAL_ASK_ACCEPT,
  EDITORIAL_ASK_DECLINE,
  EDITORIAL_ASK_MESSAGE,
  EDITORIAL_ASK_TITLE,
  PUSH_ASK_ACCEPT,
  PUSH_ASK_LATER,
  PUSH_ASK_MESSAGE,
  coalescePushRefresh,
  pushAskTitle,
  pushTargetFromData,
  refreshPushRegistration,
  shouldOfferEditorialAsk,
  shouldOfferPushAsk,
  type ChannelBlocks,
  type DeviceSettings,
  type PushPermission,
  type PushPlatform,
  type PushRegistrationDeps,
  type PushRegistrationMemory,
  type PushRegistrationOutcome,
  type PushTarget,
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
 *
 * Le lot 4 ajoute la bannière au premier plan (D23), le tap qui ouvre le bon
 * écran (`startPushResponses`), les réglages de l'appareil pour le profil, et
 * l'accord éditorial après une publication ou une première édition (D20).
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

export async function readPermission(): Promise<PushPermission> {
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

const refresh = coalescePushRefresh(async (force) => {
  const result = await refreshPushRegistration(deps, memory, { force });
  memory = result.memory;
  if (result.outcome.state === 'failed') {
    // Journal seulement : l'app fonctionne exactement pareil sans
    // notification (§2, critère 7), rien ne s'affiche.
    console.warn(`[push] enregistrement impossible, étape ${result.outcome.step}`, result.outcome.error);
  }
  return result.outcome;
});

/**
 * Réenregistre l'appareil si l'autorisation est accordée. Ne demande rien.
 * Une seule tentative à la fois, cf. `coalescePushRefresh`.
 */
export function refreshPush(force = false): Promise<PushRegistrationOutcome> {
  return refresh(force);
}

/**
 * Au démarrage, une fois la session posée. Idempotent : le suivi du premier
 * plan ne s'attache qu'une fois.
 */
export function startPushRegistration(): void {
  showBannersInForeground();
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

    // Pas d'attente de la fermeture de la modale de recherche : sur iOS,
    // React Native présente l'alerte dans sa propre fenêtre, au-dessus de
    // tout (`RCTAlertController.mm`, `alertWindow`). `InteractionManager`,
    // essayé d'abord, est déprécié : il levait un avertissement à chaque fois.
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
    await requestPermissionAndRegister();
  } catch (err) {
    console.warn('[push] autorisation', err);
  }
}

/** La boîte du système, puis l'enregistrement de l'appareil si elle accorde. */
async function requestPermissionAndRegister(): Promise<boolean> {
  await ensureAndroidChannels();
  const { granted } = await Notifications.requestPermissionsAsync({
    // Pas de pastille sur l'icône : aucune notification ne la tiendrait à jour.
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (granted) await refreshPush(true);
  return granted;
}

// ─── Lot 4 : au premier plan, la bannière (D23) ──────────────────────────

let bannersShown = false;

/**
 * Une notification reçue pendant qu'on se sert de l'app s'affiche comme app
 * fermée, et son tap mène au même endroit. Sans ce réglage, iOS la range
 * dans le centre de notifications sans rien montrer.
 */
function showBannersInForeground(): void {
  if (bannersShown) return;
  bannersShown = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ─── Lot 4 : le tap ──────────────────────────────────────────────────────

let lastHandledResponse: string | null = null;

/**
 * Le tap d'une notification, app ouverte comme au démarrage par elle.
 * `onTarget` ne reçoit qu'une cible vérifiée par `pushTargetFromData`,
 * jamais `data` tel quel.
 */
export function startPushResponses(onTarget: (target: PushTarget) => void): () => void {
  // Pas de notification sur le web, que Metro sert aussi : l'appel y lève.
  if (Platform.OS === 'web') return () => {};
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    // Un démarrage par la notification la rend deux fois : par la dernière
    // réponse, et par l'écouteur abonné juste après.
    if (id === lastHandledResponse) return;
    lastHandledResponse = id;
    // Le tap sur la notification elle-même, pas sur un bouton qu'elle porterait.
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const target = pushTargetFromData(response.notification.request.content.data);
    if (target) onTarget(target);
    // Sinon un rechargement de l'app rejouerait le même tap.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };

  Notifications.getLastNotificationResponseAsync()
    .then(handle)
    .catch((err) => console.warn('[push] dernière réponse', err));
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

// ─── Lot 4 : les réglages de cet appareil ────────────────────────────────

/**
 * Les deux réglages de cet appareil (D8), ou `null` s'il n'est pas
 * enregistré. Enregistre d'abord si l'autorisation est accordée et que ce
 * n'est pas encore fait.
 */
export async function readDeviceSettings(): Promise<DeviceSettings | null> {
  let token = memory?.token ?? null;
  if (!token) {
    const outcome = await refreshPush();
    token = outcome.state === 'registered' ? outcome.token : memory?.token ?? null;
  }
  if (!token) return null;

  const { data, error } = await supabase
    .from('push_tokens')
    .select('transactional, editorial')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Règle un type sur cet appareil. La RLS du lot 1 ne laisse écrire que ces
 * deux colonnes, et seulement sur ses propres appareils.
 */
export async function writeDeviceSetting(setting: keyof DeviceSettings, on: boolean): Promise<void> {
  const token = memory?.token;
  if (!token) throw new Error('Cet appareil n’est pas enregistré.');
  const { data, error } = await supabase
    .from('push_tokens')
    .update(setting === 'transactional' ? { transactional: on } : { editorial: on })
    .eq('token', token)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Le réglage n’a pas été enregistré.');
}

/** Android laisse couper un canal depuis ses propres réglages (§1.4). */
export async function readChannelBlocks(): Promise<ChannelBlocks> {
  if (Platform.OS !== 'android') return { items: false, editions: false };
  const [items, editions] = await Promise.all([
    Notifications.getNotificationChannelAsync('items'),
    Notifications.getNotificationChannelAsync('editions'),
  ]);
  const off = (channel: Notifications.NotificationChannel | null) =>
    channel?.importance === Notifications.AndroidImportance.NONE;
  return { items: off(items), editions: off(editions) };
}

/** « Activer les notifications », depuis le profil : un geste explicite, la boîte directement. */
export async function enablePushFromProfile(): Promise<boolean> {
  try {
    return await requestPermissionAndRegister();
  } catch (err) {
    console.warn('[push] activation depuis le profil', err);
    return false;
  }
}

/** Les réglages de l'app dans ceux du téléphone, où se rallument les notifications. */
export function openNotificationSettings(): void {
  Linking.openSettings().catch((err) => console.warn('[push] réglages du téléphone', err));
}

// ─── Lot 4 : l'accord éditorial (D20) ────────────────────────────────────

/** Posée à la première réponse, oui comme non : la phrase ne revient plus. */
const EDITORIAL_ANSWERED_KEY = 'bp_push_editorial_answered';

/**
 * Juste après une publication, ou en rejoignant une première édition (D20).
 * « On te prévient quand une édition sort ? » : une seule fois par téléphone,
 * puis seul l'interrupteur du profil décide. Ne lève jamais.
 */
export async function offerEditorialConsent(): Promise<void> {
  try {
    const alreadyAnswered = (await AsyncStorage.getItem(EDITORIAL_ANSWERED_KEY)) !== null;
    if (alreadyAnswered) return;
    const permission = await readPermission();
    const device = permission.granted ? await readDeviceSettings().catch(() => null) : null;
    if (
      !shouldOfferEditorialAsk({
        permission,
        editorialOn: device?.editorial ?? false,
        alreadyAnswered,
      })
    ) {
      return;
    }

    Alert.alert(EDITORIAL_ASK_TITLE, EDITORIAL_ASK_MESSAGE, [
      { text: EDITORIAL_ASK_DECLINE, style: 'cancel', onPress: () => void rememberEditorialAnswer() },
      { text: EDITORIAL_ASK_ACCEPT, isPreferred: true, onPress: () => void acceptEditorial() },
    ]);
  } catch (err) {
    console.warn('[push] accord éditorial', err);
  }
}

async function rememberEditorialAnswer(): Promise<void> {
  await AsyncStorage.setItem(EDITORIAL_ANSWERED_KEY, new Date().toISOString()).catch(() => {});
}

async function acceptEditorial(): Promise<void> {
  await rememberEditorialAnswer();
  try {
    const { granted } = await readPermission();
    if (!granted && !(await requestPermissionAndRegister())) return;
    if (!memory) await refreshPush(true);
    await writeDeviceSetting('editorial', true);
  } catch (err) {
    console.warn('[push] accord éditorial accepté', err);
  }
}
