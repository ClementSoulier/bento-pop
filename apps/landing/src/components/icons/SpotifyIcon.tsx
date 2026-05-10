import type { SVGProps } from 'react';

export function SpotifyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.7-1.6-6.1-2-10.1-1.1a.75.75 0 1 1-.3-1.5c4.4-1 8.2-.5 11.2 1.3.4.2.5.7.2 1.1zm1.5-3.4a.94.94 0 0 1-1.3.3c-3.1-1.9-7.8-2.4-11.4-1.3a.94.94 0 1 1-.5-1.8c4.2-1.3 9.4-.7 13 1.5.4.3.6.9.2 1.3zm.1-3.5c-3.7-2.2-9.8-2.4-13.3-1.3a1.13 1.13 0 0 1-.7-2.1c4-1.2 10.8-1 15 1.5a1.12 1.12 0 1 1-1 2z" />
    </svg>
  );
}
