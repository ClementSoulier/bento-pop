import { ImageResponse } from 'next/og';
import { popyDataUrl } from './_og/assets';

export const contentType = 'image/png';

type IconConfig = {
  size: number;
  /** Diamètre du popy en proportion du canvas (0..1). */
  popyRatio: number;
  /** Rayon des coins en proportion du canvas (0 = carré, 0.5 = cercle). */
  radiusRatio: number;
};

function getConfig(id: string): IconConfig {
  switch (id) {
    case '64':
      return { size: 64, popyRatio: 0.9, radiusRatio: 0.22 };
    case '192':
      return { size: 192, popyRatio: 0.85, radiusRatio: 0.18 };
    case '512':
      return { size: 512, popyRatio: 0.85, radiusRatio: 0.18 };
    default:
      return { size: 64, popyRatio: 0.9, radiusRatio: 0.22 };
  }
}

export async function generateImageMetadata() {
  return (['64', '192', '512'] as const).map((id) => {
    const config = getConfig(id);
    return {
      id,
      contentType: 'image/png' as const,
      size: { width: config.size, height: config.size },
    };
  });
}

export default function Icon({ id }: { id: string }) {
  const config = getConfig(id);
  const popyPx = Math.round(config.size * config.popyRatio);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fbbf24',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: config.size * config.radiusRatio,
        }}
      >
        <img src={popyDataUrl} alt="" width={popyPx} height={popyPx} />
      </div>
    ),
    { width: config.size, height: config.size },
  );
}
