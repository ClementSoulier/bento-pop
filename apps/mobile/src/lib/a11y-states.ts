/**
 * Les rôles et les états d'accessibilité que React Native lirait en anglais
 * sur iOS.
 *
 * iOS n'a de trait natif ni pour une case à cocher ni pour un bouton radio :
 * React Native écrit donc lui-même « checkbox », « radio button »,
 * « checked », « unchecked », « expanded » et « busy » dans la valeur que lit
 * VoiceOver (`RCTViewComponentView.mm`). En anglais seulement : son bundle de
 * traductions n'est pas embarqué, et son fichier français est vide. Relevé au
 * chantier 29 (D18), simulateur réglé en français : la case des conditions
 * s'annonçait « checkbox, unchecked ».
 *
 * Les traits natifs, bouton, sélectionné, estompé, interrupteur, sont dits
 * par VoiceOver dans la langue du téléphone. Sur iOS, ces fonctions passent
 * donc par eux, et par une valeur française que React Native ajoute telle
 * quelle. Ailleurs, elles gardent les rôles de React Native, que TalkBack dit
 * dans la langue du téléphone.
 *
 * Un interrupteur n'en a pas besoin : React Native lui donne le trait natif et
 * la valeur « 1 » ou « 0 », que VoiceOver traduit.
 *
 * Aucun import de `react-native` : testé sous `node:test`. L'appelant passe
 * `Platform.OS`.
 */

export type A11yState = {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean;
  busy?: boolean;
};

export type A11yValue = { text: string } | undefined;

/** Une case à cocher : sur iOS, un bouton qui dit s'il est coché. */
export function checkboxA11y(
  checked: boolean,
  os: string,
): { role: 'button' | 'checkbox'; state: A11yState; value: A11yValue } {
  if (os === 'ios') {
    return { role: 'button', state: {}, value: { text: checked ? 'coché' : 'non coché' } };
  }
  return { role: 'checkbox', state: { checked }, value: undefined };
}

/**
 * Un choix parmi plusieurs, les motifs d'un signalement : sur iOS, un bouton
 * au trait « sélectionné », que VoiceOver dit en français.
 */
export function radioA11y(
  selected: boolean,
  os: string,
): { role: 'button' | 'radio'; state: A11yState } {
  if (os === 'ios') return { role: 'button', state: { selected } };
  return { role: 'radio', state: { checked: selected } };
}

/**
 * Un bouton qui travaille. Sur iOS, l'état `busy` disparaît, et `value` dit
 * « en cours » : à poser seulement quand le libellé ne le dit pas déjà,
 * comme « Suppression en cours ».
 */
export function busyA11y(
  state: { disabled?: boolean; busy?: boolean },
  os: string,
): { state: A11yState; value: A11yValue } {
  if (os !== 'ios') return { state, value: undefined };
  const { busy, ...rest } = state;
  return { state: rest, value: busy ? { text: 'en cours' } : undefined };
}
