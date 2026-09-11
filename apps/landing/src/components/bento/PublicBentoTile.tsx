import type { CSSProperties } from 'react';
import { CATEGORY_META, PALETTES } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';
import { SmartImage } from '@/components/SmartImage';
import type { BentoTile } from '@/lib/bento/map';
import { paletteGradient } from '@/lib/bento/gradient';
import { cleanTitle, initialOf } from '@/lib/bento/text';
import { TILE, TILE_SCRIM, TILE_SIZES, TILE_TYPO, type TileSize } from './layout';

/** `u` = unité de design, cf. `layout.ts`. */
const u = (n: number) => `calc(${n} * var(--u))`;

type PublicBentoTileProps = {
  category: CategoryKey;
  tile: BentoTile;
  size: TileSize;
  rotate: number;
  /** Placement dans la grille, fourni par `PublicBentoGrid`. */
  placement: CSSProperties;
  /**
   * Désactive le chargement différé. Réservé au compartiment film, qui est
   * le LCP de la page. L'activer partout annulerait le bénéfice du lazy
   * loading sur les cinq autres.
   */
  priority?: boolean;
};

/**
 * Compartiment rempli du bento public.
 *
 * Trois couches, comme dans l'app : le visuel (photo ou dégradé plus
 * initiale en filigrane), un voile sombre pour la lisibilité du texte, puis
 * le contenu. Rendu côté serveur uniquement, aucun JavaScript expédié.
 *
 * L'image porte `alt=""` volontairement : le titre est déjà présent en
 * texte juste en dessous, une description de l'affiche ferait doublon à
 * l'oreille. C'est la définition même d'une image décorative.
 */
export function PublicBentoTile({
  category,
  tile,
  size,
  rotate,
  placement,
  priority = false,
}: PublicBentoTileProps) {
  const meta = CATEGORY_META[category];
  const typo = TILE_TYPO[size];
  const palette = PALETTES[tile.paletteKey];
  const hasImage = Boolean(tile.imageUrl);
  const title = cleanTitle(tile.title);

  // Sur un dégradé, la couleur d'encre de la palette est déjà choisie pour
  // contraster ; sur une photo, c'est le voile sombre qui garantit le ratio.
  const ink = hasImage ? '#ffffff' : palette.ink;

  return (
    <li
      className="relative min-w-0 list-none"
      style={{
        ...placement,
        borderRadius: u(TILE.radius),
        transform: `rotate(${rotate}deg)`,
        // Ombre « stamp » plate, signature de la charte. Portée par le
        // wrapper : sur l'élément à `overflow: hidden`, elle serait rognée.
        boxShadow: `0 ${u(4)} 0 var(--bento-ink)`,
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-bento-ink"
        style={{
          borderRadius: u(TILE.radius),
          // Fond ink identique à la bordure : sans lui, un liseré clair
          // apparaît par endroits entre une bordure arrondie et l'image
          // détourée, le rendu sub-pixel des deux ne coïncidant pas.
          border: `max(2px, ${u(TILE.border)}) solid var(--bento-ink)`,
        }}
      >
        {/* Couche 1 : visuel */}
        {tile.imageUrl ? (
          <SmartImage
            src={tile.imageUrl}
            alt=""
            fill
            sizes={TILE_SIZES[size]}
            priority={priority}
            className="h-full w-full object-cover"
          />
        ) : (
          <FallbackVisual
            initial={initialOf(tile.title)}
            gradient={paletteGradient(tile.paletteKey)}
            ink={palette.ink}
            fontSize={typo.initial}
            padding={typo.padding}
          />
        )}

        {/* Couche 2 : voile de lisibilité, uniquement sur photo */}
        {hasImage ? (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: TILE_SCRIM }}
          />
        ) : null}

        {/* Couche 3 : tampon de catégorie */}
        <span
          className="font-display-sm absolute"
          style={{
            top: u(typo.padding),
            left: u(typo.padding),
            padding: `${u(2)} ${u(6)}`,
            borderRadius: u(4),
            background: hasImage ? 'var(--bento-ink)' : palette.ink,
            color: hasImage ? '#ffffff' : palette.colors[0],
            fontSize: `max(8px, ${u(typo.stamp)})`,
            letterSpacing: '0.08em',
            lineHeight: 1.2,
          }}
        >
          {meta.stamp}
        </span>

        {/* Couche 3 : titre et sous-titre */}
        <div
          className="absolute"
          style={{
            left: u(typo.padding),
            right: u(typo.padding),
            bottom: u(typo.padding),
          }}
        >
          <p
            className="bento-tile-title"
            style={{
              color: ink,
              fontSize: u(typo.title),
              // Le tracking de l'app est exprimé en points absolus ; en
              // `em` il reste proportionnel à la taille réelle du texte.
              letterSpacing: `${typo.tracking / typo.title}em`,
              textShadow: hasImage ? '0 1px 0 rgba(0,0,0,0.45)' : undefined,
            }}
          >
            {title}
          </p>
          {tile.subtitle ? (
            <p
              className="truncate"
              style={{
                marginTop: u(4),
                color: hasImage ? 'rgba(255,255,255,0.88)' : palette.ink,
                fontSize: `max(9px, ${u(typo.subtitle)})`,
                fontWeight: 500,
                opacity: hasImage ? 1 : 0.85,
              }}
            >
              {tile.subtitle}
            </p>
          ) : null}
        </div>

        {/* Pas d'attribution sur le compartiment : elle est rendue en
            clair sous la boîte par `BentoAttributions`. Cf. le commentaire
            de ce composant pour le raisonnement. */}
      </div>
    </li>
  );
}

/**
 * Repli quand l'item n'a pas d'illustration : dégradé de la palette plus
 * l'initiale du titre en filigrane, décalée en haut à droite pour ne pas
 * concurrencer le titre. 72 des 277 items du catalogue sont dans ce cas.
 */
function FallbackVisual({
  initial,
  gradient,
  ink,
  fontSize,
  padding,
}: {
  initial: string;
  gradient: string;
  ink: string;
  fontSize: number;
  padding: number;
}) {
  return (
    <>
      <span aria-hidden className="absolute inset-0" style={{ background: gradient }} />
      <span
        aria-hidden
        className="bento-tile-initial absolute"
        style={{
          top: u(padding),
          right: u(padding),
          color: ink,
          fontSize: u(fontSize),
        }}
      >
        {initial}
      </span>
    </>
  );
}
