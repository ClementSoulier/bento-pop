import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
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
          borderRadius: 14,
        }}
      >
        <img src={popySrc} alt="" width={58} height={58} />
      </div>
    ),
    { ...size },
  );
}
