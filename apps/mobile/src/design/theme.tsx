import { createContext, useContext, type ReactNode } from 'react';
import { border, colors, palette, radius, shadow, size, space, type } from './tokens';

/**
 * Le thème du design system v2 (chantier 30, D4) : les tokens générés depuis le
 * dossier de la refonte, lus par `useTheme()`.
 *
 * Le clair seul est actif. Les valeurs sombres sont dans `tokens.ts`, choisies
 * nulle part : les écrans sombres restent à décliner et relire dans Claude
 * Design avant la sortie qui les activera (D3 de la refonte), et `app.json`
 * garde `userInterfaceStyle` à `light`. Ce jour-là, seul `ThemeProvider`
 * change : les composants lisent déjà leurs couleurs dans le thème.
 */
export type Scheme = 'light' | 'dark';

function themeFor(scheme: Scheme) {
  return {
    scheme,
    colors: colors[scheme],
    palette,
    type,
    space,
    radius,
    border,
    size,
    shadow: shadow[scheme],
  };
}

export type Theme = ReturnType<typeof themeFor>;

export const THEMES: Record<Scheme, Theme> = {
  light: themeFor('light'),
  dark: themeFor('dark'),
};

const ThemeContext = createContext<Theme>(THEMES.light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={THEMES.light}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
