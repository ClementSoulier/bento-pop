/**
 * Les listes de départ des quatre nouveaux types, saisies en interne, sans
 * aucune API externe (D9). Un type couvre tout son domaine : c'est l'intitulé
 * d'une case qui donne l'angle, « Ton livre préféré » ou « Le manga que tu
 * trouves surcoté » (D14). Importées en brouillons depuis l'écran Types, puis
 * relues par l'équipe jusqu'à 50 validés par type.
 *
 * Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`, lot 2.
 */
import { ACTIVITIES } from './activity';
import { BOOKS } from './book';
import type { StarterCandidate } from './candidate';
import { DISHES } from './dish';
import { VIDEO_GAMES } from './video-game';

export type { StarterCandidate } from './candidate';

/** Les clés des types qui ont une liste, dans l'ordre de l'écran Types. */
export const STARTER_TYPE_KEYS = ['video_game', 'book', 'dish', 'activity'] as const;

export type StarterTypeKey = (typeof STARTER_TYPE_KEYS)[number];

export const STARTER_LISTS: Readonly<Record<StarterTypeKey, readonly StarterCandidate[]>> = {
  video_game: VIDEO_GAMES,
  book: BOOKS,
  dish: DISHES,
  activity: ACTIVITIES,
};
