import type { ReportReason } from '@/supabase/types';

/**
 * Likes, commentaires et signalements, chantier 22 : ce qui se décide sans
 * réseau ni écran. Pur, testé sous `node:test`.
 *
 * Les règles vivent dans la base (`20261026200000_likes_comments_moderation.sql`) :
 * ce module ne fait que préparer ce que l'app envoie et traduire ce qu'elle
 * reçoit. Le nettoyage d'un commentaire suit exactement celui de
 * `post_comment`, pour que le compteur de caractères dise vrai.
 */

/** La longueur d'un commentaire, en caractères, émojis compris (D6). */
export const COMMENT_MAX_LENGTH = 280;

/** Sous ce reste, le champ affiche combien de caractères il reste. */
export const COMMENT_WARN_REMAINING = 30;

/** Ce qu'un détail de signalement peut dire au plus (D10). */
export const REPORT_DETAILS_MAX_LENGTH = 500;

/**
 * Le texte tel que la base le gardera : les blancs réduits à un espace, puis
 * rognés. L'ordre compte : rogner d'abord laissait un saut de ligne seul
 * devenir un commentaire d'un espace, défaut trouvé au lot 1.
 */
export function cleanComment(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * La longueur comptée comme Postgres (`char_length`) : par point de code, un
 * émoji simple compte pour un.
 */
export function commentLength(text: string): number {
  return [...cleanComment(text)].length;
}

/** Ce qu'il reste à écrire, négatif au-delà de la limite. */
export function commentRemaining(text: string): number {
  return COMMENT_MAX_LENGTH - commentLength(text);
}

/** Vrai quand « Envoyer » peut partir. */
export function canSendComment(text: string): boolean {
  const length = commentLength(text);
  return length >= 1 && length <= COMMENT_MAX_LENGTH;
}

/** Les nombres et réglages d'un bento, tels que `bento_social` les rend. */
export type BentoSocial = {
  /** `null` quand le propriétaire n'affiche pas les j'aime. */
  likes: number | null;
  /** `null` quand il refuse les commentaires, ou que l'interrupteur est éteint. */
  comments: number | null;
  liked: boolean;
  acceptsLikes: boolean;
  acceptsComments: boolean;
};

type SocialRow = {
  bento_id: string;
  likes: number | null;
  comments: number | null;
  liked: boolean;
  accepts_likes: boolean;
  accepts_comments: boolean;
};

export function toBentoSocial(row: SocialRow): BentoSocial {
  return {
    likes: row.likes,
    comments: row.comments,
    liked: row.liked,
    acceptsLikes: row.accepts_likes,
    acceptsComments: row.accepts_comments,
  };
}

/** Le cœur touché : l'état d'après, avant la réponse de la base. */
export function withLikeToggled(social: BentoSocial): BentoSocial {
  if (social.likes === null) return social;
  const liked = !social.liked;
  return { ...social, liked, likes: Math.max(0, social.likes + (liked ? 1 : -1)) };
}

/** Un commentaire de plus, ou de moins. */
export function withCommentDelta(social: BentoSocial, delta: number): BentoSocial {
  if (social.comments === null) return social;
  return { ...social, comments: Math.max(0, social.comments + delta) };
}

/** Un nombre court : « 12 », « 1 250 », « 12 k ». */
export function formatCount(n: number): string {
  if (n < 10_000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${Math.floor(n / 1000)} k`;
}

export type ActionPill = {
  /** Ce que la pastille affiche. */
  text: string;
  /** Ce que le lecteur d'écran dit. */
  accessibilityLabel: string;
  /** Faux sur son propre bento : le nombre se lit, le cœur ne se touche pas. */
  pressable: boolean;
  /** Pour le cœur seulement. */
  active: boolean;
};

export type ActionBarModel = { heart: ActionPill | null; bubble: ActionPill | null };

/**
 * La barre d'un bento (§5.1) : rien tant que les nombres ne sont pas là, la
 * barre gardant sa hauteur ; ni cœur ni bulle pour ce que le propriétaire
 * refuse ; « J'aime » et « Commenter » plutôt qu'un zéro.
 *
 * `compact`, pour l'en-tête de la page d'un bento : le nombre seul, et rien
 * qu'une icône à zéro. Les mots ne tiendraient pas à côté du Popy sur un
 * écran étroit, à la plus grande taille de texte.
 */
export function actionBarModel(
  social: BentoSocial | undefined,
  { isOwn, compact = false }: { isOwn: boolean; compact?: boolean },
): ActionBarModel {
  if (!social) return { heart: null, bubble: null };

  let heart: ActionPill | null = null;
  if (social.acceptsLikes && social.likes !== null) {
    const n = social.likes;
    heart = isOwn
      ? {
          text: n > 0 ? formatCount(n) : compact ? '' : '0',
          accessibilityLabel: n === 1 ? "1 j'aime" : `${n} j'aime`,
          pressable: false,
          active: false,
        }
      : {
          text: n > 0 ? formatCount(n) : compact ? '' : "J'aime",
          accessibilityLabel: `J'aime, ${n}`,
          pressable: true,
          active: social.liked,
        };
  }

  let bubble: ActionPill | null = null;
  if (social.acceptsComments && social.comments !== null) {
    const n = social.comments;
    bubble = {
      text: n > 0 ? formatCount(n) : compact ? '' : 'Commenter',
      accessibilityLabel: n > 0 ? `Commentaires, ${n}` : 'Commenter',
      pressable: true,
      active: false,
    };
  }

  return { heart, bubble };
}

/**
 * Ce qui manque pour commenter (D3), dans l'ordre où l'app le demande :
 * publier son bento, puis garder son compte.
 */
export type CommentGate = 'publish' | 'keep' | null;

export function commentGate({
  hasPublished,
  kept,
}: {
  hasPublished: boolean;
  kept: boolean;
}): CommentGate {
  if (!hasPublished) return 'publish';
  if (!kept) return 'keep';
  return null;
}

/** Les six motifs, dans l'ordre de l'écran « Signaler » (§5.4). */
export const REPORT_REASONS: ReadonlyArray<{ code: ReportReason; label: string }> = [
  { code: 'hate', label: 'Haine ou discrimination' },
  { code: 'harassment', label: 'Harcèlement ou insultes' },
  { code: 'sexual', label: 'Contenu sexuel' },
  { code: 'violence', label: 'Violence ou menaces' },
  { code: 'spam', label: 'Spam ou arnaque' },
  { code: 'other', label: 'Autre' },
];

export function reportReasonLabel(code: string | null | undefined): string | null {
  return REPORT_REASONS.find((r) => r.code === code)?.label ?? null;
}

/**
 * Les erreurs des fonctions de la base portent une clé (`comment_needs_bento`,
 * …), que l'app dit en phrase. Une erreur réseau se reconnaît à son message,
 * celui de `fetch` sur iOS comme sur Android.
 */
const MESSAGES: Record<string, string> = {
  comment_needs_bento: 'Publie ton bento pour commenter.',
  comment_needs_terms: "Accepte d'abord les règles du jeu.",
  comment_needs_kept_account: 'Garde ton compte pour commenter.',
  comment_not_allowed: 'Tu ne peux pas commenter ce bento.',
  comments_closed: 'Les commentaires sont fermés sur ce bento.',
  comment_refused_filter: 'Ce commentaire contient un mot ou un lien refusé.',
  comment_invalid: 'Un commentaire fait de 1 à 280 caractères.',
  comment_too_fast: 'Doucement : attends un peu avant de commenter encore.',
  like_not_allowed: 'Tu ne peux pas aimer ce bento.',
  bento_not_found: "Ce bento n'est plus en ligne.",
  report_too_fast: "Tu as beaucoup signalé aujourd'hui. Réessaie demain.",
  report_invalid: "Ce signalement n'a pas pu partir.",
  report_target_not_found: "Ce que tu signales n'existe plus.",
};

const NETWORK = /network request failed|failed to fetch|load failed|networkerror|timeout|aborted/i;

export function socialErrorKey(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
  if (!message) return null;
  const key = Object.keys(MESSAGES).find((k) => message === k || message.startsWith(`${k}:`));
  if (key) return key;
  return NETWORK.test(message) ? 'network' : null;
}

export function socialErrorMessage(error: unknown): string {
  const key = socialErrorKey(error);
  if (key === 'network') return 'Pas de réseau. Réessaie dans un instant.';
  return (key && MESSAGES[key]) ?? 'Une erreur est survenue. Réessaie.';
}
