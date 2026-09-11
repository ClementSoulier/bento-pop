import type { CSSProperties } from 'react';
import type { BentoSlots } from '@/lib/bento/map';
import { PublicBentoEmptyTile } from './PublicBentoEmptyTile';
import { PublicBentoTile } from './PublicBentoTile';
import {
  DESIGN_WIDTH,
  FRAME,
  GRID_COLUMNS,
  MAX_RENDERED_WIDTH,
  ROW_HEIGHTS,
  TILE_LAYOUT,
} from './layout';

const u = (n: number) => `calc(${n} * var(--u))`;

type PublicBentoGridProps = {
  slots: BentoSlots;
  /** Étiquette accessible de la liste, par exemple « Le bento de @kerem ». */
  label: string;
  /** Force toutes les cases en vide (écran « pas encore terminé »). */
  empty?: boolean;
};

/**
 * La boîte bento telle qu'elle apparaît dans l'app : un grand compartiment
 * film, deux moyens, trois petits, dans un cadre crème à contour épais.
 *
 * **Mise à l'échelle.** Toutes les dimensions sont exprimées en unités de
 * design via `--u`, défini en unités de conteneur dans `globals.css`. La
 * boîte garde donc exactement les proportions de l'app à n'importe quelle
 * largeur, sans requête média ni point de rupture, et sans le débordement
 * observé sur `app/u/[pseudo].tsx` où l'échelle est figée en dur.
 *
 * Le `container-type` est posé sur `.bento-scope`, un conteneur sans marge
 * intérieure ni bordure : `cqw` se résout sur la boîte de contenu du
 * conteneur, donc l'appliquer directement au cadre donnerait une unité
 * fausse de la valeur des marges.
 *
 * **Décalage de mise en page.** Les hauteurs de rangée sont connues avant
 * le chargement des images, donc le CLS est nul par construction.
 *
 * Composant serveur : aucun `'use client'`, aucun JavaScript expédié.
 */
export function PublicBentoGrid({ slots, label, empty = false }: PublicBentoGridProps) {
  return (
    <div className="bento-scope mx-auto w-full" style={{ maxWidth: MAX_RENDERED_WIDTH }}>
      <div
        className="bento-frame relative bg-bento-cream"
        style={
          {
            '--bento-design-width': DESIGN_WIDTH,
            padding: u(FRAME.padding),
            border: `max(3px, ${u(FRAME.border)}) solid var(--bento-ink)`,
            borderRadius: u(FRAME.radius),
            boxShadow: `0 ${u(8)} 0 var(--bento-ink), 0 ${u(18)} ${u(36)} rgba(0,0,0,0.22)`,
          } as CSSProperties
        }
      >
        <Rivet corner="tl" />
        <Rivet corner="tr" />
        <Rivet corner="bl" />
        <Rivet corner="br" />

        <ul
          aria-label={label}
          className="grid list-none"
          style={{
            // `minmax(0, 1fr)` et pas `1fr` : `1fr` vaut `minmax(auto, 1fr)`,
            // donc une piste ne pourrait pas descendre sous la largeur
            // min-content de son contenu. Un titre d'un seul mot très long
            // ou le libellé « Créateur de contenu » d'une case vide
            // pourrait alors élargir la boîte au-delà de son conteneur.
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: ROW_HEIGHTS.map((h) => u(h)).join(' '),
            gap: u(FRAME.gap),
          }}
        >
          {TILE_LAYOUT.map((slot) => {
            const tile = empty ? undefined : slots[slot.category];
            const placement: CSSProperties = {
              gridRow: slot.row,
              gridColumn: `span ${slot.span}`,
            };
            return tile ? (
              <PublicBentoTile
                key={slot.category}
                category={slot.category}
                tile={tile}
                size={slot.size}
                rotate={slot.rotate}
                placement={placement}
                // Le compartiment film est le plus grand élément au-dessus
                // de la ligne de flottaison : c'est lui le LCP, et lui seul
                // échappe au chargement différé.
                priority={slot.category === 'film'}
              />
            ) : (
              <PublicBentoEmptyTile
                key={slot.category}
                category={slot.category}
                rotate={slot.rotate}
                placement={placement}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Rivet décoratif façon « baguettes », repris de la boîte de l'app.
 * Purement ornemental, donc masqué aux technologies d'assistance.
 */
function Rivet({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const offset = u(FRAME.rivetOffset);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bg-bento-ink"
      style={{
        width: u(FRAME.rivetSize),
        height: u(FRAME.rivetSize),
        borderRadius: '50%',
        top: corner.startsWith('t') ? offset : undefined,
        bottom: corner.startsWith('b') ? offset : undefined,
        left: corner.endsWith('l') ? offset : undefined,
        right: corner.endsWith('r') ? offset : undefined,
      }}
    />
  );
}
