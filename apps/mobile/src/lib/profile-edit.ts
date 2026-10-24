import type { SupabaseClient } from '@supabase/supabase-js';
import { isPopyKey, type PopyKey } from '@bento-pop/supabase-mobile/bento';
import type { Database } from '@/supabase/types';
import { timeOf } from './episodes';
import type { PseudoCheck } from './pseudo';

/**
 * Modifier son profil, chantier 21 : le nom affiché, le pseudo et le Popy
 * (D4, D5, D7). Chaque champ a son écriture, une fonction de la base qui en
 * tient les règles : l'app les redit ici pour répondre pendant la saisie,
 * mais c'est la base qui tranche, et ses refus se lisent par `profileWriteError`.
 *
 * Client injecté, pour que la forme des appels se vérifie sous `node:test`.
 */

export type ProfileClient = SupabaseClient<Database>;

/** 30 caractères au plus (D4), comptés comme la base les compte. */
export const DISPLAY_NAME_MAX = 30;

/** Un changement de pseudo tous les 30 jours au plus (D5). */
export const PSEUDO_CHANGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Les caractères de contrôle, que `[[:cntrl:]]` refuse côté base. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export type DisplayNameCheck =
  | { status: 'ok'; value: string | null }
  | { status: 'too-long' }
  | { status: 'multiline' };

/**
 * Le nom tel que la base l'enregistrera : débarrassé de ses blancs, `null`
 * s'il est vide. Les motifs interdits, eux, restent illisibles depuis l'app :
 * seule la base dit « non autorisé ».
 */
export function checkDisplayName(raw: string): DisplayNameCheck {
  const value = raw.trim();
  if (CONTROL.test(value)) return { status: 'multiline' };
  // Des caractères et non des unités UTF-16, comme `char_length` : un emoji
  // compte pour un.
  if ([...value].length > DISPLAY_NAME_MAX) return { status: 'too-long' };
  return { status: 'ok', value: value === '' ? null : value };
}

/**
 * La date à partir de laquelle le pseudo pourra changer, ou `null` s'il le
 * peut déjà : jamais changé, ou changé il y a plus de 30 jours.
 */
export function nextPseudoChangeAt(changedAt: string | null, now = Date.now()): Date | null {
  if (!changedAt) return null;
  const t = timeOf(changedAt);
  if (!Number.isFinite(t)) return null;
  const next = t + PSEUDO_CHANGE_DAYS * DAY_MS;
  return next > now ? new Date(next) : null;
}

/** « 23 novembre », l'année seulement si elle n'est pas la même. */
export function formatChangeDate(date: Date, now = Date.now()): string {
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Le nom compté comme la base le compte, pour le compteur sous le champ. */
export function displayNameLength(raw: string): number {
  return [...raw.trim()].length;
}

/** Ce que le bouton du nom propose : rien, l'enregistrer, le retirer, ou pourquoi il ne le peut pas. */
export type NameAction =
  | { kind: 'none' }
  | { kind: 'save' }
  | { kind: 'remove' }
  | { kind: 'invalid'; message: string };

/**
 * L'action du champ du nom, d'après la saisie et le nom enregistré : rien
 * tant qu'il ne change pas, blancs compris ; vide, il se retire (D4).
 */
export function nameAction(raw: string, current: string | null): NameAction {
  const check = checkDisplayName(raw);
  if (check.status === 'too-long') {
    return { kind: 'invalid', message: profileWriteMessage({ kind: 'too-long' }, 'name') };
  }
  if (check.status === 'multiline') {
    return { kind: 'invalid', message: profileWriteMessage({ kind: 'invalid' }, 'name') };
  }
  if (check.value === (current?.trim() || null)) return { kind: 'none' };
  return check.value === null ? { kind: 'remove' } : { kind: 'save' };
}

/** La phrase sous le champ du pseudo, et ce qu'elle annonce. */
export type FieldMessage = { text: string; tone: 'ok' | 'error' | 'neutral' };

/**
 * Ce que dit l'écran d'un pseudo pendant la saisie, d'après `pseudo_status` et
 * les règles de la création : une phrase plutôt qu'une pastille, la place ne
 * manquant pas sous le champ.
 */
export function pseudoFieldMessage(check: PseudoCheck): FieldMessage | null {
  switch (check.status) {
    case 'idle':
      return null;
    case 'checking':
      return { text: 'Vérification…', tone: 'neutral' };
    case 'current':
      return { text: 'C’est ton pseudo actuel.', tone: 'neutral' };
    case 'available':
      return { text: 'Libre.', tone: 'ok' };
    case 'taken':
      return { text: 'Déjà pris.', tone: 'error' };
    case 'reserved':
      return { text: 'Réservé à l’équipe Bento Pop.', tone: 'error' };
    case 'forbidden':
      return { text: 'Ce pseudo n’est pas autorisé.', tone: 'error' };
    case 'too-short':
      return { text: '3 caractères au moins.', tone: 'error' };
    case 'too-long':
      return { text: '20 caractères au plus.', tone: 'error' };
    case 'invalid':
      return { text: 'Lettres, chiffres, points et underscores seulement.', tone: 'error' };
    case 'error':
      return { text: 'Vérification impossible pour l’instant. Réessaie dans un instant.', tone: 'error' };
  }
}

/** Ce qu'un refus de la base veut dire pour l'écran. */
export type ProfileWriteError =
  | { kind: 'too-long' }
  | { kind: 'invalid' }
  | { kind: 'taken' }
  | { kind: 'forbidden' }
  | { kind: 'too-soon'; nextAt: Date | null }
  | { kind: 'auth' }
  | { kind: 'unknown' };

export class ProfileWriteFailure extends Error {
  constructor(readonly reason: ProfileWriteError) {
    super(`Profile write failed: ${reason.kind}`);
    this.name = 'ProfileWriteFailure';
  }
}

/** Les codes des fonctions du chantier 21, cf. leur migration. */
export function profileWriteError(error: { code?: string | null; hint?: string | null }): ProfileWriteError {
  switch (error.code) {
    case '22001':
      return { kind: 'too-long' };
    case '22023':
      return { kind: 'invalid' };
    case '23505':
      return { kind: 'taken' };
    case '23514':
      return { kind: 'forbidden' };
    case 'P0001': {
      const t = error.hint ? timeOf(error.hint) : NaN;
      return { kind: 'too-soon', nextAt: Number.isFinite(t) ? new Date(t) : null };
    }
    case '42501':
    case 'P0002':
      return { kind: 'auth' };
    default:
      return { kind: 'unknown' };
  }
}

/** La phrase à afficher sous le champ, d'après le refus et le champ. */
export function profileWriteMessage(
  reason: ProfileWriteError,
  field: 'name' | 'pseudo' | 'avatar',
  now = Date.now(),
): string {
  switch (reason.kind) {
    case 'too-long':
      return `${DISPLAY_NAME_MAX} caractères au plus.`;
    case 'invalid':
      return field === 'pseudo'
        ? '3 à 20 caractères : lettres, chiffres, points et underscores.'
        : field === 'name'
          ? 'Une seule ligne.'
          : 'Ce Popy n’existe pas.';
    case 'taken':
      return 'Ce pseudo est déjà pris.';
    case 'forbidden':
      return field === 'pseudo' ? 'Ce pseudo n’est pas autorisé.' : 'Ce nom n’est pas autorisé.';
    case 'too-soon':
      return reason.nextAt
        ? `Prochain changement de pseudo possible le ${formatChangeDate(reason.nextAt, now)}.`
        : `Un changement de pseudo tous les ${PSEUDO_CHANGE_DAYS} jours au plus.`;
    case 'auth':
      return 'Ton profil n’est pas encore en ligne : publie ton bento d’abord.';
    case 'unknown':
      return 'Impossible d’enregistrer pour l’instant. Réessaie dans un instant.';
  }
}

function fail(error: { code?: string | null; hint?: string | null }): never {
  throw new ProfileWriteFailure(profileWriteError(error));
}

/** Enregistre le nom affiché, vide pour l'effacer. Rend ce que la base a gardé. */
export async function writeDisplayName(client: ProfileClient, raw: string): Promise<string | null> {
  const check = checkDisplayName(raw);
  if (check.status === 'too-long') throw new ProfileWriteFailure({ kind: 'too-long' });
  if (check.status === 'multiline') throw new ProfileWriteFailure({ kind: 'invalid' });
  const { data, error } = await client.rpc('set_display_name', { p_display_name: check.value });
  if (error) fail(error);
  return data;
}

/** Enregistre le Popy choisi, `null` pour revenir à celui du pseudo. */
export async function writeAvatar(client: ProfileClient, avatar: PopyKey | null): Promise<PopyKey | null> {
  const { data, error } = await client.rpc('set_avatar', { p_avatar: avatar });
  if (error) fail(error);
  return isPopyKey(data) ? data : null;
}

/**
 * Change de pseudo. `keepAvatar`, le Popy que l'écran affiche : la base le
 * fige s'il n'a jamais été choisi, pour que le visage reste le même (D7).
 */
export async function changePseudo(
  client: ProfileClient,
  pseudo: string,
  keepAvatar: PopyKey,
): Promise<string> {
  const { data, error } = await client.rpc('change_pseudo', {
    p_pseudo: pseudo.trim(),
    p_keep_avatar: keepAvatar,
  });
  if (error) fail(error);
  return data;
}
