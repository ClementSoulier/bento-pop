import type { ComposeCta } from './compose-cta';

/**
 * Le rappel d'un bento prêt, chantier 8, lot 4. Toute la décision, pure et
 * testée ; le branchement sur `expo-notifications` vit dans `push-runtime.ts`.
 *
 * Un bento est **prêt** quand le composer dit « Publier mon bento » et qu'il
 * n'a jamais été publié (D1) : un brouillon sans profil l'est toujours, un
 * bento en base l'est tant que sa date de première publication est vide. Un
 * bento dépublié ne l'est jamais : son auteur l'a retiré.
 *
 * Le rappel se propose une seule fois par bento (D5) : en quittant le
 * composer pour un autre onglet, en revenant de l'écran du pseudo sans avoir
 * publié, ou par le lien « Me le rappeler demain » (D10). Accepté, c'est une
 * notification locale, programmée par le téléphone (D11) : le premier 18 h
 * qui tombe au moins 12 heures plus tard.
 *
 * N'importe rien d'autre qu'un type : chargeable sous `node:test`.
 * Cf. `docs/UX-08-SIGNAUX-DE-RETOUR.md` §5.3.
 */

/** Un brouillon sans profil, le premier bento d'un compte : un seul par téléphone. */
export const DRAFT_REMINDER_KEY = 'draft';

/** `ready-bento:<id du bento>`, ou `ready-bento:draft`. */
export const REMINDER_ID_PREFIX = 'ready-bento:';

export function reminderIdentifier(key: string): string {
  return `${REMINDER_ID_PREFIX}${key}`;
}

/** La clé d'un rappel programmé, ou `null` pour une autre notification. */
export function reminderKeyFromIdentifier(identifier: string): string | null {
  return identifier.startsWith(REMINDER_ID_PREFIX)
    ? identifier.slice(REMINDER_ID_PREFIX.length) || null
    : null;
}

export type ReadyInput = {
  /** Ce que rend `composeCta` pour le bento édité. */
  cta: ComposeCta['kind'];
  /** La première lecture du bento a répondu. */
  hydrated: boolean;
  hasProfile: boolean;
  /** Le bento édité, en base ; `null` pour le brouillon d'un compte sans profil. */
  current: { id: string; firstPublishedAt: string | null } | null;
};

/**
 * La clé du bento prêt, ou `null` s'il ne l'est pas. Sans profil, c'est le
 * brouillon du téléphone ; avec, le bento édité, s'il n'a jamais été publié.
 */
export function readyReminderKey(input: ReadyInput): string | null {
  if (!input.hydrated || input.cta !== 'publish') return null;
  if (!input.hasProfile) return DRAFT_REMINDER_KEY;
  if (!input.current || input.current.firstPublishedAt !== null) return null;
  return input.current.id;
}

/** Ce que le système permet, lu par `getPermissionsAsync`. */
export type ReminderPermission = { granted: boolean; canAskAgain: boolean };

/**
 * La question au départ, et le lien : seulement pour un bento prêt, pas
 * encore répondu, et un système qui accorde ou peut encore demander. Après
 * un refus sur iOS, ou le second sur Android, plus rien ne s'affiche :
 * proposer un rappel qui ne pourrait pas arriver serait mentir.
 */
export function shouldOfferReminder(input: {
  readyKey: string | null;
  answered: boolean;
  permission: ReminderPermission | null;
}): boolean {
  if (input.readyKey === null || input.answered || input.permission === null) return false;
  return input.permission.granted || input.permission.canAskAgain;
}

const HOUR_MS = 60 * 60 * 1000;
/** 18 h, l'heure où l'on rouvre son téléphone, comme les éditions du jeudi (D20 du 17). */
export const REMINDER_HOUR = 18;
/** Au moins 12 heures entre le départ et le rappel : quitté à 3 h, rappelé à 18 h. */
export const REMINDER_MIN_DELAY_MS = 12 * HOUR_MS;

/**
 * Le premier 18 h, heure du téléphone, qui tombe au moins 12 heures après
 * `now` : quitté à 10 h, le lendemain à 18 h ; à 20 h, le lendemain ; à 3 h,
 * le jour même. Les jours s'avancent par le calendrier local, et non de 24
 * heures : un changement d'heure ne décale pas le rappel.
 */
export function nextReminderDate(now: Date): Date {
  const earliest = now.getTime() + REMINDER_MIN_DELAY_MS;
  const candidate = new Date(now);
  candidate.setHours(REMINDER_HOUR, 0, 0, 0);
  while (candidate.getTime() < earliest) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

/** « demain à 18 h », ou « aujourd'hui à 18 h » quand on part en pleine nuit. */
export function reminderWhenLabel(now: Date, date: Date): string {
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  return `${sameDay ? "aujourd'hui" : 'demain'} à ${REMINDER_HOUR} h`;
}

/** Le titre de la notification : 18 caractères, sous les 28 qu'un titre montre (D24 du 17). */
export const REMINDER_TITLE = 'Ton bento est prêt';

/**
 * Le texte de la notification. Le bento principal et le brouillon n'ont pas
 * besoin d'être nommés ; un bento secondaire ou d'édition, si : son auteur
 * peut en avoir plusieurs en cours.
 */
export function reminderBody(bento: { isPrimary: boolean; name: string } | null): string {
  if (!bento || bento.isPrimary) return "Publie-le pour qu'il rejoigne La table.";
  return `« ${bento.name} » n'attend plus que toi : publie-le pour qu'il rejoigne La table.`;
}

/** La question au départ, une alerte native comme celles du chantier 17. */
export const REMINDER_ASK_TITLE = 'Ton bento est prêt';
export const REMINDER_ASK_MESSAGE = "On te le rappelle demain s'il n'est pas publié ?";
export const REMINDER_ASK_ACCEPT = 'Oui, rappelle-moi';
export const REMINDER_ASK_DECLINE = 'Non merci';
/** Le lien sous « Publier mon bento », pour un départ que rien n'intercepte (D10). */
export const REMINDER_LINK_LABEL = 'Me le rappeler demain';

/**
 * Les rappels programmés qui n'ont plus lieu d'être, à annuler au lancement
 * et à chaque changement du bento édité :
 *
 * - le brouillon, dès que le compte a un profil : il est devenu un bento en
 *   base, publié ;
 * - un bento en base qui a été publié, ou que le compte n'a plus ;
 * - le bento édité, s'il a cessé d'être prêt (une case vidée, un item
 *   remplacé par une proposition en attente).
 *
 * Un autre bento du compte, pas encore relu, garde son rappel : sans ses
 * cases, rien ne dit qu'il a cessé d'être prêt. Et tant que la liste du
 * compte n'est pas lue, aucun bento en base n'est annulé : une liste vide
 * passerait pour des bentos supprimés.
 */
export function remindersToCancel(input: {
  scheduledKeys: readonly string[];
  hasProfile: boolean;
  /** La liste des bentos du compte a été lue. */
  ownKnown: boolean;
  own: readonly { id: string; publishedAt: string | null; firstPublishedAt: string | null }[];
  /** Le bento édité, en base, ou `null` pour le brouillon ; `undefined` avant la première lecture. */
  editedKey: string | null | undefined;
  /** La clé du bento prêt, telle que la rend `readyReminderKey`. */
  readyKey: string | null;
}): string[] {
  return input.scheduledKeys.filter((key) => {
    if (key === DRAFT_REMINDER_KEY) {
      return input.hasProfile || (input.editedKey === null && input.readyKey === null);
    }
    if (!input.ownKnown) return false;
    const bento = input.own.find((b) => b.id === key);
    if (!bento) return input.hasProfile;
    if (bento.publishedAt !== null || bento.firstPublishedAt !== null) return true;
    return input.editedKey === key && input.readyKey !== key;
  });
}
