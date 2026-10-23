import { compareEpisodes, timeOf, type FeedEpisode } from './episodes';
import type { FeedBento } from './feed';

/**
 * « La table » mêle deux sources : les bentos, paginés par curseur depuis la
 * base mobile, et les épisodes, lus d'un bloc sur la landing. Chantier 19,
 * D1 et D2 : chaque épisode à sa date, parmi les bentos, sans épinglage.
 *
 * Pur, pour être testé dans node : l'écran lui passe les bentos déjà chargés,
 * dans l'ordre du fil, les épisodes, et `complete`, vrai quand il n'y a plus
 * de page de bentos à venir.
 */

export type FeedItem =
  | { type: 'bento'; key: string; bento: FeedBento }
  | { type: 'episode'; key: string; episode: FeedEpisode };

const episodeItem = (episode: FeedEpisode): FeedItem => ({
  type: 'episode',
  key: episode.key,
  episode,
});

/**
 * Place chaque épisode avant le premier bento plus ancien que lui ; à date
 * égale, l'épisode d'abord (§5.1 de la spec).
 *
 * Un épisode plus ancien que le dernier bento chargé **attend la page
 * suivante** : le placer tout de suite au bout le ferait sauter plus haut au
 * chargement de la page, sous le doigt. Quand le fil est complet, les
 * épisodes restants s'ajoutent à la fin, de janvier à avril pour les
 * épisodes d'avant le premier bento. Ainsi, la liste d'une page est toujours
 * le début de la liste de la page suivante : rien ne bouge en défilant.
 *
 * Une date de bento illisible ne retient aucun épisode devant lui : ils
 * attendent le bento suivant, ou le bout du fil.
 */
export function interleaveFeed(
  bentos: readonly FeedBento[],
  episodes: readonly FeedEpisode[],
  complete: boolean,
): FeedItem[] {
  const sorted = [...episodes].sort(compareEpisodes);
  const items: FeedItem[] = [];
  let next = 0;

  for (const bento of bentos) {
    const time = timeOf(bento.publishedAt);
    while (next < sorted.length && !Number.isNaN(time) && sorted[next]!.publishedAtMs >= time) {
      items.push(episodeItem(sorted[next]!));
      next += 1;
    }
    items.push({ type: 'bento', key: `bento:${bento.bentoId}`, bento });
  }

  if (complete) {
    for (; next < sorted.length; next += 1) items.push(episodeItem(sorted[next]!));
  }
  return items;
}
