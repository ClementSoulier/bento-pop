import type { FloatingPopyConfig } from '@/lib/content/schemas';

type FloatingPopyProps = {
  config: FloatingPopyConfig;
};

/**
 * Mascotte Popy flottante (animation CSS pure : `bp-bob`).
 * Positionnée en absolu via les valeurs `top/right/bottom/left` du config.
 */
export function FloatingPopy({ config }: FloatingPopyProps) {
  const { mascotPath, position, size, rotation, delaySeconds } = config;
  return (
    <img
      src={mascotPath}
      alt=""
      aria-hidden
      className="pointer-events-none absolute"
      style={
        {
          width: size,
          ...position,
          filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.2))',
          animation: 'bp-bob 4.5s ease-in-out infinite',
          animationDelay: `${delaySeconds}s`,
          transform: `rotate(${rotation}deg)`,
          ['--r' as string]: `${rotation}deg`,
        } as React.CSSProperties
      }
    />
  );
}
