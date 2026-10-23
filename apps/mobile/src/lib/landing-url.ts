import Constants from 'expo-constants';
import { normalizeLandingUrl } from './episodes';

/**
 * L'adresse de la landing, compilée dans l'app. Chantier 19, D12.
 *
 * `bento-pop.com` par défaut : une build sans la variable vise la production,
 * comme toutes les adresses du site écrites en dur jusqu'ici. La recette la
 * pointe sur une landing locale par `EXPO_PUBLIC_LANDING_URL`.
 *
 * Le repli lit `process.env.EXPO_PUBLIC_LANDING_URL` sous sa forme statique,
 * que Metro incruste dans le bundle : un dev client déjà compilé, dont
 * l'`extra` ne connaît pas encore la variable, la suit sans être recompilé.
 */
export const LANDING_URL = normalizeLandingUrl(
  (Constants.expoConfig?.extra?.LANDING_URL as string | undefined) ??
    process.env.EXPO_PUBLIC_LANDING_URL,
);
