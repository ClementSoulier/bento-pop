import { filledCaseLabel, type CaseMeta } from '@bento-pop/supabase-mobile/bento';
import type { BentoWhyRow } from '@/supabase/types';

/**
 * Le « pourquoi » par case, chantier 12 : ce qui se décide sans réseau ni
 * écran. Pur, testé sous `node:test`.
 *
 * Les règles vivent dans la base (`20261026210000_bento_whys.sql`) : ce
 * module prépare ce que l'app envoie et traduit ce qu'elle reçoit. Le
 * nettoyage suit exactement celui de `set_bento_why`, pour que le compteur
 * de caractères dise vrai.
 */

/** La longueur d'un pourquoi, en caractères, émojis compris (D5). */
export const WHY_MAX_LENGTH = 120;

/** Sous ce reste, le champ affiche combien de caractères il reste. */
export const WHY_WARN_REMAINING = 20;

/** Le texte tel que la base le gardera : les blancs réduits, puis rognés. */
export function cleanWhy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** La longueur comptée comme Postgres, par point de code. */
export function whyLength(text: string): number {
  return [...cleanWhy(text)].length;
}

/** Ce qu'il reste à écrire, négatif au-delà de la limite. */
export function whyRemaining(text: string): number {
  return WHY_MAX_LENGTH - whyLength(text);
}

/** Vrai quand le champ peut s'enregistrer : vide, il efface ; sinon dans la limite. */
export function canSaveWhy(text: string): boolean {
  return whyLength(text) <= WHY_MAX_LENGTH;
}

/** Un pourquoi tel que les autres le lisent : son texte, et de quoi le signaler. */
export type PublicWhy = { id: string; body: string };

/** Les pourquoi d'un bento, par clé de case. */
export type BentoWhys = Readonly<Partial<Record<string, PublicWhy>>>;

/** Un pourquoi tel que son propriétaire le lit, masqué compris (D8). */
export type OwnWhy = {
  body: string;
  hidden: boolean;
  hiddenReason: string | null;
};

export function toOwnWhys(rows: readonly BentoWhyRow[]): Readonly<Partial<Record<string, OwnWhy>>> {
  const out: Partial<Record<string, OwnWhy>> = {};
  for (const r of rows) {
    out[r.case_key] = { body: r.body, hidden: r.status === 'hidden', hiddenReason: r.hidden_reason };
  }
  return out;
}

/** Une ligne de la section « Pourquoi ces choix », dans l'ordre des cases. */
export type WhyLine = {
  caseKey: string;
  /** Pour le signaler ; absent des lignes de son propriétaire. */
  whyId: string | null;
  /** Le tampon de la case, ou la question d'une édition. */
  label: string;
  /** La case telle que le lecteur d'écran la nomme : « Film ». */
  prompt: string;
  title: string;
  body: string;
  /** Pour son propriétaire seulement : masqué par l'équipe, et pourquoi. */
  hidden: boolean;
  hiddenReason: string | null;
};

/**
 * Les lignes de la section, une par case expliquée et remplie, dans l'ordre
 * des cases. Le propriétaire passe ses pourquoi à lui, masqués compris ; les
 * autres, ceux que la page a lus.
 */
export function whyLines(
  cases: readonly CaseMeta[],
  slots: Readonly<Partial<Record<string, { title: string }>>>,
  whys: BentoWhys,
  own: Readonly<Partial<Record<string, OwnWhy>>> | null = null,
): WhyLine[] {
  const lines: WhyLine[] = [];
  for (const c of cases) {
    const slot = slots[c.key];
    if (!slot) continue;
    const mine = own?.[c.key];
    const body = own ? mine?.body : whys[c.key]?.body;
    if (!body) continue;
    lines.push({
      caseKey: c.key,
      whyId: own ? null : (whys[c.key]?.id ?? null),
      label: filledCaseLabel(c),
      prompt: c.prompt,
      title: slot.title,
      body,
      hidden: mine?.hidden ?? false,
      hiddenReason: mine?.hiddenReason ?? null,
    });
  }
  return lines;
}

/** Ce que le lecteur d'écran dit d'une ligne, d'un bloc (§5.1). */
export function whyLineLabel(line: Pick<WhyLine, 'prompt' | 'title' | 'body' | 'hidden' | 'hiddenReason'>): string {
  const hidden = line.hidden
    ? ` Masqué par l'équipe${line.hiddenReason ? ` : ${line.hiddenReason}` : ''}.`
    : '';
  return `${line.prompt} : ${line.title}. Pourquoi : ${line.body}${hidden}`;
}

/**
 * Ce que « Enregistrer » envoie : les champs changés, nettoyés. Un champ
 * vidé efface ; un champ inchangé, blancs mis à part, ne part pas.
 */
export function changedWhys(
  before: Readonly<Partial<Record<string, string>>>,
  drafts: Readonly<Partial<Record<string, string>>>,
): { caseKey: string; body: string }[] {
  const out: { caseKey: string; body: string }[] = [];
  for (const [caseKey, draft] of Object.entries(drafts)) {
    if (draft === undefined) continue;
    const next = cleanWhy(draft);
    if (next === cleanWhy(before[caseKey] ?? '')) continue;
    out.push({ caseKey, body: next });
  }
  return out;
}

/**
 * Les erreurs de la base, en phrases. Les clés sont celles de
 * `set_bento_why` ; un refus du filtre se dit sous son champ.
 */
const MESSAGES: Record<string, string> = {
  why_refused_filter: 'Ce pourquoi contient un mot ou un lien refusé.',
  why_invalid: 'Un pourquoi fait au plus 120 caractères, sur une ligne.',
  why_too_fast: 'Doucement : attends un peu avant de réécrire tes pourquoi.',
  why_case_empty: "Cette case n'a plus d'item : son pourquoi ne s'écrit pas.",
  why_not_yours: "Ce bento n'est pas le tien.",
  why_needs_session: 'Reconnecte-toi pour écrire tes pourquoi.',
  whys_closed: 'Les pourquoi sont fermés pour le moment.',
};

const NETWORK = /network request failed|failed to fetch|load failed|networkerror|timeout|aborted/i;

export function whyErrorKey(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
  if (!message) return null;
  const key = Object.keys(MESSAGES).find((k) => message === k || message.startsWith(`${k}:`));
  if (key) return key;
  return NETWORK.test(message) ? 'network' : null;
}

export function whyErrorMessage(error: unknown): string {
  const key = whyErrorKey(error);
  if (key === 'network') return 'Pas de réseau. Réessaie dans un instant.';
  return (key && MESSAGES[key]) ?? 'Une erreur est survenue. Réessaie.';
}
