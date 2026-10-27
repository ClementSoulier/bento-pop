import type { PopyKey } from '@bento-pop/supabase-mobile/bento';
import type { NotificationKind, NotificationRow } from '@/supabase/types';
import { ACHIEVEMENTS, isAchievementKey } from './achievements';
import { bentoRoute } from './bento-address';
import type { PushTarget } from './push';
import { relativeDate } from './relative-date';

/**
 * La zone de notifications, chantier 24 : de la ligne que rend
 * `list_notifications` à ce que l'écran montre. La base regroupe et compte
 * (D6, D8) ; ici, les phrases, les avatars, les destinations et le nombre de
 * la pastille, sans React ni réseau, pour être testés.
 */

/** Lignes par page, comme `list_notifications` (D22). */
export const NOTIFICATION_PAGE = 30;

/** Au-delà, la pastille dit « 9+ ». */
export const BADGE_CAP = 9;

/** Le curseur de la page suivante : la date et la clé de la dernière ligne lue. */
export type NotificationCursor = { before: string; beforeKey: string } | null;

/** Un morceau de phrase ; les pseudos sont en gras. */
export type NotificationPart = { text: string; strong?: true };

export type NotificationAvatar =
  /** Le Popy d'un compte : l'auteur d'un commentaire, un abonné, un compte suivi. */
  | { kind: 'account'; pseudo: string; avatar: string | null }
  /** Un like ne dit jamais qui (D7) : un cœur. */
  | { kind: 'like' }
  /** Une décision de l'équipe (D2) : le Popy de Bento Pop. */
  | { kind: 'team' }
  /** Un succès du chantier 27 (D14) : le Popy de sa médaille. */
  | { kind: 'achievement'; popy: PopyKey };

export type NotificationTarget =
  | { kind: 'page'; href: `/u/${string}` }
  | { kind: 'comments'; bentoId: string }
  | { kind: 'followers'; userId: string; pseudo: string }
  /** Le tap du push du 17, suivi par le composer (D10). */
  | { kind: 'push'; target: PushTarget }
  | { kind: 'whys'; bentoId: string; pseudo: string; slug: string | null };

export type Notification = {
  /** Unique dans la liste : un sujet a au plus une moitié nouvelle et une plus tôt. */
  key: string;
  kind: NotificationKind;
  isNew: boolean;
  at: string;
  parts: NotificationPart[];
  text: string;
  avatar: NotificationAvatar;
  target: NotificationTarget | null;
};

/** Qui lit : son identifiant et son pseudo, pour nommer son bento et ouvrir ses listes. */
export type NotificationViewer = { id: string; pseudo: string };

const COUNT = new Intl.NumberFormat('fr-FR');
/** Au-delà, le texte d'un commentaire s'arrête sur une ellipse. */
const EXCERPT_MAX = 80;

const at = (pseudo: string): NotificationPart => ({ text: `@${pseudo}`, strong: true });
const plain = (text: string): NotificationPart => ({ text });

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= EXCERPT_MAX) return flat;
  return `${flat.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
}

function quoted(title: string): string {
  return `« ${title} »`;
}

/** « ton bento », ou « ton bento « Le film de ta vie » » pour une édition (D24). */
function bentoName(row: NotificationRow, possessive: 'ton' | 'son'): string {
  return row.edition_title ? `${possessive} bento ${quoted(row.edition_title)}` : `${possessive} bento`;
}

/**
 * Les auteurs d'un sujet : un, deux nommés, ou le plus récent et les autres
 * comptés. `actors` compte les auteurs distincts, `pseudos` nomme les deux
 * plus récents.
 */
function authors(pseudos: string[], actors: number): { parts: NotificationPart[]; plural: boolean } {
  const [first, second] = pseudos;
  if (!first) return { parts: [plain("Quelqu'un")], plural: false };
  if (actors <= 1) return { parts: [at(first)], plural: false };
  if (actors === 2 && second) return { parts: [at(first), plain(' et '), at(second)], plural: true };
  const others = Math.max(actors - 1, 1);
  return {
    parts: [at(first), plain(` et ${COUNT.format(others)} ${others > 1 ? 'autres' : 'autre'}`)],
    plural: true,
  };
}

function itemTitles(row: NotificationRow): string {
  const [first, second] = row.item_titles;
  const shown = [first, second].filter((t): t is string => Boolean(t)).map(quoted);
  const rest = row.events - shown.length;
  if (rest > 0) return `${shown.join(', ')} et ${COUNT.format(rest)} ${rest > 1 ? 'autres' : 'autre'}`;
  return shown.join(' et ');
}

/** La phrase d'une ligne, en morceaux (§2 de la spécification). */
export function notificationParts(row: NotificationRow, viewer: NotificationViewer): NotificationPart[] {
  switch (row.kind) {
    case 'like': {
      const n = row.events;
      const who = n > 1 ? `${COUNT.format(n)} personnes ont` : '1 personne a';
      return [plain(`${who} aimé ${bentoName(row, 'ton')}`)];
    }
    case 'comment': {
      const { parts, plural } = authors(row.actor_pseudos, row.actors);
      const verb = plural ? ' ont commenté ' : ' a commenté ';
      const tail = row.detail ? ` : ${quoted(excerpt(row.detail))}` : '';
      return [...parts, plain(`${verb}${bentoName(row, 'ton')}${tail}`)];
    }
    case 'follow': {
      const { parts, plural } = authors(row.actor_pseudos, row.actors);
      return [...parts, plain(plural ? ' te suivent' : ' te suit')];
    }
    case 'follow_request': {
      const { parts, plural } = authors(row.actor_pseudos, row.actors);
      return [...parts, plain(plural ? ' demandent à te suivre' : ' demande à te suivre')];
    }
    case 'followed_bento': {
      const owner = row.owner_pseudo ?? row.actor_pseudos[0];
      return [owner ? at(owner) : plain('Un compte que tu suis'), plain(` a publié ${bentoName(row, 'son')}`)];
    }
    case 'item_validated': {
      const many = row.events > 1;
      return [plain(`${many ? 'Tes items' : 'Ton item'} ${itemTitles(row)} ${many ? 'sont validés' : 'est validé'}`)];
    }
    case 'item_rejected': {
      const reason = row.detail ? ` : ${row.detail}` : '';
      return [plain(`Ton item ${itemTitles(row)} est refusé${reason}`)];
    }
    case 'bento_published': {
      const name = row.edition_title ? `Ton bento ${quoted(row.edition_title)}` : 'Ton bento';
      return [plain(`${name} est publié : tous ses items sont validés`)];
    }
    case 'comment_hidden': {
      const own = row.owner_pseudo === null || row.owner_pseudo === viewer.pseudo;
      const reason = row.detail ? ` : ${row.detail}` : '';
      return own
        ? [plain(`L'équipe a masqué ton commentaire sur ${bentoName(row, 'ton')}${reason}`)]
        : [plain("L'équipe a masqué ton commentaire sur le bento de "), at(row.owner_pseudo ?? ''), plain(reason)];
    }
    case 'why_hidden': {
      const title = row.item_titles[0];
      const reason = row.detail ? ` : ${row.detail}` : '';
      return [plain(`L'équipe a masqué ton pourquoi${title ? ` sur ${quoted(title)}` : ''}${reason}`)];
    }
    case 'achievement': {
      // Une clé ajoutée en base avant cette version se lit sans son nom.
      const key = isAchievementKey(row.detail) ? row.detail : null;
      return [plain(key ? `Succès débloqué : ${ACHIEVEMENTS[key].title}` : 'Nouveau succès débloqué')];
    }
  }
}

function avatarOf(row: NotificationRow): NotificationAvatar {
  switch (row.kind) {
    case 'like':
      return { kind: 'like' };
    case 'comment':
    case 'follow':
    case 'follow_request':
    case 'followed_bento': {
      const pseudo = row.kind === 'followed_bento' ? (row.owner_pseudo ?? row.actor_pseudos[0]) : row.actor_pseudos[0];
      return pseudo ? { kind: 'account', pseudo, avatar: row.actor_avatar } : { kind: 'team' };
    }
    case 'achievement':
      return isAchievementKey(row.detail) ? { kind: 'achievement', popy: ACHIEVEMENTS[row.detail].popy } : { kind: 'team' };
    default:
      return { kind: 'team' };
  }
}

function pageOf(row: NotificationRow): NotificationTarget | null {
  if (!row.owner_pseudo) return null;
  return { kind: 'page', href: bentoRoute(row.owner_pseudo, row.bento_slug, row.bento_primary ?? true) };
}

/** Où mène le tap (§5) ; `null` quand la ligne ne porte pas de quoi y aller. */
export function notificationTarget(row: NotificationRow, viewer: NotificationViewer): NotificationTarget | null {
  switch (row.kind) {
    case 'like':
    case 'followed_bento':
    case 'bento_published':
      return pageOf(row);
    case 'comment':
    case 'comment_hidden':
      return row.bento_id ? { kind: 'comments', bentoId: row.bento_id } : null;
    case 'follow':
    case 'follow_request':
      return { kind: 'followers', userId: viewer.id, pseudo: viewer.pseudo };
    case 'item_validated':
    case 'item_rejected': {
      const status = row.item_status;
      if (!row.item_id || !status) return null;
      return {
        kind: 'push',
        target: { kind: 'item', status, itemId: row.item_id, keptItemId: row.kept_item_id, publishedBentoId: null },
      };
    }
    case 'why_hidden':
      return row.bento_id && row.owner_pseudo
        ? { kind: 'whys', bentoId: row.bento_id, pseudo: row.owner_pseudo, slug: row.bento_primary ? null : row.bento_slug }
        : null;
    // D14 : sa page, où la médaille l'attend.
    case 'achievement':
      return { kind: 'page', href: `/u/${viewer.pseudo}` };
  }
}

export function toNotification(row: NotificationRow, viewer: NotificationViewer): Notification {
  const parts = notificationParts(row, viewer);
  return {
    key: `${row.group_key}|${row.is_new ? 'new' : 'old'}`,
    kind: row.kind,
    isNew: row.is_new,
    at: row.latest_at,
    parts,
    text: parts.map((p) => p.text).join(''),
    avatar: avatarOf(row),
    target: notificationTarget(row, viewer),
  };
}

/** Ce que lit le lecteur d'écran (D20) : la phrase, « nouveau », et l'heure. */
export function notificationAccessibilityLabel(n: Notification, now: number = Date.now()): string {
  const when = relativeDate(n.at, now);
  return [n.text, n.isNew ? 'nouveau' : null, when || null].filter(Boolean).join(', ');
}

/** Les deux sections de l'écran, sans celle qui serait vide. */
export function notificationSections(items: Notification[]): { title: string; data: Notification[] }[] {
  const fresh = items.filter((n) => n.isNew);
  const earlier = items.filter((n) => !n.isNew);
  return [
    ...(fresh.length > 0 ? [{ title: 'Nouveau', data: fresh }] : []),
    ...(earlier.length > 0 ? [{ title: 'Plus tôt', data: earlier }] : []),
  ];
}

/** La page suivante, ou `null` quand celle-ci était la dernière. */
export function notificationCursor(page: readonly NotificationRow[]): NotificationCursor {
  if (page.length < NOTIFICATION_PAGE) return null;
  const last = page[page.length - 1];
  return last ? { before: last.latest_at, beforeKey: last.group_key } : null;
}

/**
 * La date à poser comme lue (D8) : celle de la ligne la plus récente que
 * l'écran montre, la première. Ce qui arrive ensuite reste nouveau.
 */
export function seenUntil(rows: readonly NotificationRow[]): string | null {
  return rows[0]?.latest_at ?? null;
}

/** Le texte de la pastille ; `null` quand il n'y a rien de nouveau. */
export function badgeText(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(Math.floor(count));
}

/** Le libellé de l'onglet pour le lecteur d'écran (D20). */
export function notificationsTabLabel(count: number, position: number, total: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const news = n === 0 ? '' : `, ${COUNT.format(n)} ${n > 1 ? 'nouvelles' : 'nouvelle'}`;
  return `Notifications${news}, onglet ${position} sur ${total}`;
}
