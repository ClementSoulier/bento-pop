import { popyFor } from '@/lib/popy-avatar';
import { relativeDate } from '@/lib/relative-date';
import { FeedLabel } from './FeedLabel';

type FeedPostHeaderProps = {
  pseudo: string;
  /** Le Popy choisi, ou `null` pour celui du pseudo (chantier 21, D7). */
  avatar: string | null;
  displayName: string | null;
  publishedAt: string;
  /** Largeur de la boîte, pour empêcher un pseudo long de la dépasser. */
  maxWidth: number;
  /** Horloge injectable, pour des captures et des tests reproductibles. */
  now?: number;
};

/**
 * Étiquette d'identité posée au-dessus de la boîte d'un post : le Popy et le
 * pseudo de l'auteur, son nom affiché et la date relative. Le dessin est celui
 * de `FeedLabel`, partagé avec les épisodes.
 */
export function FeedPostHeader({
  pseudo,
  avatar,
  displayName,
  publishedAt,
  maxWidth,
  now,
}: FeedPostHeaderProps) {
  const when = relativeDate(publishedAt, now);
  const meta = [displayName, when].filter(Boolean).join(' · ');

  return (
    <FeedLabel
      title={`@${pseudo}`}
      meta={meta}
      avatar={popyFor(pseudo, avatar)}
      maxWidth={maxWidth}
    />
  );
}
