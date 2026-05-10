import { ImageResponse } from 'next/og';

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
          padding: 80,
        }}
      >
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
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            lineHeight: 0.95,
            textTransform: 'uppercase',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Le Talk-Show</span>
          <span style={{ color: '#e63946' }}>Pop Culture</span>
          <span>qui parcourt la France.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 26, fontWeight: 600 }}>
            Cinéma · Gaming · Mangas · Société
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
