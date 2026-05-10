import type { Config } from 'tailwindcss';
import { tailwindPreset } from '@bento-pop/brand';

const config: Config = {
  presets: [tailwindPreset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        nick: ['var(--font-yuji-syuku)', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
