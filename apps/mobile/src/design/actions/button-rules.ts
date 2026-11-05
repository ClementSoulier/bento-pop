/**
 * Ce qui décide du libellé d'un bouton. Aucun import de `react-native` : les tests
 * lisent ce module sous `node:test`.
 */

/** Au-delà, un libellé passe sur deux lignes au lieu d'être coupé. */
export const WRAP_LENGTH = 34;

/**
 * Le libellé d'un long bouton, coupé pour que ses deux lignes s'équilibrent : le
 * `text-wrap: balance` du dossier, que React Native n'a pas. « Commence par le film
 * / que tu reverrais ce soir », et non « Commence par le film que tu reverrais ce /
 * soir ». Un libellé court ne se coupe pas, quelle que soit la taille du texte.
 */
export function balancedLabel(label: string): string {
  if (label.length <= WRAP_LENGTH) return label;
  // La coupe qui rend la plus longue des deux lignes la plus courte ; à égalité, la
  // première, comme le navigateur : la seconde ligne reste la plus longue.
  const longest = (at: number) => Math.max(at, label.length - at - 1);
  let best = -1;
  for (let i = 0; i < label.length; i += 1) {
    if (label[i] !== ' ') continue;
    if (best < 0 || longest(i) < longest(best)) best = i;
  }
  return best < 0 ? label : `${label.slice(0, best)}\n${label.slice(best + 1)}`;
}
