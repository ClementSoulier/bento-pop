import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const popyBuffer = await readFile(new URL('./_og/popy.png', import.meta.url));
  const popySrc = `data:image/png;base64,${Buffer.from(popyBuffer).toString('base64')}`;

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
        }}
      >
        {/* iOS applique son propre masque arrondi : pas de borderRadius ici,
            on laisse le popy occuper l'espace en gardant une petite marge. */}
        <img src={popySrc} alt="" width={150} height={150} />
      </div>
    ),
    { ...size },
  );
}
