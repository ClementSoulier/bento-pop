import { ImageResponse } from 'next/og';
import { CATEGORY_META, PALETTES } from '@bento-pop/supabase-mobile/bento';
import { logoDataUrl } from '@/app/_og/assets';
import { bentoImageAlt } from '@/lib/bento/metadata';
import { cleanTitle, initialOf } from '@/lib/bento/text';
import { lookupPublicBento } from '@/lib/bento/queries';
import type { BentoSlots } from '@/lib/bento/map';
import {
  coveredCodePoints,
  fetchFallbackFont,
  loadExtenda,
  missingGlyphs,
  normalizeForOg,
} from '@/lib/og/fonts';
import { prefetchImages } from '@/lib/og/images';
import { OG_CONTENT_TYPE, toJpegResponse } from '@/lib/og/encode';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  FRAME,
  TILE,
  TILE_LAYOUT,
  TILE_SCRIM,
  TILE_TYPO,
} from '@/components/bento/layout';

/**
 * Image d'aperçu des liens partagés.
 *
 * C'est l'artefact qui décide si un lien collé dans une conversation
 * donne envie de cliquer. Elle doit donc être **toujours** produite : tout
 * le rendu est enveloppé dans un `try/catch` qui retombe sur une image de
 * marque. Une route d'image qui lève casse l'aperçu et, avec la convention
 * de fichier, peut faire échouer le rendu des métadonnées de la page.
 */

export const size = { width: 1200, height: 630 };
export const contentType = OG_CONTENT_TYPE;

/** Échelle de la boîte : 512 points de design tiennent dans 543 pixels. */
const SCALE = 1.06;
const u = (n: number) => Math.round(n * SCALE * 100) / 100;

const YELLOW = '#fbbf24';
const CREAM = '#fbf3de';
const INK = '#0a0a0a';
const RED = '#e63946';

/**
 * Longueur maximale d'un titre par gabarit, en caractères. Satori ne
 * connaît pas `line-clamp` : sans coupe explicite, un titre long
 * déborderait du compartiment. Les valeurs laissent passer le p95 du
 * catalogue (28 caractères) sur les grands compartiments.
 */
const TITLE_MAX = { lg: 38, md: 22, sm: 15 } as const;

/**
 * Idem pour les sous-titres. Satori ne connaît pas `text-overflow`, un
 * sous-titre trop long passait à la ligne et recouvrait le titre
 * (« FR · Person · French rapper » sur le compartiment artiste).
 */
const SUBTITLE_MAX = { lg: 34, md: 18, sm: 14 } as const;

/**
 * `slug` est absent sur `/u/<pseudo>` et présent sur `/u/<pseudo>/<slug>` :
 * la même route sert les deux, et chaque bento a donc son propre aperçu. Sans
 * cela, le HTML d'un bento nommé et son image auraient montré deux bentos
 * différents, exactement le défaut mesuré au §4.6 de la spéc du chantier 16.
 */
type ImageParams = { params: Promise<{ pseudo: string; slug?: string }> };

export async function generateImageMetadata({ params }: ImageParams) {
  const { pseudo } = await params;
  return [{ id: 'bento', size, contentType, alt: bentoImageAlt(pseudo) }];
}

export default async function OpenGraphImage({ params }: ImageParams) {
  const { pseudo: requested, slug } = await params;

  try {
    const lookup = await lookupPublicBento(requested, slug ?? null);
    const pseudo =
      lookup.kind === 'not-found'
        ? requested
        : lookup.kind === 'published'
          ? lookup.bento.pseudo
          : lookup.pseudo;
    const slots: BentoSlots = lookup.kind === 'published' ? lookup.bento.slots : {};

    const extenda = await loadExtenda();
    const covered = coveredCodePoints(extenda);

    // Textes réellement rendus, pour ne demander en repli que les glyphes
    // qui manquent vraiment.
    const rendered = [
      `@${pseudo}`,
      lookup.kind === 'published' ? (lookup.bento.displayName ?? '') : '',
      ...Object.values(slots).flatMap((tile) => [cleanTitle(tile.title), tile.subtitle ?? '']),
      ...Object.values(CATEGORY_META).map((meta) => meta.stamp),
    ];

    const [fallbackFont, imageMap] = await Promise.all([
      fetchFallbackFont(missingGlyphs(rendered, covered)),
      prefetchImages(Object.values(slots).map((tile) => tile.imageUrl)),
    ]);

    const fonts = [
      { name: 'Extenda', data: extenda, weight: 900 as const, style: 'normal' as const },
      ...(fallbackFont
        ? [{ name: 'Noto', data: fallbackFont, weight: 700 as const, style: 'normal' as const }]
        : []),
    ];

    return toJpegResponse(
      new ImageResponse(
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            background: YELLOW,
            fontFamily: 'Extenda, Noto',
            padding: '0 44px',
          }}
        >
          <BentoBox slots={slots} images={imageMap} />
          <SidePanel
            pseudo={pseudo}
            displayName={lookup.kind === 'published' ? lookup.bento.displayName : null}
            isEmpty={lookup.kind !== 'published'}
          />
        </div>,
        { ...size, fonts },
      ),
    );
  } catch (error) {
    console.error('[og] génération échouée, repli de marque:', error);
    return brandFallback();
  }
}

// ─── Boîte bento ───────────────────────────────────────────────────────

function BentoBox({ slots, images }: { slots: BentoSlots; images: Map<string, string> }) {
  const rows = [1, 2, 3] as const;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: u(DESIGN_WIDTH),
        height: u(DESIGN_HEIGHT),
        background: CREAM,
        border: `${u(FRAME.border)}px solid ${INK}`,
        borderRadius: u(FRAME.radius),
        padding: u(FRAME.padding),
        gap: u(FRAME.gap),
        boxShadow: `0 ${u(8)}px 0 ${INK}`,
      }}
    >
      {rows.map((row) => (
        <div key={row} style={{ display: 'flex', gap: u(FRAME.gap), flex: 1 }}>
          {TILE_LAYOUT.filter((slot) => slot.row === row).map((slot) => {
            const tile = slots[slot.category];
            return tile ? (
              <Tile
                key={slot.category}
                stamp={CATEGORY_META[slot.category].stamp}
                title={cleanTitle(tile.title, TITLE_MAX[slot.size])}
                subtitle={tile.subtitle}
                image={tile.imageUrl ? images.get(tile.imageUrl) : undefined}
                paletteKey={tile.paletteKey}
                size={slot.size}
              />
            ) : (
              <EmptyTile key={slot.category} label={CATEGORY_META[slot.category].label} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Tile({
  stamp,
  title,
  subtitle,
  image,
  paletteKey,
  size: tileSize,
}: {
  stamp: string;
  title: string;
  subtitle: string | null;
  image?: string;
  paletteKey: keyof typeof PALETTES;
  size: keyof typeof TILE_TYPO;
}) {
  const typo = TILE_TYPO[tileSize];
  const palette = PALETTES[paletteKey];
  const ink = image ? '#ffffff' : palette.ink;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        borderRadius: u(TILE.radius),
        border: `${u(TILE.border)}px solid ${INK}`,
        background: image ? INK : `linear-gradient(135deg, ${palette.colors.join(', ')})`,
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: u(typo.padding),
            right: u(typo.padding),
            display: 'flex',
            fontSize: u(typo.initial),
            lineHeight: 0.85,
            color: palette.ink,
            opacity: 0.12,
          }}
        >
          {initialOf(title)}
        </div>
      )}

      {image ? (
        <div
          style={{
            // Décalages explicites : satori n'implémente pas le raccourci
            // `inset`, la couche s'effondrait à zéro et le titre blanc
            // devenait invisible sur une pochette claire.
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: TILE_SCRIM,
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: u(typo.padding),
          left: u(typo.padding),
          display: 'flex',
          padding: `${u(2)}px ${u(6)}px`,
          borderRadius: u(4),
          background: image ? INK : palette.ink,
          color: image ? '#ffffff' : palette.colors[0],
          fontSize: u(typo.stamp + 1),
          letterSpacing: 0.6,
        }}
      >
        {stamp}
      </div>

      <div
        style={{
          position: 'absolute',
          left: u(typo.padding),
          right: u(typo.padding),
          bottom: u(typo.padding),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: ink,
            fontSize: u(typo.title),
            lineHeight: 1,
            letterSpacing: typo.tracking,
            textTransform: 'uppercase',
          }}
        >
          {normalizeForOg(title)}
        </div>
        {subtitle ? (
          <div
            style={{
              display: 'flex',
              marginTop: u(4),
              color: image ? 'rgba(255,255,255,0.88)' : palette.ink,
              fontSize: u(typo.subtitle),
              opacity: image ? 1 : 0.85,
            }}
          >
            {cleanTitle(normalizeForOg(subtitle), SUBTITLE_MAX[tileSize])}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyTile({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff4d8',
        border: `${u(2)}px dashed rgba(10,10,10,0.45)`,
        borderRadius: u(TILE.radius),
        color: INK,
        fontSize: u(11),
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}

// ─── Colonne d'identité ────────────────────────────────────────────────

function SidePanel({
  pseudo,
  displayName,
  isEmpty,
}: {
  pseudo: string;
  displayName: string | null;
  isEmpty: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        height: '100%',
        paddingLeft: 52,
        paddingTop: 44,
        paddingBottom: 44,
      }}
    >
      <img src={logoDataUrl} alt="" width={268} height={62} />

      <div
        style={{
          display: 'flex',
          marginTop: 34,
          fontSize: 20,
          letterSpacing: 3,
          color: 'rgba(10,10,10,0.62)',
          textTransform: 'uppercase',
        }}
      >
        {isEmpty ? 'Bento en préparation' : 'Le bento de'}
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 6,
          fontSize: 68,
          lineHeight: 1.05,
          color: INK,
          textTransform: 'uppercase',
        }}
      >
        @{pseudo}
      </div>

      {displayName ? (
        <div style={{ display: 'flex', marginTop: 10, fontSize: 24, color: 'rgba(10,10,10,0.72)' }}>
          {normalizeForOg(displayName).slice(0, 40)}
        </div>
      ) : null}

      {/* L'adresse en clair : elle sert quand l'image circule en capture
          d'écran, hors de tout lien cliquable. */}
      <div
        style={{
          display: 'flex',
          alignSelf: 'flex-start',
          marginTop: 32,
          padding: '10px 18px',
          borderRadius: 999,
          border: `3px solid ${INK}`,
          background: INK,
          color: YELLOW,
          fontSize: 21,
          letterSpacing: 1,
        }}
      >
        bento-pop.com/u/{pseudo}
      </div>
    </div>
  );
}

// ─── Repli ─────────────────────────────────────────────────────────────

/**
 * Image de marque servie si quoi que ce soit échoue : base injoignable,
 * police illisible, rendu satori en erreur. Sans police embarquée, pour
 * qu'elle ne puisse pas échouer pour la même raison que l'originale.
 */
function brandFallback(): Promise<Response> {
  return toJpegResponse(
    new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: YELLOW,
          gap: 28,
        }}
      >
        <img src={logoDataUrl} alt="" width={520} height={120} />
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: RED }}>
          Compose ton bento pop culture
        </div>
      </div>,
      size,
    ),
  );
}
