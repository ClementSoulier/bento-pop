import { Redirect, Stack } from 'expo-router';

/**
 * Les écrans réservés au développement (chantier 30, D12) : le catalogue du
 * design system. Aucun écran n'y mène ; une build de production renvoie à
 * l'accueil.
 */
export default function DevLayout() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
