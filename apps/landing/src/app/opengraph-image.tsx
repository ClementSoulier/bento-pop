import { ImageResponse } from 'next/og';
import { logoDataUrl, popyDataUrl } from './_og/assets';

export const alt = 'Bento Pop — Le Talk-Show Pop Culture';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fbbf24',
          color: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          position: 'relative',
        }}
      >
        {/* Popy flottant en haut à droite */}
        <img
          src={popyDataUrl}
          alt=""
          width={220}
          height={220}
          style={{
            position: 'absolute',
            top: 32,
            right: 36,
            transform: 'rotate(8deg)',
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: '#e63946',
          }}
        >
          Bento Pop · Saison 02
        </div>

        {/* Logo central */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <img src={logoDataUrl} alt="Bento Pop" width={820} height={189} />
        </div>

        {/* Footer : tagline + URL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1.2,
            }}
          >
            <span>Le Talk-Show Pop Culture qui parcourt la France.</span>
            <span style={{ fontSize: 22, fontWeight: 500, opacity: 0.75, marginTop: 6 }}>
              Cinéma · Gaming · Mangas · Société
            </span>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              padding: '14px 28px',
              background: '#0a0a0a',
              color: '#fbf3de',
              borderRadius: 999,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            bento-pop.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
