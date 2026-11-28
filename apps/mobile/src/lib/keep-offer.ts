import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ask, celebrate } from '@/state/ask';
import { offerEditorialConsent } from './push-runtime';

/**
 * La feuille « Garde ton bento », chantier 28 (D4, D11), une demande de la file
 * depuis le chantier 32 (D10, `u02`) : Popy « bisou », et ses confettis quand
 * elle suit une publication.
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

export const KEEP_ASK_TITLE = 'Garde ton bento';
export const KEEP_ASK_MESSAGE =
  "Si tu changes de téléphone ou réinstalles l'app, ton adresse email suffira pour retrouver ton pseudo et tes bentos.";
export const KEEP_ASK_ACCEPT = 'Garder mon compte';
export const KEEP_ASK_LATER = 'Plus tard';

/** Une proposition à la fois : la publication et le composer peuvent y arriver ensemble. */
let offering = false;
let editorialAfter = false;

export async function offerKeepAccount({
  userId,
  kept,
  thenEditorial,
  celebration = false,
}: {
  userId: string;
  kept: boolean;
  thenEditorial: boolean;
  /**
   * La publication vient d'avoir lieu (D13) : les confettis tombent sur la
   * feuille, ou sur l'écran quand elle ne se propose pas.
   */
  celebration?: boolean;
}): Promise<void> {
  const fallback = () => {
    if (celebration) celebrate();
    if (thenEditorial) void offerEditorialConsent();
  };
  if (kept || offering) return fallback();
  offering = true;
  try {
    const already = (await AsyncStorage.getItem(offeredKey(userId)).catch(() => null)) !== null;
    if (already) return fallback();
    await AsyncStorage.setItem(offeredKey(userId), new Date().toISOString()).catch(() => {});
  } finally {
    offering = false;
  }
  editorialAfter = thenEditorial;
  const answer = await ask({
    key: 'keep',
    mood: 'bisou',
    title: KEEP_ASK_TITLE,
    message: KEEP_ASK_MESSAGE,
    primary: KEEP_ASK_ACCEPT,
    secondary: KEEP_ASK_LATER,
    confetti: celebration,
  });
  // « Garder mon compte » ouvre l'écran du même nom, qui prend le relais de
  // l'accord des éditions à sa fermeture (D11) ; sinon l'accord suit tout de suite.
  if (answer === 'primary') router.push('/account/keep');
  else releaseEditorialOffer();
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
