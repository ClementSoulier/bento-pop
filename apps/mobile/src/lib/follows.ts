import { followSegment } from '@bento-pop/supabase-mobile/bento';
import type { FollowListRow, FollowStatus, FollowSummaryRow } from '@/supabase/types';
import { withVisits } from './visits';

/**
 * Suivre un compte, chantier 23 : ce qui se décide sans réseau ni écran. Pur,
 * testé sous `node:test`.
 *
 * Les règles vivent dans la base (`20261027100000_account_follows.sql`) : ce
 * module traduit ce qu'elle rend en libellés, et prévoit ce qu'un geste
 * change avant sa réponse.
 */

export { followSegment };

export type FollowSummary = {
  followers: number;
  following: number;
  /** Les demandes en attente, rendues à leur seul titulaire ; `null` pour les autres. */
  requests: number | null;
  /** Le lien de qui lit vers ce compte, `null` s'il ne le suit pas. */
  myStatus: FollowStatus | null;
  /** « Valider mes abonnés » (D3). */
  approval: boolean;
};

export function toFollowSummary(row: FollowSummaryRow): FollowSummary {
  return {
    followers: row.followers,
    following: row.following,
    requests: row.requests,
    myStatus: row.my_status,
    approval: row.approval,
  };
}

/**
 * Les nombres après un geste, avant la réponse de la base. Seul un abonnement
 * accepté compte (D13) : une demande ne bouge pas le nombre.
 */
export function withFollowStatus(summary: FollowSummary, next: FollowStatus | null): FollowSummary {
  const was = summary.myStatus === 'accepted' ? 1 : 0;
  const now = next === 'accepted' ? 1 : 0;
  return { ...summary, myStatus: next, followers: Math.max(0, summary.followers - was + now) };
}

/** Ce qu'un tap sur « Suivre » produira, selon le réglage du compte suivi. */
export function expectedStatus(summary: FollowSummary): FollowStatus {
  return summary.approval ? 'pending' : 'accepted';
}

export type FollowButtonModel = {
  label: 'Suivre' | 'Abonné' | 'Demandé';
  accessibilityLabel: string;
  accessibilityHint: string;
  /** `follow` suit d'un tap ; `menu` ouvre la feuille d'actions. */
  action: 'follow' | 'menu';
};

/** Le bouton de la barre du bas (D5, D20). */
export function followButton(status: FollowStatus | null, pseudo: string): FollowButtonModel {
  if (status === 'accepted') {
    return {
      label: 'Abonné',
      accessibilityLabel: `Abonné à @${pseudo}`,
      accessibilityHint: 'Ouvre le choix de ne plus suivre',
      action: 'menu',
    };
  }
  if (status === 'pending') {
    return {
      label: 'Demandé',
      accessibilityLabel: `Demande envoyée à @${pseudo}`,
      accessibilityHint: "Ouvre le choix d'annuler la demande",
      action: 'menu',
    };
  }
  return {
    label: 'Suivre',
    accessibilityLabel: `Suivre @${pseudo}`,
    accessibilityHint: 'Ses bentos arriveront dans tes abonnements',
    action: 'follow',
  };
}

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export type DateLine = {
  /** La ligne entière. */
  text: string;
  /** Ce qui précède les nombres, que l'écran écrit sans les souligner. */
  head: string;
  /** Les nombres, soulignés : la ligne les ouvre. `null` sans nombre. */
  segment: string | null;
  accessibilityLabel: string;
};

/**
 * La ligne sous le pseudo (D2) : le nom, la date, les visites du chantier 8,
 * puis les nombres du 23. Sans nombre, elle reste celle d'avant, au pixel
 * près ; avec, la date se raccourcit, « publié le 12 sept. 2026 », pour que
 * la ligne tienne sans rétrécir. Le lecteur d'écran la lit en entier, la
 * date longue (D20).
 */
export function profileDateLine({
  displayName,
  editionTitle,
  publishedAt,
  visits,
  segment,
}: {
  displayName: string | null;
  editionTitle: string | null;
  publishedAt: string;
  visits: number | null | undefined;
  segment: string | null;
}): DateLine {
  const date = new Date(publishedAt);
  const long = date.toLocaleDateString('fr-FR', LONG_DATE);
  const name = displayName ? `${displayName} · ` : '';
  // Le titre de l'édition passe devant la date ; le bento principal garde sa
  // phrase d'origine, sans virgule, cf. la page.
  const what = editionTitle ? `${editionTitle}, publié le` : 'bento publié le';
  if (!segment) {
    const text = withVisits(`${name}${what} ${long}`, visits);
    return { text, head: text, segment: null, accessibilityLabel: text };
  }
  const shortWhat = editionTitle ? `${editionTitle}, publié le` : 'publié le';
  const short = date.toLocaleDateString('fr-FR', SHORT_DATE);
  const head = withVisits(`${name}${shortWhat} ${short}`, visits);
  return {
    text: `${head} · ${segment}`,
    head,
    segment,
    accessibilityLabel: `${withVisits(`${name}${what} ${long}`, visits)}, ${segment}`.replace(/ · /g, ', '),
  };
}

export type FollowEntry = {
  userId: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  isEditorial: boolean;
  status: FollowStatus;
  since: string;
};

export function toFollowEntry(row: FollowListRow): FollowEntry {
  return {
    userId: row.user_id,
    pseudo: row.pseudo,
    displayName: row.display_name,
    avatar: row.avatar,
    isEditorial: row.kind === 'editorial',
    status: row.status,
    since: row.since,
  };
}

/** 50 lignes par page, le plafond de `follow_list`. */
export const FOLLOW_PAGE = 50;

export type FollowCursor = { before: string; beforeId: string };

/** La page suivante commence après la dernière ligne lue ; `null` quand la page n'est pas pleine. */
export function followCursor(rows: readonly FollowListRow[]): FollowCursor | null {
  if (rows.length < FOLLOW_PAGE) return null;
  const last = rows[rows.length - 1];
  return last ? { before: last.since, beforeId: last.user_id } : null;
}

/**
 * Les erreurs de la base, en phrases. Les clés sont celles de `set_follow`,
 * `answer_follow` et `remove_follower`.
 */
const MESSAGES: Record<string, string> = {
  follow_needs_profile: "Compose d'abord ton bento pour suivre des comptes.",
  follow_blocked: 'Tu ne peux pas suivre ce compte.',
  follow_too_fast: "Doucement : attends un peu avant de suivre d'autres comptes.",
  follow_invalid: "Ce compte n'existe plus.",
  follow_needs_session: 'Reconnecte-toi pour suivre des comptes.',
  follows_closed: 'Les abonnements sont fermés pour le moment.',
};

const NETWORK = /network request failed|failed to fetch|load failed|networkerror|timeout|aborted/i;

export function followErrorKey(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
  if (!message) return null;
  const key = Object.keys(MESSAGES).find((k) => message === k || message.startsWith(`${k}:`));
  if (key) return key;
  return NETWORK.test(message) ? 'network' : null;
}

export function followErrorMessage(error: unknown): string {
  const key = followErrorKey(error);
  if (key === 'network') return 'Pas de réseau. Réessaie dans un instant.';
  return (key && MESSAGES[key]) ?? 'Une erreur est survenue. Réessaie.';
}
