
/**
 * Ce qui reste des mesures de la recherche d'item depuis le chantier 32 : la
 * grille est passée au design (`ItemGrid`, `design/bento/item-grid-rules.ts`).
 * Restent la loupe de « Trouver », refaite au 33, et le texte d'exemple du
 * champ.
 *
 * Aucun import de `react-native` : le module doit rester chargeable sous
 * `node:test`. Même raison et même forme que `components/feed/layout.ts`.
 */

/**
 * Boîte de la loupe de la barre de recherche de « Trouver ».
 *
 * La boîte qu'occupait l'emoji 🔍 sur iPhone, 23 pt de large sur 19 de haut,
 * mesurée dans l'arbre d'accessibilité : l'icône qui le remplace (chantier 11)
 * ne déplace ni le champ ni la barre.
 */
export const SEARCH_ICON_BOX = {
  width: 23,
  height: 19,
  justifyContent: 'center',
} as const;

/**
 * Placeholder du champ de recherche.
 *
 * L'article s'accorde au genre du libellé. La version précédente
 * concaténait « Cherche un » et le libellé, ce qui donnait « Cherche un
 * chanson… » et « Cherche un série… », visibles sur deux des six écrans.
 */
export function searchPlaceholder(
  meta: { label: string; gender: 'm' | 'f' },
  /**
   * L'intitulé est-il un nom commun ?
   *
   * Vrai pour les six cases du bento principal, « Film », « Série », dont
   * l'article s'accorde. Faux pour la question d'une édition : « Cherche une
   * la série que tu caches… » ne veut rien dire. La question est déjà le
   * titre de la feuille, le champ n'a donc pas à la répéter.
   */
  nomCommun = true,
): string {
  if (!nomCommun) return 'Cherche…';
  return `Cherche ${meta.gender === 'f' ? 'une' : 'un'} ${meta.label.toLowerCase()}…`;
}
