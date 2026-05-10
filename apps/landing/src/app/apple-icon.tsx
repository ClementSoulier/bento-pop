import { ImageResponse } from 'next/og';
import { popyDataUrl } from './_og/assets';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <img src={popyDataUrl} alt="" width={150} height={150} />
      </div>
    ),
    { ...size },
  );
}
