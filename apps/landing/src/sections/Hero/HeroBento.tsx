import type { HeroContent } from '@/lib/content/schemas';
import { BentoFrame } from '@/components/BentoFrame';
import { Sticker } from '@/components/Sticker';
import { HeroBentoCell } from './HeroBentoCell';

type HeroBentoProps = { hero: HeroContent };

/**
 * Showcase « bento » à droite du hero : grid stylisée + stickers tournés.
 *
 * Variante A. La grille s'adapte selon que la cellule TikTok soit présente
 * ou non :
 *   - TikTok actif → col 1 plus étroite (0.7fr) + rangées 2-3 plus hautes
 *     pour épouser le ratio 9:16 du short. Cols 2-3 absorbent l'espace libéré.
 *   - Legacy (pas de TikTok) → 3 colonnes égales, rangées 2-3 « normales ».
 */
export function HeroBento({ hero }: HeroBentoProps) {
  const hasTiktok = hero.bentoCells.some((c) => c.kind === 'tiktok');

  const gridTemplateColumns = hasTiktok ? '0.7fr 1.15fr 1.15fr' : '1fr 1fr 1fr';
  const gridTemplateRows = hasTiktok
    ? 'auto minmax(160px, 1fr) minmax(160px, 1fr)'
    : 'auto minmax(120px, 1fr) minmax(120px, 1fr)';

  return (
    <BentoFrame
      rotation={2}
      className="mx-auto w-full max-w-[600px] lg:mx-0 lg:max-w-none"
    >
      {hero.stickers.map((sticker) => (
        <Sticker
          key={sticker.id}
          rotation={sticker.rotation}
          tone={sticker.tone}
          style={sticker.position}
        >
          {sticker.text}
        </Sticker>
      ))}
      {/*
        Le className `bp-hero-bento-grid` (+ variante `--tiktok`) sert de hook
        pour le responsive : sur mobile on bascule en 2 colonnes et on cache
        PM + CNV pour libérer de la place au lecteur TikTok (cf. globals.css).
      */}
      <div
        className={`bp-hero-bento-grid ${hasTiktok ? 'bp-hero-bento-grid--tiktok' : ''} grid w-full gap-2.5`}
        style={{ gridTemplateColumns, gridTemplateRows }}
      >
        {hero.bentoCells.map((cell, i) => (
          <HeroBentoCell key={i} cell={cell} />
        ))}
      </div>
    </BentoFrame>
  );
}
