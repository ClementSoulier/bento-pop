import type { CSSProperties } from 'react';
import {
  boxPlacements,
  boxRowHeights,
  filledCaseLabel,
  isMainCaseKey,
} from '@bento-pop/supabase-mobile/bento';
import type { PublicCase } from './cases';
import { PublicBentoEmptyTile } from './PublicBentoEmptyTile';
import { PublicBentoTile } from './PublicBentoTile';
import {
  DESIGN_WIDTH,
  FRAME,
  GRID_COLUMNS,
  MAX_RENDERED_WIDTH,
  type TileSize,
} from './layout';

const u = (n: number) => `calc(${n} * var(--u))`;

type PublicBentoGridProps = {
  /**
   * Les cases, dans l'ordre de lecture. Leur nombre décide de la disposition,
   * comme dans l'app ; une case sans `tile` se rend vide.
   */
  cases: readonly PublicCase[];
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
export function PublicBentoGrid({ cases, label, empty = false }: PublicBentoGridProps) {
  const places = boxPlacements(cases.length);
  const rowHeights = boxRowHeights(cases.length);
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
            gridTemplateRows: rowHeights.map((h) => u(h)).join(' '),
            gap: u(FRAME.gap),
          }}
        >
          {places.map((place) => {
            const item = cases[place.index];
            if (!item) return null;
            const tile = empty ? undefined : item.tile;
            const placement: CSSProperties = {
              gridRow: place.row,
              gridColumn: `span ${place.span}`,
            };
            return tile ? (
              <PublicBentoTile
                key={item.key}
                // Le tampon pour le bento principal, la question pour une
                // édition, comme dans l'app.
                stamp={filledCaseLabel(item)}
                question={!isMainCaseKey(item.key)}
                tile={tile}
                size={place.size as TileSize}
                rotate={place.rotate}
                placement={placement}
                // La première case est la plus grande au-dessus de la ligne de
                // flottaison : c'est elle le LCP, et elle seule échappe au
                // chargement différé. Avant, la règle visait la catégorie
                // `film` ; toute disposition ouvre sur une case unique, donc
                // l'index dit la même chose et vaut pour une édition.
                priority={place.index === 0}
              />
            ) : (
              <PublicBentoEmptyTile
                key={item.key}
                prompt={item.prompt}
                rotate={place.rotate}
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
