/**
 * Ce que disent les notifications, et ce qu'elles portent. Chantier 17, §5.1.
 *
 * Le texte nomme l'item, pas l'action : « Interstellar est validé » dit
 * quelque chose, « un de vos items a été modéré » ne dit rien.
 */

export type PushKind = 'item_moderated' | 'edition_released';
export type ModerationStatus = 'validated' | 'merged' | 'rejected';

/**
 * Les canaux Android que l'app crée avant toute demande (lot 2,
 * `apps/mobile/src/lib/push-runtime.ts`). D'après Expo, un canal absent de
 * l'appareil et la notification ne s'affiche pas : ces noms ne bougent pas.
 */
export const PUSH_CHANNEL: Record<PushKind, string> = {
  item_moderated: 'items',
  edition_released: 'editions',
};

/** Au-delà, un titre se coupe : le système n'en montre pas plus sur une ligne. */
export const PUSH_TITLE_MAX = 60;
/** Une raison de refus s'écrit au back-office, sans limite. */
export const PUSH_REASON_MAX = 200;

export type PushText = { title: string; body: string };

/**
 * Espaces resserrés, et coupe sur un mot quand elle ne perd pas trop.
 * Compte en caractères, pas en unités UTF-16 : un emoji ne se coupe pas en
 * deux.
 */
export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  const cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  const base = space >= cut.length * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.!?'-]+$/u, '')}…`;
}

/** « Titre », ou `null` si le titre est vide. Mêmes guillemets que l'app. */
function quoted(title: string | null | undefined): string | null {
  const short = shorten(title ?? '', PUSH_TITLE_MAX);
  return short ? `« ${short} »` : null;
}

/**
 * Un item proposé vient d'être modéré. Pour une fusion, l'auteur voit le
 * titre de l'item conservé : c'est lui qui remplit désormais sa case (D12).
 */
export function itemModeratedText(input: {
  status: ModerationStatus;
  title: string;
  keptTitle?: string | null;
  reason?: string | null;
}): PushText {
  if (input.status === 'rejected') {
    const name = quoted(input.title);
    const reason = shorten(input.reason ?? '', PUSH_REASON_MAX);
    return {
      title: name ? `${name} n'a pas été retenu` : "Ton item n'a pas été retenu",
      body: reason || 'Tu peux choisir un autre item pour cette case.',
    };
  }

  const shown =
    input.status === 'merged' && input.keptTitle?.trim() ? input.keptTitle : input.title;
  const name = quoted(shown);
  return {
    title: name ? `${name} est validé` : 'Ton item est validé',
    body: 'Ta case est en ligne.',
  };
}

/** Une édition vient de sortir. Son titre tient en 30 caractères. */
export function editionReleasedText(title: string): PushText {
  const name = quoted(title);
  return {
    title: name ? `${name} est sortie` : 'Une nouvelle édition est sortie',
    body: 'Compose ton bento de la semaine.',
  };
}

/**
 * Le message Expo d'un appareil. `data` ne porte que le type et des
 * identifiants, jamais d'adresse : l'app du lot 4 ouvre un écran qu'elle
 * connaît, rien d'autre (§6.5).
 */
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string | number>;
  channelId: string;
  sound: 'default';
  priority: 'default';
  /** En secondes. Absent, chaque service applique sa durée par défaut. */
  ttl?: number;
};

export function buildMessage(
  token: string,
  kind: PushKind,
  text: PushText,
  data: Record<string, string | number>,
  ttl?: number,
): PushMessage {
  return {
    to: token,
    title: text.title,
    body: text.body,
    data: { type: kind, ...data },
    channelId: PUSH_CHANNEL[kind],
    sound: 'default',
    priority: 'default',
    ...(ttl === undefined ? {} : { ttl }),
  };
}
