import type { CSSProperties } from 'react';
import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';
import { FRAME, TILE } from './layout';

const u = (n: number) => `calc(${n} * var(--u))`;

type PublicBentoEmptyTileProps = {
  /** Intitulé de la case. Pour une édition, la question posée. */
  prompt: string;
  rotate: number;
  /** Placement dans la grille, fourni par `PublicBentoGrid`. */
  placement: CSSProperties;
};

/**
 * Compartiment non rempli.
 *
 * Trois situations le produisent :
 *   - un bento publié avant que la règle des six cases n'existe ;
 *   - un item retiré du catalogue après publication (rejet ou fusion), que
 *     la RLS masque au visiteur anonyme ;
 *   - l'écran « pas encore terminé », où toute la boîte est vide.
 *
 * Dans les trois cas la case doit se lire comme volontairement vide, pas
 * comme un chargement qui aurait échoué.
 */
export function PublicBentoEmptyTile({
  prompt,
  rotate,
  placement,
}: PublicBentoEmptyTileProps) {

  return (
    <li
      className="relative flex min-w-0 list-none flex-col items-center justify-center text-center"
      style={{
        ...placement,
        gap: u(6),
        padding: u(6),
        // Teinte jaune légère : sur le crème de la boîte, un fond blanc ou
        // transparent ne se détacherait pas assez pour lire la case comme
        // un emplacement à remplir.
        background: '#fff4d8',
        border: `max(2px, ${u(2)}) dashed rgba(10,10,10,0.5)`,
        borderRadius: u(TILE.radius),
        // Rotation atténuée par rapport à une case remplie : une bordure
        // en pointillés inclinée accroche beaucoup plus l'œil qu'une photo.
        transform: `rotate(${rotate * 0.5}deg)`,
      }}
    >
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center bg-bento-yellow"
        style={{
          width: u(FRAME.padding * 2 + 8),
          height: u(FRAME.padding * 2 + 8),
          borderRadius: '50%',
          border: `max(2px, ${u(TILE.border)}) solid var(--bento-ink)`,
          fontSize: u(20),
          fontWeight: 800,
          lineHeight: 1,
          paddingBottom: u(2),
        }}
      >
        +
      </span>
      <span
        className="font-display-sm text-bento-ink"
        style={{ fontSize: `max(8px, ${u(10)})`, letterSpacing: '0.12em' }}
      >
        {prompt}
      </span>
      <span className="sr-only">Case non remplie</span>
    </li>
  );
}
