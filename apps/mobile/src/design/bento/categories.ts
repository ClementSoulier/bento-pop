/**
 * Les six catégories du garde-manger (chantier 32, D5) : la couleur, l'icône et
 * le libellé de chaque case, et la catégorie d'une case d'édition. Aucun import
 * de `react-native` : les tests lisent ce module sous `node:test`.
 */
import { CATEGORY_META, isMainCaseKey } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';
import type { IconName } from '../icons';
import type { ColorToken } from '../tokens';

export type CategoryStyle = {
  /** Le fond d'une case sans image, le texte de sa puce sur l'encre. */
  color: ColorToken;
  /** Son initiale géante et ses pois. */
  deep: ColorToken;
  icon: IconName;
};

export const CATEGORY_STYLES: Record<CategoryKey, CategoryStyle> = {
  film: { color: 'cat-film', deep: 'cat-film-deep', icon: 'film-slate' },
  series: { color: 'cat-serie', deep: 'cat-serie-deep', icon: 'television-simple' },
  artist: { color: 'cat-artiste', deep: 'cat-artiste-deep', icon: 'star' },
  track: { color: 'cat-son', deep: 'cat-son-deep', icon: 'music-notes' },
  creator: { color: 'cat-crea', deep: 'cat-crea-deep', icon: 'monitor-play' },
  place: { color: 'cat-lieu', deep: 'cat-lieu-deep', icon: 'map-pin' },
};

/** Le tampon d'une case, écrit au back-office, sans ses espaces ni sa casse. */
function normalizedStamp(stamp: string | undefined): string {
  return (stamp ?? '').trim().toLocaleUpperCase('fr');
}

const CATEGORY_BY_STAMP: ReadonlyMap<string, CategoryKey> = new Map(
  (Object.keys(CATEGORY_META) as CategoryKey[]).map((key) => [CATEGORY_META[key].stamp, key]),
);

/** Les cinq types actifs. « Personne » sert deux cases : le tampon les départage. */
const CATEGORY_BY_TYPE: Readonly<Record<string, CategoryKey>> = {
  film: 'film',
  series: 'series',
  person: 'artist',
  song: 'track',
  place: 'place',
};

/**
 * La catégorie d'une case : par sa clé pour le bento principal, par son type
 * pour une édition, et, faute de type lu, par son tampon. `null` pour un type
 * sans couleur (jeu vidéo, livre, plat, activité, tous inactifs) : la case prend
 * alors un repli neutre, sa couleur restant à dessiner avant d'ouvrir le type.
 */
export function caseCategory(meta: {
  key: string;
  typeKey?: string | null;
  stamp?: string;
}): CategoryKey | null {
  if (isMainCaseKey(meta.key)) return meta.key as CategoryKey;
  const fromStamp = CATEGORY_BY_STAMP.get(normalizedStamp(meta.stamp)) ?? null;
  if (!meta.typeKey) return fromStamp;
  if (meta.typeKey === 'person' && fromStamp === 'creator') return 'creator';
  return CATEGORY_BY_TYPE[meta.typeKey] ?? null;
}
