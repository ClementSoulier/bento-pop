import type { SVGProps } from 'react';

export function TwitchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M4.286 0 1 4.286V19.43h5.143V24h2.857l3.428-3.429h4.572L24 14.286V0zM6.143 18.286V3.714h15.428v9.143l-2.857 2.857h-4.572l-3.428 3.429v-3.429H6.143zm9.143-7.429h-1.857V6.286h1.857zM10 10.857H8.143V6.286H10z" />
    </svg>
  );
}
