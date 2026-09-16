import { cleanTitle } from '@/lib/text';

/**
 * Le titre tapé est-il déjà dans les résultats ?
 *
 * La ligne « Ajouter « X » » de la modale de recherche promet, dans le
 * commentaire qui la tient, de n'apparaître que « quand on a pu vérifier que
 * l'item n'existe pas ». Elle ne comparait pourtant jamais le texte tapé aux
 * titres trouvés : taper « Squeezie » dans la case Créateur affichait la tuile
 * Squeezie **et** « Ajouter « Squeezie » », relevé en production au chantier 15
 * sur les deux plateformes. Proposer de créer ce qu'on vient de trouver, c'est
 * inviter au doublon au moment précis où l'on sait qu'il en serait un.
 *
 * La comparaison ignore ce que l'affichage ignore déjà : les parenthèses que
 * `cleanTitle` retire, la casse, les accents, la ponctuation et les espaces en
 * trop. « squeezie », « Squeezie » et « SQUEEZIE » masquent donc la ligne, et
 * « Squeezie Fan » la laisse.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */
export function normalizeTitle(raw: string): string {
  return cleanTitle(raw)
    .normalize('NFD')
    // Diacritiques, une fois le texte décomposé.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Tout ce qui n'est ni lettre ni chiffre devient une coupure.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function hasExactTitle(query: string, titles: readonly string[]): boolean {
  const wanted = normalizeTitle(query);
  if (!wanted) return false;
  return titles.some((title) => normalizeTitle(title) === wanted);
}
