import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import type { BentoSlots } from './map';
import { cleanTitle, joinReadable, truncateAtWord } from './text';

/**
 * Composition des métadonnées de la page publique.
 *
 * Pur et sans dépendance à Next : le module est testable unitairement, et
 * `page.tsx` se contente d'assembler l'objet `Metadata` à partir de ces
 * chaînes.
 */

/** Longueur au-delà de laquelle Google tronque une description. */
const DESCRIPTION_MAX = 160;

/**
 * Chemin canonique d'un bento, dans la casse stockée en base.
 *
 * Sans `slug`, c'est la page du compte, dont le contenu principal est le bento
 * principal : c'est l'adresse que portent les liens déjà partagés, et elle ne
 * change pas. Avec, c'est l'adresse d'un bento précis. Le principal a les
 * deux, et sa canonique est la première (chantier 16, D5).
 */
export function bentoPath(pseudo: string, slug: string | null = null): string {
  return slug ? `/u/${pseudo}/${slug}` : `/u/${pseudo}`;
}

/** Titre de page et `og:title`. */
export function bentoTitle(pseudo: string): string {
  return `Le bento de @${pseudo}`;
}

/**
 * Description listant les choix, dans l'ordre d'affichage du bento.
 *
 * On énumère les titres plutôt que d'écrire une phrase générique : c'est
 * ce contenu qui apparaît sous l'aperçu dans une conversation, et « Film,
 * série, artiste... » ne donne à personne envie de cliquer, alors que
 * « Interstellar, Severance et Orelsan » se lit comme une recommandation.
 *
 * Repli sur une phrase générique si aucune case n'est lisible, ce qui
 * arrive quand tous les items ont été rejetés après publication.
 */
export function bentoDescription(pseudo: string, slots: BentoSlots): string {
  const titles = CATEGORY_ORDER.map((category) => slots[category])
    .filter((tile): tile is NonNullable<typeof tile> => Boolean(tile))
    .map((tile) => cleanTitle(tile.title))
    .filter((title) => title.length > 0);

  if (titles.length === 0) {
    return truncateAtWord(
      `Découvre le bento pop culture de @${pseudo} sur Bento Pop.`,
      DESCRIPTION_MAX,
    );
  }

  return truncateAtWord(
    `Le bento pop culture de @${pseudo} : ${joinReadable(titles)}.`,
    DESCRIPTION_MAX,
  );
}

/** Texte alternatif de l'image Open Graph. */
export function bentoImageAlt(pseudo: string): string {
  return `Le bento pop culture de @${pseudo} : six choix, une boîte.`;
}

/**
 * Politique d'indexation.
 *
 * `noindex, follow` par défaut, `index` seulement pour les bentos mis en
 * avant par l'équipe (décision de la spec §8). Motifs : une page de bento
 * est du contenu mince au sens de Google, et un pseudo non modéré indexé
 * sur le domaine de la marque est un risque disproportionné par rapport
 * au gain. Les aperçus Open Graph, eux, fonctionnent indépendamment de
 * `noindex` : l'objectif d'acquisition est atteint dans les deux cas.
 *
 * `follow` est conservé pour que les liens sortants de la page (accueil,
 * pages légales) continuent de transmettre leur signal.
 */
export function bentoRobots(isFeatured: boolean): { index: boolean; follow: true } {
  return { index: isFeatured, follow: true };
}
