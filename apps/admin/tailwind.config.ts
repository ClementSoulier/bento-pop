import type { Config } from 'tailwindcss';
import { tailwindPreset } from '@bento-pop/brand';

/**
 * Le BO réutilise le preset Bento Pop (palette/fontes/keyframes) et ajoute
 * une palette « admin SaaS » : surfaces blanches, séparateurs discrets,
 * accents chromatiques pour les badges (info/success/warn/danger).
 *
 * Convention : les classes admin sont préfixées `admin-` côté CSS pour ne
 * pas polluer le namespace landing en cas de partage futur via @bento-pop/ui.
 */
const config: Config = {
  presets: [tailwindPreset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#f6f5f1',
          surface: '#ffffff',
          'surface-2': '#faf9f5',
          border: '#e7e4dc',
          'border-strong': '#d4d0c4',
          ink: '#1a1a1a',
          'ink-2': '#3a3a3a',
          muted: '#7a766c',
          'muted-2': '#a8a499',
          'yellow-soft': '#fef3c7',
          'red-soft': '#fee5e7',
          green: '#2d9d6f',
          'green-soft': '#dcf3e8',
          blue: '#3b82a8',
          'blue-soft': '#dbeaf3',
          purple: '#8b5cf6',
          'purple-soft': '#ede9fe',
        },
      },
      fontFamily: {
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'admin-card': '12px',
        'admin-input': '8px',
      },
      boxShadow: {
        'admin-focus': '0 0 0 3px #fef3c7',
        'admin-card': '0 1px 2px rgba(0,0,0,0.04)',
        'admin-modal': '0 24px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
