import type { CSSProperties } from 'react';
import { PALETTES } from '@bento-pop/supabase-mobile/bento';
import { SmartImage } from '@/components/SmartImage';
import type { BentoTile } from '@/lib/bento/map';
import { paletteGradient } from '@/lib/bento/gradient';
import { cleanTitle, initialOf } from '@/lib/bento/text';
import { TILE, TILE_SCRIM, TILE_SIZES, TILE_TYPO, type TileSize } from './layout';
import { QUESTION_PADDING_H, QUESTION_PADDING_V, webQuestionLabel } from './question-label';
import { webTitleClamped } from './title-clamp';

/** `u` = unité de design, cf. `layout.ts`. */
const u = (n: number) => `calc(${n} * var(--u))`;

type PublicBentoTileProps = {
  /**
   * L'étiquette en haut du compartiment : le tampon court du bento principal,
   * ou la question d'une édition, cf. `question`.
   */
  stamp: string;
  /**
   * `stamp` est la question d'une édition : en Bungee comme dans l'app, sur
   * deux lignes au plus, coupées et dimensionnées côté serveur. Absent pour le
   * bento principal, dont l'étiquette ne change pas.
   */
  question?: boolean;
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
  stamp,
  tile,
  size,
  rotate,
  placement,
  priority = false,
  question = false,
}: PublicBentoTileProps) {
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

        {/* Couche 3 : tampon de catégorie, ou question d'une édition */}
        {question ? (
          <QuestionLabel
            question={stamp}
            size={size}
            background={hasImage ? 'var(--bento-ink)' : palette.ink}
            color={hasImage ? '#ffffff' : palette.colors[0]}
          />
        ) : (
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
            {stamp}
          </span>
        )}

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
            // Un titre coupé à deux lignes rogne le haut de la 3e, cf.
            // `title-clamp.ts` ; les autres gardent le bas de leur 2e ligne.
            className={
              webTitleClamped(title, size)
                ? 'bento-tile-title bento-tile-title-clamped'
                : 'bento-tile-title'
            }
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
 * La question d'une édition, là où le bento principal écrit « FILM ».
 *
 * Coupée en lignes côté serveur, en unités de design : la boîte se met à
 * l'échelle en unités de conteneur, donc la coupe vaut à toute largeur. Le
 * fond prend la largeur de la plus longue ligne, et non toute la largeur de la
 * case, ce que le navigateur ferait d'un texte qui passe à la ligne.
 *
 * Pas de plancher en pixels, contrairement au tampon : il ferait grossir le
 * texte sans grossir la case, et la coupe calculée ne vaudrait plus. Le titre
 * de la case n'en a pas non plus.
 *
 * Les lignes sont masquées aux lecteurs d'écran, qui entendent la question
 * telle qu'écrite, en minuscules, plutôt que ses morceaux en capitales.
 */
function QuestionLabel({
  question,
  size,
  background,
  color,
}: {
  question: string;
  size: TileSize;
  background: string;
  color: string;
}) {
  const typo = TILE_TYPO[size];
  const { fit, boxTextWidth } = webQuestionLabel(question, size);
  const [premiere = '', ...suite] = fit.lines;
  const seconde = suite.join(' ');
  return (
    <>
      <span
        aria-hidden
        className="absolute"
        style={{
          top: u(typo.padding),
          left: u(typo.padding),
          width: u(boxTextWidth + QUESTION_PADDING_H * 2),
          padding: `${u(QUESTION_PADDING_V)} ${u(QUESTION_PADDING_H)}`,
          borderRadius: u(4),
          background,
          color,
          fontFamily: 'var(--font-bungee), sans-serif',
          fontSize: u(fit.fontSize),
          lineHeight: 1.25,
          letterSpacing: u(1),
        }}
      >
        <span className="block overflow-hidden whitespace-nowrap">{premiere}</span>
        {seconde ? (
          // Une question que le back-office a acceptée tient en deux lignes ;
          // si ce n'était pas le cas, la seconde se tronque au lieu de déborder.
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{seconde}</span>
        ) : null}
      </span>
      <span className="sr-only">{question}</span>
    </>
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
