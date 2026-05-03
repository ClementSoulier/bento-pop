import type { Config } from 'tailwindcss';
import { colors, radii, easings } from './tokens';

/**
 * Preset Tailwind Bento Pop.
 * Étendu par chaque app via :
 *
 *   import { tailwindPreset } from '@bento-pop/brand';
 *   export default { presets: [tailwindPreset], content: [...] } satisfies Config;
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bento: {
          yellow: colors.yellow,
          'yellow-alt': colors.yellowAlt,
          'yellow-deep': colors.yellowDeep,
          orange: colors.orange,
          cream: colors.cream,
          'cream-alt': colors.creamAlt,
          ink: colors.ink,
          'ink-soft': colors.inkSoft,
          pink: colors.pink,
          red: colors.redAccent,
          'tint-base': colors.tintBase,
          'tint-a': colors.tintA,
          'tint-b': colors.tintB,
          'tint-c': colors.tintC,
          'tint-d': colors.tintD,
          'tint-lit': colors.tintLit,
        },
      },
      borderRadius: {
        bento: radii.bento,
        'bento-lg': radii.xl,
        'bento-md': radii.lg,
      },
      boxShadow: {
        stamp: '0 4px 0 var(--bento-ink)',
        'stamp-lg': '0 8px 0 var(--bento-ink)',
        'stamp-xl': '0 10px 0 var(--bento-ink)',
        card: '0 8px 0 var(--bento-ink), 0 14px 30px rgba(0,0,0,0.25)',
        reveal: '0 12px 0 var(--bento-ink), 0 24px 60px rgba(0,0,0,0.4)',
      },
      fontFamily: {
        display: ['var(--font-extenda)', 'var(--font-bungee)', 'sans-serif'],
        body: ['var(--font-fredoka)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        pop: easings.pop,
        bounce: easings.bounce,
      },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--r, 0deg))' },
          '50%': { transform: 'translateY(-10px) rotate(calc(var(--r, 0deg) + 2deg))' },
        },
        pulse: {
          '50%': { opacity: '0.3' },
        },
        twinkle: {
          '0%, 100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
          '50%': { transform: 'scale(0.4) rotate(90deg)', opacity: '0.5' },
        },
        spinDash: {
          to: { transform: 'rotate(360deg)' },
        },
        winnerBounce: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.15) rotate(-4deg)' },
          '70%': { transform: 'scale(0.98) rotate(2deg)' },
          '100%': { transform: 'scale(1.06) rotate(0)' },
        },
        popyBoing: {
          '0%': { transform: 'scale(0.2) rotate(-20deg)' },
          '60%': { transform: 'scale(1.15) rotate(8deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
      },
      animation: {
        bob: 'bob 4s ease-in-out infinite',
        'pulse-dot': 'pulse 0.7s ease-in-out infinite',
        twinkle: 'twinkle 0.7s ease-in-out infinite',
        'spin-dash': 'spinDash 6s linear infinite',
        'winner-bounce': 'winnerBounce 0.9s cubic-bezier(.2,1.8,.4,1) 1',
        'popy-boing': 'popyBoing 0.7s cubic-bezier(.2,1.8,.4,1)',
      },
    },
  },
};

export default preset;
