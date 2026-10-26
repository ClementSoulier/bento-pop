import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { offerEditorialConsent } from './push-runtime';

/**
 * La feuille « Garde ton bento », chantier 28 (D4, D11).
 *
 * Elle se propose une fois par compte : juste après la première publication,
 * et, pour un compte qui a publié avant la nouvelle version, à son premier
 * passage sur le composer. Jamais pour un compte déjà gardé.
 *
 * Juste après la publication, l'accord des éditions du chantier 17 (D20 du
 * 17) attendait aussi : deux questions d'un coup. La feuille passe d'abord,
 * l'accord suit quand on la quitte, ou quand on quitte l'écran « Garde ton
 * compte » qu'elle ouvre.
 */

const offeredKey = (userId: string) => `bp_keep_offered:${userId}`;

/** Une proposition à la fois : la publication et le composer peuvent y arriver ensemble. */
let offering = false;
let editorialAfter = false;

export async function offerKeepAccount({
  userId,
  kept,
  thenEditorial,
}: {
  userId: string;
  kept: boolean;
  thenEditorial: boolean;
}): Promise<void> {
  const fallback = () => {
    if (thenEditorial) void offerEditorialConsent();
  };
  if (kept || offering) return fallback();
  offering = true;
  try {
    const already = (await AsyncStorage.getItem(offeredKey(userId)).catch(() => null)) !== null;
    if (already) return fallback();
    await AsyncStorage.setItem(offeredKey(userId), new Date().toISOString()).catch(() => {});
    editorialAfter = thenEditorial;
    router.push('/account/keep-offer');
  } finally {
    offering = false;
  }
}

/**
 * La feuille ou l'écran « Garde ton compte » qu'elle a ouvert se ferme :
 * l'accord des éditions, s'il attendait.
 */
export function releaseEditorialOffer(): void {
  if (!editorialAfter) return;
  editorialAfter = false;
  void offerEditorialConsent();
}
