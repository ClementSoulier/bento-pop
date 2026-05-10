import type { SVGProps } from 'react';

export function DeezerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="11" />
      <path fill="#fff" d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm-1 4h2v3.5l3 1.7-1 1.7-4-2.4V9z" />
    </svg>
  );
}
