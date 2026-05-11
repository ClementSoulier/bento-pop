import { tailwindPreset } from '@bento-pop/brand';
import type { Config } from 'tailwindcss';

/**
 * Tailwind config — consomme le preset Bento Pop (couleurs, ombres, fonts).
 * NativeWind ajoute le preset RN pour transformer les classes en styles
 * compatibles React Native.
 */
const config: Config = {
  // NOTE: `presets: [require('nativewind/preset'), tailwindPreset]` —
  // l'ordre compte, nativewind d'abord puis le preset brand par-dessus.
  presets: [require('nativewind/preset'), tailwindPreset as Config],
  // `class` (au lieu du défaut `media`) : autorise un set manuel du
  // colorScheme par l'app (expo-system-ui le force à 'light' via
  // app.json:userInterfaceStyle). Sans ça, NativeWind throw « Cannot
  // manually set color scheme, as dark mode is type 'media' ».
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Extenda', 'Bungee', 'sans-serif'],
        body: ['Fredoka', 'system-ui', 'sans-serif'],
        accent: ['Bungee', 'sans-serif'],
      },
    },
  },
};

export default config;
